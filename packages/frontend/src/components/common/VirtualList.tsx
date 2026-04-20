/**
 * Virtual List Component
 *
 * A high-performance virtual scrolling list that only renders visible items,
 * optimizing memory usage and rendering performance for large datasets.
 */

import { useRef, useState, useEffect, useCallback, ReactNode, CSSProperties } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  containerHeight: number;
  overscan?: number;
  className?: string;
  estimatedItemHeight?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export default function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight,
  overscan = 5,
  className = '',
  estimatedItemHeight = 50,
  onEndReached,
  endReachedThreshold = 200,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate total height of the list
  const totalHeight = items.reduce((acc, _, index) => {
    return acc + (typeof itemHeight === 'function' ? itemHeight(index, items[index]) : itemHeight);
  }, 0);

  // Calculate visible range
  const getVisibleRange = useCallback(() => {
    let startIndex = 0;
    let endIndex = 0;
    let offsetY = 0;

    if (typeof itemHeight === 'number') {
      // Fixed height items - optimized path
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
      offsetY = startIndex * itemHeight;
    } else {
      // Variable height items
      let accumulatedHeight = 0;
      let startFound = false;

      for (let i = 0; i < items.length; i++) {
        const height = itemHeight(i, items[i]);

        if (!startFound && accumulatedHeight + height >= scrollTop - overscan * estimatedItemHeight) {
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
      endIndex = Math.min(items.length, endIndex + overscan);
    }

    return { startIndex, endIndex, offsetY };
  }, [scrollTop, items.length, containerHeight, overscan, itemHeight, estimatedItemHeight]);

  const visibleRange = getVisibleRange();

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);

    // Debounce the scrolling state
    if (scrollingTimeoutRef.current) {
      clearTimeout(scrollingTimeoutRef.current);
    }
    scrollingTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    // Check if we've reached the end for infinite scrolling
    if (onEndReached) {
      const scrollBottom = newScrollTop + containerHeight;
      if (totalHeight - scrollBottom < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [containerHeight, totalHeight, onEndReached, endReachedThreshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, []);

  // Get visible items
  const visibleItems = items.slice(visibleRange.startIndex, visibleRange.endIndex);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {visibleItems.map((item, index) => {
          const actualIndex = visibleRange.startIndex + index;
          const height = typeof itemHeight === 'function'
            ? itemHeight(actualIndex, item)
            : itemHeight;

          // Calculate position based on offset
          let top = visibleRange.offsetY;
          for (let i = visibleRange.startIndex; i < actualIndex; i++) {
            top += typeof itemHeight === 'function' ? itemHeight(i, items[i]) : itemHeight;
          }

          const style: CSSProperties = {
            position: 'absolute',
            top: `${top}px`,
            left: 0,
            right: 0,
            height: `${height}px`,
            willChange: isScrolling ? 'transform' : 'auto',
          };

          return (
            <div key={actualIndex} style={style}>
              {renderItem(item, actualIndex, style)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook for virtual list with dynamic item heights
 */
export interface VirtualListOptions {
  itemHeight: number | ((index: number) => number);
  containerHeight: number;
  overscan?: number;
}

export interface VirtualListState {
  visibleStartIndex: number;
  visibleEndIndex: number;
  offsetY: number;
  totalHeight: number;
}

export function useVirtualList(
  itemCount: number,
  options: VirtualListOptions
): VirtualListState & {
  handleScroll: (scrollTop: number) => void;
  getVisibleRange: (scrollTop: number) => VirtualListState;
} {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);

  const getItemHeight = useCallback(
    (index: number) => {
      return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
    },
    [itemHeight]
  );

  const getVisibleRange = useCallback(
    (currentScrollTop: number): VirtualListState => {
      let startIndex = 0;
      let endIndex = 0;
      let offsetY = 0;

      if (typeof itemHeight === 'number') {
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        startIndex = Math.max(0, Math.floor(currentScrollTop / itemHeight) - overscan);
        endIndex = Math.min(itemCount, startIndex + visibleCount + overscan * 2);
        offsetY = startIndex * itemHeight;
      } else {
        let accumulatedHeight = 0;
        let startFound = false;

        for (let i = 0; i < itemCount; i++) {
          const height = getItemHeight(i);

          if (!startFound && accumulatedHeight + height >= currentScrollTop - overscan * itemHeight) {
            startIndex = i;
            offsetY = accumulatedHeight;
            startFound = true;
          }

          if (startFound && accumulatedHeight >= currentScrollTop + containerHeight) {
            endIndex = i + overscan;
            break;
          }

          accumulatedHeight += height;
          endIndex = i + 1;
        }

        startIndex = Math.max(0, startIndex - overscan);
        endIndex = Math.min(itemCount, endIndex + overscan);
      }

      const totalHeight = typeof itemHeight === 'number'
        ? itemCount * itemHeight
        : Array.from({ length: itemCount }, (_, i) => getItemHeight(i)).reduce((a, b) => a + b, 0);

      return { visibleStartIndex: startIndex, visibleEndIndex: endIndex, offsetY, totalHeight };
    },
    [itemCount, containerHeight, overscan, itemHeight, getItemHeight]
  );

  const handleScroll = useCallback((currentScrollTop: number) => {
    setScrollTop(currentScrollTop);
  }, []);

  const currentState = getVisibleRange(scrollTop);

  return {
    ...currentState,
    handleScroll,
    getVisibleRange,
  };
}

/**
 * Virtual Grid Component
 *
 * Virtual scrolling for 2D grids with optimized rendering
 */

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  overscan?: number;
  className?: string;
  gap?: number;
}

export function VirtualGrid<T>({
  items,
  renderItem,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  overscan = 2,
  className = '',
  gap = 0,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate number of columns that fit in container
  const columns = Math.floor((containerWidth + gap) / (itemWidth + gap)) || 1;
  const rows = Math.ceil(items.length / columns);

  // Calculate total dimensions
  const gridWidth = columns * itemWidth + (columns - 1) * gap;
  const gridHeight = rows * itemHeight + (rows - 1) * gap;

  // Calculate visible range
  const visibleRows = Math.ceil(containerHeight / itemHeight);
  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
  const endRow = Math.min(rows, startRow + visibleRows + overscan * 2);

  const startItem = startRow * columns;
  const endItem = Math.min(items.length, endRow * columns);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Render visible items
  const visibleItems = [];
  for (let i = startItem; i < endItem; i++) {
    const item = items[i];
    if (item) {
      const row = Math.floor(i / columns);
      const col = i % columns;

      const x = col * (itemWidth + gap);
      const y = row * (itemHeight + gap);

      visibleItems.push(
        <div
          key={i}
          className="absolute"
          style={{
            left: x,
            top: y,
            width: itemWidth,
            height: itemHeight,
          }}
        >
          {renderItem(item, i)}
        </div>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight, width: containerWidth }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: gridHeight,
          width: gridWidth,
          position: 'relative',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
}
