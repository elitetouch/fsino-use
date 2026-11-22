import { describe, it, expect } from 'vitest';

import { parseQuickRecord, MAX_INPUT } from './parse';
import { buildQuickRecordPayloads, MAX_NOTE } from './to-payloads';
import { applyCarryForward, lastFeedFromGuidance } from './carry-forward';

/**
 * The tests that matter most here are the ones under "refuses" and
 * "hostile input".
 *
 * A missed parse costs the farmer one tap in the wizard. A wrong parse
 * writes a number they never said into a flock count that drives their
 * mortality curve, their feed-conversion ratio and, through the P&L,
 * what they believe their birds are worth. The two failures are not
 * equal, so this file is weighted heavily towards proving the parser
 * declines rather than proving it succeeds.
 */

const OPTS = { recordDate: '2026-11-22', moment: 'entire_day' as const };

describe('reads the sentences farmers actually say', () => {
  it('reads plain English', () => {
    const r = parseQuickRecord('15 birds died today');
    expect(r.fields).toHaveLength(1);
    expect(r.fields[0]).toMatchObject({ kind: 'dead', value: 15, confidence: 'high' });
  });

  it('reads Pidgin', () => {
    // The form this sentence is actually spoken in. A parser that only
    // reads the textbook English version fails the farmer it is for.
    for (const said of ['15 birds don die', '15 birds don kpai']) {
      const r = parseQuickRecord(said);
      expect(r.fields[0], said).toMatchObject({ kind: 'dead', value: 15 });
    }
  });

  it('reads number words, because dictation writes them', () => {
    const r = parseQuickRecord('fifteen birds died');
    expect(r.fields[0]).toMatchObject({ kind: 'dead', value: 15 });
  });

  it('reads several facts from one breath', () => {
    const r = parseQuickRecord(
      '15 died and I gave them 2 bags of feed and collected 3 crates of eggs',
    );
    const byKind = Object.fromEntries(r.fields.map((f) => [f.kind, f.value]));
    expect(byKind).toEqual({ dead: 15, feed: 2, eggs: 90 });
  });

  it('converts crates to eggs and shows its working', () => {
    const r = parseQuickRecord('collected 3 crates');
    expect(r.fields[0]?.value).toBe(90);
    // The farmer must be able to see the conversion before saving,
    // otherwise 3 became 90 behind their back.
    expect(r.fields[0]?.conversionNote).toBe('3 crates = 90');
  });

  it('keeps bags as bags instead of guessing a bag weight', () => {
    // Nigerian feed bags are not all the same weight. The feed endpoint
    // accepts unit 'bags', so converting would invent precision.
    const r = parseQuickRecord('gave 2 bags of feed');
    expect(r.fields[0]).toMatchObject({ kind: 'feed', value: 2, unit: 'bags' });
  });

  it('attaches money to a sale', () => {
    const r = parseQuickRecord('sold 20 birds for 15000');
    expect(r.fields[0]).toMatchObject({ kind: 'sold', value: 20, amount: 15000 });
  });

  it('picks up time of day', () => {
    expect(parseQuickRecord('collected 2 crates this morning').moment).toBe('morning');
    expect(parseQuickRecord('3 died in the evening').moment).toBe('evening');
    expect(parseQuickRecord('10 died').moment).toBe('entire_day');
  });

  it('tells a layer the bird from layer mash the ration', () => {
    expect(parseQuickRecord('20 layers died')?.fields[0]?.kind).toBe('dead');
    expect(parseQuickRecord('gave 3 bags of layer mash')?.fields[0]?.kind).toBe('feed');
  });
});

