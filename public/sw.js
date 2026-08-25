self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('[Service Worker] Error parsing JSON, falling back to text.', e);
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Alumni Network';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/vite.svg',
    badge: '/vite.svg',
    data: data.url || '/',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
