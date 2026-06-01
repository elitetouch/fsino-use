'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { readToken } from '@/lib/auth';
import { brand } from '@/config/brand';

/**
 * Start screen — first thing a farmer sees.
 *
 * Mobile / tablet (<lg): mirrors the mobile app — full-bleed green
 *   gradient hero with logo and tagline, white CTA panel sliding over
 *   the bottom with rounded top corners.
 *
 * Desktop (≥lg): same brand panel becomes a fixed left column;
 *   the white CTA panel becomes a centered card on the right so the
 *   page reads like a marketing landing instead of a stretched
 *   mobile screen.
 */
export default function StartPage() {
  const router = useRouter();

  useEffect(() => {
    if (readToken()) router.replace('/home');
  }, [router]);

  return (
    <main className="relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Brand hero — gradient runs from vivid kelly green to deep forest. */}
      <section
        className="relative flex flex-col items-center justify-center px-6 pt-16 pb-20 text-center lg:px-12 lg:pt-0 lg:pb-0"
        style={{
          background:
            'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
        }}
      >
        <Logo
          size={140}
          tone="white"
          className="lg:!w-[180px]"
        />

        <h1 className="mt-10 max-w-md text-[28px] font-extrabold leading-[34px] tracking-tight text-white sm:text-[32px] sm:leading-[40px] lg:mt-12 lg:text-[40px] lg:leading-[48px]">
          {brand.tagline}
        </h1>

        <p className="mt-3 max-w-sm text-base leading-relaxed text-white/85 lg:mt-5 lg:max-w-md lg:text-[17px]">
          {brand.subtagline}
        </p>

        {/* Desktop-only trust strip — gives the empty bottom of the panel something to say. */}
        <div className="mt-10 hidden max-w-md grid-cols-2 gap-3 text-left text-xs lg:grid">
          {[
            ['Track every flock', 'From day 1 to sale day.'],
            ['Spend less on feed', 'See your true cost per bird.'],
            ['Never miss a vaccine', 'Smart reminders, country-tuned.'],
            ['Built in Africa', 'NG · KE · GH · CM · CI · EG · ZA'],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
                {title}
              </p>
              <p className="mt-1 text-[12px] leading-tight text-white/75">{desc}</p>
            </div>
          ))}
        </div>

        {/* Decorative dot grain — subtle warmth on the green. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
      </section>

      {/* CTA panel:
          - mobile: slides up over the hero with rounded top corners (mobile-app feel)
          - desktop: standalone column centered next to the brand panel */}
      <section
        className={[
          // Mobile: hover over the hero like a sheet
          '-mt-8 rounded-t-[32px] bg-white px-6 pb-12 pt-10 shadow-[0_-20px_60px_-30px_rgba(15,80,30,0.35)]',
          // Desktop: full column, plain background, no shadow trick
          'lg:mt-0 lg:flex lg:flex-col lg:items-center lg:justify-center lg:rounded-none lg:px-12 lg:py-0 lg:shadow-none',
        ].join(' ')}
      >
        <div className="mx-auto w-full max-w-md space-y-4 lg:max-w-sm">
          {/* Desktop-only headline above the buttons */}
          <div className="hidden text-center lg:mb-2 lg:block">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-brand-fg)]">
              Get started
            </h2>
            <p className="mt-1 text-sm text-[var(--color-brand-muted)]">
              Two minutes, then your first flock is live.
            </p>
          </div>

          <Button asChild size="block">
            <Link href="/register">Create account</Link>
          </Button>

          <p className="text-center text-[15px] text-[var(--color-brand-muted)]">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold text-[var(--color-brand-primary)] hover:underline"
            >
              Log in
            </Link>
          </p>

          <div className="pt-2 text-center">
            <Link
              href="/explore"
              className="text-sm font-medium text-[var(--color-brand-muted)] underline-offset-4 hover:underline"
            >
              Explore Farmspeak
            </Link>
          </div>
        </div>

        <p className="mt-10 text-center text-[11px] uppercase tracking-[0.2em] text-[var(--color-brand-muted)] lg:absolute lg:bottom-6 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2">
          © {new Date().getFullYear()} {brand.name}
        </p>
      </section>
    </main>
  );
}
