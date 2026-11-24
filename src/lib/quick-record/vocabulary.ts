/**
 * The words Nigerian poultry farmers actually use — and, just as
 * importantly, the words the speech recogniser actually hears when they
 * say them.
 *
 * This file is the asset. The parser in ./parse.ts is a small amount of
 * mechanical logic wrapped around these lists, and almost every future
 * improvement to accuracy is a word added here rather than code changed
 * there. Keep it that way.
 *
 * THREE RULES FOR EDITING.
 *
 * 1. Pidgin is not a second-class dialect to bolt on later. "15 birds
 *    don die" is how the sentence is actually said, and a parser that
 *    only reads "15 birds died" fails the farmer it was built for.
 *
 * 2. MISHEARINGS ARE VOCABULARY. Chrome's recogniser is trained on
 *    American and British English. A Nigerian farmer saying "crate"
 *    gets back "grit"; "Lasota" comes back "la so". Both were observed
 *    in real use, not imagined. We cannot retrain the recogniser, so
 *    the misheard form is simply another word meaning the same thing.
 *    Every one tagged MISHEARD below came from someone actually
 *    speaking into the app — add to them as reports come in.
 *
 * 3. Never add a word that can mean two things. The temptation with
 *    mishearings is to map "called" to "culled" — but "I called the
 *    vet" is a real sentence, and silently culling birds because of it
 *    is far worse than missing the entry. Where a misheard form is a
 *    common English word, leave it out or constrain it. A missed entry
 *    costs one wizard tap; a wrong entry costs trust.
 */

/** Event kinds the quick-record parser can produce. */
export type FieldKind =
  | 'expense'
  | 'dead'
  | 'culled'
  | 'sold'
  | 'lost'
  | 'feed'
  | 'water'
  | 'eggs'
  | 'weight'
  | 'vaccination'
  | 'treatment'
  | 'egg_weight';

/**
 * Keyword sets, most specific first.
 *
 * Order matters: `classifyClause` tries these in array order and takes
 * the first hit, so a clause mentioning both "sold" and "birds" is a
 * sale, not a head count, and a clause naming a vaccine is a
 * vaccination rather than a treatment.
 */
