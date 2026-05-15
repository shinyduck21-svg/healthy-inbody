const CACHE_NAME = 'mongfit-v5';

// 캐시할 정적 자산 (이미지, 매니페스트 등 잘 안 바뀌는 것만)
const STATIC_ASSETS = [
  '/icons/icon-512.png',
  '/manifest.json'
];

// JS/CSS/HTML은 항상 네트워크 우선 (코드 변경 즉시 반영)
const NETWORK_FIRST_PATTERNS = [
  /\.js(\?.*)?$/,
  /\.css(\?.*)?$/,
  /\.html(\?.*)?$/
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // JS/CSS/HTML: 항상 네트워크에서 가져오고, 실패 시에만 캐시 사용
  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some((pattern) => pattern.test(url));

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // 네트워크 성공 시 캐시 업데이트 후 반환
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request)) // 오프라인 시 캐시 폴백
    );
  } else {
    // 이미지 등: 캐시 우선
    event.respondWith(
      caches.match(event.request).then((response) => response || fetch(event.request))
    );
  }
});
