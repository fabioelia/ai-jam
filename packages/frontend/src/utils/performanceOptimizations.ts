/**
 * Performance Optimization Utilities
 *
 * Comprehensive performance utilities including memoization, debouncing,
 * request deduplication, and performance monitoring.
 */

// ============================================
// MEMOIZATION UTILITIES
// ============================================

/**
 * Simple memoization cache for functions
 */
export class MemoizationCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxAge: number;

  constructor(maxAge: number = 5000) {
    this.maxAge = maxAge;
  }

  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Memoize expensive function calls
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  cache: MemoizationCache<string, ReturnType<T>> = new MemoizationCache()
): T {
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Deep memoize for complex objects
 */
export function deepMemoize<T extends (...args: any[]) => any>(
  fn: T,
  maxAge: number = 5000
): T {
  const cache = new MemoizationCache<string, ReturnType<T>>(maxAge);

  return ((...args: Parameters<T>) => {
    const key = deepHash(args);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Create a deep hash for complex objects
 */
function deepHash(value: any): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `array[${value.map(deepHash).join(',')}]`;
    }
    const keys = Object.keys(value).sort();
    return `object{${keys.map(k => `${k}:${deepHash(value[k])}`).join(',')}}`;
  }

  return String(value);
}

/**
 * LRU (Least Recently Used) Cache
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
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
    for (const [k, req] of this.pending) {
      if (now - req.timestamp > ttl) {
        this.pending.delete(k);
      }
    }

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

  clear(): void {
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }
}

// Global deduplicator instance
export const globalDeduplicator = new RequestDeduplicator();

// ============================================
// PERFORMANCE MONITORING
// ============================================

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: number;
  fps: number;
  longTasks: number;
  timestamp: number;
}

export interface PerformanceConfig {
  enabled: boolean;
  samplingRate: number;
  longTaskThreshold: number;
  reportInterval: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private lastFrameTime = performance.now();
  private longTaskObserver?: PerformanceObserver;
  private config: PerformanceConfig;
  private reporters: Array<(metrics: PerformanceMetrics) => void> = [];
  private intervalId?: NodeJS.Timeout;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enabled: true,
      samplingRate: 0.1,
      longTaskThreshold: 50,
      reportInterval: 5000,
      ...config,
    };
    this.setup();
  }

  private setup(): void {
    if (!this.config.enabled) return;

    // Setup long task observer
    if ('PerformanceObserver' in window) {
      this.longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.duration >= this.config.longTaskThreshold) {
            console.warn(`Long task detected: ${entry.duration}ms`, entry);
          }
        }
      });

      try {
        this.longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('Long task observation not supported');
      }
    }

    // Start FPS monitoring
    requestAnimationFrame(this.measureFrame.bind(this));

    // Start periodic reporting
    this.intervalId = setInterval(() => {
      this.reportMetrics();
    }, this.config.reportInterval);
  }

  private measureFrame(): void {
    const now = performance.now();
    this.frameCount++;

    // Update FPS every second
    if (now - this.lastFpsUpdate >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.lastFpsUpdate = now;
      this.frameCount = 0;

      const memoryUsage = (performance as any).memory?.usedJSHeapSize;

      const metrics: PerformanceMetrics = {
        fps,
        renderTime: now - this.lastFrameTime,
        memoryUsage,
        longTasks: this.getLongTaskCount(),
        timestamp: now,
      };

      this.metrics.push(metrics);
      this.notifyReporters(metrics);
    }

    this.lastFrameTime = now;

    if (this.config.enabled) {
      requestAnimationFrame(this.measureFrame.bind(this));
    }
  }

  private getLongTaskCount(): number {
    if (!this.longTaskObserver) return 0;
    try {
      const entries = this.longTaskObserver.takeRecords();
      return entries.filter(e => e.duration >= this.config.longTaskThreshold).length;
    } catch {
      return 0;
    }
  }

  private reportMetrics(): void {
    const latest = this.getLatestMetrics();
    if (latest) {
      console.table({
        FPS: latest.fps,
        'Render Time': `${latest.renderTime.toFixed(2)}ms`,
        'Memory Usage': latest.memoryUsage
          ? `${(latest.memoryUsage / 1024 / 1024).toFixed(2)}MB`
          : 'N/A',
        'Long Tasks': latest.longTasks,
      });
    }
  }

  private notifyReporters(metrics: PerformanceMetrics): void {
    for (const reporter of this.reporters) {
      try {
        reporter(metrics);
      } catch (e) {
        console.error('Error in performance reporter:', e);
      }
    }
  }

  onMetrics(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.reporters.push(callback);
    return () => {
      const index = this.reporters.indexOf(callback);
      if (index > -1) {
        this.reporters.splice(index, 1);
      }
    };
  }

  getLatestMetrics(): PerformanceMetrics | undefined {
    return this.metrics[this.metrics.length - 1];
  }

  getAverageMetrics(timeWindow: number = 5000): PerformanceMetrics | undefined {
    const now = performance.now();
    const recent = this.metrics.filter(m => now - m.timestamp <= timeWindow);

    if (recent.length === 0) return undefined;

    return {
      renderTime: recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length,
      fps: Math.round(recent.reduce((sum, m) => sum + m.fps, 0) / recent.length),
      memoryUsage: recent[recent.length - 1].memoryUsage,
      longTasks: recent.reduce((sum, m) => sum + m.longTasks, 0),
      timestamp: now,
    };
  }

  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark: string): number {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name, 'measure')[0];
    return measure?.duration || 0;
  }

  destroy(): void {
    this.config.enabled = false;
    this.longTaskObserver?.disconnect();
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();

// ============================================
// THROTTLING AND DEBOUNCING
// ============================================

/**
 * Throttle function to limit execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * Debounce function to delay execution
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * RequestAnimationFrame-based throttle
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn.apply(this, lastArgs);
          rafId = null;
          lastArgs = null;
        }
      });
    }
  };
}

/**
 * Idle callback for non-critical tasks
 */
export function runWhenIdle<T extends (...args: any[]) => any>(
  fn: T,
  timeout: number = 5000
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => fn.apply(this, args), { timeout });
    } else {
      // Fallback to setTimeout
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timeoutId = null;
        fn.apply(this, args);
      }, 1);
    }
  };
}