export const KEYWORDS: ReadonlyArray<{ kind: FieldKind; re: RegExp }> = [
  // ── Health, before everything ───────────────────────────────────────
  // A vaccine name is the strongest signal in any sentence, so it is
  // tested before the bird-movement verbs that often sit beside it.
  {
    kind: 'vaccination',
    re: /\b(vaccinat(?:e|ed|ion)|vaccine|jab|dose[ds]?|lasota|gumboro|newcastle|marek|debeak)\b/,
  },
  {
    kind: 'treatment',
    re: /\b(treat(?:ed|ment|ing)?|antibiotic?s?|medicat(?:e|ed|ion)|drugs?|dewormer?|deworm(?:ed|ing)?|vitamins?|coccidiosta(?:t|ts)|coccidiosis|glucose|antistress|anti\s*stress)\b/,
  },

  // ── Bird-count movements ────────────────────────────────────────────
  {
    kind: 'sold',
    // "comot" is Pidgin for removed/taken out.
    re: /\b(sold|sell|sells|selling|sale|comot(?:ed)?)\b/,
  },
  {
    kind: 'culled',
    // MISHEARD: one spoken "culled birds" came back as "coil bed",
    // "coiled bed", "called the bed", "calling bed" and "quite bad",
    // in a single session. Culling is a core entry and was completely
    // unrecordable by voice.
    //
    // "called" IS LISTED HERE, having been refused once already. The
    // reason it is safe now is the bird subject below: "I called the
    // vet" names no bird and is not a cull, while "called the bed" is
    // "culled bird" and is. The pair carries it, exactly as the
    // container carries feed.
    //
    // "quite" is NOT listed, though "quite bad" was one of the
    // transcripts. "3 birds are quite bad" is an ordinary thing to
    // say about sick birds, and reading it as three culls would
    // destroy stock on a sentence about illness. Four forms recovered
    // is worth more than a fifth that guesses.
    re: /\b(cull(?:ed|ing|s)?|coil(?:ed|s)?|call(?:ed|ing)s?|slaughter(?:ed)?|destroy(?:ed)?)\b/,
  },
  {
    kind: 'dead',
    // "don die" / "don kpai" are Pidgin perfect forms.
    re: /\b(died?|dead|death|deaths|dying|mortality|mortalities|expired|don\s+die|kpai(?:ed)?|perish(?:ed)?)\b/,
  },
  {
    kind: 'lost',
    // Narrow by design — also requires a bird subject, see below.
    re: /\b(lost|missing|stolen|thief|theft|disappear(?:ed)?)\b/,
  },

  // ── Production ──────────────────────────────────────────────────────
  // Egg WEIGHT before eggs, so "egg weight 60 grams" is not a count.
  {
    kind: 'egg_weight',
    re: /\begg[s]?\s+(?:weigh(?:t|ed|s)?|size)\b|\bweigh(?:t|ed|s)?\s+of\s+(?:the\s+)?eggs?\b/,
  },
  {
    kind: 'eggs',
    // MISHEARD: "grit", "great", "grade", "crates" for crate — all
    // observed. "great" is a real word but is only reached here when a
    // number sits in the same clause and nothing earlier matched.
    re: /\b(eggs?|crates?|trays?|collect(?:ed|ion)?|grit|grits|greats?|grades?|kreyts?)\b/,
  },
  {
    kind: 'weight',
    re: /\b(weigh(?:ed|t|s|ing)?|kilos?|kgs?)\b/,
  },

  // ── Consumables ─────────────────────────────────────────────────────
  {
    kind: 'feed',
    // "chop" is Pidgin for food. Ration names double as feed keywords
    // because farmers name the ration rather than the act.
    //
    // THE CONTAINER IS THE RELIABLE SIGNAL, not the word "feed". One
    // spoken "25 bags of feed" came back, across four attempts, as
    // "25 pounds of feet", "25 packs of heat", "25 bags" and "25 bags
    // feet" — the word feed survived none of them, and the container
    // survived all four. So a bag-like container with a number is
    // feed, however badly the rest was heard.
    //
    // This is also why "feet" and "heat" are NOT listed as feed words
    // on their own. "Heat" is a real and important thing on a poultry
    // farm — heat stress is a daily worry — and a farmer typing "too
    // much heat today" must not log a feed entry. Carried by the
    // container, those sentences are safe: no container, no feed.
    re: /\b(feed|fed|feeding|mash|marsh|starter|grower|finisher|pellets?|chop|fit|bags?|sacks?|packs?|pounds?|lbs?)\b/,
  },
  {
    kind: 'water',
    // MISHEARD: "leaders"/"later" for litres.
    re: /\b(water|watered|drank|drink|drinking|litres?|liters?|leaders?)\b/,
  },
];

/**
 * Kinds whose keyword is too generic to stand on its own. A clause must
 * also mention a bird before these count.
 */
export const REQUIRES_BIRD_SUBJECT: ReadonlySet<FieldKind> = new Set([
  'lost',
  // `culled` joined this list the day "called" was added to its
  // keywords. The misheard forms of "culled" are all ordinary English
  // words, so the bird subject is the only thing separating "called
  // the bed" (a cull) from "I called the vet" (not one). Removing
  // `culled` from this set without also removing those forms would
  // make a sentence about phoning somebody destroy stock.
  'culled',
]);

