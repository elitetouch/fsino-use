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
  EGG_SIZES,
  FEED_BRANDS,
  NON_BRAND_WORDS,
  BUY_VERBS,
  EXPENSE_CATEGORIES,
  MONEY_MULTIPLIERS,
  MAX_MONEY,
  FEED_TYPES,
  KEYWORDS,
  MOMENT_WORDS,
  NUMBER_WORDS,
  REQUIRES_BIRD_SUBJECT,
  TREATMENT_TYPES,
  UNITS,
  VACCINES,
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

/**
 * Below this, an expense is more likely a mis-heard "45k" than a real
 * price. Nigerian naira: a hundred buys almost nothing on a farm.
 */
const IMPLAUSIBLE_EXPENSE = 100;

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
  /**
   * Kind-specific extras the wizard steps also capture: which ration,
   * which vaccine, which egg size. Absent when the sentence did not say.
   */
  readonly detail?: {
    /** feed — starter / grower / finisher / layer. */
    readonly feedType?: string;
    /** feed — the stored brand value, e.g. 'top_feeds'. */
    readonly feedBrand?: string;
    /** feed — the brand's display name, for the chip. */
    readonly feedBrandLabel?: string;
    /**
     * feed — the farmer named a brand we could not match. Set only
     * when `feedBrand` is absent, and it means "leave this empty"
     * rather than "fill it in from last time": carry-forward must not
     * answer a question the farmer has already answered.
     */
    readonly brandStated?: boolean;
    /** expense — which of the backend's categories the money went to. */
    readonly expenseCategory?: string;
    /**
     * Keys in this detail that were carried over from the farmer's last
     * record rather than heard in this sentence. The UI must mark these
     * — an inherited brand the farmer cannot see is how weeks of
     * records get attributed to a brand they stopped buying.
     */
    readonly inherited?: readonly string[];
    /** vaccination — correctly spelled, whatever was heard. */
    readonly vaccineName?: string;
    /** treatment — antibiotic / dewormer / vitamin / coccidiostat. */
    readonly treatmentType?: string;
    /** eggs — small / medium / jumbo. */
    readonly eggSize?: string;
  };
}

/**
 * Something understood, then declined because this flock cannot have
 * it.
 *
 * Surfaced rather than dropped. A farmer who says "3 crates" and sees
 * nothing happen learns only that the app is unreliable; one who is
 * told broilers do not lay eggs learns something true about their own
 * records, and stops trying.
 */
export interface RejectedField {
  readonly kind: FieldKind;
  readonly reason: string;
  readonly sourceText: string;
}

