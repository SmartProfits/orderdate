const CACHE_NAME = 'smartprofits-inventory-v1';
const ASSETS = [
  './',
  './index.html',
  './inventory.html',
  './login.html',
  './manifest.json',
  './icons/inventory-icon.png'
  // Add other resources like CSS, JS, images, etc.
];

// Install Service Worker and cache core resources
self.addEventListener('install', event => {
  console.log('Installing new version Service Worker: ' + CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('Resources cached, skipping waiting stage');
        return self.skipWaiting();
      })
  );
});

// When Service Worker is activated, clean up old caches
self.addEventListener('activate', event => {
  console.log('Activating new version Service Worker: ' + CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Now using new cache, claiming all clients immediately');
      return self.clients.claim();
    })
  );
});

// Intercept network requests, implement different caching strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Use network-first strategy for HTML files
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && 
       event.request.headers.get('accept').includes('text/html'))) {
    console.log('Using network-first strategy for HTML request:', url.pathname);
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // If network fetch succeeds, update cache
          if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              console.log('Updating HTML cache:', url.pathname);
              cache.put(event.request, clonedResponse);
            });
          }
          return networkResponse;
        })
        .catch(error => {
          console.log('Network request failed, using cache:', url.pathname, error);
          // If network request fails, try to get from cache
          return caches.match(event.request);
        })
    );
  } else {
    // Use cache-first strategy for other resources
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // If response found in cache, return it
          if (response) {
            return response;
          }
          // Otherwise, fetch from network
          return fetch(event.request)
            .then(networkResponse => {
              // If fetch succeeds, clone the response to the cache
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            })
            .catch(error => {
              console.error('Fetch failed:', error);
              // Could return an offline page or default response here
              // return caches.match('./offline.html');
            });
        })
    );
  }
});

// Listen for messages, handle update notifications
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Received skip waiting request, activating now');
    self.skipWaiting();
  }
}); 