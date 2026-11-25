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
    expect(e?.description).toBe('3 bags of feed');
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
    expect(e?.description).toBe('50 kg of feed');
  });

  it('keeps a single bag singular', () => {
    const [e] = build('bought 1 bag of feed for 13000');
    expect(e?.description).toBe('1 bag of feed');
  });

  it('reads the quantity when it follows the price', () => {
    const [e] = build('paid 45000 for 3 bags of feed');
    expect(e?.description).toBe('3 bags of feed');
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

describe('a spoken row reads like a typed one', () => {
  // A farmer filling in Add expense writes "2 bags of feed" in the
  // description and the brand in vendor. Quick record wrote "2 bags"
  // and no vendor, so the two looked like different kinds of record
  // sitting next to each other in the same ledger.
  it('names the goods in the description', () => {
    expect(build('bought 2 bags of feed for 25000')[0]?.description)
      .toBe('2 bags of feed');
  });

  it('puts the brand in vendor', () => {
    const [e] = build('bought 2 bags of new hope for 25000');
    expect(e?.vendor).toBe('New Hope');
    expect(e?.category).toBe('feed');
  });

  it('carries a misheard brand through its known forms', () => {
    expect(build('bought 5 bags of nu hope for 60000')[0]?.vendor).toBe('New Hope');
  });

  it('leaves vendor empty when no brand was named', () => {
    expect(build('bought 2 bags of feed for 25000')[0]).not.toHaveProperty('vendor');
  });

  // "chicken feed" matching Chikun is flagged uncertain in the brand
  // table. Worth a question on a feed record, where the brand is the
  // point; not worth printing on a cost row as if it were certain.
  it('does not print an uncertain brand', () => {
    expect(build('bought 2 bags of chicken feed for 25000')[0])
      .not.toHaveProperty('vendor');
  });

  it('names the goods for fuel too', () => {
    expect(build('bought 20 litres of diesel for 30000')[0]?.description)
      .toBe('20 litres of fuel');
  });

  // "3 bags of equipment" is not something anyone says.
  it('leaves the bare count where a noun would not read', () => {
    expect(build('bought 3 crates for 9000')[0]?.description).toBe('3 crates');
  });

  it('never invents a vendor from a word the recogniser produced', () => {
    const forged = [{
      kind: 'expense' as const, value: 25000, confidence: 'high' as const,
      sourceText: '', detail: { expenseCategory: 'feed', feedBrandLabel: 'Not A Brand' },
    }];
    expect(buildExpensePayloads(forged, { recordDate: '2026-11-25', currency: 'NGN' })[0]).not.toHaveProperty('vendor');
  });
});
