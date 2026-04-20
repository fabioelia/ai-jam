import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

type EmptyStateType =
  | 'no-projects'
  | 'no-features'
  | 'no-tickets'
  | 'no-sessions'
  | 'no-activity'
  | 'no-comments'
  | 'search-results'
  | 'error'
  | 'success';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  illustration?: 'minimal' | 'detailed' | 'none';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const illustrations: Record<EmptyStateType, { icon: string; color: string; bg: string }> = {
  'no-projects': {
    icon: '📁',
    color: 'text-indigo-400',
    bg: 'from-indigo-500/10 to-purple-500/10',
  },
  'no-features': {
    icon: '🎯',
    color: 'text-blue-400',
    bg: 'from-blue-500/10 to-cyan-500/10',
  },
  'no-tickets': {
    icon: '📋',
    color: 'text-amber-400',
    bg: 'from-amber-500/10 to-orange-500/10',
  },
  'no-sessions': {
    icon: '⚡',
    color: 'text-green-400',
    bg: 'from-green-500/10 to-emerald-500/10',
  },
  'no-activity': {
    icon: '🔔',
    color: 'text-gray-400',
    bg: 'from-gray-500/10 to-gray-600/10',
  },
  'no-comments': {
    icon: '💬',
    color: 'text-purple-400',
    bg: 'from-purple-500/10 to-pink-500/10',
  },
  'search-results': {
    icon: '🔍',
    color: 'text-cyan-400',
    bg: 'from-cyan-500/10 to-blue-500/10',
  },
  'error': {
    icon: '❌',
    color: 'text-red-400',
    bg: 'from-red-500/10 to-rose-500/10',
  },
  'success': {
    icon: '✅',
    color: 'text-green-400',
    bg: 'from-green-500/10 to-emerald-500/10',
  },
};

const defaultMessages: Record<EmptyStateType, { title: string; description: string; suggestions: string[] }> = {
  'no-projects': {
    title: 'No projects yet',
    description: 'Start your journey by creating your first project. This will be your workspace for planning and tracking.',
    suggestions: [
      'Connect a GitHub repository',
      'Use a local directory',
      'Import from templates',
    ],
  },
  'no-features': {
    title: 'No features created',
    description: 'Features help you organize your work into logical groups. Create your first feature to get started.',
    suggestions: [
      'Start with a user story',
      'Break down into epics',
      'Use feature templates',
    ],
  },
  'no-tickets': {
    title: 'No tickets yet',
    description: 'Tickets are the individual tasks that make up your features. Add tickets to start planning.',
    suggestions: [
      'Create from scratch',
      'Import from requirements',
      'Use AI to generate',
    ],
  },
  'no-sessions': {
    title: 'No active sessions',
    description: 'Agent sessions track the work done by AI agents. Start a session to begin.',
    suggestions: [
      'Plan with Claude',
      'Execute a ticket',
      'Run a scan',
    ],
  },
  'no-activity': {
    title: 'No recent activity',
    description: 'Check back later to see the latest updates from your team.',
    suggestions: [
      'Create a ticket',
      'Start a planning session',
      'Invite team members',
    ],
  },
  'no-comments': {
    title: 'No comments yet',
    description: 'Start the conversation by adding your thoughts and questions.',
    suggestions: [
      'Add your feedback',
      'Ask a question',
      'Suggest improvements',
    ],
  },
  'search-results': {
    title: 'No results found',
    description: 'Try adjusting your search terms or filters to find what you\'re looking for.',
    suggestions: [
      'Check spelling',
      'Use fewer filters',
      'Try different keywords',
    ],
  },
  'error': {
    title: 'Something went wrong',
    description: 'An error occurred while loading your data. Please try again.',
    suggestions: [
      'Refresh the page',
      'Check your connection',
      'Try again later',
    ],
  },
  'success': {
    title: 'All caught up!',
    description: 'You\'ve completed all your tasks. Great work!',
    suggestions: [
      'Create new tasks',
      'Review completed work',
      'Take a break',
    ],
  },
};

