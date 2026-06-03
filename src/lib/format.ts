/**
 * Shared formatters — pure functions, no React, safe to import from
 * server or client code.
 */

const DATE_LOCALE = 'en-GB';

/**
 * Format an ISO-ish date string as a short human date.
 *   "2026-06-02T23:00:00.000000Z" → "2 Jun 2026"
 * Returns "—" for falsy input so call-sites can drop in the result
 * without null-checking every value.
 */
export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Same but with the weekday — used on cards like "Started Monday, 2 Jun 2026".
 */
export function fmtLongDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(DATE_LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format with date + time, e.g. "2 Jun 2026, 14:30".
 */
export function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(DATE_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
