const CACHE_NAME = 'roviaw-cloud-shell-v4-archive-source-tabs';
const APP_SHELL = ['/scan/', '/scan/manifest.webmanifest', '/scan/favicon.svg', '/scan/icons/icon-192.png', '/scan/icons/icon-512.png', '/scan/src/main.js', '/scan/src/auth.js', '/scan/src/config.js', '/scan/src/graph.js', '/scan/src/image.js', '/scan/src/onedrive.js', '/scan/src/pdf.js', '/scan/src/local-store.js', '/scan/src/styles.css'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache Microsoft Graph, sign-in, access tokens, or customer files.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/scan/api/')) return;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put('/scan/', copy)); return response;
    }).catch(() => caches.match('/scan/')));
    return;
  }
  if (url.pathname.startsWith('/scan/assets/') || url.pathname.startsWith('/scan/src/') || url.pathname.startsWith('/scan/icons/') || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg')) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); return response;
    })));
  }
});
