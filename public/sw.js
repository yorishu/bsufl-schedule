// Service worker: офлайн-режим и установка на главный экран.
// Расписание и страница: сначала сеть, при её отсутствии кэш (чтобы видеть свежее расписание).
// Остальные файлы своего сайта (хешированные скрипты, стили, иконки): сначала кэш, обновление в фоне.
// Запросы к Firebase идут на другие домены и сюда не попадают: офлайн-кэш домашек делает сам Firestore.
const CACHE = "schedule-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => undefined);
  return cached ?? (await refresh) ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const fresh = request.mode === "navigate" || url.pathname.endsWith("/schedule.json");
  event.respondWith(fresh ? networkFirst(request) : staleWhileRevalidate(request));
});
