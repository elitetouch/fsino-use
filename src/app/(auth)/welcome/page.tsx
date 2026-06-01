'use client';

import Link from 'next/link';
import { ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Verification successful — mirrors the green-fullscreen confirmation
 * in the mobile design. Gives the user one clear next action: set up
 * their farm. No back link, no clutter.
 */
export default function WelcomePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-between px-6 py-12 text-center text-white"
      style={{
        background:
          'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
      }}
    >
      <div aria-hidden />

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/15 backdrop-blur">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)]">
            <ThumbsUp className="h-10 w-10" strokeWidth={2.4} />
          </div>
        </div>

        <h1 className="mt-8 text-[28px] font-extrabold tracking-tight">
          Verification successful
        </h1>
        <p className="mt-3 max-w-xs text-base leading-relaxed text-white/90">
          Welcome to the farmer community. Let&rsquo;s set up your farm,
          pens and flocks — three quick steps and you&rsquo;re live.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
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
    </main>
  );
}
