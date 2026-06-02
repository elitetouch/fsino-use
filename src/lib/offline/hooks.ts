'use client';

import { useEffect, useSyncExternalStore, useState } from 'react';
import { countByStatus, getAllEntries, onOutboxChange } from './queue';
import type { OutboxStatus } from './db';

export type OutboxCounts = Record<OutboxStatus, number>;

export function useOutboxCounts(): OutboxCounts {
  const [counts, setCounts] = useState<OutboxCounts>({
    pending: 0,
    'in-flight': 0,
    'failed-permanent': 0,
    conflict: 0,
    parked: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await countByStatus();
        if (!cancelled) setCounts(next);
      } catch {
        // IndexedDB unavailable — leave at zeros so UI gracefully no-ops.
      }
    };
    void refresh();
    const off = onOutboxChange(refresh);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return counts;
}

export function useOutboxSize(): number {
  const c = useOutboxCounts();
  return c.pending + c['in-flight'] + c['failed-permanent'] + c.conflict + c.parked;
}

export function useOutbox(): { entries: Awaited<ReturnType<typeof getAllEntries>>; refresh: () => void } {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof getAllEntries>>>([]);
  const refresh = () => {
    void getAllEntries().then(setEntries).catch(() => setEntries([]));
  };
  useEffect(() => {
    refresh();
    const off = onOutboxChange(refresh);
    return off;
  }, []);
  return { entries, refresh };
}
