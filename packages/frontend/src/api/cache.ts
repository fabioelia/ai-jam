/**
 * API Caching and Deduplication Layer
 *
 * Intelligent caching strategies and request deduplication to reduce
 * network requests and improve data loading performance.
 */

import { apiFetch, ApiError } from './client.js';

// ============================================
// CACHE CONFIGURATION
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  ttl: number;
  hits: number;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  staleWhileRevalidate: boolean;
}

export const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Short-lived cache for frequently changing data
  ephemeral: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
    staleWhileRevalidate: true,
  },
  // Medium-lived cache for semi-static data
  standard: {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 500,
    staleWhileRevalidate: true,
  },
  // Long-lived cache for static data
  persistent: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxSize: 1000,
    staleWhileRevalidate: false,
  },
};

// ============================================
// IN-MEMORY CACHE
// ============================================

export class APICache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;
  private accessOrder: string[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.maxSize = config.maxSize || 500;
    this.defaultTTL = config.ttl || 15 * 60 * 1000;
  }

  set(key: string, data: T, ttl: number = this.defaultTTL): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      ttl,
      hits: 0,
    });

    // Update access order
    this.updateAccessOrder(key);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update hit count and access order
    entry.hits++;
    this.updateAccessOrder(key);

    return entry.data;
  }

  getStale(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  private evictOldest(): void {
    if (this.accessOrder.length === 0) return;

    const oldestKey = this.accessOrder[0];
    this.delete(oldestKey);
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const now = Date.now();
    let totalHits = 0;

    const entries = Array.from(this.cache.entries()).map(([key, entry]) => {
      totalHits += entry.hits;
      return {
        key,
        hits: entry.hits,
        age: now - entry.timestamp,
      };
    });

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalHits / (totalHits + (this.cache.size - totalHits) || 1),
      entries,
    };
  }
}

// ============================================
// REQUEST DEDUPLICATION
// ============================================

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  refCount: number;
}

export class RequestDeduplicator {
  private pending = new Map<string, PendingRequest<any>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5000) {
    this.defaultTTL = defaultTTL;
  }

  async execute<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const now = Date.now();

    // Clean up expired requests
    this.cleanupExpired(now);

    // Check if request is already pending
    const existing = this.pending.get(key);
    if (existing && now - existing.timestamp < ttl) {
      existing.refCount++;
      return existing.promise;
    }

    // Create new request
    const promise = requestFn();
    const pending: PendingRequest<T> = {
      promise,
      timestamp: now,
      refCount: 1,
    };

    this.pending.set(key, pending);

    // Cleanup after promise settles
    promise.finally(() => {
      pending.refCount--;
      if (pending.refCount <= 0) {
        this.pending.delete(key);
      }
    });

    return promise;
  }

  private cleanupExpired(now: number): void {
    for (const [key, req] of this.pending) {
      if (now - req.timestamp > this.defaultTTL) {
        this.pending.delete(key);
      }
    }
  }

  clear(): void {
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }
}

// ============================================
// INTELLIGENT CACHE CLIENT
// ============================================

interface CachedFetchOptions {
  cache?: APICache<any> | 'ephemeral' | 'standard' | 'persistent';
  ttl?: number;
  forceRefresh?: boolean;
  deduplicate?: boolean;
  staleWhileRevalidate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export class CacheClient {
  private cache: APICache;
  private deduplicator: RequestDeduplicator;
  private backgroundRefreshPromises = new Map<string, Promise<any>>();

  constructor() {
    this.cache = new APICache(DEFAULT_CACHE_CONFIGS.standard);
    this.deduplicator = new RequestDeduplicator();
  }

  async fetch<T>(
    path: string,
    options: RequestInit = {},
    cacheOptions: CachedFetchOptions = {}
  ): Promise<T> {
    const {
      cache = 'standard',
      ttl,
      forceRefresh = false,
      deduplicate = true,
      staleWhileRevalidate = true,
      onSuccess,
      onError,
    } = cacheOptions;

    const cacheKey = this.getCacheKey(path, options);
    const cacheConfig = typeof cache === 'string' ? DEFAULT_CACHE_CONFIGS[cache] : undefined;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached !== null) {
        // Trigger background refresh if stale but data is available
        if (staleWhileRevalidate && this.isStale(cacheKey)) {
          this.backgroundRefresh(cacheKey, path, options, cacheConfig?.ttl || ttl);
        }
        return cached;
      }
    }

    // Deduplicate concurrent requests
    const fetchFn = async () => {
      try {
        const data = await apiFetch<T>(path, options);

        // Cache the response
        const cacheTTL = ttl || cacheConfig?.ttl || DEFAULT_CACHE_CONFIGS.standard.ttl;
        this.cache.set(cacheKey, data, cacheTTL);

        onSuccess?.(data);
        return data;
      } catch (error) {
        // Return stale data if available and stale-while-revalidate is enabled
        if (staleWhileRevalidate) {
          const staleData = this.cache.getStale(cacheKey);
          if (staleData !== null) {
            console.warn('Using stale data due to fetch error:', error);
            return staleData as T;
          }
        }

        onError?.(error as Error);
        throw error;
      }
    };

