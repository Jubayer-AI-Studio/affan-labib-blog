// public/sw.js - লাবীবের খেরোখাতা Ultra-Reliable Service Worker v30 (True 0ms Instant PWA Launch Engine)
const CACHE_NAME = 'kherokhata-cache-v30';
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/about',
  '/bookshelf',
  '/search',
  '/admin',
  '/manifest.webmanifest',
  '/admin-manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable.png',
  '/icons/apple-touch-icon.png',
  '/images/affan-labib.jpg',
  '/images/og-affan-labib-v4.jpg',
  '/images/meshk-logo-day.png',
  '/images/meshk-logo-sepia.png',
  '/images/meshk-logo-dark.png'
];

// Install: Pre-cache core shell in parallel without blocking on single failure
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Precache Core Shell in parallel
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            console.warn('[PWA SW] Precache item skipped:', url, err);
          }
        })
      );

      // 2. Precache all published articles dynamically for 100% full offline reading
      try {
        const postsRes = await fetch('/api/posts');
        if (postsRes && postsRes.ok) {
          const postsData = await postsRes.json();
          if (postsData && Array.isArray(postsData.posts)) {
            await Promise.allSettled(
              postsData.posts.map(async (p) => {
                if (p && p.slug) {
                  return cache.add('/' + p.slug).catch(() => {});
                }
              })
            );
          }
        }
      } catch (e) {}
    })
  );
});

// Activate: Enable Navigation Preload, clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if ('navigationPreload' in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (e) {}
      }
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[PWA SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch: Smart caching strategy optimized for instant app launch & exact article routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // API routes handling: Offline cache fallback for GET /api/posts, pass-through for mutations
  if (url.pathname.startsWith('/api')) {
    if (request.method === 'GET' && url.pathname.startsWith('/api/posts')) {
      event.respondWith(
        (async () => {
          try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          } catch (err) {
            const cached = await caches.match(request);
            if (cached) return cached;
            return new Response(JSON.stringify({ success: true, posts: [] }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        })()
      );
      return;
    }
    return;
  }

  // Dedicated Network-First with Cache Fallback for Admin Studio (Full Offline Author Studio)
  if (url.pathname.startsWith('/admin')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        } catch (err) {
          const cachedAdmin = await caches.match(request, { ignoreSearch: true }) || await caches.match('/admin', { ignoreSearch: true });
          if (cachedAdmin) return cachedAdmin;
          return caches.match('/offline');
        }
      })()
    );
    return;
  }

  // 1. Navigation requests (HTML pages): True 0ms Instant Cache-First with Background Revalidation
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // Step A: Instant 0ms Cache Resolution
        let cachedResponse = await caches.match(request, { ignoreSearch: true });
        if (!cachedResponse && (url.pathname === '/' || url.pathname === '')) {
          cachedResponse = await caches.match('/', { ignoreSearch: true });
        }

        // Step B: Background revalidation fetch (non-blocking, updates cache silently)
        const backgroundFetchPromise = (async () => {
          try {
            let networkResponse = null;
            if (event.preloadResponse) {
              networkResponse = await event.preloadResponse;
            }
            if (!networkResponse) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3500);
              networkResponse = await fetch(request, { signal: controller.signal });
              clearTimeout(timeoutId);
            }
            if (networkResponse && networkResponse.status === 200) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          } catch (e) {
            return null;
          }
        })();

        // CRITICAL 0ms INSTANT PWA LAUNCH:
        // If cached copy exists, RETURN IT IMMEDIATELY in 0ms!
        if (cachedResponse) {
          event.waitUntil(backgroundFetchPromise);
          return cachedResponse;
        }

        // If not in cache (cold first visit), wait for network
        const networkResponse = await backgroundFetchPromise;
        if (networkResponse) return networkResponse;

        // Fallback to cached homepage if available
        const homeFallback = await caches.match('/', { ignoreSearch: true });
        if (homeFallback) return homeFallback;

        // Final fallback to offline page
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
      })()
    );
    return;
  }

  // 2. Static Assets (CSS, JS, Fonts, Icons, Images): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.webmanifest') ||
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

// Instant update trigger: skip waiting on demand
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

