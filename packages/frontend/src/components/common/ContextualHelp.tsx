import { useState, useCallback, createContext, useContext, useEffect } from 'react';
import { ReactNode } from 'react';

interface ContextualHelpProps {
  children: ReactNode;
  title: string;
  description?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  type?: 'tooltip' | 'popover' | 'inline';
  article?: string;
  shortcut?: string[];
  onReadMore?: () => void;
  delay?: number;
}

interface TooltipProps {
  children: ReactNode;
  content: string;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface InlineHelpProps {
  title: string;
  description: string;
  icon?: ReactNode;
  className?: string;
  variant?: 'info' | 'warning' | 'success' | 'error';
  dismissible?: boolean;
  onDismiss?: () => void;
}

interface QuickTipProps {
  title: string;
  tips: string[];
  className?: string;
  showProgress?: boolean;
  currentTip?: number;
}

interface ProgressGuideProps {
  steps: Array<{
    title: string;
    description: string;
    completed: boolean;
  }>;
  currentStep: number;
  onStepClick?: (step: number) => void;
}

// Context for managing contextual help
interface HelpContextType {
  showHelp: (key: string) => void;
  hideHelp: (key: string) => void;
  isHelpVisible: (key: string) => boolean;
  registerHelp: (key: string, content: string) => void;
  unregisterHelp: (key: string) => void;
}

const HelpContext = createContext<HelpContextType | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [visibleHelp, setVisibleHelp] = useState<Set<string>>(new Set());
  const [helpContent, setHelpContent] = useState<Map<string, string>>(new Map());

  const showHelp = useCallback((key: string) => {
    setVisibleHelp((prev) => new Set(prev).add(key));
  }, []);

