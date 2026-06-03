import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/logo';

/**
 * Auth shell — clean centered card on a light tinted background.
 *
 * The previous split layout was visually noisy and didn't read well on
 * mid-width screens. A centered card is the world-class pattern (Stripe,
 * Linear, Resend) and works elegantly from phone to 4K.
 *
 * Decorative mint blobs in the corners add depth without competing with
 * the form. The header is full-width with a back link and brand logo.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-brand-surface-soft)]">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[var(--color-brand-accent-strong)] opacity-50 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob [animation-delay:6s] pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[var(--color-brand-accent)] opacity-60 blur-3xl"
      />

      {/* Slim header — back link only; brand lives right above the card. */}
      <header
        className="relative z-10 mx-auto flex h-16 items-center px-5 sm:h-[72px] sm:px-8 lg:px-12"
        style={{ maxWidth: 'var(--container-wide)' }}
      >
        <Link
          href="/"
          aria-label="Back to home"
          className="-ml-1 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Link>
      </header>

      {/* Centered logo + card stack */}
      <main className="relative z-10 flex min-h-[calc(100vh-72px)] items-center justify-center px-5 pb-10 pt-2 sm:px-8 md:pb-14 lg:pb-16">
        <div className="animate-fade-up w-full max-w-[460px] sm:max-w-[480px]">
          {/* Logo sits directly above the card so the brand identifies
              the auth surface without a heavy top-of-page header. */}
          <Link
            href="/"
            aria-label="Home"
            className="mx-auto mb-5 block w-fit transition-opacity hover:opacity-90 sm:mb-6"
          >
            <Logo height={32} className="sm:hidden" />
            <Logo height={36} className="hidden sm:block" />
          </Link>

          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 shadow-[0_24px_60px_-30px_rgba(15,80,30,0.15)] sm:p-7">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
