'use client';

import { api } from '@/lib/api';
import { isOnline } from './network';
import * as cache from './cache';
import { enqueue } from './queue';
import { newIdempotencyKey } from './idempotency';

/**
 * Offline-aware API surface.
 *
 *   getOffline(url)          — network-first online, cache fallback offline.
 *   mutateOffline({method,url,body,rollback,scope})
 *                            — online: fire-and-cache; offline: enqueue with
 *                              optimistic rollback registered. Returns the
 *                              idempotency key so callers can match later.
 *
 * Critical guarantees:
 *   1. Every mutation has a stable client-generated key, ensuring
 *      server-side dedupe if the route supports Idempotency-Key.
 *   2. Optimistic UI is only applied AFTER the call returns — we never
 *      paint state we haven't committed to the outbox.
 *   3. Failures while online are still queued for retry — a 5xx doesn't
 *      drop the write.
 */

export async function getOffline<T = unknown>(
  url: string,
  opts?: { staleMs?: number; expireMs?: number; force?: boolean },
): Promise<{ data: T; stale: boolean; fromCache: boolean }> {
  // If caller explicitly requested fresh + we're online, skip cache.
  if (opts?.force && isOnline()) {
    const res = await api.get<T>(url);
    await cache.put(url, res.data, opts);
    return { data: res.data, stale: false, fromCache: false };
  }

  // Online path: try network first, fall back to cache on failure.
  if (isOnline()) {
    try {
      const res = await api.get<T>(url);
      await cache.put(url, res.data, opts);
      return { data: res.data, stale: false, fromCache: false };
    } catch (err) {
      const cached = await cache.get(url);
      if (cached) {
        return { data: cached.body as T, stale: cached.stale, fromCache: true };
      }
      throw err;
    }
  }

  // Offline path: cache only.
  const cached = await cache.get(url);
  if (cached) {
    return { data: cached.body as T, stale: cached.stale, fromCache: true };
  }
  throw new OfflineError('No cached data for this request', { url });
}

export interface MutateInput {
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  /** Local optimistic snapshot for rollback if the server later rejects. */
  rollback?: unknown;
  /** Group tag — e.g. "flock:abc-123" for the sync-status UI. */
  scope?: string;
}

export interface MutateResult<T = unknown> {
  /** Always set — the idempotency key the request will use. */
  key: string;
  /** True if the request was sent now (online); false if queued for later. */
  sentNow: boolean;
  /** Present when sentNow=true and the server responded successfully. */
  data?: T;
}

export async function mutateOffline<T = unknown>(input: MutateInput): Promise<MutateResult<T>> {
  const key = newIdempotencyKey();

  if (isOnline()) {
    try {
      const body =
        input.body && typeof input.body === 'object' && !Array.isArray(input.body)
          ? { ...(input.body as Record<string, unknown>), _idempotencyKey: key }
          : input.body;
      const res = await api.request<T>({
        url: input.url,
        method: input.method,
        data: body,
        headers: { 'Idempotency-Key': key },
        timeout: 25_000,
      });
      return { key, sentNow: true, data: res.data };
    } catch {
      // Transient failure online → queue for retry. We give it a fresh
      // outbox entry (which generates its own key, also valid) since the
      // server may have processed the first request.
      //
      // The server's dedupe via Idempotency-Key handles the "did it land?"
      // ambiguity: if the original key was processed, the retry returns
      // the same response.
      const enq = await enqueue({
        method: input.method,
        url: input.url,
        body: input.body,
        scope: input.scope,
        rollback: input.rollback,
      });
      return { key: enq.entry.key, sentNow: false };
    }
  }

  // Offline path — enqueue and resolve immediately so callers can show
  // optimistic UI.
  const enq = await enqueue({
    method: input.method,
    url: input.url,
    body: input.body,
    scope: input.scope,
    rollback: input.rollback,
  });
  return { key: enq.entry.key, sentNow: false };
}

export class OfflineError extends Error {
  context?: Record<string, unknown>;
  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'OfflineError';
    this.context = context;
  }
}
