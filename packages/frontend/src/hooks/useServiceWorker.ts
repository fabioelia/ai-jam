/**
 * Service Worker Registration Hook
 *
 * Manages PWA service worker registration, updates, and offline functionality.
 */

import { useEffect, useState, useCallback } from 'react';

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOffline: boolean;
  isUpdating: boolean;
  updateAvailable: boolean;
  error: Error | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOffline: !navigator.onLine,
    isUpdating: false,
    updateAvailable: false,
    error: null,
  });

  const [waitingServiceWorker, setWaitingServiceWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Check if service workers are supported
    const supported = 'serviceWorker' in navigator;

    setState(prev => ({ ...prev, isSupported: supported }));

    if (!supported) return;

    // Register service worker
    registerServiceWorker();

    // Listen for online/offline events
    const handleOnline = () => setState(prev => ({ ...prev, isOffline: false }));
    const handleOffline = () => setState(prev => ({ ...prev, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      });

      setState(prev => ({ ...prev, isRegistered: true }));

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setState(prev => ({ ...prev, updateAvailable: true }));
              setWaitingServiceWorker(newWorker);
            }
          });
        }
      });

      // Handle controller change (new service worker activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

    } catch (error) {
      console.error('Service worker registration failed:', error);
      setState(prev => ({ ...prev, error: error as Error }));
    }
  };

  const applyUpdate = useCallback(() => {
    if (waitingServiceWorker) {
      waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      setState(prev => ({ ...prev, isUpdating: true }));
    }
  }, [waitingServiceWorker]);

  const clearCache = useCallback(async () => {
    if (!state.isRegistered) return;

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.unregister();
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, [state.isRegistered]);

  return {
    ...state,
    applyUpdate,
    clearCache,
  };
}

/**
 * Hook for monitoring network status
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [effectiveType, setEffectiveType] = useState<string>('unknown');
  const [downlink, setDownlink] = useState<number>(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get network information if available
    const connection = (navigator as any).connection;
    if (connection) {
      setEffectiveType(connection.effectiveType);
      setDownlink(connection.downlink);

      const handleConnectionChange = () => {
        setEffectiveType(connection.effectiveType);
        setDownlink(connection.downlink);
      };

      connection.addEventListener('change', handleConnectionChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    effectiveType,
    downlink,
    isSlowConnection: effectiveType === '2g' || effectiveType === 'slow-2g',
    isDataSaver: (navigator as any).connection?.saveData || false,
  };
}

/**
 * Hook for background sync
 */
export function useBackgroundSync() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'SyncManager' in window);
  }, []);

  const registerSync = useCallback(async (tag: string) => {
    if (!isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      return true;
    } catch (error) {
      console.error('Background sync registration failed:', error);
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    registerSync,
  };
}

/**
 * Hook for push notifications
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || permission !== 'granted') return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.VITE_VAPID_PUBLIC_KEY || ''
        ),
      });
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }, [isSupported, permission]);

  return {
    isSupported,
    permission,
    requestPermission,
    subscribe,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
