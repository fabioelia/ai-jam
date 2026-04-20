import { useState } from 'react';
import { NotificationType } from '@ai-jam/shared';
import type { Project } from '@ai-jam/shared';

const typeIcons: Record<NotificationType, { label: string; svg: string }> = {
  agent_completed: { label: 'Agent completed', svg: 'M5 13l4 4L19 7' },
  ticket_moved: { label: 'Ticket moved', svg: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  gate_result: { label: 'Gate result', svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  comment_added: { label: 'Comment added', svg: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  proposal_created: { label: 'Proposal created', svg: 'M12 4v16m8-8H4' },
  proposal_resolved: { label: 'Proposal resolved', svg: 'M9 12l2 2 4-4' },
  scan_completed: { label: 'Scan completed', svg: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
};

type ReadFilter = 'all' | 'unread' | 'read';
type TypeFilter = NotificationType | '';

interface NotificationFiltersProps {
  projects: Project[];
  onSearchChange: (query: string) => void;
  onReadFilterChange: (filter: ReadFilter) => void;
  onTypeFilterChange: (filter: TypeFilter) => void;
  onProjectFilterChange: (projectId: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  searchQuery: string;
  readFilter: ReadFilter;
  typeFilter: TypeFilter;
  projectFilter: string;
}

export default function NotificationFilters({
  projects,
  onSearchChange,
  onReadFilterChange,
  onTypeFilterChange,
  onProjectFilterChange,
  onClearFilters,
  hasActiveFilters,
  searchQuery,
  readFilter,
  typeFilter,
  projectFilter,
}: NotificationFiltersProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const notificationTypes = Object.entries(NotificationType).map(([, value]) => ({
    value,
    label: typeIcons[value]?.label ?? value,
  }));

  return (
    <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50 space-y-3">
      {/* Search bar */}
      <div className="relative">
        <svg
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-all duration-200 ${
            isSearchFocused ? 'text-indigo-400' : 'text-gray-500'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          placeholder="Search notifications..."
          className={`w-full pl-10 pr-4 py-2 bg-gray-800 border rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none transition-all duration-200 ${
            isSearchFocused
              ? 'border-indigo-500 ring-1 ring-indigo-500/50'
              : 'border-gray-700 focus:border-gray-600'
          }`}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-all duration-200 hover:shadow-sm hover:shadow-gray-900/10 active:bg-gray-700 active:scale-95 p-1 rounded-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Read status filter */}
        <div className="flex items-center bg-gray-800 rounded-lg p-1">
          {(['all', 'unread', 'read'] as ReadFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => onReadFilterChange(filter)}
              className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${
                readFilter === filter
                  ? 'bg-indigo-600 text-white shadow-md animate-filter-chip-in'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {filter === 'all' ? 'All' : filter}
            </button>
          ))}
        </div>

        {/* Type filter dropdown */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value as TypeFilter)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200 cursor-pointer hover:border-gray-600"
        >
          <option value="">All types</option>
          {notificationTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Project filter dropdown */}
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => onProjectFilterChange(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200 cursor-pointer hover:border-gray-600"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all duration-200 flex items-center gap-1.5 animate-filter-chip-in"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
