'use client';

import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Verification successful.
 *
 * Full-bleed green on every viewport — no card constraint, even on
 * desktop. A success moment should feel triumphant, not boxed in.
 *
 * Composition is built around a single hero element (the thumbs-up
 * medallion) with massive type below and one obvious CTA. Radiating
 * concentric rings behind the medallion add quiet celebration without
 * being noisy.
 */
export default function WelcomePage() {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-6 py-12 text-center text-white sm:px-10 md:py-16 lg:py-20 xl:py-24"
      style={{
        background:
          'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
      }}
    >
      {/* Mesh + grain overlays */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(50% 35% at 18% 12%, rgba(167, 243, 194, 0.22) 0%, transparent 60%),
            radial-gradient(45% 30% at 85% 88%, rgba(255, 255, 255, 0.10) 0%, transparent 65%)
          `,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Top spacer so middle-content is properly vertically centered */}
      <div aria-hidden />

      {/* CENTER — celebration */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Radiating concentric rings behind the medallion */}
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className="absolute h-[260px] w-[260px] rounded-full border border-white/10 md:h-[320px] md:w-[320px] lg:h-[400px] lg:w-[400px]"
          />
          <div
            aria-hidden
            className="absolute h-[200px] w-[200px] rounded-full border border-white/15 md:h-[240px] md:w-[240px] lg:h-[300px] lg:w-[300px]"
          />
          <div
            aria-hidden
            className="absolute h-[150px] w-[150px] rounded-full border border-white/20 md:h-[180px] md:w-[180px] lg:h-[220px] lg:w-[220px]"
          />

          {/* The medallion itself */}
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/15 backdrop-blur md:h-32 md:w-32 lg:h-40 lg:w-40 xl:h-44 xl:w-44">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] md:h-24 md:w-24 lg:h-28 lg:w-28 xl:h-32 xl:w-32">
              <ThumbsUp className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 xl:h-16 xl:w-16" strokeWidth={2.4} />
            </div>
          </div>
        </div>

        <h1
          className="mt-10 max-w-[20ch] font-extrabold leading-[1.05] tracking-tight md:mt-14"
          style={{ fontSize: 'var(--text-hero)' }}
        >
          You&rsquo;re verified
        </h1>
        <p
          className="mt-4 max-w-[42ch] leading-relaxed text-white/85 md:mt-5"
          style={{ fontSize: 'var(--text-lead)' }}
        >
          Welcome to the farmer community. Let&rsquo;s set up your farm, pens
          and flocks — three quick steps and you&rsquo;re live.
        </p>
      </div>

      {/* BOTTOM — single CTA */}
      <div className="relative z-10 mx-auto w-full max-w-md md:max-w-sm xl:max-w-md">
        <Button asChild size="block" variant="secondary" className="xl:h-[60px] xl:text-[17px]">
          <Link href="/setup/farm">Set up my farm</Link>
        </Button>

        <Link
          href="/home"
          className="mt-4 inline-block text-sm font-medium text-white/75 underline-offset-4 hover:underline xl:text-base"
        >
          I&rsquo;ll do this later
        </Link>
      </div>
    </main>
  );
}
