/**
 * Progressive Enhancement Components
 *
 * Components and utilities for graceful degradation and progressive
 * enhancement based on browser capabilities and network conditions.
 */

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { useNetworkStatus } from '../hooks/useServiceWorker.js';

// ============================================
// FEATURE DETECTION
// ============================================

export interface BrowserCapabilities {
  serviceWorker: boolean;
  webGL: boolean;
  webGL2: boolean;
  webWorkers: boolean;
  webSockets: boolean;
  indexedDB: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  geolocation: boolean;
  notification: boolean;
  bluetooth: boolean;
  usb: boolean;
  mediaDevices: boolean;
  paymentRequest: boolean;
  clipboard: boolean;
  webShare: boolean;
  webNFC: boolean;
  wakeLock: boolean;
  screenOrientation: boolean;
  fullScreen: boolean;
  pictureInPicture: boolean;
}

export function useBrowserCapabilities(): BrowserCapabilities {
  const [capabilities, setCapabilities] = useState<BrowserCapabilities>({
    serviceWorker: false,
    webGL: false,
    webGL2: false,
    webWorkers: false,
    webSockets: false,
    indexedDB: false,
    localStorage: false,
    sessionStorage: false,
    geolocation: false,
    notification: false,
    bluetooth: false,
    usb: false,
    mediaDevices: false,
    paymentRequest: false,
    clipboard: false,
    webShare: false,
    webNFC: false,
    wakeLock: false,
    screenOrientation: false,
    fullScreen: false,
    pictureInPicture: false,
  });

  useEffect(() => {
    setCapabilities({
      serviceWorker: 'serviceWorker' in navigator,
      webGL: !!document.createElement('canvas').getContext('webgl'),
      webGL2: !!document.createElement('canvas').getContext('webgl2'),
      webWorkers: 'Worker' in window,
      webSockets: 'WebSocket' in window,
      indexedDB: 'indexedDB' in window,
      localStorage: 'localStorage' in window,
      sessionStorage: 'sessionStorage' in window,
      geolocation: 'geolocation' in navigator,
      notification: 'Notification' in window,
      bluetooth: 'bluetooth' in navigator,
      usb: 'usb' in navigator,
      mediaDevices: 'mediaDevices' in navigator,
      paymentRequest: 'PaymentRequest' in window,
      clipboard: 'clipboard' in navigator,
      webShare: 'share' in navigator,
      webNFC: 'NDEFReader' in window,
      wakeLock: 'wakeLock' in navigator,
      screenOrientation: 'screen' in window && 'orientation' in (window.screen as any),
      fullScreen: 'fullscreenEnabled' in document,
      pictureInPicture: 'pictureInPictureEnabled' in document,
    });
  }, []);

  return capabilities;
}

// ============================================
// PROGRESSIVE ENHANCEMENT WRAPPER
// ============================================

interface ProgressiveEnhancementProps {
  children: ReactNode;
  fallback?: ReactNode;
  features: Array<keyof BrowserCapabilities | ((caps: BrowserCapabilities) => boolean)>;
  requireAll?: boolean;
}

export function ProgressiveEnhancement({
  children,
  fallback = null,
  features,
  requireAll = true,
}: ProgressiveEnhancementProps) {
  const capabilities = useBrowserCapabilities();

  const hasRequiredFeatures = useCallback(() => {
    const checks = features.map(feature => {
      if (typeof feature === 'function') {
        return feature(capabilities);
      }
      return capabilities[feature];
    });

    return requireAll ? checks.every(Boolean) : checks.some(Boolean);
  }, [capabilities, features, requireAll]);

  if (!hasRequiredFeatures()) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// NETWORK-AWARE LOADING
// ============================================

interface NetworkAwareLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
  lowDataFallback?: ReactNode;
  offlineFallback?: ReactNode;
  loadingComponent?: ReactNode;
  prefetch?: boolean;
}

