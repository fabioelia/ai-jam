/**
 * Responsive Design React Hooks
 *
 * Custom hooks for handling responsive design patterns in React components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDeviceInfo,
  matchesBreakpoint,
  isInBreakpointRange,
  getGlobalBreakpointManager,
  type DeviceInfo,
  type Breakpoint,
} from '../utils/responsive.js';

// ============================================
// USE BREAKPOINT HOOK
// ============================================

/**
 * Hook that returns current device info and breakpoint
 * Updates automatically on window resize
 */
export function useBreakpoint(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo);

  useEffect(() => {
    const manager = getGlobalBreakpointManager();
    const unsubscribe = manager.subscribe((info) => {
      setDeviceInfo(info);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return deviceInfo;
}

// ============================================
// USE MATCH MEDIA HOOK
// ============================================

/**
 * Hook that returns whether the viewport matches a specific breakpoint
 */
export function useMatchBreakpoint(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = useState(() => matchesBreakpoint(breakpoint));
  const deviceInfo = useBreakpoint();

  useEffect(() => {
    setMatches(matchesBreakpoint(breakpoint));
  }, [deviceInfo.breakpoint, breakpoint]);

  return matches;
}

/**
 * Hook that returns whether viewport is within a breakpoint range
 */
export function useIsInBreakpointRange(min: Breakpoint, max: Breakpoint): boolean {
  const [inRange, setInRange] = useState(() => isInBreakpointRange(min, max));
  const deviceInfo = useBreakpoint();

  useEffect(() => {
    setInRange(isInBreakpointRange(min, max));
  }, [deviceInfo.breakpoint, min, max]);

  return inRange;
}

// ============================================
// DEVICE TYPE HOOKS
// ============================================

/**
 * Hook that returns whether current device is mobile
 */
export function useIsMobile(): boolean {
  return useBreakpoint().isMobile;
}

/**
 * Hook that returns whether current device is tablet
 */
export function useIsTablet(): boolean {
  return useBreakpoint().isTablet;
}

/**
 * Hook that returns whether current device is desktop
 */
export function useIsDesktop(): boolean {
  return useBreakpoint().isDesktop;
}

/**
 * Hook that returns whether current device supports touch
 */
export function useIsTouch(): boolean {
  return useBreakpoint().isTouch;
}

/**
 * Hook that returns whether device is in landscape orientation
 */
export function useIsLandscape(): boolean {
  return useBreakpoint().isLandscape;
}

// ============================================
// RESPONSIVE VALUE HOOKS
// ============================================

interface ResponsiveValue<T> {
  mobile: T;
  tablet?: T;
  desktop?: T;
  wide?: T;
}

/**
 * Hook that returns different values based on current breakpoint
 */
export function useResponsiveValue<T>(values: ResponsiveValue<T>): T {
  const deviceInfo = useBreakpoint();

  if (deviceInfo.isMobile) return values.mobile;
  if (deviceInfo.isTablet && values.tablet !== undefined) return values.tablet;
  if (deviceInfo.isDesktop && values.desktop !== undefined) return values.desktop;
  if (deviceInfo.screenWidth >= 1280 && values.wide !== undefined) return values.wide;

  return values.mobile;
}

/**
 * Hook that returns responsive spacing
 */
export function useResponsiveSpacing(
  mobile: string,
  tablet?: string,
  desktop?: string
): string {
  const deviceInfo = useBreakpoint();

  if (deviceInfo.isDesktop && desktop) return desktop;
  if (deviceInfo.isTablet && tablet) return tablet;
  return mobile;
}

// ============================================
// MEDIA QUERY HOOKS
// ============================================

/**
 * Hook that listens to a custom media query
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}

// ============================================
// ORIENTATION HOOK
// ============================================

/**
 * Hook that returns current screen orientation
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() =>
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  );

  useEffect(() => {
    const handleResize = () => {
      setOrientation(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      );
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return orientation;
}

// ============================================
// VIEWPORT SIZE HOOK
// ============================================

interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Hook that returns current viewport dimensions
 */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// ============================================
// REDUCED MOTION HOOK
// ============================================

/**
 * Hook that returns whether reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// ============================================
// TOUCH TARGET HOOK
// ============================================

/**
 * Hook that ensures elements meet minimum touch target size
 */
export function useTouchTarget(elementRef: React.RefObject<HTMLElement>): void {
  const isTouch = useIsTouch();

  useEffect(() => {
    if (!isTouch || !elementRef.current) return;

    const element = elementRef.current;
    const MIN_TOUCH_TARGET = 44;
    const COMFORTABLE_TOUCH_TARGET = 48;

    const rect = element.getBoundingClientRect();
    const needsUpdate =
      rect.width < COMFORTABLE_TOUCH_TARGET ||
      rect.height < COMFORTABLE_TOUCH_TARGET;

    if (needsUpdate) {
      element.style.minWidth = `${COMFORTABLE_TOUCH_TARGET}px`;
      element.style.minHeight = `${COMFORTABLE_TOUCH_TARGET}px`;
    }
  }, [isTouch, elementRef]);
}

// ============================================
// SAFE AREA HOOK
// ============================================

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Hook that returns safe area insets for notched devices
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const getInsets = () => ({
      top: parseInt(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--safe-area-inset-top')
          .replace('px', '') || '0'
      ),
      bottom: parseInt(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--safe-area-inset-bottom')
          .replace('px', '') || '0'
      ),
      left: parseInt(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--safe-area-inset-left')
          .replace('px', '') || '0'
      ),
      right: parseInt(
        getComputedStyle(document.documentElement)
          .getPropertyValue('--safe-area-inset-right')
          .replace('px', '') || '0'
      ),
    });

    setInsets(getInsets());

    // Listen for orientation changes as they might affect safe areas
    const handleOrientationChange = () => {
      setInsets(getInsets());
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);

  return insets;
}

// ============================================
// KEYBOARD DETECTION HOOK
// ============================================

/**
 * Hook that detects if user is using keyboard navigation
 */
export function useKeyboardNavigation(): boolean {
  const [isUsingKeyboard, setIsUsingKeyboard] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsUsingKeyboard(true);
      }
    };

    const handleMouseDown = () => {
      setIsUsingKeyboard(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return isUsingKeyboard;
}

// ============================================
// HOVER DETECTION HOOK
// ============================================

/**
 * Hook that detects if device supports hover
 */
export function useHoverCapability(): boolean {
  return useMediaQuery('(hover: hover)');
}

// ============================================
// RESIZE THROTTLE HOOK
// ============================================

/**
 * Hook that provides throttled viewport size updates
 */
export function useThrottledViewportSize(delay: number = 100): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleResize = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, delay);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  return size;
}

