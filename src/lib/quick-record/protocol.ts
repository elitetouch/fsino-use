/**
 * Resolve what a farmer said against THIS FLOCK'S OWN PROTOCOL.
 *
 * The problem this exists for. Quick record knew eight vaccines and
 * four treatment words, hard-coded. The wizard's dropdowns knew a
 * different seven and six. The flock's actual protocol — the thing the
 * dashboard counts as done or overdue — knows "Glucose + Multivitamin
 * (anti-stress)", "Anticoccidial (Amprolium)", "Newcastle Disease
 * Booster (Lasota)", each with the names farmers really say attached
 * to it. Three vocabularies for one field, and only the third one is
 * the farm's.
 *
 * So a farmer said "vitamin", quick record wrote "vitamin", the
 * medical record read "vitamin", and whether the scheduled dose got
 * ticked off came down to whether one string happened to appear
 * inside the other. "Multivitamins" from the wizard does not appear
 * inside "Glucose + Multivitamin (anti-stress)" — singular against
 * plural — so that dose stays upcoming forever on a card farmers read
 * as a safety net.
 *
 * Here the protocol row IS the vocabulary. What the farmer said is
 * matched against the row's name, strain, disease target and alt
 * names, and what gets written is the row's own name, which the
 * server then matches exactly.
 *
 * NOTHING HERE BUILDS A REGEX FROM SERVER DATA. Names arrive from the
 * API and go into plain string comparisons on both sides. A protocol
 * row named "Gumboro (D78/+)" would otherwise be a pattern, and one
 * day a catastrophic one.
 */

import type { FlockScheduleItemDto } from '@/lib/api';

/** What a resolved clause carries forward. */
export interface ProtocolMatch {
  /** The schedule row's id, so a payload can point at it. */
  readonly id: string;
  /** The row's own name, written to the record verbatim. */
  readonly name: string;
  /** 'vaccination' or 'treatment' — the record's event type. */
  readonly kind: 'vaccination' | 'treatment';
  /** What it is for, used to fill the treatment reason. */
  readonly diseaseTarget: string | null;
  /** How much to give, shown back before saving. Never stored. */
  readonly dosage: string | null;
  /** Days between today and the day it is scheduled. Negative is past. */
  readonly daysFromToday: number;
  /** True when today falls inside the row's own window. */
  readonly due: boolean;
  /** Already recorded, so saying it again is probably a second dose. */
  readonly done: boolean;
}

/**
 * Words that identify nothing on their own.
 *
 * Every protocol name contains some of these, so matching on them
 * would make the first row in the list answer every sentence. They are
 * dropped from a row's search terms, never from the farmer's clause.
 */
const EMPTY_TERMS: ReadonlySet<string> = new Set([
  'disease', 'booster', 'vaccine', 'vaccination', 'treatment', 'broad',
  'spectrum', 'prophylactic', 'intermediate', 'plus', 'per', 'bird',
  'birds', 'dose', 'doses', 'water', 'drinking', 'the', 'and', 'with',
  'for', 'anti', 'day', 'days', 'old', 'live', 'killed', 'inactivated',
  'first', 'second', 'third', 'final', 'standard', 'routine',
]);

/** Shortest term worth matching. "ib" and "nd" are real, so two. */
const MIN_TERM = 2;

/**
 * Terms short enough to be an accident unless they stand alone.
 *
 * "ib" inside "bird" is not infectious bronchitis, and a clause is
 * full of two-letter fragments. These must match a whole word.
 */
const SHORT_TERM_MAX = 3;

/** Split a name into the words worth searching for. */
function termsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= MIN_TERM && !EMPTY_TERMS.has(w));
}

/**
 * Every string that should make a clause resolve to this row.
 *
 * The whole alt name is kept as well as its words, because "stress
 * pack" is two words that mean one thing and neither half is enough.
 */
function searchTerms(item: FlockScheduleItemDto): string[] {
  const out = new Set<string>();
  const add = (s: string | null | undefined) => {
    if (typeof s !== 'string' || s === '') return;
    const whole = s.toLowerCase().trim();
    if (whole.length >= MIN_TERM && !EMPTY_TERMS.has(whole)) out.add(whole);
    for (const w of termsOf(s)) out.add(w);
  };

  add(item.name);
  add(item.vaccineStrain);
  add(item.diseaseTarget);
  for (const alt of item.altNames ?? []) add(alt);

  return [...out];
}

/**
 * Shortest clause word allowed to match INSIDE a protocol name.
 *
 * This is the direction that matters most and the one that bites. A
 * farmer says "vitamin"; the row is called "Glucose + Multivitamin
 * (anti-stress)". Nothing in the name appears in the sentence, but the
 * sentence appears in the name. Five characters, because the short
 * words farmers use ("water", "drug") would otherwise find a row in
 * every protocol.
 */
const MIN_INNER_WORD = 5;

/** Does this term appear in the clause as a word, not as a fragment? */
function clauseHas(clause: string, term: string): boolean {
  let from = 0;
  for (;;) {
    const at = clause.indexOf(term, from);
    if (at < 0) return false;
    const before = at === 0 ? ' ' : clause[at - 1]!;
    const after = clause[at + term.length] ?? ' ';
    // A term may end mid-word so "multivitamin" is found by "vitamin"
    // and "vitamins", but it may never START mid-word: "vitamin" must
    // not be found inside "revitamin".
    const startsClean = !/[a-z0-9]/.test(before);
    const endsClean = !/[a-z0-9]/.test(after);
    if (startsClean && (endsClean || term.length > SHORT_TERM_MAX)) return true;
    from = at + 1;
  }
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((a - b) / 86_400_000);
}

