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
 *   - Every behaviour is auditable. No magic.
 *   - We control versioning (CACHE_VERSION bump triggers cleanup).
 *   - Smaller bundle (Workbox is ~30 kB, this is a few kB minified).
 *
 * Versioning rule: bump CACHE_VERSION whenever the runtime strategy or
 * precached asset list changes. Old caches are cleaned on activate.
 *
 * ---------------------------------------------------------------------
 * WHAT THE APP ROUTER NEEDS, AND WHY v3 COULD NOT DELIVER IT
 *
 * v3 looked correct and shipped an app that could not open offline at
 * all. Three things have to be in the cache before a signed-in screen
 * will render with no signal, and v3 reliably held none of them:
 *
 *   (a) THE HTML DOCUMENT for that route. The precache list held only
 *       `/`, `/login`, `/register`, `/verify`, `/welcome` — the
 *       logged-OUT routes. Every screen a farmer actually uses was
 *       absent. A document reached this cache only if the farmer had
 *       done a full browser reload while standing on it, because in the
 *       App Router an in-app tap is a client-side transition and never
 *       issues a navigation request at all.
 *
 *   (b) THE RSC PAYLOAD for that route. The App Router fetches
 *       `/home?_rsc=<hash>` to render a route client-side. v3 had no
 *       case for these, so they fell to stale-while-revalidate, where
 *       a miss with no network resolved to `undefined` and
 *       `respondWith(undefined)` threw. The router read that as a dead
 *       link and fell back to a hard navigation — which is how a farmer
 *       tapping "Record" ended up looking at offline.html.
 *
 *   (c) THE JS CHUNKS. Every static asset shared one 50-entry cache
 *       with LRU eviction, and a Next build has several hundred. The
 *       eviction runs oldest-first, and the oldest entries are the boot
 *       chunks loaded at startup — so the cache evicted precisely the
 *       files without which nothing can start.
 *
 * So v4 keeps documents, RSC payloads and build output in separate
 * caches with separate rules; immutable build output is never evicted
 * to make room for a page the farmer opened once; and the app prewarms
 * the core routes after sign-in so the first trip out to the pens works
 * even if the farmer has never reloaded on those screens.
 */

const CACHE_VERSION = 'fsm-v4';
const SHELL_CACHE = `${CACHE_VERSION}-shell`; // precached documents + icons
const PAGES_CACHE = `${CACHE_VERSION}-pages`; // runtime documents + RSC payloads
const STATIC_CACHE = `${CACHE_VERSION}-static`; // immutable build output
const ASSET_CACHE = `${CACHE_VERSION}-asset`; // other same-origin media
const API_CACHE = `${CACHE_VERSION}-api`;

/**
 * Documents fetched at install time.
 *
 * These are the routes a farmer can land on cold with no signal: the
 * launcher icon's start_url, the signed-out routes, and the signed-in
 * screens that carry the day's work. Every page in this app is a client
 * component and there is no middleware, so each of these is a plain
 * static document that the server will hand over without a session —
 * which is what makes precaching them possible at all.
 *
 * Dynamic routes (`/cycles/<id>`, `/pens/<id>`) cannot appear here;
 * they are cached as the farmer opens them, and prewarmed from the app
 * for the cycle they are actually working on.
 */
const PRECACHE_DOCUMENTS = [
  '/',
  '/login',
  '/register',
  '/verify',
  '/welcome',
  '/home',
  '/menu',
  '/cycles',
  '/pens-flocks',
  '/pens',
  '/flocks',
  '/farms',
  '/reports',
  '/expenses',
  '/sales',
  '/profile',
  '/settings',
  '/sync',
];

/**
 * Non-document files the shell needs. Separated from the documents
 * because a failure here is cosmetic, while a failure there is the app
 * not opening.
 */
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/logo.png',
  '/logo.svg',
  '/notification-icon.png',
  '/badge.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
];

/**
 * Entry caps.
 *
 * STATIC holds immutable build output and is sized to carry roughly two
 * deploys, not to be a budget. It used to share a 50-entry cap with
 * everything else, which evicted the boot chunks and left an app that
 * could not start. Nothing the farmer browses is ever allowed to push a
 * chunk out again.
 */
const PAGES_MAX_ENTRIES = 160;
const STATIC_MAX_ENTRIES = 500;
const ASSET_MAX_ENTRIES = 80;
const API_MAX_ENTRIES = 100;

