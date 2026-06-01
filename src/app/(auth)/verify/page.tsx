'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { apiErrorMessage, endpoints } from '@/lib/api';
import { readUser, writeUser } from '@/lib/auth';

const CODE_LENGTH = 4;

/**
 * Verify-phone screen — the user has already registered and we sent a
 * 4-digit OTP via SMS. They enter it here. A 60s countdown gates the
 * Resend button so impatient taps don't burn through provider credits.
 */
export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(60);

  // Pull the phone from the locally-stored user so we can mask it in the UI.
  useEffect(() => {
    const u = readUser();
    setPhone(u?.phone ?? null);
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSeconds]);

  const verify = useMutation({
    mutationFn: (c: string) => endpoints.verifyCode(c, 'phone'),
    onSuccess: (res) => {
      const existing = readUser();
      writeUser({
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        phone: res.user.phone ?? existing?.phone ?? null,
        emailVerifiedAt: res.user.emailVerifiedAt ?? existing?.emailVerifiedAt ?? null,
        phoneVerifiedAt: res.user.phoneVerifiedAt ?? new Date().toISOString(),
      });
      router.push('/welcome');
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'That code did not work.'));
      setCode('');
    },
  });

  const resend = useMutation({
    mutationFn: () => endpoints.resendVerificationCode('phone'),
    onSuccess: () => {
      toast.success('A fresh code is on the way.');
      setResendSeconds(60);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not resend the code.')),
  });

  // Auto-submit the moment the user finishes typing all digits.
  useEffect(() => {
    if (code.length === CODE_LENGTH && !verify.isPending) {
      verify.mutate(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div>
      <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
        Verify phone number
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-brand-muted)]">
        Enter the {CODE_LENGTH}-digit code we sent to{' '}
        <strong className="text-[var(--color-brand-fg)]">{maskPhone(phone)}</strong>{' '}
        via SMS.
      </p>

      <div className="mt-10">
        <OtpInput value={code} onChange={setCode} length={CODE_LENGTH} disabled={verify.isPending} />
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
            {resend.isPending ? 'Sending…' : 'Resend OTP'}
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
    </div>
  );
}

/**
 * Show only the last 3 digits of the phone number so the user can confirm
 * it's the right device without exposing it on a shoulder-surf-able screen.
 */
function maskPhone(p: string | null): string {
  if (!p) return 'your phone';
  const digits = p.replace(/\D/g, '');
  if (digits.length < 4) return p;
  return `••• ${digits.slice(-3)}`;
}