function eventKind(item: FlockScheduleItemDto): 'vaccination' | 'treatment' {
  return item.kind === 'vaccine' ? 'vaccination' : 'treatment';
}

/**
 * The protocol row a clause is talking about, or null.
 *
 * WHAT WINS, and why in this order:
 *
 *   1. The longest term matched. "newcastle lasota" beats "newcastle"
 *      because the farmer said the more specific thing, and a cycle
 *      has three Newcastle rows that differ only by strain and day.
 *   2. Whether it is due. Of two rows that match equally well, the one
 *      scheduled for around today is the one being given today.
 *   3. Whether it is still outstanding. A dose already recorded is the
 *      less likely reading of the same words.
 *   4. How close it is to today, as the tie-break.
 *
 * A clause that matches nothing returns null, and the caller asks
 * rather than guesses. Guessing which vaccine went into a flock is the
 * last thing a health log should do.
 */
export function matchProtocol(
  clause: string,
  schedule: readonly FlockScheduleItemDto[] | undefined,
  today: string,
): ProtocolMatch | null {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  const text = ` ${clause.toLowerCase()} `;
  // The farmer's own words, for the "vitamin" inside "Multivitamin"
  // direction. Filtered by the same list as a row's terms, so "water"
  // and "dose" cannot reach into a name.
  const said = termsOf(clause).filter((w) => w.length >= MIN_INNER_WORD);

  let best: ProtocolMatch | null = null;
  let bestScore = -1;
  let bestLength = 0;

  for (const item of schedule) {
    if (!item || typeof item.name !== 'string' || item.name === '') continue;
    if (item.skipped) continue;

    let longest = 0;
    for (const term of searchTerms(item)) {
      // The row's name inside the sentence: "lasota", "stress pack".
      if (term.length > longest && clauseHas(text, term)) {
        longest = term.length;
        continue;
      }
      // The sentence's word inside the row's name: "vitamin" finding
      // "Multivitamin". Scored on what the farmer said, not on the
      // length of the name it was found in, so a long protocol name
      // cannot outrank a precise word.
      for (const word of said) {
        if (word.length > longest && term.includes(word)) longest = word.length;
      }
    }
    if (longest === 0) continue;

    const offset = daysBetween(today, item.scheduledDate);
    const window = Math.max(1, item.windowDays) + 1;
    const due = Math.abs(offset) <= window;
    const done = typeof item.completedAt === 'string' && item.completedAt !== '';

    // Scored, not sorted, so the comparison is one number and the
    // order above is readable as arithmetic.
    const score = longest * 100 + (due ? 50 : 0) + (done ? 0 : 10)
      - Math.min(40, Math.abs(offset));

    if (score > bestScore || (score === bestScore && longest > bestLength)) {
      bestScore = score;
      bestLength = longest;
      best = {
        id: item.id,
        name: item.name,
        kind: eventKind(item),
        diseaseTarget: item.diseaseTarget,
        dosage: item.dosage,
        daysFromToday: -offset,
        due,
        done,
      };
    }
  }

  return best;
}

/**
 * The rows worth offering in a picker, nearest the bird's age first.
 *
 * A farmer correcting a wrong guess is looking for something they are
 * giving today, not the day-42 booster, so the list opens where they
 * are in the cycle.
 */
export function scheduleChoices(
  schedule: readonly FlockScheduleItemDto[] | undefined,
  today: string,
  kind?: 'vaccination' | 'treatment',
): FlockScheduleItemDto[] {
  if (!Array.isArray(schedule)) return [];
  return schedule
    .filter((i) => i && !i.skipped && (kind === undefined || eventKind(i) === kind))
    .slice()
    .sort((a, b) =>
      Math.abs(daysBetween(today, a.scheduledDate))
      - Math.abs(daysBetween(today, b.scheduledDate)));
}

/**
 * The treatment reason, taken from what the protocol says the row is
 * for rather than asked again.
 *
 * The wizard makes this a required dropdown; quick record never
 * captured it at all, so every spoken treatment reached the medical
 * record with no reason on it. The protocol already knows: a row
 * targeting `antistress` is the wizard's "Stress", one targeting
 * `coccidiosis` is "Digestive illness". Anything this map does not
 * cover stays empty, because a wrong reason in a medical record is
 * worse than a missing one.
 */
const REASON_BY_TARGET: ReadonlyMap<string, string> = new Map([
  ['antistress', 'Stress (heat, transport, etc.)'],
  ['antibiotic', 'Prophylactic / routine'],
  ['coccidiosis', 'Digestive illness'],
  ['deworming', 'Internal / external parasites'],
  ['worms', 'Internal / external parasites'],
  ['respiratory', 'Respiratory illness'],
  ['vitamin', 'Prophylactic / routine'],
  ['multivitamin', 'Prophylactic / routine'],
]);

export function reasonForTarget(target: unknown): string | undefined {
  if (typeof target !== 'string') return undefined;
  return REASON_BY_TARGET.get(target.toLowerCase().trim());
}
