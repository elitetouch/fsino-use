/**
 * Outbound destinations shared across the app's public surface.
 *
 * One place so a changed URL is one edit, not a grep. The same file
 * exists in fsino-landing (src/lib/links.ts) — keep them in step.
 */

/**
 * The live Play Store listing.
 *
 * This is a CONSTANT, not an env lookup with a fallback. It used to be
 * `process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? 'https://play.google.com/store'`,
 * which meant that unless the variable was set in Vercel, every "Get it
 * on Google Play" button on the site sent people to the Play Store
 * homepage rather than to our app — a silent failure with no error and
 * no broken link to notice.
 *
 * The listing URL is public and permanent. There is nothing to
 * configure per environment, so nothing should be able to go missing.
 */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.farmsupportinnovation.fsino';

/** The Android package, used for intent:// deep links. */
export const ANDROID_PACKAGE = 'com.farmsupportinnovation.fsino';

/** The brand site on www.fsinnovation.net. */
export const SITE_URL = 'https://www.fsinnovation.net';
