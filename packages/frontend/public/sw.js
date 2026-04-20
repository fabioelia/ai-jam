/**
 * Service Worker for Offline Support
 *
 * Provides offline capabilities, caching strategies, and background sync
 * for progressive web app functionality.
 */

const CACHE_NAME = 'ai-jam-v1';
const RUNTIME_CACHE = 'ai-jam-runtime-v1';

// Assets to cache immediately
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// API routes to cache with network-first strategy
const NETWORK_FIRST_ROUTES = [
  /\/api\/.*/,
];

// API routes to cache with stale-while-revalidate
const STALE_WHILE_REVALIDATE_ROUTES = [
  /\/api\/projects/,
  /\/api\/features/,
  /\/api\/board/,
];

// Static assets to cache
const STATIC_ASSETS = [
  /\.(js|css|png|jpg|jpeg|svg|gif|webp|ico)$/,
  /\/assets\//,
];

// Install event - precache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );

  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - handle requests with appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and chrome-extension/devtools
  if (
    request.method !== 'GET' ||
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'devtools:'
  ) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    if (NETWORK_FIRST_ROUTES.some((route) => route.test(url.pathname))) {
      event.respondWith(networkFirst(request));
      return;
    }

    if (STALE_WHILE_REVALIDATE_ROUTES.some((route) => route.test(url.pathname))) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }

    // Default to network-only for other API routes
    event.respondWith(networkOnly(request));
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Default strategy
  event.respondWith(staleWhileRevalidate(request));
});

// ============================================
// CACHING STRATEGIES
// ============================================

// Network First - try network, fallback to cache
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

// Cache First - try cache, fallback to network
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for cache-first:', request.url);
    throw error;
  }
}

// Stale While Revalidate - serve from cache, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  // Fetch and cache in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  // Return cached response immediately if available
  if (cachedResponse) {
    // Also update cache in background
    fetchPromise.catch(() => {}); // Don't let background fetch errors affect response
    return cachedResponse;
  }

  // If no cache, wait for network
  return fetchPromise;
}

// Network Only - always fetch from network
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.log('[SW] Network only request failed:', request.url);
    throw error;
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }

    // If network response is not ok, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to index.html for SPA routing
    const indexResponse = await cache.match('/');
    if (indexResponse) {
      return indexResponse;
    }

    // Finally, show offline page
    return cache.match('/offline.html');
  } catch (error) {
    console.log('[SW] Navigation failed, trying cache:', request.url);

    // Try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to index.html
    const indexResponse = await cache.match('/');
    if (indexResponse) {
      return indexResponse;
    }

    // Show offline page
    const offlineResponse = await cache.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }

    throw error;
  }
}

// ============================================
// BACKGROUND SYNC
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Get all pending requests from IndexedDB
  const pendingRequests = await getPendingRequests();

  for (const request of pendingRequests) {
    try {
      await fetch(request.url, request.options);
      await removePendingRequest(request.id);
    } catch (error) {
      console.log('[SW] Sync failed for request:', request.id);
    }
  }
}

// Placeholder functions for IndexedDB operations
// These would be implemented with actual IndexedDB calls
async function getPendingRequests() {
  return [];
}

async function removePendingRequest(id) {
  // Implementation would delete from IndexedDB
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {
    title: 'AI Jam',
    body: 'New notification',
    icon: '/icon-192.png',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.log('[SW] Failed to parse push data');
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: '/badge-72.png',
      vibrate: [200, 100, 200],
      data: data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// ============================================
// MESSAGE HANDLING
// ============================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
