/**
 * Convert confirmed fields into the exact payloads the daily-record
 * endpoints already accept.
 *
 * THIS IS THE TRUST BOUNDARY, and it is deliberately dumb. It performs
 * no parsing, accepts no strings from the farmer except the note, and
 * emits only the same payload shapes the wizard steps emit — so quick
 * records travel the identical server-side validators, the identical
 * permission checks and the identical offline outbox as every record
 * written by hand. Nothing here is a new way into the system; it is a
 * second keyboard on the same door.
 *
 * Three rules hold this together:
 *
 *   1. Only call this with fields the FARMER CONFIRMED on screen. The
 *      parser's output is a proposal; this function's input is a
 *      decision.
 *   2. Every numeric value is re-checked here even though parse.ts
 *      checked it. The two modules are separately reachable and a
 *      caller could hand-build a field; the cost of checking twice is
 *      nothing and the cost of trusting once is a corrupt flock count.
 *   3. The note is the only free text that leaves this module, and it
 *      is length-capped. React escapes it on render and the backend
 *      validates it on receipt — but we do not hand on something
 *      unbounded that we were given unbounded.
 */

import type { CreateDailyRecordPayload } from '@/lib/api';
import type { ParsedField } from './parse';

/**
 * Longest note we will forward.
 *
 * The leftover text from a dictation is the only unstructured thing
 * here. The backend has its own limit; this one exists so an oversized
 * string never even reaches the outbox.
 */
export const MAX_NOTE = 280;

/** Mirrors parse.ts. Re-stated rather than imported so the check is local. */
const MAX_VALUE = 1_000_000;

function usableCount(n: unknown): n is number {
  return (
    typeof n === 'number' &&
    Number.isFinite(n) &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= MAX_VALUE
  );
}

function usableQuantity(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= MAX_VALUE;
}

/**
 * Units each event type is allowed to carry.
 *
 * An allowlist, not a passthrough. The unit reaches the API as a string,
 * and the one thing we must never do is forward whatever a future
 * vocabulary edit happens to produce.
 */
const ALLOWED_UNITS: Readonly<Record<'feed' | 'water' | 'weight', readonly string[]>> = {
  feed: ['kg', 'bags'],
  water: ['liters'],
  weight: ['kg', 'g'],
};

/**
 * Allowlists for the two detail fields that reach a payload as strings.
 *
 * Same reasoning as ALLOWED_UNITS: the vocabulary file is edited often
 * and by whoever is chasing a mis-parse, so the boundary re-checks
 * rather than forwarding whatever a future edit happens to produce.
 * `vaccine_name` is deliberately NOT allowlisted — it is free text on
 * the wizard too, and the backend validates it.
 */
const FEED_TYPE_VALUES: readonly string[] = ['starter', 'grower', 'finisher', 'layer'];
const EGG_SIZES: readonly string[] = ['small', 'medium', 'jumbo'];

function safeUnit(
  kind: 'feed' | 'water' | 'weight',
  unit: string | undefined,
  fallback: string,
): string {
  return unit && ALLOWED_UNITS[kind].includes(unit) ? unit : fallback;
}

export interface BuildOptions {
  /** YYYY-MM-DD. Passed straight through to the same field the wizard uses. */
  readonly recordDate: string;
  readonly moment: 'morning' | 'evening' | 'entire_day';
  /** Leftover dictation the farmer chose to keep. */
  readonly note?: string;
}

/**
 * Build the POST bodies for a confirmed quick record.
 *
 * Bird movements collapse into ONE `bird_count` event, matching what the
 * wizard's bird-count step sends — dead, culled, sold and lost are four
 * columns of a single reconciliation, not four separate events, and
 * splitting them would double-count against flock.current_birds.
 */
