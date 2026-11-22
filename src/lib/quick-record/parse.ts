/**
 * Turn one dictated sentence into daily-record fields the farmer can
 * confirm.
 *
 * WHERE THE VOICE COMES FROM. Nowhere in this module, and nowhere in
 * this app. The farmer taps the microphone on their own phone keyboard
 * and the OS writes text into a plain input. That means no audio is
 * recorded, no audio is uploaded, no microphone permission is requested
 * and no speech API is called — there is simply nothing here for an
 * attacker to reach, and nothing that costs the farmer data. Everything
 * below operates on a string that is already on the device.
 *
 * THIS PARSER IS A CONVENIENCE, NOT AN AUTHORITY. It only ever proposes
 * values into a form the farmer must confirm, and the backend's
 * CreateFlockEventRequest validators remain the only thing that decides
 * what is allowed to be stored. Nothing here may be treated as
 * validation, and no output of this module should ever be POSTed without
 * passing through the same endpoints the wizard uses.
 *
 * SAFETY PROPERTIES, each of which has a test:
 *   - Pure. No I/O, no network, no storage, no clock, no globals.
 *   - Input is hard-capped before any regex sees it (MAX_INPUT).
 *   - Every regex is a flat alternation of literals. No nesting of
 *     quantifiers, so no catastrophic backtracking is reachable.
 *   - No RegExp is ever constructed from farmer text.
 *   - Numbers are range-checked and integer-coerced; NaN, Infinity and
 *     absurd magnitudes are dropped rather than clamped silently.
 *   - Lookups of farmer-supplied keys go through a Map, never a plain
 *     object, so the prototype chain is unreachable.
 */

import {
  BIRD_WORDS,
  CLAUSE_SPLIT,
  KEYWORDS,
  MOMENT_WORDS,
  NUMBER_WORDS,
  REQUIRES_BIRD_SUBJECT,
  UNITS,
  type FieldKind,
  type UnitSpec,
} from './vocabulary';

/**
 * Longest input we will look at.
 *
 * A dictated farm record is a sentence. Anything past this is either a
 * stuck dictation session or someone probing for a way to make the
 * parser expensive, and both are answered the same way — we truncate
 * before the first regex runs, so parse time cannot be driven up from
 * outside.
 */
export const MAX_INPUT = 500;

/** Most clauses we will classify, after splitting. */
const MAX_CLAUSES = 24;

/**
 * Largest count we will propose for anything.
 *
 * Chosen to sit above any real single-day figure for a Nigerian poultry
 * house and far below the point where integer precision gets strange.
 * A number beyond this is not clamped — it is dropped, because clamping
 * would put a figure the farmer never said into a field they are about
 * to confirm.
 */
const MAX_VALUE = 1_000_000;

export interface ParsedField {
  readonly kind: FieldKind;
  /** Always a finite, non-negative number within MAX_VALUE. */
  readonly value: number;
  /** What the API expects in `unit`, when the kind carries one. */
  readonly unit?: string;
  /** Money attached to a sale, when the sentence gave one. */
  readonly amount?: number;
  /**
   * `low` means the farmer should look twice before saving. The UI must
   * visually distinguish these; it must not silently drop them.
   */
  readonly confidence: 'high' | 'low';
  /** Why confidence is low, shown under the chip. Never free-form user text. */
  readonly caution?: string;
  /** The clause this came from, echoed on the chip so the farmer can check. */
  readonly sourceText: string;
  /** Set when a container count was converted, e.g. crates to eggs. */
  readonly conversionNote?: string;
}

export interface ParseResult {
  readonly fields: readonly ParsedField[];
  /** Clauses we could not classify. Offered as a note, never guessed at. */
  readonly leftover: string;
  readonly moment: 'morning' | 'evening' | 'entire_day';
  /** True when the text had content but produced nothing we understood. */
  readonly understoodNothing: boolean;
}

/**
 * Optional flock context. This is the advantage a general-purpose farm
 * ledger does not have: we know how many birds are in the pen, so we can
 * flag a mortality figure that exceeds the flock instead of cheerfully
 * proposing it.
 */
export interface ParseContext {
  readonly currentBirds?: number;
}

