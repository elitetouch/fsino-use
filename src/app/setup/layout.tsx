'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { clearToken, readToken } from '@/lib/auth';

/**
 * Shell for the post-onboarding setup flow.
 *
 * Same calm tinted background + animated mint blobs as the auth shell,
 * but the centered card is wider (max-w-2xl) so multi-field forms
 * (Set up farm, Add flock step 3) don't feel cramped.
 *
 * Sign-out replaces "Back to home" in this header because there's no
 * meaningful "back" mid-setup; if the farmer wants to bail, signing
 * out is the cleanest exit.
 */
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Guard: must be authenticated to be in the setup flow.
  useEffect(() => {
    if (!readToken()) router.replace('/login');
  }, [router]);

  function onSignOut() {
    clearToken();
    router.replace('/');
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-brand-surface-soft)]">
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[var(--color-brand-accent-strong)] opacity-50 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob [animation-delay:6s] pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[var(--color-brand-accent)] opacity-60 blur-3xl"
      />

      <header
        className="relative z-10 mx-auto flex h-16 items-center justify-between px-5 sm:h-[72px] sm:px-8 lg:px-12"
        style={{ maxWidth: 'var(--container-wide)' }}
      >
        <Link href="/" aria-label="Home" className="inline-flex items-center">
          <Logo height={32} className="sm:hidden" />
          <Logo height={36} className="hidden sm:block" />
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-[var(--color-brand-muted)] transition-colors hover:bg-white hover:text-[var(--color-brand-fg)]"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-72px)] items-start justify-center px-5 pb-12 pt-2 sm:items-center sm:px-8">
        <div className="animate-fade-up w-full max-w-2xl">
          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 shadow-[0_24px_60px_-30px_rgba(15,80,30,0.15)] sm:p-7">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
