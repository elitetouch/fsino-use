'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS: Array<{ label: string; href: string }> = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'For who', href: '#audience' },
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

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-[var(--color-brand-border)] bg-white/85 backdrop-blur-lg'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div
        className="mx-auto flex h-16 items-center justify-between px-6 sm:h-[72px] sm:px-8 lg:px-12"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <Link href="/" aria-label="Home" className="-ml-1 inline-flex shrink-0 items-center">
          <Logo size={108} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:text-[var(--color-brand-primary-deep)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-semibold text-[var(--color-brand-fg-soft)] underline-offset-4 hover:underline"
          >
            Log in
          </Link>
          <Button asChild size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-accent)]/40 md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--color-brand-border)] bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-3 pb-2">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-base font-medium text-[var(--color-brand-fg-soft)] hover:bg-[var(--color-brand-accent)]/40"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-brand-border)] pt-3">
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
