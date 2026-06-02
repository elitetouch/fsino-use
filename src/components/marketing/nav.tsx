'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Marketing nav.
 *
 * Structure mirrors fsinnovation.net (the parent brand site):
 *   Home · Products ▾ · Pricing · About · Contact   [Log in] [Get started]
 *
 * Implementation notes:
 *   - Header is h-20 (80px) at small/md, h-[88px] at lg+. The logo
 *     renders at size 72/84 so it sits comfortably inside with
 *     vertical breathing room (the previous h-16 + size-108 setup
 *     clipped the logo's cloud antenna at the top of the viewport).
 *   - Transparent at the top of the page, becomes a solid white
 *     backdrop-blurred bar after scrolling > 8px.
 *   - Hamburger drawer on phones with the same items as the desktop
 *     nav plus stacked CTAs at the bottom.
 *   - Products is a hover/click dropdown listing what the platform
 *     covers (consistent with the real site).
 */

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Home', href: '/' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const PRODUCT_LINKS: Array<{ label: string; href: string; body?: string }> = [
  { label: 'Web app', href: '/register', body: 'Manage your farm in the browser.' },
  { label: 'Android app', href: '#platforms', body: 'Get it free on the Play Store.' },
  { label: 'For cooperatives', href: '#audience', body: 'Onboard members in minutes.' },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Close drawers on Escape — small QoL.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setProductsOpen(false);
      }
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
          <NavLinkInline href="/">Home</NavLinkInline>

          {/* Products dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setProductsOpen(true)}
            onMouseLeave={() => setProductsOpen(false)}
          >
            <button
              type="button"
              onClick={() => setProductsOpen((v) => !v)}
              aria-expanded={productsOpen}
              className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[15px] font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:text-[var(--color-brand-primary-deep)]"
            >
              Products
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  productsOpen && 'rotate-180',
                )}
              />
            </button>

            {productsOpen && (
              <div className="absolute left-1/2 top-full z-50 w-[320px] -translate-x-1/2 pt-2">
                <div className="animate-fade-up overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-2 shadow-[0_30px_60px_-25px_rgba(15,80,30,0.25)]">
                  {PRODUCT_LINKS.map((p) => (
                    <Link
                      key={p.label}
                      href={p.href}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--color-brand-accent)]/40"
                      onClick={() => setProductsOpen(false)}
                    >
                      <p className="text-sm font-semibold text-[var(--color-brand-fg)]">{p.label}</p>
                      {p.body && (
                        <p className="mt-0.5 text-xs text-[var(--color-brand-muted)]">{p.body}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.slice(1).map((l) => (
            <NavLinkInline key={l.href} href={l.href}>
              {l.label}
            </NavLinkInline>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[15px] font-semibold text-[var(--color-brand-fg-soft)] transition-colors hover:text-[var(--color-brand-primary-deep)]"
          >
            Log in
          </Link>
          <Button asChild className="h-11 px-5 text-[15px]">
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
            {[{ label: 'Home', href: '/' }, ...PRODUCT_LINKS, ...NAV_LINKS.slice(1)].map((l) => (
              <Link
                key={`${l.label}-${l.href}`}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:bg-[var(--color-brand-accent)]/40"
              >
                {l.label}
              </Link>
            ))}
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

function NavLinkInline({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-4 py-2 text-[15px] font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:text-[var(--color-brand-primary-deep)]"
    >
      {children}
    </Link>
  );
}
