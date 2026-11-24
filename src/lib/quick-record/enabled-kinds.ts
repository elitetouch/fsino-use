import type { FieldKind } from './vocabulary';
import type { DailyRecordPrefs } from '@/lib/api';

/**
 * What this farm actually tracks.
 *
 * WHY QUICK RECORD NEEDS THIS. The wizard builds its steps from
 * `effectiveDailyRecord`, so a farm that does not track water simply
 * has no water step. Quick record read none of it: it parsed whatever
 * the farmer said and posted it, and the server answered
 *
 *   event_type: "water records are disabled in this farm settings."
 *
 * — a 422, which the outbox classes as permanent. So saying "two bags
 * of feed and 40 litres of water" produced a record that could never
 * be sent, sitting in the sync screen under a "Try again" button that
 * would refuse it every time.
 *
 * The two surfaces must agree on what the farm records. This is that
 * agreement, in one place, derived from the same preferences the
 * wizard reads.
 */
export function enabledKinds(eff: DailyRecordPrefs | null | undefined): ReadonlySet<FieldKind> {
  const on = new Set<FieldKind>();

  // An expense is not a daily-record event. It is a separate ledger
  // with its own endpoint and its own permission, so the farm's
  // daily-record settings have no say over it — a farm that does not
  // track water still buys feed.
  on.add('expense');
  // Selling eggs or manure is its own ledger entry, not a
  // daily-record event the farm can switch off.
  on.add('produce_sale');

  if (!eff) {
    // Preferences not loaded. Allow everything rather than silently
    // discarding what the farmer said — the server is still the
    // authority, and a visible rejection beats an invisible drop.
    return new Set<FieldKind>([
      'expense',
      'produce_sale',
      'dead', 'culled', 'sold', 'lost', 'feed', 'water', 'eggs', 'weight',
      'egg_weight', 'vaccination', 'treatment',
    ]);
  }

  if (eff.feed?.include) on.add('feed');
  if (eff.water?.include) on.add('water');
  if (eff.vaccination?.include) on.add('vaccination');
  if (eff.treatment?.include) on.add('treatment');
  if (eff.bird_weight?.include) on.add('weight');

  // Bird movements are four independent switches in settings, and the
  // parser has a kind per movement, so they map one to one rather
  // than through the wizard's combined "Bird count" step.
  const bc = eff.bird_count ?? {};
  if (bc.dead) on.add('dead');
  if (bc.culled) on.add('culled');
  if (bc.sold) on.add('sold');
  if (bc.lost) on.add('lost');

  if (eff.eggs?.include) {
    on.add('eggs');
    // Egg weight rides on the eggs payload, so it cannot be enabled
    // on its own.
    const em = eff.egg_metrics ?? {};
    if (em.track_weight) on.add('egg_weight');
  }

  return on;
}

/** The farmer's words for a kind, for the "not tracked" message. */
const KIND_LABEL: Record<FieldKind, string> = {
  expense: 'expenses',
  produce_sale: 'produce sales',
  dead: 'deaths',
  culled: 'culls',
  sold: 'birds sold',
  lost: 'missing birds',
  feed: 'feed',
  water: 'water',
  eggs: 'eggs',
  weight: 'bird weight',
  egg_weight: 'egg weight',
  vaccination: 'vaccinations',
  treatment: 'treatments',
};

export function notTrackedReason(kind: FieldKind): string {
  return `This farm isn't recording ${KIND_LABEL[kind] ?? kind} — turn it on in Daily record settings.`;
}
