'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Marketing nav — a mirror of the one on www.fsinnovation.net.
 *
 * WHY A MIRROR. Two Vercel projects serve one brand: fsino-landing on
 * www.fsinnovation.net and this app on web.fsinnovation.net. People
 * cross between them without noticing the hostname, so the chrome has
 * to be the same on both. Items, labels and order here match `LINKS`
 * in `src/components/site-navbar.tsx` over in fsino-landing — change
 * one, change the other. The same goes for the footer.
 *
 * This used to carry a Products dropdown and a Home item that the brand
 * site does not have. Both are gone: the logo is the route home, and
 * Products is a page over there, not a menu.
 *
 * Implementation notes:
 *   - Header is h-20 (80px) at small/md, h-[88px] at lg+. The logo
 *     renders at size 72/84 so it sits comfortably inside with
 *     vertical breathing room (an earlier h-16 + size-108 setup
 *     clipped the logo's cloud antenna at the top of the viewport).
 *   - Transparent at the top of the page, solid white backdrop-blurred
 *     bar after scrolling > 8px.
 *   - Hamburger drawer on phones with the same items plus stacked CTAs.
 */

type NavLink = { href: string; label: string; external?: boolean };

const SITE = 'https://www.fsinnovation.net';

/**
 * Only /about is relative: both sites have one, so the path resolves
 * to each site's own page. The rest live only on the brand site —
 * except /contact, which exists here too but is the authenticated
 * support-thread UI and would bounce a logged-out visitor to /login,
 * so it points at www like the others.
 *
 * External items navigate in place rather than opening a tab. These are
 * primary navigation between two halves of one brand, not references.
 */
const LINKS: NavLink[] = [
  { href: `${SITE}/products`, label: 'Products', external: true },
  { href: `${SITE}/pricing`, label: 'Pricing', external: true },
  { href: `${SITE}/how-we-build`, label: 'How we build', external: true },
  { href: '/about', label: 'About' },
  { href: `${SITE}/contact`, label: 'Contact', external: true },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Close the drawer on Escape — small QoL.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-[var(--color-brand-border)] bg-white/90 backdrop-blur-lg'
          : 'border-b border-transparent bg-white/60 backdrop-blur-sm',
      )}
    >
      <div
        className="mx-auto flex h-20 items-center justify-between gap-6 px-5 sm:px-8 lg:h-[88px] lg:px-12"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* Logo — sized so it always fits inside the header height with
            breathing room. Was previously oversized → clipped at top. */}
        <Link
          href="/"
          aria-label="Home"
          className="-ml-1 inline-flex shrink-0 items-center transition-opacity hover:opacity-90"
        >
          <Logo size={72} className="lg:!w-[84px]" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLinkInline key={l.href} href={l.href} external={l.external}>
              {l.label}
            </NavLinkInline>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[0.9375rem] font-semibold text-[var(--color-brand-fg-soft)] transition-colors hover:text-[var(--color-brand-primary-deep)]"
          >
            Log in
          </Link>
          <Button asChild className="h-11 px-5 text-[0.9375rem]">
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-brand-fg)] transition-colors hover:bg-[var(--color-brand-accent)]/40 lg:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="animate-fade-up border-t border-[var(--color-brand-border)] bg-white px-5 py-5 sm:px-8 lg:hidden">
          <nav className="flex flex-col gap-1 pb-2">
            {LINKS.map((l) =>
              l.external ? (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:bg-[var(--color-brand-accent)]/40"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:bg-[var(--color-brand-accent)]/40"
                >
                  {l.label}
                </Link>
              ),
            )}
          </nav>
          <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-brand-border)] pt-4">
            <Button asChild variant="outline" size="block">
              <Link href="/login" onClick={() => setOpen(false)}>Log in</Link>
            </Button>
            <Button asChild size="block">
              <Link href="/register" onClick={() => setOpen(false)}>Get started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

function NavLinkInline({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    'rounded-full px-4 py-2 text-[0.9375rem] font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:text-[var(--color-brand-primary-deep)]';

  if (external) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
