# Help System Quick Reference

## Components Overview

### HelpModal
Main help center modal with search and categorization.

```tsx
import HelpModal, { HelpSection, HelpItem, Shortcut, Feature, TutorialCard } from './components/common/HelpModal.js';

<HelpModal
  isOpen={showHelp}
  onClose={() => setShowHelp(false)}
  title="Help Center"
  initialCategory="overview"
  onCategoryChange={setCategory}
>
  <HelpContent
    category={currentCategory}
    searchQuery={searchQuery}
    onSearchResults={setResultCount}
  />
</HelpModal>
```

### HelpContent
Interactive help content with search and examples.

```tsx
<HelpContent
  category="overview"
  searchQuery={searchQuery}
  onSearchResults={setResultCount}
  onTutorialClick={handleTutorial}
/>
```

### OnboardingTour
Enhanced tour system with progress tracking.

```tsx
import OnboardingTour, { tourConfigs, useOnboardingTour } from './components/common/OnboardingTour.js';

// Using predefined config
<OnboardingTour
  config={tourConfigs.quickStart}
  isOpen={showTour}
  onClose={() => setShowTour(false)}
  onComplete={handleComplete}
/>

// Custom tour
<OnboardingTour
  config={{
    id: 'custom-tour',
    name: 'My Custom Tour',
    steps: [
      {
        target: '[data-tour="my-element"]',
        title: 'Step Title',
        content: 'Step description',
        position: 'bottom',
        skipable: true,
      },
    ],
    showProgress: true,
    showSkip: true,
    storageKey: 'my-custom-tour',
  }}
  isOpen={showTour}
  onClose={() => setShowTour(false)}
  onComplete={handleComplete}
/>

// Hook for tour state
const { hasSeenTour, markTourComplete, resetTour } = useOnboardingTour('quick-start');
```

### QuickStartGuide
Visual quick start guide with progress tracking.

```tsx
import QuickStartGuide from './components/common/QuickStartGuide.js';

<QuickStartGuide
  isOpen={showGuide}
  onClose={() => setShowGuide(false)}
  onStartProject={handleStartProject}
  onTutorialClick={handleTutorial}
  onComplete={handleComplete}
  initialStep={0}
/>
```

### ContextualHelp
Context-sensitive help triggers and components.

```tsx
import {
  HelpProvider,
  ContextualHelp,
  Tooltip,
  InlineHelp,
  HelpTrigger,
  HelpButton,
} from './components/common/ContextualHelp.js';

// Wrap your app with provider
<HelpProvider>
  <App />
</HelpProvider>

// Contextual tooltip
<ContextualHelp
  title="Create Project"
  description="Start a new project workspace"
  position="top"
  type="tooltip"
  shortcut={['N', 'P']}
>
  <button>Create Project</button>
</ContextualHelp>

// Simple tooltip
<Tooltip content="Press Enter to submit">
  <input type="text" />
</Tooltip>

// Inline help banner
<InlineHelp
  title="Pro Tip"
  description="Use keyboard shortcuts for faster navigation"
  variant="info"
  dismissible
  onDismiss={handleDismiss}
/>

// Pre-configured help trigger
<HelpTrigger context="create-project">
  <button>Create Project</button>
</HelpTrigger>

// Help button
<HelpButton onClick={() => setShowHelp(true)} />
```

### HelpFeedback
Feedback and rating system.

```tsx
import {
  HelpFeedback,
  QuickHelpful,
  RatingDisplay,
  useHelpFeedback,
} from './components/common/HelpFeedback.js';

// Full feedback form
<HelpFeedback
  articleId="getting-started-create-project"
  articleTitle="Create Your First Project"
  onSubmit={handleSubmitFeedback}
  showByDefault={false}
  position="bottom"
/>

// Quick helpful buttons
<QuickHelpful
  articleId="article-id"
  onVote={(helpful) => console.log('User voted:', helpful)}
/>

// Rating display (read-only)
<RatingDisplay rating={4.5} count={23} />

// Interactive rating
<RatingDisplay
  rating={userRating}
  count={23}
  interactive
  onRate={setUserRating}
/>

// Hook for feedback management
const { submitFeedback, hasFeedback, getFeedback, getStats } = useHelpFeedback();

// Submit feedback
submitFeedback({
  articleId: 'article-id',
  rating: 5,
  helpful: true,
  comment: 'Great article!',
  timestamp: Date.now(),
});
```

## API Reference

### HelpModal Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| isOpen | boolean | - | Modal visibility |
| onClose | () => void | - | Close handler |
| title | string | 'Help' | Modal title |
| children | ReactNode | - | Content |
| initialCategory | HelpCategory | 'overview' | Initial category |
| onCategoryChange | (cat) => void | - | Category change handler |

### HelpContent Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| category | HelpCategory | - | Current category |
| searchQuery | string | - | Search query |
| onSearchResults | (count) => void | - | Results handler |
| onTutorialClick | (id) => void | - | Tutorial click handler |

### OnboardingTour Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| config | TourConfig | - | Tour configuration |
| isOpen | boolean | - | Tour visibility |
| onClose | () => void | - | Close handler |
| onComplete | () => void | - | Completion handler |
| onStepChange | (index) => void | - | Step change handler |
| onSkip | () => void | - | Skip handler |
| customActions | ReactNode | - | Custom action buttons |

