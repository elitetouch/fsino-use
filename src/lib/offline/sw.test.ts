import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Tests for the service worker in public/sw.js.
 *
 * WHY THESE EXIST. The offline app shell was shipped broken three
 * times, and each time it looked correct on the page. It could not be
 * caught by reading the file, because the failure was never in one
 * strategy — it was in which strategy a given request reached, and what
 * was in the cache by the time it got there. Those are exactly the two
 * things a reviewer cannot see and a test can.
 *
 * The worker is loaded as source and evaluated against a fake Cache
 * API, a fake network and a fake `self`, so the real decision logic
 * runs. This does not cover Chrome's service-worker lifecycle — that
 * part was never what broke.
 */

const ORIGIN = 'https://app.example';

const SOURCE = readFileSync(
  path.resolve(__dirname, '../../../public/sw.js'),
  'utf8',
);

/* ------------------------------------------------------------------ */
/*  Fakes                                                              */
/* ------------------------------------------------------------------ */

type Keyish = string | { url: string };

function keyOf(k: Keyish): string {
  return new URL(typeof k === 'string' ? k : k.url, ORIGIN).href;
}

class FakeCache {
  map = new Map<string, Response>();
  async put(k: Keyish, res: Response) {
    // Spec behaviour: put replaces, which moves the entry to the end of
    // insertion order. The LRU prune depends on that order, so the fake
    // has to reproduce it.
    const key = keyOf(k);
    this.map.delete(key);
    this.map.set(key, res);
  }
  async match(k: Keyish) {
    return this.map.get(keyOf(k));
  }
  async keys() {
    return [...this.map.keys()].map((url) => ({ url }));
  }
  async delete(k: Keyish) {
    return this.map.delete(keyOf(k));
  }
}

class FakeCaches {
  store = new Map<string, FakeCache>();
  async open(name: string) {
    let c = this.store.get(name);
    if (!c) {
      c = new FakeCache();
      this.store.set(name, c);
    }
    return c;
  }
  async keys() {
    return [...this.store.keys()];
  }
  async delete(name: string) {
    return this.store.delete(name);
  }
}

interface SwHarness {
  fire: (type: string, event: Record<string, unknown>) => Promise<void>;
  fetchEvent: (request: Record<string, unknown>) => Promise<Response | undefined>;
  caches: FakeCaches;
  /** Paths the fake network will serve. Anything else 404s. */
  served: Set<string>;
  /** Flip to simulate losing signal. */
  online: { value: boolean };
  /** Every URL the worker asked the network for. */
  requested: string[];
  cacheNamed: (name: string) => Promise<FakeCache>;
}

function load(): SwHarness {
  const handlers: Record<string, Array<(e: unknown) => void>> = {};
  const fakeCaches = new FakeCaches();
  const served = new Set<string>();
  const online = { value: true };
  const requested: string[] = [];

  const fakeFetch = async (input: Keyish) => {
    const url = new URL(typeof input === 'string' ? input : input.url, ORIGIN);
    requested.push(url.pathname);
    if (!online.value) throw new TypeError('Failed to fetch');
    if (!served.has(url.pathname)) {
      return new Response('not found', { status: 404 });
    }
    return new Response(`body:${url.pathname}`, { status: 200 });
  };

  /**
   * A worker resolves a relative URL against its own scope, which is
   * how `new Request('/home')` works inside sw.js. Node's Request
   * rejects it, so the harness supplies one that resolves the same way
   * the browser does.
   */
  class ScopedRequest {
    url: string;
    method: string;
    headers: Headers;
    mode: string;
    destination = '';
    constructor(input: Keyish, init: Record<string, unknown> = {}) {
      this.url = keyOf(input);
      this.method = (init.method as string) ?? 'GET';
      this.headers = new Headers((init.headers as Record<string, string>) ?? {});
      this.mode = (init.mode as string) ?? 'same-origin';
    }
  }

  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      (handlers[type] ||= []).push(fn);
    },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: { showNotification: async () => {} },
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(
    'self', 'caches', 'fetch', 'console', 'Response', 'Request', 'URL', 'Map', 'Headers',
    SOURCE,
  );
  factory(self, fakeCaches, fakeFetch, { warn() {}, info() {} }, Response, ScopedRequest, URL, Map, Headers);

  const fire = async (type: string, event: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = [];
    const e = { ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) };
    for (const h of handlers[type] ?? []) h(e);
    await Promise.all(waits);
  };

  const fetchEvent = async (request: Record<string, unknown>) => {
    let responded: Promise<Response> | Response | undefined;
    const e = { request, respondWith: (p: Promise<Response> | Response) => { responded = p; } };
    for (const h of handlers.fetch ?? []) h(e);
    return responded === undefined ? undefined : await responded;
  };

  return {
    fire,
    fetchEvent,
    caches: fakeCaches,
    served,
    online,
    requested,
    cacheNamed: (name) => fakeCaches.open(name),
  };
}

