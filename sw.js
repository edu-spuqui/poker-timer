const CACHE_NAME = 'psop-v1';
const ASSETS = [
  './pokertimer.html',
  './manifest.json',
  './icon.png',
  './alarm.mp3',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap'
];

// Install: Cache all the poker gear
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch: THE IMPORTANT PART - Actually serves files from cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});