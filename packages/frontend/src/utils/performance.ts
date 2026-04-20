/**
 * Mobile Performance Optimizations
 *
 * Utilities and functions for optimizing performance on mobile devices,
 * including image optimization, lazy loading, and memory management.
 */

import { useBreakpoint, useReducedMotion, useDeviceMemory } from '../hooks/useResponsive.js';

// ============================================
// IMAGE OPTIMIZATION UTILITIES
// ============================================

/**
 * Generate responsive image srcset with multiple sizes
 */
export function generateResponsiveSrcset(
  baseUrl: string,
  sizes: number[],
  format: 'webp' | 'jpg' | 'png' = 'webp'
): string {
  return sizes
    .map(size => `${baseUrl}-${size}w.${format} ${size}w`)
    .join(', ');
}

/**
 * Generate responsive sizes attribute for images
 */
export function generateResponsiveSizes(
  breakpoints: { [key: string]: number },
  maxWidth?: number
): string {
  const sizes = Object.entries(breakpoints)
    .map(([bp, width], index, entries) => {
      const nextWidth = index < entries.length - 1 ? entries[index + 1][1] - 1 : maxWidth || width;
      return `(max-width: ${width}px) ${nextWidth}px`;
    })
    .concat([`${maxWidth || breakpoints[Object.keys(breakpoints).length - 1]}px`]);

  return sizes.join(', ');
}

/**
 * Calculate optimal image size for current viewport
 */
export function getOptimalImageSize(
  baseWidth: number,
  containerWidth: number,
  devicePixelRatio: number = 1
): number {
  // Account for device pixel ratio
  const scaledWidth = baseWidth * devicePixelRatio;

  // Don't exceed container width significantly
  const maxAcceptableWidth = containerWidth * 2;

  return Math.min(scaledWidth, maxAcceptableWidth);
}

/**
 * Lazy load images with intersection observer
 */
export function lazyLoadImages(
  selector: string = '[data-lazy]',
  rootMargin: string = '100px'
): void {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );

    document.querySelectorAll(selector).forEach(img => {
      imageObserver.observe(img);
    });
  }
}

// ============================================
// LAZY LOADING COMPONENT UTILITIES
// ============================================

/**
 * Create a lazy loading wrapper for components
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  return React.lazy(componentImport);
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources(resources: {
  scripts?: string[];
  styles?: string[];
  images?: string[];
}): void {
  // Preload scripts
  resources.scripts?.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = url;
    document.head.appendChild(link);
  });

  // Preload styles
  resources.styles?.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = url;
    document.head.appendChild(link);
  });

  // Preload images
  resources.images?.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
}

// ============================================
// ANIMATION OPTIMIZATIONS
// ============================================

/**
 * Determine if animations should be reduced
 */
export function shouldReduceAnimations(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    (navigator as any).connection?.effectiveType === 'slow-2g' ||
    (navigator as any).connection?.effectiveType === '2g'
  );
}

/**
 * Get optimized animation duration for current device
 */
export function getOptimizedAnimationDuration(baseDuration: number): number {
  if (shouldReduceAnimations()) return 0;

  const connection = (navigator as any).connection;
  if (connection?.effectiveType === 'slow-2g') return baseDuration * 0.5;
  if (connection?.effectiveType === '2g') return baseDuration * 0.7;
  if (connection?.effectiveType === '3g') return baseDuration * 0.85;

  return baseDuration;
}

/**
 * Optimize animations for mobile performance
 */
export function optimizeForMobile(element: HTMLElement): void {
  const { isMobile, isTouch } = useBreakpoint();

  if (isMobile) {
    // Enable hardware acceleration
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'transform';

    // Use GPU for compositing
    element.style.backfaceVisibility = 'hidden';
    element.style.perspective = '1000px';

    // Optimize touch events
    if (isTouch) {
      element.style.touchAction = 'manipulation';
    }
  }
}

// ============================================
// MEMORY MANAGEMENT
// ============================================

/**
 * Check if device has low memory
 */
export function isLowMemoryDevice(): boolean {
  const deviceMemory = (navigator as any).deviceMemory;
  return deviceMemory !== undefined && deviceMemory < 4;
}

/**
 * Get appropriate cache size based on device memory
 */
export function getCacheSize(): number {
  const deviceMemory = (navigator as any).deviceMemory || 4;

  // Reduce cache size on low-memory devices
  if (deviceMemory < 2) return 10; // 10MB
  if (deviceMemory < 4) return 25; // 25MB
  if (deviceMemory < 8) return 50; // 50MB
  return 100; // 100MB
}

/**
 * Create a memory-aware cache
 */
export class MemoryAwareCache<T> {
  private cache: Map<string, { value: T; timestamp: number }>;
  private maxSize: number;
  private maxAge: number;

  constructor(maxSize: number = 100, maxAge: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  set(key: string, value: T): void {
    // Reduce cache size on low-memory devices
    const adjustedMaxSize = isLowMemoryDevice() ? Math.floor(this.maxSize / 2) : this.maxSize;

    // Remove oldest entry if cache is full
    if (this.cache.size >= adjustedMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if entry is too old
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ============================================
// THROTTLING AND DEBOUNCING
// ============================================

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return function (...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    }
  };
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Request animation frame throttle
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function (...args: Parameters<T>) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          func(...lastArgs);
          rafId = null;
          lastArgs = null;
        }
      });
    }
  };
}

// ============================================
// NETWORK-AWARE OPTIMIZATIONS
// ============================================

