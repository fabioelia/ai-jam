import { ReactNode } from 'react';
import Button from './Button.js';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = ''
}: EmptyStateProps) {
  const defaultIcon = (
    <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center animate-in scale-in duration-300">
      <svg className="w-8 h-8 text-gray-600 animate-in fade-in duration-500 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414-2.414a1 1 0 00-.707-.293h-3.172a1 1 0 00-.707.293l-2.414 2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
  );

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="animate-in fade-in duration-300">
        {icon || defaultIcon}
      </div>
      <h3 className="text-lg font-semibold text-gray-300 mt-6 mb-2 animate-in fade-in duration-300 delay-100">{title}</h3>
      <p className="text-gray-500 text-sm max-w-md mb-6 leading-relaxed animate-in fade-in duration-300 delay-200">{description}</p>
      {action && (
        <div className="flex items-center gap-3 animate-in fade-in duration-300 delay-300">
          <Button
            onClick={action.onClick}
            variant={action.variant || 'primary'}
          >
            {action.label}
          </Button>
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