/**
 * Anything a Nigerian farmer calls the animals in the pen.
 *
 * "Layer" and "broiler" are birds here and NOT feed — "20 layers died"
 * is a head count. The ration "layer mash" is matched as a two-word
 * phrase in FEED_TYPES so the two stay distinguishable.
 *
 * MISHEARD: "bed" and "bad" for bird, both from the same session that
 * produced the cull mishearings. They are only ever consulted to
 * confirm a kind that ALREADY matched a keyword — never to classify a
 * clause on their own — so "the bed is wet" and "10 bad eggs" are
 * untouched by them.
 */
export const BIRD_WORDS =
  /\b(birds?|buds?|beds?|bads?|chicken|chickens|fowls?|layers?|broilers?|cockerels?|cocks?|hens?|chicks?|pullets?|noilers?|turkeys?|ducks?)\b/;

/**
 * Feed rations, mapped to the `item_type` the feed endpoint stores.
 *
 * The wizard offers starter / grower / finisher. "Layer mash" is a
 * fourth thing farmers say constantly; it maps to layer feed and is
 * matched before the bare word "layer" can be read as a bird.
 */
/**
 * Words that can sit in front of "feed" without being a brand name.
 *
 * Used to tell "finisher feed" (a ration, no brand named) from
 * "new hope feed" (a brand named, which we may or may not know). The
 * distinction matters because of what happens next: when no brand is
 * recognised the carry-forward layer fills one in from the farmer's
 * last record, and a farmer who says "new hope feed" and gets
 * "Vital Feed · brand kept from your last record" has had the app
 * overwrite something they explicitly said.
 *
 * So this list exists to be conservative in one direction only. A
 * brand wrongly treated as filler gets silently replaced; filler
 * wrongly treated as a brand merely costs one tap. Everything a farmer
 * plausibly says around the word "feed" belongs here.
 */
export const NON_BRAND_WORDS: ReadonlySet<string> = new Set([
  // Rations.
  'starter', 'grower', 'finisher', 'layer', 'layers', 'mash', 'pellet',
  'pellets', 'crumble', 'crumbs', 'concentrate',
  // Containers and measures.
  'bag', 'bags', 'sack', 'sacks', 'kg', 'kgs', 'kilo', 'kilos', 'kilogram',
  'kilograms', 'ton', 'tons', 'tonne', 'tonnes', 'cup', 'cups', 'paint',
  'rubber', 'bowl', 'bowls', 'measure', 'measures',
  // Birds — "chicken feed" is handled as a brand candidate elsewhere,
  // deliberately and with a confirmation.
  'bird', 'birds', 'broiler', 'broilers', 'chick', 'chicks', 'pullet',
  'pullets', 'cockerel', 'cockerels', 'hen', 'hens', 'turkey', 'turkeys',
  // Grammar and the verbs farmers use.
  'of', 'the', 'a', 'an', 'some', 'more', 'my', 'our', 'their', 'this',
  'that', 'these', 'those', 'and', 'with', 'for', 'to', 'in', 'on', 'at',
  'gave', 'give', 'given', 'giving', 'used', 'use', 'using', 'bought',
  'buy', 'added', 'add', 'fed', 'feeding', 'served', 'serve', 'poured',
  'finished', 'left', 'remaining', 'today', 'morning', 'evening', 'night',
  'new', 'old', 'fresh', 'same', 'another', 'last', 'first', 'total',
  'them', 'it', 'they', 'we', 'i',
  // Numbers as words.
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'twenty', 'thirty', 'forty', 'fifty',
  'hundred', 'half',
]);

export const FEED_TYPES: ReadonlyArray<{ re: RegExp; value: string }> = [
  { re: /\bstarter\b/, value: 'starter' },
  { re: /\bgrower\b/, value: 'grower' },
  { re: /\bfinisher\b/, value: 'finisher' },
  { re: /\blayer\s*(?:mash|marsh|feed)\b/, value: 'layer' },
];