### QuickStartGuide Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| isOpen | boolean | - | Guide visibility |
| onClose | () => void | - | Close handler |
| onStartProject | () => void | - | Start project handler |
| onTutorialClick | (id) => void | - | Tutorial click handler |
| onComplete | () => void | - | Completion handler |
| initialStep | number | 0 | Initial step |

### ContextualHelp Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | - | Help title |
| description | string | - | Help description |
| position | 'top'\|'bottom'\|'left'\|'right' | 'top' | Position |
| type | 'tooltip'\|'popover'\|'inline' | 'tooltip' | Display type |
| article | string | - | Article link |
| shortcut | string[] | - | Keyboard shortcut |
| onReadMore | () => void | - | Read more handler |
| delay | number | 200 | Hover delay (ms) |

### HelpFeedback Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| articleId | string | - | Article identifier |
| articleTitle | string | - | Article title |
| onSubmit | (data) => void | - | Submit handler |
| showByDefault | boolean | false | Show form by default |
| position | 'top'\|'bottom' | 'bottom' | Form position |

## Data Types

### HelpCategory
```typescript
type HelpCategory = 'overview' | 'getting-started' | 'features' | 'shortcuts' | 'troubleshooting' | 'advanced';
```

### TourStep
```typescript
interface TourStep {
  target: string;              // CSS selector
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  image?: string;              // Image URL
  video?: string;              // Video URL
  interactive?: boolean;        // Requires user interaction
  actionRequired?: boolean;    // Action required to proceed
  skipable?: boolean;
  onNext?: () => void | Promise<void>;
  onPrevious?: () => void | Promise<void>;
}
```

### TourConfig
```typescript
interface TourConfig {
  id: string;
  name: string;
  steps: TourStep[];
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
  showProgress?: boolean;
  showSkip?: boolean;
  allowSkipAll?: boolean;
  highlightPadding?: number;
  maskOpacity?: number;
  completionBehavior?: 'none' | 'restart' | 'next-tour';
  storageKey?: string;
}
```

### FeedbackData
```typescript
interface FeedbackData {
  articleId: string;
  rating: number;           // 1-5
  helpful: boolean | null;
  comment: string;
  timestamp: number;
}
```

## Best Practices

### 1. Help Content
- Use clear, concise language
- Provide examples and code snippets
- Include relevant tags for search
- Keep articles focused on single topics

### 2. Onboarding Tours
- Keep tours short (3-5 steps max)
- Use clear, actionable language
- Provide visual cues (images, videos)
- Allow users to skip or restart

### 3. Contextual Help
- Provide help at the point of need
- Use tooltips for quick explanations
- Use popovers for detailed information
- Include keyboard shortcuts when relevant

### 4. Feedback
- Make feedback easy to provide
- Show feedback to acknowledge contribution
- Use feedback to improve content
- Track metrics for insights

### 5. Accessibility
- Ensure keyboard navigation works
- Provide ARIA labels
- Use proper semantic HTML
- Test with screen readers

## Common Patterns

### Add Help to a Button
```tsx
<HelpTrigger context="my-action">
  <button>My Action</button>
</HelpTrigger>
```

### Add Tooltip to Input
```tsx
<Tooltip content="Press Enter to submit">
  <input type="text" />
</Tooltip>
```

### Add Inline Help Banner
```tsx
<InlineHelp
  title="New Feature"
  description="Try our new feature for faster workflows"
  variant="success"
  dismissible
/>
```

### Create Custom Tour Step
```tsx
const customStep: TourStep = {
  target: '[data-tour="custom"]',
  title: 'Custom Step',
  content: 'Description of the step',
  position: 'bottom',
  interactive: true,
  skipable: true,
  onNext: async () => {
    // Perform action before next step
    await doSomething();
  },
};
```

### Add Rating to Article
```tsx
<article>
  <h2>Article Title</h2>
  <p>Article content...</p>
  <HelpFeedback
    articleId="article-id"
    articleTitle="Article Title"
    onSubmit={handleSubmit}
  />
</article>
```

## Troubleshooting

### Help modal not showing
- Check `isOpen` prop is true
- Ensure modal z-index is high enough
- Check for CSS conflicts

### Tour steps not positioning correctly
- Verify target selector matches an element
- Check element is visible and in DOM
- Try adjusting position prop

### Feedback not submitting
- Check articleId is unique
- Verify onSubmit handler is provided
- Check localStorage is enabled

### Contextual help not appearing
- Ensure HelpProvider wraps the app
- Check help key is registered
- Verify CSS positioning is correct

## Performance Tips

1. **Lazy load help content**: Only load content when needed
2. **Debounce search**: Add delay to search input
3. **Use React.memo**: Memoize help components
4. **Optimize images**: Use compressed images and videos
5. **Cache feedback**: Use localStorage for persistence

## Resources

- [Full Documentation](./HELP_SYSTEM_ENHANCEMENTS.md)
- [Component Examples](./packages/frontend/src/components/common/)
- [Type Definitions](./packages/frontend/src/components/common/*.tsx)
