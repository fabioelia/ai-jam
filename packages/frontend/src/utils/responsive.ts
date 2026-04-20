/**
 * Responsive Design Utilities
 *
 * Comprehensive utilities for handling responsive design patterns,
 * breakpoints, and device detection across the application.
 */

// ============================================
// BREAKPOINT DEFINITIONS
// ============================================

export const BREAKPOINTS = {
  xs: 0,      // Extra small - Mobile portrait
  sm: 640,    // Small - Mobile landscape
  md: 768,    // Medium - Tablet portrait
  lg: 1024,    // Large - Tablet landscape / Desktop
  xl: 1280,    // Extra large - Desktop
  '2xl': 1536, // 2 Extra large - Large desktop
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ============================================
// DEVICE DETECTION
// ============================================

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isLandscape: boolean;
  screenWidth: number;
  breakpoint: Breakpoint;
}

/**
 * Get current device information based on viewport
 */
export function getDeviceInfo(): DeviceInfo {
  const width = window.innerWidth;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isLandscape = window.innerWidth > window.innerHeight;

  let breakpoint: Breakpoint = 'xs';
  if (width >= BREAKPOINTS['2xl']) breakpoint = '2xl';
  else if (width >= BREAKPOINTS.xl) breakpoint = 'xl';
  else if (width >= BREAKPOINTS.lg) breakpoint = 'lg';
  else if (width >= BREAKPOINTS.md) breakpoint = 'md';
  else if (width >= BREAKPOINTS.sm) breakpoint = 'sm';

  return {
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isTouch,
    isLandscape,
    screenWidth: width,
    breakpoint,
  };
}

/**
 * Check if current viewport matches a specific breakpoint
 */
export function matchesBreakpoint(breakpoint: Breakpoint): boolean {
  const { breakpoint: current } = getDeviceInfo();
  const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  return breakpointOrder.indexOf(current) >= breakpointOrder.indexOf(breakpoint);
}

/**
 * Check if current viewport is within a breakpoint range
 */
export function isInBreakpointRange(min: Breakpoint, max: Breakpoint): boolean {
  const { breakpoint: current } = getDeviceInfo();
  const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpointOrder.indexOf(current);
  return currentIndex >= breakpointOrder.indexOf(min) && currentIndex <= breakpointOrder.indexOf(max);
}

// ============================================
// RESPONSIVE VALUE CALCULATIONS
// ============================================

/**
 * Calculate responsive spacing based on viewport
 */
export function getResponsiveSpacing(
  mobile: number,
  tablet?: number,
  desktop?: number
): number {
  const { isMobile, isTablet, isDesktop: isDesktopDevice } = getDeviceInfo();

  if (isDesktopDevice && desktop !== undefined) return desktop;
  if (isTablet && tablet !== undefined) return tablet;
  return mobile;
}

/**
 * Calculate responsive font size using clamp
 */
export function getResponsiveFontSize(
  min: number,
  preferred: number,
  max: number
): string {
  return `clamp(${min}rem, ${preferred}rem, ${max}rem)`;
}

/**
 * Calculate fluid spacing between two breakpoints
 */
export function getFluidValue(
  minViewport: number,
  maxViewport: number,
  minValue: number,
  maxValue: number,
  unit: 'px' | 'rem' | 'em' = 'px'
): string {
  const slope = (maxValue - minValue) / (maxViewport - minViewport);
  const intercept = minValue - slope * minViewport;
  return `calc(${minValue}${unit} + ${slope * 100}vw * (${unit} / 100))`;
}

// ============================================
// TOUCH TARGET UTILITIES
// ============================================

const MIN_TOUCH_TARGET = 44; // iOS HIG recommendation
const COMFORTABLE_TOUCH_TARGET = 48; // WCAG AAA recommendation

/**
 * Check if element meets minimum touch target size
 */
export function meetsTouchTargetSize(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const width = Math.min(rect.width, element.offsetWidth);
  const height = Math.min(rect.height, element.offsetHeight);
  return width >= MIN_TOUCH_TARGET && height >= MIN_TOUCH_TARGET;
}

/**
 * Ensure element meets minimum touch target size
 */
export function ensureTouchTargetSize(element: HTMLElement): void {
  if (!meetsTouchTargetSize(element)) {
    element.style.minWidth = `${COMFORTABLE_TOUCH_TARGET}px`;
    element.style.minHeight = `${COMFORTABLE_TOUCH_TARGET}px`;
  }
}

/**
 * Get appropriate touch target size for device type
 */
export function getTouchTargetSize(deviceInfo?: DeviceInfo): number {
  const info = deviceInfo || getDeviceInfo();
  return info.isMobile ? COMFORTABLE_TOUCH_TARGET : MIN_TOUCH_TARGET;
}

// ============================================
// RESPONSIVE LAYOUT UTILITIES
// ============================================

/**
 * Calculate grid columns based on viewport
 */
export function getGridColumns(
  mobile: number,
  tablet?: number,
  desktop?: number
): number {
  const { isMobile, isTablet, isDesktop: isDesktopDevice } = getDeviceInfo();

  if (isDesktopDevice && desktop !== undefined) return desktop;
  if (isTablet && tablet !== undefined) return tablet;
  return mobile;
}

/**
 * Calculate container max width based on viewport
 */
