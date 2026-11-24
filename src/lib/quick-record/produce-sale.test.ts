import { describe, it, expect } from 'vitest';
import { parseQuickRecord } from './parse';
import { buildProduceSalePayloads, buildQuickRecordPayloads, buildExpensePayloads } from './to-payloads';

/**
 * Selling eggs is not selling birds, and the difference is stock.
 *
 * Read an egg sale as a bird sale and the flock count drops by the
 * number of crates — birds that are still alive in the pen vanish
 * from the record, and every per-bird figure after it is computed
 * against a flock that does not exist.
 */
const OPTS = { recordDate: '2026-11-24', moment: 'entire_day' as const };
const MONEY = { recordDate: '2026-11-24', currency: 'NGN' };

const produceOf = (text: string) =>
  buildProduceSalePayloads(parseQuickRecord(text).fields, MONEY)[0];

describe('selling produce, not birds', () => {
  it('reads an egg sale as produce, moving no birds', () => {
    const r = parseQuickRecord('sold 3 crates of eggs for 9000');
    expect(r.fields.map((f) => f.kind)).toEqual(['produce_sale']);

    const p = produceOf('sold 3 crates of eggs for 9000');
    expect(p?.event_type).toBe('produce_sale');
    expect(p?.amount).toBe(9000);
    expect(p?.payload).toEqual({ item: 'eggs' });
    // The whole point: no bird movement.
    expect(p).not.toHaveProperty('birds_delta');
  });

  it('still reads a bird sale as a bird sale', () => {
    const r = parseQuickRecord('sold 50 birds for 200000');
    expect(r.fields.map((f) => f.kind)).toEqual(['sold']);
    expect(buildProduceSalePayloads(r.fields, MONEY)).toHaveLength(0);
    // And it still moves stock.
    expect(buildQuickRecordPayloads(r.fields, OPTS)).toHaveLength(1);
  });

  it('leaves collecting eggs as an egg record', () => {
    // "collected 3 crates" is production, not revenue.
    const r = parseQuickRecord('collected 3 crates of eggs', { productionType: 'layer' });
    expect(r.fields.map((f) => f.kind)).toEqual(['eggs']);
    expect(buildProduceSalePayloads(r.fields, MONEY)).toHaveLength(0);
  });

  it('refuses a produce sale with no price', () => {
    // Without money it is not a sale record, it is a sentence.
    const r = parseQuickRecord('sold some eggs');
    expect(r.fields.some((f) => f.kind === 'produce_sale')).toBe(false);
  });

  it.each([
    ['sold manure for 5000', 'manure'],
    ['sold droppings for 5000', 'manure'],
    ['sold spent litter for 2500', 'spent_litter'],
    ['sold empty bags for 1200', 'empty_sacks'],
    ['sold 10 crates for 30000', 'eggs'],
  ])('%s -> %s', (text, item) => {
    expect(produceOf(text)?.payload).toEqual({ item });
  });

  it('records a sale and a death from one sentence', () => {
    const r = parseQuickRecord('sold 3 crates of eggs for 9000 and 2 birds died');
    const kinds = r.fields.map((f) => f.kind).sort();
    expect(kinds).toEqual(['dead', 'produce_sale']);
    expect(buildProduceSalePayloads(r.fields, MONEY)).toHaveLength(1);
    expect(buildQuickRecordPayloads(r.fields, OPTS)).toHaveLength(1);
  });
});

describe('the payload boundary', () => {
  it('never sends an item the server does not have', () => {
    const forged = [{
      kind: 'produce_sale' as const, value: 5000, confidence: 'high' as const,
      sourceText: '', detail: { produceItem: 'unobtanium' },
    }];
    expect(buildProduceSalePayloads(forged, MONEY)[0]?.payload).toEqual({ item: 'other' });
  });

  it('never takes a currency from the sentence', () => {
    expect(produceOf('sold eggs for 9000 dollars')?.currency).toBe('NGN');
  });

  it('refuses an amount outside what the endpoint accepts', () => {
    for (const value of [0, -1, 1e12, Number.NaN]) {
      const forged = [{
        kind: 'produce_sale' as const, value, confidence: 'high' as const,
        sourceText: '', detail: { produceItem: 'eggs' },
      }];
      expect(buildProduceSalePayloads(forged, MONEY)).toHaveLength(0);
    }
  });

  it('is not an expense — money in is not money out', () => {
    const r = parseQuickRecord('sold 3 crates of eggs for 9000');
    expect(buildExpensePayloads(r.fields, MONEY)).toHaveLength(0);
  });
});
