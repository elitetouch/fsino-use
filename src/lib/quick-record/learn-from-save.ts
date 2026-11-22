'use client';

import { NEVER_LEARNED, isLearnableToken, observe } from './learning';
import type { ParsedField } from './parse';

/**
 * Turn one confirmed save into training signal.
 *
 * THE SIGNAL, and why it is this one. When a farmer says "25 packs of
 * heat" and the app understands "feed: 25 bags" from the container
 * alone, the words it could NOT place — "packs", "heat" — are sitting
 * in the leftover text, and the kinds the farmer confirmed are sitting
 * in the saved fields. Those two together are the lesson: for this
 * speaker, those sounds belong to a feed entry.
 *
 * WHY ONLY ON SAVE. A farmer typing is mid-thought; half a sentence is
 * not evidence of anything. Confirming a save is the one moment they
 * have told us what they meant, so it is the only moment we learn.
 *
 * WHAT IS DELIBERATELY NOT LEARNED:
 *
 *   - Anything when more than one kind was saved. "15 died and 2 bags
 *     of feed" leaves leftover words that could belong to either, and
 *     guessing which would teach the wrong lesson half the time. Only
 *     an unambiguous single-kind save teaches anything.
 *   - Deaths and culls, ever. Enforced here AND in learning.ts, because
 *     a rule this important should not rely on one place getting it
 *     right. Teaching the app that a sound means "birds died" would
 *     corrupt the flock count and the mortality curve the farmer makes
 *     real decisions on.
 *   - Long leftovers. A farmer who dictated a paragraph has given us
 *     noise, not a word.
 *
 * Never throws, never blocks. The record is already saved by the time
 * this runs, and nothing it does may put that at risk.
 */

/** Beyond this many leftover words, the text is prose, not a missed word. */
const MAX_LEFTOVER_WORDS = 6;

export async function learnFromSave(
  leftover: string,
  savedFields: readonly ParsedField[],
): Promise<void> {
  try {
    if (typeof leftover !== 'string' || leftover.trim() === '') return;

    // Exactly one kind, or there is no way to know which the leftover
    // words belonged to.
    const kinds = new Set(savedFields.map((f) => f.kind));
    if (kinds.size !== 1) return;

    const [kind] = [...kinds];
    if (kind === undefined || NEVER_LEARNED.has(kind)) return;

    const tokens = leftover
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((t) => t !== '');

    if (tokens.length === 0 || tokens.length > MAX_LEFTOVER_WORDS) return;

    await observe(tokens.filter(isLearnableToken), kind);
  } catch {
    // Learning is a convenience. A failure here must be invisible.
  }
}