export function getContainerMaxWidth(breakpoint: Breakpoint): number {
  return BREAKPOINTS[breakpoint] - 32; // Account for padding
}

/**
 * Get responsive padding for container
 */
export function getContainerPadding(): string {
  const { isMobile, isTablet } = getDeviceInfo();
  if (isMobile) return '1rem';
  if (isTablet) return '2rem';
  return '2.5rem';
}

// ============================================
// IMAGE OPTIMIZATION
// ============================================

/**
 * Calculate appropriate image size for responsive images
 */
export function getResponsiveImageSize(
  baseSize: number,
  deviceInfo?: DeviceInfo
): number {
  const info = deviceInfo || getDeviceInfo();

  // Use 2x for high-DPI displays
  const dpr = window.devicePixelRatio || 1;
  const multiplier = dpr > 1.5 ? 2 : 1;

  // Adjust base size by viewport
  let size = baseSize;
  if (info.isMobile) {
    size = Math.min(baseSize, info.screenWidth - 32);
  } else if (info.isTablet) {
    size = Math.min(baseSize * 1.5, info.screenWidth - 64);
  }

  return Math.ceil(size * multiplier);
}

/**
 * Generate responsive image srcset
 */
export function generateResponsiveSrcset(
  baseUrl: string,
  sizes: number[],
  format: 'jpg' | 'png' | 'webp' = 'webp'
): string {
  return sizes
    .map(size => `${baseUrl}-${size}w.${format} ${size}w`)
    .join(', ');
}

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================

/**
 * Determine if animations should be reduced
 */
export function shouldReduceMotion(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    getDeviceInfo().isMobile
  );
}

/**
 * Get appropriate animation duration based on device
 */
export function getAnimationDuration(baseDuration: number): number {
  if (shouldReduceMotion()) return 0;

  const { isMobile, isTablet } = getDeviceInfo();
  if (isMobile) return baseDuration * 0.8; // Faster on mobile
  if (isTablet) return baseDuration * 0.9;
  return baseDuration;
}

/**
 * Check if hardware acceleration should be used
 */
export function shouldUseHardwareAcceleration(): boolean {
  const { isMobile, isTablet } = getDeviceInfo();
  return isMobile || isTablet;
}

// ============================================
// REACTIVE BREAKPOINT HOOK (for React)
// ============================================

/**
 * Hook-like class for managing reactive breakpoint changes
 * (Can be used with useEffect in React components)
 */
export class BreakpointManager {
  private listeners: Set<(info: DeviceInfo) => void> = new Set();
  private currentInfo: DeviceInfo;
  private resizeObserver?: ResizeObserver;

  constructor() {
    this.currentInfo = getDeviceInfo();
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.update();
      });
      this.resizeObserver.observe(document.body);
    } else {
      // Fallback to window resize event
      window.addEventListener('resize', () => this.update());
    }
  }

  private update(): void {
    const newInfo = getDeviceInfo();
    if (newInfo.breakpoint !== this.currentInfo.breakpoint) {
      this.currentInfo = newInfo;
      this.notifyListeners();
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentInfo));
  }

  /**
   * Subscribe to breakpoint changes
   */
  subscribe(listener: (info: DeviceInfo) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current info
    listener(this.currentInfo);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current device info
   */
  getCurrentInfo(): DeviceInfo {
    return this.currentInfo;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.listeners.clear();
  }
}

// Singleton instance for app-wide breakpoint management
let globalBreakpointManager: BreakpointManager | null = null;

export function getGlobalBreakpointManager(): BreakpointManager {
  if (!globalBreakpointManager) {
    globalBreakpointManager = new BreakpointManager();
  }
  return globalBreakpointManager;
}

// ============================================
// SAFE AREA UTILITIES
// ============================================

/**
 * Get safe area insets for notched devices
 */
export function getSafeAreaInsets(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  return {
    top: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top') || '0'),
    bottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom') || '0'),
    left: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-left') || '0'),
    right: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-right') || '0'),
  };
}

/**
 * Check if device has notched display
 */
export function hasNotchedDisplay(): boolean {
  const insets = getSafeAreaInsets();
  return insets.top > 0 || insets.bottom > 0 || insets.left > 0 || insets.right > 0;
}

// ============================================
// TYPOGRAPHY UTILITIES
// ============================================

/**
 * Get responsive line height based on font size and viewport
 */
export function getResponsiveLineHeight(fontSize: number): string {
  const { isMobile, isTablet } = getDeviceInfo();

  if (fontSize < 14) return isMobile ? '1.4' : isTablet ? '1.3' : '1.25';
  if (fontSize < 18) return isMobile ? '1.5' : isTablet ? '1.4' : '1.35';
  return isMobile ? '1.6' : isTablet ? '1.5' : '1.45';
}

/**
 * Calculate fluid typography scale
 */
export function calculateFluidTypography(
  minFontSize: number,
  maxFontSize: number,
  minViewport: number = 320,
  maxViewport: number = 1280
): string {
  const slope = (maxFontSize - minFontSize) / (maxViewport - minViewport);
  const intercept = minFontSize - slope * minViewport;
  return `clamp(${minFontSize}rem, ${intercept}rem + ${slope * 100}vw, ${maxFontSize}rem)`;
}
