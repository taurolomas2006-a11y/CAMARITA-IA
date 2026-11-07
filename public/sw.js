// Retire the former cache-first policy. Never cache camera or model responses.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('inventory-scanner-')) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate' || url.pathname.includes('/models/') || url.pathname.endsWith('/sw.js')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
  }
});
