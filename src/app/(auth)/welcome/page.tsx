'use client';

import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Verification successful.
 *
 *   320–1023px: full-screen green confirmation (mobile mockup).
 *   1024–1535px: centered card with rounded corners on neutral bg.
 *   1536–1919px: same card, more breathing room, larger thumbs-up.
 *   ≥1920px: card stays centered; bg fills uniformly via the same
 *     gradient frame the rest of the app uses, so the page never
 *     "ends" awkwardly on 4K.
 *
 * No (auth) layout wrap — success moment is deliberately uninterrupted.
 */
export default function WelcomePage() {
  return (
    <main
      className="relative min-h-screen w-full"
      style={{
        background:
          'linear-gradient(160deg, #0a4d24 0%, #062c0d 100%)',
      }}
    >
      <div className="flex min-h-screen w-full items-center justify-center px-4 py-10 sm:px-8 lg:py-16">
        <section
          className={[
            // Mobile: full-bleed green panel with mockup composition
            'flex w-full min-h-[calc(100vh-5rem)] flex-col items-center justify-between px-6 py-12 text-center text-white sm:min-h-[calc(100vh-8rem)] sm:max-w-xl sm:rounded-[28px] sm:px-10 sm:shadow-[0_30px_90px_-40px_rgba(15,80,30,0.6)]',
            // Desktop+: constrained card with shadow
            'lg:min-h-0 lg:w-full lg:max-w-2xl lg:py-20',
            'xl:max-w-3xl xl:py-24',
            '3xl:max-w-[900px] 3xl:py-28',
          ].join(' ')}
          style={{
            background:
              'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
          }}
        >
          {/* Decorative mesh */}
          <div className="relative w-full">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(60% 50% at 50% 30%, rgba(167, 243, 194, 0.22) 0%, transparent 70%)',
              }}
            />
          </div>

          <div aria-hidden className="lg:hidden" />

          <div className="flex flex-1 flex-col items-center justify-center lg:flex-none">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/15 backdrop-blur lg:h-36 lg:w-36 xl:h-40 xl:w-40">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] lg:h-28 lg:w-28 xl:h-32 xl:w-32">
                <ThumbsUp className="h-10 w-10 lg:h-14 lg:w-14 xl:h-16 xl:w-16" strokeWidth={2.4} />
              </div>
            </div>

            <h1
              className="mt-8 font-extrabold tracking-tight lg:mt-12"
              style={{ fontSize: 'var(--text-hero)' }}
            >
              Verification successful
            </h1>
            <p
              className="mt-4 max-w-[42ch] leading-relaxed text-white/90"
              style={{ fontSize: 'var(--text-lead)' }}
            >
              Welcome to the farmer community. Let&rsquo;s set up your farm,
              pens and flocks — three quick steps and you&rsquo;re live.
            </p>
          </div>

          <div className="mx-auto mt-10 w-full max-w-md lg:mt-16 lg:max-w-sm xl:max-w-md">
            <Button asChild size="block" variant="secondary" className="xl:h-16 xl:text-lg">
              <Link href="/setup/farm">Set up my farm</Link>
            </Button>

            <Link
              href="/home"
              className="mt-4 inline-block text-sm font-medium text-white/80 underline-offset-4 hover:underline xl:text-base"
            >
              I&rsquo;ll do this later
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
