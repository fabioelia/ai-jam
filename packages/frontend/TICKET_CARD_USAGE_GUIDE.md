# TicketCard Enhanced Component - Usage Guide

## Basic Usage

The enhanced TicketCard maintains backward compatibility with the basic API:

```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onClick={() => handleTicketClick(ticket)}
/>
```

## Advanced Usage Examples

### With Quick Actions

```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onClick={() => handleTicketClick(ticket)}
  onEdit={() => handleEditTicket(ticket)}
  onDelete={() => handleDeleteTicket(ticket)}
  onDuplicate={() => handleDuplicateTicket(ticket)}
/>
```

### With Activity Indicators

```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onClick={() => handleTicketClick(ticket)}
  commentCount={ticket.comments?.length || 0}
  attachmentCount={ticket.attachments?.length || 0}
/>
```

### With Progress Tracking

```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onClick={() => handleTicketClick(ticket)}
  subtaskProgress={calculateProgress(ticket)}  // 0-100 percentage
/>
```

Or with subtask counts:

```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onClick={() => handleTicketClick(ticket)}
  subtaskCount={ticket.subtasks?.length || 0}
  completedSubtasks={ticket.subtasks?.filter(s => s.completed).length || 0}
/>
```

### With Due Dates and Labels

```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onClick={() => handleTicketClick(ticket)}
  dueDate={ticket.dueDate}
  labels={ticket.labels || ['bug', 'urgent']}
/>
```

### Complete Example

```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  isDragging={isDraggingTicket(ticket.id)}
  onClick={() => openTicketDetail(ticket)}
  onEdit={() => openEditModal(ticket)}
  onDelete={() => confirmDelete(ticket)}
  onDuplicate={() => duplicateTicket(ticket)}
  commentCount={ticket.commentCount}
  attachmentCount={ticket.attachmentCount}
  subtaskProgress={ticket.progress}
  dueDate={ticket.dueDate}
  labels={ticket.labels}
/>
```

## Prop Reference

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ticket` | `Ticket` | Yes | - | The ticket data to display |
| `epics` | `Epic[]` | No | - | Array of epics for epic badge display |
| `isDragging` | `boolean` | No | `false` | Whether the ticket is being dragged |
| `onClick` | `() => void` | No | - | Handler for card click events |
| `onEdit` | `() => void` | No | - | Handler for edit quick action |
| `onDelete` | `() => void` | No | - | Handler for delete quick action |
| `onDuplicate` | `() => void` | No | - | Handler for duplicate quick action |
| `commentCount` | `number` | No | `0` | Number of comments on the ticket |
| `attachmentCount` | `number` | No | `0` | Number of attachments on the ticket |
| `subtaskProgress` | `number` | No | - | Progress percentage (0-100) |
| `subtaskCount` | `number` | No | - | Total number of subtasks |
| `completedSubtasks` | `number` | No | - | Number of completed subtasks |
| `dueDate` | `string` | No | - | ISO date string for due date |
| `labels` | `string[]` | No | `[]` | Array of label strings |

## Date Utilities

The component includes a comprehensive date utility library:

```typescript
import {
  formatDate,
  formatFullDate,
  formatRelativeDate,
  isOverdue,
  isDueSoon
} from '../../utils/dateUtils.js';

// Format relative time: "2h ago", "3d ago", "just now"
formatDate('2026-04-17T10:00:00Z');

// Format full date: "Apr 17, 2026"
formatFullDate('2026-04-17T10:00:00Z');

// Format relative date: "Today", "Tomorrow", "In 3d"
formatRelativeDate('2026-04-17T10:00:00Z');

// Check if overdue
isOverdue('2026-04-15T10:00:00Z'); // true

// Check if due soon (within 3 days by default)
isDueSoon('2026-04-20T10:00:00Z'); // true
```

## Integration with Existing Components

### SortableTicketCard
No changes required - the existing SortableTicketCard wrapper works seamlessly:

```tsx
<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
  <TicketCard ticket={ticket} epics={epics} onClick={onClick} />
</div>
```

### BoardColumn
Simply pass the new props through the SortableTicketCard:

```tsx
<SortableTicketCard
  ticket={ticket}
  epics={epics}
  onClick={onTicketClick ? () => onTicketClick(ticket) : undefined}
  onEdit={() => handleEdit(ticket)}
  onDelete={() => handleDelete(ticket)}
  commentCount={ticket.commentCount}
  // ... other props