describe('refuses rather than guesses', () => {
  it('will not invent a count', () => {
    // "the birds died" is a statement, not a record. Defaulting to 1
    // would put a death in the ledger the farmer never reported.
    const r = parseQuickRecord('the birds died');
    expect(r.fields).toHaveLength(0);
    expect(r.understoodNothing).toBe(true);
  });

  it('will not accept a fractional bird', () => {
    expect(parseQuickRecord('2.5 birds died').fields).toHaveLength(0);
  });

  it('does not let a generic word move the flock count', () => {
    // Without the bird-subject requirement this parses as two birds
    // lost AND two bags of feed, shrinking the flock silently.
    const r = parseQuickRecord('lost 2 bags of feed');
    expect(r.fields.some((f) => f.kind === 'lost')).toBe(false);
    expect(r.fields[0]).toMatchObject({ kind: 'feed', value: 2 });
  });

  it('never sums a repeated kind', () => {
    // Dictation repeats itself. Summing would report 15 deaths for a
    // farmer who said ten and then corrected themselves to five.
    const r = parseQuickRecord('10 died and 5 died');
    expect(r.fields.filter((f) => f.kind === 'dead')).toHaveLength(1);
    expect(r.fields[0]?.value).toBe(10);
  });

  it('flags a loss larger than the flock instead of proposing it', () => {
    const r = parseQuickRecord('500 birds died', { currentBirds: 300 });
    expect(r.fields[0]?.confidence).toBe('low');
    expect(r.fields[0]?.caution).toContain('300');
  });

  it('flags an unusually high loss', () => {
    const r = parseQuickRecord('60 birds died', { currentBirds: 300 });
    expect(r.fields[0]?.confidence).toBe('low');
  });

  it('flags a quantity with no unit', () => {
    const r = parseQuickRecord('gave them 50 of feed');
    expect(r.fields[0]).toMatchObject({ kind: 'feed', confidence: 'low' });
  });

  it('keeps what it did not understand instead of discarding it', () => {
    const r = parseQuickRecord('15 died and the roof is leaking');
    expect(r.fields[0]?.kind).toBe('dead');
    expect(r.leftover).toContain('roof');
  });
});

describe('hostile and malformed input', () => {
  it('never throws, whatever it is handed', () => {
    const nasty = [
      '', ' ', '\u0000\u0000', '￼￼￼', '<script>alert(1)</script>',
      '__proto__', 'constructor', 'toString', 'valueOf',
      '{"a":1}', 'NaN died', 'Infinity birds died', '1e309 died',
      '-5 birds died', '0x10 died', '٥ birds died', '🐔🐔🐔',
      'died '.repeat(500), '9'.repeat(10_000),
      // Callers are typed, but runtime input is not — a stale cached
      // page or a hand-rolled caller can still hand this a non-string,
      // and the record screen must not go down when it does.
      null, undefined, 123, {}, [],
    ] as unknown[];
    for (const input of nasty) {
      expect(() => parseQuickRecord(input as string), String(input)).not.toThrow();
    }
  });

  it('cannot be walked up the prototype chain', () => {
    // On a plain-object lookup, NUMBER_WORDS["constructor"] returns the
    // Object constructor — a truthy non-number reaching arithmetic from
    // dictated text. The Map in vocabulary.ts is what prevents this.
    for (const key of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
      const r = parseQuickRecord(`${key} birds died`);
      expect(r.fields, key).toHaveLength(0);
    }
  });

  it('rejects values that are not real counts', () => {
    for (const said of ['Infinity birds died', 'NaN birds died', '1e309 birds died']) {
      const r = parseQuickRecord(said);
      for (const f of r.fields) {
        expect(Number.isFinite(f.value), said).toBe(true);
        expect(f.value, said).toBeLessThanOrEqual(1_000_000);
      }
    }
  });

  it('drops an absurd magnitude rather than clamping it', () => {
    // Clamping would put a number the farmer never said in front of
    // them pre-filled and ready to confirm.
    const r = parseQuickRecord('99999999 birds died');
    expect(r.fields).toHaveLength(0);
  });

  it('caps input before any regex sees it', () => {
    const huge = `${'15 birds died and '.repeat(5000)}`;
    const started = Date.now();
    const r = parseQuickRecord(huge);
    // Linear in MAX_INPUT, not in what was pasted in.
    expect(Date.now() - started).toBeLessThan(250);
    expect(r.fields.length).toBeLessThanOrEqual(8);
  });

  it('resists backtracking blowup on adversarial shapes', () => {
    for (const shape of ['a'.repeat(400), `${'1 '.repeat(200)}died`, ' ,'.repeat(240)]) {
      const started = Date.now();
      parseQuickRecord(shape);
      expect(Date.now() - started, shape.slice(0, 12)).toBeLessThan(250);
    }
  });

  it('strips markup rather than carrying it into a note', () => {
    const r = parseQuickRecord('15 died <script>alert(1)</script>');
    expect(r.leftover).not.toContain('<');
    expect(r.leftover).not.toContain('>');
  });
});

/**
 * Every case below came from a farmer speaking into the app and getting
 * the wrong thing back. They are regressions, not hypotheticals.
 */