function req(pathname: string, init: Record<string, unknown> = {}) {
  return {
    url: new URL(pathname, ORIGIN).href,
    method: 'GET',
    mode: 'same-origin',
    destination: '',
    ...init,
    // After the spread, never before: a caller passing plain-object
    // headers would otherwise replace the Headers instance the worker
    // calls .get() on.
    headers: new Headers((init.headers as Record<string, string>) ?? {}),
  };
}

const navigation = (pathname: string) => req(pathname, { mode: 'navigate', destination: 'document' });

/** The routes the real server serves — every one verified static in the build. */
const APP_ROUTES = [
  '/', '/login', '/register', '/verify', '/welcome', '/home', '/menu', '/cycles',
  '/pens-flocks', '/pens', '/flocks', '/farms', '/reports', '/expenses', '/sales',
  '/profile', '/settings', '/sync',
  '/offline.html', '/manifest.webmanifest', '/logo.png', '/logo.svg',
  '/notification-icon.png', '/badge.png', '/icon-192.png', '/icon-512.png',
  '/icon-maskable-192.png', '/icon-maskable-512.png',
];

/* ------------------------------------------------------------------ */

describe('service worker — offline app shell', () => {
  let sw: SwHarness;

  beforeEach(async () => {
    sw = load();
    for (const r of APP_ROUTES) sw.served.add(r);
    await sw.fire('install', {});
    await sw.fire('activate', {});
  });

  it('precaches the signed-in screens, not just the signed-out ones', async () => {
    // The v3 bug in one assertion: the precache list held only the
    // logged-out routes, so every screen a farmer uses was absent.
    const shell = await sw.cacheNamed('fsm-v4-shell');
    const cached = [...shell.map.keys()].map((u) => new URL(u).pathname);
    for (const route of ['/home', '/cycles', '/menu', '/pens-flocks', '/reports', '/settings']) {
      expect(cached, `${route} must be precached`).toContain(route);
    }
  });

  it('serves a precached screen when the signal is gone', async () => {
    sw.online.value = false;
    const res = await sw.fetchEvent(navigation('/home'));
    expect(res?.status).toBe(200);
    expect(await res!.text()).toBe('body:/home');
  });

  it('survives one bad route in the precache list instead of caching nothing', async () => {
    // addAll is atomic: v3 used it, so a single 404 anywhere left the
    // shell cache completely empty and the catch swallowed the reason.
    const fresh = load();
    for (const r of APP_ROUTES) fresh.served.add(r);
    fresh.served.delete('/sales'); // pretend this route was renamed
    await fresh.fire('install', {});
    const shell = await fresh.cacheNamed('fsm-v4-shell');
    const cached = [...shell.map.keys()].map((u) => new URL(u).pathname);
    expect(cached).not.toContain('/sales');
    expect(cached).toContain('/home');
    expect(cached).toContain('/offline.html');
  });

  it('matches the launcher start_url, which carries a query string', async () => {
    // manifest start_url is "/?utm_source=pwa". Keyed on the full URL
    // this misses on the single most common launch there is.
    sw.online.value = false;
    const res = await sw.fetchEvent(navigation('/?utm_source=pwa'));
    expect(await res!.text()).toBe('body:/');
  });

  it('falls back to the offline page only for a route it has never seen', async () => {
    sw.online.value = false;
    const res = await sw.fetchEvent(navigation('/cycles/unknown-id'));
    expect(await res!.text()).toBe('body:/offline.html');
  });

  it('serves a dynamic route offline once it has been visited online', async () => {
    sw.served.add('/cycles/abc123');
    await sw.fetchEvent(navigation('/cycles/abc123'));
    sw.online.value = false;
    const res = await sw.fetchEvent(navigation('/cycles/abc123'));
    expect(await res!.text()).toBe('body:/cycles/abc123');
  });
});

