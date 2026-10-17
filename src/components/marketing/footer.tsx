import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { SITE_URL } from '@/lib/links';
import { PlayStoreButton } from './play-store-button';

/**
 * Global footer — a mirror of the one on www.fsinnovation.net.
 *
 * WHY A MIRROR. The company runs two Vercel projects on one brand:
 * fsino-landing serves www.fsinnovation.net, this app serves
 * web.fsinnovation.net. A visitor crosses between them without
 * noticing the hostname — a Play reviewer reading the privacy policy,
 * a farmer following a link to the terms — and two different footers
 * made the second site read as a different company. Columns, headings,
 * labels, type sizes and order match `src/components/site-footer.tsx`
 * in fsino-landing. Change one, change the other.
 *
 * LAYOUT. Six tracks, with the brand block spanning two. At five equal
 * tracks the logo, the tagline and the first column crowded each other:
 * a brand block needs roughly double a link column to breathe, and the
 * column gap has to be visibly wider than the gap between links inside
 * a column, or the eye reads the whole thing as one list.
 *
 * TYPE. Links at 14px, headings at 11px. The previous 12.5/10.5 sat
 * below the floor where a footer still reads as navigation rather than
 * fine print — and this footer carries the legal routes, which have to
 * be legible to a regulator and to Play review, not merely present.
 *
 * WHICH LINKS ARE ABSOLUTE. Only the ones whose page does not exist on
 * this domain. /about and /legal/* are relative because both sites have
 * their own, so the same path resolves correctly on either. /pricing,
 * /products/* and /how-we-build exist only on the brand site, and
 * /contact exists on both but means different things — here it is the
 * authenticated support-thread UI, which would bounce a logged-out
 * visitor to /login — so those point at www explicitly.
 */

type FooterLink = { href: string; label: string; external?: boolean };

const COLUMNS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: 'Product',
    links: [
      { href: `${SITE_URL}/products`, label: 'All products', external: true },
      { href: `${SITE_URL}/products/poultry`, label: 'Poultry farms', external: true },
      { href: `${SITE_URL}/products/greenhouse`, label: 'Greenhouses', external: true },
      { href: `${SITE_URL}/products/irrigation`, label: 'Smart irrigation', external: true },
      { href: `${SITE_URL}/products/cold-chain`, label: 'Cold chain', external: true },
      { href: `${SITE_URL}/products/aquaculture`, label: 'Aquaculture', external: true },
      { href: `${SITE_URL}/pricing`, label: 'Pricing', external: true },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: `${SITE_URL}/how-we-build`, label: 'How we build', external: true },
      { href: 'https://www.farmspeak.net/rebrand', label: 'Our rebrand story', external: true },
    ],
  },
  {
    heading: 'Support',
    links: [
      { href: `${SITE_URL}/contact`, label: 'Contact us', external: true },
      // The brand site's footer sends 'Log in' across to this domain;
      // here it is a plain internal route.
      { href: '/login', label: 'Log in' },
    ],
  },
  {
    // 'Delete account' is required, not decorative: Google Play expects
    // the deletion route to be readily discoverable rather than merely
    // reachable by direct link. It used to sit in the legal pages' own
    // footer; when those pages adopted this one it had to come along.
    heading: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/delete-account', label: 'Delete account' },
    ],
  },
];

const LINK_CLASS =
  'text-[14px] leading-snug text-[var(--color-brand-fg-soft)] transition-colors hover:text-[var(--color-brand-primary-deep)]';

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]">
      <div
        className="mx-auto px-6 py-14 sm:px-8 lg:px-12 lg:py-16"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-6 lg:gap-x-12">
          {/* Brand block — two tracks wide so it is not mistaken for a
              fifth link column. */}
          <div className="lg:col-span-2">
            <Logo size={160} />
            <p className="mt-4 max-w-[34ch] text-[13.5px] leading-[1.65] text-[var(--color-brand-muted)]">
              An operating system for African farmers. Built in Ogun and Lagos.
              Serving farmers from the Sahel to the Guinea coast.
            </p>
            <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
              Formerly Farmspeak Technology.
            </p>
            {/* The one conversion this footer is asked to drive, so it
                sits in the brand block rather than lost among links. */}
            <div className="mt-6">
              <PlayStoreButton size="sm" />
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
                {col.heading}
              </p>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={LINK_CLASS}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--color-brand-border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-[var(--color-brand-muted)]">
            © {year} Farm Support Innovation Ltd. All rights reserved.
          </p>
          <p className="text-[12px] text-[var(--color-brand-muted)]">
            Made in Nigeria, for farmers across Africa.
          </p>
        </div>
      </div>
    </footer>
  );
}
