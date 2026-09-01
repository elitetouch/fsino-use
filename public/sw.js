/* eslint-disable no-restricted-globals */
/**
 * FarmSpeak service worker.
 *
 * Responsibilities:
 *   1. Precache the app shell so the UI renders instantly when offline.
 *   2. Runtime-cache /api GET responses (network-first, fallback to cache).
 *   3. Runtime-cache static assets (cache-first).
 *   4. Register Background Sync (Chrome) so the outbox drains even when
 *      the tab is closed.
 *   5. Forward "skip waiting" messages so we can roll out updates.
 *   6. Notify clients when a new version is ready.
 *
 * Why hand-rolled (not Workbox):
 *   - Every behaviour is auditable in <300 lines. No magic.
 *   - We control versioning (CACHE_VERSION bump triggers cleanup).
 *   - Smaller bundle (Workbox is ~30 kB, this is ~3 kB minified).
 *
 * Versioning rule: bump CACHE_VERSION whenever the runtime strategy or
 * precached asset list changes. Old caches are cleaned on activate.
 */

const CACHE_VERSION = 'fsm-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Files that must be available offline for the app to boot.
// Next.js fingerprints its JS/CSS, so we only precache stable routes
// here — Next handles hashed bundle caching via the runtime strategy.
const PRECACHE_URLS = [
  '/',
  '/login',
  '/register',
  '/verify',
  '/welcome',
  '/offline.html',
  '/manifest.webmanifest',
  '/logo.png',
  '/logo.svg',
  '/notification-icon.png',
  '/badge.png',
];

// Maximum number of entries to keep in each runtime cache. LRU eviction
// keeps storage usage predictable on iOS Safari (~50 MB quota for
// non-installed PWAs).
const RUNTIME_MAX_ENTRIES = 50;
const API_MAX_ENTRIES = 100;

// -------------------- INSTALL --------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is atomic — any failure aborts the install, so a bad URL
      // doesn't leave a half-populated shell cache.
      await cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[sw] shell precache failed:', err);
      });
      // Activate immediately on first install so the page is controlled.
      await self.skipWaiting();
    })(),
  );
});

// -------------------- ACTIVATE --------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      // Take control of existing clients without requiring reload.
      await self.clients.claim();
    })(),
  );
});

// -------------------- FETCH --------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET — POST/PATCH/DELETE go straight to network and are
  // handled by the offline outbox layer in the app, not here.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin requests (logos from CDN, analytics, etc.) — bypass.
  if (url.origin !== self.location.origin) return;

  // API GETs → network-first, cache fallback.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, API_MAX_ENTRIES));
    return;
  }

  // Navigation requests (HTML) → network-first, fall back to cached
  // shell + offline page so the app still loads when offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(navigationStrategy(request));
    return;
  }

  // Hashed/fingerprinted Next.js assets → cache-first (immutable).
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE, RUNTIME_MAX_ENTRIES));
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, RUNTIME_MAX_ENTRIES));
});

// -------------------- STRATEGIES --------------------

async function networkFirst(request, cacheName, maxEntries) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // Clone before stashing — body can only be read once.
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      enforceCacheLimit(cacheName, maxEntries);
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // No cached fallback — re-throw so the app can show its offline UI.
    throw err;
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      enforceCacheLimit(cacheName, maxEntries);
    }
    return response;
  } catch (err) {
    // No cache, no network → surface the error to the client.
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, response.clone());
          enforceCacheLimit(cacheName, maxEntries);
        });
      }
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

async function navigationStrategy(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, fresh.clone());
      return fresh;
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Final fallback: serve the offline page if we precached one.
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    throw err;
  }
}

/**
 * Simple LRU enforcement — drop oldest entries when we exceed maxEntries.
 * Runs async, doesn't block the response.
 */
async function enforceCacheLimit(cacheName, maxEntries) {
  if (!maxEntries) return;
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const overage = keys.length - maxEntries;
    for (let i = 0; i < overage; i++) {
      await cache.delete(keys[i]);
    }
  } catch {
    /* no-op — best effort */
  }
}

