const CACHE_NAME = 'qq-farm-timer-pwa-v3';
const APP_VERSION = '1.3.0'; // 应用版本号，每次更新时修改
const APP_LAUNCH_URL = './index.html?source=pwa';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './plants-data.js',
  './cloud-sync.js',
  './manifest.webmanifest',
  './icons/icon-32-v2.png',
  './icons/icon-180-v2.png',
  './icons/icon-192-v2.png',
  './icons/icon-512-v2.png'
];

// 后台闹钟检查定时器
let alarmCheckInterval = null;
const ALARM_CHECK_INTERVAL = 10000; // 每10秒检查一次（后台模式）

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();

  // 启动后台闹钟检查
  startBackgroundAlarmCheck();

  // 通知所有客户端新版本已激活
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'SW_ACTIVATED',
        version: APP_VERSION
      });
    });
  });
});

// 启动后台闹钟检查
function startBackgroundAlarmCheck() {
  if (alarmCheckInterval) {
    clearInterval(alarmCheckInterval);
  }

  alarmCheckInterval = setInterval(() => {
    checkAlarmsInBackground();
  }, ALARM_CHECK_INTERVAL);

  console.log('[Service Worker] 后台闹钟检查已启动');
}

// 后台检查闹钟
async function checkAlarmsInBackground() {
  try {
    // 通知所有客户端检查闹钟
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.length > 0) {
      clients.forEach((client) => {
        client.postMessage({
          type: 'CHECK_ALARMS'
        });
      });
    }
  } catch (error) {
    console.error('[Service Worker] 检查闹钟失败:', error);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// 处理来自客户端的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification?.close();

  const targetUrl = event.notification?.data?.url || APP_LAUNCH_URL;
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetHref = new URL(targetUrl, self.location.origin).href;
    const sameOriginClient = allClients.find((client) => client.url.startsWith(self.location.origin));

    if (sameOriginClient) {
      await sameOriginClient.focus();
      if ('navigate' in sameOriginClient && typeof sameOriginClient.navigate === 'function') {
        await sameOriginClient.navigate(targetHref);
      }
      return;
    }

    await clients.openWindow(targetUrl);
  })());
});