describe('service worker — RSC payloads', () => {
  let sw: SwHarness;

  beforeEach(async () => {
    sw = load();
    for (const r of APP_ROUTES) sw.served.add(r);
    await sw.fire('install', {});
  });

  const rsc = (pathname: string) => req(pathname, { headers: { RSC: '1' } });

  it('never resolves to undefined, which throws inside respondWith', async () => {
    // The exact v3 failure: stale-while-revalidate resolved to
    // `undefined` on a cold miss with no network. respondWith rejects
    // that with a TypeError, the router reads a dead link, and it hard
    // navigates — landing on the offline page.
    sw.online.value = false;
    const res = await sw.fetchEvent(rsc('/cycles?_rsc=deadbeef'));
    expect(res).toBeInstanceOf(Response);
    expect(res!.status).toBe(504);
  });

  it('ignores the _rsc hash, which changes between builds', async () => {
    await sw.fetchEvent(rsc('/cycles?_rsc=aaa111'));
    sw.online.value = false;
    const res = await sw.fetchEvent(rsc('/cycles?_rsc=bbb222'));
    expect(res!.status).toBe(200);
    expect(await res!.text()).toBe('body:/cycles');
  });

  it('keeps the RSC payload and the document apart under the same path', async () => {
    // One key for both would hand the router a document to parse as a
    // flight payload, or the browser a flight payload to render.
    await sw.fetchEvent(rsc('/home?_rsc=aaa'));
    const pages = await sw.cacheNamed('fsm-v4-pages');
    const keys = [...pages.map.keys()];
    expect(keys.some((k) => k.endsWith('/home?__rsc=1'))).toBe(true);
    expect(keys.some((k) => k.endsWith('/home'))).toBe(false);
  });
});

describe('service worker — cache budgets', () => {
  let sw: SwHarness;

  beforeEach(async () => {
    sw = load();
    for (const r of APP_ROUTES) sw.served.add(r);
    await sw.fire('install', {});
  });

  it('never evicts build output to make room for browsing', async () => {
    // v3 gave every static asset one 50-entry LRU shared with
    // everything else. A Next build has several hundred chunks and
    // eviction runs oldest-first, so it threw away the boot chunks —
    // the files without which the app cannot start at all.
    const boot = '/_next/static/chunks/webpack-boot.js';
    sw.served.add(boot);
    await sw.fetchEvent(req(boot));

    for (let i = 0; i < 300; i += 1) {
      const p = `/cycles/filler-${i}`;
      sw.served.add(p);
      await sw.fetchEvent(navigation(p));
    }

    const staticCache = await sw.cacheNamed('fsm-v4-static');
    expect(await staticCache.match(new URL(boot, ORIGIN).href)).toBeDefined();
  });

  it('keeps the pages cache within its cap', async () => {
    for (let i = 0; i < 200; i += 1) {
      const p = `/cycles/page-${i}`;
      sw.served.add(p);
      await sw.fetchEvent(navigation(p));
    }
    const pages = await sw.cacheNamed('fsm-v4-pages');
    expect(pages.map.size).toBeLessThanOrEqual(160);
  });

  it('drops caches from an older version on activate', async () => {
    const stale = await sw.caches.open('fsm-v3-shell');
    await stale.put('/old', new Response('old'));
    await sw.fire('activate', {});
    expect(await sw.caches.keys()).not.toContain('fsm-v3-shell');
  });
});

describe('service worker — prewarm is not an open fetcher', () => {
  let sw: SwHarness;

  beforeEach(async () => {
    sw = load();
    for (const r of APP_ROUTES) sw.served.add(r);
    await sw.fire('install', {});
    sw.requested.length = 0;
  });

  const prewarm = (paths: unknown) =>
    sw.fire('message', { data: { type: 'FSM_PREWARM', paths } });

  it('warms a real in-app path', async () => {
    sw.served.add('/cycles/abc/record');
    await prewarm(['/cycles/abc/record']);
    const pages = await sw.cacheNamed('fsm-v4-pages');
    expect(await pages.match(new URL('/cycles/abc/record', ORIGIN).href)).toBeDefined();
  });

  it('refuses anything that could leave the origin', async () => {
    // A prewarm list is a list of URLs fetched with the farmer's
    // cookies. Protocol-relative is the one that reads as same-origin
    // and is not.
    await prewarm([
      'https://evil.example/steal',
      '//evil.example/steal',
      'http://evil.example/steal',
    ]);
    expect(sw.requested).toHaveLength(0);
  });

  it('refuses the API surface and caps the batch', async () => {
    await prewarm(['/api/v1/farms']);
    expect(sw.requested).toHaveLength(0);

    const many = Array.from({ length: 200 }, (_, i) => `/cycles/x${i}`);
    for (const p of many) sw.served.add(p);
    await prewarm(many);
    // Two requests per path (document + RSC), capped at 24 paths.
    expect(new Set(sw.requested).size).toBeLessThanOrEqual(24);
  });

  it('ignores a malformed message rather than throwing', async () => {
    await expect(prewarm(undefined)).resolves.toBeUndefined();
    await expect(prewarm('not-an-array')).resolves.toBeUndefined();
    await expect(prewarm([null, 42, {}])).resolves.toBeUndefined();
    expect(sw.requested).toHaveLength(0);
  });
});