// ============================================
// BATCHING UTILITIES
// ============================================

/**
 * Batch multiple updates into a single operation
 */
export class BatchOperation<T> {
  private queue: T[] = [];
  private batchSize: number;
  private flushInterval: number;
  private processor: (items: T[]) => Promise<void> | void;
  private flushTimer?: NodeJS.Timeout;
  private isFlushing = false;

  constructor(
    processor: (items: T[]) => Promise<void> | void,
    options: {
      batchSize?: number;
      flushInterval?: number;
    } = {}
  ) {
    this.processor = processor;
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 1000;
  }

  add(item: T): void {
    this.queue.push(item);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    this.isFlushing = true;
    const items = [...this.queue];
    this.queue = [];

    try {
      await this.processor(items);
    } finally {
      this.isFlushing = false;
    }
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    await this.flush();
  }
}

// ============================================
// MEMORY MANAGEMENT
// ============================================

/**
 * Get memory usage statistics
 */
export function getMemoryStats(): {
  used: number;
  total: number;
  limit?: number;
} | null {
  const memory = (performance as any).memory;
  if (!memory) return null;

  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
  };
}

/**
 * Check if memory pressure is high
 */
export function isMemoryPressureHigh(threshold: number = 0.9): boolean {
  const stats = getMemoryStats();
  if (!stats) return false;
  if (!stats.limit) return false;
  return stats.used / stats.limit > threshold;
}

/**
 * Trigger garbage collection hint
 */
export function suggestGC(): void {
  // No-op in browsers, but available in Node.js
  if (typeof global !== 'undefined' && (global as any).gc) {
    (global as any).gc();
  }
}

/**
 * Create a weak reference to an object
 */
export function createWeakRef<T extends object>(obj: T): WeakRef<T> {
  return new WeakRef(obj);
}

// ============================================
// NETWORK AWARENESS
// ============================================

export function getConnectionType(): string {
  const connection = (navigator as any).connection;
  return connection?.effectiveType || 'unknown';
}

export function isSlowConnection(): boolean {
  const type = getConnectionType();
  return type === '2g' || type === 'slow-2g';
}

export function getDownloadSpeed(): number {
  const connection = (navigator as any).connection;
  return connection?.downlink || 0;
}

export function isDataSaverEnabled(): boolean {
  const connection = (navigator as any).connection;
  return connection?.saveData || false;
}

/**
 * Get optimal configuration based on network conditions
 */
export function getOptimalConfig<T extends Record<string, any>>(
  configs: {
    slow: Partial<T>;
    fast: Partial<T>;
  },
  base: T
): T {
  const isSlow = isSlowConnection() || isDataSaverEnabled();
  return {
    ...base,
    ...(isSlow ? configs.slow : configs.fast),
  };
}

// ============================================
// PERFORMANCE HINTS
// ============================================

/**
 * Preload a resource
 */
export function preloadResource(href: string, as: 'script' | 'style' | 'image' | 'font'): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
}

/**
 * Prefetch a resource
 */
export function prefetchResource(href: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Preconnect to an origin
 */
export function preconnectOrigin(origin: string): void {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = origin;
  document.head.appendChild(link);
}

/**
 * DNS prefetch for an origin
 */
export function dnsPrefetch(origin: string): void {
  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = origin;
  document.head.appendChild(link);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Measure execution time of a function
 */
export async function measureExecution<T>(
  fn: () => Promise<T> | T,
  name: string = 'Execution'
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (duration > 100) {
    console.warn(`${name} took ${duration.toFixed(2)}ms`);
  }

  return { result, duration };
}

/**
 * Create a performance-optimized wrapper for expensive computations
 */
export function createComputation<T>(
  computeFn: () => T,
  options: {
    memoize?: boolean;
    debounceMs?: number;
    throttleMs?: number;
  } = {}
): () => T {
  let memoizedResult: T | undefined;
  let memoizedArgs: string | undefined;

  let fn = computeFn;

  if (options.debounceMs) {
    fn = debounce(fn, options.debounceMs) as any;
  }

  if (options.throttleMs) {
    fn = throttle(fn, options.throttleMs) as any;
  }

  return function (): T {
    if (options.memoize) {
      const args = JSON.stringify([]);
      if (memoizedArgs === args && memoizedResult !== undefined) {
        return memoizedResult;
      }
      memoizedArgs = args;
      memoizedResult = fn();
      return memoizedResult;
    }
    return fn();
  };
}
