import { describe, it, expect } from 'vitest';
import { parseQuickRecord } from './parse';
import { buildExpensePayloads, buildQuickRecordPayloads } from './to-payloads';

/**
 * Expenses are money, and a wrong amount does not look wrong — it
 * quietly moves the margin. So this file is weighted towards the
 * parser DECLINING rather than succeeding, same as the daily-record
 * tests, and towards the one mistake that would corrupt a core
 * metric: reading a purchase as consumption.
 */
const OPTS = { recordDate: '2026-11-24', moment: 'entire_day' as const };
const MONEY = { recordDate: '2026-11-24', currency: 'NGN' };

const expenseOf = (text: string) =>
  buildExpensePayloads(parseQuickRecord(text).fields, MONEY)[0];

describe('buying versus giving', () => {
  it('reads a purchase as an expense, not as feed consumption', () => {
    const r = parseQuickRecord('I bought 10 bags of feed for 45000');
    expect(r.fields.map((f) => f.kind)).toEqual(['expense']);
    // The critical half: no feed record, or the FCR counts feed the
    // birds never ate.
    expect(buildQuickRecordPayloads(r.fields, OPTS)).toHaveLength(0);
  });

  it('still reads giving as feed consumption', () => {
    const r = parseQuickRecord('I gave them 10 bags of feed');
    expect(r.fields.map((f) => f.kind)).toEqual(['feed']);
    expect(buildExpensePayloads(r.fields, MONEY)).toHaveLength(0);
  });

  it('records both when the farmer did both', () => {
    const r = parseQuickRecord('bought 10 bags of feed for 45000 and gave them 2 bags');
    expect(r.fields.map((f) => f.kind).sort()).toEqual(['expense', 'feed']);
    expect(buildExpensePayloads(r.fields, MONEY)).toHaveLength(1);
    expect(buildQuickRecordPayloads(r.fields, OPTS)).toHaveLength(1);
  });

  it('leaves a sale a sale — money in is not money out', () => {
    const r = parseQuickRecord('sold 50 birds for 200000');
    expect(r.fields.map((f) => f.kind)).toEqual(['sold']);
    expect(buildExpensePayloads(r.fields, MONEY)).toHaveLength(0);
  });

  it('does not mistake a QUANTITY for a price', () => {
    // Found by the landing-page demo, which runs this parser live:
    // mid-sentence, "Bought 10 bags of feed" was read as a ₦10 spend
    // — the number of bags posted to the ledger as the price.
    const r = parseQuickRecord('Bought 10 bags of feed');
    expect(r.fields.some((f) => f.kind === 'expense')).toBe(false);
  });

  it.each([
    ['bought 10 bags of feed for 45000', 45000],  // price slot
    ['bought 10 bags of feed 45k', 45000],        // multiplier
    ['bought 10 bags of feed N45000', 45000],     // currency
    ['paid 45000 for 10 bags of feed', 45000],    // paying verb, bare
  ])('still reads a marked price: %s', (text, expected) => {
    expect(expenseOf(text)?.amount).toBe(expected);
  });

  it('refuses a purchase with no amount', () => {
    // "I bought feed" is a fact about the store, not a figure for the
    // books. A zero row would be worse than none.
    const r = parseQuickRecord('I bought feed');
    expect(r.fields.some((f) => f.kind === 'expense')).toBe(false);
  });
});

describe('money, as Nigerians say it', () => {
  it.each([
    ['bought feed for 45000', 45000],
    ['bought feed for 45,000', 45000],
    ['bought feed for 45k', 45000],
    ['bought feed for 45 thousand', 45000],
    ['bought feed for five thousand', 5000],
    ['bought feed for 1.5m', 1_500_000],
    ['bought feed for N45000', 45000],
    ['paid 250000 for day old chicks', 250000],
  ])('%s -> %i', (text, expected) => {
    expect(expenseOf(text)?.amount).toBe(expected);
  });

  it('does not let a comma split the sentence in half', () => {
    // CLAUSE_SPLIT cuts on commas, so "45,000" would otherwise become
    // a forty-five-naira expense and a stray "000".
    const r = parseQuickRecord('bought feed for 45,000');
    expect(r.fields).toHaveLength(1);
    expect(r.fields[0]?.value).toBe(45000);
  });

  it('takes the price after "for", not the quantity before it', () => {
    expect(expenseOf('bought 10 bags of feed for 45000')?.amount).toBe(45000);
  });

  it('warns on an amount too small to be real', () => {
    const f = parseQuickRecord('bought feed for 50').fields[0];
    expect(f?.confidence).toBe('low');
    expect(f?.caution).toMatch(/very small/i);
  });
});

describe('what the money was for', () => {
  it.each([
    ['bought 10 bags of feed for 45000', 'feed'],
    ['bought lasota vaccine for 3000', 'vaccine'],
    ['bought dewormer for 2000', 'treatment'],
    ['bought diesel for 15000', 'fuel'],
    ['paid workers 30000', 'wages'],
    ['paid 5000 for transport', 'transport'],
    ['bought 500 day old chicks for 250000', 'birds'],
    ['bought a new drinker for 4000', 'equipment'],
    ['paid 12000 for repairs', 'repairs'],
  ])('%s -> %s', (text, category) => {
    expect(expenseOf(text)?.category).toBe(category);
  });

  it('prefers the goods over the birds they are for', () => {
    // "bought feed for the birds" names both; it is a feed expense.
    expect(expenseOf('bought feed for the birds for 45000')?.category).toBe('feed');
  });

  it('files an unknown purchase under other, and says so', () => {
    const f = parseQuickRecord('bought something for 9000').fields[0];
    expect(f?.detail?.expenseCategory).toBe('other');
    expect(f?.caution).toMatch(/other/i);
  });
});

describe('the payload boundary', () => {
  it('never sends a category the server does not have', () => {
    const forged = [{
      kind: 'expense' as const, value: 1000, confidence: 'high' as const,
      sourceText: '', detail: { expenseCategory: 'definitely-not-a-category' },
    }];
    expect(buildExpensePayloads(forged, MONEY)[0]?.category).toBe('other');
  });

  it('never takes a currency from the sentence', () => {
    // A farmer saying "dollars" must not retag a naira ledger.
    const p = expenseOf('bought feed for 45000 dollars');
    expect(p?.currency).toBe('NGN');
  });

  it('refuses an amount outside what the endpoint accepts', () => {
    for (const value of [0, -5, 1e12, Number.NaN, Number.POSITIVE_INFINITY]) {
      const forged = [{
        kind: 'expense' as const, value, confidence: 'high' as const,
        sourceText: '', detail: { expenseCategory: 'feed' },
      }];
      expect(buildExpensePayloads(forged, MONEY)).toHaveLength(0);
    }
  });

  it('rounds to the minor unit so a multiplier cannot leak a float', () => {
    const p = expenseOf('bought feed for 1.5m');
    expect(p?.amount).toBe(1_500_000);
    expect(Number.isInteger(p!.amount * 100)).toBe(true);
  });

  it('attaches the cycle when there is one, and omits it when there is not', () => {
    const fields = parseQuickRecord('bought feed for 45000').fields;
    expect(buildExpensePayloads(fields, { ...MONEY, flockId: 'c1' })[0]?.flock_id).toBe('c1');
    expect(buildExpensePayloads(fields, MONEY)[0]).not.toHaveProperty('flock_id');
  });
});
