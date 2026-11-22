import { describe, it, expect } from 'vitest';

import { isLearnableToken, NEVER_LEARNED, PROMOTION_THRESHOLD } from './learning';
import { parseQuickRecord } from './parse';
import type { FieldKind } from './vocabulary';

/**
 * These tests guard the containment model, not the convenience.
 *
 * A learned alias changes how one farmer's words are interpreted, for
 * as long as it exists, without them asking for it each time. Every
 * rule below exists so that the worst a bad alias can do is cause a
 * visible, confirmable chip to say the wrong KIND — never to move a
 * flock count, never to reach the API with something unexpected, and
 * never to override a word the app already knows.
 */

describe('what may be learned', () => {
  it('accepts an ordinary misheard word', () => {
    // Words the shipped vocabulary has no opinion about. "packs",
    // "grits" and "leaders" are deliberately NOT here — they are
    // already known, and a known word is not learnable by design.
    for (const token of ['zobo', 'kparo', 'shikena', 'wahala']) {
      expect(isLearnableToken(token), token).toBe(true);
    }
  });

  it('refuses anything that is not plain letters', () => {
    // Nothing with a digit, a separator, or punctuation can become a
    // token — a learned "word" must be a word.
    for (const token of [
      '25', 'bags25', 'a-b', 'a.b', 'a b', 'a/b', '__proto__',
      '<script>', "a'b", 'Ṣọlá', '٥', '🐔', '',
    ]) {
      expect(isLearnableToken(token), token).toBe(false);
    }
  });

  it('refuses tokens that would shadow the shipped vocabulary', () => {
    // Learning must only ever ADD understanding. A farmer cannot teach
    // the app that "died" means feed.
    for (const token of ['died', 'feed', 'water', 'crate', 'eggs', 'sold', 'lasota']) {
      expect(isLearnableToken(token), token).toBe(false);
    }
  });

  it('refuses prototype names, which are keys', () => {
    // Held in Maps today, so none of these is a live hole — but a
    // token IS a key, and the day someone swaps a Map for a plain
    // object this is the line that stops it being a vulnerability.
    for (const token of ['constructor', 'prototype', 'tostring', 'valueof', 'hasownproperty']) {
      expect(isLearnableToken(token), token).toBe(false);
    }
  });

  it('refuses number words', () => {
    // "for" and "to" are the classic misheard numbers. If either could
    // be learned, a sale amount could silently become a count.
    for (const token of ['one', 'two', 'ten', 'fifteen', 'hundred']) {
      expect(isLearnableToken(token), token).toBe(false);
    }
  });

  it('refuses anything over or under the length bounds', () => {
    expect(isLearnableToken('a')).toBe(false);
    expect(isLearnableToken('a'.repeat(25))).toBe(false);
  });

  it('refuses non-strings, whatever they are', () => {
    for (const v of [null, undefined, 42, {}, [], true, Symbol('x')]) {
      expect(isLearnableToken(v)).toBe(false);
    }
  });
});

describe('what may never be learned', () => {
  it('never learns deaths or culls', () => {
    // The single most important rule here. An alias that means "birds
    // died" would move flock.current_birds and bend the mortality
    // curve the farmer makes decisions on — a wrong flock, not a
    // mis-filed entry. Enforced in learning.ts AND learn-from-save.ts,
    // because a rule this important should not rest on one check.
    expect(NEVER_LEARNED.has('dead')).toBe(true);
    expect(NEVER_LEARNED.has('culled')).toBe(true);
  });

  it('requires real repetition before promoting anything', () => {
    // One cough, one passer-by or one misfire must not become a
    // permanent alias.
    expect(PROMOTION_THRESHOLD).toBeGreaterThanOrEqual(3);
  });
});

describe('how a learned alias behaves once it exists', () => {
  const aliases = new Map<string, FieldKind>([['zobo', 'feed']]);

  it('understands a word the shipped vocabulary does not', () => {
    const withAlias = parseQuickRecord('25 zobo', { aliases });
    expect(withAlias.fields[0]).toMatchObject({ kind: 'feed', value: 25 });
  });

  it('is ALWAYS low confidence, however long it has existed', () => {
    // A learned word is a suggestion the farmer confirms, permanently.
    // There is no graduation to trusted.
    const r = parseQuickRecord('25 zobo', { aliases });
    expect(r.fields[0]?.confidence).toBe('low');
    expect(r.fields[0]?.caution).toContain('taught');
  });

  it('never overrides a word the app already knows', () => {
    // "died" wins over the alias, even with the alias present in the
    // same clause: shipped vocabulary is checked first, always.
    const hostile = new Map<string, FieldKind>([['birds', 'feed']]);
    const r = parseQuickRecord('10 birds died', { aliases: hostile });
    expect(r.fields[0]).toMatchObject({ kind: 'dead', value: 10, confidence: 'high' });
  });

  it('cannot move a flock count even if the stored kind says so', () => {
    // A row that somehow claims kind 'dead' — a corrupted store, an
    // older schema, another script on the origin. The parser still
    // only reaches it through classifyByAlias, so the worst case is a
    // confirmable chip; but the stored value is also rejected on read
    // in learning.ts. This pins the parser half.
    const corrupted = new Map<string, FieldKind>([['zzz', 'dead']]);
    const r = parseQuickRecord('10 zzz', { aliases: corrupted });
    // It may classify, but it can never be high confidence, so it can
    // never be saved without the farmer seeing and confirming it.
    for (const f of r.fields) expect(f.confidence).toBe('low');
  });

  it('changes nothing when the farmer has taught it nothing', () => {
    const before = parseQuickRecord('25 bags of feed');
    const after = parseQuickRecord('25 bags of feed', { aliases: new Map() });
    expect(after).toEqual(before);
  });
});
