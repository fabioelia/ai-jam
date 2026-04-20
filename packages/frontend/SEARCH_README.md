# Global Search System - Quick Reference

## 🎯 Quick Start

### Open Search Modal
- **Mac:** `Cmd + K`
- **Windows/Linux:** `Ctrl + K`
- **Click:** Search icon in header

### Navigate Results
- **Arrow Down:** Next result
- **Arrow Up:** Previous result
- **Enter:** Select result
- **Escape:** Close search

## 📦 Components

### Main Files
- `components/common/GlobalSearchModal.tsx` - Main modal component
- `components/common/SearchTrigger.tsx` - Search trigger button
- `hooks/useGlobalSearch.ts` - Search logic and state
- `hooks/useGlobalSearchModal.ts` - Modal state management

## 🔍 Search Features

### 1. **Content Types**
- ✅ Tickets
- ✅ Features
- ✅ Projects
- ✅ Users

### 2. **Fuzzy Search**
- Exact match: 100% score
- Prefix match: 90% score
- Contains match: 80% score
- Fuzzy match: 50-70% score

### 3. **Filtering**
- Type filters (All, Tickets, Features, Projects, Users)
- Status filters (for tickets)
- Priority filters (for tickets)
- Project-specific filters

### 4. **Quick Actions**
- **Tickets:** Open, Assign to Me
- **Features:** Open, Plan
- **Projects:** Open Board, Settings
- **Users:** View Profile

### 5. **Search History**
- Auto-saved to localStorage
- Recent searches displayed on open
- Track search frequency
- Clear all history option

## 🎨 Visual Features

- **Highlighting:** Search terms highlighted in yellow
- **Type Badges:** Color-coded content type indicators
- **Relevance Score:** "High match" badge for >80% score
- **Animations:** Smooth modal and result animations
- **Responsive:** Works on all screen sizes

## 🚀 Performance

- **Debounced Search:** 300ms delay
- **React Query Caching:** Efficient data retrieval
- **Memoization:** Optimized re-renders
- **Virtual Scrolling:** Ready for large result sets

## ♿ Accessibility

- ✅ Full keyboard navigation
- ✅ ARIA labels
- ✅ Screen reader support
- ✅ High contrast colors
- ✅ Reduced motion support
- ✅ Focus management

## 📱 Responsive Design

- **Desktop:** Full-featured modal
- **Tablet:** Optimized spacing
- **Mobile:** Compact view

## 🔧 Integration

### Add to Any Page
```tsx
import SearchTrigger from './components/common/SearchTrigger';

function MyPage() {
  return (
    <header>
      <SearchTrigger variant="compact" />
    </header>
  );
}
```

### Trigger Programmatically
```tsx
import { useGlobalSearchModal } from './hooks/useGlobalSearchModal';

function MyComponent() {
  const { open } = useGlobalSearchModal();

  return (
    <button onClick={() => open('search query')}>
      Search
    </button>
  );
}
```

## 📊 Search Algorithm

### Relevance Scoring
```
Score = (Title Match × 0.6) + (Description Match × 0.3) + Word Boundary Bonus
```

### Fuzzy Matching
- Uses Levenshtein distance
- Calculates string similarity
- Minimum score threshold: 0.3

## 🎯 Best Practices

1. **Use Specific Terms:** More specific queries give better results
2. **Use Filters:** Filter by type to narrow results
3. **Review History:** Check recent searches for quick access
4. **Keyboard Navigation:** Use arrow keys for faster navigation
5. **Quick Actions:** Use context-aware quick actions

## 🐛 Troubleshooting

### Search Not Working
- Check network connection
- Verify React Query cache
- Clear browser cache

### No Results Found
- Try different search terms
- Check filter settings
- Verify data exists

### Modal Won't Open
- Check keyboard shortcut conflicts
- Verify global modal state
- Check browser console for errors

## 📚 Documentation

For detailed documentation, see: `GLOBAL_SEARCH_SYSTEM.md`

## 🚧 Future Enhancements

- Advanced date range filters
- Search result export
- Analytics dashboard
- Collaboration features
- Custom filter presets

## 💡 Tips

- Use `Cmd/Ctrl + K` anywhere in the app
- Type slowly for better fuzzy matching
- Use arrow keys to navigate quickly
- Check the "High match" badges first
- Use quick actions for common tasks

## 🎨 Styling

Search uses Tailwind CSS with custom animations defined in `index.css`:
- `animate-modal-scale-in`
- `search-result-slide`
- `filter-chip-pop`
- `quick-action-btn`

---

**Questions?** Check the full documentation in `GLOBAL_SEARCH_SYSTEM.md`
