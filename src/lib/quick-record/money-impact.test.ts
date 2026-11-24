import { describe, it, expect } from 'vitest';
import { parseQuickRecord } from './parse';
import { moneyImpact } from './money-impact';
import type { FlockFinanceDto } from '@/lib/api';

/**
 * The figure a farmer sees in the second before they confirm.
 *
 * It is computed locally on purpose — it has to be right with no
 * signal, and it must never present a stale cached total as the
 * current one.
 */
const finance = (byCategory: Array<{ category: string; amount: number }>) =>
  ({ expenses: { byCategory } } as unknown as FlockFinanceDto);

const impactOf = (text: string, opts = {}) =>
  moneyImpact(parseQuickRecord(text).fields, { currentBirds: 480, ...opts });

describe('what the money means', () => {
  it('says nothing when no money was mentioned', () => {
    expect(impactOf('15 birds died')).toBeNull();
  });

  it('reports money out and the cost per bird', () => {
    const i = impactOf('bought 10 bags of feed for 45000');
    expect(i?.out).toBe(45000);
    expect(i?.in).toBe(0);
    expect(i?.perBird).toBe(93.75);
  });

  it('reports money in without pretending it is a cost per bird', () => {
    const i = impactOf('sold 3 crates of eggs for 9000');
    expect(i?.in).toBe(9000);
    expect(i?.out).toBe(0);
    // Revenue per bird is a different and more slippery idea; a
    // figure here would read as a cost.
    expect(i?.perBird).toBeNull();
  });

  it('nets a sentence that both spends and earns', () => {
    const i = impactOf('bought feed for 45000 and sold eggs for 9000');
    expect(i?.out).toBe(45000);
    expect(i?.in).toBe(9000);
    expect(i?.net).toBe(36000);
  });

  it('omits the per-bird figure rather than dividing by nothing', () => {
    for (const birds of [0, undefined, Number.NaN]) {
      expect(impactOf('bought feed for 45000', { currentBirds: birds })?.perBird).toBeNull();
    }
  });
});

describe('where this cycle lands', () => {
  it('adds what is about to be saved to what is already spent', () => {
    // A farmer wants to know where they WILL be, not where they were.
    const i = impactOf('bought feed for 45000', {
      finance: finance([{ category: 'feed', amount: 185000 }]),
    });
    expect(i?.categoryToDate).toEqual({ category: 'feed', amount: 230000 });
  });

  it('names the largest category when a sentence has several', () => {
    const i = impactOf('bought feed for 45000 and bought diesel for 9000', {
      finance: finance([{ category: 'feed', amount: 10 }, { category: 'fuel', amount: 10 }]),
    });
    expect(i?.categoryToDate?.category).toBe('feed');
  });

  it('shows no cycle total when nothing is cached', () => {
    // Offline with a cold cache. A missing line is honest; a stale one
    // presented as current is not.
    expect(impactOf('bought feed for 45000')?.categoryToDate).toBeNull();
    expect(impactOf('bought feed for 45000', { finance: null })?.categoryToDate).toBeNull();
    expect(impactOf('bought feed for 45000', { finance: finance([]) })?.categoryToDate).toBeNull();
  });

  it('survives a finance body of the wrong shape', () => {
    // The persisted cache can hand back an older build's payload.
    const junk = { expenses: null } as unknown as FlockFinanceDto;
    expect(() => impactOf('bought feed for 45000', { finance: junk })).not.toThrow();
    expect(impactOf('bought feed for 45000', { finance: junk })?.out).toBe(45000);
  });
});