describe('what the recogniser actually hears', () => {
  it('reads "grit" as crate, because that is what comes back', () => {
    // Reported: saying "crate" returns "grit" every time.
    for (const said of ['3 grits', 'collected 3 grit', '3 greats', '3 grades']) {
      const r = parseQuickRecord(said);
      expect(r.fields[0], said).toMatchObject({ kind: 'eggs', value: 90 });
    }
  });

  it('reads every misheard form of Lasota', () => {
    // Reported: "lasota vaccine" came back as "la so".
    for (const said of ['la so vaccine', 'gave la sota', 'lasota', 'lassota today', 'la soda vaccine']) {
      const r = parseQuickRecord(said);
      expect(r.fields[0], said).toMatchObject({
        kind: 'vaccination',
        detail: { vaccineName: 'Lasota' },
      });
    }
  });

  it('spells the vaccine correctly whatever it heard', () => {
    // What reaches the health log must be the real name, not the
    // mishearing — this record is read back months later.
    const r = parseQuickRecord('gave them la so');
    expect(r.fields[0]?.detail?.vaccineName).toBe('Lasota');
  });

  it('reads the other vaccines farmers name', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['gumboro vaccine', 'Gumboro (IBD)'],
      ['gum borrow', 'Gumboro (IBD)'],
      ['new castle vaccine', 'Newcastle'],
      ['fowl pox', 'Fowl pox'],
    ];
    for (const [said, expected] of cases) {
      expect(parseQuickRecord(said).fields[0]?.detail?.vaccineName, said).toBe(expected);
    }
  });

  it('reads misheard litres and mash', () => {
    expect(parseQuickRecord('25 leaders of water').fields[0]).toMatchObject({
      kind: 'water',
      value: 25,
    });
    expect(parseQuickRecord('2 bags of layer marsh').fields[0]).toMatchObject({ kind: 'feed' });
  });

  it('reads every mangling of "25 bags of feed"', () => {
    // One spoken sentence, four attempts, four different wrong
    // transcripts. The word "feed" survived none of them; the
    // container survived all four, which is why the container is what
    // the rule keys on.
    for (const heard of [
      '25 bags of feed',
      '25 pounds of feet',
      '25 packs of heat',
      '25 bags',
      '25 bags feet',
    ]) {
      const r = parseQuickRecord(heard);
      expect(r.fields[0], heard).toMatchObject({
        kind: 'feed',
        value: 25,
        unit: 'bags',
      });
    }
  });

  it('does NOT log feed when "heat" appears without a container', () => {
    // Heat stress is a real daily worry. "Too much heat today" is a
    // note, not 25 bags of anything — which is why heat is carried by
    // the container rather than being a feed word on its own.
    expect(parseQuickRecord('too much heat today').fields).toHaveLength(0);
    expect(parseQuickRecord('the birds have heat stress').fields).toHaveLength(0);
  });

  it('does NOT map "called" to culled', () => {
    // The tempting mishearing, and the one that must not be added:
    // "I called the vet" would silently cull birds.
    const r = parseQuickRecord('I called the vet about 3 birds');
    expect(r.fields.some((f) => f.kind === 'culled')).toBe(false);
  });

  it('does NOT read "for" as four', () => {
    // "sold 20 birds for 15000" must stay one sale, not a count of 4.
    const r = parseQuickRecord('sold 20 birds for 15000');
    expect(r.fields).toHaveLength(1);
    expect(r.fields[0]).toMatchObject({ kind: 'sold', value: 20, amount: 15000 });
  });
});