/**
 * Feed brands, mapped to the values the feed step already stores.
 *
 * Brands are a known, finite list in Nigeria, which is what makes this
 * possible at all — the same trick as VACCINES. `value` must stay in
 * step with FEED_BRANDS in components/record/steps/feed-step.tsx; the
 * payload builder allowlists against the same set so a drift here
 * cannot reach the API.
 *
 * WHY "CHICKEN" IS TREATED CAREFULLY. Chikun Feeds is a major brand and
 * the recogniser renders it "chicken" every time — but "chicken feed"
 * is also just what feed is called. The brand only matches with a
 * container present and is marked low-confidence so the farmer
 * confirms, because attributing the wrong brand quietly corrupts
 * cost-per-bag and feed-conversion comparisons.
 */
export const FEED_BRANDS: ReadonlyArray<{
  re: RegExp;
  value: string;
  label: string;
  /** True when the match is plausible enough to need confirming. */
  uncertain?: boolean;
}> = [
  // MISHEARD: "amo bing", "amour bing", "ammo byng".
  { re: /\b(amo|ammo|amour)\s*(byng|bing|being)\b/, value: 'amo_byng_feed', label: 'Amo Byng Feed' },
  { re: /\banimal\s*care\b/, value: 'animal_care', label: 'Animal Care' },
  // MISHEARD: "brockwell", "brooks well".
  { re: /\b(broxwell|brockwell|brooks\s*well|box\s*well)\b/, value: 'broxwell_feeds', label: 'Broxwell Feeds' },
  { re: /\b(chikun|chickun|chikin)\b/, value: 'chikun_feeds', label: 'Chikun Feeds' },
  { re: /\bhybrid\b/, value: 'hybrid_feeds', label: 'Hybrid Feeds' },
  { re: /\blivestock\s*feeds?\b/, value: 'livestock_feeds_plc', label: 'Livestock Feeds Plc' },
  // MISHEARD: "new hop", "nu hope", "new hoop".
  { re: /\b(new|nu|knew)\s*(hope?s?|hoops?)\b/, value: 'new_hope', label: 'New Hope' },
  { re: /\bagrited\b/, value: 'agrited', label: 'Agrited' },
  { re: /\bstellar\b/, value: 'stellar_feeds', label: 'Stellar Feeds' },
  { re: /\btop\s*feeds?\b/, value: 'top_feeds', label: 'Top Feeds' },
  // Grand Cereals is the mill; Vital Feed is its brand, and farmers use
  // both names for the same bag.
  { re: /\b(vital|grand\s*cereals?)\b/, value: 'vital_feed', label: 'Vital Feed' },
  // MISHEARD: "ultimate" for Ultima.
  { re: /\b(ultima|ultimate)\b/, value: 'ultima', label: 'Ultima' },
  // "I mixed it myself" — a real and common answer.
  { re: /\b(own\s*feed|my\s*own|mixed?\s*(?:it\s*)?my\s*self|home\s*made|self\s*mix)\b/, value: 'own_feed', label: 'Own feed' },
  // Must sit LAST: "chicken" is the commonest rendering of Chikun and
  // also the ordinary word for feed, so it only wins when no better
  // brand matched, and it always asks the farmer to confirm.
  { re: /\bchicken\s*feeds?\b/, value: 'chikun_feeds', label: 'Chikun Feeds', uncertain: true },
];

/**
 * Vaccines, with the forms the recogniser produces.
 *
 * LASOTA IS THE REASON THIS LIST EXISTS. Said aloud by a Nigerian
 * farmer it comes back as "la so", "la sota", "lassota" or "the sorta",
 * never as the spelling. It is the most-administered vaccine in
 * Nigerian poultry, so getting it wrong fails the commonest case.
 *
 * `value` is what reaches payload.vaccine_name, so it is the correct
 * spelling regardless of what was heard.
 */
