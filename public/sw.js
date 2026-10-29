// public/sw.js - লাবীবের খেরোখাতা Ultra-Reliable Service Worker v36 (Zero-Crash Instant Launch Engine)
const CACHE_NAME = 'kherokhata-cache-v36';
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

// Install: Pre-cache core shell before activating to ensure zero cold-start failures
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
          PRECACHE_URLS.map(async (url) => {
            try {
              const res = await fetch(url, { cache: 'no-cache' });
              if (res && res.status === 200) {
                await cache.put(url, res);
              }
            } catch (err) {
              console.warn('[PWA SW] Precache item skipped:', url);
            }
          })
        );
      } catch (e) {}

      // Once the shell is safely cached, activate immediately
      self.skipWaiting();

      // Dynamic precache of published articles in the background
      try {
        const postsRes = await fetch('/api/posts');
        if (postsRes && postsRes.ok) {
          const postsData = await postsRes.json();
          if (postsData && Array.isArray(postsData.posts)) {
            const cache = await caches.open(CACHE_NAME);
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
    })()
  );
});

// Activate: Disable navigationPreload to prevent Chromium cold-start white screen bugs, clean old caches safely
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Chromium bugfix: Disable navigationPreload to prevent cold-start standalone WebAPK crash/freeze
      if ('navigationPreload' in self.registration) {
        try {
          await self.registration.navigationPreload.disable();
        } catch (e) {}
      }

      // Safely purge obsolete kherokhata caches
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key.startsWith('kherokhata-cache')) {
              console.log('[PWA SW] Purging old cache:', key);
              return caches.delete(key);
            }
          })
        );
      } catch (e) {}

      await self.clients.claim();
    })()
  );
});

// Fetch: Rock-solid navigation & static asset handling (zero blank screen guarantee)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. API routes handling
  if (url.pathname.startsWith('/api')) {
    if (request.method === 'GET' && url.pathname.startsWith('/api/posts')) {
      event.respondWith(
        (async () => {
          try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
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
    // Allow mutation APIs to pass directly to network
    return;
  }

  // 2. Dedicated Network-First for Admin Studio
  if (url.pathname.startsWith('/admin')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return networkResponse;
        } catch (err) {
          const cachedAdmin = await caches.match(request, { ignoreSearch: true }) || await caches.match('/admin', { ignoreSearch: true });
          if (cachedAdmin) return cachedAdmin;
          return caches.match('/offline') || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // 3. Navigation requests (HTML pages): Safe Network-First with Comprehensive Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Generous 5000ms timeout for mobile 3G/4G stability
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone()).catch(() => {});
            return networkResponse;
          }
        } catch (e) {
          // Network failed or timed out: fall back gracefully to cache
        }

        // Cache fallback 1: Check active cache for exact route
        const activeCache = await caches.open(CACHE_NAME);
        let cachedResponse = await activeCache.match(request, { ignoreSearch: true });
        if (!cachedResponse && (url.pathname === '/' || url.pathname === '')) {
          cachedResponse = await activeCache.match('/', { ignoreSearch: true });
        }
        if (cachedResponse) return cachedResponse;

        // Cache fallback 2: Check any cache across versions
        const anyMatch = await caches.match(request, { ignoreSearch: true }) || await caches.match('/', { ignoreSearch: true });
        if (anyMatch) return anyMatch;

        // Cache fallback 3: Render offline page
        const offline = await caches.match('/offline', { ignoreSearch: true });
        if (offline) return offline;

        // Emergency fallback shell: styled, Bengali, self-reloading
        return new Response(
          '<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>লাবীবের খেরোখাতা</title><style>body{font-family:system-ui,sans-serif;text-align:center;padding:50px 20px;background:#FAF8F5;color:#1c1917}h2{font-size:22px;margin-bottom:8px}p{color:#78716c;font-size:14px}button{margin-top:20px;padding:12px 24px;background:#9A3412;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer}</style></head><body><h2>লাবীবের খেরোখাতা</h2><p>পেজটি প্রস্তুত হচ্ছে। ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চাপ দিন।</p><button onclick="window.location.reload()">পুনরায় লোড করুন</button></body></html>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      })()
    );
    return;
  }

  // 4. Static Assets (CSS, JS, Fonts, Icons, Images): Stale-While-Revalidate
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
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
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

  // 5. Default Fallback
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

// Skip waiting on explicit client message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