    if (deduplicate) {
      return this.deduplicator.execute(cacheKey, fetchFn);
    }

    return fetchFn();
  }

  private async backgroundRefresh(
    cacheKey: string,
    path: string,
    options: RequestInit,
    ttl: number = DEFAULT_CACHE_CONFIGS.standard.ttl
  ): Promise<void> {
    // Don't start another refresh if one is in progress
    if (this.backgroundRefreshPromises.has(cacheKey)) {
      return;
    }

    const refreshPromise = (async () => {
      try {
        const data = await apiFetch(path, options);
        this.cache.set(cacheKey, data, ttl);
      } catch (error) {
        console.warn('Background refresh failed:', error);
      } finally {
        this.backgroundRefreshPromises.delete(cacheKey);
      }
    })();

    this.backgroundRefreshPromises.set(cacheKey, refreshPromise);
  }

  private getCacheKey(path: string, options: RequestInit = {}): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${path}:${body}`;
  }

  private isStale(cacheKey: string): boolean {
    const entry = (this.cache as any).cache?.get(cacheKey);
    if (!entry) return false;
    return Date.now() > entry.expiresAt;
  }

  invalidate(path: string, options: RequestInit = {}): void {
    const cacheKey = this.getCacheKey(path, options);
    this.cache.delete(cacheKey);
  }

  invalidatePattern(pattern: string | RegExp): void {
    const keys = Array.from((this.cache as any).cache.keys());

    for (const key of keys) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      } else if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.deduplicator.clear();
    this.backgroundRefreshPromises.clear();
  }

  getStats() {
    return {
      cache: this.cache.getStats(),
      deduplicator: {
        size: this.deduplicator.size,
      },
      backgroundRefreshes: this.backgroundRefreshPromises.size,
    };
  }
}

// Global cache client instance
export const globalCacheClient = new CacheClient();

// ============================================
// CACHE HOOKS FOR REACT
// ============================================

import { useEffect, useState, useCallback } from 'react';

export function useCachedFetch<T>(
  path: string,
  options?: CachedFetchOptions,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await globalCacheClient.fetch<T>(path, {}, options);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [path, JSON.stringify(options), ...dependencies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    globalCacheClient.invalidate(path);
  }, [path]);

  return { data, loading, error, refetch, invalidate };
}

// ============================================
// PREFETCHING STRATEGIES
// ============================================

export class PrefetchManager {
  private prefetchQueue = new Set<string>();
  private isPrefetching = false;

  async prefetch(paths: string[], priority: 'high' | 'low' = 'low'): Promise<void> {
    const pathsToPrefetch = paths.filter(p => !this.prefetchQueue.has(p));

    if (pathsToPrefetch.length === 0) return;

    pathsToPrefetch.forEach(p => this.prefetchQueue.add(p));

    if (priority === 'high') {
      // Immediate prefetch for high priority
      await Promise.all(
        pathsToPrefetch.map(path =>
          globalCacheClient.fetch(path).catch(() => {
            // Silent fail for prefetch
          })
        )
      );
    } else {
      // Deferred prefetch for low priority
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => this.runLowPriorityPrefetch(pathsToPrefetch));
      } else {
        setTimeout(() => this.runLowPriorityPrefetch(pathsToPrefetch), 1000);
      }
    }
  }

  private async runLowPriorityPrefetch(paths: string[]): Promise<void> {
    if (this.isPrefetching) return;

    this.isPrefetching = true;

    try {
      for (const path of paths) {
        await globalCacheClient.fetch(path).catch(() => {
          // Silent fail
        });
        this.prefetchQueue.delete(path);

        // Small delay between prefetches to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isPrefetching = false;
    }
  }

  clear(): void {
    this.prefetchQueue.clear();
  }
}

export const globalPrefetchManager = new PrefetchManager();

// ============================================
// CACHE INVALIDATION STRATEGIES
// ============================================

export class CacheInvalidator {
  private invalidationRules = new Map<string, (data: any) => boolean>();

  addRule(pathPattern: string, predicate: (data: any) => boolean): void {
    this.invalidationRules.set(pathPattern, predicate);
  }

  invalidateOnMutation(mutationPath: string, data: any): void {
    for (const [pattern, predicate] of this.invalidationRules) {
      const regex = new RegExp(pattern);
      if (regex.test(mutationPath) && predicate(data)) {
        globalCacheClient.invalidatePattern(pattern);
      }
    }
  }

  setupDefaultRules(): void {
    // Invalidate board data when tickets are moved
    this.addRule(/\/tickets\/.+\/move/, () => true);

    // Invalidate board data when tickets are reordered
    this.addRule(/\/tickets\/.+\/reorder/, () => true);

    // Invalidate ticket detail when ticket is updated
    this.addRule(/\/tickets\/.*/, () => true);

    // Invalidate board when new tickets are created
    this.addRule(/\/tickets$/, () => true);
  }
}

export const globalCacheInvalidator = new CacheInvalidator();
globalCacheInvalidator.setupDefaultRules();