// -------------------- BACKGROUND SYNC --------------------
// Chrome only. Fired when the user is back online — fires even if the
// tab is closed. iOS Safari has no equivalent; the app-side sync engine
// handles the foreground case for everyone.

self.addEventListener('sync', (event) => {
  if (event.tag === 'fsm-outbox-drain') {
    event.waitUntil(notifyClientsToDrain());
  }
});

async function notifyClientsToDrain() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({ type: 'FSM_DRAIN_OUTBOX' });
  }
}

// -------------------- MESSAGE BRIDGE --------------------

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      })(),
    );
  }
});

// -------------------- PUSH NOTIFICATIONS --------------------
//
// The backend sends PushMessage::toArray() as the encrypted payload:
//   { title, body, url, tag, severity, requireInteraction, data }
//
// `tag` is what stops an alert stacking. A recurring problem reuses its
// (flock, rule) tag, so a second notification REPLACES the first in the
// tray rather than adding to it. Without this a farmer whose pen is
// genuinely too hot wakes up to a screen of identical warnings.

self.addEventListener('push', (event) => {
  event.waitUntil(showPush(event));
});

async function showPush(event) {
  let payload = {};

  // A push with no data, or with a body we can't parse, must still
  // surface SOMETHING. A silent failure here is indistinguishable from
  // push being broken, and this is the one code path nobody is watching
  // when it runs.
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'Farm Support Innovation';
  const url = payload.url || '/';

  await self.registration.showNotification(title, {
    body: payload.body || 'Open the app to see what changed.',
    // Full-colour mark on a white circle. The raw logo is transparent,
    // so on a dark notification shade the dark-green strokes vanished
    // into the background — the circle is what guarantees contrast in
    // both light and dark mode. Text lockup removed: at this size it is
    // sub-pixel noise, and dropping it lets the mark render far larger.
    icon: '/notification-icon.png',

    // MUST be a bold monochrome silhouette, not the logo. Android
    // discards colour and masks the badge using only the alpha channel,
    // so the detailed logo (cloud + animals + wifi + two lines of text)
    // flattened into one white blob at 24dp. This is the signal mark
    // alone, which is the one element that survives that treatment.
    badge: '/badge.png',
    tag: payload.tag || 'fsi-general',

    // Replace a same-tag notification silently. Re-alerting the device
    // (vibrate + sound) for what is the SAME ongoing problem is how a
    // useful alert becomes one the farmer swipes away on reflex.
    renotify: false,

    // High/critical stay until acknowledged — a farmer asleep when birds
    // start dying should still find it in the morning.
    requireInteraction: payload.requireInteraction === true,

    // Carried through to notificationclick, which is a separate event
    // with no access to this scope.
    data: { url, ...(payload.data || {}) },
  });
}

// -------------------- NOTIFICATION CLICK --------------------
//
// Focus an already-open tab rather than opening another one. A farmer
// who taps four alerts should not end up with four copies of the app,
// each with its own React Query cache and its own idea of the truth.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openApp(event.notification.data?.url || '/'));
});

async function openApp(url) {
  const target = new URL(url, self.location.origin);

  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of clientList) {
    // Same origin — reuse this window. `navigate` needs the client to be
    // focusable; it throws on some platforms, so fall back to a plain
    // focus rather than losing the tap entirely.
    if (new URL(client.url).origin === target.origin && 'focus' in client) {
      try {
        await client.navigate(target.href);
      } catch {
        // Navigation refused — at least bring the app forward.
      }
      return client.focus();
    }
  }

  return self.clients.openWindow(target.href);
}

// -------------------- SUBSCRIPTION CHANGE --------------------
//
// Browsers rotate push endpoints on their own schedule, without telling
// the user. When that happens the old endpoint dies and the farmer
// silently stops receiving alerts — the single most common way push
// "just stops working" in production.
//
// The service worker gets one chance to notice. We can't call the API
// from here (no auth token in SW scope), so we tell every open client to
// re-register; the app also re-registers on every launch, which covers
// the case where no tab is open when this fires.

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'FSM_PUSH_RESUBSCRIBE' });
      }
    })(),
  );
});
