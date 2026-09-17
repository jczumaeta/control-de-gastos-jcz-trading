const CACHE_NAME = 'gastos-cache-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isAppCode = requestUrl.pathname.endsWith('/app.js') || requestUrl.pathname.endsWith('/styles.css') || requestUrl.pathname.endsWith('/index.html');

  event.respondWith(
    isAppCode
      ? fetch(event.request).then((response) => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        return response;
      }).catch(() => caches.match(event.request))
      : caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
