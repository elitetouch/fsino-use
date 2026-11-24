import type { OutboxEntry } from './db';

/**
 * Name the record in the farmer's language.
 *
 * Derived from the request URL, because that is all the queue stores —
 * it is transport-level by design and does not know what a "mortality
 * entry" is. Reading it here keeps that separation while still putting
 * something recognisable on screen. An unmatched URL falls back to
 * "A saved change", which is vague but never wrong; guessing would be
 * worse, since this text decides whether someone deletes it.
 */
export function describe(entry: OutboxEntry): string {
  const url = entry.url;

  // BEFORE the '/flocks' checks, and matching the real path.
  //
  // A daily record posts to `/flocks/<id>/daily-records`, which the
  // '/records' test below never matched — the path reads
  // `-records`, not `/records` — so every one of them fell through to
  // the '/flocks' + POST rule and was shown to the farmer as
  // "New flock". Four rejected daily records read as four failed
  // attempts to create a flock they never tried to create.
  if (url.includes('daily-records')) return 'Daily record';
  if (url.includes('/records')) return 'Daily record';
  if (url.includes('/diagnoses')) return 'Disease check';
  if (url.includes('/expenses')) return 'Expense';
  if (url.includes('/sales')) return 'Sale';
  if (url.includes('/flocks') && entry.method === 'POST') return 'New flock';
  if (url.includes('/flocks')) return 'Flock update';
  if (url.includes('/pens') && entry.method === 'POST') return 'New pen';
  if (url.includes('/pens')) return 'Pen update';
  if (url.includes('/vaccination')) return 'Vaccination';
  if (url.includes('/profile')) return 'Profile change';
  if (url.includes('/settings')) return 'Settings change';

  return 'A saved change';
}
