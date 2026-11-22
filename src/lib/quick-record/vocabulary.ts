/**
 * The words Nigerian poultry farmers actually use.
 *
 * This file is the asset. The parser in ./parse.ts is a small amount of
 * mechanical logic wrapped around these lists, and almost every future
 * improvement to accuracy is a word added here rather than code changed
 * there. Keep it that way.
 *
 * TWO RULES FOR EDITING.
 *
 * 1. Pidgin is not a second-class dialect to bolt on later. "15 birds
 *    don die" is how the sentence is actually said, and a parser that
 *    only reads "15 birds died" fails the farmer it was built for. Add
 *    the Pidgin form in the same breath as the English one.
 *
 * 2. Never add a word that can mean two things. "lost" looks like a
 *    mortality word and is listed as one, but "I lost the key" is not a
 *    record — which is why mortality also requires a bird-ish subject or
 *    a bare number, see parse.ts. If a word is ambiguous and you cannot
 *    constrain it, leave it out. A missed entry costs one wizard tap; a
 *    wrong entry costs trust.
 */

/** Event kinds the quick-record parser can produce. */
export type FieldKind =
  | 'dead'
  | 'culled'
  | 'sold'
  | 'lost'
  | 'feed'
  | 'water'
  | 'eggs'
  | 'weight';

/**
 * Keyword sets, most specific first.
 *
 * Order matters: `classifyClause` tries these in array order and takes
 * the first hit, so a clause mentioning both "sold" and "birds" is a
 * sale, not a head count.
 */
export const KEYWORDS: ReadonlyArray<{ kind: FieldKind; re: RegExp }> = [
  // ── Bird-count movements ────────────────────────────────────────────
  // Checked before everything else because "sold 20 birds" and "20 birds
  // died" share a subject and differ only by verb.
  {
    kind: 'sold',
    // "comot" is Pidgin for removed/taken out; in a sales context it is
    // how a farmer describes birds leaving the pen.
    re: /\b(sold|sell|sells|selling|sale|comot(?:ed)?)\b/,
  },
  {
    kind: 'culled',
    re: /\b(cull(?:ed|ing)?|slaughter(?:ed)?|destroy(?:ed)?)\b/,
  },
  {
    kind: 'dead',
    // "don die" / "don kpai" are Pidgin perfect forms. "kpai" is slang
    // for die and is common in spoken Nigerian English.
    re: /\b(died?|dead|death|deaths|dying|mortality|mortalities|expired|don\s+die|kpai(?:ed)?|perish(?:ed)?)\b/,
  },
  {
    kind: 'lost',
    // Deliberately narrow. Bare "lost" is handled here only because the
    // clause must ALSO carry a bird subject — see requiresBirdSubject.
    re: /\b(lost|missing|stolen|thief|theft|disappear(?:ed)?)\b/,
  },

  // ── Consumables ─────────────────────────────────────────────────────
  {
    kind: 'feed',
    // "chop" is Pidgin for food. Feed brands and types (starter, grower,
    // finisher, layer mash) double as feed keywords because farmers name
    // the ration rather than the act: "2 bags of grower".
    re: /\b(feed|fed|feeding|mash|starter|grower|finisher|layer\s+mash|pellets?|chop)\b/,
  },
  {
    kind: 'water',
    re: /\b(water|watered|drank|drink|drinking|litres?|liters?)\b/,
  },

  // ── Production ──────────────────────────────────────────────────────
  {
    kind: 'eggs',
    re: /\b(eggs?|crates?|trays?|collect(?:ed|ion)?|pick(?:ed)?\s+egg)\b/,
  },
  {
    kind: 'weight',
    re: /\b(weigh(?:ed|t|s|ing)?|kilos?|kgs?)\b/,
  },
];

/**
 * Kinds whose keyword is too generic to stand on its own. A clause must
 * also mention a bird before these count.
 *
 * Without this, "lost 2 bags" parses as two birds lost AND two bags of
 * feed, and the farmer's flock silently shrinks by two.
 */
export const REQUIRES_BIRD_SUBJECT: ReadonlySet<FieldKind> = new Set([
  'lost',
]);

/**
 * Anything a Nigerian farmer calls the animals in the pen.
 *
 * "Layer" and "broiler" appear here and NOT in the feed keywords on
 * purpose — "20 layers died" is a bird count. The feed list carries
 * "layer mash" as a two-word phrase so the ration stays distinguishable
 * from the bird.
 */
export const BIRD_WORDS =
  /\b(birds?|chicken|chickens|fowls?|layers?|broilers?|cockerels?|cocks?|hens?|chicks?|pullets?|noilers?|turkeys?|ducks?)\b/;

/**
 * Units, mapped to what the backend's daily-record validators expect.
 *
 * `perUnit` converts a count of containers into the base unit the API
 * stores. Where it is null the container IS the stored unit — the feed
 * endpoint accepts unit:'bags' directly, so a bag of feed needs no
 * conversion and no guess about its weight.
 */
