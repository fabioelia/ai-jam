/**
 * Responsive Grid Component
 *
 * Smart grid system that adapts to different screen sizes
 * with mobile-first approach and touch-friendly interactions.
 */

import React, { forwardRef } from 'react';
import { useBreakpoint, useResponsiveValue } from '../../hooks/useResponsive.js';

interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
    wide?: number;
  };
  gap?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  className?: string;
  itemClassName?: string;
  minItemWidth?: string;
}

interface ResponsiveGridItemProps {
  children: React.ReactNode;
  span?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
}

/**
 * Responsive Grid System
 * Automatically adjusts columns and spacing based on viewport
 */
export const ResponsiveGrid = forwardRef<HTMLDivElement, ResponsiveGridProps>(
  (
    {
      children,
      cols = { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
      gap = { mobile: '1rem', tablet: '1.5rem', desktop: '2rem' },
      className = '',
      itemClassName = '',
      minItemWidth,
      ...props
    },
    ref
  ) => {
    const { breakpoint, isMobile, isTablet, isDesktop } = useBreakpoint();

    const currentCols = useResponsiveValue({
      mobile: cols.mobile || 1,
      tablet: cols.tablet || 2,
      desktop: cols.desktop || 3,
      wide: cols.wide || 4,
    });

    const currentGap = useResponsiveValue({
      mobile: gap.mobile || '1rem',
      tablet: gap.tablet || '1.5rem',
      desktop: gap.desktop || '2rem',
    });

    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: `repeat(${currentCols}, 1fr)`,
      gap: currentGap,
      ...(minItemWidth && {
        gridAutoColumns: minItemWidth,
      }),
    };

    return (
      <div
        ref={ref}
        style={gridStyle}
        className={className}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              className: `${child.props.className || ''} ${itemClassName}`,
            } as React.HTMLAttributes<HTMLDivElement>);
          }
          return child;
        })}
      </div>
    );
  }
);

ResponsiveGrid.displayName = 'ResponsiveGrid';

/**
 * Responsive Grid Item
 * Can span multiple columns based on breakpoint
 */
export const ResponsiveGridItem = forwardRef<HTMLDivElement, ResponsiveGridItemProps>(
  ({ children, span = {}, className = '', ...props }, ref) => {
    const { breakpoint } = useBreakpoint();

    const gridSpan = useResponsiveValue({
      mobile: span.mobile || 1,
      tablet: span.tablet || span.mobile || 1,
      desktop: span.desktop || span.tablet || span.mobile || 1,
    });

    return (
      <div
        ref={ref}
        style={{
          gridColumn: `span ${gridSpan}`,
        }}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ResponsiveGridItem.displayName = 'ResponsiveGridItem';

// ============================================
// RESPONSIVE LAYOUT COMPONENTS
// ============================================

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  padding?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  className?: string;
}

/**
 * Container that adjusts max-width and padding based on viewport
 */
export const ResponsiveContainer = forwardRef<HTMLDivElement, ResponsiveContainerProps>(
  (
    {
      children,
      maxWidth = { mobile: '100%', tablet: '768px', desktop: '1280px' },
      padding = { mobile: '1rem', tablet: '2rem', desktop: '2.5rem' },
      className = '',
      ...props
    },
    ref
  ) => {
    const currentMaxWidth = useResponsiveValue({
      mobile: maxWidth.mobile || '100%',
      tablet: maxWidth.tablet || '768px',
      desktop: maxWidth.desktop || '1280px',
    });

    const currentPadding = useResponsiveValue({
      mobile: padding.mobile || '1rem',
      tablet: padding.tablet || '2rem',
      desktop: padding.desktop || '2.5rem',
    });

    return (
      <div
        ref={ref}
        style={{
          maxWidth: currentMaxWidth,
          padding: currentPadding,
          margin: '0 auto',
          width: '100%',
        }}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ResponsiveContainer.displayName = 'ResponsiveContainer';

// ============================================
// RESPONSIVE FLEX LAYOUT
// ============================================

interface ResponsiveFlexProps {
  children: React.ReactNode;
  direction?: {
    mobile?: 'row' | 'column';
    tablet?: 'row' | 'column';
    desktop?: 'row' | 'column';
  };
  wrap?: boolean;
  justify?: string;
  align?: string;
  gap?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  className?: string;
}

/**
 * Flex container that changes direction based on viewport
 */
export const ResponsiveFlex = forwardRef<HTMLDivElement, ResponsiveFlexProps>(
  (
    {
      children,
      direction = { mobile: 'column', tablet: 'row', desktop: 'row' },
      wrap = true,
      justify = 'flex-start',
      align = 'flex-start',
      gap = { mobile: '1rem', tablet: '1.5rem', desktop: '2rem' },
      className = '',
      ...props
    },
    ref
  ) => {
    const currentDirection = useResponsiveValue({
      mobile: direction.mobile || 'column',
      tablet: direction.tablet || direction.mobile || 'row',
      desktop: direction.desktop || direction.tablet || direction.mobile || 'row',
    });

    const currentGap = useResponsiveValue({
      mobile: gap.mobile || '1rem',
      tablet: gap.tablet || '1.5rem',
      desktop: gap.desktop || '2rem',
    });

    return (
      <div
        ref={ref}
        style={{
          display: 'flex',
          flexDirection: currentDirection,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          justifyContent: justify,
          alignItems: align,
          gap: currentGap,
        }}
        className={className}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              style: {
                ...child.props.style,
                flex: child.props.flex || '1 1 auto',
              },
            } as React.HTMLAttributes<HTMLDivElement>);
          }
          return child;
        })}
      </div>
    );
  }
);