// ============================================
// RESPONSIVE CLASS NAMES HOOK
// ============================================

interface ResponsiveClassNames {
  mobile?: string;
  tablet?: string;
  desktop?: string;
  wide?: string;
}

/**
 * Hook that returns appropriate class names based on breakpoint
 */
export function useResponsiveClassNames(
  classNames: ResponsiveClassNames
): string {
  const deviceInfo = useBreakpoint();

  let className = classNames.mobile || '';

  if (deviceInfo.isTablet && classNames.tablet) {
    className += ` ${classNames.tablet}`;
  }
  if (deviceInfo.isDesktop && classNames.desktop) {
    className += ` ${classNames.desktop}`;
  }
  if (deviceInfo.screenWidth >= 1280 && classNames.wide) {
    className += ` ${classNames.wide}`;
  }

  return className;
}

// ============================================
// DEVICE MEMORY HOOK
// ============================================

/**
 * Hook that returns device memory information (when available)
 */
export function useDeviceMemory(): {
  memory: number | undefined;
  hardwareConcurrency: number | undefined;
} {
  const [info, setInfo] = useState<{
    memory: number | undefined;
    hardwareConcurrency: number | undefined;
  }>({
    memory: undefined,
    hardwareConcurrency: undefined,
  });

  useEffect(() => {
    // @ts-expect-error - Navigator extensions
    const memory = (navigator as any).deviceMemory;
    const cores = navigator.hardwareConcurrency;

    setInfo({
      memory,
      hardwareConcurrency: cores,
    });
  }, []);

  return info;
}

// ============================================
// NETWORK STATUS HOOK
// ============================================

/**
 * Hook that returns network connection information
 */
export function useNetworkStatus(): {
  online: boolean;
  effectiveType: string | undefined;
  downlink: number | undefined;
  saveData: boolean | undefined;
} {
  const [status, setStatus] = useState<{
    online: boolean;
    effectiveType: string | undefined;
    downlink: number | undefined;
    saveData: boolean | undefined;
  }>({
    online: navigator.onLine,
    effectiveType: undefined,
    downlink: undefined,
    saveData: undefined,
  });

  useEffect(() => {
    const handleOnline = () => setStatus((prev) => ({ ...prev, online: true }));
    const handleOffline = () => setStatus((prev) => ({ ...prev, online: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // @ts-expect-error - Network Information API
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      const handleConnectionChange = () => {
        setStatus({
          online: navigator.onLine,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          saveData: connection.saveData,
        });
      };

      connection.addEventListener('change', handleConnectionChange);
      handleConnectionChange(); // Initial check

      return () => {
        connection.removeEventListener('change', handleConnectionChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