/**
 * Get current network quality
 */
export function getNetworkQuality(): 'slow' | 'moderate' | 'fast' | 'unknown' {
  const connection = (navigator as any).connection;

  if (!connection) return 'unknown';

  const effectiveType = connection.effectiveType;
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
  if (effectiveType === '3g') return 'moderate';
  if (effectiveType === '4g') return 'fast';

  return 'unknown';
}

/**
 * Determine if we should use low-quality mode
 */
export function shouldUseLowQualityMode(): boolean {
  const networkQuality = getNetworkQuality();
  const lowMemory = isLowMemoryDevice();
  const reducedMotion = shouldReduceAnimations();

  return networkQuality === 'slow' || lowMemory || reducedMotion;
}

/**
 * Get appropriate data batch size based on network quality
 */
export function getOptimalBatchSize(
  baseSize: number,
  networkQuality: ReturnType<typeof getNetworkQuality>
): number {
  switch (networkQuality) {
    case 'slow':
      return Math.max(1, Math.floor(baseSize / 4));
    case 'moderate':
      return Math.max(1, Math.floor(baseSize / 2));
    case 'fast':
      return baseSize;
    default:
      return baseSize;
  }
}

// ============================================
// VIRTUAL SCROLLING UTILITIES
// ============================================

interface VirtualScrollOptions<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

/**
 * Calculate visible items for virtual scrolling
 */
export function getVisibleRange<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: VirtualScrollOptions<T>) {
  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  return {
    visibleCount,
    totalHeight,
    startIndex: 0,
    endIndex: Math.min(items.length, visibleCount + overscan),
  };
}

/**
 * Calculate scroll position for virtual scrolling
 */
export function getScrollPosition(
  scrollTop: number,
  itemHeight: number,
  overscan: number = 5
) {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const offsetY = startIndex * itemHeight;

  return { startIndex, offsetY };
}

// ============================================
// PERFORMANCE MONITORING
// ============================================

interface PerformanceMetrics {
  fps: number;
  memoryUsage?: number;
  renderTime: number;
}

/**
 * Monitor performance metrics
 */
export function monitorPerformance(callback: (metrics: PerformanceMetrics) => void): () => void {
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let lastFpsUpdate = lastFrameTime;

  const measureFrame = () => {
    const now = performance.now();
    frameCount++;

    // Update FPS every second
    if (now - lastFpsUpdate >= 1000) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
      const memoryUsage = (performance as any).memory?.usedJSHeapSize;

      callback({
        fps,
        memoryUsage,
        renderTime: now - lastFrameTime,
      });

      frameCount = 0;
      lastFpsUpdate = now;
    }

    lastFrameTime = now;
    requestAnimationFrame(measureFrame);
  };

  requestAnimationFrame(measureFrame);

  // Return cleanup function
  return () => {
    // In a real implementation, you'd cancel the animation frame
  };
}

/**
 * Check if device is under performance pressure
 */
export function isUnderPerformancePressure(): boolean {
  const connection = (navigator as any).connection;
  const deviceMemory = (navigator as any).deviceMemory;

  return (
    (connection?.saveData === true) ||
    (deviceMemory !== undefined && deviceMemory < 2) ||
    shouldReduceAnimations()
  );
}

// ============================================
// CRITICAL RENDERING OPTIMIZATIONS
// ============================================

/**
 * Prioritize critical rendering path
 */
export function prioritizeCriticalRendering(): void {
  // Reduce JavaScript execution time
  if (isLowMemoryDevice()) {
    // Use requestIdleCallback for non-critical tasks
    const tasks: Array<() => void> = [];

    (window as any).requestIdleCallback = (callback: IdleRequestCallback) => {
      return setTimeout(() => {
        const start = performance.now();
        callback({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (performance.now() - start)),
        });
      }, 1);
    };
  }

  // Optimize layout thrashing
  const style = document.documentElement.style;
  style.willChange = 'auto'; // Reset will-change
}

/**
 * Create a performance-aware component wrapper
 */
export function withPerformanceOptimization<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> {
  return function OptimizedComponent(props: P) {
    const { isMobile, isTablet } = useBreakpoint();
    const reducedMotion = useReducedMotion();

    // Skip animations on mobile with reduced motion
    const shouldAnimate = !reducedMotion && !isMobile;

    // Reduce prop updates on mobile
    const memoizedProps = isMobile ? React.useMemo(() => props, [JSON.stringify(props)]) : props;

    return (
      <WrappedComponent
        {...(memoizedProps as P)}
        data-optimized={isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}
        data-reduced-motion={reducedMotion}
      />
    );
  };
}

// ============================================
// TOUCH OPTIMIZATIONS
// ============================================

/**
 * Optimize touch event handling
 */
export function optimizeTouchEvents(element: HTMLElement): void {
  // Use passive event listeners for better scroll performance
  element.addEventListener('touchstart', () => {}, { passive: true });
  element.addEventListener('touchmove', () => {}, { passive: true });

  // Prevent double-tap zoom on iOS
  element.addEventListener('touchend', (e) => {
    e.preventDefault();
  }, { passive: false });
}

/**
 * Add touch feedback to element
 */
export function addTouchFeedback(element: HTMLElement): void {
  element.addEventListener('touchstart', () => {
    element.style.transform = 'scale(0.97)';
    element.style.opacity = '0.8';
  });

  element.addEventListener('touchend', () => {
    element.style.transform = 'scale(1)';
    element.style.opacity = '1';
  });
}