ResponsiveFlex.displayName = 'ResponsiveFlex';

// ============================================
// RESPONSIVE CARD GRID
// ============================================

interface ResponsiveCardGridProps {
  children: React.ReactNode;
  minCardWidth?: string;
  gap?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  className?: string;
}

/**
 * Smart card grid that adjusts based on available space
 */
export const ResponsiveCardGrid = forwardRef<HTMLDivElement, ResponsiveCardGridProps>(
  (
    {
      children,
      minCardWidth = '280px',
      gap = { mobile: '1rem', tablet: '1.5rem', desktop: '2rem' },
      className = '',
      ...props
    },
    ref
  ) => {
    const currentGap = useResponsiveValue({
      mobile: gap.mobile || '1rem',
      tablet: gap.tablet || '1.5rem',
      desktop: gap.desktop || '2rem',
    });

    return (
      <div
        ref={ref}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`,
          gap: currentGap,
        }}
        className={className}
        {...props}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              className: `${child.props.className || ''} h-full`,
            } as React.HTMLAttributes<HTMLDivElement>);
          }
          return child;
        })}
      </div>
    );
  }
);

ResponsiveCardGrid.displayName = 'ResponsiveCardGrid';

// ============================================
// RESPONSIVE STACK
// ============================================

interface ResponsiveStackProps {
  children: React.ReactNode;
  spacing?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  direction?: {
    mobile?: 'vertical' | 'horizontal';
    tablet?: 'vertical' | 'horizontal';
    desktop?: 'vertical' | 'horizontal';
  };
  align?: string;
  className?: string;
}

/**
 * Stack layout that adjusts spacing and direction based on viewport
 */
export const ResponsiveStack = forwardRef<HTMLDivElement, ResponsiveStackProps>(
  (
    {
      children,
      spacing = { mobile: '1rem', tablet: '1.5rem', desktop: '2rem' },
      direction = { mobile: 'vertical', tablet: 'horizontal', desktop: 'horizontal' },
      align = 'flex-start',
      className = '',
      ...props
    },
    ref
  ) => {
    const currentSpacing = useResponsiveValue({
      mobile: spacing.mobile || '1rem',
      tablet: spacing.tablet || '1.5rem',
      desktop: spacing.desktop || '2rem',
    });

    const isVertical = useResponsiveValue({
      mobile: direction.mobile === 'vertical',
      tablet: direction.tablet === 'vertical',
      desktop: direction.desktop === 'vertical',
    });

    return (
      <div
        ref={ref}
        style={{
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          gap: currentSpacing,
          alignItems: align,
        }}
        className={className}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ResponsiveStack.displayName = 'ResponsiveStack';
