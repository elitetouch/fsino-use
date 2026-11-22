import type { ParsedField } from './parse';

/**
 * Fill in what the farmer didn't say this time from what they said last
 * time — visibly.
 *
 * WHY THIS EXISTS. A farmer buys one brand and feeds it for weeks.
 * Making them say "Top Feeds starter" every single evening to keep the
 * record complete is how a feature designed to save time starts costing
 * it, and the wizard already carries both fields forward from
 * `last_entry`, so quick record not doing it was the inconsistency.
 *
 * WHY IT IS MARKED RATHER THAN SILENT, which is the whole point of this
 * module. Brand is the field where quiet inheritance does real damage:
 * a farmer who switches from Top Feeds to Chikun and does not mention
 * it would have weeks of records attributed to a brand they stopped
 * buying, and cost-per-bag and feed-conversion-by-brand — the only
 * reasons to record a brand at all — would be quietly wrong. A blank is
 * recoverable; a confident wrong value is not.
 *
 * So anything carried over is listed in `detail.inherited`, the chip
 * shows it as carried rather than heard, and one tap removes it. The
 * farmer always sees what is about to be saved on their behalf.
 *
 * Nothing is ever inherited over something the farmer actually said.
 */

export interface LastFeedEntry {
  readonly itemType?: string;
  readonly itemBrand?: string;
  readonly itemBrandLabel?: string;
}

/**
 * Read the previous feed entry out of the guidance payload.
 *
 * `last_entry` is typed as an open record because the backend composes
 * it per event type, so every field is checked rather than asserted.
 */
export function lastFeedFromGuidance(
  lastEntry: Record<string, unknown> | null | undefined,
): LastFeedEntry | null {
  if (!lastEntry || typeof lastEntry !== 'object') return null;
  const itemType = typeof lastEntry.item_type === 'string' ? lastEntry.item_type : undefined;
  const itemBrand = typeof lastEntry.item_brand === 'string' ? lastEntry.item_brand : undefined;
  if (itemType === undefined && itemBrand === undefined) return null;
  return { itemType, itemBrand };
}

/**
 * Apply the previous entry to any feed field that is missing details.
 *
 * Returns a new list; the input is untouched.
 */
export function applyCarryForward(
  fields: readonly ParsedField[],
  last: LastFeedEntry | null,
): readonly ParsedField[] {
  if (last === null) return fields;

  return fields.map((field) => {
    if (field.kind !== 'feed') return field;

    const inherited: string[] = [];
    const feedType = field.detail?.feedType ?? (last.itemType || undefined);
    if (feedType !== undefined && field.detail?.feedType === undefined) {
      inherited.push('feedType');
    }

    const feedBrand = field.detail?.feedBrand ?? (last.itemBrand || undefined);
    if (feedBrand !== undefined && field.detail?.feedBrand === undefined) {
      inherited.push('feedBrand');
    }

    if (inherited.length === 0) return field;

    return {
      ...field,
      detail: {
        ...field.detail,
        feedType,
        feedBrand,
        feedBrandLabel:
          field.detail?.feedBrandLabel ?? (inherited.includes('feedBrand') ? last.itemBrandLabel : undefined),
        inherited,
      },
    };
  });
}
