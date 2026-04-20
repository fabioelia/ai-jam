# Notification Components Implementation Guide

## Quick Start

### Basic Usage (Enhanced Notification Panel)

```tsx
import EnhancedNotificationPanel from '@/components/notifications/EnhancedNotificationPanel';

function MyComponent() {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setShowNotifications(!showNotifications)}>
        Notifications
      </button>
      {showNotifications && (
        <EnhancedNotificationPanel
          projectId="your-project-id"
          onClose={() => setShowNotifications(false)}
        />
      )}
    </div>
  );
}
```

### Enhanced Notification Bell

```tsx
import EnhancedNotificationBell from '@/components/notifications/EnhancedNotificationBell';

function Header() {
  return (
    <header>
      <EnhancedNotificationBell projectId="your-project-id" />
    </header>
  );
}
```

## Component API

### NotificationFilters

```tsx
interface NotificationFiltersProps {
  projects: Project[];
  onSearchChange: (query: string) => void;
  onReadFilterChange: (filter: 'all' | 'unread' | 'read') => void;
  onTypeFilterChange: (filter: NotificationType | '') => void;
  onProjectFilterChange: (projectId: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  searchQuery: string;
  readFilter: 'all' | 'unread' | 'read';
  typeFilter: string;
  projectFilter: string;
}
```

### NotificationGroup

```tsx
interface NotificationGroupProps {
  groupName: string;                    // "Today", "Yesterday", etc.
  notifications: Notification[];        // Notifications in this group
  onNotificationClick: (n: Notification) => void;
  onGroupAction?: (type: 'markRead' | 'delete') => void;
  focusedIndex: number;                // Keyboard navigation
  globalIndexStart: number;            // For focus calculation
  getProjectName: (projectId: string | null) => string | null;
  searchQuery?: string;                // For highlighting
  highlightMatch?: (text: string) => React.ReactNode;
}
```

### NotificationPreferences

```tsx
interface NotificationPreferencesProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  preferences: NotificationPreference[];
  onSave: (preferences: NotificationPreference[]) => void;
}
```

### NotificationTimeline

```tsx
interface NotificationTimelineProps {
  notifications: Notification[];
  onNotificationClick: (n: Notification) => void;
  getProjectName: (projectId: string | null) => string | null;
}
```

## Customization

### Custom Grouping Logic

```tsx
function getCustomGroup(date: string): string {
  const notificationDate = new Date(date);
  const now = new Date();

  // Custom grouping logic
  if (isSameDay(notificationDate, now)) return 'Today';
  if (isYesterday(notificationDate)) return 'Yesterday';
  if (isThisWeek(notificationDate)) return 'This Week';
  if (isThisMonth(notificationDate)) return 'This Month';
  return 'Older';
}
```

### Custom Search Highlighting

```tsx
function customHighlightMatch(text: string, query: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-500/50 text-yellow-100 rounded px-1">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
```

### Custom Notification Types

```tsx
const customTypeIcons: Record<string, { icon: string; color: string; label: string; svg: string }> = {
  your_custom_type: {
    icon: '★',
    color: 'text-pink-400 bg-pink-500/10',
    label: 'Custom Type',
    svg: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
  },
};
```

## Animation Customization

### Custom Animation Delays

```tsx
// Staggered entrance for notifications
{notifications.map((n, index) => (
  <NotificationItem
    key={n.id}
    notification={n}
    className="animate-notification-slide-in"
    style={{ animationDelay: `${index * 50}ms` }}
  />
))}
```

### Custom Animation Durations

```css
/* In your CSS file */
@keyframes custom-slide-in {
  from {
    transform: translateX(30px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-custom-slide-in {
  animation: custom-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
```

## State Management

### Using with Zustand Store

