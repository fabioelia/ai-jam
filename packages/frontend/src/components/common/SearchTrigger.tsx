import { useGlobalSearchModal } from '../../hooks/useGlobalSearchModal';
import { formatShortcut } from '../../hooks/useKeyboardShortcuts';

interface SearchTriggerProps {
  className?: string;
  variant?: 'default' | 'minimal' | 'compact';
  placeholder?: string;
}

export default function SearchTrigger({ className = '', variant = 'default', placeholder = 'Search...' }: SearchTriggerProps) {
  const { open } = useGlobalSearchModal();

  const getShortcutDisplay = () => {
    if (typeof window !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0) {
      return '⌘K';
    }
    return 'Ctrl+K';
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={() => open()}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
          bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700
          transition-colors ${className}
        `}
        aria-label="Open search"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={() => open()}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm
          bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700
          transition-colors ${className}
        `}
        aria-label="Open search"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <kbd className="text-xs bg-gray-700 px-1.5 py-0.5 rounded hidden sm:inline-block">
          {getShortcutDisplay()}
        </kbd>
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      className={`
        flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm
        bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700
        border border-gray-700 transition-all hover:border-gray-600
        w-full sm:w-auto ${className}
      `}
      aria-label="Open search"
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="flex-1 text-left hidden sm:inline">{placeholder}</span>
      <kbd className="text-xs bg-gray-700 px-2 py-0.5 rounded flex-shrink-0">
        {getShortcutDisplay()}
      </kbd>
    </button>
  );
}
