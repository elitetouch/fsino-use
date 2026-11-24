import { describe as group, it, expect } from 'vitest';
import type { OutboxEntry } from '@/lib/offline/db';
import { describe as labelFor } from './outbox-label';

/**
 * What the sync screen calls a queued change.
 *
 * This is the farmer's only account of work that has not reached the
 * server, so a wrong name here is worse than no name: four rejected
 * DAILY RECORDS were shown as four rejected "New flock" entries —
 * four failed attempts to create a flock nobody had tried to create.
 */
const entry = (url: string, method: OutboxEntry['method'] = 'POST'): OutboxEntry =>
  ({
    key: 'k', method, url, body: {}, status: 'pending', attempts: 0,
    lastAttemptAt: null, nextAttemptAt: 0, enqueuedAt: 0, fingerprint: 'f',
  }) as OutboxEntry;

group('what a queued change is called', () => {
  it('calls a daily record a daily record', () => {
    // The real path. `/records` never matched it — the URL reads
    // `-records`, not `/records` — so it fell through to the flocks
    // rule below.
    expect(labelFor(entry('/flocks/abc-123/daily-records'))).toBe('Daily record');
  });

  it('still calls a genuine flock creation a new flock', () => {
    expect(labelFor(entry('/flocks'))).toBe('New flock');
  });

  it('distinguishes a flock update from a flock creation', () => {
    expect(labelFor(entry('/flocks/abc-123', 'PATCH'))).toBe('Flock update');
  });

  it('names the other queued kinds', () => {
    expect(labelFor(entry('/expenses'))).toBe('Expense');
    expect(labelFor(entry('/sales'))).toBe('Sale');
    expect(labelFor(entry('/pens'))).toBe('New pen');
  });
});
