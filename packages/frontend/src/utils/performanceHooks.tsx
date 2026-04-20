/**
 * Performance-Optimized React Hooks
 *
 * Collection of custom hooks for performance optimization including
 * memoization, lazy loading, and performance monitoring.
 */

import { useEffect, useRef, useState, useCallback, useMemo, DependencyList } from 'react';
import {
  debounce,
  throttle,
  rafThrottle,
  runWhenIdle,
  measureExecution,
  PerformanceMonitor,
  type PerformanceMetrics,
} from './performanceOptimizations.js';

// ============================================
// PERFORMANCE MONITORING HOOKS
// ============================================

/**
 * Hook for monitoring component performance
 */
export function usePerformanceMonitor(enabled: boolean = true, reportInterval: number = 5000) {
  const monitorRef = useRef<PerformanceMonitor | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const monitor = new PerformanceMonitor({ enabled: true, reportInterval });
    monitorRef.current = monitor;

    const unsubscribe = monitor.onMetrics((m) => {
      setMetrics(m);
    });

    return () => {
      unsubscribe();
      monitor.destroy();
      monitorRef.current = null;
    };
  }, [enabled, reportInterval]);

  const mark = useCallback((name: string) => {
    monitorRef.current?.mark(name);
  }, []);

  const measure = useCallback((name: string, startMark: string, endMark: string) => {
    return monitorRef.current?.measure(name, startMark, endMark) || 0;
  }, []);

  const getAverage = useCallback((timeWindow?: number) => {
    return monitorRef.current?.getAverageMetrics(timeWindow);
  }, []);

  return {
    metrics,
    mark,
    measure,
    getAverage,
    latest: metrics,
  };
}

/**
 * Hook to measure render time
 */
export function useRenderTime(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(0);

  useEffect(() => {
    const now = performance.now();
    if (lastRenderTime.current > 0) {
      const renderTime = now - lastRenderTime.current;
      if (renderTime > 16) { // Log slow renders (>60fps threshold)
        console.warn(`[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms`);
      }
    }
    lastRenderTime.current = now;
    renderCount.current++;
  });

  return renderCount.current;
}

// ============================================
// OPTIMIZED STATE HOOKS
// ============================================

/**
 * Optimized useState with debounced updates
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number
): [T, (value: T | ((prev: T) => T)) => void, T] {
  const [state, setState] = useState<T>(initialValue);
  const [debouncedState, setDebouncedState] = useState<T>(initialValue);

  const debouncedSetState = useMemo(
    () => debounce((value: T | ((prev: T) => T)) => {
      setState(value);
      setDebouncedState(typeof value === 'function' ? (value as (prev: T) => T)(state) : value);
    }, delay),
    [delay, state]
  );

  return [debouncedState, debouncedSetState, state];
}

/**
 * Optimized useState with throttled updates
 */
export function useThrottledState<T>(
  initialValue: T,
  delay: number
): [T, (value: T | ((prev: T) => T)) => void, T] {
  const [state, setState] = useState<T>(initialValue);
  const [throttledState, setThrottledState] = useState<T>(initialValue);

  const throttledSetState = useMemo(
    () => throttle((value: T | ((prev: T) => T)) => {
      setState(value);
      setThrottledState(typeof value === 'function' ? (value as (prev: T) => T)(state) : value);
    }, delay),
    [delay, state]
  );

  return [throttledState, throttledSetState, state];
}

// ============================================
// OPTIMIZED EFFECT HOOKS
// ============================================

/**
 * useEffect with debounced dependency checks
 */
export function useDebouncedEffect(
  effect: React.EffectCallback,
  deps: DependencyList,
  delay: number
) {
  const [debouncedDeps, setDebouncedDeps] = useState(deps);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedDeps(deps);
    }, delay);
    return () => clearTimeout(timeout);
  }, [deps, delay]);

  useEffect(effect, debouncedDeps);
}

/**
 * useEffect that runs during idle time
 */
export function useIdleEffect(
  effect: React.EffectCallback,
  deps: DependencyList,
  timeout: number = 5000
) {
  useEffect(() => {
    const cleanup = runWhenIdle(() => {
      const cleanupEffect = effect();
      return cleanupEffect;
    }, timeout);

    return () => {
      // Cancel idle callback if component unmounts
      // (Note: requestIdleCallback doesn't support cancellation directly)
    };
  }, deps);
}

// ============================================
// EVENT HANDLER HOOKS
// ============================================

/**
 * Debounced event handler
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  return useMemo(() => debounce(callback, delay), [callback, delay]);
}

/**
 * Throttled event handler
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  return useMemo(() => throttle(callback, delay), [callback, delay]);
}

/**
 * RAF-throttled event handler (optimized for animations)
 */
