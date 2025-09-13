const CACHE_NAME = 'gas-transfer-v1.2.0';
const RUNTIME_CACHE = 'gas-transfer-runtime-v1.2.0';

// Core app shell files that should always be cached
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// KaTeX assets for equation rendering
const KATEX_ASSETS = [
  'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/fonts/KaTeX_Main-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/fonts/KaTeX_Math-Italic.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/fonts/KaTeX_Size1-Regular.woff2',
];

// Install event - cache app shell and KaTeX assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(APP_SHELL);
      }),
      caches.open(RUNTIME_CACHE).then(cache => {
        console.log('Service Worker: Caching KaTeX assets');
        return cache.addAll(KATEX_ASSETS.map(url => new Request(url, { mode: 'cors' })));
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        if (APP_SHELL.some(url => event.request.url.endsWith(url))) {
          fetch(event.request).then(response => {
            if (response.ok) {
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, response.clone());
              });
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      return fetch(event.request).then(response => {
        if (!response.ok) return response;

        const responseClone = response.clone();

        if (event.request.destination === 'image' || 
            event.request.destination === 'font' ||
            event.request.url.includes('katex')) {
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Received skip waiting message');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_PRESET') {
    const presetData = event.data.preset;
    caches.open(RUNTIME_CACHE).then(cache => {
      const presetRequest = new Request(`/preset-${Date.now()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const presetResponse = new Response(JSON.stringify(presetData), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(presetRequest, presetResponse);
    });
  }
});