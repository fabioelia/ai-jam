import { useState, useEffect } from 'react';

interface LoadingFeedbackProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
  onRetry?: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'inline' | 'overlay';
  size?: 'sm' | 'md' | 'lg';
}

interface Step {
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface LoadingStepsProps {
  steps: Step[];
  currentStep: number;
  size?: 'sm' | 'md';
}

export function LoadingFeedback({
  isLoading,
  message = 'Loading...',
  progress,
  onRetry,
  onCancel,
  variant = 'default',
  size = 'md',
}: LoadingFeedbackProps) {
  if (!isLoading) return null;

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200">
          <LoadingSpinner size={size} />
          {message && <p className={`text-gray-300 mt-4 text-center ${textSizeClasses[size]}`}>{message}</p>}
          {progress !== undefined && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center mt-6">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 bg-gray-800 rounded-lg text-sm transition-all hover:bg-gray-700 active:scale-95"
              >
                Cancel
              </button>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-[0.98]"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className={sizeClasses[size]}>
          <LoadingSpinner />
        </div>
        {message && <p className={`text-gray-400 ${textSizeClasses[size]}`}>{message}</p>}
        {progress !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-10">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className={`${sizeClasses[size]} relative`}>
        {/* Outer ring animation */}
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping pointer-events-none" />

        {/* Main spinner */}
        <LoadingSpinner />

        {/* Center glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-xl pointer-events-none" />
      </div>
      {message && (
        <p className={`text-gray-300 mt-4 text-center font-medium ${textSizeClasses[size]} animate-in fade-in duration-300 delay-100`}>
          {message}
        </p>
      )}
      {progress !== undefined && (
        <div className="w-full max-w-xs mt-4 animate-in fade-in duration-300 delay-200">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Progress</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Animated progress bar glow */}
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500/50 to-purple-500/50 rounded-full transition-all duration-300 ease-out blur-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function LoadingSteps({ steps, currentStep, size = 'md' }: LoadingStepsProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
  };

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className={`relative ${sizeClasses[size]}`}>
            {/* Status circle */}
            <div
              className={`w-full h-full rounded-full flex items-center justify-center transition-all duration-300 ${
                step.status === 'complete'
                  ? 'bg-green-500'
                  : step.status === 'active'
                  ? 'bg-indigo-500 animate-pulse'
                  : step.status === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-800'
              }`}
            >
              {/* Glow effect for active step */}
              {step.status === 'active' && (
                <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-md" />
              )}

              {/* Checkmark for complete */}
              {step.status === 'complete' && (
                <svg className="w-1/2 h-1/2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}

              {/* Error icon */}
              {step.status === 'error' && (
                <svg className="w-1/2 h-1/2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}

              {/* Number for pending/active */}
              {(step.status === 'pending' || step.status === 'active') && (
                <span className="text-white font-bold">{index + 1}</span>
              )}
            </div>
          </div>

          {/* Label */}
          <span className={`text-gray-400 ${textSizeClasses[size]} ${step.status === 'active' ? 'text-indigo-400 font-medium' : ''}`}>
            {step.label}
          </span>

          {/* Connector line */}
          {index < steps.length - 1 && (
            <div className={`w-8 h-0.5 ${step.status === 'complete' || steps[index + 1].status === 'active' ? 'bg-indigo-500' : 'bg-gray-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// Skeleton with shimmer effect
interface ShimmerProps {
  className?: string;
  height?: string;
  width?: string;
}

export function Shimmer({ className = '', height = 'h-4', width = 'w-full' }: ShimmerProps) {
  return (
    <div
      className={`${width} ${height} bg-gray-800 rounded-lg relative overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-shimmer pointer-events-none" />
    </div>
  );
}

// Pulsing indicator for live updates
interface PulseIndicatorProps {
  isLive?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function PulseIndicator({ isLive = false, children, className = '' }: PulseIndicatorProps) {
  return (
    <div className={`relative ${className}`}>
      {children}

      {isLive && (
        <div className="absolute -top-1 -right-1">
          <div className="relative">
            {/* Main dot */}
            <div className="w-3 h-3 bg-red-500 rounded-full" />

            {/* Ping animation */}
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping" />
          </div>
        </div>
      )}
    </div>
  );
}

// Spinner component
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  };

  return (
    <svg
      className={`animate-spin rounded-full border-transparent border-t-indigo-500 ${sizeClasses[size]}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" className="opacity-25" />
    </svg>
  );
}
