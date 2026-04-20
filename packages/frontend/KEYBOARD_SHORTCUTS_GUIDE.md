# Keyboard Shortcuts System - Complete Guide

## Overview

The keyboard shortcuts system provides a comprehensive, customizable, and conflict-aware keyboard navigation experience across the entire application.

## Features Implemented

### 1. Comprehensive Keyboard Shortcuts

The system includes **60+ keyboard shortcuts** organized into 9 categories:

#### Navigation
- `Escape` - Close modals, dialogs, or exit editing mode
- `Arrow Up/Down/Left/Right` - Navigate through lists and grids
- `Cmd+Shift+H` - Go to home page
- `Cmd+G` - Go to dashboard
- `Cmd+B` - Go to project board
- `Cmd+,` - Go to settings

#### Actions
- `Cmd/Ctrl+Shift+F` - Create new feature
- `Cmd/Ctrl+Shift+T` - Create new ticket
- `Cmd/Ctrl+Shift+E` - Create new epic
- `Cmd/Ctrl+S` - Save current changes
- `Cmd+Z` - Undo last action
- `Cmd+Shift+Z` - Redo last undone action
- `Delete` - Delete selected item
- `Cmd+D` - Duplicate selected item

#### Search & Filter
- `/` - Focus search input
- `Cmd/Ctrl+K` - Open advanced search
- `F` - Toggle filters panel
- `Shift+C` - Clear all filters
- `G` - Next search result
- `Shift+G` - Previous search result

#### Panels & Views
- `Shift+B` - Toggle sidebar
- `Shift+S` - Toggle sessions panel
- `Shift+A` - Toggle agents panel
- `Shift+N` - Toggle notifications panel
- `Shift+?` - Toggle help panel
- `Shift+T` - Toggle light/dark theme

#### Board Controls
- `Alt+ArrowRight` - Move to next column
- `Alt+ArrowLeft` - Move to previous column
- `Alt+ArrowUp` - Move ticket up
- `Alt+ArrowDown` - Move ticket down
- `Enter` - Select focused ticket
- `O` - Open selected ticket
- `W` - Close current ticket

#### Agent Controls
- `Cmd+R` - Start/restart agent
- `Cmd+.` - Stop agent
- `Cmd+P` - Pause agent
- `Cmd+Shift+P` - Resume agent
- `Cmd+J` - Next agent message
- `Cmd+K` - Previous agent message
- `Cmd+E` - Execute agent action

#### Editing
- `E` - Enter edit mode
- `Cmd/Ctrl+B` - Make text bold
- `Cmd/Ctrl+I` - Make text italic
- `Shift+E` - Insert code block
- `Shift+L` - Insert link
- `Shift+X` - Insert checklist item
- `Alt+1` - Insert heading 1
- `Alt+2` - Insert heading 2
- `Alt+3` - Insert heading 3

#### System
- `?` - Show keyboard shortcuts
- `Cmd+H` - Open help documentation
- `Cmd+,` - Open settings
- `Cmd+P` - Open profile
- `Cmd+Shift+F` - Toggle fullscreen
- `Cmd+Shift+R` - Refresh current view
- `Cmd+Shift+Q` - Logout

#### Selection
- `Cmd+A` - Select all items
- `Cmd+Shift+D` - Deselect all items
- `Cmd+Shift+I` - Invert selection
- `N` - Select next item
- `P` - Select previous item
- `Shift+Escape` - Clear selection

### 2. Customizable Keyboard Shortcuts

Users can customize any keyboard shortcut through:

- **Settings Panel**: Navigate to Settings > Shortcuts
- **Inline Recording**: Click "Change" button on any shortcut to record new combination
- **Conflict Detection**: System warns when new shortcuts conflict with existing ones
- **Reset Options**: Individual or bulk reset to default shortcuts

#### Custom Shortcut Storage
- Stored in localStorage under `ai-jam:custom-shortcuts`
- Export/Import functionality for backup and sharing
- Automatic validation against system shortcuts

### 3. Conflict Detection

The system automatically detects and resolves shortcut conflicts:

#### Automatic Detection
- Real-time conflict monitoring
- Visual conflict indicators (red badges, warnings)
- Priority-based resolution (higher priority shortcuts take precedence)

#### Conflict Resolution
- Override confirmation dialogs
- Reset to default functionality
- Visual conflict browser showing all conflicts

### 4. Shortcut Categories with Visual Grouping

#### 9 Categories with Color Coding
1. **Navigation** (Indigo) - Move through the app
2. **Actions** (Blue) - Perform common actions
3. **Search** (Green) - Search and filter content
4. **Panels** (Purple) - Toggle interface panels
5. **Board** (Orange) - Control the kanban board
6. **Agents** (Pink) - Control AI agents
7. **Editing** (Cyan) - Text editing and formatting
8. **System** (Gray) - System-wide shortcuts
9. **Selection** (Teal) - Select and manage items

