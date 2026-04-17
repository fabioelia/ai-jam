import { useState, useEffect, useRef } from 'react';

interface FiltersPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  epics: Array<{ id: string; title: string }>;
  personas: string[];
  epicFilter: string | undefined;
  priorityFilter: string | undefined;
  personaFilter: string | undefined;
  searchQuery: string;
  onEpicFilterChange: (value: string | undefined) => void;
  onPriorityFilterChange: (value: string | undefined) => void;
  onPersonaFilterChange: (value: string | undefined) => void;
  onSearchChange: (value: string) => void;
  onClearAll: () => void;
}

export default function FiltersPopover({
  isOpen,
  onClose,
  epics,
  personas,
  epicFilter,
  priorityFilter,
  personaFilter,
  searchQuery,
  onEpicFilterChange,
  onPriorityFilterChange,
  onPersonaFilterChange,
  onSearchChange,
  onClearAll,
}: FiltersPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasFilters = epicFilter || priorityFilter || personaFilter || searchQuery;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-2 z-50 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl animate-in zoom-in-95 duration-150"
    >
      <div className="p-3 space-y-3">
        {epics.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Epic</label>
            <select
              value={epicFilter || ''}
              onChange={(e) => onEpicFilterChange(e.target.value || undefined)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">All Epics</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-400 mb-1.5 block">Priority</label>
          <select
            value={priorityFilter || ''}
            onChange={(e) => onPriorityFilterChange(e.target.value || undefined)}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {personas.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1.5 block">Assignee</label>
            <select
              value={personaFilter || ''}
              onChange={(e) => onPersonaFilterChange(e.target.value || undefined)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">All Assignees</option>
              {personas.map((p) => (
                <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Search</label>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tickets..."
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              onClearAll();
              onClose();
            }}
            className="w-full text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 text-center py-2 rounded-lg transition-colors font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Footer with quick actions */}
      {!hasFilters && (
        <div className="px-3 pb-3 pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-600 text-center">
            Select filters to narrow down tickets
          </p>
        </div>
      )}
    </div>
  );
}
