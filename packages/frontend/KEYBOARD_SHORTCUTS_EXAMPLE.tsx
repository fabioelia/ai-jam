/**
 * Example integration of the enhanced keyboard shortcuts system
 *
 * This file demonstrates how to integrate all the keyboard shortcut features
 * into a main application component.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useKeyboardShortcuts,
  DEFAULT_SHORTCUTS,
  exportShortcuts,
  importShortcuts,
  KeyboardShortcut
} from './hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from './components/common/KeyboardShortcutsModal';
import {
  ShortcutReferencePanel,
  ShortcutTooltip,
  ShortcutBadge,
  LearningModeIndicator,
  ShortcutSuggestion
} from './components/common/ShortcutReferencePanel';

/**
 * Main application component with comprehensive keyboard shortcuts integration
 */
function AppWithKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showReferencePanel, setShowReferencePanel] = useState(true);
  const [learningMode, setLearningMode] = useState(false);
  const [activeShortcut, setActiveShortcut] = useState<KeyboardShortcut | undefined>();

  // Define application-specific shortcuts
  const appShortcuts = useMemo(() => {
    const shortcuts: KeyboardShortcut[] = [
      // Navigation shortcuts
      {
        ...DEFAULT_SHORTCUTS.GO_HOME,
        action: () => navigate('/')
      },
      {
        ...DEFAULT_SHORTCUTS.GO_DASHBOARD,
        action: () => navigate('/dashboard')
      },
      {
        ...DEFAULT_SHORTCUTS.GO_BOARD,
        action: () => navigate('/board')
      },
      {
        ...DEFAULT_SHORTCUTS.GO_SETTINGS,
        action: () => navigate('/settings')
      },

      // Action shortcuts
      {
        ...DEFAULT_SHORTCUTS.NEW_FEATURE,
        action: () => {
          // Create new feature logic
          console.log('Creating new feature');
        }
      },
      {
        ...DEFAULT_SHORTCUTS.NEW_TICKET,
        action: () => {
          // Create new ticket logic
          console.log('Creating new ticket');
        }
      },

      // System shortcuts
      {
        ...DEFAULT_SHORTCUTS.SHOW_SHORTCUTS,
        action: () => setShowShortcutsModal(true)
      },
      {
        ...DEFAULT_SHORTCUTS.SHOW_HELP,
        action: () => {
          // Show help documentation
          console.log('Showing help');
        }
      },

      // Custom application shortcuts
      {
        key: 'r',
        metaKey: true,
        description: 'Refresh current view',
        category: 'system',
        action: () => {
          window.location.reload();
        },
        priority: 90
      }
    ];

    return shortcuts;
  }, [navigate]);

  // Initialize keyboard shortcuts with full features
  const {
    shortcuts: effectiveShortcuts,
    customShortcuts,
    conflicts,
    activeShortcut: currentActiveShortcut,
    updateShortcut,
    resetShortcut,
    resetAllShortcuts,
    dismissShortcut,
    dismissedShortcuts
  } = useKeyboardShortcuts(appShortcuts, {
    enabled: true,
    conflictDetection: true,
    learningMode: learningMode
  });

  // Handle shortcut customization
  const handleUpdateShortcut = useCallback((key: string, newShortcut: Partial<KeyboardShortcut>) => {
    updateShortcut(key, newShortcut);
  }, [updateShortcut]);

  const handleResetShortcut = useCallback((key: string) => {
    resetShortcut(key);
  }, [resetShortcut]);

  // Export/import custom shortcuts
  const handleExportShortcuts = useCallback(() => {
    const exported = exportShortcuts(customShortcuts);
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keyboard-shortcuts.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [customShortcuts]);

  const handleImportShortcuts = useCallback((jsonString: string) => {
    const imported = importShortcuts(jsonString);
    if (imported) {
      Object.entries(imported).forEach(([key, shortcut]) => {
        updateShortcut(key, shortcut);
      });
    }
  }, [updateShortcut]);

  // Track active shortcut for learning mode
  const handleShortcutActivation = useCallback((shortcut: KeyboardShortcut) => {
    setActiveShortcut(shortcut);
  }, []);

  return (
    <>
      {/* Main application content */}
      <div className="min-h-screen bg-gray-900">
        {/* Application header with shortcut hints */}
        <header className="border-b border-gray-800">
          <nav className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <ShortcutTooltip shortcut={DEFAULT_SHORTCUTS.GO_HOME}>
                <button onClick={() => navigate('/')}>Home</button>
              </ShortcutTooltip>
              <ShortcutTooltip shortcut={DEFAULT_SHORTCUTS.GO_DASHBOARD}>
                <button onClick={() => navigate('/dashboard')}>Dashboard</button>
              </ShortcutTooltip>
              <ShortcutTooltip shortcut={DEFAULT_SHORTCUTS.GO_BOARD}>
                <button onClick={() => navigate('/board')}>Board</button>
              </ShortcutTooltip>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => setShowShortcutsModal(true)}>
                <ShortcutBadge shortcut={DEFAULT_SHORTCUTS.SHOW_SHORTCUTS} />
              </button>
            </div>
          </nav>
        </header>

        {/* Main content area */}
        <main className="container mx-auto px-6 py-8">
          {/* Learning mode suggestions */}
          {learningMode && !dismissedShortcuts.has('NEW_FEATURE') && (
            <ShortcutSuggestion
              shortcut={DEFAULT_SHORTCUTS.NEW_FEATURE}
              context="You frequently create features."
              onEnable={() => {
                console.log('Learning NEW_FEATURE shortcut');
                handleShortcutActivation(DEFAULT_SHORTCUTS.NEW_FEATURE);
              }}
              onDismiss={() => dismissShortcut('NEW_FEATURE')}
            />
          )}

          {/* Example action buttons with shortcut hints */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => console.log('Creating feature')}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded"
                >
                  New Feature
                  <ShortcutBadge
                    shortcut={DEFAULT_SHORTCUTS.NEW_FEATURE}
                    size="sm"
                    variant="minimal"
                  />
                </button>

                <button
                  onClick={() => console.log('Creating ticket')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded"
                >
                  New Ticket
                  <ShortcutBadge
                    shortcut={DEFAULT_SHORTCUTS.NEW_TICKET}
                    size="sm"
                    variant="minimal"
                  />
                </button>
              </div>
            </div>

            {/* Settings section for shortcut management */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Keyboard Shortcut Settings</h2>

              <div className="space-y-4">
                {/* Show conflicts if any exist */}
                {conflicts.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <h3 className="text-red-400 font-medium mb-2">
                      {conflicts.length} Shortcut Conflict{conflicts.length > 1 ? 's' : ''} Detected
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Some keyboard shortcuts conflict with each other. Click "Show Shortcuts" to resolve.
                    </p>
                    <button
                      onClick={() => setShowShortcutsModal(true)}
                      className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
                    >
                      Resolve Conflicts
                    </button>
                  </div>
                )}

                {/* Custom shortcuts count */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Custom Shortcuts</h3>
                    <p className="text-sm text-gray-400">
                      {Object.keys(customShortcuts).length} custom shortcut{Object.keys(customShortcuts).length !== 1 ? 's' : ''} defined
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExportShortcuts}
                      disabled={Object.keys(customShortcuts).length === 0}
                      className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white px-4 py-2 rounded"
                    >
                      Export
                    </button>
                    <button
                      onClick={resetAllShortcuts}
                      disabled={Object.keys(customShortcuts).length === 0}
                      className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white px-4 py-2 rounded"
                    >
                      Reset All
                    </button>
                  </div>
                </div>

                {/* Learning mode toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Learning Mode</h3>
                    <p className="text-sm text-gray-400">
                      Get guided tips and learn new shortcuts
                    </p>
                  </div>
                  <button
                    onClick={() => setLearningMode(!learningMode)}
                    className={`px-4 py-2 rounded ${
                      learningMode
                        ? 'bg-green-600 hover:bg-green-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    } text-white`}
                  >
                    {learningMode ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Reference panel toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Reference Panel</h3>
                    <p className="text-sm text-gray-400">
                      Show quick reference panel
                    </p>
                  </div>
                  <button
                    onClick={() => setShowReferencePanel(!showReferencePanel)}
                    className={`px-4 py-2 rounded ${
                      showReferencePanel
                        ? 'bg-indigo-600 hover:bg-indigo-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    } text-white`}
                  >
                    {showReferencePanel ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Learning Mode Indicator */}
      {learningMode && (
        <LearningModeIndicator
          enabled={learningMode}
          shortcut={activeShortcut}
          onToggle={() => setLearningMode(false)}
        />
      )}

      {/* Shortcut Reference Panel */}
      {showReferencePanel && (
        <ShortcutReferencePanel
          shortcuts={effectiveShortcuts}
          maxShortcuts={10}
          position="bottom-right"
          onClose={() => setShowReferencePanel(false)}
          enableSearch={true}
          enableCategoryFilter={true}
          enableCollapse={true}
          defaultCollapsed={false}
        />
      )}

      {/* Main Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        shortcuts={effectiveShortcuts}
        customShortcuts={customShortcuts}
        onUpdateShortcut={handleUpdateShortcut}
        onResetShortcut={handleResetShortcut}
        enableRecording={true}
        enableSearch={true}
        enableLearningMode={true}
        learningModeActive={learningMode}
      />
    </>
  );
}

export default AppWithKeyboardShortcuts;

/**
 * Usage Example:
 *
 * import AppWithKeyboardShortcuts from './KEYBOARD_SHORTCUTS_EXAMPLE';
 *
 * function MainApp() {
 *   return <AppWithKeyboardShortcuts />;
 * }
 */
