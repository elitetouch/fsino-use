'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { apiErrorMessage, endpoints } from '@/lib/api';
import { readUser, writeUser } from '@/lib/auth';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

/**
 * Verify-email screen.
 *
 * Wired to POST /api/v1/auth/verify-email (authenticated). The backend
 * mails a 6-digit code via EmailVerificationCodeMail; the same code is
 * what the user types here. We re-trigger by hitting
 * /api/v1/auth/resend-verification-code (empty body — server already
 * knows the bearer's user). A client-side 60s cooldown keeps impatient
 * taps from burning through SMTP credits.
 */
export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    const u = readUser();
    setEmail(u?.email ?? null);
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const verify = useMutation({
    mutationFn: (c: string) => endpoints.verifyEmail(c),
    onSuccess: (res) => {
      const existing = readUser();
      writeUser({
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        phone: res.user.phone ?? existing?.phone ?? null,
        emailVerifiedAt:
          res.user.emailVerifiedAt ?? new Date().toISOString(),
        phoneVerifiedAt: res.user.phoneVerifiedAt ?? existing?.phoneVerifiedAt ?? null,
      });
      router.push('/welcome');
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'That code did not work.'));
      setCode('');
    },
  });

  const resend = useMutation({
    mutationFn: () => endpoints.resendVerificationCode(),
    onSuccess: () => {
      toast.success('A fresh code is on the way.');
      setResendSeconds(RESEND_COOLDOWN);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not resend the code.')),
  });

  // Auto-submit when the user finishes typing all 6 digits.
  useEffect(() => {
    if (code.length === CODE_LENGTH && !verify.isPending) {
      verify.mutate(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div>
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-accent)]/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-brand-primary-dark)]">
        <Mail className="h-3.5 w-3.5" />
        Email verification
      </div>

      <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
        Verify your email
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-brand-muted)]">
        We sent a {CODE_LENGTH}-digit code to{' '}
        <strong className="text-[var(--color-brand-fg)]">{maskEmail(email)}</strong>.
        Enter it below to confirm your account.
      </p>

      <div className="mt-10">
        <OtpInput
          value={code}
          onChange={setCode}
          length={CODE_LENGTH}
          disabled={verify.isPending}
        />
      </div>

      <div className="mt-7 text-center text-sm">
        {resendSeconds > 0 ? (
          <p className="text-[var(--color-brand-muted)]">
            Didn&rsquo;t receive a code?{' '}
            <span className="font-medium text-[var(--color-brand-fg)]">
              Resend in {resendSeconds}s
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
            className="text-sm font-semibold text-[var(--color-brand-primary)] hover:underline disabled:opacity-60"
          >
            {resend.isPending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </div>

      <Button
        type="button"
        size="block"
        className="mt-8"
        disabled={code.length !== CODE_LENGTH || verify.isPending}
        onClick={() => verify.mutate(code)}
      >
        {verify.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
        Verify
      </Button>

      <p className="mt-6 text-center text-xs text-[var(--color-brand-muted)]">
        Wrong email? Sign out and{' '}
        <a href="/register" className="font-medium text-[var(--color-brand-primary)] hover:underline">
          create a new account
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Mask an email so the user can confirm it's the right address without
 * exposing it to a shoulder-surfer. `samuel.okoro@farms.ng` → `s••••@farms.ng`.
 */
function maskEmail(e: string | null): string {
  if (!e) return 'your email';
  const at = e.indexOf('@');
  if (at <= 1) return e;
  const local = e.slice(0, at);
  const domain = e.slice(at);
  return `${local[0]}${'•'.repeat(Math.min(local.length - 1, 5))}${domain}`;
}
