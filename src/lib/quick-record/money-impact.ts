import type { ParsedField } from './parse';
import type { FlockFinanceDto } from '@/lib/api';

/**
 * What the money a farmer just said actually means for this cycle.
 *
 * WHY THIS IS THE FEATURE. Transcribing speech into a form is a thing
 * anyone can build. Telling a farmer, in the second before they
 * confirm, that the feed they just bought puts this cycle at ₦230,000
 * on feed and ninety-four naira a bird is not — it needs the cost
 * model, the flock size and the ledger, and it is the difference
 * between a recording app and one that runs a farm.
 *
 * COMPUTED LOCALLY, so it works with no signal. The per-bird figure
 * needs only the bird count the composer already holds. The
 * cycle-to-date figure is read from whatever the finance query has
 * cached and is simply omitted when there is nothing cached — a
 * missing line is honest; a stale one presented as current is not.
 */

export interface MoneyImpact {
  /** Money leaving the farm in this sentence. */
  readonly out: number;
  /** Money arriving in this sentence. */
  readonly in: number;
  /** out - in. Positive means the farm is down on this entry. */
  readonly net: number;
  /** Cost per bird of the money going out, or null when unknowable. */
  readonly perBird: number | null;
  /**
   * Where this cycle lands on the biggest category in the sentence,
   * INCLUDING what is about to be saved — a farmer wants to know
   * where they will be, not where they were.
   */
  readonly categoryToDate: { readonly category: string; readonly amount: number } | null;
}

export function moneyImpact(
  fields: readonly ParsedField[],
  opts: {
    readonly currentBirds?: number;
    readonly finance?: FlockFinanceDto | null;
  },
): MoneyImpact | null {
  let out = 0;
  let incoming = 0;
  const byCategory = new Map<string, number>();

  for (const f of fields) {
    const value = Number(f.value);
    if (!Number.isFinite(value) || value <= 0) continue;

    if (f.kind === 'expense') {
      out += value;
      const category = f.detail?.expenseCategory;
      if (typeof category === 'string') {
        byCategory.set(category, (byCategory.get(category) ?? 0) + value);
      }
    } else if (f.kind === 'produce_sale') {
      incoming += value;
    }
  }

  // Nothing financial was said; the composer shows nothing.
  if (out === 0 && incoming === 0) return null;

  const birds = opts.currentBirds;
  const perBird =
    out > 0 && typeof birds === 'number' && Number.isFinite(birds) && birds > 0
      ? Math.round((out / birds) * 100) / 100
      : null;

  // The largest category in this sentence is the one worth naming.
  let topCategory: string | null = null;
  let topAmount = 0;
  for (const [category, amount] of byCategory) {
    if (amount > topAmount) {
      topCategory = category;
      topAmount = amount;
    }
  }

  let categoryToDate: MoneyImpact['categoryToDate'] = null;
  if (topCategory !== null) {
    const spentSoFar = opts.finance?.expenses?.byCategory
      ?.find((row) => row.category === topCategory)?.amount;
    if (typeof spentSoFar === 'number' && Number.isFinite(spentSoFar)) {
      categoryToDate = {
        category: topCategory,
        // Including what is about to be saved.
        amount: Math.round((spentSoFar + topAmount) * 100) / 100,
      };
    }
  }

  return {
    out: Math.round(out * 100) / 100,
    in: Math.round(incoming * 100) / 100,
    net: Math.round((out - incoming) * 100) / 100,
    perBird,
    categoryToDate,
  };
}
