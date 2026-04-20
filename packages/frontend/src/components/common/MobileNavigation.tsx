/**
 * Mobile Navigation Component
 *
 * Touch-friendly mobile navigation with bottom navigation bar,
 * slide-out menus, and mobile-specific navigation patterns.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBreakpoint, useIsMobile, useIsTouch, useSafeAreaInsets } from '../../hooks/useResponsive.js';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
  active?: boolean;
}

interface MobileNavigationProps {
  items: NavItem[];
  variant?: 'bottom' | 'drawer' | 'hamburger';
  onItemClick?: (item: NavItem) => void;
  children?: React.ReactNode;
}

export default function MobileNavigation({
  items,
  variant = 'bottom',
  onItemClick,
  children,
}: MobileNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useBreakpoint();
  const isMobileDevice = useIsMobile();
  const isTouch = useIsTouch();
  const safeInsets = useSafeAreaInsets();

  const [isOpen, setIsOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Determine current active item based on route
  useEffect(() => {
    const currentPath = location.pathname;
    const activeItem = items.find(item =>
      currentPath.startsWith(item.path)
    );
    setActiveItem(activeItem?.id || null);
  }, [location.pathname, items]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  // Close navigation on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close drawer when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node) &&
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Don't render on desktop
  if (!isMobileDevice) {
    return <>{children}</>;
  }

  const handleItemClick = (item: NavItem) => {
    setIsOpen(false);
    onItemClick?.(item);
    navigate(item.path);
  };

  // Bottom Navigation Bar (iOS style)
  if (variant === 'bottom') {
    return (
      <>
        {children}
        <nav
          className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 safe-area-bottom z-50"
          style={{
            paddingBottom: `${safeInsets.bottom}px`,
          }}
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="flex items-stretch h-16 md:h-20">
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                onTouchEnd={() => setActiveItem(item.id)}
                className={`
                  flex-1 flex flex-col items-center justify-center
                  gap-1 transition-all duration-200
                  ${activeItem === item.id
                    ? 'text-indigo-400'
                    : 'text-gray-500 hover:text-gray-400'
                  }
                  ${isTouch ? 'active:scale-95' : ''}
                `}
                style={{ minHeight: '44px' }}
                aria-label={item.label}
                aria-current={activeItem === item.id ? 'page' : undefined}
              >
                <svg
                  className={`w-6 h-6 md:w-7 md:h-7 transition-transform duration-200 ${
                    activeItem === item.id ? 'scale-110' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="text-[10px] md:text-xs font-medium">
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className="absolute top-1 right-1 md:top-2 md:right-2 min-w-[18px] md:min-w-[20px] h-[18px] md:h-[20px] px-1.5 md:px-2 bg-red-500 text-white text-[10px] md:text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </>
    );
  }

  // Drawer Navigation
  if (variant === 'drawer') {
    return (
      <>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 left-4 z-40 bg-gray-800 text-white p-3 rounded-xl shadow-lg border border-gray-700 hover:bg-gray-700 transition-all duration-200 active:scale-95"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          <svg
            className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {isOpen && (
          <>
            <div
              ref={overlayRef}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
              onClick={() => setIsOpen(false)}
            />

            <div
              ref={drawerRef}
              className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300 ease-out"
              style={{
                transform: 'translateX(0)',
                paddingTop: `${safeInsets.top}px`,
              }}
              onKeyDown={handleKeyDown}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Menu</h2>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                      aria-label="Close menu"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto p-4">
                  <nav role="navigation">
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => handleItemClick(item)}
                            className={`
                              w-full flex items-center gap-4 px-4 py-4 rounded-xl
                              transition-all duration-200
                              ${activeItem === item.id
                                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                              }
                            `}
                            style={{ minHeight: '56px' }}
                            aria-label={item.label}
                            aria-current={activeItem === item.id ? 'page' : undefined}
                          >
                            <svg
                              className="w-6 h-6 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                            </svg>
                            <span className="flex-1 text-left font-medium text-base">
                              {item.label}
                            </span>
                            {item.badge && item.badge > 0 && (
                              <span className="bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                {item.badge > 9 ? '9+' : item.badge}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      A
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">Account</p>
                      <p className="text-xs text-gray-500">Manage your settings</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {children}
      </>
    );
  }

  // Hamburger Menu
  if (variant === 'hamburger') {
    return (
      <>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-4 right-4 z-40 bg-gray-800 text-white p-3 rounded-xl shadow-lg border border-gray-700 hover:bg-gray-700 transition-all duration-200 active:scale-95"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Toggle navigation menu"
          aria-expanded={isOpen}
        >
          <svg
            className={`w-6 h-6 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 18h16" />
              </>
            )}
          </svg>
        </button>

        {isOpen && (
          <div
            className="fixed inset-0 z-40"
            onKeyDown={handleKeyDown}
          >
            {/* Overlay */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Container */}
            <div className="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 border-l border-gray-800 z-50 animate-in slide-in-from-right duration-300">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-gray-800">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Navigation</h2>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                      aria-label="Close menu"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto p-4">
                  <nav role="navigation">
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.id}>
                          <button
                            onClick={() => handleItemClick(item)}
                            className={`
                              w-full flex items-center gap-4 px-4 py-3 rounded-xl
                              transition-all duration-200
                              ${activeItem === item.id
                                ? 'bg-indigo-600/20 text-indigo-300'
                                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                              }
                            `}
                            style={{ minHeight: '48px' }}
                            aria-label={item.label}
                          >
                            <svg
                              className="w-5 h-5 flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                            </svg>
                            <span className="flex-1 text-left font-medium text-sm">
                              {item.label}
                            </span>
                            {item.badge && item.badge > 0 && (
                              <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {item.badge > 9 ? '9+' : item.badge}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}

        {children}
      </>
    );
  }

  return <>{children}</>;
}

// ============================================
// GESTURE HANDLING HOOK
// ============================================

export function useSwipeGestures(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold: number = 50
) {
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (diff < 0 && onSwipeRight) {
        onSwipeRight();
      }
    }

    setTouchStart(null);
  }, [touchStart, threshold, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}