export interface UnitSpec {
  /** What the API should receive in `unit`, or for eggs the base count. */
  readonly apiUnit: string;
  /** Multiplier to the base unit, or null when no conversion applies. */
  readonly perUnit: number | null;
  /** Shown on the confirmation chip when a conversion happened. */
  readonly label: string;
}

/**
 * A crate of eggs is thirty, everywhere in Nigeria. This is the one
 * conversion the parser performs silently, and the chip always shows
 * its working ("3 crates = 90 eggs") so a farmer who means something
 * else can see it before saving.
 */
export const EGGS_PER_CRATE = 30;

export const UNITS: ReadonlyArray<{ re: RegExp; spec: UnitSpec }> = [
  // Eggs. Crates and trays are the same thing in practice.
  {
    re: /\b(crates?|trays?)\b/,
    spec: { apiUnit: 'eggs', perUnit: EGGS_PER_CRATE, label: 'crate' },
  },
  {
    re: /\b(eggs?|pieces?|pcs?)\b/,
    spec: { apiUnit: 'eggs', perUnit: 1, label: 'egg' },
  },

  // Feed. 'bags' is a unit the feed endpoint already accepts, so we do
  // NOT convert to kilograms — converting would mean guessing the bag
  // weight, and Nigerian feed bags are not all 25kg.
  {
    re: /\b(bags?|sacks?)\b/,
    spec: { apiUnit: 'bags', perUnit: null, label: 'bag' },
  },
  {
    re: /\b(kgs?|kilos?|kilogram(?:me)?s?)\b/,
    spec: { apiUnit: 'kg', perUnit: null, label: 'kg' },
  },
  {
    re: /\b(g|grams?|grammes?)\b/,
    spec: { apiUnit: 'g', perUnit: null, label: 'g' },
  },

  // Water.
  {
    re: /\b(litres?|liters?|l)\b/,
    spec: { apiUnit: 'liters', perUnit: null, label: 'litre' },
  },
];

/**
 * Number words, because dictation writes "fifteen" as often as "15".
 *
 * Stops at twenty plus the tens. Beyond that, speech-to-text reliably
 * produces digits, and a farmer saying "three hundred and forty-two"
 * is better served by the wizard than by a parser pretending to be sure.
 *
 * A Map, NOT a plain object, and this is a security choice rather than a
 * style one. The lookup key comes from the farmer's dictated text, and
 * on a plain object `NUMBER_WORDS["constructor"]` returns the Object
 * constructor instead of undefined — a truthy non-number flowing into
 * arithmetic from untrusted input. A Map has no prototype chain to walk,
 * so an unknown word can only ever miss.
 */
export const NUMBER_WORDS: ReadonlyMap<string, number> = new Map([
  ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
  ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
  ['nineteen', 19], ['twenty', 20], ['thirty', 30], ['forty', 40],
  ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80],
  ['ninety', 90], ['hundred', 100],
  // Spoken quantifiers that carry a number.
  ['a', 1], ['an', 1], ['none', 0],
]);

/**
 * Time-of-day words. The daily-record steps all accept a `moment`, and
 * getting it from the sentence saves the farmer a tap.
 *
 * Afternoon counts as evening because the wizard offers only two halves
 * of the day plus "entire day"; an afternoon collection belongs to the
 * later one.
 */
export const MOMENT_WORDS: ReadonlyArray<{
  re: RegExp;
  moment: 'morning' | 'evening' | 'entire_day';
}> = [
  { re: /\b(morning|am|early|dawn)\b/, moment: 'morning' },
  { re: /\b(evening|afternoon|night|pm|late)\b/, moment: 'evening' },
  { re: /\b(all\s+day|whole\s+day|entire\s+day|today\s+total)\b/, moment: 'entire_day' },
];

/**
 * Clause separators.
 *
 * Farmers chain observations in one breath — "15 died and I gave them 2
 * bags and collected 3 crates". Splitting on these and classifying each
 * piece independently is both more accurate and far easier to reason
 * about than one regex trying to see the whole sentence at once.
 *
 * "for" is NOT a separator: "sold 20 birds for 15000" is a single fact,
 * and the money belongs to the sale.
 *
 * A FULL STOP ONLY SEPARATES WHEN IT IS NOT A DECIMAL POINT. Without the
 * `(?!\d)`, "2.5 birds died" splits into "2" and "5 birds died" and the
 * parser proposes five deaths from a sentence that said two and a half —
 * the decimal guard in parse.ts never gets to run, because by then there
 * is no decimal left to see. Caught by a test; keep the test.
 *
 * Lookahead only, never lookbehind: Safari did not support lookbehind
 * until 16.4, and an unsupported group in a regex LITERAL is a parse
 * error that takes down the whole module on load. On the phones this app
 * is actually used on, that is a blank screen rather than a bad parse.
 */
export const CLAUSE_SPLIT = /\s*(?:,|;|\band\b|\bthen\b|\balso\b|\bplus\b|\.(?!\d))\s*/i;
