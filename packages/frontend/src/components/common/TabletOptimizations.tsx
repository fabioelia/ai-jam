/**
 * Tablet-Specific Optimizations
 *
 * Components and utilities optimized for tablet devices,
 * bridging the gap between mobile and desktop experiences.
 */

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { useBreakpoint, useIsTablet, useIsTouch } from '../../hooks/useResponsive.js';

// ============================================
// TABLET-AWARE CARD COMPONENT
// ============================================

interface TabletCardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

/**
 * Card component with tablet-specific optimizations
 * - Larger touch targets for tablet
 * - Optimized spacing for tablet landscape
 * - Smooth transitions for tablet interactions
 */
export const TabletCard = forwardRef<HTMLDivElement, TabletCardProps>(
  (
    {
      children,
      className = '',
      hoverable = true,
      selectable = false,
      selected = false,
      onPress,
      ...props
    },
    ref
  ) => {
    const isTablet = useIsTablet();
    const isTouch = useIsTouch();

    return (
      <div
        ref={ref}
        onClick={onPress}
        className={`
          relative bg-gray-800/90 backdrop-blur-sm border rounded-xl p-4
          transition-all duration-200 ease-out
          ${isTablet ? 'p-5 md:p-6' : 'p-4'}
          ${hoverable ? 'hover:border-gray-600 hover:shadow-xl hover:-translate-y-0.5' : ''}
          ${selectable ? 'cursor-pointer' : ''}
          ${selected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-gray-700'}
          ${isTouch ? 'active:scale-98' : 'hover:scale-[1.02]'}
          ${className}
        `}
        role={onPress ? 'button' : undefined}
        tabIndex={onPress ? 0 : undefined}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onPress) {
            e.preventDefault();
            onPress();
          }
        }}
        {...props}
      >
        {children}
        {selectable && selected && (
          <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
    );
  }
);

TabletCard.displayName = 'TabletCard';

// ============================================
// TABLET-AWARE LIST COMPONENT
// ============================================

interface TabletListProps {
  children: React.ReactNode;
  className?: string;
  divided?: boolean;
  compact?: boolean;
}

/**
 * List component optimized for tablet
 * - Proper spacing for tablet touch targets
 * - Optimized line heights for tablet reading
 * - Smooth scrolling for tablet interactions
 */
export const TabletList = forwardRef<HTMLDivElement, TabletListProps>(
  ({ children, className = '', divided = true, compact = false, ...props }, ref) => {
    const isTablet = useIsTablet();

    return (
      <div
        ref={ref}
        className={`
          ${divided ? 'divide-y divide-gray-800' : ''}
          ${isTablet ? 'divide-y-2' : 'divide-y'}
          ${compact ? '' : 'space-y-1'}
          ${className}
        `}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              className: `${child.props.className || ''} ${isTablet ? 'py-3 md:py-4' : 'py-2'}`,
            } as React.HTMLAttributes<HTMLDivElement>);
          }
          return child;
        })}
      </div>
    );
  }
);

TabletList.displayName = 'TabletList';

// ============================================
// TABLET-AWARE MODAL COMPONENT
// ============================================

interface TabletModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Modal component optimized for tablet
 * - Adaptive size based on tablet vs mobile
 * - Proper touch handling for tablet gestures
 * - Optimized animations for tablet performance
 */
export const TabletModal = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
}: TabletModalProps) => {
  const isTablet = useIsTablet();
  const modalRef = useRef<HTMLDivElement>(null);

  const sizeStyles = {
    sm: isTablet ? 'max-w-md' : 'max-w-sm',
    md: isTablet ? 'max-w-lg' : 'max-w-md',
    lg: isTablet ? 'max-w-2xl' : 'max-w-lg',
    xl: isTablet ? 'max-w-4xl' : 'max-w-2xl',
  };

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`
          relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl
          w-full ${sizeStyles[size]}
          animate-in zoom-in-95 duration-200
          ${isTablet ? 'p-6 md:p-8' : 'p-4 md:p-6'}
        `}
        tabIndex={-1}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="max-h-[60vh] md:max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================
// TABLET-AWARE DRAWER COMPONENT
// ============================================

interface TabletDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Drawer component optimized for tablet
 * - Adaptive width for tablet screens
 * - Smooth animations optimized for tablet
 * - Touch-friendly close button
 */
