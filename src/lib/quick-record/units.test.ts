import { describe, it, expect } from 'vitest';
import { parseQuickRecord } from '@/lib/quick-record/parse';

const one = (text: string) => {
  const f = parseQuickRecord(text).fields;
  return f.length === 1 ? `${f[0]!.kind}=${f[0]!.value}${f[0]!.unit ?? ''}` : JSON.stringify(f.map((x) => x.kind));
};

describe('a unit written against the digits', () => {
  // Every UNITS pattern opens with \b, which never matches between a
  // digit and a letter. "50kg of feed" used to parse to nothing.
  it('reads feed with no space', () => {
    expect(one('gave them 50kg of feed')).toBe('feed=50kg');
  });

  it('reads water with no space', () => {
    expect(one('gave them 20litres of water')).toBe('water=20liters');
  });

  it('reads a bird weight with no space', () => {
    expect(one('the birds weigh 2kg')).toBe('weight=2kg');
  });

  it('still reads the spaced form', () => {
    expect(one('gave them 50 kg of feed')).toBe('feed=50kg');
  });

  it('leaves the money multipliers alone', () => {
    // "45k" is forty-five thousand. Splitting it would make it 45.
    const f = parseQuickRecord('bought feed for 45k').fields;
    expect(f[0]?.kind).toBe('expense');
    expect(f[0]?.value).toBe(45000);
  });

  it('leaves millions alone', () => {
    const f = parseQuickRecord('bought birds for 1.5m').fields;
    expect(f[0]?.value).toBe(1_500_000);
  });
});

describe('a kilogram is not automatically a bird', () => {
  // This recorded a 50kg average bird weight, which then fed the
  // weight chart and the FCR that reads the latest weight off it.
  it('files feed in kilograms as feed', () => {
    expect(one('gave them 50 kg of feed')).toBe('feed=50kg');
  });

  it('files water in kilograms as water', () => {
    expect(one('gave them 20 litres of water')).toBe('water=20liters');
  });

  it('still reads a bare weight as a weight', () => {
    expect(one('2 kilos')).toBe('weight=2kg');
  });

  it('keeps an explicit weigh word winning', () => {
    expect(one('average weight 2 kg')).toBe('weight=2kg');
  });

  it('keeps bags as bags, for the server to convert', () => {
    expect(one('gave them 2 bags of feed')).toBe('feed=2bags');
  });

  it('uses the weight the farmer stated over any default', () => {
    expect(one('gave them 2 bags of 25kg feed')).toBe('feed=50kg');
  });
});