  const hideHelp = useCallback((key: string) => {
    setVisibleHelp((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const isHelpVisible = useCallback((key: string) => {
    return visibleHelp.has(key);
  }, [visibleHelp]);

  const registerHelp = useCallback((key: string, content: string) => {
    setHelpContent((prev) => new Map(prev).set(key, content));
  }, []);

  const unregisterHelp = useCallback((key: string) => {
    setHelpContent((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  return (
    <HelpContext.Provider value={{ showHelp, hideHelp, isHelpVisible, registerHelp, unregisterHelp }}>
      {children}
    </HelpContext.Provider>
  );
}

export function useHelpContext() {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelpContext must be used within a HelpProvider');
  }
  return context;
}

// Contextual Help Component with multiple display modes
export default function ContextualHelp({
  children,
  title,
  description,
  position = 'top',
  type = 'tooltip',
  article,
  shortcut,
  onReadMore,
  delay = 200,
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const { registerHelp, unregisterHelp } = useHelpContext();
  const helpKey = `help-${title.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    registerHelp(helpKey, description || title);
    return () => unregisterHelp(helpKey);
  }, [helpKey, description, title, registerHelp, unregisterHelp]);

  const handleMouseEnter = () => {
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => setIsOpen(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsOpen(false);
  };

  if (type === 'inline') {
    return (
      <div className="relative inline-block">
        {children}
      </div>
    );
  }

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-45',
  };

  return (
    <div className="relative inline-block">
      <div
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        {children}
      </div>

      {isOpen && (
        <div
          className={`absolute z-50 ${type === 'popover' ? 'w-80' : 'w-64'} p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl animate-in fade-in duration-200 ${positionClasses[position]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
          {description && <p className="text-xs text-gray-400 leading-relaxed mb-2">{description}</p>}

          {shortcut && shortcut.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2">
              {shortcut.map((key, index) => (
                <div key={key} className="flex items-center gap-0.5">
                  <kbd className="text-xs text-gray-300 bg-gray-700 border border-gray-600 px-1.5 py-0.5 rounded font-mono">
                    {key}
                  </kbd>
                  {index < shortcut.length - 1 && (
                    <span className="text-gray-500 text-xs">+</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {article && (
            <button
              onClick={onReadMore}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Read more →
            </button>
          )}

          <div className={`absolute w-2 h-2 bg-gray-800 border-l border-b border-gray-700 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
}

export function Tooltip({ children, content, delay = 200, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-45',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div className={`absolute z-50 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded shadow-lg animate-in fade-in duration-200 whitespace-nowrap ${positionClasses[position]}`}>
          {content}
          <div className={`absolute w-2 h-2 bg-gray-800 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
}

export function InlineHelp({
  title,
  description,
  icon,
  className = '',
  variant = 'info',
  dismissible = false,
  onDismiss,
}: InlineHelpProps) {
  const [isVisible, setIsVisible] = useState(true);

  const variantStyles = {
    info: 'bg-indigo-500/5 border-indigo-500/20',
    warning: 'bg-amber-500/5 border-amber-500/20',
    success: 'bg-green-500/5 border-green-500/20',
    error: 'bg-red-500/5 border-red-500/20',
  };

  const variantColors = {
    info: 'text-indigo-300',
    warning: 'text-amber-300',
    success: 'text-green-300',
    error: 'text-red-300',
  };

  if (!isVisible) return null;

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${variantStyles[variant]} ${className}`}>
      {icon || (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-current/10 flex items-center justify-center">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className={`text-sm font-medium ${variantColors[variant]}`}>{title}</h4>
          {dismissible && (
            <button
              onClick={() => {
                setIsVisible(false);
                onDismiss?.();
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs opacity-70 leading-relaxed mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function QuickTip({ title, tips, className = '', showProgress, currentTip = 0 }: QuickTipProps) {
  return (
    <div className={`bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h4 className="text-sm font-semibold text-amber-300">{title}</h4>
        </div>
        {showProgress && (
          <span className="text-xs text-amber-400/70">
            {currentTip + 1}/{tips.length}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {tips.map((tip, index) => (
          <li key={index} className="text-xs text-amber-200/70 flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressGuide({ steps, currentStep, onStepClick }: ProgressGuideProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isCurrent = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div
            key={index}
            onClick={() => onStepClick?.(index)}
            className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
              isCurrent
                ? 'bg-indigo-500/10 border border-indigo-500/30 cursor-pointer hover:bg-indigo-500/20'
                : isCompleted
                ? 'bg-green-500/5 border border-green-500/20 cursor-pointer hover:bg-green-500/10'
                : 'bg-gray-800/50 border border-gray-700 cursor-not-allowed opacity-60'
            }`}
          >
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              isCompleted
                ? 'bg-green-500 text-white'
                : isCurrent
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-700 text-gray-500'
            }`}>
              {isCompleted ? '✓' : index + 1}
            </div>
            <div className="flex-1">
              <h5 className={`text-sm font-medium ${
                isCompleted ? 'text-green-300' : isCurrent ? 'text-white' : 'text-gray-500'
              }`}>
                {step.title}
              </h5>
              <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Context-sensitive help triggers for common UI elements
export function HelpTrigger({ context, children }: { context: string; children: ReactNode }) {
  const helpContent: Record<string, { title: string; description: string; shortcut?: string[] }> = {
    'create-project': {
      title: 'Create Project',
      description: 'Start a new project workspace to organize your features and connect to your codebase.',
      shortcut: ['N', 'P'],
    },
    'create-feature': {
      title: 'Create Feature',
      description: 'Features are high-level initiatives that contain multiple tickets.',
      shortcut: ['N', 'F'],
    },
    'create-ticket': {
      title: 'Create Ticket',
      description: 'Tickets are individual tasks that flow through your workflow stages.',
      shortcut: ['N', 'T'],
    },
    'plan-with-ai': {
      title: 'Plan with Claude',
      description: 'Use AI to break down features into actionable tickets automatically.',
      shortcut: ['P'],
    },
    'agents': {
      title: 'AI Agents',
      description: 'Monitor and manage AI agents that work on your tickets.',
    },
    'filters': {
      title: 'Filters',
      description: 'Filter and sort your board view by various criteria.',
      shortcut: ['F'],
    },
    'sessions': {
      title: 'Sessions',
      description: 'View recent AI agent sessions and their progress.',
    },
  };

  const content = helpContent[context];

  if (!content) {
    return <>{children}</>;
  }

  return (
    <ContextualHelp
      title={content.title}
      description={content.description}
      shortcut={content.shortcut}
    >
      {children}
    </ContextualHelp>
  );
}

// Help button component for easy access
export function HelpButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all duration-200 hover:shadow-sm active:bg-gray-600 active:scale-95"
      aria-label="Get help"
      title="Get help"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}
