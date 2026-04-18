import { Button } from './Button.js';
import { isNetworkError, isServerError, getClientErrorMessage } from '../../api/client.js';

interface ErrorDisplayProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}

export default function ErrorDisplay({ error, onRetry, title, className = '' }: ErrorDisplayProps) {
  const message = getClientErrorMessage(error);
  const isNetwork = isNetworkError(error);
  const isServer = isServerError(error);

  const defaultTitle = isNetwork ? 'Connection Error' : isServer ? 'Server Error' : 'Error';
  const displayTitle = title || defaultTitle;

  return (
    <div className={`bg-gray-900 border border-red-900/50 rounded-xl p-8 max-w-md text-center shadow-xl animate-in zoom-in-95 duration-200 ${className}`}>
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-in scale-in duration-300">
        {isNetwork ? (
          <svg className="w-8 h-8 text-red-400 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-red-400 animate-shake" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
      </div>
      <h2 className="text-red-400 font-semibold mb-2 animate-in fade-in duration-300 delay-100">{displayTitle}</h2>
      <p className="text-gray-400 text-sm mb-6 leading-relaxed animate-in fade-in duration-300 delay-200">{message}</p>
      {onRetry && (
        <div className="animate-in fade-in duration-300 delay-300">
          <Button
            onClick={onRetry}
            variant="primary"
            className="flex items-center gap-2 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