// -------------------- INSTALL --------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      // One at a time, not addAll.
      //
      // addAll is atomic: one 404 anywhere in the list and NOTHING is
      // cached. v3 wrapped that in a catch, so a single bad URL left an
      // empty shell cache and no sign that anything was wrong. A route
      // that fails to precache should cost us that route, not the app.
      await Promise.all(
        [...PRECACHE_DOCUMENTS, ...PRECACHE_ASSETS].map(async (url) => {
          try {
            await cacheDocument(cache, url);
          } catch (err) {
            console.warn('[sw] precache miss:', url, err);
          }
        }),
      );

      // Activate immediately on first install so the page is controlled.
      await self.skipWaiting();
    })(),
  );
});

/**
 * Fetch a URL and store it under its pathname, with the query string
 * dropped.
 *
 * The launcher opens `start_url: "/?utm_source=pwa"` and the manifest
 * shortcuts carry their own tags, so a cache keyed on the full URL
 * misses on exactly the launch the farmer performs most. Dropping the
 * query is safe here because every page is client-rendered: the server
 * returns the same document whatever the search string, and the app
 * reads the parameters from `window.location` after boot.
 */
async function cacheDocument(cache, url) {
  const response = await fetch(new Request(url, { credentials: 'same-origin' }));
  if (!response || !response.ok || response.type === 'opaqueredirect') {
    throw new Error(`bad response ${response && response.status}`);
  }
  await cache.put(documentKey(url), response);
}

function documentKey(url) {
  const u = new URL(url, self.location.origin);
  return `${u.origin}${u.pathname}`;
}

/**
 * The cache key for a route's RSC payload.
 *
 * Deliberately distinct from the document key for the same path. The
 * two are different bodies for the same URL — one is HTML, one is the
 * flight payload — and storing them under one key would hand the router
 * a document, or hand the browser a flight payload to render as a page.
 *
 * The `_rsc` hash the router appends changes between builds and router
 * states, so it is stripped: keyed on the raw URL, a farmer who visited
 * a screen an hour ago would miss their own cached copy.
 */
function rscKey(url) {
  const u = new URL(url, self.location.origin);
  return `${u.origin}${u.pathname}?__rsc=1`;
}

function isRscRequest(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
}

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

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Cross-origin requests (the API host, fonts, analytics) — bypass.
  // The API lives on another origin and has its own IndexedDB read
  // cache in the app; duplicating it here would mean two caches with
  // two ideas of the truth.
  if (url.origin !== self.location.origin) return;

  // Same-origin API GETs → network-first, cache fallback.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, url.href, API_MAX_ENTRIES));
    return;
  }

  // RSC payloads → network-first on a normalised key. This is what an
  // in-app tap actually fetches, so it is the difference between the
  // app working offline and the router giving up and hard-navigating.
  if (isRscRequest(request, url)) {
    event.respondWith(networkFirst(request, PAGES_CACHE, rscKey(url), PAGES_MAX_ENTRIES));
    return;
  }

  // Navigation requests (HTML) → network-first, fall back to the cached
  // document for this route, then to the offline page.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(navigationStrategy(request, url));
    return;
  }

  // Immutable build output → cache-first, never evicted by browsing.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, STATIC_MAX_ENTRIES));
    return;
  }

  // Other same-origin media → cache-first with a small budget.
  if (/\.(?:js|css|woff2?|png|svg|webp|ico|jpg|jpeg|gif)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, ASSET_MAX_ENTRIES));
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request, ASSET_CACHE, ASSET_MAX_ENTRIES));
});

// -------------------- STRATEGIES --------------------

/**
 * Offline and nothing cached. Returned instead of `undefined`, which
 * `respondWith` rejects with a TypeError that surfaces to the page as
 * an unexplained network failure.
 */
function offlineResponse() {
  return new Response('', {
    status: 504,
    statusText: 'Offline and not cached',
    headers: { 'Content-Type': 'text/plain' },
  });
}

async function networkFirst(request, cacheName, key, maxEntries) {
  try {
    const response = await fetch(request);
    if (response && response.ok && !response.redirected) {
      // Clone before stashing — body can only be read once.
      const cache = await caches.open(cacheName);
      await cache.put(key, response.clone());
      void enforceCacheLimit(cacheName, maxEntries);
    }
    return response;
  } catch {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(key);
    if (cached) return cached;
    return offlineResponse();
  }
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      void enforceCacheLimit(cacheName, maxEntries);
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        void cache.put(request, response.clone()).then(() => {
          void enforceCacheLimit(cacheName, maxEntries);
        });
      }
      return response;
    })
    // A miss with no network must still resolve to a Response.
    .catch(() => cached || offlineResponse());
  return cached || fetchPromise;
}