#### Visual Grouping Features
- Category-based organization in modal
- Color-coded badges and borders
- Category filtering
- Icon indicators for each category

### 5. Shortcut Search Functionality

#### Search Capabilities
- **Real-time filtering**: As you type, shortcuts are filtered instantly
- **Multi-field search**: Searches description, key, category, and formatted shortcut
- **Smart matching**: Partial matches and case-insensitive
- **Search highlighting**: Shows matched terms

#### Search Integration
- Available in main shortcuts modal (`/` or `Cmd+K`)
- Available in reference panel
- Keyboard navigation through search results

### 6. Shortcut Recording UI

#### Recording Experience
1. Click "Change" button on any shortcut
2. Recording indicator appears with pulsing animation
3. Press desired key combination
4. Preview of recorded keys shown in real-time
5. Save or cancel options

#### Recording Features
- **Visual feedback**: Pulsing recording indicator
- **Live preview**: See what you're pressing
- **Modifier support**: Ctrl, Cmd, Shift, Alt combinations
- **Conflict detection**: Warns before saving conflicting shortcuts
- **Cancel option**: Easy cancellation if you change your mind

### 7. Keyboard Shortcut Reference Panel

#### Quick Reference Features
- **Persistent panel**: Shows most-used shortcuts
- **Collapsible**: Minimize to save screen space
- **Draggable**: Position anywhere on screen
- **Searchable**: Find shortcuts quickly
- **Categorized**: Filter by category

#### Reference Panel Components
- `ShortcutReferencePanel` - Main reference panel
- `ShortcutTooltip` - Tooltip with shortcut hint
- `ShortcutBadge` - Display shortcut in badge format
- `LearningModeIndicator` - Learning mode status indicator
- `ShortcutSuggestion` - Contextual shortcut suggestions

### 8. Shortcut Learning Mode

#### Interactive Learning Experience
- **Step-by-step guidance**: Learn shortcuts one at a time
- **Visual feedback**: Large, clear key displays
- **Progress tracking**: See your learning progress
- **Category organization**: Learn by category
- **Keyboard navigation**: Use arrow keys to move between shortcuts

#### Learning Mode Features
- Progress bar showing completion percentage
- Large, prominent key combination displays
- Category context for each shortcut
- Previous/Next navigation
- Visual key rendering with proper styling

## Usage Examples

### Basic Usage

```tsx
import { useKeyboardShortcuts, DEFAULT_SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from '../components/common/KeyboardShortcutsModal';

function MyComponent() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  const shortcuts = useMemo(() => [
    {
      ...DEFAULT_SHORTCUTS.NEW_FEATURE,
      action: () => handleNewFeature()
    },
    {
      ...DEFAULT_SHORTCUTS.SEARCH,
      action: () => searchInputRef.current?.focus()
    },
    {
      ...DEFAULT_SHORTCUTS.SHOW_SHORTCUTS,
      action: () => setShowShortcuts(true)
    }
  ], []);

  useKeyboardShortcuts(shortcuts, {
    enabled: true,
    conflictDetection: true,
    learningMode: false
  });

  return (
    <>
      {/* Your component content */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={shortcuts}
        enableRecording={true}
        enableSearch={true}
        enableLearningMode={true}
      />
    </>
  );
}
```

### Using Reference Panel

```tsx
import { ShortcutReferencePanel } from '../components/common/ShortcutReferencePanel';

function Dashboard() {
  const [showReference, setShowReference] = useState(true);

  return (
    <>
      {/* Dashboard content */}
      <ShortcutReferencePanel
        shortcuts={shortcuts}
        maxShortcuts={8}
        position="bottom-right"
        onClose={() => setShowReference(false)}
        enableSearch={true}
        enableCollapse={true}
      />
    </>
  );
}
```

### Custom Shortcut Management

```tsx
function CustomShortcuts() {
  const { customShortcuts, updateShortcut, resetShortcut } = useKeyboardShortcuts(
    shortcuts,
    { enabled: true, conflictDetection: true }
  );

  const handleCustomizeShortcut = (key: string, newShortcut: Partial<KeyboardShortcut>) => {
    updateShortcut(key, newShortcut);
  };

  const handleResetShortcut = (key: string) => {
    resetShortcut(key);
  };

  // Render customization UI
}
```

### Learning Mode Integration