export function useRafCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  return useMemo(() => rafThrottle(callback), [callback]);
}

/**
 * Optimized scroll handler
 */
export function useScrollHandler(
  handler: (event: Event) => void,
  options: {
    throttle?: number;
    passive?: boolean;
  } = {}
) {
  const { throttle: throttleMs = 16, passive = true } = options;

  const throttledHandler = useThrottledCallback(handler, throttleMs);

  useEffect(() => {
    window.addEventListener('scroll', throttledHandler, { passive });
    return () => window.removeEventListener('scroll', throttledHandler);
  }, [throttledHandler, passive]);
}

/**
 * Optimized resize handler
 */
export function useResizeHandler(
  handler: () => void,
  options: {
    debounce?: number;
  } = {}
) {
  const { debounce: debounceMs = 100 } = options;

  const debouncedHandler = useDebouncedCallback(handler, debounceMs);

  useEffect(() => {
    window.addEventListener('resize', debouncedHandler);
    return () => window.removeEventListener('resize', debouncedHandler);
  }, [debouncedHandler]);
}

// ============================================
// OBSERVER HOOKS
// ============================================

/**
 * Intersection Observer hook with performance optimizations
 */
export function useIntersectionObserver(
  targetRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {},
  enabled: boolean = true
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!enabled || !targetRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsIntersecting(entry.isIntersecting);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observerRef.current.observe(targetRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [targetRef, options, enabled]);

  return isIntersecting;
}

/**
 * Resize Observer hook with debounced callbacks
 */
export function useResizeObserver(
  targetRef: React.RefObject<Element>,
  callback: (entries: ResizeObserverEntry[]) => void,
  options: {
    debounce?: number;
    box?: ResizeObserverBoxOptions;
  } = {}
) {
  const { debounce: debounceMs = 100, box = 'border-box' } = options;

  const debouncedCallback = useDebouncedCallback(callback, debounceMs);

  useEffect(() => {
    if (!targetRef.current) return;

    const observer = new ResizeObserver(debouncedCallback);
    observer.observe(targetRef.current, { box });

    return () => observer.disconnect();
  }, [targetRef, debouncedCallback, box]);
}

// ============================================
// LAZY LOADING HOOKS
// ============================================

/**
 * Hook for lazy loading components
 */
export function useLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadComponent = async () => {
      try {
        const module = await importFn();
        if (mounted) {
          setComponent(() => module.default);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    loadComponent();

    return () => {
      mounted = false;
    };
  }, [importFn]);

  if (loading) return fallback || null;
  if (error) throw error;
  return Component;
}

/**
 * Hook for lazy loading images
 */
export function useLazyImage(src: string, options: { threshold?: number; rootMargin?: string } = {}) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const { threshold = 0.1, rootMargin = '50px' } = options;

  useIntersectionObserver(imgRef, { threshold, rootMargin });

  useEffect(() => {
    if (inView && !loaded && src) {
      const img = new Image();
      img.onload = () => setLoaded(true);
      img.onerror = () => setLoaded(true); // Set loaded even on error to show placeholder
      img.src = src;
    }
  }, [inView, loaded, src]);

  return { imgRef, loaded, inView };
}

// ============================================
// COMPUTATION HOOKS
// ============================================

/**
 * Hook for expensive computations with memoization
 */
export function useComputation<T>(
  computeFn: () => T,
  deps: DependencyList,
  options: {
    memoize?: boolean;
    key?: string;
  } = {}
): T {
  const cacheRef = useRef<Map<string, { value: T; deps: DependencyList }>>(new Map());

  return useMemo(() => {
    const key = options.key || 'default';

    if (options.memoize) {
      const cached = cacheRef.current.get(key);
      if (cached && deps.length === cached.deps.length && deps.every((dep, i) => dep === cached.deps[i])) {
        return cached.value;
      }
    }

    const value = computeFn();
    cacheRef.current.set(key, { value, deps });
    return value;
  }, deps);
}

/**
 * Hook for async computations with loading state
 */
export function useAsyncComputation<T>(
  computeFn: () => Promise<T>,
  deps: DependencyList,
  initialValue?: T
) {
  const [value, setValue] = useState<T | undefined>(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await measureExecution(computeFn, 'AsyncComputation');
        if (!cancelled && mountedRef.current) {
          setValue(result.result);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, deps);

  return { value, loading, error, retry: () => {} };
}

// ============================================
// MEMORY MANAGEMENT HOOKS
// ============================================

/**
 * Hook for tracking memory usage
 */
export function useMemoryStats(interval: number = 1000) {
  const [stats, setStats] = useState<{ used: number; total: number; limit?: number } | null>(null);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        setStats({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
        });
      }
    }, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return stats;
}

