'use client';

import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Verification successful.
 *
 * Mobile / tablet: full-screen green confirmation matching the mobile
 *   mockup beat-for-beat — single dominant CTA, "I'll do this later"
 *   underneath.
 *
 * Desktop: the green panel becomes a centered card on a neutral
 *   background so it doesn't dominate a wide monitor. Same content,
 *   gentler visual weight.
 *
 * This page intentionally does NOT use the (auth) layout's sticky
 * header / brand sidebar because the success moment should feel
 * uninterrupted.
 */
export default function WelcomePage() {
  return (
    <main className="min-h-screen bg-[var(--color-brand-bg)] lg:flex lg:items-center lg:justify-center lg:py-10">
      <section
        className={[
          // Mobile/tablet: full-bleed green with internal column spacing
          'flex min-h-screen flex-col items-center justify-between px-6 py-12 text-center text-white',
          // Desktop: centered card with rounded corners and a soft shadow
          'lg:min-h-0 lg:h-auto lg:w-full lg:max-w-2xl lg:rounded-[28px] lg:py-16 lg:shadow-[0_30px_90px_-40px_rgba(15,80,30,0.45)]',
        ].join(' ')}
        style={{
          background:
            'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
        }}
      >
        <div aria-hidden className="lg:hidden" />

        <div className="flex flex-1 flex-col items-center justify-center lg:flex-none">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/15 backdrop-blur lg:h-32 lg:w-32">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] lg:h-24 lg:w-24">
              <ThumbsUp className="h-10 w-10 lg:h-12 lg:w-12" strokeWidth={2.4} />
            </div>
          </div>

          <h1 className="mt-8 text-[28px] font-extrabold tracking-tight lg:text-[34px]">
            Verification successful
          </h1>
          <p className="mt-3 max-w-xs text-base leading-relaxed text-white/90 lg:max-w-md lg:text-[17px]">
            Welcome to the farmer community. Let&rsquo;s set up your farm,
            pens and flocks — three quick steps and you&rsquo;re live.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md lg:mt-12 lg:max-w-sm">
          <Button asChild size="block" variant="secondary">
            <Link href="/setup/farm">Set up my farm</Link>
          </Button>

          <Link
            href="/home"
            className="mt-4 inline-block text-sm font-medium text-white/80 underline-offset-4 hover:underline"
          >
            I&rsquo;ll do this later
          </Link>
        </div>
      </section>
    </main>
  );
}
