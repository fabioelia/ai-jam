import { useState, useCallback } from 'react';

interface UseRetryOptions {
  maxRetries?: number;
  delay?: number;
  onRetry?: (attempt: number) => void;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useRetry({
  maxRetries = 3,
  delay = 1000,
  onRetry,
  onSuccess,
  onError,
}: UseRetryOptions = {}) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastError, setLastError] = useState<unknown>(null);

  const execute = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          setIsRetrying(attempt > 0);
          const result = await fn();
          setRetryCount(0);
          setLastError(null);
          if (attempt > 0) {
            onSuccess?.();
          }
          return result;
        } catch (error) {
          lastError = error;
          setLastError(error);

          if (attempt < maxRetries) {
            const currentAttempt = attempt + 1;
            setRetryCount(currentAttempt);
            onRetry?.(currentAttempt);

            // Exponential backoff
            const currentDelay = delay * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, currentDelay));
          }
        }
      }

      setIsRetrying(false);
      onError?.(lastError);
      return null;
    },
    [maxRetries, delay, onRetry, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
    setLastError(null);
  }, []);

  const canRetry = retryCount < maxRetries;

  return {
    execute,
    reset,
    retryCount,
    isRetrying,
    lastError,
    canRetry,
  };
}
