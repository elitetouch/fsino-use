import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

/**
 * Warming is what turns "offline-capable in principle" into "works in
 * the pen". These tests pin the two things that decide whether it
 * helps or hurts: that it fetches the record screen's data before the
 * farmer needs it, and that it does not fetch money.
 */

const online = { value: true };
const token = { value: 'tok' };

vi.mock('./network', () => ({ isOnline: () => online.value }));
vi.mock('@/lib/auth', () => ({ readToken: () => token.value }));
vi.mock('@/lib/farm-context', () => ({ readCurrentFarmId: () => 'farm-1' }));

const calls: string[] = [];

vi.mock('@/lib/api', () => ({
  endpoints: {
    getMyPreferences: async () => {
      calls.push('prefs');
      return { preferences: {} };
    },
    listFlocks: async (params?: { includeArchived?: boolean }) => {
      calls.push(params?.includeArchived ? 'flocks:archived' : 'flocks');
      return {
        flocks: [
          { id: 'c1', archivedAt: null },
          { id: 'c2', archivedAt: null },
          { id: 'old', archivedAt: '2026-01-01' },
        ],
      };
    },
    getDailyRecordGuidance: async (id: string) => {
      calls.push(`guidance:${id}`);
      return { flock: { id } };
    },
    getDailyRecordCalendar: async (id: string) => {
      calls.push(`calendar:${id}`);
      return { days: [] };
    },
    listFarms: async () => {
      calls.push('farms');
      return { farms: [] };
    },
    listPens: async () => {
      calls.push('pens');
      return { pens: [] };
    },
    getFlockReportSummary: async (id: string) => {
      calls.push(`summary:${id}`);
      return { summary: {} };
    },
  },
}));

const { warmOfflineData, warmCycle, resetWarmedForTests } = await import('./warm-data');

beforeEach(() => {
  calls.length = 0;
  online.value = true;
  token.value = 'tok';
  resetWarmedForTests();
});

describe('warming before the signal goes', () => {
  it('fetches the record screen’s data for active cycles', async () => {
    await warmOfflineData(new QueryClient());
    expect(calls).toContain('prefs');
    expect(calls).toContain('guidance:c1');
    expect(calls).toContain('calendar:c1');
    expect(calls).toContain('guidance:c2');
  });

  it('warms the dashboard, which is the screen the launcher opens onto', async () => {
    await warmOfflineData(new QueryClient());
    expect(calls).toContain('farms');
    expect(calls).toContain('pens');
    expect(calls).toContain('summary:c1');
  });

  it('skips archived cycles — nobody records against a closed one', async () => {
    await warmOfflineData(new QueryClient());
    expect(calls).not.toContain('guidance:old');
  });

  it('warms both flocks-list keys, because they are different requests', async () => {
    // The record screen needs the archived-inclusive list to tell a
    // closed cycle from a bad id; other screens use the plain one.
    // Warming one would leave the other cold.
    await warmOfflineData(new QueryClient());
    expect(calls).toContain('flocks');
    expect(calls).toContain('flocks:archived');
  });

  it('never fetches anything billing', async () => {
    await warmOfflineData(new QueryClient());
    for (const c of calls) {
      expect(c).not.toMatch(/price|balance|purchase|offer|subscription/i);
    }
  });

  it('does nothing with no signal — there is nothing to fetch with', async () => {
    online.value = false;
    await warmOfflineData(new QueryClient());
    expect(calls).toEqual([]);
  });

  it('does nothing when signed out', async () => {
    token.value = '';
    await warmOfflineData(new QueryClient());
    expect(calls).toEqual([]);
  });

  it('runs once per session, not once per render', async () => {
    const qc = new QueryClient();
    await warmOfflineData(qc);
    const first = calls.length;
    await warmOfflineData(qc);
    expect(calls.length).toBe(first);
  });
});

describe('warming the cycle on screen', () => {
  it('fetches that cycle’s guidance and calendar', async () => {
    await warmCycle(new QueryClient(), 'abc');
    expect(calls).toContain('guidance:abc');
    expect(calls).toContain('calendar:abc');
  });

  it('does not refetch the same cycle twice', async () => {
    const qc = new QueryClient();
    await warmCycle(qc, 'dup');
    const first = calls.length;
    await warmCycle(qc, 'dup');
    expect(calls.length).toBe(first);
  });

  it('stays quiet with no signal', async () => {
    online.value = false;
    await warmCycle(new QueryClient(), 'zzz');
    expect(calls).toEqual([]);
  });
});