describe('the things the wizard captures and this was missing', () => {
  it('keeps the feed ration', () => {
    const r = parseQuickRecord('two bags of starter feed');
    expect(r.fields[0]).toMatchObject({
      kind: 'feed',
      value: 2,
      unit: 'bags',
      detail: { feedType: 'starter' },
    });
  });

  it('tells layer mash the ration from layers the birds', () => {
    expect(parseQuickRecord('3 bags of layer mash').fields[0]?.detail?.feedType).toBe('layer');
    expect(parseQuickRecord('20 layers died').fields[0]?.kind).toBe('dead');
  });

  it('records a vaccination with no dose, because farmers rarely say one', () => {
    const r = parseQuickRecord('gave them lasota');
    expect(r.fields[0]).toMatchObject({ kind: 'vaccination', confidence: 'high' });
    const [p] = buildQuickRecordPayloads(r.fields, OPTS);
    expect(p).toMatchObject({ event_type: 'vaccination', payload: { vaccine_name: 'Lasota' } });
    // No dose stated means no quantity claimed.
    expect(p).not.toHaveProperty('quantity');
  });

  it('keeps a dose when one is given', () => {
    const r = parseQuickRecord('lasota 5 ml');
    const [p] = buildQuickRecordPayloads(r.fields, OPTS);
    expect(p).toMatchObject({ quantity: 5, unit: 'ml' });
  });

  it('records a treatment', () => {
    const r = parseQuickRecord('treated 20 birds with antibiotics');
    const [p] = buildQuickRecordPayloads(r.fields, OPTS);
    expect(p).toMatchObject({
      event_type: 'treatment',
      payload: { treatment_type: 'antibiotic', birds_affected: 20, all_birds: false },
    });
  });

  it('treats the whole flock when no count is given', () => {
    const r = parseQuickRecord('gave them vitamins');
    const [p] = buildQuickRecordPayloads(r.fields, OPTS);
    expect(p).toMatchObject({ payload: { treatment_type: 'vitamin', all_birds: true } });
  });

  it('keeps the egg size', () => {
    const r = parseQuickRecord('collected 30 medium eggs');
    const [p] = buildQuickRecordPayloads(r.fields, OPTS);
    expect(p?.payload).toMatchObject({ good: 30, sizes: { medium: 30 } });
  });

  it('attaches egg weight to the egg count', () => {
    const r = parseQuickRecord('collected 2 crates and egg weight 60 grams');
    const payloads = buildQuickRecordPayloads(r.fields, OPTS);
    const eggs = payloads.find((p) => p.event_type === 'eggs');
    expect(eggs?.payload).toMatchObject({ good: 60, weight_avg_grams: 60 });
  });

  it('drops an egg weight with no count rather than inventing one', () => {
    // The backend requires `good` on every eggs row. Posting a weight
    // with zero eggs would be a fabricated count.
    const r = parseQuickRecord('egg weight 60 grams');
    expect(buildQuickRecordPayloads(r.fields, OPTS)).toHaveLength(0);
  });

  it('converts bags to kg ONLY when the farmer states the bag weight', () => {
    // We never guess a bag weight — Nigerian feed bags are not all 25kg.
    expect(parseQuickRecord('2 bags of feed').fields[0]).toMatchObject({
      unit: 'bags',
      value: 2,
    });
    expect(parseQuickRecord('2 bags of 25kg feed').fields[0]).toMatchObject({
      unit: 'kg',
      value: 50,
    });
  });

  it('carries the time of day through to the payload', () => {
    const r = parseQuickRecord('25 litres of water in the morning');
    expect(r.moment).toBe('morning');
    const [p] = buildQuickRecordPayloads(r.fields, { ...OPTS, moment: r.moment });
    expect(p?.payload).toMatchObject({ moment: 'morning' });
  });
});

describe('feed brand, heard and carried forward', () => {
  it('reads brands from the known list', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['2 bags of top feeds', 'top_feeds'],
      ['3 bags vital feed', 'vital_feed'],
      ['2 bags of animal care starter', 'animal_care'],
      ['4 bags ultimate', 'ultima'],
      ['2 bags amo bing', 'amo_byng_feed'],
      ['5 bags I mixed it myself', 'own_feed'],
    ];
    for (const [said, expected] of cases) {
      expect(parseQuickRecord(said).fields[0]?.detail?.feedBrand, said).toBe(expected);
    }
  });

  it('asks about "chicken feed", because it is also just what feed is called', () => {
    // Chikun is a real brand the recogniser renders as "chicken", but
    // "chicken feed" is the generic term too. Proposed, never assumed.
    const r = parseQuickRecord('2 bags of chicken feed');
    expect(r.fields[0]).toMatchObject({
      confidence: 'low',
      detail: { feedBrand: 'chikun_feeds' },
    });
    expect(r.fields[0]?.caution).toContain('confirm');
  });

  it('carries the brand forward when the sentence did not say one', () => {
    const r = parseQuickRecord('3 bags of feed');
    const withLast = applyCarryForward(r.fields, {
      itemType: 'starter',
      itemBrand: 'top_feeds',
    });
    expect(withLast[0]?.detail).toMatchObject({
      feedType: 'starter',
      feedBrand: 'top_feeds',
      inherited: ['feedType', 'feedBrand'],
    });
  });

  it('never overwrites what the farmer actually said', () => {
    // The whole risk of carry-forward: a farmer who switched brand and
    // said so must not have last week's brand put back.
    const r = parseQuickRecord('3 bags of grower vital feed');
    const withLast = applyCarryForward(r.fields, {
      itemType: 'starter',
      itemBrand: 'top_feeds',
    });
    expect(withLast[0]?.detail).toMatchObject({
      feedType: 'grower',
      feedBrand: 'vital_feed',
    });
    expect(withLast[0]?.detail?.inherited ?? []).toHaveLength(0);
  });

  it('marks what was inherited so the UI can show it', () => {
    // An inherited brand the farmer cannot see is how weeks of records
    // end up against a brand they stopped buying.
    const r = parseQuickRecord('3 bags of feed');
    const withLast = applyCarryForward(r.fields, { itemBrand: 'top_feeds' });
    expect(withLast[0]?.detail?.inherited).toContain('feedBrand');
  });

  it('carries nothing forward when there is no previous entry', () => {
    const r = parseQuickRecord('3 bags of feed');
    expect(applyCarryForward(r.fields, null)[0]?.detail?.feedBrand).toBeUndefined();
    expect(lastFeedFromGuidance(null)).toBeNull();
    expect(lastFeedFromGuidance({})).toBeNull();
  });

  it('only lets a known brand reach the API', () => {
    const forged = [
      { kind: 'feed', value: 1, unit: 'bags', confidence: 'high', sourceText: '',
        detail: { feedBrand: 'DROP TABLE flocks' } },
    ] as const;
    const [p] = buildQuickRecordPayloads(forged, OPTS);
    expect(p?.payload).not.toHaveProperty('item_brand');
  });

  it('carries forward only onto feed, never onto a bird count', () => {
    const r = parseQuickRecord('10 birds died');
    const withLast = applyCarryForward(r.fields, { itemBrand: 'top_feeds' });
    expect(withLast[0]?.detail?.feedBrand).toBeUndefined();
  });
});

