# Toolbar Organization Design

## Problem

The board toolbar currently displays up to 9 controls simultaneously, creating cognitive load and potential overflow on smaller screens:
- Feature selector
- + Feature button
- Plan with Claude button (conditional)
- Divider
- Epic filter
- Priority filter
- Assignee filter
- Search input
- Group by Epic toggle (conditional)
- + Ticket button (conditional)

All controls have equal visual weight with no hierarchy.

## Solution: Logical Grouping + Progressive Disclosure

### Always Visible Controls (4-5 items)

1. **Feature Context Group**
   - Feature selector dropdown
   - "+ Feature" button

2. **Primary Actions**
   - "Plan with Claude" button (shown when feature selected)
   - "+ Ticket" button (right-aligned, shown when feature selected)

3. **Filters**
   - Single "Filters" button that opens popover with all filter options
   - Shows badge with count of active filters (0 when none active)

4. **View Options**
   - "Group by Epic" toggle button (shown when epics exist)

### Filters Popover Contents

The filters popover displays:
- Epic dropdown: "All Epics" → specific epic
- Priority dropdown: "All Priorities" → specific priority
- Assignee dropdown: "All Assignees" → specific assignee
- Search input with clear button
- "Clear all filters" link (visible when any filter is active)

### Component Structure

```
BoardToolbar
├── FeatureContext (selector + +Feature button)
├── PlanButton (conditional)
├── FiltersButton (with active count badge)
│   └── FiltersPopover
│       ├── EpicSelect
│       ├── PrioritySelect
│       ├── PersonaSelect
│       ├── SearchInput
│       └── ClearAllButton
├── GroupByEpicToggle (conditional)
└── TicketButton (conditional, right-aligned)
```

### State Management

- Keep existing state: `epicFilter`, `priorityFilter`, `personaFilter`, `searchQuery`, `groupByEpic`
- Add `filtersOpen` boolean for popover state
- Add derived `activeFiltersCount` for badge display

### Styling

- Use same design tokens as existing UI (gray-800 backgrounds, indigo-600/20 for active states)
- Popover: absolute positioned, z-50, gray-900 bg, border-gray-700, rounded-lg, shadow-xl
- Filters button: same style as Sessions/Agents toggle buttons
- Badge: small red-500/20 bg, red-400 text, rounded-full, absolute top-0 right-0

### Success Criteria

1. Toolbar displays 4-5 items max on standard viewports
2. All filters remain accessible via single click
3. Active filters are visible via badge count
4. Clearing all filters works correctly
5. Existing functionality preserved (no behavior changes)
