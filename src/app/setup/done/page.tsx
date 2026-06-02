'use client';

import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetupStepper } from '@/components/setup/stepper';

/**
 * Setup complete — the post-onboarding "You're all set" moment.
 * Mirrors the mobile mockup's green-card confirmation but lives inside
 * the same centered-card pattern as the rest of the setup flow for
 * visual consistency.
 */
export default function SetupDonePage() {
  return (
    <div className="text-center">
      <SetupStepper current="done" />

      <div className="mx-auto flex h-24 w-24 items-center justify-center">
        <div className="relative">
          <span className="animate-pulse-ring absolute inset-0 rounded-full bg-[var(--color-brand-primary)]/20" />
          <span className="animate-pulse-ring [animation-delay:0.7s] absolute inset-0 rounded-full bg-[var(--color-brand-primary)]/15" />
          <div className="animate-scale-in relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] text-white shadow-[0_20px_40px_-15px_rgba(15,80,30,0.45)]">
            <CheckCircle2 className="h-12 w-12" strokeWidth={2.4} />
          </div>
        </div>
      </div>

      <h1
        className="mt-8 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        You&rsquo;re all set
      </h1>
      <p
        className="mt-3 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        Farm, pens and your first flock are live. From now on, every feed
        bag, vaccine and weigh-in you log goes into a real cost-per-bird picture.
      </p>

      <Button asChild size="block" className="mt-8">
        <Link href="/home">
          Open my dashboard
          <ArrowRight className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  );
}
