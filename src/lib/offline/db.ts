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
const DB_VERSION = 1;

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
    dbPromise = openDB<FSMSchema>(DB_NAME, DB_VERSION, {
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
        // Future migrations: add `if (oldVersion < N) { ... }` blocks
        // BELOW this comment so they run in order without re-running old
        // migrations on subsequent upgrades.
      },
      blocked() {
        // Another tab has an older DB version open — surface to console
        // but don't crash. The user will pick up the new schema on next
        // navigation.
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
    });
  }
  return dbPromise;
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
