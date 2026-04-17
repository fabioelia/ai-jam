import { useState } from 'react';

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
  if (!isOpen) return null;

  const hasFilters = epicFilter || priorityFilter || personaFilter || searchQuery;

  return (
    <div className="absolute top-full left-0 mt-2 z-50 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
      <div className="p-3 space-y-3">
        {epics.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Epic</label>
            <select
              value={epicFilter || ''}
              onChange={(e) => onEpicFilterChange(e.target.value || undefined)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Epics</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Priority</label>
          <select
            value={priorityFilter || ''}
            onChange={(e) => onPriorityFilterChange(e.target.value || undefined)}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
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
            <label className="text-xs text-gray-400 mb-1 block">Assignee</label>
            <select
              value={personaFilter || ''}
              onChange={(e) => onPersonaFilterChange(e.target.value || undefined)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
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
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tickets..."
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-8 pr-8 py-1.5 focus:outline-none focus:border-indigo-500"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
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
            className="w-full text-sm text-gray-400 hover:text-white text-center py-1"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