```tsx
import { useNotificationStore } from '@/stores/notification-store';

function MyComponent() {
  const { unreadCount, markRead, markAllRead } = useNotificationStore();

  const handleNotificationClick = (notificationId: string) => {
    markRead(notificationId);
    // Additional logic
  };

  const handleClearAll = () => {
    markAllRead(projectId);
    // Additional logic
  };
}
```

### Using with React Query

```tsx
import { useNotifications, useMarkRead, useMarkAllRead } from '@/api/queries';

function MyComponent({ projectId }: { projectId: string }) {
  const { data: notifications } = useNotifications(projectId, { limit: 50 });
  const markReadMutation = useMarkRead(projectId);
  const markAllReadMutation = useMarkAllRead(projectId);

  const handleMarkRead = (notificationId: string) => {
    markReadMutation.mutate(notificationId, {
      onSuccess: () => {
        // Success handling
      },
    });
  };
}
```

## Keyboard Shortcuts

### Implementing Custom Keyboard Shortcuts

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      // Focus notification search
      document.getElementById('notification-search')?.focus();
    }
    if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      // Mark all as read
      handleMarkAllRead();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

## Testing

### Unit Test Example

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationFilters from './NotificationFilters';

describe('NotificationFilters', () => {
  it('should call onSearchChange when typing in search input', () => {
    const onSearchChange = jest.fn();
    render(
      <NotificationFilters
        projects={[]}
        onSearchChange={onSearchChange}
        onReadFilterChange={jest.fn()}
        onTypeFilterChange={jest.fn()}
        onProjectFilterChange={jest.fn()}
        onClearFilters={jest.fn()}
        hasActiveFilters={false}
        searchQuery=""
        readFilter="all"
        typeFilter=""
        projectFilter=""
      />
    );

    const searchInput = screen.getByPlaceholderText('Search notifications...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    expect(onSearchChange).toHaveBeenCalledWith('test');
  });
});
```

## Performance Tips

### Optimizing Large Notification Lists

```tsx
// Use React.memo for individual notification items
const NotificationItem = React.memo(({ notification }: { notification: Notification }) => {
  return (
    <div>{notification.title}</div>
  );
});

// Use useMemo for expensive operations
const filteredNotifications = useMemo(() => {
  return notifications.filter(/* filtering logic */);
}, [notifications, filterCriteria]);

// Use useCallback for event handlers
const handleNotificationClick = useCallback((notificationId: string) => {
  // handler logic
}, []);
```

### Virtual Scrolling for Large Lists

```tsx
import { FixedSizeList as List } from 'react-window';

function VirtualNotificationList({ notifications }: { notifications: Notification[] }) {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <NotificationItem notification={notifications[index]} />
    </div>
  );

  return (
    <List
      height={400}
      itemCount={notifications.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

## Troubleshooting

### Common Issues

**Issue**: Notifications not updating in real-time
**Solution**: Ensure WebSocket connection is active and Zustand store subscribers are properly set up

**Issue**: Filter performance issues with large datasets
**Solution**: Implement debouncing for search and consider virtual scrolling

**Issue**: Animations not smooth on mobile
**Solution**: Use `transform` and `opacity` properties only, avoid layout-triggering properties

**Issue**: Keyboard navigation not working
**Solution**: Ensure all interactive elements have proper `tabindex` and ARIA attributes

## Best Practices

1. **Always provide fallbacks**: Handle cases where notifications are empty or loading
2. **Use semantic HTML**: Proper use of buttons, headings, and lists
3. **Provide feedback**: Show loading states and action confirmations
4. **Test accessibility**: Ensure keyboard navigation and screen reader support
5. **Optimize performance**: Use memoization for expensive operations
6. **Handle errors**: Graceful error handling for API failures
7. **Responsive design**: Test on various screen sizes
8. **Internationalization**: Prepare for i18n support

## Support

For issues or questions:
- Check the main documentation: `/Users/fabio/clients/ai-jam/notifications-ux-improvements.md`
- Review component source files for implementation details
- Check existing notification pages for usage examples
