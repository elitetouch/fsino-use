import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

/**
 * Global footer — a mirror of the one on www.fsinnovation.net.
 *
 * WHY A MIRROR. The company runs two Vercel projects on one brand:
 * fsino-landing serves www.fsinnovation.net, this app serves
 * web.fsinnovation.net. A visitor crosses between them without
 * noticing the hostname — a Play reviewer reading the privacy policy,
 * a farmer following a link to the terms — and two different footers
 * made the second site read as a different company. Columns, headings,
 * labels and order here match `src/components/site-footer.tsx` in
 * fsino-landing. Change one, change the other.
 *
 * WHICH LINKS ARE ABSOLUTE. Only the ones whose page does not exist on
 * this domain. /about and /legal/* are relative because both sites have
 * their own, so the same path resolves correctly on either. /pricing,
 * /products/* and /how-we-build exist only on the brand site, and
 * /contact exists on both but means different things — here it is the
 * authenticated support-thread UI, which would bounce a logged-out
 * visitor to /login — so all of those point at www explicitly.
 */

type FooterLink = { href: string; label: string; external?: boolean };

const SITE = 'https://www.fsinnovation.net';

const COLUMNS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: 'Product',
    links: [
      { href: `${SITE}/products`, label: 'All products', external: true },
      { href: `${SITE}/products/poultry`, label: 'Poultry farms', external: true },
      { href: `${SITE}/products/greenhouse`, label: 'Greenhouses', external: true },
      { href: `${SITE}/products/irrigation`, label: 'Smart irrigation', external: true },
      { href: `${SITE}/products/cold-chain`, label: 'Cold chain', external: true },
      { href: `${SITE}/products/aquaculture`, label: 'Aquaculture', external: true },
      { href: `${SITE}/pricing`, label: 'Pricing', external: true },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: `${SITE}/how-we-build`, label: 'How we build', external: true },
      { href: 'https://www.farmspeak.net/rebrand', label: 'Our rebrand story', external: true },
    ],
  },
  {
    heading: 'Support',
    links: [
      { href: `${SITE}/contact`, label: 'Contact us', external: true },
      // The brand site's footer sends 'Log in' here; on this domain it
      // is a plain internal route.
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

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]">
      <div
        className="mx-auto px-6 py-14 sm:px-8 lg:px-12 lg:py-16"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* Five tracks: the logo block plus the four columns. */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <Logo size={132} />
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-[var(--color-brand-muted)]">
              An operating system for African farmers. Built in Ogun and Lagos.
              Serving farmers from the Sahel to the Guinea coast.
            </p>
            <p className="mt-3 text-[11.5px] text-[var(--color-brand-muted)]">
              Formerly Farmspeak Technology.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
                {col.heading}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12.5px] text-[var(--color-brand-fg-soft)] hover:text-[var(--color-brand-primary-deep)]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[12.5px] text-[var(--color-brand-fg-soft)] hover:text-[var(--color-brand-primary-deep)]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-[var(--color-brand-border)] pt-6">
          <p className="text-[11px] text-[var(--color-brand-muted)]">
            © {year} Farm Support Innovation Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
