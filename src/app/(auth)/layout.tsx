import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { brand } from '@/config/brand';

/**
 * Auth-flow shell.
 *
 * Mobile / tablet (<lg): sticky compact header with a back arrow and a
 *   small brand logo. Form fills the column.
 *
 * Desktop (≥lg): two-column split. Left = brand panel (gradient hero
 *   with the logo and a short value-prop list). Right = the form,
 *   centered on a white card. Keeps the experience cohesive with the
 *   marketing/start screen and stops the auth pages from looking like
 *   a thin column on a wide monitor.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[var(--color-brand-bg)] lg:grid-cols-[1fr_1.1fr]">
      {/* Mobile/tablet header — hidden on lg+ in favour of the side panel. */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-brand-border)]/70 bg-white/85 px-5 py-3 backdrop-blur lg:hidden">
        <Link
          href="/"
          aria-label="Back"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-accent)]/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Logo size={92} />
        <span className="h-10 w-10" aria-hidden />
      </header>

      {/* Desktop-only brand panel — left side of the split. */}
      <aside
        className="relative hidden flex-col justify-between p-12 text-white lg:flex"
        style={{
          background:
            'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
        }}
      >
        <Link href="/" aria-label="Home">
          <Logo size={160} tone="white" />
        </Link>

        <div className="max-w-md">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {brand.tagline}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-white/85">
            One app for every flock. Track feed, vaccines, and finances in
            minutes a day — built with African poultry farmers, for African
            poultry farmers.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            {[
              'Daily records on the phone you already own',
              'Country-tuned vaccination programmes',
              'Real cost-per-bird and feed conversion',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 inline-block h-2 w-2 rounded-full bg-white/90"
                />
                <span className="text-white/90">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
          © {new Date().getFullYear()} {brand.name}
        </p>

        {/* Subtle dot grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
      </aside>

      {/* Form column */}
      <section className="flex flex-col">
        <div className="mx-auto w-full max-w-md flex-1 px-5 py-8 sm:py-12 lg:flex lg:items-center lg:justify-center lg:px-12 lg:py-16">
          <div className="w-full">{children}</div>
        </div>
      </section>
    </main>
  );
}
