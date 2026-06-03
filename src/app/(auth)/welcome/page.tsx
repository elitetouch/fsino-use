'use client';

import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { canCreateFarm, endpoints } from '@/lib/api';

/**
 * Welcome / verification successful — a celebratory moment.
 *
 * Light theme to match the rest of the auth flow, with an animated
 * checkmark medallion as the focal point. Concentric pulse rings give
 * a quiet "ta-da" without confetti chaos.
 *
 * Two branches based on whether the freshly-verified user already
 * belongs to a farm:
 *
 *  - Zero memberships  → normal first-time-owner flow: nudge them to
 *                        the 3-step setup with the "Set up my farm" CTA.
 *
 *  - One+ memberships  → this is an invited staff member who just
 *                        verified. Showing them a "Set up my farm"
 *                        button is wrong: they joined an existing
 *                        farm, and the backend's CreateFarmRequest
 *                        authorize() will 403 them anyway. So we
 *                        instead route them straight to the dashboard
 *                        and tweak the copy to welcome them to the
 *                        farm they joined.
 *
 * (The backend authorisation in CreateFarmRequest is the authoritative
 * line — this page just makes the UI honest about it.)
 */
export default function WelcomePage() {
  const farms = useQuery({
    queryKey: ['farms'],
    queryFn: () => endpoints.listFarms(),
    staleTime: 30_000,
  });

  // Mirror the backend's CreateFarmRequest::authorize() policy. If they
  // can't create, they're either invited staff or a member-only user
  // — show them the dashboard CTA instead of leading them to a 403.
  const allowedToSetUp = canCreateFarm(farms.data?.farms);
  const hasMemberships = (farms.data?.farms.length ?? 0) > 0;
  const firstFarmName = farms.data?.farms[0]?.name;

  return (
    <div className="text-center">
      {/* Animated checkmark medallion with pulse rings */}
      <div className="relative mx-auto flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
        {/* Outer pulse rings */}
        <span
          aria-hidden
          className="animate-pulse-ring absolute inset-0 rounded-full bg-[var(--color-brand-primary)]/20"
        />
        <span
          aria-hidden
          className="animate-pulse-ring [animation-delay:0.7s] absolute inset-0 rounded-full bg-[var(--color-brand-primary)]/15"
        />

        {/* The medallion */}
        <div className="animate-scale-in relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] shadow-[0_20px_40px_-15px_rgba(15,80,30,0.45)] sm:h-28 sm:w-28">
          <Check className="h-12 w-12 text-white sm:h-14 sm:w-14" strokeWidth={3} />
        </div>
      </div>

      <h1
        className="mt-10 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        You&rsquo;re verified
      </h1>

      {farms.isLoading ? (
        <p className="mt-6 inline-flex items-center gap-2 text-[var(--color-brand-muted)]" style={{ fontSize: 'var(--text-lead)' }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your farms…
        </p>
      ) : hasMemberships || !allowedToSetUp ? (
        <>
          <p
            className="mt-3 leading-relaxed text-[var(--color-brand-muted)]"
            style={{ fontSize: 'var(--text-lead)' }}
          >
            Welcome aboard.{' '}
            {firstFarmName ? (
              <>You now have access to <strong className="text-[var(--color-brand-fg)]">{firstFarmName}</strong>.</>
            ) : (
              <>You now have access to your farm.</>
            )}{' '}
            Let&rsquo;s take you to the dashboard.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button asChild size="block">
              <Link href="/home">Go to dashboard</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <p
            className="mt-3 leading-relaxed text-[var(--color-brand-muted)]"
            style={{ fontSize: 'var(--text-lead)' }}
          >
            Welcome to the farmer community. Let&rsquo;s set up your farm, pens
            and flocks — three quick steps and you&rsquo;re live.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Button asChild size="block">
              <Link href="/setup/farm">Set up my farm</Link>
            </Button>
            <Link
              href="/home"
              className="text-sm font-medium text-[var(--color-brand-muted)] underline-offset-4 hover:underline"
            >
              I&rsquo;ll do this later
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
