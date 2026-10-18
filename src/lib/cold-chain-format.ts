/**
 * Formatting shared by the cold-chain screens.
 *
 * In a module rather than exported from a page: Next.js validates the
 * exports of anything under app/ against its Page contract, so a page
 * that also exports helpers fails the build.
 */

/** A temperature, or an em dash when there isn't one. */
export function fmt(v: number | null): string {
  return v === null ? '—' : `${v}°C`;
}

/**
 * A duration a person reads at a glance.
 *
 * "195 min" makes somebody do arithmetic while a room is warming;
 * "3h 15m" does not.
 */
export function mins(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

/**
 * Money, rounded to whole units.
 *
 * Kobo on a figure like ₦2,400,000 is noise — the number is there to
 * convey scale, not to reconcile an account.
 */
export function money(amount: number, currency: string | null): string {
  const symbol = currency === 'NGN' || currency === null ? '₦' : `${currency} `;
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}
