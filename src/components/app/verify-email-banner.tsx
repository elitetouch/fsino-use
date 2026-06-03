'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Mail, ArrowRight, ShieldAlert } from 'lucide-react';
import { readUser } from '@/lib/auth';

/**
 * Verify-email banner.
 *
 * Sits at the top of the authenticated app shell whenever the current
 * user's `emailVerifiedAt` is null. Fixes the bug where a user could
 * abandon the OTP step during registration, log out, log back in, and
 * silently land in the app fully unverified — there was nothing
 * reminding them, and they could chip away at trust-sensitive flows
 * (invoices, recovery, etc.) with an unverified address.
 *
 * Re-evaluates on every route change (cheap — just reads localStorage)
 * so the banner disappears as soon as the user comes back from `/verify`
 * with a fresh user blob written.
 *
 * Hidden on the verify page itself (no point nagging once they're on
 * the form) and during server render (hydration-safe).
 */
export function VerifyEmailBanner() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const u = readUser();
    setPending(!!u && !u.emailVerifiedAt);
  }, [pathname]);

  if (!pending) return null;
  if (pathname?.startsWith('/verify')) return null;

  return (
    <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-amber-50 to-amber-100/60">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-700">
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-tight text-amber-900">
            Please verify your email address
          </p>
          <p className="hidden text-[11.5px] leading-tight text-amber-800/80 sm:block">
            You haven&rsquo;t confirmed your email yet. Verifying secures your account and unlocks password recovery.
          </p>
        </div>
        <Link
          href="/verify"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
        >
          <Mail className="h-3 w-3" />
          <span className="hidden sm:inline">Verify now</span>
          <span className="sm:hidden">Verify</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