export interface ParseResult {
  readonly fields: readonly ParsedField[];
  readonly rejected: readonly RejectedField[];
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
  /**
   * What this flock is for.
   *
   * The wizard only shows the eggs step to layer and mixed flocks, so
   * quick record has to respect the same rule — otherwise saying "3
   * crates" in a broiler cycle writes an egg harvest for birds that
   * do not lay, and the farmer's production figures are quietly wrong
   * in a way nothing on the dashboard would explain.
   */
  readonly productionType?: 'broiler' | 'layer' | 'mixed';
  /**
   * This farmer's learned aliases, token → kind.
   *
   * Consulted only AFTER the shipped vocabulary has failed, so a
   * learned word can never shadow or override a known one, and a field
   * produced from one is always low-confidence. See learning.ts for
   * why that stays true however long the alias has existed.
   */
  readonly aliases?: ReadonlyMap<string, FieldKind>;
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
    // Thousands separators, BEFORE anything splits on a comma.
    //
    // CLAUSE_SPLIT treats "," as a separator, so "45,000" would be cut
    // into "45" and "000" and a forty-five-thousand-naira expense
    // would be recorded as forty five. Only a comma sitting between a
    // digit and exactly three more digits is removed, so "2 bags, 3
    // birds" is untouched.
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
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
/**
 * A money amount, in the forms a Nigerian farmer actually says.
 *
 * Handles "45000", "45,000" (already de-comma'd above), "45k",
 * "45 thousand", "1.5m", and a spelled single number with a
 * multiplier ("five thousand").
 *
 * WHAT IT REFUSES, and why that is the point. "two fifty" is 250 to
 * one farmer and 2.50 to another, and a wrong amount does not look
 * wrong — it quietly moves the margin. Anything this function cannot
 * read unambiguously returns undefined, and the composer then asks
 * rather than guesses. A missed amount costs one tap; an invented one
 * costs the books.
 */
function readMoney(clause: string): number | undefined {
  // "for 45000" is the strongest signal, so the text after "for" is
  // read first — in "bought 10 bags of feed for 45000" the ten is a
  // quantity, not a price.
  //
  // It is a HINT, not a requirement: "paid 250000 for day old chicks"
  // puts the price first and the goods after, which is just as
  // natural, so a scoped read that finds nothing falls back to the
  // whole clause rather than giving up.
  const after = /\bfor\s+(.+)$/.exec(clause)?.[1];
  return (after !== undefined ? moneyIn(after) : undefined) ?? moneyIn(clause);
}

function moneyIn(text: string): number | undefined {
  let value: number | undefined;
  let multiplier = 1;

  const m =
    /\b(?:n|ngn|naira)?\s*(\d{1,12}(?:\.\d{1,2})?)\s*(k|thousand|thousands|m|million|millions)?\b/
      .exec(text);

  if (m) {
    value = Number.parseFloat(m[1] as string);
    if (m[2]) multiplier = MONEY_MULTIPLIERS.get(m[2]) ?? 1;
  } else {
    // A spelled number with a multiplier: "five thousand".
    const w = /\b([a-z]+)\s+(thousand|thousands|million|millions)\b/.exec(text);
    if (!w) return undefined;
    const base = NUMBER_WORDS.get(w[1] as string);
    if (base === undefined) return undefined;
    value = base;
    multiplier = MONEY_MULTIPLIERS.get(w[2] as string) ?? 1;
  }

  if (value === undefined || !Number.isFinite(value)) return undefined;
  const amount = Math.round(value * multiplier * 100) / 100;
  return amount > 0 && amount <= MAX_MONEY ? amount : undefined;
}

/** The category the money went to, defaulting to `other`. */
function readExpenseCategory(clause: string): string {
  for (const { re, value } of EXPENSE_CATEGORIES) {
    if (re.test(clause)) return value;
  }
  return 'other';
}

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

/** First match from a {re, value} table, or undefined. */
function readFrom(
  clause: string,
  table: ReadonlyArray<{ re: RegExp; value: string }>,
): string | undefined {
  for (const { re, value } of table) {
    if (re.test(clause)) return value;
  }
  return undefined;
}

/** First brand whose pattern matches, preserving table order. */
function readBrand(
  clause: string,
): { value: string; label: string; uncertain: boolean } | null {
  for (const { re, value, label, uncertain } of FEED_BRANDS) {
    if (re.test(clause)) return { value, label, uncertain: uncertain === true };
  }
  return null;
}

/**
 * Did the farmer name a brand, even one we do not recognise?
 *
 * Only consulted when `readBrand` found nothing, and it exists to stop
 * the carry-forward layer from answering a question the farmer already
 * answered. "5 bags of finisher new hope feed" matched no brand in the
 * table, so the previous record's brand was filled in and the chip read
 * "Vital Feed · brand kept from your last record" — the app quietly
 * replacing a brand the farmer had just typed with a different one.
 *
 * A blank is recoverable and a wrong brand is not, so a name we cannot
 * place must leave the field empty rather than inherited.
 *
 * Looks at the one or two words directly in front of "feed", which is
 * where a brand goes in every phrasing we have seen. Anything that is
 * ordinary speech is listed in NON_BRAND_WORDS; a word that is not is
 * treated as a name.
 */
function statesUnrecognisedBrand(clause: string): boolean {
  const m = /\b([a-z]+)(?:\s+([a-z]+))?\s+feeds?\b/.exec(clause);
  if (m === null) return false;
  const words = [m[1], m[2]].filter((w): w is string => typeof w === 'string');
  return words.some((w) => !NON_BRAND_WORDS.has(w));
}

/**
 * "2 bags of 25kg" — the one case where a bag becomes kilograms.
 *
 * We refuse to guess a bag weight (see BAG_WEIGHT_NOTE), but when the
 * farmer states it themselves there is nothing left to guess. Returns
 * the total kilograms, or null when the clause is not that shape.
 */
function readBagsTimesWeight(clause: string): number | null {
  const m = clause.match(
    /\b(\d{1,4})\s*(?:bags?|sacks?)\s*(?:of|at|x|times)?\s*(\d{1,4})\s*(?:kgs?|kilos?|kilogram(?:me)?s?)\b/,
  );
  if (!m) return null;
  const bags = Number.parseInt(m[1] as string, 10);
  const each = Number.parseInt(m[2] as string, 10);
  const total = bags * each;
  return isUsable(total) && total > 0 ? total : null;
}

/**
 * Distance, in words, between a misheard cull word and the nearest
 * bird word.
 *
 * WHY THIS EXISTS. "culled birds" is two adjacent words, so however
 * badly it is heard the pieces stay next to each other — "coil bed",
 * "coiled bed", "called the bed", "calling bed". A real sentence that
 * happens to contain both does not: "I called the vet about 3 birds"
 * puts five words between them.
 *
 * The bird subject alone was not enough to tell those apart, and that
 * sentence would otherwise have proposed culling three birds. Nearness
 * is what separates a mangled phrase from a coincidence.
 */
const MAX_CULL_GAP = 3;

function misheardCullIsAdjacent(clause: string): boolean {
  const words = clause.split(' ');
  const cullAt: number[] = [];
  const birdAt: number[] = [];

  words.forEach((word, i) => {
    if (/^(coil(?:ed|s)?|call(?:ed|ing)s?)$/.test(word)) cullAt.push(i);
    if (BIRD_WORDS.test(word)) birdAt.push(i);
  });

  return cullAt.some((c) => birdAt.some((b) => Math.abs(b - c) <= MAX_CULL_GAP));
}

/**
 * Did the farmer say they PAID for something, and how much?
 *
 * Both halves are required. A buy verb with no amount is not an
 * expense — "I bought feed" is a fact about the store, not a figure
 * for the books, and inventing a zero would put a meaningless row in
 * the ledger. An amount with no buy verb is not an expense either:
 * "sold 50 birds for 200000" is money coming in.
 *
 * Checked BEFORE the keyword table, because every expense clause also
 * names the thing bought — "bought 10 bags of feed for 45000" matches
 * `feed`, and classified that way it becomes feed the birds never
 * ate, which is the FCR wrong for the rest of the cycle.
 */
function isExpenseClause(clause: string): boolean {
  return BUY_VERBS.test(clause) && readMoney(clause) !== undefined;
}

function classifyClause(clause: string): FieldKind | null {
  if (isExpenseClause(clause)) return 'expense';

  // VACCINES is the single source of truth for what counts as a
  // vaccination, checked before the keyword table rather than
  // duplicated into it. The misheard forms ("la so", "gum borrow")
  // live there, and a keyword list that had to be kept in step with
  // them would silently fall behind the first time someone added a
  // mishearing — which is exactly what happened before this check.
  if (VACCINES.some(({ re }) => re.test(clause))) return 'vaccination';

  for (const { kind, re } of KEYWORDS) {
    if (!re.test(clause)) continue;
    // Generic words only count when the clause also names a bird.
    if (REQUIRES_BIRD_SUBJECT.has(kind) && !BIRD_WORDS.test(clause)) continue;
    // A cull inferred from an ordinary word needs the bird word NEXT
    // to it, not merely somewhere in the sentence. See the note on
    // misheardCullIsAdjacent — without this, "I called the vet about
    // 3 birds" proposes culling three birds.
    if (kind === 'culled' && !/\bcull/.test(clause) && !misheardCullIsAdjacent(clause)) {
      continue;
    }
    return kind;
  }
  return null;
}

/**
 * Last resort: this farmer's own learned words.
 *
 * Runs only once the shipped vocabulary has found nothing, so learning
 * can add understanding but never take any away or reinterpret a word
 * the app already knows.
 */
function classifyByAlias(
  clause: string,
  aliases: ReadonlyMap<string, FieldKind> | undefined,
): FieldKind | null {
  if (!aliases || aliases.size === 0) return null;
  for (const token of clause.split(' ')) {
    const kind = aliases.get(token);
    if (kind !== undefined) return kind;
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
  // A vaccination is the one kind that is a complete record WITHOUT a
  // number. "Gave Lasota" is the whole fact — the dose is optional and
  // most farmers never say it. Requiring a count here would reject the
  // commonest health entry on a Nigerian poultry farm.
  if (kind === 'vaccination') {
    const vaccineName = readFrom(clause, VACCINES);
    const dose = readNumber(clause);
    const doseUnit = readUnit(clause);
    return {
      kind,
      // Dose in ml when stated; 0 means "not stated" and the payload
      // builder omits the quantity entirely rather than claiming zero.
      value: dose !== null && doseUnit?.apiUnit === 'ml' ? dose : 0,
      unit: doseUnit?.apiUnit === 'ml' ? 'ml' : undefined,
      confidence: vaccineName ? 'high' : 'low',
      caution: vaccineName ? undefined : 'Vaccine name not recognised — check it before saving',
      sourceText: clause,
      detail: vaccineName ? { vaccineName } : undefined,
    };
  }

  // MONEY, built before readNumber().
  //
  // readNumber takes the first number in the clause, and in
  // "bought 10 bags of feed for 45000" that is ten — so the generic
  // path would file a forty-five-thousand-naira spend as ten naira.
  // An expense is the one kind whose value is not a count.
  if (kind === 'expense') {
    const amount = readMoney(clause);
    // isExpenseClause already proved an amount is readable; this is
    // the belt to that brace, and it must never invent a zero.
    if (amount === undefined) return null;

    const category = readExpenseCategory(clause);

    // A suspiciously small amount is almost always a mis-heard "45k".
    // Warned, not blocked: a farmer really can buy a 50-naira bulb,
    // and refusing them would be worse than asking.
    const tiny = amount < IMPLAUSIBLE_EXPENSE;

    return {
      kind,
      value: amount,
      confidence: category === 'other' || tiny ? 'low' : 'high',
      caution: tiny
        ? 'That is a very small amount — check it before saving'
        : category === 'other'
          ? 'Could not tell what this was for — it will be filed under Other'
          : undefined,
      sourceText: clause,
      detail: { expenseCategory: category },
    };
  }

  const raw = readNumber(clause);
  if (raw === null) {
    // Treatment, like vaccination, is a fact without a count: "treated
    // for coccidiosis" names no number and is still a record.
    if (kind === 'treatment') {
      const treatmentType = readFrom(clause, TREATMENT_TYPES);
      return {
        kind,
        value: 0,
        confidence: treatmentType ? 'high' : 'low',
        caution: treatmentType
          ? undefined
          : 'Treatment type not recognised — check it before saving',
        sourceText: clause,
        detail: treatmentType ? { treatmentType } : undefined,
      };
    }
    return null;
  }

  // "egg weight 60 grams" contains the word "egg", which the unit
  // table matches before it reaches grams — so the chip read "60 eggs"
  // for a weight. An egg weight is always grams; nothing else is
  // plausible for a single egg.
  if (kind === 'egg_weight') {
    return {
      kind,
      value: raw,
      unit: 'g',
      confidence: 'high',
      sourceText: clause,
    };
  }

  const unitSpec = readUnit(clause);
  let value = raw;
  let conversionNote: string | undefined;

  // "2 bags of 25kg" — the farmer stated the bag weight, so kilograms
  // are theirs rather than ours.
  if (kind === 'feed') {
    const kg = readBagsTimesWeight(clause);
    if (kg !== null) {
      return {
        kind,
        value: kg,
        unit: 'kg',
        confidence: 'high',
        sourceText: clause,
        conversionNote: `${clause.match(/\d{1,4}/)?.[0] ?? ''} bags at the weight you said`,
        detail: { feedType: readFrom(clause, FEED_TYPES) },
      };
    }
  }

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

  // A cull recovered from a misheard word is always confirmed, even
  // when the count looks ordinary. "called", "coil" and "calling" are
  // all ordinary English, so a clause that reached `culled` without
  // actually containing "cull" was recovered by inference — and an
  // inferred cull removes birds from the flock. The farmer sees it.
  if (kind === 'culled' && !/\bcull/.test(clause)) {
    confidence = 'low';
    caution = caution ?? 'Heard this as culling — check the count before saving';
  }

  // A number with no unit where a unit is expected is a guess.
  if ((kind === 'feed' || kind === 'water' || kind === 'weight') && !unitSpec) {
    confidence = 'low';
    caution = 'No unit heard — confirm the unit before saving';
  }

  // Kind-specific extras, so "two bags of starter feed" keeps the
  // ration and "30 medium eggs" keeps the size.
  const brand = kind === 'feed' ? readBrand(clause) : null;
  if (brand?.uncertain) {
    confidence = 'low';
    caution = caution ?? `Heard brand "${brand.label}" — confirm it before saving`;
  }

  // A brand was named and we could not place it. Recorded so the
  // carry-forward layer leaves the field alone instead of substituting
  // the last record's brand, and so the farmer is told rather than
  // left to notice.
  const brandStated = kind === 'feed' && brand === null && statesUnrecognisedBrand(clause);
  if (brandStated) {
    caution = caution ?? 'Brand not recognised — pick it in the wizard before saving';
  }

  const detail = {
    feedType: kind === 'feed' ? readFrom(clause, FEED_TYPES) : undefined,
    feedBrand: brand?.value,
    feedBrandLabel: brand?.label,
    brandStated: brandStated ? true : undefined,
    eggSize: kind === 'eggs' ? readFrom(clause, EGG_SIZES) : undefined,
    treatmentType: kind === 'treatment' ? readFrom(clause, TREATMENT_TYPES) : undefined,
  };
  const hasDetail = Object.values(detail).some((v) => v !== undefined);

  return {
    kind,
    value,
    unit: unitSpec?.apiUnit,
    amount: kind === 'sold' ? readAmount(clause) : undefined,
    confidence,
    caution,
    sourceText: clause,
    conversionNote,
    detail: hasDetail ? detail : undefined,
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
    return { fields: [], rejected: [], leftover: '', moment: 'entire_day', understoodNothing: false };
  }

  const text = normalise(input);
  if (text === '') {
    return { fields: [], rejected: [], leftover: '', moment: 'entire_day', understoodNothing: false };
  }

  const moment = readMoment(text);
  const clauses = text.split(CLAUSE_SPLIT).slice(0, MAX_CLAUSES);

  const fields: ParsedField[] = [];
  const rejected: RejectedField[] = [];
  const unmatched: string[] = [];
  // One field per kind. If a farmer says "10 died and 5 died", the
  // second clause is almost certainly a correction or a repeat from
  // dictation, and silently summing them into 15 deaths would be the
  // worst possible guess.
  const seen = new Set<FieldKind>();

  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (trimmed === '') continue;

    const known = classifyClause(trimmed);
    const learned = known === null ? classifyByAlias(trimmed, ctx.aliases) : null;
    const kind = known ?? learned;
    if (kind === null || seen.has(kind)) {
      unmatched.push(trimmed);
      continue;
    }

    // Broilers do not lay. The wizard shows the eggs step only to
    // layer and mixed flocks, and quick record has to hold the same
    // line — an egg harvest recorded against meat birds is a number
    // nothing on the dashboard could ever explain.
    if (
      ctx.productionType === 'broiler' &&
      (kind === 'eggs' || kind === 'egg_weight')
    ) {
      rejected.push({
        kind,
        reason: 'This is a broiler cycle, so there are no eggs to record.',
        sourceText: trimmed,
      });
      continue;
    }

    const built = buildField(trimmed, kind, ctx);
    if (built === null) {
      unmatched.push(trimmed);
      continue;
    }

    // A field recognised only through a learned word is ALWAYS flagged,
    // no matter how long the alias has existed or how often it has been
    // right. The farmer taught the app a word; they stay the one who
    // confirms what it produces.
    const field: ParsedField =
      learned === null
        ? built
        : {
            ...built,
            confidence: 'low',
            // Provenance OVERRIDES any other caution rather than
            // deferring to it. "No unit heard" is useful; "this came
            // from a word you taught the app" is the only thing the
            // farmer cannot work out for themselves, and it is the
            // explanation for every surprising entry a learned alias
            // will ever produce.
            caution: 'Understood from a word you taught this app — check it',
          };

    seen.add(kind);
    fields.push(field);
  }

  return {
    fields,
    rejected,
    leftover: unmatched.join(', '),
    moment,
    // A rejection IS understanding — the app knew what was said and
    // declined it. Saying "that didn't include a number we
    // recognised" on top of "broilers don't lay eggs" would be two
    // messages contradicting each other.
    understoodNothing: fields.length === 0 && rejected.length === 0,
  };
}
