import { describe, it, expect } from 'vitest';
import { parseQuickRecord } from '@/lib/quick-record/parse';
import { buildExpensePayloads } from '@/lib/quick-record/to-payloads';

const build = (text: string) =>
  buildExpensePayloads(parseQuickRecord(text).fields, {
    recordDate: '2026-11-25', currency: 'NGN',
  });

describe('expense goods description', () => {
  it('keeps the quantity the farmer said', () => {
    const [e] = build('bought 3 bags of feed for 45000');
    expect(e?.amount).toBe(45000);
    expect(e?.category).toBe('feed');
    expect(e?.description).toBe('3 bags');
  });

  it('is still a feed record, not a spend, with no buying verb', () => {
    // "3 bags of feed for 45000" is feed given to the birds. Money
    // needs a verb that says money moved, or every feeding becomes a
    // purchase.
    const r = parseQuickRecord('3 bags of feed for 45000');
    expect(r.fields.map((f) => f.kind)).toEqual(['feed']);
    expect(build('3 bags of feed for 45000')).toEqual([]);
  });

  it('never files the price as a quantity', () => {
    const [e] = build('spent 45000 on feed');
    expect(e?.amount).toBe(45000);
    expect(e?.description).toBeUndefined();
  });

  it('does not pluralise kg', () => {
    const [e] = build('bought 50kg of feed for 45000');
    expect(e?.description).toBe('50 kg');
  });

  it('keeps a single bag singular', () => {
    const [e] = build('bought 1 bag of feed for 13000');
    expect(e?.description).toBe('1 bag');
  });

  it('reads the quantity when it follows the price', () => {
    const [e] = build('paid 45000 for 3 bags of feed');
    expect(e?.description).toBe('3 bags');
  });

  it('ignores naira as a unit', () => {
    const [e] = build('bought feed for 45000 naira');
    expect(e?.description).toBeUndefined();
  });

  it('carries no description when nothing was countable', () => {
    const [e] = build('paid 20000 for generator repairs');
    expect(e?.category).toBe('repairs');
    expect(e?.description).toBeUndefined();
  });
});
