'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { readToken } from '@/lib/auth';
import { brand } from '@/config/brand';

/**
 * Start screen.
 *
 * Layout strategy:
 *   < md (≤767px)   : full-bleed green hero with a white CTA sheet
 *                     sliding up over the bottom (mobile mockup look).
 *   md ≥ (≥768px)   : split layout — brand panel left, form panel right.
 *                     The split kicks in at md (not lg) so iPad-class
 *                     viewports never see an empty white half-screen.
 *   ≥ 1920px        : page caps to --container-page (1760px) and centers,
 *                     deep-forest frame on either side so 4K monitors
 *                     don't sprawl.
 *
 * Composition philosophy:
 *   - one focal headline per column (not three)
 *   - one primary CTA per column (not three)
 *   - decoration earns its place via subtle gradient mesh + dot grain
 *   - trust footer is country pills only — concrete, not marketing
 */
export default function StartPage() {
  const router = useRouter();

  useEffect(() => {
    if (readToken()) router.replace('/home');
  }, [router]);

  return (
    <main
      className="relative min-h-screen w-full"
      style={{
        background:
          'linear-gradient(160deg, #0f7c39 0%, #0a4d24 60%, #062c0d 100%)',
      }}
    >
      <div
        className="relative mx-auto grid min-h-screen w-full md:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.15fr_1fr]"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* ──────────────── BRAND HERO ──────────────── */}
        <section
          className="relative flex flex-col justify-between overflow-hidden px-6 pt-12 pb-24 text-center md:px-10 md:py-12 md:text-left lg:px-14 lg:py-16 xl:px-20 xl:py-20 3xl:px-24"
          style={{
            background:
              'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
          }}
        >
          {/* Mesh overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(50% 35% at 18% 12%, rgba(167, 243, 194, 0.22) 0%, transparent 60%),
                radial-gradient(40% 28% at 85% 88%, rgba(255, 255, 255, 0.10) 0%, transparent 65%)
              `,
            }}
          />
          {/* Dot grain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          {/* TOP: logo */}
          <div className="relative z-10 flex items-center justify-center md:justify-start">
            <Logo
              tone="white"
              size={120}
              className="md:!w-[140px] lg:!w-[160px] xl:!w-[190px] 3xl:!w-[210px]"
            />
          </div>

          {/* MIDDLE: headline */}
          <div className="relative z-10 mx-auto flex max-w-md flex-col items-center text-center md:mx-0 md:items-start md:text-left">
            <h1
              className="font-extrabold leading-[1.05] tracking-tight text-white"
              style={{ fontSize: 'var(--text-hero)' }}
            >
              {brand.tagline}
            </h1>
            <p
              className="mt-5 max-w-[36ch] leading-relaxed text-white/85"
              style={{ fontSize: 'var(--text-lead)' }}
            >
              One app for every flock. Track feed, vaccines and finances in
              minutes a day — built with African poultry farmers, for African
              poultry farmers.
            </p>
          </div>

          {/* BOTTOM: trust footer */}
          <div className="relative z-10 mt-10 flex flex-col items-center gap-4 md:items-start">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
                Trusted across
              </span>
              {['NG', 'KE', 'GH', 'EG', 'CM', 'CI', 'ZA'].map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-white/20 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/85"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
              © {new Date().getFullYear()} {brand.name}
            </p>
          </div>
        </section>

        {/* ──────────────── CTA PANEL ──────────────── */}
        <section
          className={[
            // Mobile (<md): white sheet sliding over hero with rounded top.
            '-mt-10 rounded-t-[32px] bg-white px-6 pb-14 pt-10 shadow-[0_-20px_60px_-30px_rgba(15,80,30,0.35)]',
            // Tablet/desktop: full column, plain background, no slide trick.
            'md:relative md:mt-0 md:flex md:flex-col md:items-center md:justify-center md:rounded-none md:px-10 md:py-12 md:shadow-none',
            'lg:px-14 xl:px-20 3xl:px-24',
          ].join(' ')}
        >
          {/* Soft mint tint along the top edge — desktop-only depth. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 hidden h-64 md:block"
            style={{
              background:
                'radial-gradient(80% 100% at 50% 0%, rgba(167, 243, 194, 0.20) 0%, transparent 70%)',
            }}
          />

          <div className="relative mx-auto w-full max-w-md md:max-w-sm xl:max-w-md 3xl:max-w-lg">
            {/* Eyebrow */}
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-brand-primary)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-brand-muted)]">
                Get started
              </p>
            </div>

            <h2
              className="font-extrabold leading-tight tracking-tight text-[var(--color-brand-fg)]"
              style={{ fontSize: 'var(--text-h1)' }}
            >
              Create your account
            </h2>
            <p
              className="mt-2 max-w-sm text-[var(--color-brand-muted)]"
              style={{ fontSize: 'var(--text-lead)' }}
            >
              Two minutes from here, your first flock is live and counted.
            </p>

            <div className="mt-8 space-y-3">
              <Button asChild size="block" className="xl:h-[60px] xl:text-[17px]">
                <Link href="/register">
                  Create account
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="block" className="xl:h-[60px] xl:text-[17px]">
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>

            <p className="mt-8 text-center text-sm text-[var(--color-brand-muted)] md:text-left">
              Want a tour first?{' '}
              <Link
                href="/explore"
                className="font-semibold text-[var(--color-brand-primary)] underline-offset-4 hover:underline"
              >
                Explore Farmspeak
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