```tsx
import { useShortcutLearningMode } from '../hooks/useKeyboardShortcuts';
import { LearningModeIndicator } from '../components/common/ShortcutReferencePanel';

function App() {
  const [learningMode, setLearningMode] = useState(false);
  const { learningMode: lmState, toggleLearningMode } = useShortcutLearningMode(learningMode);

  return (
    <>
      {/* App content */}
      <LearningModeIndicator
        enabled={learningMode}
        shortcut={lmState.activeElement ? lmState.availableShortcuts[0] : undefined}
        onToggle={toggleLearningMode}
      />
    </>
  );
}
```

## Advanced Features

### Priority System

Shortcuts can have priority levels (0-100) to resolve conflicts:

```typescript
const highPriorityShortcut: KeyboardShortcut = {
  key: 's',
  ctrlKey: true,
  description: 'Save (high priority)',
  category: 'actions',
  action: () => saveWork(),
  priority: 100
};
```

### Conditional Shortcuts

Shortcuts can be enabled/disabled conditionally:

```typescript
const conditionalShortcut: KeyboardShortcut = {
  key: 'e',
  description: 'Edit',
  category: 'editing',
  action: () => enterEditMode(),
  enabled: isEditable
};
```

### Context-Sensitive Shortcuts

Different shortcuts in different contexts:

```typescript
const editingShortcuts = isEditing ? [
  {
    ...DEFAULT_SHORTCUTS.BOLD,
    action: () => formatText('bold')
  },
  // ... more editing shortcuts
] : [];
```

## API Reference

### useKeyboardShortcuts Hook

```typescript
interface KeyboardShortcut {
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
}

function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: {
    enabled?: boolean;
    conflictDetection?: boolean;
    learningMode?: boolean;
  } = {}
): {
  shortcuts: KeyboardShortcut[];
  customShortcuts: Record<string, Partial<KeyboardShortcut>>;
  conflicts: ShortcutConflict[];
  activeShortcut: string | null;
  updateShortcut: (key: string, shortcut: Partial<KeyboardShortcut>) => void;
  resetShortcut: (key: string) => void;
  resetAllShortcuts: () => void;
  dismissShortcut: (key: string) => void;
  restoreShortcut: (key: string) => void;
  dismissedShortcuts: Set<string>;
}
```

### KeyboardShortcutsModal Component

```typescript
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
```

### ShortcutReferencePanel Component

```typescript
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
```

## Best Practices

1. **Use descriptive names**: Clear shortcut descriptions help users learn
2. **Follow platform conventions**: Use familiar key combinations
3. **Avoid conflicts**: Check for conflicts when adding new shortcuts
4. **Provide alternatives**: Offer multiple ways to perform actions
5. **Document shortcuts**: Show shortcuts in tooltips and menus
6. **Respect user preferences**: Allow customization and disable options
7. **Test thoroughly**: Verify shortcuts work in all contexts
8. **Consider accessibility**: Provide alternatives for keyboard users

## Accessibility

The keyboard shortcuts system is designed with accessibility in mind:

- **Screen reader support**: Proper ARIA labels and roles
- **Keyboard navigation**: Full keyboard control of the interface
- **Visible indicators**: Visual feedback for keyboard actions
- **Consistent behavior**: Predictable keyboard interactions
- **Documentation**: Clear documentation of available shortcuts

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (uses Cmd instead of Ctrl)
- Mobile browsers: Limited support (touch-focused)

## Performance Considerations

- **Efficient event handling**: Single event listener for all shortcuts
- **Lazy loading**: Shortcuts loaded only when needed
- **Conflict detection**: Optimized detection algorithm
- **Storage**: Efficient localStorage usage
- **Rendering**: Optimized component re-renders

## Future Enhancements

Potential areas for expansion:

1. **Sync across devices**: Cloud sync for custom shortcuts
2. **Shortcut profiles**: Multiple shortcut sets for different use cases
3. **Macro support**: Record and replay complex sequences
4. **Gesture support**: Mouse gesture shortcuts
5. **Voice commands**: Voice-activated shortcuts
6. **Machine learning**: Suggest shortcuts based on usage patterns

## Troubleshooting

### Shortcuts not working
- Check if input fields are focused (shortcuts disabled in inputs)
- Verify shortcuts are enabled in settings
- Check for conflicts with other extensions
- Ensure no modal dialogs are open

### Conflicts not detected
- Refresh conflict detection by toggling it on/off
- Check that both shortcuts have the same enabled state
- Verify key combinations are exactly the same

### Custom shortcuts not saving
- Check browser localStorage permissions
- Verify localStorage quota not exceeded
- Check for JavaScript errors in console
- Try clearing and re-setting the shortcut

## Support

For issues or questions about the keyboard shortcuts system:
- Check the help documentation (`Cmd+H`)
- View the full shortcuts list (`?`)
- Contact support for advanced issues
