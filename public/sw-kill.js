self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  await self.registration.unregister();
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(c => c.navigate(c.url));
  });
});
