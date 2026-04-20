import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KeyboardShortcut,
  getShortcutDisplay,
  searchShortcuts,
  getShortcutsByCategory,
  SHORTCUT_CATEGORIES,
  getMostUsedShortcuts
} from '../hooks/useKeyboardShortcuts.js';

interface ShortcutReferencePanelProps {
  shortcuts: KeyboardShortcut[];
  categories?: ShortcutCategory[];
  maxShortcuts?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onClose?: () => void;
  enableSearch?: boolean;
  enableCategoryFilter?: boolean;
  enableCollapse?: boolean;
  defaultCollapsed?: boolean;
}

export function ShortcutReferencePanel({
  shortcuts,
  categories = SHORTCUT_CATEGORIES,
  maxShortcuts = 8,
  position = 'bottom-right',
  onClose,
  enableSearch = true,
  enableCategoryFilter = true,
  enableCollapse = true,
  defaultCollapsed = false
}: ShortcutReferencePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [positionState, setPositionState] = useState({ x: 0, y: 0 });

  // Filter shortcuts based on search and category
  const filteredShortcuts = useMemo(() => {
    let filtered = shortcuts;

    if (selectedCategory !== 'all') {
      filtered = getShortcutsByCategory(filtered, selectedCategory);
    }

    if (searchQuery) {
      filtered = searchShortcuts(filtered, searchQuery);
    }

    return filtered.slice(0, maxShortcuts);
  }, [shortcuts, selectedCategory, searchQuery, maxShortcuts]);

  // Get most used shortcuts when no filter applied
  const displayShortcuts = useMemo(() => {
    if (selectedCategory === 'all' && !searchQuery) {
      return getMostUsedShortcuts(shortcuts, maxShortcuts);
    }
    return filteredShortcuts;
  }, [shortcuts, selectedCategory, searchQuery, maxShortcuts, filteredShortcuts]);

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableCollapse) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - positionState.x,
      y: e.clientY - positionState.y
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPositionState({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  if (isCollapsed) {
    return (
      <div
        className={`fixed ${positionClasses[position]} bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl z-40 cursor-pointer animate-in fade-in duration-200`}
        onClick={toggleCollapse}
        onMouseDown={handleMouseDown}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="text-sm font-semibold text-white">Shortcuts</span>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl z-40 max-w-sm animate-in slide-in-from-bottom-2 duration-300`}
      style={{
        transform: isDragging ? `translate(${positionState.x}px, ${positionState.y}px)` : undefined,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h4 className="text-sm font-semibold text-white">Quick Reference</h4>
          </div>
          <div className="flex items-center gap-1">
            {enableCollapse && (
              <button
                onClick={toggleCollapse}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
                title="Collapse panel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
                title="Close panel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        {enableSearch && (
          <div className="relative">
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 pl-8 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}

        {/* Category Filter */}
        {enableCategoryFilter && (
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              All
            </button>
            {categories.slice(0, 4).map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all ${
                  selectedCategory === category.id
                    ? `bg-${category.color}-600 text-white`
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Shortcuts List */}
      <div className="p-3 max-h-80 overflow-y-auto">
        <div className="space-y-1">
          {displayShortcuts.length > 0 ? (
            displayShortcuts.map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800 transition-colors">
                <span className="text-xs text-gray-300 flex-1 truncate pr-2">{shortcut.description}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {shortcut.ctrlKey && (
                    <kbd className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono">Ctrl</kbd>
                  )}
                  {shortcut.metaKey && (
                    <kbd className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono">Cmd</kbd>
                  )}
                  {shortcut.shiftKey && (
                    <kbd className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono">Shift</kbd>
                  )}
                  {shortcut.altKey && (
                    <kbd className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono">Alt</kbd>
                  )}
                  <kbd className="text-xs text-white bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded font-mono font-bold">
                    {shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key}
                  </kbd>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-500">
              <p className="text-xs">No shortcuts found</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-800 text-center">
        <span className="text-xs text-gray-500">Press ? for all shortcuts</span>
      </div>
    </div>
  );
}

// ---- Shortcut Tooltip Component ----

interface ShortcutTooltipProps {
  shortcut: KeyboardShortcut;
  children: React.ReactNode;
  showShortcut?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function ShortcutTooltip({
  shortcut,
  children,
  showShortcut = true,
  position = 'bottom'
}: ShortcutTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  if (!showShortcut) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 shadow-xl z-50 animate-in fade-in duration-150`}>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-300">{shortcut.description}</span>
            <span className="text-gray-500">•</span>
            <span className="text-xs text-gray-400 font-mono">{getShortcutDisplay(shortcut)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Shortcut Badge Component ----

interface ShortcutBadgeProps {
  shortcut: KeyboardShortcut;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'highlighted';
}

export function ShortcutBadge({
  shortcut,
  size = 'md',
  variant = 'default'
}: ShortcutBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  const variantClasses = {
    default: 'bg-gray-800 border-gray-700 text-gray-400',
    minimal: 'bg-transparent border-gray-600 text-gray-500',
    highlighted: 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
  };

  return (
    <div className={`inline-flex items-center gap-1 border rounded font-mono ${sizeClasses[size]} ${variantClasses[variant]}`}>
      {shortcut.ctrlKey && (
        <kbd className="text-xs">Ctrl</kbd>
      )}
      {shortcut.metaKey && (
        <kbd className="text-xs">Cmd</kbd>
      )}
      {shortcut.shiftKey && (
        <kbd className="text-xs">Shift</kbd>
      )}
      {shortcut.altKey && (
        <kbd className="text-xs">Alt</kbd>
      )}
      <kbd className={`font-bold ${variant === 'highlighted' ? 'text-indigo-200' : 'text-white'}`}>
        {shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key}
      </kbd>
    </div>
  );
}

// ---- Learning Mode Indicator Component ----

interface LearningModeIndicatorProps {
  enabled: boolean;
  shortcut?: KeyboardShortcut;
  onToggle?: () => void;
}

export function LearningModeIndicator({
  enabled,
  shortcut,
  onToggle
}: LearningModeIndicatorProps) {
  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-2 rounded-full shadow-lg animate-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-medium">Learning Mode</span>
          {shortcut && (
            <>
              <span className="text-white/60">•</span>
              <ShortcutBadge shortcut={shortcut} size="sm" variant="minimal" />
            </>
          )}
          {onToggle && (
            <button
              onClick={onToggle}
              className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors"
              title="Exit learning mode"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Shortcut Suggestion Component ----

interface ShortcutSuggestionProps {
  shortcut: KeyboardShortcut;
  context: string;
  onDismiss?: () => void;
  onEnable?: () => void;
}

export function ShortcutSuggestion({
  shortcut,
  context,
  onDismiss,
  onEnable
}: ShortcutSuggestionProps) {
  const [isEnabling, setIsEnabling] = useState(false);

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await onEnable?.();
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 mb-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium mb-1">
            Pro Tip
          </p>
          <p className="text-xs text-gray-400 mb-2">
            {context} You can use <span className="text-indigo-300 font-mono">{getShortcutDisplay(shortcut)}</span> instead.
          </p>
          <div className="flex items-center gap-2">
            {onEnable && (
              <button
                onClick={handleEnable}
                disabled={isEnabling}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-3 py-1 rounded font-medium transition-all"
              >
                {isEnabling ? 'Enabling...' : 'Learn Shortcut'}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