export function buildQuickRecordPayloads(
  fields: readonly ParsedField[],
  opts: BuildOptions,
): CreateDailyRecordPayload[] {
  const payloads: CreateDailyRecordPayload[] = [];
  const { recordDate, moment } = opts;

  const counts = { dead: 0, culled: 0, sold: 0, lost: 0 };
  let soldAmount: number | undefined;
  let hasBirdMovement = false;
  let eggWeightGrams: number | undefined;

  for (const f of fields) {
    switch (f.kind) {
      case 'dead':
      case 'culled':
      case 'sold':
      case 'lost': {
        if (!usableCount(f.value) || f.value === 0) break;
        counts[f.kind] = f.value;
        hasBirdMovement = true;
        if (f.kind === 'sold' && usableQuantity(f.amount) && f.amount > 0) {
          soldAmount = f.amount;
        }
        break;
      }

      case 'feed': {
        if (!usableQuantity(f.value) || f.value === 0) break;
        payloads.push({
          event_type: 'feed',
          record_date: recordDate,
          quantity: f.value,
          unit: safeUnit('feed', f.unit, 'kg'),
          payload: {
            moment,
            // The ration when the farmer named it ("two bags of
            // STARTER feed"). item_brand stays absent — a brand is
            // never reliably recoverable from speech, and writing a
            // guessed one into their purchase history would be worse
            // than leaving it for the wizard.
            ...(f.detail?.feedType && FEED_TYPE_VALUES.includes(f.detail.feedType)
              ? { item_type: f.detail.feedType }
              : {}),
          },
        });
        break;
      }

      case 'water': {
        if (!usableQuantity(f.value) || f.value === 0) break;
        payloads.push({
          event_type: 'water',
          record_date: recordDate,
          quantity: f.value,
          unit: safeUnit('water', f.unit, 'liters'),
          payload: { moment },
        });
        break;
      }

      case 'eggs': {
        if (!usableCount(f.value)) break;
        payloads.push({
          event_type: 'eggs',
          record_date: recordDate,
          // `good` is required on every eggs row by the backend's
          // validator. We never infer `bad` — a farmer who says "3
          // crates" means three good crates, and cracked eggs are a
          // separate thing they have to tell us about.
          payload: {
            good: f.value,
            moment,
            // Matches the egg-size step's payload.sizes.{key} shape.
            ...(f.detail?.eggSize && EGG_SIZES.includes(f.detail.eggSize)
              ? { sizes: { [f.detail.eggSize]: f.value } }
              : {}),
          },
        });
        break;
      }

      case 'egg_weight': {
        // The egg-size step stores a per-egg average in grams, and the
        // backend requires `good` on every eggs row — so a weight with
        // no count cannot be posted on its own. Held back rather than
        // posted with a fabricated count of zero eggs.
        if (!usableQuantity(f.value) || f.value === 0) break;
        eggWeightGrams = f.value;
        break;
      }

      case 'vaccination': {
        const name = f.detail?.vaccineName;
        // The vaccine name is the record. Without one there is nothing
        // meaningful to store, and guessing which vaccine was given is
        // the last thing a health log should do.
        if (typeof name !== 'string' || name === '') break;
        payloads.push({
          event_type: 'vaccination',
          record_date: recordDate,
          // Dose omitted entirely when not stated — zero ml would be a
          // claim the farmer never made.
          ...(usableQuantity(f.value) && f.value > 0
            ? { quantity: f.value, unit: 'ml' }
            : {}),
          payload: { vaccine_name: name },
        });
        break;
      }

      case 'treatment': {
        const type = f.detail?.treatmentType;
        if (typeof type !== 'string' || type === '') break;
        payloads.push({
          event_type: 'treatment',
          record_date: recordDate,
          payload: {
            treatment_type: type,
            // A number in a treatment clause is the birds affected.
            ...(usableCount(f.value) && f.value > 0
              ? { birds_affected: f.value, all_birds: false }
              : { all_birds: true }),
          },
        });
        break;
      }

      case 'weight': {
        if (!usableQuantity(f.value) || f.value === 0) break;
        payloads.push({
          event_type: 'weight',
          record_date: recordDate,
          quantity: f.value,
          unit: safeUnit('weight', f.unit, 'kg'),
          payload: { moment },
        });
        break;
      }
    }
  }

  // Egg weight rides on the eggs event rather than travelling alone,
  // because the backend's eggs validator requires `good` on every row.
  // If the farmer gave a weight but no count there is no event to
  // attach it to, and it is dropped rather than posted with a count of
  // zero — the wizard's egg-size step is the right place for that.
  if (eggWeightGrams !== undefined) {
    const eggsPayload = payloads.find((p) => p.event_type === 'eggs');
    if (eggsPayload && eggsPayload.payload) {
      (eggsPayload.payload as Record<string, unknown>).weight_avg_grams = eggWeightGrams;
    }
  }

  if (hasBirdMovement) {
    // Shape copied from bird-count-step.tsx. `amount` is attached only
    // when a price was actually given: omitting the key is what lets the
    // backend tell "sold for nothing" from "price not captured yet",
    // which drives the incomplete-margin disclosure on the P&L.
    payloads.unshift({
      event_type: 'bird_count',
      record_date: recordDate,
      payload: {
        anyChange: true,
        sold: {
          count: counts.sold,
          ...(counts.sold > 0 && soldAmount !== undefined ? { amount: soldAmount } : {}),
        },
        dead: { count: counts.dead },
        culled: { count: counts.culled },
        lost: { count: counts.lost },
      },
    });
  }

  const note = typeof opts.note === 'string' ? opts.note.trim().slice(0, MAX_NOTE) : '';
  if (note !== '') {
    payloads.push({ event_type: 'note', record_date: recordDate, note });
  }

  return payloads;
}
