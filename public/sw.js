// public/sw.js - লাবীবের খেরোখাতা Ultra-Reliable Service Worker v17 (Zero-Contention PWA Engine)
const CACHE_NAME = 'kherokhata-cache-v17';
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/about',
  '/bookshelf',
  '/manifest.webmanifest',
  '/admin-manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/meshk-logo-day.png',
  '/images/meshk-logo-sepia.png',
  '/images/meshk-logo-dark.png',
  '/images/affan-labib.jpg'
];

// Install: Pre-cache core shell safely without aborting on single failure
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of PRECACHE_URLS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[PWA SW] Precache item skipped:', url, err);
        }
      }
    })
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart caching strategy optimized for instant app launch & exact article routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip API routes from caching
  if (url.pathname.startsWith('/api')) return;

  // Dedicated Network-First for Admin Studio to satisfy Chrome WebAPK installability without browser badge
  if (url.pathname.startsWith('/admin')) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    );
    return;
  }

  // 1. Navigation requests (HTML pages): Pure Network-First (direct route loading without jumping)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback only when network is unavailable
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const offline = await caches.match('/offline', { ignoreSearch: true });
          return (
            offline ||
            new Response(
              '<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><title>লাবীবের খেরোখাতা</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>অফলাইন মোড</h2><p>ইন্টারনেট সংযোগ চেক করুন অথবা পুনরায় লোড করুন।</p></body></html>',
              {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              }
            )
          );
        })
    );
    return;
  }

  // 2. Static Assets (CSS, JS, Fonts, Icons, Images): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cached) {
          return cached;
        }

        const networkResponse = await fetchPromise;
        if (networkResponse) return networkResponse;
        return cached || new Response('', { status: 404 });
      })()
    );
    return;
  }

  // 3. Fallback
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(request);
      } catch (err) {
        return new Response('', { status: 408 });
      }
    })()
  );
});
