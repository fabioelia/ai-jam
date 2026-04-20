import { useState, useEffect, useCallback } from 'react';

interface NetworkStatusProps {
  showIndicator?: boolean;
}

export default function NetworkStatus({ showIndicator = true }: NetworkStatusProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleOnline = useCallback(() => {
    setIsReconnecting(true);
    // Small delay to actually test the connection
    setTimeout(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        setIsReconnecting(false);
        // Show success state briefly
        setTimeout(() => setShowBanner(false), 3000);
      } else {
        setIsReconnecting(false);
      }
    }, 1000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setShowBanner(true);
    setIsReconnecting(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Test actual connectivity periodically
  useEffect(() => {
    const checkConnection = async () => {
      if (!navigator.onLine) return;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('/api/health', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok && isOnline) {
          handleOffline();
        }
      } catch {
        if (isOnline) {
          handleOffline();
        }
      }
    };

    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [isOnline, handleOffline]);

  const handleRetry = async () => {
    setIsReconnecting(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        handleOnline();
      } else {
        setIsReconnecting(false);
      }
    } catch {
      setIsReconnecting(false);
    }
  };

  if (!showBanner && isOnline) {
    if (!showIndicator) return null;
    // Show subtle online indicator
    return (
      <div
        className="fixed bottom-4 left-4 z-[99] flex items-center gap-2 px-3 py-1.5 bg-green-900/80 backdrop-blur-sm border border-green-700/50 rounded-full text-xs text-green-400 animate-in fade-in duration-300"
        role="status"
        aria-live="polite"
      >
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        Online
      </div>
    );
  }

  if (!showBanner) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300"
      role="alert"
      aria-live="assertive"
    >
      {isOnline ? (
        // Reconnected success state
        <div className="flex items-center gap-3 px-4 py-3 bg-green-900/95 backdrop-blur-sm border border-green-700 rounded-lg shadow-xl">
          <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">Back online</p>
            <p className="text-green-400/80 text-sm">Connection restored</p>
          </div>
        </div>
      ) : (
        // Offline state
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-900/95 backdrop-blur-sm border border-amber-700 rounded-lg shadow-xl">
          <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
            {isReconnecting ? (
              <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-white font-medium">No internet connection</p>
            <p className="text-amber-400/80 text-sm">Changes will be synced when you reconnect</p>
          </div>
          <button
            onClick={handleRetry}
            disabled={isReconnecting}
            className="ml-4 px-3 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 rounded text-sm font-medium text-white transition-colors"
          >
            {isReconnecting ? 'Checking...' : 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
}

// Hook for checking network status
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
