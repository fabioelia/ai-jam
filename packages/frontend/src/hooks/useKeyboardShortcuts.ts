import { useEffect, useCallback, useState, useMemo, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  description: string;
  category: string;
  action: () => void;
  preventDefault?: boolean;
  priority?: number;
  enabled?: boolean;
  conflicts?: string[];
}

export interface ShortcutCategory {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  shortcuts: string[];
  color?: string;
}

export interface ShortcutConflict {
  shortcut: string;
  conflicts: Array<{
    key: string;
    description: string;
    category: string;
  }>;
}

export interface ShortcutLearningMode {
  enabled: boolean;
  activeElement?: HTMLElement;
  availableShortcuts: KeyboardShortcut[];
  dismissed: Set<string>;
}

// Comprehensive shortcut definitions
export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: 'navigation',
    name: 'Navigation',
    icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7',
    description: 'Navigate through the application',
    shortcuts: ['ESCAPE', 'NAVIGATE_UP', 'NAVIGATE_DOWN', 'NAVIGATE_LEFT', 'NAVIGATE_RIGHT', 'GO_HOME', 'GO_DASHBOARD', 'GO_BOARD', 'GO_SETTINGS'],
    color: 'indigo'
  },
  {
    id: 'actions',
    name: 'Actions',
    icon: 'M13 10V3L4 14h7v7l9-11h-7',
    description: 'Perform common actions quickly',
    shortcuts: ['NEW_FEATURE', 'NEW_TICKET', 'NEW_EPIC', 'SAVE', 'UNDO', 'REDO', 'DELETE', 'DUPLICATE'],
    color: 'blue'
  },
  {
    id: 'search',
    name: 'Search & Filter',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    description: 'Search and filter content',
    shortcuts: ['SEARCH', 'ADVANCED_SEARCH', 'TOGGLE_FILTERS', 'CLEAR_FILTERS', 'SEARCH_PREV', 'SEARCH_NEXT'],
    color: 'green'
  },
  {
    id: 'toggles',
    name: 'Panels & Views',
    icon: 'M4 6h16M4 12h16M4 18h7',
    description: 'Show and hide interface panels',
    shortcuts: ['TOGGLE_SIDEBAR', 'TOGGLE_SESSIONS', 'TOGGLE_AGENTS', 'TOGGLE_NOTIFICATIONS', 'TOGGLE_HELP', 'TOGGLE_THEME'],
    color: 'purple'
  },
  {
    id: 'board',
    name: 'Board Controls',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7',
    description: 'Control the kanban board',
    shortcuts: ['NEXT_COLUMN', 'PREV_COLUMN', 'MOVE_TICKET_UP', 'MOVE_TICKET_DOWN', 'SELECT_TICKET', 'OPEN_TICKET', 'CLOSE_TICKET'],
    color: 'orange'
  },
  {
    id: 'agents',
    name: 'Agent Controls',
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    description: 'Control AI agents and sessions',
    shortcuts: ['START_AGENT', 'STOP_AGENT', 'PAUSE_AGENT', 'RESUME_AGENT', 'AGENT_NEXT', 'AGENT_PREV', 'AGENT_EXECUTE'],
    color: 'pink'
  },
  {
    id: 'editing',
    name: 'Editing',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    description: 'Text editing and formatting',
    shortcuts: ['EDIT_MODE', 'BOLD', 'ITALIC', 'CODE', 'LINK', 'CHECKLIST', 'HEADING_1', 'HEADING_2', 'HEADING_3'],
    color: 'cyan'
  },
  {
    id: 'system',
    name: 'System',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    description: 'System-wide shortcuts',
    shortcuts: ['SHOW_SHORTCUTS', 'SHOW_HELP', 'OPEN_SETTINGS', 'OPEN_PROFILE', 'TOGGLE_FULLSCREEN', 'REFRESH', 'LOGOUT'],
    color: 'gray'
  },
  {
    id: 'selection',
    name: 'Selection',
    icon: 'M5 13l4 4L19 7',
    description: 'Select and manage items',
    shortcuts: ['SELECT_ALL', 'DESELECT_ALL', 'INVERT_SELECTION', 'SELECT_NEXT', 'SELECT_PREV', 'CLEAR_SELECTION'],
    color: 'teal'
  }
];