export function NetworkAwareLoader({
  children,
  fallback = null,
  lowDataFallback = null,
  offlineFallback = null,
  loadingComponent = null,
  prefetch = false,
}: NetworkAwareLoaderProps) {
  const { isOnline, isSlowConnection, isDataSaver } = useNetworkStatus();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time based on network conditions
    const delay = isSlowConnection ? 2000 : 500;
    const timer = setTimeout(() => setIsLoading(false), delay);
    return () => clearTimeout(timer);
  }, [isSlowConnection]);

  if (isLoading && loadingComponent) {
    return <>{loadingComponent}</>;
  }

  if (!isOnline && offlineFallback) {
    return <>{offlineFallback}</>;
  }

  if ((isSlowConnection || isDataSaver) && lowDataFallback) {
    return <>{lowDataFallback}</>;
  }

  if (fallback && !children) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// DEVICE CAPABILITY DETECTION
// ============================================

export interface DeviceCapabilities {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  touchEnabled: boolean;
  hoverEnabled: boolean;
  pixelRatio: number;
  orientation: 'portrait' | 'landscape';
  memory: number | null;
  cores: number | null;
}

export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    touchEnabled: false,
    hoverEnabled: true,
    pixelRatio: 1,
    orientation: 'landscape',
    memory: null,
    cores: null,
  });

  useEffect(() => {
    const updateCapabilities = () => {
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);

      // Detect touch capability
      const touchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // Detect hover capability
      const hoverEnabled = window.matchMedia('(hover: hover)').matches;

      // Get device pixel ratio
      const pixelRatio = window.devicePixelRatio || 1;

      // Get orientation
      const orientation =
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

      // Get device memory (if available)
      const memory = (navigator as any).deviceMemory || null;

      // Get CPU cores (if available)
      const cores = (navigator as any).hardwareConcurrency || null;

      setCapabilities({
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet,
        touchEnabled,
        hoverEnabled,
        pixelRatio,
        orientation,
        memory,
        cores,
      });
    };

    updateCapabilities();
    window.addEventListener('resize', updateCapabilities);
    window.addEventListener('orientationchange', updateCapabilities);

    return () => {
      window.removeEventListener('resize', updateCapabilities);
      window.removeEventListener('orientationchange', updateCapabilities);
    };
  }, []);

  return capabilities;
}

// ============================================
// PERFORMANCE-BASED LOADING
// ============================================

interface PerformanceBasedLoaderProps {
  children: ReactNode;
  highPerformanceFallback?: ReactNode;
  lowPerformanceFallback?: ReactNode;
  threshold?: number; // FPS threshold
}

export function PerformanceBasedLoader({
  children,
  highPerformanceFallback = null,
  lowPerformanceFallback = null,
  threshold = 30,
}: PerformanceBasedLoaderProps) {
  const [fps, setFps] = useState(60);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        const currentFps = frameCount;
        setFps(currentFps);
        setMeasured(true);

        // Stop measuring after we have a reading
        if (measured) {
          cancelAnimationFrame(animationFrameId);
          return;
        }

        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => cancelAnimationFrame(animationFrameId);
  }, [measured]);

  if (!measured) return <>{children}</>;

  if (fps >= threshold) {
    return <>{children}</>;
  }

  if (lowPerformanceFallback) {
    return <>{lowPerformanceFallback}</>;
  }

  return <>{highPerformanceFallback || children}</>;
}

// ============================================
// GRACEFUL DEGRADATION COMPONENTS
// ============================================

interface FallbackImageProps {
  src: string;
  alt: string;
  fallback?: ReactNode;
  className?: string;
  loading?: 'lazy' | 'eager';
}

export function FallbackImage({
  src,
  alt,
  fallback = null,
  className = '',
  loading = 'lazy',
}: FallbackImageProps) {
  const [error, setError] = useState(false);

  return (
    <>
      {error && fallback ? (
        fallback
      ) : (
        <img
          src={src}
          alt={alt}
          className={className}
          loading={loading}
          onError={() => setError(true)}
        />
      )}
    </>
  );
}