/>
```

### EpicGroup
The existing EpicGroup implementation continues to work without modifications:

```tsx
<SortableTicketCard
  key={ticket.id}
  ticket={ticket}
  epics={epics}
  onClick={onTicketClick ? () => onTicketClick(ticket) : undefined}
/>
```

## Styling Customization

### Priority Colors
Priority colors are defined in constants:

```typescript
const PRIORITY_BORDER_COLORS = {
  critical: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-orange-500',
  medium: 'border-l-4 border-l-blue-500',
  low: 'border-l-4 border-l-gray-500',
};
```

Modify these constants to change priority color schemes.

### Agent Status Colors
Agent status uses Tailwind's color palette:
- Active: `green-400` with `animate-pulse` and `animate-ping`
- Failed: `red-400`
- Completed: `gray-500`

## Performance Considerations

The component includes several performance optimizations:

1. **Event Handler Memoization**: All handlers use `useCallback`
2. **Conditional Rendering**: Sections only render when data is available
3. **Efficient State Management**: Minimal state updates
4. **Optimized Animations**: CSS transitions use GPU acceleration

## Accessibility Features

- **ARIA Labels**: Dynamic, descriptive labels for screen readers
- **Keyboard Navigation**: Full keyboard support with `tabIndex={0}`
- **Semantic HTML**: Proper button and link elements
- **Color Independence**: Information conveyed through multiple means (icons + text + color)

## Common Use Cases

### 1. Simple Board Display
```tsx
<TicketCard ticket={ticket} epics={epics} />
```

### 2. Interactive Board with Actions
```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onClick={() => navigateToTicket(ticket.id)}
  onEdit={() => openEditModal(ticket)}
  onDelete={() => confirmDelete(ticket)}
/>
```

### 3. Project Management Dashboard
```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  dueDate={ticket.dueDate}
  subtaskProgress={calculateProgress(ticket)}
  commentCount={ticket.comments?.length}
  attachmentCount={ticket.attachments?.length}
  labels={ticket.tags}
/>
```

### 4. Agile Sprint Planning
```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  subtaskCount={ticket.subtasks.length}
  completedSubtasks={ticket.subtasks.filter(s => s.completed).length}
  dueDate={ticket.sprintEndDate}
/>
```

## Migration Guide

### From Basic TicketCard
No migration needed! The enhanced component is fully backward compatible.

### Adding New Features Gradually

1. **Start with basic usage**:
```tsx
<TicketCard ticket={ticket} epics={epics} />
```

2. **Add quick actions**:
```tsx
<TicketCard ticket={ticket} epics={epics} onEdit={handleEdit} onDelete={handleDelete} />
```

3. **Add activity indicators**:
```tsx
<TicketCard ticket={ticket} epics={epics} onEdit={handleEdit} commentCount={comments.length} />
```

4. **Add full functionality**:
```tsx
<TicketCard
  ticket={ticket}
  epics={epics}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onDuplicate={handleDuplicate}
  commentCount={comments.length}
  attachmentCount={attachments.length}
  subtaskProgress={progress}
  dueDate={dueDate}
  labels={tags}
/>
```

## Troubleshooting

### Issue: Quick actions not appearing
**Solution**: Ensure the card is not being dragged and the mouse is over the card area. Quick actions appear on hover.

### Issue: Progress bar not showing
**Solution**: Progress bar only displays when `subtaskProgress > 0` OR when both `subtaskCount` and `completedSubtasks` are provided with `completedSubtasks > 0`.

### Issue: Date formatting not working
**Solution**: Ensure date strings are in ISO format (`YYYY-MM-DDTHH:mm:ss.sssZ`). The dateUtils functions expect standard JavaScript Date format.

### Issue: Agent status not updating
**Solution**: The component relies on the agent store. Ensure agent sessions are properly registered and updated in the store.

## Best Practices

1. **Always provide epics**: Even if you don't use epic grouping, passing the epics array enables the epic badge.
2. **Use consistent date formats**: Store dates in ISO format for consistent display.
3. **Handle optional props gracefully**: Don't assume optional props are provided.
4. **Test with various data states**: Test with no comments, no attachments, no progress, etc.
5. **Consider performance with many cards**: If displaying hundreds of cards, consider virtualization.

## Examples Gallery

See `TICKET_CARD_ENHANCEMENTS.md` for detailed examples of each feature.
