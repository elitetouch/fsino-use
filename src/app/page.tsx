'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { readToken } from '@/lib/auth';
import { brand } from '@/config/brand';

/**
 * Start screen — the marketing landing that doubles as the auth gateway.
 *
 * Layout strategy:
 *   - 320–1023px : mobile-app shape — full-bleed green hero, white CTA
 *                  sheet rounded over the top. Matches the mobile mockup.
 *   - 1024–1535px: two-column split, brand panel left with a trust
 *                  strip, CTA card right.
 *   - 1536–1919px: same split with extra depth — bigger logo, more
 *                  trust tiles, richer headline.
 *   - ≥1920px    : whole page is capped to --container-page (1760px)
 *                  and centered. Side margins fill in with the green
 *                  brand tone so 4K/ultrawide monitors don't sprawl.
 *
 * Type uses fluid clamp() tokens (text-hero / text-lead) so headlines
 * grow smoothly with viewport instead of jumping at each breakpoint.
 */
export default function StartPage() {
  const router = useRouter();

  useEffect(() => {
    if (readToken()) router.replace('/home');
  }, [router]);

  return (
    // Page-level wrapper — green on the outside, capped container in the middle.
    // On ultrawide monitors the green "frames" the centered content.
    <main
      className="relative min-h-screen w-full"
      style={{
        background:
          'linear-gradient(160deg, #0f7c39 0%, #0a4d24 60%, #062c0d 100%)',
      }}
    >
      <div
        className="relative mx-auto grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr] xl:grid-cols-[1.15fr_1fr]"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* ──────────────────────── BRAND HERO ──────────────────────── */}
        <section
          className="relative flex flex-col items-center justify-center overflow-hidden px-6 pt-16 pb-20 text-center sm:px-10 sm:pt-20 lg:px-12 lg:pt-0 lg:pb-0 xl:px-20"
          style={{
            background:
              'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
          }}
        >
          {/* Decorative mesh — subtle radial spots add depth without
              becoming busy. Sits behind everything via z-0. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: `
                radial-gradient(50% 35% at 18% 12%, rgba(167, 243, 194, 0.22) 0%, transparent 60%),
                radial-gradient(45% 30% at 85% 85%, rgba(255, 255, 255, 0.12) 0%, transparent 65%)
              `,
            }}
          />
          {/* Dot grain over the mesh — warmth */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <Logo
              tone="white"
              size={140}
              className="lg:!w-[170px] xl:!w-[200px] 3xl:!w-[220px]"
            />

            <h1
              className="mt-10 max-w-[28ch] font-extrabold leading-[1.1] tracking-tight text-white lg:mt-12"
              style={{ fontSize: 'var(--text-hero)' }}
            >
              {brand.tagline}
            </h1>

            <p
              className="mt-4 max-w-[40ch] leading-relaxed text-white/85 lg:mt-5"
              style={{ fontSize: 'var(--text-lead)' }}
            >
              {brand.subtagline}. From day-one chicks to sale day, one app
              tracks every flock, every feed bag, every naira.
            </p>

            {/* Trust strip — appears on lg+ to fill the hero with substance. */}
            <div className="mt-10 hidden w-full max-w-md grid-cols-2 gap-3 text-left text-xs lg:grid xl:mt-12 xl:max-w-lg xl:gap-4 xl:text-sm 3xl:max-w-xl">
              {TRUST_TILES.map((tile) => (
                <div
                  key={tile.title}
                  className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-sm xl:p-5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85 xl:text-xs">
                    {tile.title}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-snug text-white/75 xl:text-[13px]">
                    {tile.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Country pills — bottom of hero at xl+. Shows reach + builds trust. */}
            <div className="mt-10 hidden flex-wrap items-center justify-center gap-2 xl:flex">
              {['NG', 'KE', 'GH', 'EG', 'CM', 'CI', 'ZA'].map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/80"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────────────────── CTA PANEL ──────────────────────── */}
        <section
          className={[
            // Mobile/tablet: white sheet sliding over the green hero with rounded top corners.
            '-mt-8 rounded-t-[32px] bg-white px-6 pb-14 pt-10 shadow-[0_-20px_60px_-30px_rgba(15,80,30,0.35)] sm:px-10 sm:pt-12',
            // Desktop: full column, plain white, no negative margin or rounded edges.
            'lg:relative lg:mt-0 lg:flex lg:flex-col lg:items-center lg:justify-center lg:rounded-none lg:px-12 lg:py-0 lg:shadow-none',
            'xl:px-20',
          ].join(' ')}
        >
          {/* Subtle desktop-only depth — a hint of mint near the top edge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden lg:block"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 0%, rgba(167, 243, 194, 0.18) 0%, transparent 70%)',
            }}
          />

          <div className="relative mx-auto w-full max-w-md space-y-5 lg:max-w-sm xl:max-w-md">
            {/* Desktop-only inline headline */}
            <div className="hidden text-center lg:mb-3 lg:block">
              <h2
                className="font-extrabold tracking-tight text-[var(--color-brand-fg)]"
                style={{ fontSize: 'var(--text-h2)' }}
              >
                Get started
              </h2>
              <p className="mt-2 text-sm text-[var(--color-brand-muted)] xl:text-base">
                Two minutes, then your first flock is live.
              </p>
            </div>

            <Button asChild size="block" className="xl:h-16 xl:text-lg">
              <Link href="/register">
                Create account
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>

            {/* What you get — bulleted, appears desktop-only so the
                mobile sheet stays close to the mockup. */}
            <ul className="hidden space-y-2 pt-2 text-sm text-[var(--color-brand-muted)] lg:block xl:text-[15px]">
              {WHAT_YOU_GET.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-primary)]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3 text-center">
              <p className="text-[15px] text-[var(--color-brand-muted)] xl:text-base">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-[var(--color-brand-primary)] hover:underline"
                >
                  Log in
                </Link>
              </p>
            </div>

            <div className="pt-1 text-center">
              <Link
                href="/explore"
                className="text-sm font-medium text-[var(--color-brand-muted)] underline-offset-4 hover:underline xl:text-[15px]"
              >
                Explore Farmspeak
              </Link>
            </div>
          </div>

          <p className="mt-12 text-center text-[11px] uppercase tracking-[0.22em] text-[var(--color-brand-muted)] lg:absolute lg:bottom-6 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2">
            © {new Date().getFullYear()} {brand.name}
          </p>
        </section>
      </div>
    </main>
  );
}

const TRUST_TILES = [
  { title: 'Track every flock', desc: 'From day-one chicks to sale day.' },
  { title: 'Spend less on feed', desc: 'See your true cost per bird.' },
  { title: 'Never miss a vaccine', desc: 'Smart reminders, country-tuned.' },
  { title: 'Built for Africa', desc: 'Seven countries and counting.' },
];

const WHAT_YOU_GET = [
  'Daily feed, water and bird-count logs',
  'Country-tuned vaccination programmes',
  'Real cost-per-bird, FCR and margin tracking',
];