async function navigationStrategy(request, url) {
  const key = documentKey(url);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && !fresh.redirected) {
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(key, fresh.clone());
      void enforceCacheLimit(PAGES_CACHE, PAGES_MAX_ENTRIES);
    }
    return fresh;
  } catch {
    // This route, as last seen online.
    const pages = await caches.open(PAGES_CACHE);
    const cached = await pages.match(key);
    if (cached) return cached;

    // This route, as precached at install.
    const shell = await caches.open(SHELL_CACHE);
    const precached = await shell.match(key);
    if (precached) return precached;

    // Nothing for this route. Say so honestly rather than booting the
    // app at the wrong screen: serving another route's document would
    // hydrate the farmer into a page they did not ask for, which is
    // worse than a message telling them what happened.
    const offline = await shell.match(documentKey('/offline.html'));
    if (offline) return offline;
    return offlineResponse();
  }
}

/**
 * Drop the oldest entries once a cache exceeds its cap.
 *
 * Serialised per cache. Concurrent callers each used to read
 * `keys.length` before any of them deleted anything, compute the same
 * overage, and delete overlapping ranges — so a burst of requests could
 * evict several times what the cap called for.
 */
const pruning = new Map();

function enforceCacheLimit(cacheName, maxEntries) {
  if (!maxEntries) return Promise.resolve();
  const queued = (pruning.get(cacheName) || Promise.resolve())
    .then(() => prune(cacheName, maxEntries))
    .catch(() => {
      /* best effort */
    });
  pruning.set(cacheName, queued);
  return queued;
}

async function prune(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const overage = keys.length - maxEntries;
  for (let i = 0; i < overage; i += 1) {
    await cache.delete(keys[i]);
  }
}

// -------------------- PREWARM --------------------
//
// Precaching at install covers the routes we can name at build time. It
// cannot cover `/cycles/<id>/record` — the one screen the farmer opens
// in a pen with no signal — because the id is theirs.
//
// So the app tells us which routes matter to this farmer once it knows:
// after sign-in, and whenever the active cycle changes. We fetch the
// document and the RSC payload for each, which together are what the
// App Router needs to render that screen cold.
//
// Rules:
//   - Same-origin paths only. A prewarm list is a list of URLs to fetch
//     with the farmer's cookies; anything that can be pointed off-origin
//     is a way to make the browser carry their session somewhere else.
//   - Capped, so a malformed or hostile message cannot spend the
//     farmer's airtime on a thousand requests.
//   - Best effort and silent. Nothing here is worth an error on screen.

const PREWARM_MAX_URLS = 24;

async function prewarm(paths) {
  if (!Array.isArray(paths)) return;

  const safe = [];
  for (const path of paths) {
    if (typeof path !== 'string' || path.length > 512) continue;
    // Must be a root-relative path, and must not be protocol-relative
    // ("//evil.example") — which `new URL` would resolve off-origin.
    if (!path.startsWith('/') || path.startsWith('//')) continue;
    let u;
    try {
      u = new URL(path, self.location.origin);
    } catch {
      continue;
    }
    if (u.origin !== self.location.origin) continue;
    if (u.pathname.startsWith('/api/')) continue;
    const normalised = u.pathname;
    if (!safe.includes(normalised)) safe.push(normalised);
    if (safe.length >= PREWARM_MAX_URLS) break;
  }
  if (safe.length === 0) return;

  const pages = await caches.open(PAGES_CACHE);

  for (const path of safe) {
    // Sequential on purpose. This runs in the background on a phone
    // that may be on a metered connection; a burst of parallel requests
    // would compete with whatever the farmer is actually doing.
    try {
      await cacheDocument(pages, path);
    } catch {
      /* route unavailable — skip it */
    }
    try {
      const rsc = await fetch(new Request(path, {
        credentials: 'same-origin',
        headers: { RSC: '1' },
      }));
      if (rsc && rsc.ok && !rsc.redirected) {
        await pages.put(rscKey(path), rsc);
      }
    } catch {
      /* no RSC payload — the document alone still helps */
    }
  }

  void enforceCacheLimit(PAGES_CACHE, PAGES_MAX_ENTRIES);
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
  if (data.type === 'FSM_PREWARM') {
    event.waitUntil(prewarm(data.paths));
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