// ============================================
// PRIORITY LOADING
// ============================================

interface PriorityLoaderProps {
  children: ReactNode;
  priority?: 'critical' | 'high' | 'low';
  delay?: number;
  fallback?: ReactNode;
}

export function PriorityLoader({
  children,
  priority = 'low',
  delay = 0,
  fallback = null,
}: PriorityLoaderProps) {
  const [shouldRender, setShouldRender] = useState(priority === 'critical');

  useEffect(() => {
    if (priority === 'critical') return;

    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [priority, delay]);

  if (!shouldRender) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// ADAPTIVE IMAGE LOADING
// ============================================

interface AdaptiveImageProps {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  lowQualityPlaceholder?: boolean;
}

export function AdaptiveImage({
  src,
  srcSet,
  sizes,
  alt,
  className = '',
  loading = 'lazy',
  lowQualityPlaceholder = false,
}: AdaptiveImageProps) {
  const { isSlowConnection, isDataSaver } = useNetworkStatus();
  const [isLoaded, setIsLoaded] = useState(!lowQualityPlaceholder);
  const [imageSrc, setImageSrc] = useState(src);

  useEffect(() => {
    if (isSlowConnection || isDataSaver) {
      // Use smaller image on slow connections
      const url = new URL(src, window.location.origin);
      url.searchParams.set('quality', 'low');
      setImageSrc(url.toString());
    } else {
      setImageSrc(src);
    }
  }, [isSlowConnection, isDataSaver, src]);

  return (
    <img
      src={imageSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={`${className} ${!isLoaded ? 'blur-sm' : ''}`}
      loading={loading}
      onLoad={() => setIsLoaded(true)}
      decoding="async"
    />
  );
}

// ============================================
// REDUCED MOTION SUPPORT
// ============================================

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

interface AnimatedComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AnimatedComponent({
  children,
  fallback = null,
}: AnimatedComponentProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion && fallback) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ============================================
// COLOR SCHEME SUPPORT
// ============================================

export type ColorScheme = 'light' | 'dark' | 'auto';

export function useColorScheme(): {
  scheme: ColorScheme;
  isDark: boolean;
  toggle: () => void;
  set: (scheme: ColorScheme) => void;
} {
  const [scheme, setScheme] = useState<ColorScheme>('auto');

  useEffect(() => {
    // Load saved preference
    const saved = localStorage.getItem('color-scheme') as ColorScheme;
    if (saved) {
      setScheme(saved);
    }
  }, []);

  const isDark = scheme === 'dark' || (scheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggle = useCallback(() => {
    const newScheme: ColorScheme = isDark ? 'light' : 'dark';
    setScheme(newScheme);
    localStorage.setItem('color-scheme', newScheme);
  }, [isDark]);

  const set = useCallback((newScheme: ColorScheme) => {
    setScheme(newScheme);
    localStorage.setItem('color-scheme', newScheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return { scheme, isDark, toggle, set };
}

// ============================================
// ACCESSIBILITY SUPPORT
// ============================================

export function useAccessibility(): {
  prefersReducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
} {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const srQuery = window.matchMedia('(speech)');

    setPrefersReducedMotion(motionQuery.matches);
    setHighContrast(contrastQuery.matches);
    setScreenReader(srQuery.matches);

    const motionHandler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    const contrastHandler = (e: MediaQueryListEvent) => setHighContrast(e.matches);
    const srHandler = (e: MediaQueryListEvent) => setScreenReader(e.matches);

    motionQuery.addEventListener('change', motionHandler);
    contrastQuery.addEventListener('change', contrastHandler);
    srQuery.addEventListener('change', srHandler);

    return () => {
      motionQuery.removeEventListener('change', motionHandler);
      contrastQuery.removeEventListener('change', contrastHandler);
      srQuery.removeEventListener('change', srHandler);
    };
  }, []);

  return { prefersReducedMotion, highContrast, screenReader };
}