// Default shortcut definitions
export const DEFAULT_SHORTCUTS: Record<string, Omit<KeyboardShortcut, 'action'>> = {
  // Navigation
  ESCAPE: {
    key: 'Escape',
    description: 'Close modals, dialogs, or exit editing mode',
    category: 'navigation',
    priority: 100,
    preventDefault: true
  },
  NAVIGATE_UP: {
    key: 'ArrowUp',
    description: 'Navigate up in lists or grids',
    category: 'navigation',
    priority: 50
  },
  NAVIGATE_DOWN: {
    key: 'ArrowDown',
    description: 'Navigate down in lists or grids',
    category: 'navigation',
    priority: 50
  },
  NAVIGATE_LEFT: {
    key: 'ArrowLeft',
    description: 'Navigate left or go back',
    category: 'navigation',
    priority: 50
  },
  NAVIGATE_RIGHT: {
    key: 'ArrowRight',
    description: 'Navigate right or go forward',
    category: 'navigation',
    priority: 50
  },
  GO_HOME: {
    key: 'h',
    metaKey: true,
    shiftKey: true,
    description: 'Go to home page',
    category: 'navigation',
    priority: 40
  },
  GO_DASHBOARD: {
    key: 'g',
    metaKey: true,
    description: 'Go to dashboard',
    category: 'navigation',
    priority: 40
  },
  GO_BOARD: {
    key: 'b',
    metaKey: true,
    description: 'Go to project board',
    category: 'navigation',
    priority: 40
  },
  GO_SETTINGS: {
    key: ',',
    metaKey: true,
    description: 'Go to settings',
    category: 'navigation',
    priority: 40
  },

  // Actions
  NEW_FEATURE: {
    key: 'f',
    ctrlKey: true,
    metaKey: true,
    description: 'Create new feature',
    category: 'actions',
    priority: 80
  },
  NEW_TICKET: {
    key: 't',
    ctrlKey: true,
    metaKey: true,
    description: 'Create new ticket',
    category: 'actions',
    priority: 80
  },
  NEW_EPIC: {
    key: 'e',
    ctrlKey: true,
    metaKey: true,
    description: 'Create new epic',
    category: 'actions',
    priority: 70
  },
  SAVE: {
    key: 's',
    ctrlKey: true,
    metaKey: true,
    description: 'Save current changes',
    category: 'actions',
    priority: 100,
    preventDefault: true
  },
  UNDO: {
    key: 'z',
    metaKey: true,
    description: 'Undo last action',
    category: 'actions',
    priority: 90
  },
  REDO: {
    key: 'z',
    metaKey: true,
    shiftKey: true,
    description: 'Redo last undone action',
    category: 'actions',
    priority: 90
  },
  DELETE: {
    key: 'Delete',
    description: 'Delete selected item',
    category: 'actions',
    priority: 85,
    preventDefault: true
  },
  DUPLICATE: {
    key: 'd',
    metaKey: true,
    description: 'Duplicate selected item',
    category: 'actions',
    priority: 75
  },

  // Search
  SEARCH: {
    key: '/',
    description: 'Focus search input',
    category: 'search',
    priority: 95,
    preventDefault: true
  },
  ADVANCED_SEARCH: {
    key: 'k',
    ctrlKey: true,
    metaKey: true,
    description: 'Open advanced search',
    category: 'search',
    priority: 90
  },
  TOGGLE_FILTERS: {
    key: 'f',
    description: 'Toggle filters panel',
    category: 'search',
    priority: 70
  },
  CLEAR_FILTERS: {
    key: 'c',
    shiftKey: true,
    description: 'Clear all filters',
    category: 'search',
    priority: 60
  },
  SEARCH_PREV: {
    key: 'g',
    shiftKey: true,
    description: 'Previous search result',
    category: 'search',
    priority: 55
  },
  SEARCH_NEXT: {
    key: 'g',
    description: 'Next search result',
    category: 'search',
    priority: 55
  },

  // Toggles
  TOGGLE_SIDEBAR: {
    key: 'b',
    shiftKey: true,
    description: 'Toggle sidebar',
    category: 'toggles',
    priority: 60
  },
  TOGGLE_SESSIONS: {
    key: 's',
    shiftKey: true,
    description: 'Toggle sessions panel',
    category: 'toggles',
    priority: 60
  },
  TOGGLE_AGENTS: {
    key: 'a',
    shiftKey: true,
    description: 'Toggle agents panel',
    category: 'toggles',
    priority: 60
  },
  TOGGLE_NOTIFICATIONS: {
    key: 'n',
    shiftKey: true,
    description: 'Toggle notifications panel',
    category: 'toggles',
    priority: 60
  },
  TOGGLE_HELP: {
    key: '?',
    shiftKey: true,
    description: 'Toggle help panel',
    category: 'toggles',
    priority: 50
  },
  TOGGLE_THEME: {
    key: 't',
    shiftKey: true,
    description: 'Toggle light/dark theme',
    category: 'toggles',
    priority: 40
  },

  // Board
  NEXT_COLUMN: {
    key: 'ArrowRight',
    altKey: true,
    description: 'Move to next column',
    category: 'board',
    priority: 65
  },
  PREV_COLUMN: {
    key: 'ArrowLeft',
    altKey: true,
    description: 'Move to previous column',
    category: 'board',
    priority: 65
  },
  MOVE_TICKET_UP: {
    key: 'ArrowUp',
    altKey: true,
    description: 'Move ticket up',
    category: 'board',
    priority: 60
  },
  MOVE_TICKET_DOWN: {
    key: 'ArrowDown',
    altKey: true,
    description: 'Move ticket down',
    category: 'board',
    priority: 60
  },
  SELECT_TICKET: {
    key: 'Enter',
    description: 'Select focused ticket',
    category: 'board',
    priority: 70
  },
  OPEN_TICKET: {
    key: 'o',
    description: 'Open selected ticket',
    category: 'board',
    priority: 75
  },
  CLOSE_TICKET: {
    key: 'w',
    description: 'Close current ticket',
    category: 'board',
    priority: 70
  },

  // Agents
  START_AGENT: {
    key: 'r',
    metaKey: true,
    description: 'Start/restart agent',
    category: 'agents',
    priority: 80
  },
  STOP_AGENT: {
    key: '.',
    metaKey: true,
    description: 'Stop agent',
    category: 'agents',
    priority: 80
  },
  PAUSE_AGENT: {
    key: 'p',
    metaKey: true,
    description: 'Pause agent',
    category: 'agents',
    priority: 70
  },
  RESUME_AGENT: {
    key: 'p',
    metaKey: true,
    shiftKey: true,
    description: 'Resume agent',
    category: 'agents',
    priority: 70
  },
  AGENT_NEXT: {
    key: 'j',
    metaKey: true,
    description: 'Next agent message',
    category: 'agents',
    priority: 60
  },
  AGENT_PREV: {
    key: 'k',
    metaKey: true,
    description: 'Previous agent message',
    category: 'agents',
    priority: 60
  },
  AGENT_EXECUTE: {
    key: 'e',
    metaKey: true,
    description: 'Execute agent action',
    category: 'agents',
    priority: 75
  },

  // Editing
  EDIT_MODE: {
    key: 'e',
    description: 'Enter edit mode',
    category: 'editing',
    priority: 70
  },
  BOLD: {
    key: 'b',
    ctrlKey: true,
    metaKey: true,
    description: 'Make text bold',
    category: 'editing',
    priority: 65,
    enabled: false // Only in text inputs
  },
  ITALIC: {
    key: 'i',
    ctrlKey: true,
    metaKey: true,
    description: 'Make text italic',
    category: 'editing',
    priority: 65,
    enabled: false
  },
  CODE: {
    key: 'e',
    shiftKey: true,
    description: 'Insert code block',
    category: 'editing',
    priority: 60
  },
  LINK: {
    key: 'l',
    shiftKey: true,
    description: 'Insert link',
    category: 'editing',
    priority: 60
  },
  CHECKLIST: {
    key: 'x',
    shiftKey: true,
    description: 'Insert checklist item',
    category: 'editing',
    priority: 60
  },
  HEADING_1: {
    key: '1',
    altKey: true,
    description: 'Insert heading 1',
    category: 'editing',
    priority: 55
  },
  HEADING_2: {
    key: '2',
    altKey: true,
    description: 'Insert heading 2',
    category: 'editing',
    priority: 55
  },
  HEADING_3: {
    key: '3',
    altKey: true,
    description: 'Insert heading 3',
    category: 'editing',
    priority: 55
  },

  // System
  SHOW_SHORTCUTS: {
    key: '?',
    description: 'Show keyboard shortcuts',
    category: 'system',
    priority: 95,
    preventDefault: true
  },
  SHOW_HELP: {
    key: 'h',
    metaKey: true,
    description: 'Open help documentation',
    category: 'system',
    priority: 85
  },
  OPEN_SETTINGS: {
    key: ',',
    metaKey: true,
    description: 'Open settings',
    category: 'system',
    priority: 80
  },
  OPEN_PROFILE: {
    key: 'p',
    metaKey: true,
    description: 'Open profile',
    category: 'system',
    priority: 70
  },
  TOGGLE_FULLSCREEN: {
    key: 'f',
    metaKey: true,
    shiftKey: true,
    description: 'Toggle fullscreen',
    category: 'system',
    priority: 50
  },
  REFRESH: {
    key: 'r',
    metaKey: true,
    shiftKey: true,
    description: 'Refresh current view',
    category: 'system',
    priority: 60
  },
  LOGOUT: {
    key: 'q',
    metaKey: true,
    shiftKey: true,
    description: 'Logout',
    category: 'system',
    priority: 90
  },

  // Selection
  SELECT_ALL: {
    key: 'a',
    metaKey: true,
    description: 'Select all items',
    category: 'selection',
    priority: 80
  },
  DESELECT_ALL: {
    key: 'd',
    metaKey: true,
    shiftKey: true,
    description: 'Deselect all items',
    category: 'selection',
    priority: 75
  },
  INVERT_SELECTION: {
    key: 'i',
    metaKey: true,
    shiftKey: true,
    description: 'Invert selection',
    category: 'selection',
    priority: 70
  },
  SELECT_NEXT: {
    key: 'n',
    description: 'Select next item',
    category: 'selection',
    priority: 65
  },
  SELECT_PREV: {
    key: 'p',
    description: 'Select previous item',
    category: 'selection',
    priority: 65
  },
  CLEAR_SELECTION: {
    key: 'Escape',
    shiftKey: true,
    description: 'Clear selection',
    category: 'selection',
    priority: 75
  }
};