/**
 * Hook for detecting memory pressure
 */
export function useMemoryPressure(threshold: number = 0.9) {
  const stats = useMemoryStats();
  const [isHigh, setIsHigh] = useState(false);

  useEffect(() => {
    if (stats && stats.limit) {
      const ratio = stats.used / stats.limit;
      setIsHigh(ratio > threshold);
    }
  }, [stats, threshold]);

  return isHigh;
}

// ============================================
// NETWORK AWARENESS HOOKS
// ============================================

/**
 * Hook for monitoring network connection
 */
export function useNetworkConnection() {
  const [connection, setConnection] = useState<{
    type: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  } | null>(null);

  useEffect(() => {
    const conn = (navigator as any).connection;
    if (!conn) return;

    const updateConnection = () => {
      setConnection({
        type: conn.type || 'unknown',
        effectiveType: conn.effectiveType || 'unknown',
        downlink: conn.downlink || 0,
        rtt: conn.rtt || 0,
        saveData: conn.saveData || false,
      });
    };

    updateConnection();
    conn.addEventListener('change', updateConnection);

    return () => conn.removeEventListener('change', updateConnection);
  }, []);

  return connection;
}

/**
 * Hook for adaptive behavior based on network conditions
 */
export function useAdaptiveBehavior<T extends Record<string, any>>(
  configs: {
    slow: Partial<T>;
    fast: Partial<T>;
  },
  base: T
): T {
  const connection = useNetworkConnection();

  const isSlow = useMemo(() => {
    if (!connection) return false;
    return (
      connection.effectiveType === '2g' ||
      connection.effectiveType === 'slow-2g' ||
      connection.saveData
    );
  }, [connection]);

  return useMemo(() => {
    return {
      ...base,
      ...(isSlow ? configs.slow : configs.fast),
    };
  }, [base, configs, isSlow]);
}

// ============================================
// VIRTUAL SCROLLING HOOK
// ============================================

interface VirtualScrollOptions {
  itemCount: number;
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number;
}

export function useVirtualScroll(options: VirtualScrollOptions) {
  const { itemCount, itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);

  const getItemHeight = useCallback(
    (index: number) => {
      return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
    },
    [itemHeight]
  );

  const visibleRange = useMemo(() => {
    let startIndex = 0;
    let endIndex = 0;
    let offsetY = 0;

    if (typeof itemHeight === 'number') {
      // Fixed height items
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      endIndex = Math.min(itemCount, startIndex + visibleCount + overscan * 2);
      offsetY = startIndex * itemHeight;
    } else {
      // Variable height items
      let accumulatedHeight = 0;
      let startFound = false;

      for (let i = 0; i < itemCount; i++) {
        const height = getItemHeight(i);

        if (!startFound && accumulatedHeight + height >= scrollTop - overscan * itemHeight) {
          startIndex = i;
          offsetY = accumulatedHeight;
          startFound = true;
        }

        if (startFound && accumulatedHeight >= scrollTop + containerHeight) {
          endIndex = i + overscan;
          break;
        }

        accumulatedHeight += height;
        endIndex = i + 1;
      }

      startIndex = Math.max(0, startIndex - overscan);
      endIndex = Math.min(itemCount, endIndex + overscan);
    }

    return { startIndex, endIndex, offsetY };
  }, [scrollTop, itemCount, containerHeight, overscan, getItemHeight, itemHeight]);

  const totalHeight = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return itemCount * itemHeight;
    }

    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += getItemHeight(i);
    }
    return total;
  }, [itemCount, itemHeight, getItemHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems: Array.from(
      { length: visibleRange.endIndex - visibleRange.startIndex },
      (_, i) => visibleRange.startIndex + i
    ),
    totalHeight,
    offsetY: visibleRange.offsetY,
    handleScroll,
    scrollTop,
  };
}

// ============================================
// PREFETCHING HOOKS
// ============================================

/**
 * Hook for prefetching data
 */
export function usePrefetch<T>(
  prefetchFn: () => Promise<T>,
  condition: boolean,
  delay: number = 1000
) {
  useEffect(() => {
    if (!condition) return;

    const timeout = setTimeout(() => {
      prefetchFn();
    }, delay);

    return () => clearTimeout(timeout);
  }, [condition, delay, prefetchFn]);
}

/**
 * Hook for preloading images
 */
export function usePreloadImages(urls: string[], condition: boolean = true) {
  useEffect(() => {
    if (!condition) return;

    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [urls, condition]);
}
