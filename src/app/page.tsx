'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { readToken } from '@/lib/auth';
import { brand } from '@/config/brand';

/**
 * Start screen — first thing a farmer sees. Mirrors the mobile mockup
 * almost beat-for-beat: brand-green hero band with the logo, generous
 * headline, single dominant CTA, secondary "log in" + tertiary "explore"
 * link. Optimised for thumbs.
 */
export default function StartPage() {
  const router = useRouter();

  // If the user is already signed in, fast-forward into the app.
  useEffect(() => {
    if (readToken()) router.replace('/home');
  }, [router]);

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Brand hero — gradient runs from vivid kelly green to deep forest. */}
      <section
        className="relative flex flex-1 flex-col items-center justify-center px-6 pt-16 pb-12 text-center"
        style={{
          background:
            'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
        }}
      >
        <Logo size={140} tone="white" />

        <h1 className="mt-10 max-w-md text-[28px] font-extrabold leading-[34px] tracking-tight text-white sm:text-[32px] sm:leading-[40px]">
          {brand.tagline}
        </h1>

        <p className="mt-3 max-w-sm text-base leading-relaxed text-white/85">
          {brand.subtagline}
        </p>

        {/* Decorative grain — subtle dot lattice for warmth on the green. */}
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

      {/* CTA panel — white card sliding over the hero, mobile-app feel. */}
      <section className="-mt-8 rounded-t-[32px] bg-white px-6 pb-12 pt-10 shadow-[0_-20px_60px_-30px_rgba(15,80,30,0.35)]">
        <div className="mx-auto w-full max-w-md space-y-4">
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
      </section>
    </main>
  );
}
