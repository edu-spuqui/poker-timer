// sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  
  setInterval(() => {
    const now = new Date();
    // Added 'second: 2-digit' to the formatting
    const timeString = now.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'CLOCK_TICK', time: timeString });
      });
    });
  }, 500); 
});

self.addEventListener('fetch', (event) => {});