export const VACCINES: ReadonlyArray<{ re: RegExp; value: string }> = [
  {
    // MISHEARD: every form below was produced by the recogniser for
    // one spoken "Lasota".
    re: /\b(lasota|la\s*sota|la\s*so|lassota|la\s*soda|lasotta|the\s*sorta)\b/,
    value: 'Lasota',
  },
  {
    // MISHEARD: "gumbo", "gum borrow".
    re: /\b(gumboro|gumbo(?:ro)?|gum\s*borrow|ibd)\b/,
    value: 'Gumboro (IBD)',
  },
  {
    re: /\b(newcastle|new\s*castle|ndv?|nd\s*vaccine)\b/,
    value: 'Newcastle',
  },
  { re: /\b(marek'?s?)\b/, value: "Marek's" },
  { re: /\b(fowl\s*pox|pox)\b/, value: 'Fowl pox' },
  { re: /\b(infectious\s*bronchitis|bronchitis|ib)\b/, value: 'Infectious bronchitis' },
  { re: /\b(fowl\s*typhoid|typhoid)\b/, value: 'Fowl typhoid' },
  { re: /\b(coryza)\b/, value: 'Infectious coryza' },
];

/** Treatment categories, mapped to `treatment_type`. */
export const TREATMENT_TYPES: ReadonlyArray<{ re: RegExp; value: string }> = [
  { re: /\b(antibiotic?s?)\b/, value: 'antibiotic' },
  { re: /\b(dewormer?|deworm(?:ed|ing)?)\b/, value: 'dewormer' },
  { re: /\b(vitamins?|glucose|antistress|anti\s*stress)\b/, value: 'vitamin' },
  { re: /\b(coccidiosta(?:t|ts)|coccidiosis)\b/, value: 'coccidiostat' },
];

/** Egg sizes the backend stores under payload.sizes.{key}. */
export const EGG_SIZES: ReadonlyArray<{ re: RegExp; value: string }> = [
  { re: /\bsmall\b/, value: 'small' },
  { re: /\bmedium\b/, value: 'medium' },
  // MISHEARD: "jumbo" often returns as "gumbo", which also appears in
  // the Gumboro vaccine list — vaccination is classified first, so a
  // sentence naming the vaccine never reaches here.
  { re: /\b(jumbo|jumbo\s*size)\b/, value: 'jumbo' },
];

/**
 * Units, mapped to what the backend's daily-record validators expect.
 *
 * `perUnit` converts a count of containers into the base unit the API
 * stores. Where it is null the container IS the stored unit.
 */
export interface UnitSpec {
  readonly apiUnit: string;
  readonly perUnit: number | null;
  readonly label: string;
}

/** A crate of eggs is thirty, everywhere in Nigeria. */
export const EGGS_PER_CRATE = 30;

export const UNITS: ReadonlyArray<{ re: RegExp; spec: UnitSpec }> = [
  {
    // MISHEARD forms included, same as the eggs keyword.
    re: /\b(crates?|trays?|grit|grits|greats?|grades?|kreyts?)\b/,
    spec: { apiUnit: 'eggs', perUnit: EGGS_PER_CRATE, label: 'crate' },
  },
  {
    re: /\b(eggs?|pieces?|pcs?)\b/,
    spec: { apiUnit: 'eggs', perUnit: 1, label: 'egg' },
  },
  {
    // Feed bags are NOT converted to kilograms — see BAG_WEIGHT_NOTE.
    //
    // MISHEARD: "packs", "pounds", "lbs" for bags, all observed from
    // one spoken "bags". Pounds are safe to claim here because feed in
    // Nigeria is sold by the kilogram and the bag; nobody buying
    // poultry feed in Lagos is talking in pounds.
    re: /\b(bags?|sacks?|packs?|pounds?|lbs?)\b/,
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
  {
    re: /\b(litres?|liters?|leaders?|l)\b/,
    spec: { apiUnit: 'liters', perUnit: null, label: 'litre' },
  },
  { re: /\b(ml|millilitres?|milliliters?)\b/, spec: { apiUnit: 'ml', perUnit: null, label: 'ml' } },
];

/**
 * Why a bag of feed is never turned into kilograms.
 *
 * Nigerian feed bags are commonly 25kg, but they are not reliably so —
 * brands sell 10, 15, 20, 25 and 50kg sacks, and a farmer who mixes
 * their own fills whatever they have. Converting "2 bags" to "50kg"
 * would invent a figure the farmer never said and then feed it into
 * the feed-conversion ratio, which is exactly the kind of quiet wrong
 * number this parser is built to avoid.
 *
 * So bags stay bags — the feed endpoint accepts unit:'bags' natively.
 * A farmer who wants kilograms says kilograms ("50kg of feed"), and one
 * who wants both says "2 bags of 25kg", which is read as 50kg because
 * at that point they have told us the bag weight themselves.
 */
export const BAG_WEIGHT_NOTE = 'Bags are saved as bags — say "50kg" or "2 bags of 25kg" for weight.';

/**
 * Number words, because dictation writes "fifteen" as often as "15".
 *
 * A Map, NOT a plain object, and this is a security choice rather than
 * a style one. The lookup key comes from the farmer's dictated text,
 * and on a plain object NUMBER_WORDS["constructor"] returns the Object
 * constructor instead of undefined — a truthy non-number flowing into
 * arithmetic from untrusted input. A Map has no prototype chain to
 * walk, so an unknown word can only ever miss.
 */
/**
 * Verbs that mean MONEY LEFT THE FARM.
 *
 * The whole expense feature hangs off this list, because the
 * difference between an expense and a daily record is the verb and
 * nothing else:
 *
 *   "I BOUGHT 10 bags of feed for 45000"  → an expense
 *   "I GAVE them 10 bags of feed"         → feed consumption
 *
 * Read the second as an expense and the farm's feed cost doubles;
 * read the first as consumption and the FCR is computed against feed
 * that is still in the store. So an expense is never inferred from a
 * noun and a number — the farmer has to have said they paid.
 *
 * "sold" is deliberately absent. Money arriving is not an expense,
 * and "sold 50 birds for 200000" must stay a sale.
 */
export const BUY_VERBS =
  /\b(bought|buy|buys|buying|purchas(?:e|ed|es|ing)|paid|pay|pays|paying|spent|spend(?:ing)?|restock(?:ed|ing)?)\b/;

/**
 * What the money was spent on, mapped to the backend's own category
 * list (App\Models\Expense::categories()).
 *
 * ORDER MATTERS. "bought feed for the birds" names both feed and
 * birds, and it is a feed expense — so the specific goods come before
 * `birds`, which is otherwise the commonest noun in any poultry
 * sentence. An unmatched clause becomes `other` rather than being
 * dropped: a farmer who said they spent money should always get a
 * row, even when the app cannot tell what for.
 */
export const EXPENSE_CATEGORIES: ReadonlyArray<{ re: RegExp; value: string }> = [
  { re: /\b(feeds?|mash|pellets?|crumbles?|concentrates?|maize|soya|bran)\b/, value: 'feed' },
  // Before `treatment`: lasota and gumboro are vaccines, and both
  // words also read as "drugs" to a farmer.
  { re: /\b(vaccines?|vaccinations?|lasota|gumboro|newcastle|marek)\b/, value: 'vaccine' },
  { re: /\b(drugs?|medicines?|antibiotics?|dewormers?|vitamins?|treatments?|coccidiosta(?:t|ts)|antistress)\b/, value: 'treatment' },
  { re: /\b(fuel|diesel|petrol|kerosene|gas)\b/, value: 'fuel' },
  { re: /\b(electricity|nepa|power|light\s*bill|water\s*bill|utilit(?:y|ies))\b/, value: 'utilities' },
  { re: /\b(repairs?|repaired|repairing|fixed|fixing|maintenance)\b/, value: 'repairs' },
  { re: /\b(wages?|salar(?:y|ies)|labour|labor|workers?)\b/, value: 'wages' },
  { re: /\b(equipment|feeders?|drinkers?|cages?|incubators?|generators?|bulbs?)\b/, value: 'equipment' },
  { re: /\b(transport|haulage|delivery|logistics|lorry|truck|fare)\b/, value: 'transport' },
  // LAST of the specific ones. "birds" appears in half of all farm
  // sentences; only a clause that named nothing else is a bird spend.
  { re: /\b(day\s*old|doc|chicks?|birds?|point\s*of\s*lay|pol|cockerels?|pullets?|noilers?)\b/, value: 'birds' },
];

/**
 * How big a number may be before it is money rather than a count.
 *
 * Counts are capped at MAX_VALUE (a million birds is already absurd),
 * but money is not a count: a batch of day-olds runs to seven figures
 * in naira. The ceiling here matches what the expenses endpoint
 * accepts, so nothing can be composed locally that the server will
 * then refuse.
 */
export const MAX_MONEY = 999_999_999.99;

/**
 * Multipliers a farmer actually says. "45k" is how a price is spoken
 * in Nigeria far more often than "forty five thousand".
 */
export const MONEY_MULTIPLIERS: ReadonlyMap<string, number> = new Map([
  ['k', 1_000], ['thousand', 1_000], ['thousands', 1_000],
  ['m', 1_000_000], ['million', 1_000_000], ['millions', 1_000_000],
]);

export const NUMBER_WORDS: ReadonlyMap<string, number> = new Map([
  ['zero', 0], ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
  ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
  ['nineteen', 19], ['twenty', 20], ['thirty', 30], ['forty', 40],
  ['fifty', 50], ['sixty', 60], ['seventy', 70], ['eighty', 80],
  ['ninety', 90], ['hundred', 100],
  // MISHEARD: "to" for two and "for" for four are the commonest number
  // confusions in dictated speech. They are NOT listed — both are real
  // words that appear constantly ("gave it to them", "for 15000"), and
  // reading "sold for 15000" as "sold four" would be a wrong number in
  // the ledger. Rule 3 at the top of this file.
  ['a', 1], ['an', 1], ['none', 0],
]);

/**
 * Time-of-day words.
 *
 * Afternoon counts as evening because the wizard offers two halves of
 * the day plus "entire day"; an afternoon collection belongs to the
 * later one.
 */
export const MOMENT_WORDS: ReadonlyArray<{
  re: RegExp;
  moment: 'morning' | 'evening' | 'entire_day';
}> = [
  { re: /\b(all\s+day|whole\s+day|entire\s+day|today\s+total|for\s+the\s+day)\b/, moment: 'entire_day' },
  { re: /\b(morning|mornin|am|early|dawn)\b/, moment: 'morning' },
  { re: /\b(evening|afternoon|night|pm|late)\b/, moment: 'evening' },
];

/**
 * Clause separators.
 *
 * Farmers chain observations in one breath, and splitting on these then
 * classifying each piece independently is both more accurate and far
 * easier to reason about than one regex reading the whole sentence.
 *
 * "for" is NOT a separator: "sold 20 birds for 15000" is a single fact.
 *
 * A FULL STOP ONLY SEPARATES WHEN IT IS NOT A DECIMAL POINT. Without
 * the `(?!\d)`, "2.5 birds died" splits into "2" and "5 birds died" and
 * the parser proposes five deaths from a sentence that said two and a
 * half. Caught by a test; keep the test.
 *
 * Lookahead only, never lookbehind: Safari did not support lookbehind
 * until 16.4, and an unsupported group in a regex LITERAL is a parse
 * error that blanks the whole page on load.
 */
export const CLAUSE_SPLIT = /\s*(?:,|;|\band\b|\bthen\b|\balso\b|\bplus\b|\.(?!\d))\s*/i;
