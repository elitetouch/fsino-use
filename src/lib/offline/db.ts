'use client';

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

/**
 * FarmSpeak offline IndexedDB schema.
 *
 * Three object stores:
 *   - outbox  — pending mutations (POST/PATCH/DELETE) with their full
 *               request shape, retry state, idempotency key, and an
 *               optimistic snapshot of what they wrote (for rollback).
 *   - cache   — response cache for GETs, keyed by URL. TTL per-entry.
 *   - meta    — small key/value pairs (last sync time, schema version,
 *               user id, etc).
 *
 * Schema versioning rule: bump DB_VERSION whenever object stores or
 * indexes change. The upgrade callback runs in a transaction; old data
 * is preserved unless explicitly migrated.
 */

const DB_NAME = 'fsm-offline';
const DB_VERSION = 2;

export type OutboxStatus =
  | 'pending'    // never attempted, or last attempt threw before reaching server
  | 'in-flight'  // request issued, awaiting response
  | 'failed-permanent' // 4xx other than 409 — user must resolve
  | 'conflict'   // 409 — needs UI resolution
  | 'parked';    // exceeded max retries — left for user attention

export interface OutboxEntry {
  /** Stable client-generated key (UUID v4) — also sent to server as _idempotencyKey */
  key: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body: unknown;
  headers?: Record<string, string>;
  status: OutboxStatus;
  attempts: number;
  lastAttemptAt: number | null;
  nextAttemptAt: number;
  lastError?: { status?: number; message?: string };
  /** Snapshot of the local state we changed optimistically, for rollback. */
  rollback?: unknown;
  /** When this entry was first enqueued — used for FIFO + observability. */
  enqueuedAt: number;
  /** Optional grouping tag — e.g. "flock:abc-123" so the UI can show
   *  per-resource sync status. */
  scope?: string;
  /** Fingerprint of (method, url, body) — used to dedupe rapid duplicates. */
  fingerprint: string;
}

export interface CacheEntry {
  url: string;
  body: unknown;
  storedAt: number;
  /** Soft TTL — entries older than this are still returned but the sync
   *  engine will refresh them when online. */
  staleAt: number;
  /** Hard TTL — entries older than this are evicted. */
  expiresAt: number;
  /** ETag/Last-Modified from server, if present, for conditional refetch. */
  etag?: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

interface FSMSchema extends DBSchema {
  outbox: {
    key: string; // OutboxEntry.key
    value: OutboxEntry;
    indexes: {
      'by-status': OutboxStatus;
      'by-fingerprint': string;
      'by-nextAttempt': number;
      'by-scope': string;
    };
  };
  cache: {
    key: string; // CacheEntry.url
    value: CacheEntry;
    indexes: {
      'by-storedAt': number;
    };
  };
  meta: {
    key: string;
    value: MetaEntry;
  };
  /**
   * Words this farmer's recogniser keeps getting wrong, and what they
   * turned out to mean. See lib/quick-record/learning.ts — rows are
   * re-validated on read, because a store on this origin is not a
   * trust boundary.
   */
  vocabAliases: {
    key: string; // the token
    value: {
      token: string;
      kind: string;
      hits: number;
      createdAt: number;
      active: boolean;
      syncedAt?: number;
    };
    indexes: { 'by-active': string };
  };
  /** Candidate tokens, counted until they cross the promotion threshold. */
  vocabObservations: {
    key: string; // `${token}|${kind}`
    value: {
      id: string;
      token: string;
      kind: string;
      hits: number;
      lastSeen: number;
    };
    indexes: { 'by-lastSeen': number };
  };
}

let dbPromise: Promise<IDBPDatabase<FSMSchema>> | null = null;

/**
 * Lazy-init the DB. Throws gracefully if IndexedDB isn't available
 * (e.g. Safari private browsing pre-15, some embedded webviews).
 */
export function getDB(): Promise<IDBPDatabase<FSMSchema>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable: not in browser'));
  }
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB unavailable in this browser'));
  }
  if (!dbPromise) {
    dbPromise = withTimeout(openDB<FSMSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // v1: initial schema
        if (oldVersion < 1) {
          const outbox = db.createObjectStore('outbox', { keyPath: 'key' });
          outbox.createIndex('by-status', 'status');
          outbox.createIndex('by-fingerprint', 'fingerprint');
          outbox.createIndex('by-nextAttempt', 'nextAttemptAt');
          outbox.createIndex('by-scope', 'scope');

          const cache = db.createObjectStore('cache', { keyPath: 'url' });
          cache.createIndex('by-storedAt', 'storedAt');

          db.createObjectStore('meta', { keyPath: 'key' });
        }
        // v2: per-farmer learned vocabulary. Purely additive — no
        // existing store is touched, so an upgrade cannot lose a queued
        // record. A farmer mid-upgrade with unsynced writes keeps them.
        if (oldVersion < 2) {
          const aliases = db.createObjectStore('vocabAliases', { keyPath: 'token' });
          aliases.createIndex('by-active', 'active');

          const observations = db.createObjectStore('vocabObservations', { keyPath: 'id' });
          observations.createIndex('by-lastSeen', 'lastSeen');
        }

        // Future migrations: add `if (oldVersion < N) { ... }` blocks
        // BELOW this comment so they run in order without re-running old
        // migrations on subsequent upgrades.
      },
      blocked() {
        // Another tab has an older DB version open.
        //
        // NOTE THAT THIS CALLBACK DOES NOT UNBLOCK ANYTHING. The open
        // request stays pending until that tab closes, so everything
        // awaiting IndexedDB waits with it — which, once the query
        // cache restore began gating every React Query fetch, meant
        // gated screens reporting "Can't load this page offline yet"
        // on a working connection. The timeout wrapping this open is
        // what actually bounds it; this only records why.
        console.warn('[fsm-offline] DB upgrade blocked by another tab.');
      },
      blocking() {
        // We're blocking a newer-version tab from upgrading. Close so
        // it can proceed.
        if (dbPromise) {
          dbPromise.then((db) => db.close());
          dbPromise = null;
        }
      },
      terminated() {
        // Storage was wiped or the connection was killed — re-open lazily.
        dbPromise = null;
      },
    }), OPEN_TIMEOUT_MS, 'IndexedDB open timed out');
    // A rejected open must not be cached, or one bad moment disables
    // offline storage for the life of the tab.
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/**
 * How long to wait for the database to open before giving up.
 *
 * Opening is normally instantaneous. It hangs when another tab holds
 * an older version, and an IndexedDB request that never settles is
 * indistinguishable from one that is merely slow — so the only way
 * back is a clock. Callers all treat a rejection as "no offline
 * storage this session", which degrades; waiting forever does not.
 */
const OPEN_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ─────────────── Meta helpers ───────────────

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const entry = await db.get('meta', key);
  return entry?.value as T | undefined;
}

// ─────────────── Persistent storage request ───────────────

/**
 * Ask the browser to keep our storage even under pressure. Chrome
 * grants this if the site has been added to the home screen or has
 * high engagement. Safari ignores this API but storage is persistent
 * after Add to Home Screen.
 *
 * Idempotent — calling repeatedly is fine; the browser caches the
 * decision.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Get a snapshot of storage quota usage. Returns null on browsers that
 * don't support the Storage API (e.g. older Safari).
 */
export async function getStorageQuota(): Promise<{ usage: number; quota: number; percent: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const est = await navigator.storage.estimate();
    const usage = est.usage ?? 0;
    const quota = est.quota ?? 0;
    return {
      usage,
      quota,
      percent: quota > 0 ? (usage / quota) * 100 : 0,
    };
  } catch {
    return null;
  }
}
