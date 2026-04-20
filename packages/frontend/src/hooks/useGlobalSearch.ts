import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useProjects, useFeatures, useUsers, useCurrentUser } from '../api/queries';
import { apiFetch } from '../api/client.js';
import type { Project, Feature, Ticket, UserInfo, BoardState } from '@ai-jam/shared';

// ============================================================================
// SEARCH TYPES AND INTERFACES
// ============================================================================

export type SearchResultType = 'ticket' | 'feature' | 'project' | 'user' | 'epic';

export interface SearchResult<T = any> {
  id: string;
  type: SearchResultType;
  title: string;
  description?: string;
  relevanceScore: number;
  data: T;
  highlightedText?: string;
  category?: string;
  icon?: string;
  quickActions?: QuickAction[];
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  shortcut?: string;
}

export interface SearchFilters {
  types: SearchResultType[];
  status?: string[];
  priority?: string[];
  assignedTo?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  projectId?: string;
  featureId?: string;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultCount: number;
  selectedResult?: {
    id: string;
    type: SearchResultType;
  };
}

export interface SearchOptions {
  fuzzy?: boolean;
  caseSensitive?: boolean;
  includeDescription?: boolean;
  maxResults?: number;
  minRelevanceScore?: number;
}

// ============================================================================
// FUZZY SEARCH UTILITIES
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],      // deletion
          dp[i][j - 1],      // insertion
          dp[i - 1][j - 1]   // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate fuzzy match score between two strings
 */
export function fuzzyMatchScore(query: string, text: string): number {
  if (!query || !text) return 0;

  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 1;

  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 0.9;

  // Contains query gets medium-high score
  if (lowerText.includes(lowerQuery)) return 0.8;

  // Check for fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(lowerQuery, lowerText);
  const maxLen = Math.max(lowerQuery.length, lowerText.length);
  const similarity = 1 - (distance / maxLen);

  // Return similarity score if it's reasonable (> 0.5)
  return similarity > 0.5 ? similarity * 0.7 : 0;
}

/**
 * Calculate relevance score for a search result
 */
export function calculateRelevanceScore(
  result: { title: string; description?: string },
  query: string,
  options: SearchOptions = {}
): number {
  const { caseSensitive = false, includeDescription = true } = options;

  const searchQuery = caseSensitive ? query : query.toLowerCase();
  const title = caseSensitive ? result.title : result.title.toLowerCase();
  const description = includeDescription && result.description
    ? (caseSensitive ? result.description : result.description.toLowerCase())
    : '';

  let score = 0;

  // Title matching (most important)
  score += fuzzyMatchScore(searchQuery, result.title) * 0.6;

  // Description matching (less important)
  if (description) {
    score += fuzzyMatchScore(searchQuery, result.description!) * 0.3;
  }

  // Word boundary matching bonus
  const words = searchQuery.split(/\s+/);
  const titleWords = result.title.split(/\s+/);
  const descWords = description ? result.description!.split(/\s+/) : [];

  words.forEach(word => {
    if (titleWords.some(tw => tw.toLowerCase() === word.toLowerCase())) {
      score += 0.05;
    }
    if (descWords.some(dw => dw.toLowerCase() === word.toLowerCase())) {
      score += 0.02;
    }
  });

  return Math.min(score, 1);
}

/**
 * Highlight matching text in a string
 */
export function highlightMatches(text: string, query: string, caseSensitive = false): string {
  if (!query) return text;

  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(
    query.split('').join('.*?').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    flags
  );

  return text.replace(regex, match => `<mark>${match}</mark>`);
}

/**
 * Search in an array of items
 */
