/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';
import {
  KILL_SWITCH,
  MAX_RUNTIME_ENTRIES,
  MAX_AGE_MS,
  runActivate,
  LRUCache,
  safeCachePut
} from '$lib/sw-core';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `cache-${version}`;
const RUNTIME_CACHE = `runtime-${version}`;
const KS_CACHE = `ks-${KILL_SWITCH}`;
const ASSETS = [...build, ...files];

const runtimeLRU = new LRUCache(MAX_RUNTIME_ENTRIES);

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      runActivate({
        cacheKeys: keys,
        appCacheName: CACHE,
        killSwitchCacheName: KS_CACHE,
        deleteCache: (name) => caches.delete(name),
        openCache: (name) => caches.open(name),
        unregister: () => sw.registration.unregister(),
        claim: () => sw.clients.claim()
      })
    )
  );
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    (async () => {
      if (ASSETS.includes(url.pathname)) {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
      }

      const runtimeCache = await caches.open(RUNTIME_CACHE);
      const cached = await runtimeCache.match(event.request);
      if (cached) {
        const dateHeader = cached.headers.get('date');
        if (dateHeader && Date.now() - new Date(dateHeader).getTime() < MAX_AGE_MS) {
          return cached;
        }
        await runtimeCache.delete(event.request);
      }

      try {
        const response = await fetch(event.request);
        if (response.status === 200 && response.type === 'basic') {
          runtimeLRU.put(url.href, (evictUrl) => runtimeCache.delete(evictUrl));
          await safeCachePut(runtimeCache, event.request, response.clone());
        }
        return response;
      } catch {
        const fallback = await runtimeCache.match(event.request);
        if (fallback) return fallback;
        throw new Error('offline and not cached');
      }
    })()
  );
});
