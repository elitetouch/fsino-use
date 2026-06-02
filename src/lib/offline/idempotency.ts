/**
 * Idempotency utilities.
 *
 * Every offline-aware mutation gets a client-generated UUID v4 attached
 * as `_idempotencyKey` in the request body. The backend should look up
 * the key and return the cached response if it's already processed.
 *
 * Without server-side dedupe, a flaky network can cause double-writes:
 *   1. Client sends POST /flocks (creates flock A)
 *   2. Server processes it, but the response is lost in transit
 *   3. Client retries → server creates flock A2
 *   4. User sees two flocks with the same data
 *
 * With idempotency keys, step 3 returns the same response as step 2 —
 * no duplicate.
 *
 * If the server doesn't yet implement the key on its end, the client
 * still benefits because the local outbox dedupes by key (same key →
 * same outbox row, only retried once).
 */

/**
 * RFC 4122 v4 UUID via crypto.randomUUID when available, with a
 * defensive polyfill for older browsers that hits the same bit layout.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Polyfill — older Safari (pre-15.4) doesn't have randomUUID.
  // Uses getRandomValues if available (cryptographically secure).
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
    buf[8] = (buf[8] & 0x3f) | 0x80; // variant 1
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort — Math.random. NOT cryptographically secure but
  // collision-resistant enough for an outbox key on a single device.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a stable cache key for a (method, url, body) tuple. Used to
 * dedupe outbox entries when the same mutation is fired twice in quick
 * succession (e.g. user double-taps the submit button).
 */
export function fingerprintMutation(method: string, url: string, body: unknown): string {
  const json = body === undefined ? '' : safeStableStringify(body);
  return `${method.toUpperCase()}|${url}|${json}`;
}

function safeStableStringify(value: unknown): string {
  // Deterministic JSON — keys sorted, no circular references.
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v) => {
    if (typeof v !== 'object' || v === null) return v;
    if (seen.has(v as object)) return '[Circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      sorted[k] = (v as Record<string, unknown>)[k];
    }
    return sorted;
  });
}