export function searchInArray<T extends { title: string; description?: string }>(
  items: T[],
  query: string,
  options: SearchOptions = {}
): (T & { relevanceScore: number; highlightedText?: string })[] {
  const { minRelevanceScore = 0.3, maxResults = 100 } = options;

  const results = items.map(item => {
    const score = calculateRelevanceScore(item, query, options);
    return {
      ...item,
      relevanceScore: score,
      highlightedText: score > 0 ? highlightMatches(item.title, query, options.caseSensitive) : undefined
    };
  });

  // Filter by minimum relevance score and sort by score
  return results
    .filter(result => result.relevanceScore >= minRelevanceScore)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

// ============================================================================
// SEARCH HISTORY MANAGEMENT
// ============================================================================

const SEARCH_HISTORY_KEY = 'ai-jam:search-history';
const SEARCH_HISTORY_MAX_ITEMS = 50;

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addToHistory = useCallback((query: string, resultCount: number, selectedResult?: { id: string; type: SearchResultType }) => {
    if (!query.trim()) return;

    const item: SearchHistoryItem = {
      id: Date.now().toString(),
      query: query.trim(),
      timestamp: Date.now(),
      resultCount,
      selectedResult
    };

    setHistory(prev => {
      const filtered = prev.filter(h => h.query.toLowerCase() !== query.toLowerCase());
      const updated = [item, ...filtered].slice(0, SEARCH_HISTORY_MAX_ITEMS);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  const getRecentSearches = useCallback((limit: number = 10) => {
    return history.slice(0, limit);
  }, [history]);

  const getPopularSearches = useCallback((limit: number = 10) => {
    const frequency = new Map<string, { count: number; timestamp: number }>();

    history.forEach(item => {
      const existing = frequency.get(item.query.toLowerCase());
      if (existing) {
        existing.count++;
        existing.timestamp = Math.max(existing.timestamp, item.timestamp);
      } else {
        frequency.set(item.query.toLowerCase(), { count: 1, timestamp: item.timestamp });
      }
    });

    return Array.from(frequency.entries())
      .map(([query, data]) => ({ query, ...data }))
      .sort((a, b) => b.count - a.count || b.timestamp - a.timestamp)
      .slice(0, limit);
  }, [history]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentSearches,
    getPopularSearches
  };
}

// ============================================================================
// GLOBAL SEARCH HOOK
// ============================================================================

export function useGlobalSearch(options: SearchOptions = {}) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({ types: ['ticket', 'feature', 'project', 'user'] });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch all searchable data
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const { history, addToHistory, removeFromHistory, clearHistory, getRecentSearches } = useSearchHistory();

  // Fetch boards for all projects to get tickets
  const boardQueries = useQueries({
    queries: (projects ?? []).map(project => ({
      queryKey: ['board', project.id],
      queryFn: () => apiFetch<BoardState>(`/projects/${project.id}/board`),
      enabled: !!project.id,
      staleTime: 30_000,
    })),
  });

  // Get all tickets from all boards
  const allTickets = useMemo(() => {
    const tickets: Ticket[] = [];
    boardQueries.forEach(query => {
      if (query.data?.tickets) {
        tickets.push(...query.data.tickets);
      }
    });
    return tickets;
  }, [boardQueries]);

  // Get all features from all projects
  const allFeatures = useMemo(() => {
    const features: Feature[] = [];
    boardQueries.forEach(query => {
      if (query.data?.features) {
        features.push(...query.data.features);
      }
    });
    return features;
  }, [boardQueries]);

  /**
   * Perform search across all indexed items
   */
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      const searchResults: SearchResult[] = [];
      const { types, ...activeFilters } = filters;

      // Search projects
      if (types.includes('project') && projects) {
        const projectResults = searchInArray(
          projects.map(p => ({ title: p.name, description: p.repoUrl, data: p })),
          searchQuery,
          options
        ).map(result => ({
          id: result.data.id,
          type: 'project' as const,
          title: result.data.name,
          description: result.data.repoUrl,
          relevanceScore: result.relevanceScore,
          data: result.data,
          highlightedText: result.highlightedText,
          icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7',
          quickActions: [
            {
              id: 'open-project',
              label: 'Open Board',
              icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7',
              action: () => window.location.href = `/projects/${result.data.id}/board`
            },
            {
              id: 'settings',
              label: 'Settings',
              icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
              action: () => window.location.href = `/projects/${result.data.id}/settings`
            }
          ]
        }));

        searchResults.push(...projectResults);
      }

      // Search features
      if (types.includes('feature') && allFeatures.length > 0) {
        const featureResults = searchInArray(
          allFeatures.map(f => ({ title: f.title, description: f.description, data: f })),
          searchQuery,
          options
        ).map(result => ({
          id: result.data.id,
          type: 'feature' as const,
          title: result.data.title,
          description: result.data.description,
          relevanceScore: result.relevanceScore,
          data: result.data,
          highlightedText: result.highlightedText,
          icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
          quickActions: [
            {
              id: 'open-feature',
              label: 'Open Feature',
              icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
              action: () => window.location.href = `/projects/${result.data.projectId}/features/${result.data.id}`
            },
            {
              id: 'plan-feature',
              label: 'Plan',
              icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
              action: () => window.location.href = `/projects/${result.data.projectId}/features/${result.data.id}/plan`
            }
          ]
        }));

        searchResults.push(...featureResults);
      }

      // Search tickets
      if (types.includes('ticket') && allTickets.length > 0) {
        const ticketResults = searchInArray(
          allTickets.map(t => ({ title: t.title, description: t.description, data: t })),
          searchQuery,
          options
        ).map(result => {
          const ticket = result.data as Ticket;
          return {
            id: result.data.id,
            type: 'ticket' as const,
            title: result.data.title,
            description: result.data.description,
            relevanceScore: result.relevanceScore,
            data: result.data,
            highlightedText: result.highlightedText,
            icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
            quickActions: [
              {
                id: 'open-ticket',
                label: 'Open Ticket',
                icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
                action: () => {
                  // Find the feature this ticket belongs to
                  const feature = allFeatures.find(f => f.id === ticket.featureId);
                  if (feature) {
                    window.location.href = `/projects/${ticket.projectId}/features/${feature.id}`;
                  }
                }
              },
              {
                id: 'assign-to-me',
                label: 'Assign to Me',
                icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
                action: () => {
                  // Would implement assignment logic
                  console.log('Assign ticket to current user:', ticket.id);
                }
              }
            ]
          };
        });

        searchResults.push(...ticketResults);
      }

      // Search users
      if (types.includes('user') && users) {
        const userResults = searchInArray(
          users.map(u => ({ title: u.name, description: u.email, data: u })),
          searchQuery,
          options
        ).map(result => ({
          id: result.data.id,
          type: 'user' as const,
          title: result.data.name,
          description: result.data.email,
          relevanceScore: result.relevanceScore,
          data: result.data,
          highlightedText: result.highlightedText,
          icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
          quickActions: [
            {
              id: 'view-profile',
              label: 'View Profile',
              icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
              action: () => console.log('View user profile:', result.data.id)
            }
          ]
        }));

        searchResults.push(...userResults);
      }

      // Apply additional filters
      let filteredResults = searchResults;

      if (activeFilters.status?.length) {
        filteredResults = filteredResults.filter(r => {
          if (r.type === 'ticket') {
            const ticket = r.data as Ticket;
            return activeFilters.status!.includes(ticket.status);
          }
          return true;
        });
      }

      if (activeFilters.priority?.length) {
        filteredResults = filteredResults.filter(r => {
          if (r.type === 'ticket') {
            const ticket = r.data as Ticket;
            return activeFilters.priority!.includes(ticket.priority);
          }
          return true;
        });
      }

      if (activeFilters.projectId) {
        filteredResults = filteredResults.filter(r => {
          if (r.type === 'project') return r.id === activeFilters.projectId;
          if (r.type === 'feature' || r.type === 'ticket') {
            const item = r.data as any;
            return item.projectId === activeFilters.projectId;
          }
          return true;
        });
      }

      // Sort by relevance score and limit results
      const sortedResults = filteredResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, options.maxResults || 100);

      setResults(sortedResults);
      setIsSearching(false);
    }, 300);
  }, [filters, projects, allFeatures, allTickets, users, options]);

  /**
   * Handle query change with debouncing
   */
  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);
    performSearch(newQuery);
  }, [performSearch]);

  /**
   * Select a search result
   */
  const selectResult = useCallback((index: number) => {
    if (index >= 0 && index < results.length) {
      const result = results[index];
      setSelectedIndex(index);

      // Add to search history
      addToHistory(query, results.length, {
        id: result.id,
        type: result.type
      });

      // Execute primary action
      if (result.quickActions?.length) {
        result.quickActions[0].action();
      }
    }
  }, [results, query, addToHistory]);

  /**
   * Navigate search results with keyboard
   */
  const navigateResults = useCallback((direction: 'up' | 'down') => {
    if (results.length === 0) return;

    if (selectedIndex === -1) {
      setSelectedIndex(direction === 'down' ? 0 : results.length - 1);
    } else {
      const newIndex = direction === 'down'
        ? Math.min(selectedIndex + 1, results.length - 1)
        : Math.max(selectedIndex - 1, 0);
      setSelectedIndex(newIndex);
    }
  }, [selectedIndex, results.length]);

  /**
   * Clear search
   */
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
  }, []);

  /**
   * Update filters
   */
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Get grouped results by type
   */
  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {
      ticket: [],
      feature: [],
      project: [],
      user: [],
      epic: []
    };

    results.forEach(result => {
      groups[result.type].push(result);
    });

    return groups;
  }, [results]);

  /**
   * Get suggestions based on partial query
   */
  const suggestions = useMemo(() => {
    if (query.length < 2) return [];

    const recentSearches = getRecentSearches(5);
    const matchingRecent = recentSearches
      .filter(h => h.query.toLowerCase().includes(query.toLowerCase()))
      .map(h => ({ type: 'recent', text: h.query }));

    return matchingRecent.slice(0, 5);
  }, [query, getRecentSearches]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    query,
    setQuery: handleQueryChange,
    results,
    groupedResults,
    isSearching,
    selectedIndex,
    filters,
    suggestions,
    history,

    // Actions
    performSearch,
    selectResult,
    navigateResults,
    clearSearch,
    updateFilters,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentSearches,

    // Derived
    resultCount: results.length,
    hasResults: results.length > 0,
    hasQuery: query.trim().length > 0
  };
}
