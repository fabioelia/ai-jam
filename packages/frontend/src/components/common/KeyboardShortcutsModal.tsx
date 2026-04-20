import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  getShortcutDisplay,
  searchShortcuts,
  getShortcutsByCategory,
  SHORTCUT_CATEGORIES,
  validateShortcut,
  KeyboardShortcut,
  ShortcutCategory
} from '../hooks/useKeyboardShortcuts.js';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
  customShortcuts?: Record<string, Partial<KeyboardShortcut>>;
  onUpdateShortcut?: (key: string, shortcut: Partial<KeyboardShortcut>) => void;
  onResetShortcut?: (key: string) => void;
  enableRecording?: boolean;
  enableSearch?: boolean;
  enableLearningMode?: boolean;
  learningModeActive?: boolean;
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
  shortcuts,
  customShortcuts = {},
  onUpdateShortcut,
  onResetShortcut,
  enableRecording = true,
  enableSearch = true,
  enableLearningMode = true,
  learningModeActive = false
}: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recordingShortcut, setRecordingShortcut] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<KeyboardEvent | null>(null);
  const [showConflicts, setShowConflicts] = useState(true);
  const [showLearningMode, setShowLearningMode] = useState(learningModeActive);
  const [activeTab, setActiveTab] = useState<'all' | 'custom' | 'conflicts' | 'learning'>('all');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter shortcuts based on search and category
  const filteredShortcuts = useMemo(() => {
    let filtered = shortcuts;

    if (selectedCategory !== 'all') {
      filtered = getShortcutsByCategory(filtered, selectedCategory);
    }

    if (searchQuery) {
      filtered = searchShortcuts(filtered, searchQuery);
    }

    return filtered;
  }, [shortcuts, selectedCategory, searchQuery]);

  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};

    filteredShortcuts.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });

    return groups;
  }, [filteredShortcuts]);

  // Detect conflicts
  const conflicts = useMemo(() => {
    const detectedConflicts: Array<{
      shortcutKey: string;
      conflicts: KeyboardShortcut[];
    }> = [];

    const shortcutMap = new Map<string, KeyboardShortcut[]>();

    shortcuts.forEach(shortcut => {
      if (shortcut.enabled === false) return;

      const key = `${shortcut.ctrlKey ? 'ctrl+' : ''}${shortcut.metaKey ? 'meta+' : ''}${shortcut.shiftKey ? 'shift+' : ''}${shortcut.altKey ? 'alt+' : ''}${shortcut.key.toLowerCase()}`;

      if (!shortcutMap.has(key)) {
        shortcutMap.set(key, []);
      }
      shortcutMap.get(key)!.push(shortcut);
    });

    shortcutMap.forEach((shortcutsWithSameKey, key) => {
      if (shortcutsWithSameKey.length > 1) {
        detectedConflicts.push({
          shortcutKey: key,
          conflicts: shortcutsWithSameKey
        });
      }
    });

    return detectedConflicts;
  }, [shortcuts]);

  // Custom shortcuts
  const customShortcutsList = useMemo(() => {
    return shortcuts.filter(shortcut => {
      const shortcutKey = Object.keys(customShortcuts).find(
        key => key === shortcut.key
      );
      return shortcutKey !== undefined;
    });
  }, [shortcuts, customShortcuts]);

  // Keyboard recording
  useEffect(() => {
    if (!recordingShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't record modifier keys alone
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) {
        return;
      }

      setRecordedKeys(e);
    };

    const handleKeyUp = () => {
      // Recording complete on keyup
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [recordingShortcut]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && enableSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, enableSearch]);

  const startRecording = useCallback((shortcutKey: string) => {
    if (!enableRecording) return;
    setRecordingShortcut(shortcutKey);
    setRecordedKeys(null);
  }, [enableRecording]);

  const saveRecordedShortcut = useCallback(() => {
    if (!recordingShortcut || !recordedKeys || !onUpdateShortcut) return;

    const newShortcut: Partial<KeyboardShortcut> = {
      key: recordedKeys.key,
      ctrlKey: recordedKeys.ctrlKey,
      metaKey: recordedKeys.metaKey,
      shiftKey: recordedKeys.shiftKey,
      altKey: recordedKeys.altKey
    };

    // Validate against existing shortcuts
    const validation = validateShortcut(newShortcut, shortcuts);

    if (validation.valid) {
      onUpdateShortcut(recordingShortcut, newShortcut);
      setRecordingShortcut(null);
      setRecordedKeys(null);
    } else if (validation.conflicts && validation.conflicts.length > 0) {
      // Show conflict warning
      const confirmOverride = window.confirm(
        `This shortcut conflicts with:\n${validation.conflicts.map(c => `- ${c.description}`).join('\n')}\n\nDo you want to override it?`
      );

      if (confirmOverride) {
        onUpdateShortcut(recordingShortcut, newShortcut);
        setRecordingShortcut(null);
        setRecordedKeys(null);
      }
    }
  }, [recordingShortcut, recordedKeys, onUpdateShortcut, shortcuts]);

  const cancelRecording = useCallback(() => {
    setRecordingShortcut(null);
    setRecordedKeys(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Close on Escape
    if (e.key === 'Escape' && !recordingShortcut) {
      e.preventDefault();
      onClose();
    }

    // Navigate tabs with arrow keys
    if (!recordingShortcut && !searchQuery) {
      const tabs: Array<'all' | 'custom' | 'conflicts' | 'learning'> = ['all', 'custom', 'conflicts', 'learning'];
      const currentIndex = tabs.indexOf(activeTab);

      if (e.key === 'ArrowRight' && currentIndex < tabs.length - 1) {
        e.preventDefault();
        setActiveTab(tabs[currentIndex + 1]);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setActiveTab(tabs[currentIndex - 1]);
      }
    }
  }, [recordingShortcut, searchQuery, activeTab, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-all duration-200"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              All Shortcuts
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'custom'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              Custom ({customShortcutsList.length})
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'conflicts'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              Conflicts ({conflicts.length})
            </button>
            {enableLearningMode && (
              <button
                onClick={() => setActiveTab('learning')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'learning'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                Learning Mode
              </button>
            )}
          </div>

          {/* Search */}
          {enableSearch && activeTab !== 'learning' && (
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search shortcuts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 pl-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'all' && (
            <AllShortcutsTab
              shortcuts={groupedShortcuts}
              categories={SHORTCUT_CATEGORIES}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              customShortcuts={customShortcuts}
              recordingShortcut={recordingShortcut}
              recordedKeys={recordedKeys}
              onStartRecording={startRecording}
              onSaveShortcut={saveRecordedShortcut}
              onCancelRecording={cancelRecording}
              onResetShortcut={onResetShortcut}
              enableRecording={enableRecording}
            />
          )}

          {activeTab === 'custom' && (
            <CustomShortcutsTab
              shortcuts={customShortcutsList}
              customShortcuts={customShortcuts}
              recordingShortcut={recordingShortcut}
              recordedKeys={recordedKeys}
              onStartRecording={startRecording}
              onSaveShortcut={saveRecordedShortcut}
              onCancelRecording={cancelRecording}
              onResetShortcut={onResetShortcut}
              enableRecording={enableRecording}
            />
          )}

          {activeTab === 'conflicts' && (
            <ConflictsTab
              conflicts={conflicts}
              shortcuts={shortcuts}
              onUpdateShortcut={onUpdateShortcut}
              onResetShortcut={onResetShortcut}
            />
          )}

          {activeTab === 'learning' && enableLearningMode && (
            <LearningModeTab
              shortcuts={shortcuts}
              categories={SHORTCUT_CATEGORIES}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">Esc</kbd> to close</span>
              <span>Use <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">/</kbd> to search</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{filteredShortcuts.length} shortcuts</span>
              {conflicts.length > 0 && (
                <span className="text-red-400">{conflicts.length} conflict{conflicts.length > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- All Shortcuts Tab ----

interface AllShortcutsTabProps {
  shortcuts: Record<string, KeyboardShortcut[]>;
  categories: ShortcutCategory[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  customShortcuts: Record<string, Partial<KeyboardShortcut>>;
  recordingShortcut: string | null;
  recordedKeys: KeyboardEvent | null;
  onStartRecording: (key: string) => void;
  onSaveShortcut: () => void;
  onCancelRecording: () => void;
  onResetShortcut?: (key: string) => void;
  enableRecording: boolean;
}

function AllShortcutsTab({
  shortcuts,
  categories,
  selectedCategory,
  onCategoryChange,
  customShortcuts,
  recordingShortcut,
  recordedKeys,
  onStartRecording,
  onSaveShortcut,
  onCancelRecording,
  onResetShortcut,
  enableRecording
}: AllShortcutsTabProps) {
  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            selectedCategory === 'all'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          All Categories
        </button>
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              selectedCategory === category.id
                ? `bg-${category.color}-600 text-white`
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Shortcut Groups */}
      <div className="space-y-6">
        {Object.entries(shortcuts).map(([category, categoryShortcuts]) => {
          const categoryInfo = categories.find(c => c.id === category);
          return (
            <div key={category} className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                {categoryInfo?.icon && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryInfo.icon} />
                  </svg>
                )}
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  {categoryInfo?.name || category}
                </h3>
                {categoryInfo?.description && (
                  <span className="text-xs text-gray-500">- {categoryInfo.description}</span>
                )}
              </div>

              <div className="space-y-2">
                {categoryShortcuts.map((shortcut) => (
                  <ShortcutRow
                    key={shortcut.key}
                    shortcut={shortcut}
                    isCustom={customShortcuts[shortcut.key] !== undefined}
                    isRecording={recordingShortcut === shortcut.key}
                    recordedKeys={recordedKeys}
                    onStartRecording={startRecording}
                    onSaveShortcut={onSaveShortcut}
                    onCancelRecording={onCancelRecording}
                    onResetShortcut={onResetShortcut}
                    enableRecording={enableRecording}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Custom Shortcuts Tab ----

interface CustomShortcutsTabProps {
  shortcuts: KeyboardShortcut[];
  customShortcuts: Record<string, Partial<KeyboardShortcut>>;
  recordingShortcut: string | null;
  recordedKeys: KeyboardEvent | null;
  onStartRecording: (key: string) => void;
  onSaveShortcut: () => void;
  onCancelRecording: () => void;
  onResetShortcut?: (key: string) => void;
  enableRecording: boolean;
}

function CustomShortcutsTab({
  shortcuts,
  customShortcuts,
  recordingShortcut,
  recordedKeys,
  onStartRecording,
  onSaveShortcut,
  onCancelRecording,
  onResetShortcut,
  enableRecording
}: CustomShortcutsTabProps) {
  if (shortcuts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <p className="text-lg font-medium mb-2">No custom shortcuts</p>
        <p className="text-sm">Customize shortcuts in the "All Shortcuts" tab</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shortcuts.map((shortcut) => (
        <ShortcutRow
          key={shortcut.key}
          shortcut={shortcut}
          isCustom={true}
          isRecording={recordingShortcut === shortcut.key}
          recordedKeys={recordedKeys}
          onStartRecording={startRecording}
          onSaveShortcut={onSaveShortcut}
          onCancelRecording={onCancelRecording}
          onResetShortcut={onResetShortcut}
          enableRecording={enableRecording}
        />
      ))}
    </div>
  );
}

// ---- Conflicts Tab ----

interface ConflictsTabProps {
  conflicts: Array<{
    shortcutKey: string;
    conflicts: KeyboardShortcut[];
  }>;
  shortcuts: KeyboardShortcut[];
  onUpdateShortcut?: (key: string, shortcut: Partial<KeyboardShortcut>) => void;
  onResetShortcut?: (key: string) => void;
}

function ConflictsTab({ conflicts, shortcuts, onUpdateShortcut, onResetShortcut }: ConflictsTabProps) {
  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-green-500">
        <svg className="w-12 h-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg font-medium mb-2">No conflicts detected</p>
        <p className="text-sm">All shortcuts are unique and properly configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="text-red-400 font-medium mb-1">Shortcut Conflicts Detected</h4>
            <p className="text-sm text-gray-400">
              {conflicts.length} shortcut{conflicts.length > 1 ? 's have' : ' has'} conflicting key bindings.
              {onResetShortcut && ' Click "Reset" to restore default shortcuts.'}
            </p>
          </div>
        </div>
      </div>

      {conflicts.map((conflict, idx) => (
        <div key={idx} className="bg-gray-800/50 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-mono font-medium">
              {conflict.shortcutKey}
            </span>
            <span className="text-sm text-red-400">Conflict</span>
          </div>

          <div className="space-y-2">
            {conflict.conflicts.map((shortcut, shortcutIdx) => (
              <div key={shortcutIdx} className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm text-white">{shortcut.description}</p>
                  <p className="text-xs text-gray-500">{shortcut.category}</p>
                </div>
                {onResetShortcut && (
                  <button
                    onClick={() => onResetShortcut(shortcut.key)}
                    className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Learning Mode Tab ----

interface LearningModeTabProps {
  shortcuts: KeyboardShortcut[];
  categories: ShortcutCategory[];
}

function LearningModeTab({ shortcuts, categories }: LearningModeTabProps) {
  const [currentCategory, setCurrentCategory] = useState(0);
  const [currentShortcut, setCurrentShortcut] = useState(0);

  const categoryShortcuts = useMemo(() => {
    const category = categories[currentCategory];
    return shortcuts.filter(s => s.category === category.id);
  }, [currentCategory, shortcuts, categories]);

  const nextShortcut = () => {
    if (currentShortcut < categoryShortcuts.length - 1) {
      setCurrentShortcut(currentShortcut + 1);
    } else if (currentCategory < categories.length - 1) {
      setCurrentCategory(currentCategory + 1);
      setCurrentShortcut(0);
    } else {
      setCurrentCategory(0);
      setCurrentShortcut(0);
    }
  };

  const prevShortcut = () => {
    if (currentShortcut > 0) {
      setCurrentShortcut(currentShortcut - 1);
    } else if (currentCategory > 0) {
      setCurrentCategory(currentCategory - 1);
      setCurrentShortcut(categories[currentCategory - 1].shortcuts.length - 1);
    } else {
      setCurrentCategory(categories.length - 1);
      setCurrentShortcut(categories[categories.length - 1].shortcuts.length - 1);
    }
  };

  const currentShortcutData = categoryShortcuts[currentShortcut];
  const progress = ((currentCategory * 10 + currentShortcut + 1) / shortcuts.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-xl font-bold text-white">Learning Mode</h3>
        </div>
        <p className="text-gray-400 text-sm">
          Master keyboard shortcuts one at a time. Press arrow keys to navigate.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Shortcut Card */}
      {currentShortcutData && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-medium mb-4">
              {categories[currentCategory].name}
            </div>

            <h4 className="text-2xl font-bold text-white mb-6">
              {currentShortcutData.description}
            </h4>

            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-2 p-4 bg-gray-950 rounded-xl border border-gray-700">
                {currentShortcutData.ctrlKey && (
                  <kbd className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono font-bold">
                    Ctrl
                  </kbd>
                )}
                {currentShortcutData.metaKey && (
                  <kbd className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono font-bold">
                    Cmd
                  </kbd>
                )}
                {currentShortcutData.shiftKey && (
                  <kbd className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono font-bold">
                    Shift
                  </kbd>
                )}
                {currentShortcutData.altKey && (
                  <kbd className="px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono font-bold">
                    Alt
                  </kbd>
                )}
                <kbd className="px-3 py-2 bg-indigo-600 border border-indigo-500 rounded-lg text-white font-mono font-bold">
                  {currentShortcutData.key.length === 1
                    ? currentShortcutData.key.toUpperCase()
                    : currentShortcutData.key}
                </kbd>
              </div>
            </div>

            {/* Category Info */}
            {categories[currentCategory].description && (
              <p className="text-sm text-gray-400 mb-6">
                {categories[currentCategory].description}
              </p>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={prevShortcut}
                className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-white font-medium transition-all hover:shadow-lg hover:shadow-gray-900/10 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <div className="text-gray-500 text-sm">
                {currentShortcut + 1} / {categoryShortcuts.length}
              </div>
              <button
                onClick={nextShortcut}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
              >
                Next
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Hints */}
      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">→</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Esc</kbd>
            Exit
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- Shortcut Row Component ----

interface ShortcutRowProps {
  shortcut: KeyboardShortcut;
  isCustom?: boolean;
  isRecording?: boolean;
  recordedKeys?: KeyboardEvent | null;
  onStartRecording?: (key: string) => void;
  onSaveShortcut?: () => void;
  onCancelRecording?: () => void;
  onResetShortcut?: (key: string) => void;
  enableRecording?: boolean;
}

function ShortcutRow({
  shortcut,
  isCustom = false,
  isRecording = false,
  recordedKeys = null,
  onStartRecording,
  onSaveShortcut,
  onCancelRecording,
  onResetShortcut,
  enableRecording = true
}: ShortcutRowProps) {
  const displayShortcut = isRecording && recordedKeys
    ? {
        key: recordedKeys.key,
        ctrlKey: recordedKeys.ctrlKey,
        metaKey: recordedKeys.metaKey,
        shiftKey: recordedKeys.shiftKey,
        altKey: recordedKeys.altKey
      }
    : shortcut;

  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${
      isRecording ? 'bg-indigo-500/20 border border-indigo-500/30' : 'hover:bg-gray-800/50'
    }`}>
      <div className="flex items-center gap-3 flex-1">
        {isRecording && (
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
        <span className="text-sm text-gray-300 flex-1">{shortcut.description}</span>
        {isCustom && (
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
            Custom
          </span>
        )}
        {shortcut.priority && shortcut.priority > 80 && (
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
            Frequent
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isRecording ? (
          <div className="flex items-center gap-2">
            <ShortcutKeys shortcut={displayShortcut} animate />
            <button
              onClick={onSaveShortcut}
              className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded font-medium transition-all hover:shadow-lg hover:shadow-green-500/20 active:scale-95"
            >
              Save
            </button>
            <button
              onClick={onCancelRecording}
              className="text-xs text-gray-400 hover:text-gray-300 px-2 py-1.5 rounded hover:bg-gray-700 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <ShortcutKeys shortcut={shortcut} />
            {enableRecording && onStartRecording && (
              <button
                onClick={() => onStartRecording(shortcut.key)}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-all"
              >
                Change
              </button>
            )}
            {isCustom && onResetShortcut && (
              <button
                onClick={() => onResetShortcut(shortcut.key)}
                className="text-xs text-gray-500 hover:text-gray-400 px-2 py-1 rounded hover:bg-gray-700 transition-all"
              >
                Reset
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Shortcut Keys Component ----

function ShortcutKeys({ shortcut, animate = false }: { shortcut: Partial<KeyboardShortcut>; animate?: boolean }) {
  const parts: { key: string; isModifier: boolean }[] = [];

  if (shortcut.ctrlKey) parts.push({ key: 'Ctrl', isModifier: true });
  if (shortcut.metaKey) parts.push({ key: 'Cmd', isModifier: true });
  if (shortcut.altKey) parts.push({ key: 'Alt', isModifier: true });
  if (shortcut.shiftKey) parts.push({ key: 'Shift', isModifier: true });

  if (shortcut.key) {
    parts.push({
      key: shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
      isModifier: false
    });
  }

  return (
    <div className="flex gap-1">
      {parts.map((part, idx) => (
        <kbd
          key={idx}
          className={`text-xs font-mono px-2 py-1 rounded transition-all ${
            part.isModifier
              ? 'text-gray-400 bg-gray-800 border border-gray-700'
              : 'text-white bg-gray-800 border border-gray-700'
          } ${animate ? 'animate-pulse border-indigo-500 bg-indigo-500/10' : ''}`}
        >
          {part.key}
        </kbd>
      ))}
      {parts.length > 1 && (
        <span className="text-xs text-gray-500 self-center">+</span>
      )}
    </div>
  );
}

// ---- Exported Components ----

export function ShortcutKey({ keys }: { keys: string[] }) {
  return (
    <div className="flex gap-1">
      {keys.map((key, idx) => (
        <kbd
          key={idx}
          className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2 py-1 rounded font-mono"
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}

export function ShortcutRow({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-300">{description description}</span>
      <ShortcutKey keys={keys} />
    </div>
  );
}

// ---- Keyboard Shortcut Reference Panel ----

interface KeyboardShortcutReferencePanelProps {
  shortcuts: KeyboardShortcut[];
  categories?: ShortcutCategory[];
  maxShortcuts?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onClose?: () => void;
}

export function KeyboardShortcutReferencePanel({
  shortcuts,
  categories = SHORTCUT_CATEGORIES,
  maxShortcuts = 8,
  position = 'bottom-right',
  onClose
}: KeyboardShortcutReferencePanelProps) {
  const mostUsed = shortcuts
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, maxShortcuts);

  const positionClasses = {
    'top': 'top-4 right-4',
    'bottom': 'bottom-4 right-4',
    'left': 'top-4 left-4',
    'right': 'top-4 right-4'
  };

  return (
    <div className={`fixed ${positionClasses[position]} bg-gray-900/95 backdrop-blur border border-gray-700 rounded-xl shadow-2xl p-4 z-40 max-w-sm animate-in slide-in-from-top-2 duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white">Quick Reference</h4>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-2">
        {mostUsed.map((shortcut) => (
          <div key={shortcut.key} className="flex items-center justify-between py-1">
            <span className="text-xs text-gray-400 flex-1 truncate pr-2">{shortcut.description}</span>
            <ShortcutKeys shortcut={shortcut} />
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800 text-center">
        <span className="text-xs text-gray-500">Press ? for all shortcuts</span>
      </div>
    </div>
  );
}