export const TabletDrawer = ({
  isOpen,
  onClose,
  children,
  position = 'right',
  size = 'md',
}: TabletDrawerProps) => {
  const isTablet = useIsTablet();
  const drawerRef = useRef<HTMLDivElement>(null);

  const sizeStyles = {
    sm: isTablet ? 'w-80' : 'w-72',
    md: isTablet ? 'w-96' : 'w-80',
    lg: isTablet ? 'w-[480px]' : 'w-96',
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`
          absolute top-0 bottom-0 ${position}-0
          ${sizeStyles[size]} max-w-[90vw]
          bg-gray-900 border-${position === 'left' ? 'r' : 'l'} border-gray-800
          shadow-2xl
          animate-in ${position === 'left' ? 'slide-in-from-left' : 'slide-in-from-right'} duration-300
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              aria-label="Close drawer"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TABLET-AWARE TABS COMPONENT
// ============================================

interface TabletTabProps {
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  badge?: number;
}

interface TabletTabsProps {
  tabs: Omit<TabletTabProps, 'isActive'>[];
  activeTab: string;
  onTabChange: (value: string) => void;
  variant?: 'default' | 'pills' | 'underlined';
}

/**
 * Tabs component optimized for tablet
 * - Larger touch targets for tablet
 * - Smooth transitions for tab switching
 * - Adaptive layout for tablet landscape
 */
export const TabletTabs = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'default',
}: TabletTabsProps) => {
  const isTablet = useIsTablet();

  const variantStyles = {
    default: 'border-b border-gray-800',
    pills: 'bg-gray-800 p-1.5 rounded-xl',
    underlined: 'border-b-2 border-gray-800',
  };

  return (
    <div className={`${variantStyles[variant]} ${isTablet ? 'mb-6' : 'mb-4'}`}>
      <div
        className={`flex ${variant === 'pills' ? 'gap-1' : 'gap-0'} ${isTablet ? 'gap-2' : ''}`}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={`
              relative flex items-center gap-2 px-4 py-3 font-medium transition-all duration-200
              ${variant === 'default' ? `
                ${activeTab === tab.value
                  ? 'text-indigo-400 border-b-2 border-indigo-400 -mb-px'
                  : 'text-gray-400 hover:text-gray-300 border-b-2 border-transparent'
                }
              ` : ''}
              ${variant === 'pills' ? `
                ${activeTab === tab.value
                  ? 'bg-gray-700 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                }
                rounded-lg
              ` : ''}
              ${variant === 'underlined' ? `
                ${activeTab === tab.value
                  ? 'text-white border-b-2 border-white'
                  : 'text-gray-400 hover:text-gray-300 border-b-2 border-transparent'
                }
              ` : ''}
              ${isTablet ? 'px-6 py-4 text-base' : 'px-4 py-3 text-sm'}
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
            `}
            role="tab"
            aria-selected={activeTab === tab.value}
            tabIndex={activeTab === tab.value ? 0 : -1}
            style={{ minHeight: isTablet ? '48px' : '44px' }}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && tab.badge > 0 && (
              <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================
// TABLET-AWARE PAGINATION COMPONENT
// ============================================

interface TabletPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showEdges?: boolean;
  maxVisible?: number;
}

/**
 * Pagination component optimized for tablet
 * - Larger touch targets for tablet
 * - Adaptive button layout for tablet
 * - Smooth transitions for page changes
 */
export const TabletPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  showEdges = true,
  maxVisible = 7,
}: TabletPaginationProps) => {
  const isTablet = useIsTablet();

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const halfVisible = Math.floor(maxVisible / 2);

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    // Calculate range around current page
    let startPage = Math.max(2, currentPage - halfVisible);
    let endPage = Math.min(totalPages - 1, currentPage + halfVisible);

    // Adjust range if we're near the start
    if (currentPage <= halfVisible + 1) {
      endPage = Math.min(totalPages - 1, maxVisible - 1);
    }

    // Adjust range if we're near the end
    if (currentPage >= totalPages - halfVisible) {
      startPage = Math.max(2, totalPages - maxVisible + 1);
    }

    // Add ellipsis if needed before range
    if (startPage > 2) {
      pages.push('...');
    }

    // Add range pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis if needed after range
    if (endPage < totalPages - 1) {
      pages.push('...');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <nav
      className={`flex items-center justify-center gap-1 ${isTablet ? 'gap-2' : ''}`}
      role="navigation"
      aria-label="Pagination"
    >
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`
          px-3 py-2 rounded-lg border transition-all duration-200
          ${currentPage === 1
            ? 'border-gray-800 text-gray-600 cursor-not-allowed opacity-50'
            : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }
          ${isTablet ? 'px-4 py-3' : ''}
        `}
        aria-label="Previous page"
        style={{ minHeight: isTablet ? '48px' : '44px' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page Numbers */}
      {getPageNumbers().map((page, index) => (
        <button
          key={index}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={typeof page !== 'number'}
          className={`
            ${typeof page === 'number'
              ? `
                px-3 py-2 rounded-lg border transition-all duration-200
                ${page === currentPage
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                }
              `
              : 'px-3 py-2 text-gray-600 cursor-default'
            }
            ${isTablet ? 'px-4 py-3' : ''}
          `}
          aria-label={`Page ${page}`}
          aria-current={page === currentPage ? 'page' : undefined}
          style={{ minHeight: isTablet ? '48px' : '44px' }}
        >
          {page}
        </button>
      ))}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`
          px-3 py-2 rounded-lg border transition-all duration-200
          ${currentPage === totalPages
            ? 'border-gray-800 text-gray-600 cursor-not-allowed opacity-50'
            : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }
          ${isTablet ? 'px-4 py-3' : ''}
        `}
        aria-label="Next page"
        style={{ minHeight: isTablet ? '48px' : '44px' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
};
