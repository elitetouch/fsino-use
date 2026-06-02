# Offline-first architecture

FarmSpeak's web app is offline-first by design. Farmers in pens with patchy data still log records — the local outbox stores writes until the network returns, then the sync engine drains it.

This file is the single source of truth for the offline subsystem. Read it before changing anything in `src/lib/offline/`, `public/sw.js`, or `public/manifest.webmanifest`.

---

## What's included

| Concern | Lives in | Status |
|---|---|---|
| PWA install (Android Chrome) | `public/manifest.webmanifest` | ✅ |
| iOS Add to Home Screen prompt | `src/components/offline/ios-install-prompt.tsx` | ✅ |
| App shell offline | `public/sw.js` + precached routes | ✅ |
| Read cache (GETs) | `src/lib/offline/cache.ts` | ✅ |
| Write outbox (POST/PATCH/DELETE) | `src/lib/offline/queue.ts` | ✅ |
| Idempotency keys | `src/lib/offline/idempotency.ts` | ✅ (client) — needs backend dedupe to fully prevent doubles |
| Network state detection | `src/lib/offline/network.ts` | ✅ |
| Sync engine | `src/lib/offline/sync.ts` | ✅ |
| Background Sync (Chrome only) | `public/sw.js` | ✅ |
| Conflict resolution UI | (per-feature, to build with the forms) | ⚠ Foundation only |
| Persistent storage request | `src/lib/offline/db.ts` | ✅ |
| Storage quota monitoring | `src/lib/offline/db.ts` | ✅ |

---

## Public API

```ts
import {
  getOffline,      // GET with cache fallback when offline
  mutateOffline,   // POST/PATCH/DELETE with outbox queue when offline
  useOnline,       // boolean, true when network probe verified
  useOnlineTransition, // adds justReconnected flag
  useOutboxSize,   // total pending count for badge UIs
  useOutbox,       // full outbox list for the sync screen
  drain,           // manual sync trigger
  retryOutboxEntry,
  discardOutboxEntry,
  requestPersistentStorage,
  getStorageQuota,
} from '@/lib/offline';
```

### Typical read

```ts
const { data, stale, fromCache } = await getOffline<{ farms: Farm[] }>(
  '/farms',
  { staleMs: 60_000 },
);
// Show data; if stale or fromCache, render a subtle "refreshing" indicator.
```

### Typical write

```ts
const { sentNow, key } = await mutateOffline({
  method: 'POST',
  url: '/farms',
  body: { name: 'Sunrise Farm', country_code: 'NG' },
  scope: 'farm:new',
  rollback: { localTempId: 'temp-123' },
});

if (sentNow) {
  // server processed it; you have data
} else {
  // queued — show optimistic UI with a "syncing" pill
}
```

---

## Backend cooperation needed for full bulletproofing

The client does its share. To close the loop, the backend should:

### 1. Honor `Idempotency-Key` header on mutating routes

Every queued mutation is sent with a unique `Idempotency-Key` header AND `_idempotencyKey` in the body. The server should:

- Look up the key in a 24-hour Redis/DB cache
- If found, return the cached response (don't reprocess)
- If not found, process the request and store the response keyed by the idempotency key

Without this, a request that the server processed but whose response was lost will be retried and create a duplicate.

**Suggested middleware (Laravel sketch):**
```php
$key = $request->header('Idempotency-Key');
if ($key && $cached = Cache::get("idem:$key")) {
    return response()->json($cached['body'], $cached['status']);
}
$response = $next($request);
if ($key) Cache::put("idem:$key", [...], 86400);
return $response;
```

### 2. Return `409 Conflict` on stale writes

When a client tries to update a resource with a version/revision lower than the server's current state, return `409` with a body like:
```json
{ "message": "Conflict", "current": { ... }, "your": { ... } }
```
The client parks the entry as `conflict` for user resolution.

### 3. Health endpoint at `/api/v1/health`

The client probes this URL to verify actual reachability (since `navigator.onLine` lies). Should be:
- Public (no auth)
- Cheap (no DB query)
- Returns 200 fast

### 4. Append-only events where possible

For operations like "log feed 50kg today", the server should append an event row, not mutate flock state. This makes them naturally idempotent and conflict-free.

---

## iOS Safari specifics

iOS Safari has the strictest offline constraints. Things to know:

| Constraint | Mitigation |
|---|---|
| No Background Sync API | App handles drain on visibilitychange + interval. Drains start the moment the user returns to the tab. |
| Storage evicted after 7 days inactivity | `IosInstallPrompt` nudges users to Add to Home Screen; standalone storage is persistent. |
| `navigator.storage.persist()` always returns false | We try anyway; iOS users get persistent storage via standalone mode. |
| BroadcastChannel unavailable < 15.4 | Fall back to localStorage heartbeat lock for tab coordination. |
| Service worker scope quirks | We register at `/` and let the SW control everything. |
| No `BeforeInstallPromptEvent` | We show our own instructional prompt 8s after first load. |

---

## Schema versioning

`db.ts` declares `DB_VERSION = 1`. When schema changes:

1. Increment `DB_VERSION`.
2. Add a migration branch in the `upgrade` callback:
   ```ts
   if (oldVersion < 2) {
     // add new store / index / field default
   }
   ```
3. **Never delete fields** that an older client might still read. Old tabs may still be active.
4. **Never reuse field names** with different semantics.

---

## Local dev

Service workers are disabled in `NODE_ENV=development` because Next's HMR doesn't play well with cached assets. Test offline behaviour against a production build:

```bash
npm run build && npm start
```

Then in Chrome DevTools:
- Application → Service Workers → check "Update on reload" while iterating
- Application → Storage → IndexedDB → fsm-offline → inspect outbox + cache
- Network tab → throttling: Offline → exercise the queue

---

## Storage budget

Conservative defaults:
- Read cache: 500 entries max, 7-day hard TTL, 5-minute soft TTL
- Outbox: unbounded (writes should always survive — eviction is the user's call)
- Service Worker runtime caches: 50 entries, LRU
- Service Worker API cache: 100 entries, LRU

Adjust in `cache.ts` and `sw.js` constants as the data shape stabilises.

---

## What's deliberately NOT done yet (and why)

- **Conflict-resolution UI** per resource: built only after the form for that resource exists. The foundation (409 → `conflict` status, retry/discard APIs) is ready.
- **`/sync` review page**: an inbox-style page listing parked + conflict entries with one-tap resolve. To build alongside the dashboard sprint.
- **Encrypted local storage**: IndexedDB is sandboxed per-origin, which is sufficient for shared-device farms today. If we ever want device-level encryption, we'd wrap writes with WebCrypto AES-GCM keyed off a user passphrase.
- **`navigator.connection` (NetworkInformation API)**: not used yet because Safari doesn't expose it. We rely on probe + events instead.
