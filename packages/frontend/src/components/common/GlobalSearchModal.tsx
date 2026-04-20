import { useState, useEffect, useRef, useCallback } from 'react';
import { useGlobalSearch, type QuickAction, type SearchResultType } from '../../hooks/useGlobalSearch';
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS, formatShortcut } from '../../hooks/useKeyboardShortcuts';
import Button from './Button';
import EmptyState from './EmptyState';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SearchInputProps {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function SearchInput({ query, onQueryChange, placeholder = 'Search...', autoFocus = true }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="relative">
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-12 py-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        aria-label="Search"
        autoComplete="off"
      />
      {query && (
        <button
          onClick={() => onQueryChange('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded transition-colors"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  isActive: boolean;
  count?: number;
  onClick: () => void;
  shortcut?: string;
}

function FilterChip({ label, isActive, count, onClick, shortcut }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
        ${isActive
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }
      `}
      aria-pressed={isActive}
    >
      {label}
      {count !== undefined && <span className={`text-xs ${isActive ? 'bg-white/20' : 'bg-gray-600'} px-1.5 py-0.5 rounded`}>{count}</span>}
      {shortcut && <kbd className="text-xs bg-black/20 px-1 rounded">{shortcut}</kbd>}
    </button>
  );
}

interface QuickActionButtonsProps {
  actions: QuickAction[];
  onActionClick: (action: QuickAction) => void;
}

function QuickActionButtons({ actions, onActionClick }: QuickActionButtonsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex gap-2 mt-2">
      {actions.slice(0, 2).map((action) => (
        <button
          key={action.id}
          onClick={() => onActionClick(action)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          title={action.label}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
          </svg>
          {action.label}
          {action.shortcut && <kbd className="text-xs bg-gray-700 px-1 rounded">{action.shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}

interface SearchResultItemProps {
  result: any;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function SearchResultItem({ result, isSelected, onClick, onMouseEnter }: SearchResultItemProps) {
  const getTypeIcon = (type: SearchResultType) => {
    switch (type) {
      case 'ticket':
        return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2';
      case 'feature':
        return 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01';
      case 'project':
        return 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7';
      case 'user':
        return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      default:
        return '';
    }
  };

  const getTypeColor = (type: SearchResultType) => {
    switch (type) {
      case 'ticket':
        return 'bg-blue-500/20 text-blue-400';
      case 'feature':
        return 'bg-purple-500/20 text-purple-400';
      case 'project':
        return 'bg-green-500/20 text-green-400';
      case 'user':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getTypeLabel = (type: SearchResultType) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`
        w-full text-left p-4 rounded-lg transition-all
        ${isSelected
          ? 'bg-indigo-600/20 border-2 border-indigo-500'
          : 'bg-gray-800/50 hover:bg-gray-800 border-2 border-transparent'
        }
      `}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${getTypeColor(result.type)}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getTypeIcon(result.type)} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getTypeColor(result.type)}`}>
              {getTypeLabel(result.type)}
            </span>
            <div className="flex-1">
              <h3
                className="font-semibold text-white truncate"
                dangerouslySetInnerHTML={{ __html: result.highlightedText || result.title }}
              />
            </div>
          </div>
          {result.description && (
            <p className="text-sm text-gray-400 truncate mb-2">{result.description}</p>
          )}
          <QuickActionButtons
            actions={result.quickActions || []}
            onActionClick={(action) => {
              action.action();
            }}
          />
        </div>
        {result.relevanceScore > 0.8 && (
          <div className="flex-shrink-0">
            <span className="text-xs text-green-400 font-medium">High match</span>
          </div>
        )}
      </div>
    </button>
  );
}

interface SearchResultGroupProps {
  type: SearchResultType;
  results: any[];
  selectedIndex: number;
  globalIndexOffset: number;
  onResultClick: (index: number) => void;
  onResultHover: (index: number) => void;
}

function SearchResultGroup({ type, results, selectedIndex, globalIndexOffset, onResultClick, onResultHover }: SearchResultGroupProps) {
  if (results.length === 0) return null;

  const getTypeLabel = (type: SearchResultType) => {
    switch (type) {
      case 'ticket': return 'Tickets';
      case 'feature': return 'Features';
      case 'project': return 'Projects';
      case 'user': return 'Users';
      case 'epic': return 'Epics';
      default: return type;
    }
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
        {getTypeLabel(type)} ({results.length})
      </h3>
      <div className="space-y-2">
        {results.map((result, index) => {
          const globalIndex = globalIndexOffset + index;
          return (
            <SearchResultItem
              key={result.id}
              result={result}
              isSelected={selectedIndex === globalIndex}
              onClick={() => onResultClick(globalIndex)}
              onMouseEnter={() => onResultHover(globalIndex)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SearchHistoryItemProps {
  query: string;
  onClick: () => void;
  onDelete: () => void;
}

function SearchHistoryItem({ query, onClick, onDelete }: SearchHistoryItemProps) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center justify-between w-full p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-gray-300 truncate">{query}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
        aria-label="Remove from history"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </button>
  );
}

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export default function GlobalSearchModal({ isOpen, onClose, initialQuery = '' }: GlobalSearchModalProps) {
  const {
    query,
    setQuery,
    results,
    groupedResults,
    isSearching,
    selectedIndex,
    filters,
    updateFilters,
    history,
    getRecentSearches,
    clearHistory,
    navigateResults,
    selectResult
  } = useGlobalSearch({
    fuzzy: true,
    includeDescription: true,
    maxResults: 50
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Initialize with initial query
  useEffect(() => {
    if (initialQuery && isOpen) {
      setQuery(initialQuery);
    }
  }, [initialQuery, isOpen, setQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const shortcuts = [
      {
        ...DEFAULT_SHORTCUTS.SEARCH,
        action: () => {}
      },
      {
        ...DEFAULT_SHORTCUTS.ESCAPE,
        action: onClose
      }
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateResults('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateResults('up');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectResult(selectedIndex);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, navigateResults, selectResult, selectedIndex, onClose]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const selectedElement = resultsContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Handle clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const recentSearches = getRecentSearches(5);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-modal-scale-in">
      <div
        ref={modalRef}
        className="w-full max-w-3xl mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-white">Search</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          {/* Search Input */}
          <SearchInput
            query={query}
            onQueryChange={setQuery}
            placeholder="Search tickets, features, projects, users..."
          />

          {/* Filters */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <FilterChip
                label="All"
                isActive={filters.types.length === 4}
                count={results.length}
                onClick={() => updateFilters({ types: ['ticket', 'feature', 'project', 'user'] })}
              />
              <FilterChip
                label="Tickets"
                isActive={filters.types.includes('ticket') && filters.types.length === 1}
                count={groupedResults.ticket.length}
                onClick={() => updateFilters({ types: ['ticket'] })}
              />
              <FilterChip
                label="Features"
                isActive={filters.types.includes('feature') && filters.types.length === 1}
                count={groupedResults.feature.length}
                onClick={() => updateFilters({ types: ['feature'] })}
              />
              <FilterChip
                label="Projects"
                isActive={filters.types.includes('project') && filters.types.length === 1}
                count={groupedResults.project.length}
                onClick={() => updateFilters({ types: ['project'] })}
              />
              <FilterChip
                label="Users"
                isActive={filters.types.includes('user') && filters.types.length === 1}
                count={groupedResults.user.length}
                onClick={() => updateFilters({ types: ['user'] })}
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : query.length > 0 ? (
            <>
              {results.length > 0 ? (
                <div ref={resultsContainerRef} className="space-y-1" role="listbox" aria-label="Search results">
                  {filters.types.includes('project') && groupedResults.project.length > 0 && (
                    <SearchResultGroup
                      type="project"
                      results={groupedResults.project}
                      selectedIndex={selectedIndex}
                      globalIndexOffset={0}
                      onResultClick={selectResult}
                      onResultHover={(index) => selectResult(index)}
                    />
                  )}
                  {filters.types.includes('feature') && groupedResults.feature.length > 0 && (
                    <SearchResultGroup
                      type="feature"
                      results={groupedResults.feature}
                      selectedIndex={selectedIndex}
                      globalIndexOffset={groupedResults.project.length}
                      onResultClick={selectResult}
                      onResultHover={(index) => selectResult(index)}
                    />
                  )}
                  {filters.types.includes('ticket') && groupedResults.ticket.length > 0 && (
                    <SearchResultGroup
                      type="ticket"
                      results={groupedResults.ticket}
                      selectedIndex={selectedIndex}
                      globalIndexOffset={groupedResults.project.length + groupedResults.feature.length}
                      onResultClick={selectResult}
                      onResultHover={(index) => selectResult(index)}
                    />
                  )}
                  {filters.types.includes('user') && groupedResults.user.length > 0 && (
                    <SearchResultGroup
                      type="user"
                      results={groupedResults.user}
                      selectedIndex={selectedIndex}
                      globalIndexOffset={groupedResults.project.length + groupedResults.feature.length + groupedResults.ticket.length}
                      onResultClick={selectResult}
                      onResultHover={(index) => selectResult(index)}
                    />
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No results found"
                  description="Try adjusting your search query or filters"
                  icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              )}
            </>
          ) : (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-2">
                      Recent Searches
                    </h3>
                    <button
                      onClick={clearHistory}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="space-y-2">
                    {recentSearches.map((item) => (
                      <SearchHistoryItem
                        key={item.id}
                        query={item.query}
                        onClick={() => setQuery(item.query)}
                        onDelete={() => {
                          // Remove from history would be implemented here
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Search Tips */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                  Search Tips
                </h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <kbd className="text-xs bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">Tab</kbd>
                    <span>Navigate between results</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <kbd className="text-xs bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">Enter</kbd>
                    <span>Open selected result</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <kbd className="text-xs bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">Esc</kbd>
                    <span>Close search modal</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <kbd className="text-xs bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">↑ ↓</kbd>
                    <span>Navigate search results</span>
                  </li>
                </ul>
              </div>

              {/* Quick Links */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                  Quick Links
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.href = '/'}
                    className="justify-start"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.href = '/notifications'}
                    className="justify-start"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Notifications
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.href = '/settings'}
                    className="justify-start"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.href = '/settings'}
                    className="justify-start"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-800/50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>{results.length} results</span>
            <span className="hidden sm:inline">Use arrows to navigate</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="bg-gray-700 px-1.5 py-0.5 rounded">Esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