describe('payload building', () => {
  it('collapses bird movements into one bird_count event', () => {
    // Four separate events would each debit flock.current_birds.
    const r = parseQuickRecord('10 died and sold 5 birds');
    const payloads = buildQuickRecordPayloads(r.fields, OPTS);
    const birdCounts = payloads.filter((p) => p.event_type === 'bird_count');
    expect(birdCounts).toHaveLength(1);
    expect(birdCounts[0]?.payload).toMatchObject({
      dead: { count: 10 },
      sold: { count: 5 },
      culled: { count: 0 },
      lost: { count: 0 },
    });
  });

  it('omits the sale amount when no price was given', () => {
    // The backend distinguishes "sold for nothing" from "price not
    // captured yet", and the P&L disclosure depends on it.
    const r = parseQuickRecord('sold 5 birds');
    const [bc] = buildQuickRecordPayloads(r.fields, OPTS);
    expect((bc?.payload as { sold: object }).sold).not.toHaveProperty('amount');
  });

  it('emits the same shapes the wizard emits', () => {
    const r = parseQuickRecord('gave 2 bags of feed and 50 litres of water');
    const payloads = buildQuickRecordPayloads(r.fields, OPTS);
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event_type: 'feed', quantity: 2, unit: 'bags' }),
        expect.objectContaining({ event_type: 'water', quantity: 50, unit: 'liters' }),
      ]),
    );
  });

  it('only ever forwards an allowlisted unit', () => {
    const forged = [
      { kind: 'feed', value: 1, unit: 'DROP TABLE flocks', confidence: 'high', sourceText: '' },
      { kind: 'water', value: 1, unit: '../../etc/passwd', confidence: 'high', sourceText: '' },
    ] as const;
    const payloads = buildQuickRecordPayloads(forged, OPTS);
    expect(payloads.map((p) => p.unit)).toEqual(['kg', 'liters']);
  });

  it('re-checks numbers even though the parser already did', () => {
    const forged = [
      { kind: 'dead', value: Number.POSITIVE_INFINITY, confidence: 'high', sourceText: '' },
      { kind: 'feed', value: Number.NaN, confidence: 'high', sourceText: '' },
      { kind: 'eggs', value: -5, confidence: 'high', sourceText: '' },
    ] as const;
    expect(buildQuickRecordPayloads(forged, OPTS)).toHaveLength(0);
  });

  it('caps the note instead of forwarding something unbounded', () => {
    const payloads = buildQuickRecordPayloads([], { ...OPTS, note: 'x'.repeat(5000) });
    expect((payloads[0]?.note ?? '').length).toBe(MAX_NOTE);
  });

  it('produces nothing at all from an empty confirmation', () => {
    expect(buildQuickRecordPayloads([], OPTS)).toHaveLength(0);
  });
});

describe('module invariants', () => {
  it('is pure — same input, same output, no clock', () => {
    const a = parseQuickRecord('15 died and 2 bags of feed');
    const b = parseQuickRecord('15 died and 2 bags of feed');
    expect(a).toEqual(b);
  });

  it('caps at the documented input length', () => {
    expect(MAX_INPUT).toBeLessThanOrEqual(2000);
  });
});
