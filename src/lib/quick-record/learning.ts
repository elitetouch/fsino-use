'use client';

import { getDB } from '@/lib/offline/db';
import { KEYWORDS, NUMBER_WORDS, type FieldKind } from './vocabulary';

/**
 * Per-farmer vocabulary, learned from the words they actually get back.
 *
 * WHY THIS EXISTS. Mishearings are speaker-specific. A Yoruba speaker's
 * "crate" and a Hausa speaker's "crate" are mangled differently by a
 * recogniser trained mostly on American English, so one global list
 * averages across accents and stays mediocre for everyone. A list that
 * belongs to one farmer converges on one voice and gets genuinely good.
 *
 * WHAT THIS IS NOT. It does not train a speech model — nobody can
 * retrain Chrome's recogniser from a web page, and SpeechGrammarList is
 * in the spec but ignored. This is a post-processing alias table: "for
 * THIS farmer, the word 'packs' means feed". No ML, no model, a lookup.
 *
 * ──────────────────────────────────────────────────────────────────
 * THE CONTAINMENT MODEL, which is the part that matters for safety.
 *
 * A learned alias can express exactly ONE thing: that a token maps to
 * one of the fixed FieldKind values. It cannot carry a number, a unit,
 * a brand, a vaccine name, a payload fragment or anything else. So the
 * worst a poisoned alias can do is cause a clause to be classified as
 * the wrong KIND — which surfaces as a visible chip the farmer must
 * confirm, and which the existing allowlists in to-payloads.ts still
 * police on the way to the API. Learning cannot widen what this feature
 * is able to send.
 *
 * On top of that:
 *   - Tokens are validated hard on the way in AND on the way out of
 *     storage. IndexedDB is not a trust boundary: another script on the
 *     origin, a corrupted upgrade or a stale schema can all put junk
 *     there, so nothing read back is believed without re-checking.
 *   - `dead` and `culled` are NEVER learned. Teaching the app that some
 *     sound means "birds died" is the one mistake that corrupts the
 *     flock count and the mortality curve, and it is not worth any
 *     amount of convenience.
 *   - A token that is already a global keyword, a number word, or
 *     anything but plain letters is rejected, so learning can never
 *     shadow or redefine the shipped vocabulary.
 *   - Counts, lengths and row totals are all bounded, so the store
 *     cannot be grown without limit by a stuck dictation loop.
 *   - Aliases only ever produce LOW-confidence fields. A learned word
 *     is a suggestion the farmer confirms, for as long as it exists.
 * ──────────────────────────────────────────────────────────────────
 */

/** Learned aliases are only allowed to mean these. */
const LEARNABLE_KINDS: ReadonlySet<FieldKind> = new Set<FieldKind>([
  'feed',
  'water',
  'eggs',
  'weight',
  'sold',
  'lost',
  'vaccination',
  'treatment',
  'egg_weight',
]);

/**
 * Kinds that are never learned, spelled out so the omission above reads
 * as a decision rather than an oversight.
 *
 * `dead` and `culled` both reduce flock.current_birds and feed the
 * mortality curve the farmer makes decisions on. A wrong alias there is
 * not a mis-filed entry, it is a wrong flock.
 */
export const NEVER_LEARNED: ReadonlySet<FieldKind> = new Set<FieldKind>(['dead', 'culled']);

/** How many times a token must recur before it becomes an alias. */
export const PROMOTION_THRESHOLD = 3;

/**
 * Words that are never tokens, because a token is a key.
 *
 * `__proto__` and `constructor` cannot pass the letters-only test, but
 * `constructor`, `prototype`, `tostring` and friends can, and they are
 * real English-ish strings a recogniser could plausibly emit. Nothing
 * currently indexes an object by a token — it is Maps throughout — so
 * this is defence in depth rather than a live hole.
 */
const DANGEROUS_KEYS: ReadonlySet<string> = new Set([
  'constructor', 'prototype', 'proto', 'tostring', 'valueof',
  'hasownproperty', 'isprototypeof', 'tolocalestring',
]);

/** Hard caps, so a stuck recogniser cannot grow the store without end. */
const MAX_TOKEN_LEN = 24;
const MIN_TOKEN_LEN = 2;
const MAX_OBSERVATIONS = 500;
const MAX_ALIASES = 300;

export interface LearnedAlias {
  /** Lowercase, letters only. The key. */
  readonly token: string;
  readonly kind: FieldKind;
  /** Times seen before promotion, kept for the management screen. */
  readonly hits: number;
  readonly createdAt: number;
  /** False once the farmer deletes it — tombstoned, not removed, so a
   *  later sync cannot resurrect it. */
  readonly active: boolean;
  /** Set when the row has been pushed to the account. */
  readonly syncedAt?: number;
}

interface Observation {
  /** `${token}|${kind}` */
  readonly id: string;
  readonly token: string;
  readonly kind: FieldKind;
  readonly hits: number;
  readonly lastSeen: number;
}

/**
 * Is this token something we are willing to learn?
 *
 * Deliberately strict. Everything rejected here is a token that could
 * either collide with shipped vocabulary or is not a word at all.
 */