/** Strip anything that is not plain sentence material, then cap length. */
function normalise(raw: string): string {
  return raw
    .slice(0, MAX_INPUT)
    .toLowerCase()
    // An ALLOWLIST, not a denylist, and that is the security-relevant
    // choice: letters, digits, whitespace and the three separators the
    // grammar uses survive; everything else becomes a space. That covers
    // control characters, zero-width joiners, bidirectional overrides,
    // markup and emoji in one rule, without anyone having to remember to
    // extend a list of bad characters.
    //
    // \p{L} rather than [a-z] on purpose — stripping non-Latin letters
    // here would silently mangle any language the app adds later.
    .replace(/[^\p{L}\p{N}\s,.;]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Read a number out of a clause: digits first, then a number word.
 *
 * Returns null rather than a default. A clause with a keyword and no
 * number is not a record — "the birds died" without a count must go to
 * the wizard, not save a zero or a one.
 */
function readNumber(clause: string): number | null {
  const digits = clause.match(/\b(\d{1,7})(?:\.(\d{1,3}))?\b/);
  if (digits) {
    // Built from a bounded digit match, so this cannot be exponential
    // notation, a hex literal or anything else Number() would surprise
    // us with.
    const whole = Number.parseInt(digits[1] as string, 10);
    const frac = digits[2] ? Number.parseFloat(`0.${digits[2]}`) : 0;
    const n = whole + frac;
    return isUsable(n) ? n : null;
  }

  for (const token of clause.split(' ')) {
    const n = NUMBER_WORDS.get(token);
    if (n !== undefined && isUsable(n)) return n;
  }
  return null;
}

/** The single gate every number passes before it can reach a field. */
function isUsable(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= MAX_VALUE;
}

/** Money following "for" — "sold 20 birds for 15000". */
function readAmount(clause: string): number | undefined {
  const m = clause.match(/\bfor\s+(\d{1,9})(?:\.(\d{1,2}))?\b/);
  if (!m) return undefined;
  const whole = Number.parseInt(m[1] as string, 10);
  const frac = m[2] ? Number.parseFloat(`0.${m[2]}`) : 0;
  const amount = whole + frac;
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_VALUE
    ? amount
    : undefined;
}

function readUnit(clause: string): UnitSpec | null {
  for (const { re, spec } of UNITS) {
    if (re.test(clause)) return spec;
  }
  return null;
}

function classifyClause(clause: string): FieldKind | null {
  for (const { kind, re } of KEYWORDS) {
    if (!re.test(clause)) continue;
    // Generic words only count when the clause also names a bird.
    if (REQUIRES_BIRD_SUBJECT.has(kind) && !BIRD_WORDS.test(clause)) continue;
    return kind;
  }
  return null;
}

function readMoment(text: string): 'morning' | 'evening' | 'entire_day' {
  for (const { re, moment } of MOMENT_WORDS) {
    if (re.test(text)) return moment;
  }
  return 'entire_day';
}

/**
 * Build one field from one clause, or return null if the clause does not
 * carry a complete, believable fact.
 */
function buildField(
  clause: string,
  kind: FieldKind,
  ctx: ParseContext,
): ParsedField | null {
  const raw = readNumber(clause);
  if (raw === null) return null;

  const unitSpec = readUnit(clause);
  let value = raw;
  let conversionNote: string | undefined;

  // Container to base unit, e.g. 3 crates to 90 eggs. Only done where
  // the vocabulary says a conversion exists, and always surfaced.
  if (unitSpec?.perUnit != null && unitSpec.perUnit !== 1) {
    const converted = raw * unitSpec.perUnit;
    if (!isUsable(converted)) return null;
    value = converted;
    conversionNote = `${raw} ${unitSpec.label}${raw === 1 ? '' : 's'} = ${converted}`;
  }

  // Head counts are whole birds. A fractional bird is a mis-parse, not a
  // value to round.
  const isHeadCount =
    kind === 'dead' || kind === 'culled' || kind === 'sold' || kind === 'lost';
  if (isHeadCount && !Number.isInteger(value)) return null;
  if (kind === 'eggs' && !Number.isInteger(value)) return null;

  // Zero is a real answer for eggs ("collected no eggs") but not for a
  // death or a bag of feed — there, zero means the sentence was not
  // actually a record.
  if (value === 0 && kind !== 'eggs') return null;

  let confidence: 'high' | 'low' = 'high';
  let caution: string | undefined;

  // The context check a general-purpose ledger cannot do. We know the
  // flock size, so a loss bigger than the flock is certainly wrong.
  if (isHeadCount && typeof ctx.currentBirds === 'number' && ctx.currentBirds >= 0) {
    if (value > ctx.currentBirds) {
      confidence = 'low';
      caution = `More than the ${ctx.currentBirds} birds currently in this pen`;
    } else if (ctx.currentBirds > 0 && value / ctx.currentBirds > 0.1) {
      confidence = 'low';
      caution = 'Unusually high for one day — check before saving';
    }
  }

  // A number with no unit where a unit is expected is a guess.
  if ((kind === 'feed' || kind === 'water' || kind === 'weight') && !unitSpec) {
    confidence = 'low';
    caution = 'No unit heard — confirm the unit before saving';
  }

  return {
    kind,
    value,
    unit: unitSpec?.apiUnit,
    amount: kind === 'sold' ? readAmount(clause) : undefined,
    confidence,
    caution,
    sourceText: clause,
    conversionNote,
  };
}

/**
 * Parse a dictated sentence into confirmable fields.
 *
 * Never throws. A parser that throws on strange input would take the
 * record screen down with it, and strange input is exactly what
 * dictation produces.
 */
export function parseQuickRecord(
  input: string,
  ctx: ParseContext = {},
): ParseResult {
  if (typeof input !== 'string') {
    return { fields: [], leftover: '', moment: 'entire_day', understoodNothing: false };
  }

  const text = normalise(input);
  if (text === '') {
    return { fields: [], leftover: '', moment: 'entire_day', understoodNothing: false };
  }

  const moment = readMoment(text);
  const clauses = text.split(CLAUSE_SPLIT).slice(0, MAX_CLAUSES);

  const fields: ParsedField[] = [];
  const unmatched: string[] = [];
  // One field per kind. If a farmer says "10 died and 5 died", the
  // second clause is almost certainly a correction or a repeat from
  // dictation, and silently summing them into 15 deaths would be the
  // worst possible guess.
  const seen = new Set<FieldKind>();

  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (trimmed === '') continue;

    const kind = classifyClause(trimmed);
    if (kind === null || seen.has(kind)) {
      unmatched.push(trimmed);
      continue;
    }

    const field = buildField(trimmed, kind, ctx);
    if (field === null) {
      unmatched.push(trimmed);
      continue;
    }

    seen.add(kind);
    fields.push(field);
  }

  return {
    fields,
    leftover: unmatched.join(', '),
    moment,
    understoodNothing: fields.length === 0,
  };
}