export default function EnhancedEmptyState({
  type,
  title,
  description,
  action,
  secondaryAction,
  illustration = 'detailed',
  size = 'md',
  className = '',
}: EmptyStateProps) {
  const navigate = useNavigate();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const config = illustrations[type];
  const defaultMessage = defaultMessages[type];

  const displayTitle = title || defaultMessage.title;
  const displayDescription = description || defaultMessage.description;

  const sizeClasses = {
    sm: { icon: 'w-16 h-16', container: 'max-w-sm' },
    md: { icon: 'w-20 h-20', container: 'max-w-md' },
    lg: { icon: 'w-24 h-24', container: 'max-w-lg' },
  };

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 ${className}`}>
      {/* Illustration */}
      {illustration !== 'none' && (
        <div
          className={`relative mb-8 animate-in fade-in duration-300 ${
            illustration === 'detailed'
              ? `w-48 h-48 bg-gradient-to-br ${config.bg} rounded-3xl flex items-center justify-center shadow-2xl ${size === 'sm' ? 'scale-75' : size === 'lg' ? 'scale-125' : ''}`
              : `${sizeClasses[size].icon} flex items-center justify-center`
          }`}
        >
          {/* Animated gradient background for detailed illustration */}
          {illustration === 'detailed' && (
            <>
              {/* Floating elements */}
              <div className="absolute top-4 left-4 w-3 h-3 bg-white/10 rounded-full animate-float" style={{ animationDelay: '0s' }} />
              <div className="absolute top-8 right-6 w-2 h-2 bg-white/10 rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-12 left-8 w-4 h-4 bg-white/10 rounded-full animate-float" style={{ animationDelay: '1s' }} />

              {/* Ring effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-pink-500/5 rounded-3xl animate-pulse pointer-events-none" />
            </>
          )}

          {/* Main icon */}
          <span className="text-5xl md:text-6xl animate-in zoom-in-95 duration-300">
            {config.icon}
          </span>
        </div>
      )}

      {/* Content */}
      <div className={`text-center ${sizeClasses[size].container} animate-in fade-in duration-300 delay-100`}>
        {/* Title */}
        <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
          {displayTitle}
        </h2>

        {/* Description */}
        <p className="text-gray-400 text-base mb-6 max-w-md leading-relaxed">
          {displayDescription}
        </p>

        {/* Suggestions */}
        {defaultMessage.suggestions.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-1 mx-auto transition-colors"
            >
              <span>{showSuggestions ? 'Hide' : 'Show'} suggestions</span>
              <svg
                className={`w-4 h-4 transition-transform ${showSuggestions ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSuggestions && (
              <div className="mt-4 space-y-2 animate-in slide-in-from-top duration-200">
                {defaultMessage.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="text-gray-500 text-sm bg-gray-800/50 px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors animate-in fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    • {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className={`${
                action.variant === 'primary'
                  ? 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300'
              } px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                action.variant === 'primary'
                  ? 'shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-[0.98]'
                  : 'hover:shadow-md hover:shadow-gray-900/10 active:scale-95'
              }`}
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-gray-400 hover:text-gray-300 px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:bg-gray-800 active:scale-95"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>

        {/* Keyboard hint */}
        {!action && (
          <p className="text-gray-600 text-xs mt-6">
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-500 font-mono">Esc</kbd> to go back
          </p>
        )}
      </div>
    </div>
  );
}

// Compact version for inline use
export function CompactEmptyState({
  type,
  title,
  action,
}: {
  type: EmptyStateType;
  title?: string;
  action?: { label: string; onClick: () => void };
}) {
  const config = illustrations[type];
  const defaultMessage = defaultMessages[type];

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{config.icon}</span>
        <h3 className="text-base font-semibold text-gray-300">
          {title || defaultMessage.title}
        </h3>
      </div>
      <p className="text-gray-500 text-sm mb-4">{defaultMessage.description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-indigo-400 hover:text-indigo-300 text-sm font-medium px-4 py-2 rounded-lg border border-indigo-500/30 bg-indigo-600/10 hover:bg-indigo-600/20 transition-all active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