export function isLearnableToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  if (token.length < MIN_TOKEN_LEN || token.length > MAX_TOKEN_LEN) return false;
  // Plain lowercase letters only. No digits (a number is never a word
  // to learn), no punctuation, no separators, nothing that could be
  // read as a pattern by anything downstream.
  if (!/^[a-z]+$/.test(token)) return false;
  // Never a prototype name. Learned tokens are held in Maps today, so
  // this is safe either way — but a token is a KEY, and the day
  // somebody swaps a Map for a plain object, "constructor" or
  // "__proto__" sitting in the farmer's vocabulary becomes a hole that
  // nobody re-reviews. Rejected at the door instead.
  if (DANGEROUS_KEYS.has(token)) return false;
  // Never shadow a number word — "for" must not become learnable.
  if (NUMBER_WORDS.has(token)) return false;
  // Never shadow or redefine a shipped keyword.
  if (KEYWORDS.some(({ re }) => re.test(token))) return false;
  return true;
}

function isLearnableKind(kind: unknown): kind is FieldKind {
  return typeof kind === 'string' && LEARNABLE_KINDS.has(kind as FieldKind);
}

/**
 * Re-validate a row coming OUT of storage.
 *
 * IndexedDB is same-origin storage, not a trust boundary — a stale
 * schema, a half-finished upgrade or another script on the origin can
 * all leave rows that were never written by this version of the code.
 * Everything is checked again rather than cast.
 */
function readAlias(row: unknown): LearnedAlias | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (!isLearnableToken(r.token) || !isLearnableKind(r.kind)) return null;
  if (NEVER_LEARNED.has(r.kind)) return null;
  const hits = typeof r.hits === 'number' && Number.isFinite(r.hits) ? r.hits : 0;
  const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : 0;
  return {
    token: r.token,
    kind: r.kind,
    hits: Math.max(0, Math.min(hits, 1_000_000)),
    createdAt,
    active: r.active !== false,
    syncedAt: typeof r.syncedAt === 'number' ? r.syncedAt : undefined,
  };
}

/**
 * Note that a token went unrecognised in a clause the farmer then
 * recorded as `kind`, and promote it once it has recurred enough.
 *
 * Why a threshold at all: learning from a single instance would let one
 * cough, one passer-by or one misfire become a permanent alias. Three
 * separate occasions is cheap to reach for a word the farmer really
 * does say, and essentially unreachable by accident.
 *
 * Never throws. A failure to learn must never take down a save.
 */
export async function observe(tokens: readonly string[], kind: FieldKind): Promise<void> {
  if (!isLearnableKind(kind) || NEVER_LEARNED.has(kind)) return;

  const candidates = Array.from(new Set(tokens)).filter(isLearnableToken).slice(0, 8);
  if (candidates.length === 0) return;

  try {
    const db = await getDB();
    const now = Date.now();

    for (const token of candidates) {
      const id = `${token}|${kind}`;
      const existing = (await db.get('vocabObservations', id)) as Observation | undefined;
      const hits = (existing?.hits ?? 0) + 1;

      if (hits >= PROMOTION_THRESHOLD) {
        const count = await db.count('vocabAliases');
        if (count < MAX_ALIASES) {
          const prior = readAlias(await db.get('vocabAliases', token));
          // A token the farmer has already deleted stays deleted. They
          // told us it was wrong; re-learning it would be the app
          // arguing with them.
          if (!prior || prior.active) {
            const alias: LearnedAlias = {
              token,
              kind,
              hits,
              createdAt: prior?.createdAt ?? now,
              active: true,
            };
            await db.put('vocabAliases', alias);
          }
        }
        await db.delete('vocabObservations', id);
      } else {
        await db.put('vocabObservations', { id, token, kind, hits, lastSeen: now });
      }
    }

    // Bound the observation store. Oldest first — a token seen once
    // months ago is noise, not a pending alias.
    const total = await db.count('vocabObservations');
    if (total > MAX_OBSERVATIONS) {
      const all = (await db.getAll('vocabObservations')) as Observation[];
      all
        .sort((a, b) => (a.lastSeen ?? 0) - (b.lastSeen ?? 0))
        .slice(0, total - MAX_OBSERVATIONS)
        .forEach((o) => void db.delete('vocabObservations', o.id));
    }
  } catch {
    // Learning is a convenience. It must never break saving a record.
  }
}

/** Every active alias, re-validated. Never throws. */
export async function activeAliases(): Promise<readonly LearnedAlias[]> {
  try {
    const db = await getDB();
    const rows = await db.getAll('vocabAliases');
    return rows
      .map(readAlias)
      .filter((a): a is LearnedAlias => a !== null && a.active)
      .slice(0, MAX_ALIASES);
  } catch {
    return [];
  }
}

/** Everything, including deleted rows, for the management screen. */
export async function allAliases(): Promise<readonly LearnedAlias[]> {
  try {
    const db = await getDB();
    const rows = await db.getAll('vocabAliases');
    return rows.map(readAlias).filter((a): a is LearnedAlias => a !== null);
  } catch {
    return [];
  }
}

/**
 * Forget a word.
 *
 * Tombstoned rather than deleted, so that a later sync from another
 * device cannot resurrect something the farmer has explicitly rejected.
 */
export async function forgetAlias(token: string): Promise<void> {
  if (!isLearnableToken(token)) return;
  try {
    const db = await getDB();
    const prior = readAlias(await db.get('vocabAliases', token));
    if (!prior) return;
    await db.put('vocabAliases', { ...prior, active: false });
  } catch {
    /* non-fatal */
  }
}

/** Forget everything. Offered on the management screen. */
export async function forgetAll(): Promise<void> {
  try {
    const db = await getDB();
    for (const alias of await allAliases()) {
      await db.put('vocabAliases', { ...alias, active: false });
    }
    await db.clear('vocabObservations');
  } catch {
    /* non-fatal */
  }
}
