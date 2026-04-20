# Responsive Design Examples & Integration Guide

This guide provides practical examples for integrating the responsive design improvements into the AI Jam application.

## Table of Contents
1. [Component Examples](#component-examples)
2. [Hook Examples](#hook-examples)
3. [CSS Examples](#css-examples)
4. [Performance Examples](#performance-examples)
5. [Migration Examples](#migration-examples)

## Component Examples

### 1. Responsive Grid Layout

```tsx
import { ResponsiveGrid, ResponsiveGridItem } from '../components/common/ResponsiveGrid';

function ProjectList({ projects }) {
  return (
    <ResponsiveGrid
      cols={{ mobile: 1, tablet: 2, desktop: 3 }}
      gap={{ mobile: '1rem', tablet: '1.5rem', desktop: '2rem' }}
    >
      {projects.map((project) => (
        <ResponsiveGridItem
          key={project.id}
          span={{ mobile: 1, tablet: 1, desktop: 1 }}
        >
          <ProjectCard project={project} />
        </ResponsiveGridItem>
      ))}
    </ResponsiveGrid>
  );
}
```

### 2. Touch-Friendly Buttons

```tsx
import { TouchButton } from '../components/common/TouchButton';

function ActionButtons() {
  const isMobile = useIsMobile();

  return (
    <div className="flex gap-3">
      <TouchButton
        variant="primary"
        size={isMobile ? 'lg' : 'md'}
        haptic={true}
        ripple={true}
        leftIcon={<Icon icon="plus" />}
      >
        Create Project
      </TouchButton>

      <TouchButton
        variant="secondary"
        size={isMobile ? 'lg' : 'md'}
        rightIcon={<Icon icon="arrow-right" />}
      >
        View Details
      </TouchButton>
    </div>
  );
}
```

### 3. Mobile Navigation

```tsx
import MobileNavigation from '../components/common/MobileNavigation';

function AppLayout({ children }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l2-2m-2 2l2-2m-2 0l2-2M3 13l2-2m0 0l2-2m-2 2l2-2m-2 0l2-2', path: '/dashboard' },
    { id: 'projects', label: 'Projects', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', path: '/projects', badge: 3 },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', path: '/settings' },
  ];

  return (
    <MobileNavigation
      items={navItems}
      variant="bottom"
    >
      {children}
    </MobileNavigation>
  );
}
```

### 4. Tablet-Optimized Cards

```tsx
import { TabletCard } from '../components/common/TabletOptimizations';

function ProjectCard({ project, onSelect }) {
  return (
    <TabletCard
      hoverable={true}
      selectable={true}
      onPress={onSelect}
    >
      <h3 className="text-lg font-semibold text-white mb-2">
        {project.name}
      </h3>
      <p className="text-gray-400 text-sm line-clamp-2">
        {project.description}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Updated {project.updatedAt}
        </span>
        <span className="text-xs text-indigo-400 font-medium">
          {project.status}
        </span>
      </div>
    </TabletCard>
  );
}
```

## Hook Examples

### 1. Device Detection

```tsx
import { useBreakpoint, useIsMobile, useIsTablet, useIsDesktop } from '../hooks/useResponsive';

function Component() {
  const deviceInfo = useBreakpoint();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  return (
    <div>
      <p>Current breakpoint: {deviceInfo.breakpoint}</p>
      <p>Screen width: {deviceInfo.screenWidth}px</p>
      <p>Is mobile: {isMobile ? 'Yes' : 'No'}</p>
      <p>Is tablet: {isTablet ? 'Yes' : 'No'}</p>
      <p>Is desktop: {isDesktop ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### 2. Responsive Values

```tsx
import { useResponsiveValue, useResponsiveSpacing } from '../hooks/useResponsive';

function ResponsiveContent() {
  const fontSize = useResponsiveValue({
    mobile: '14px',
    tablet: '16px',
    desktop: '18px',
  });

  const padding = useResponsiveSpacing('1rem', '1.5rem', '2rem');

  const gridCols = useResponsiveValue({
    mobile: 1,
    tablet: 2,
    desktop: 3,
  });

  return (
    <div style={{
      fontSize,
      padding,
      display: 'grid',
      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
    }}>
      {/* Content */}
    </div>
  );
}
```

### 3. Media Query Hooks

```tsx
import { useMediaQuery, useOrientation, useViewportSize } from '../hooks/useResponsive';

function MediaQueryComponent() {
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const orientation = useOrientation();
  const viewport = useViewportSize();

  return (
    <div>
      <p>Orientation: {orientation}</p>
      <p>Viewport: {viewport.width}x{viewport.height}</p>
      <p>Reduced motion: {prefersReducedMotion ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### 4. Safe Area Insets

```tsx
import { useSafeAreaInsets } from '../hooks/useResponsive';

function NotchedAwareComponent() {
  const safeInsets = useSafeAreaInsets();

  return (
    <div
      style={{
        paddingTop: `${safeInsets.top}px`,
        paddingBottom: `${safeInsets.bottom}px`,
        paddingLeft: `${safeInsets.left}px`,
        paddingRight: `${safeInsets.right}px`,
      }}
    >
      <h1>Safe Area Aware Content</h1>
    </div>
  );
}
```

## CSS Examples

### 1. Responsive Typography

```tsx
function Typography() {
  return (
    <div>
      <h1 className="text-fluid-2xl responsive-line-height">
        Fluid Heading
      </h1>

      <p className="text-fluid-base responsive-line-height">
        Fluid paragraph text that scales smoothly between devices.
      </p>

      <p className="text-fluid-sm responsive-line-height-tight">
        Compact text for smaller screens.
      </p>
    </div>
  );
}
```

### 2. Responsive Grid

```tsx
function GridExample() {
  return (
    <div className="responsive-grid">
      <div>Item 1</div>
      <div>Item 2</div>
      <div>Item 3</div>
      <div>Item 4</div>
    </div>
  );
}
```

### 3. Touch Targets

```tsx
function TouchTargets() {
  return (
    <div className="flex gap-4">
      <button className="touch-target">
        Click me (44px+)
      </button>

      <button className="touch-target-comfortable">
        Larger target (48px+)
      </button>

      <a href="/" className="touch-target">
        Link with touch target
      </a>
    </div>
  );
}
```

### 4. Responsive Cards

```tsx
function CardsExample() {
  return (
    <div className="responsive-grid">
      <div className="responsive-card">
        Standard card
      </div>

      <div className="responsive-card-compact">
        Compact card
      </div>
    </div>
  );
}
```

### 5. Performance Optimizations

```tsx
function OptimizedAnimations() {
  const isMobile = useIsMobile();

  return (
    <div>
      <div className="no-mobile-animation">
        No animation on mobile
      </div>

      <div className="reduce-mobile-animation">
        Reduced animation speed on mobile
      </div>

      <div className="gpu-accelerated">
        Hardware accelerated
      </div>
    </div>
  );
}
```

## Performance Examples

### 1. Image Optimization

```tsx
import { getOptimalImageSize, generateResponsiveSrcset } from '../utils/performance';

function OptimizedImage({ src, alt }) {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  const sizes = isMobile ? 320 : isTablet ? 768 : 1280;
  const optimalSize = getOptimalImageSize(sizes, window.innerWidth, window.devicePixelRatio);

  return (
    <img
      src={`${src}-${optimalSize}w.webp`}
      srcSet={generateResponsiveSrcset(src, [320, 640, 1280, 1920])}
      sizes="(max-width: 640px) 320px, (max-width: 1280px) 640px, 1280px"
      alt={alt}
      loading="lazy"
    />
  );
}
```

### 2. Throttled Events

```tsx
import { throttle, debounce } from '../utils/performance';

function SearchInput() {
  const [query, setQuery] = useState('');

  // Throttle scroll events
  const handleScroll = throttle(() => {
    console.log('Scroll position updated');
  }, 100);

  // Debounce search input
  const handleSearch = debounce((value: string) => {
    console.log('Searching for:', value);
  }, 300);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        handleSearch(e.target.value);
      }}
      placeholder="Search..."
    />
  );
}
```

### 3. Memory-Aware Caching

```tsx
import { MemoryAwareCache, isLowMemoryDevice } from '../utils/performance';

const cache = new MemoryAwareCache(100, 5 * 60 * 1000); // 100 items, 5 minutes

function useCachedData<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    // Try cache first
    const cached = cache.get(key);
    if (cached) {
      setData(cached);
      return;
    }

    // Fetch and cache
    fetcher().then((result) => {
      cache.set(key, result);
      setData(result);
    });
  }, [key, fetcher]);

  return data;
}
```

### 4. Performance Monitoring

```tsx
import { monitorPerformance } from '../utils/performance';

function PerformanceMonitor() {
  useEffect(() => {
    const cleanup = monitorPerformance((metrics) => {
      console.log('FPS:', metrics.fps);
      console.log('Memory:', metrics.memoryUsage);
      console.log('Render time:', metrics.renderTime);

      // Alert if performance is poor
      if (metrics.fps < 30) {
        console.warn('Poor FPS detected');
      }
    });

    return cleanup;
  }, []);

  return null;
}
```

### 5. Network-Aware Loading

```tsx
import { getNetworkQuality, shouldUseLowQualityMode } from '../utils/performance';

function DataLoader() {
  const networkQuality = getNetworkQuality();
  const useLowQuality = shouldUseLowQualityMode();

  const fetchData = async () => {
    // Adjust request size based on network
    const batchSize = useLowQuality ? 10 : 50;

    // Use low-quality images on slow networks
    const imageQuality = useLowQuality ? 60 : 90;

    // Implement progressive loading on slow networks
    if (networkQuality === 'slow') {
      return loadProgressively(batchSize);
    }

    return loadBatch(batchSize);
  };

  return <button onClick={fetchData}>Load Data</button>;
}
```

## Migration Examples

### 1. Migrating Existing Components

**Before (Non-responsive):**
```tsx
function Card({ title, description }) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-gray-400 mt-2">{description}</p>
    </div>
  );
}
```

**After (Responsive):**
```tsx
import { TouchCard } from '../components/common/TouchButton';

function ResponsiveCard({ title, description }) {
  return (
    <TouchCard className="responsive-card">
      <h3 className="text-fluid-lg responsive-line-height font-semibold text-white">
        {title}
      </h3>
      <p className="text-fluid-base responsive-line-height text-gray-400 mt-2">
        {description}
      </p>
    </TouchCard>
  );
}
```

### 2. Migrating Grid Layouts

**Before (Fixed grid):**
```tsx
<div className="grid grid-cols-3 gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

**After (Responsive grid):**
```tsx
import { ResponsiveGrid } from '../components/common/ResponsiveGrid';

<ResponsiveGrid
  cols={{ mobile: 1, tablet: 2, desktop: 3 }}
  gap={{ mobile: '1rem', tablet: '1.5rem', desktop: '2rem' }}
>
  {items.map(item => <Card key={item.id} {...item} />)}
</ResponsiveGrid>
```

### 3. Migrating Buttons

**Before (Standard button):**
```tsx
<button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-white">
  Click me
</button>
```

**After (Touch-friendly button):**
```tsx
import { TouchButton } from '../components/common/TouchButton';

<TouchButton
  variant="primary"
  size="md"
  haptic={true}
>
  Click me
</TouchButton>
```

### 4. Migrating Navigation

**Before (Desktop-only):**
```tsx
<nav className="flex gap-4">
  <a href="/dashboard">Dashboard</a>
  <a href="/projects">Projects</a>
  <a href="/settings">Settings</a>
</nav>
```

**After (Responsive navigation):**
```tsx
import MobileNavigation from '../components/common/MobileNavigation';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '...', path: '/dashboard' },
  { id: 'projects', label: 'Projects', icon: '...', path: '/projects' },
  { id: 'settings', label: 'Settings', icon: '...', path: '/settings' },
];

<MobileNavigation items={navItems} variant="bottom">
  {/* Desktop nav content */}
</MobileNavigation>
```

## Best Practices

### 1. Always Test on Real Devices
- Use physical devices when possible
- Test on both iOS and Android
- Verify touch interactions work smoothly

### 2. Use Mobile-First Approach
- Design for mobile first
- Enhance for larger screens
- Avoid desktop-only assumptions

### 3. Optimize Performance
- Implement lazy loading for images
- Use hardware acceleration for animations
- Monitor performance metrics
- Reduce JavaScript on mobile

### 4. Ensure Accessibility
- Minimum 44px touch targets
- Keyboard navigation support
- ARIA labels and roles
- Screen reader compatibility

### 5. Test on Slow Networks
- Test on 2G/3G connections
- Implement progressive loading
- Use low-quality images when needed
- Show loading states clearly

## Common Patterns

### Pattern 1: Responsive Header

```tsx
function ResponsiveHeader() {
  const { isMobile, isTablet } = useBreakpoint();

  return (
    <header className="border-b border-gray-800 bg-gray-900 safe-area-top">
      <div className="responsive-container">
        <div className="flex items-center justify-between py-4">
          <h1 className="text-fluid-xl font-bold text-white">
            {isMobile ? 'App' : 'Application Name'}
          </h1>
          {!isMobile && <UserActions />}
        </div>
      </div>
    </header>
  );
}
```

### Pattern 2: Responsive Form

```tsx
import { TouchInput, TouchButton, TouchSwitch } from '../components/common/TouchButton';

function ResponsiveForm() {
  return (
    <form className="responsive-section responsive-container">
      <div className="form-responsive">
        <TouchInput
          label="Email"
          type="email"
          placeholder="you@example.com"
        />

        <TouchInput
          label="Password"
          type="password"
          placeholder="•••••••••"
        />

        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">
            Remember me
          </label>
          <TouchSwitch checked={true} onChange={() => {}} />
        </div>

        <TouchButton variant="primary" fullWidth={true}>
          Sign In
        </TouchButton>
      </div>
    </form>
  );
}
```

### Pattern 3: Responsive List

```tsx
import { TabletList } from '../components/common/TabletOptimizations';

function ResponsiveList({ items }) {
  const { isMobile } = useBreakpoint();

  return (
    <TabletList divided={true}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="flex items-center justify-between p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
          style={{ minHeight: isMobile ? '56px' : '48px' }}
        >
          <div className="flex-1">
            <h3 className="text-fluid-base font-semibold text-white">
              {item.title}
            </h3>
            <p className="text-fluid-sm text-gray-400">
              {item.description}
            </p>
          </div>
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ))}
    </TabletList>
  );
}
```

## Troubleshooting

### Issue: Touch targets too small
**Solution**: Use `touch-target` or `touch-target-comfortable` classes

### Issue: Animations slow on mobile
**Solution**: Apply `no-mobile-animation` or `reduce-mobile-animation` classes

### Issue: Text too small on mobile
**Solution**: Use `text-fluid-*` classes or responsive typography hooks

### Issue: Content cut off on notched devices
**Solution**: Apply `safe-area-*` classes and use `useSafeAreaInsets` hook

### Issue: Performance issues on mobile
**Solution**: Implement lazy loading, image optimization, and performance monitoring

## Summary

This responsive design system provides:

1. **Comprehensive breakpoint system** for all device types
2. **Touch-friendly components** with proper target sizes
3. **Performance optimizations** for mobile devices
4. **Accessibility features** for all users
5. **Developer-friendly APIs** for easy integration

All components are designed to work together seamlessly and can be easily customized or extended for specific use cases.
