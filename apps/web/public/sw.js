/* Finny PWA: conservative offline shell, no authenticated/API caching. */
const CACHE_NAME = 'finny-pwa-shell-v1';
const SHELL = ['/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('finny-pwa-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Navigation-only handling: never intercept API calls or cached fish data.
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match('/offline.html')) || Response.error();
  }));
});
