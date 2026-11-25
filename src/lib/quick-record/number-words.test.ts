import { describe, it, expect } from 'vitest';
import { parseQuickRecord } from '@/lib/quick-record/parse';
import { buildExpensePayloads } from '@/lib/quick-record/to-payloads';

const expense = (text: string) =>
  buildExpensePayloads(parseQuickRecord(text).fields, {
    recordDate: '2026-11-25',
    currency: 'NGN',
  })[0];

const one = (text: string) => {
  const f = parseQuickRecord(text).fields;
  return f.length === 1
    ? `${f[0]!.kind}=${f[0]!.value}${f[0]!.unit ?? ''}`
    : JSON.stringify(f.map((x) => x.kind));
};

describe('a number said as a word', () => {
  // Dictation writes "three bags" as often as "3 bags", and the
  // quantity reader needs digits. The ledger row said ₦45,000 and
  // nothing about what it bought.
  it('keeps the quantity on an expense', () => {
    expect(expense('bought three bags of feed for 45000')).toMatchObject({
      category: 'feed',
      description: '3 bags',
      amount: 45000,
    });
  });

  // The dangerous half. With no buying verb the only digits in the
  // clause were the price, so the feed record came out as forty-five
  // thousand bags — a number that reaches FCR.
  it('does not read the price as the number of bags', () => {
    expect(one('three bags of feed for 45000')).toBe('feed=3bags');
  });

  it('reads "a bag" as one bag', () => {
    expect(expense('bought a bag of feed for 13000')).toMatchObject({
      description: '1 bag',
      amount: 13000,
    });
  });

  it('adds up a compound', () => {
    expect(expense('bought twenty five bags of feed for 375000')).toMatchObject({
      description: '25 bags',
      amount: 375000,
    });
  });

  it('adds up a compound in the price too', () => {
    // "twenty five thousand" was reading as twenty.
    expect(expense('paid twenty five thousand for fuel')).toMatchObject({
      category: 'fuel',
      amount: 25000,
    });
  });

  it('reads a spoken quantity of feed given out', () => {
    expect(one('gave them two bags of feed')).toBe('feed=2bags');
  });
});

describe('what the number-word rule must not touch', () => {
  // "a" is one in the number table and an article everywhere else.
  // It becomes a number only in front of a unit.
  it('leaves an article alone', () => {
    expect(parseQuickRecord('bought feed for a generator').fields.length).toBe(1);
    expect(expense('bought fuel for 15000')).toMatchObject({
      category: 'fuel',
      amount: 15000,
    });
  });

  it('leaves the money multipliers alone', () => {
    expect(expense('bought feed for 45k')).toMatchObject({ amount: 45000 });
    expect(expense('bought birds for 1.5m')).toMatchObject({ amount: 1_500_000 });
  });

  it('invents nothing from "two hundred bags"', () => {
    // Out of scope on purpose: splitting it would read "2 100 bags".
    // No quantity is better than the wrong one.
    const e = expense('bought two hundred bags of feed for 3000000');
    expect(e?.amount).toBe(3_000_000);
    expect(e?.description).toBeUndefined();
  });

  it('leaves a digit quantity exactly as it was', () => {
    expect(expense('bought 10 bags of feed for 250,000')).toMatchObject({
      description: '10 bags',
      amount: 250_000,
    });
  });
});