// Custom storage for user shortcuts
const CUSTOM_SHORTCUTS_STORAGE_KEY = 'ai-jam:custom-shortcuts';
const DISMISSED_SHORTCUTS_KEY = 'ai-jam:dismissed-shortcuts';

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: {
    enabled?: boolean;
    conflictDetection?: boolean;
    learningMode?: boolean;
  } = {}
) {
  const {
    enabled = true,
    conflictDetection = true,
    learningMode = false
  } = options;

  const [customShortcuts, setCustomShortcuts] = useState<Record<string, Partial<KeyboardShortcut>>>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_SHORTCUTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [dismissedShortcuts, setDismissedShortcuts] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_SHORTCUTS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [conflicts, setConflicts] = useState<ShortcutConflict[]>([]);
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const activeShortcutTimeout = useRef<NodeJS.Timeout>();

  // Apply custom shortcuts
  const effectiveShortcuts = useMemo(() => {
    return shortcuts.map(shortcut => {
      const custom = customShortcuts[Object.keys(DEFAULT_SHORTCUTS).find(
        key => JSON.stringify(DEFAULT_SHORTCUTS[key]) === JSON.stringify(shortcut)
      ) || ''];

      if (custom) {
        return { ...shortcut, ...custom };
      }
      return shortcut;
    });
  }, [shortcuts, customShortcuts]);

  // Detect conflicts
  useEffect(() => {
    if (!conflictDetection) return;

    const detectedConflicts: ShortcutConflict[] = [];
    const shortcutMap = new Map<string, KeyboardShortcut[]>();

    effectiveShortcuts.forEach(shortcut => {
      if (!shortcut.enabled) return;

      const key = getShortcutKey(shortcut);
      if (!shortcutMap.has(key)) {
        shortcutMap.set(key, []);
      }
      shortcutMap.get(key)!.push(shortcut);
    });

    shortcutMap.forEach((shortcutsWithSameKey, key) => {
      if (shortcutsWithSameKey.length > 1) {
        detectedConflicts.push({
          shortcut: key,
          conflicts: shortcutsWithSameKey.map(s => ({
            key: s.key,
            description: s.description,
            category: s.category
          }))
        });
      }
    });

    setConflicts(detectedConflicts);
  }, [effectiveShortcuts, conflictDetection]);

  // Main keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Check if we should ignore keyboard events
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        // Only process editing shortcuts in text inputs
        const editingShortcuts = effectiveShortcuts.filter(
          s => s.category === 'editing' && s.enabled !== false
        );

        for (const shortcut of editingShortcuts.sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
          if (matchesShortcut(e, shortcut)) {
            if (shortcut.preventDefault !== false) {
              e.preventDefault();
            }
            shortcut.action();
            setActiveShortcut(shortcut.key);
            showActiveShortcutFeedback(shortcut);
            break;
          }
        }
        return;
      }

      // Process all other shortcuts
      for (const shortcut of effectiveShortcuts.sort((a, b) => (b.priority || 0) - (a.priority || 0))) {
        if (shortcut.enabled === false) continue;

        if (matchesShortcut(e, shortcut)) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.action();
          setActiveShortcut(shortcut.key);
          showActiveShortcutFeedback(shortcut);
          break;
        }
      }
    };

    const handleKeyUp = () => {
      setActiveShortcut(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (activeShortcutTimeout.current) {
        clearTimeout(activeShortcutTimeout.current);
      }
    };
  }, [effectiveShortcuts, enabled]);

  const showActiveShortcutFeedback = (shortcut: KeyboardShortcut) => {
    // Visual feedback could be added here
    if (activeShortcutTimeout.current) {
      clearTimeout(activeShortcutTimeout.current);
    }
    activeShortcutTimeout.current = setTimeout(() => {
      setActiveShortcut(null);
    }, 200);
  };

  // Custom shortcut management
  const updateShortcut = useCallback((key: string, newShortcut: Partial<KeyboardShortcut>) => {
    setCustomShortcuts(prev => {
      const updated = { ...prev, [key]: newShortcut };
      localStorage.setItem(CUSTOM_SHORTCUTS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetShortcut = useCallback((key: string) => {
    setCustomShortcuts(prev => {
      const updated = { ...prev };
      delete updated[key];
      localStorage.setItem(CUSTOM_SHORTCUTS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetAllShortcuts = useCallback(() => {
    setCustomShortcuts({});
    localStorage.removeItem(CUSTOM_SHORTCUTS_STORAGE_KEY);
  }, []);

  // Dismissed shortcuts management
  const dismissShortcut = useCallback((key: string) => {
    setDismissedShortcuts(prev => {
      const updated = new Set(prev);
      updated.add(key);
      localStorage.setItem(DISMISSED_SHORTCUTS_KEY, JSON.stringify([...updated]));
      return updated;
    });
  }, []);

  const restoreShortcut = useCallback((key: string) => {
    setDismissedShortcuts(prev => {
      const updated = new Set(prev);
      updated.delete(key);
      localStorage.setItem(DISMISSED_SHORTCUTS_KEY, JSON.stringify([...updated]));
      return updated;
    });
  }, []);

  return {
    shortcuts: effectiveShortcuts,
    customShortcuts,
    conflicts,
    activeShortcut,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    dismissShortcut,
    restoreShortcut,
    dismissedShortcuts
  };
}

// Helper functions
function getShortcutKey(shortcut: Partial<KeyboardShortcut>): string {
  const parts: string[] = [];
  if (shortcut.ctrlKey) parts.push('ctrl');
  if (shortcut.metaKey) parts.push('meta');
  if (shortcut.shiftKey) parts.push('shift');
  if (shortcut.altKey) parts.push('alt');
  parts.push(shortcut.key?.toLowerCase() || '');
  return parts.join('+');
}

function matchesShortcut(event: KeyboardEvent, shortcut: Partial<KeyboardShortcut>): boolean {
  const keyMatches = event.key.toLowerCase() === shortcut.key?.toLowerCase();
  const ctrlMatches = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
  const metaMatches = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;
  const shiftMatches = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
  const altMatches = shortcut.altKey === undefined || event.altKey === shortcut.altKey;

  return keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches;
}

export function formatShortcut(shortcut: Partial<KeyboardShortcut>): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push('Cmd');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');

  if (shortcut.key) {
    parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  }

  return parts.join(' + ');
}

export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push('Cmd');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');

  if (shortcut.key) {
    if (shortcut.key.length === 1) {
      parts.push(shortcut.key.toUpperCase());
    } else if (shortcut.key === 'Escape') {
      parts.push('Esc');
    } else if (shortcut.key === 'ArrowUp') {
      parts.push('↑');
    } else if (shortcut.key === 'ArrowDown') {
      parts.push('↓');
    } else if (shortcut.key === 'ArrowLeft') {
      parts.push('←');
    } else if (shortcut.key === 'ArrowRight') {
      parts.push('→');
    } else {
      parts.push(shortcut.key);
    }
  }

  return parts.join(' + ');
}

export function searchShortcuts(
  shortcuts: KeyboardShortcut[],
  query: string
): KeyboardShortcut[] {
  const lowerQuery = query.toLowerCase();

  return shortcuts.filter(shortcut => {
    return (
      shortcut.description.toLowerCase().includes(lowerQuery) ||
      shortcut.key.toLowerCase().includes(lowerQuery) ||
      shortcut.category.toLowerCase().includes(lowerQuery) ||
      formatShortcut(shortcut).toLowerCase().includes(lowerQuery)
    );
  });
}

export function getShortcutsByCategory(
  shortcuts: KeyboardShortcut[],
  categoryId: string
): KeyboardShortcut[] {
  return shortcuts.filter(shortcut => shortcut.category === categoryId);
}

export function getMostUsedShortcuts(
  shortcuts: KeyboardShortcut[],
  limit: number = 10
): KeyboardShortcut[] {
  return shortcuts
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, limit);
}

export function validateShortcut(
  shortcut: Partial<KeyboardShortcut>,
  existingShortcuts: KeyboardShortcut[]
): { valid: boolean; conflicts?: KeyboardShortcut[] } {
  const conflicts: KeyboardShortcut[] = [];

  for (const existing of existingShortcuts) {
    if (existing.enabled === false) continue;

    const sameKey = shortcut.key?.toLowerCase() === existing.key?.toLowerCase();
    const sameCtrl = shortcut.ctrlKey === existing.ctrlKey;
    const sameMeta = shortcut.metaKey === existing.metaKey;
    const sameShift = shortcut.shiftKey === existing.shiftKey;
    const sameAlt = shortcut.altKey === existing.altKey;

    if (sameKey && sameCtrl && sameMeta && sameShift && sameAlt) {
      conflicts.push(existing);
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts: conflicts.length > 0 ? conflicts : undefined
  };
}

export function exportShortcuts(customShortcuts: Record<string, Partial<KeyboardShortcut>>): string {
  return JSON.stringify(customShortcuts, null, 2);
}

export function importShortcuts(
  jsonString: string
): Record<string, Partial<KeyboardShortcut>> | null {
  try {
    const imported = JSON.parse(jsonString);
    // Basic validation
    if (typeof imported !== 'object' || imported === null) {
      return null;
    }
    return imported;
  } catch {
    return null;
  }
}

// Hook for learning mode
export function useShortcutLearningMode(enabled: boolean = false) {
  const [learningMode, setLearningMode] = useState<ShortcutLearningMode>({
    enabled,
    dismissed: new Set()
  });

  useEffect(() => {
    setLearningMode(prev => ({ ...prev, enabled }));
  }, [enabled]);

  const toggleLearningMode = useCallback(() => {
    setLearningMode(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const dismissTip = useCallback((key: string) => {
    setLearningMode(prev => {
      const dismissed = new Set(prev.dismissed);
      dismissed.add(key);
      return { ...prev, dismissed };
    });
  }, []);

  const showAvailableShortcuts = useCallback((element: HTMLElement, shortcuts: KeyboardShortcut[]) => {
    setLearningMode(prev => ({
      ...prev,
      activeElement: element,
      availableShortcuts: shortcuts
    }));
  }, []);

  const hideAvailableShortcuts = useCallback(() => {
    setLearningMode(prev => ({
      ...prev,
      activeElement: undefined,
      availableShortcuts: []
    }));
  }, []);

  return {
    learningMode,
    toggleLearningMode,
    dismissTip,
    showAvailableShortcuts,
    hideAvailableShortcuts
  };
}
