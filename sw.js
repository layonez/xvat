import { precacheAndRoute } from 'workbox-precaching';

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

precacheAndRoute([{"revision":"d41d8cd98f00b204e9800998ecf8427e","url":"icons/icon-192.png"},{"revision":"d41d8cd98f00b204e9800998ecf8427e","url":"icons/icon-512.png"},{"revision":"8e3a10e157f75ada21ab742c022d5430","url":"vite.svg"}]);
