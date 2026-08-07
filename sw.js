// MEB Field Forms — offline cache
// CACHE_NAME still gets bumped whenever assets change, so old caches get
// cleaned out on activate — but the fetch strategy below means visitors no
// longer have to wait for that; a fresh deploy is picked up immediately
// whenever they have a signal, and the cache is just the offline fallback.
const CACHE_NAME = 'meb-field-forms-v2';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isPage = event.request.mode === 'navigate' ||
    event.request.url.endsWith('/') ||
    event.request.url.endsWith('index.html');

  if (isPage) {
    // Network-first for the main app: always try to get the latest version
    // when online. Only fall back to the cached copy if there's no signal.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icon, manifest) — these rarely change.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
