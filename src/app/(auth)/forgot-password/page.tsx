'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { apiErrorMessage, endpoints } from '@/lib/api';

/**
 * Forgotten password — ask for a code, then set a new password.
 *
 * TWO STEPS ON ONE ROUTE, not two pages. The code lands in an email the
 * farmer reads on the same phone, which means leaving the browser and
 * coming back; a second route would be a second chance for the app to
 * reload and lose the email they already typed.
 *
 * WHAT THE COPY CANNOT SAY
 * ------------------------
 * The server answers identically whether or not the address is
 * registered — deliberately, so the endpoint cannot be used to discover
 * who banks here. So this screen must never say "no account with that
 * email", and the confirmation is phrased to be true either way: it
 * describes what happens IF the account exists.
 *
 * That is mildly worse for someone who mistypes their own address, and
 * it is the right trade. The "check your spam folder" line does real
 * work here, because it is the most common reason a code seems not to
 * arrive.
 */

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

const resetSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'The code is 6 digits'),
    password: z.string().min(8, 'Use at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((v) => v.password === v.password_confirmation, {
    message: 'Both passwords must match',
    path: ['password_confirmation'],
  });

type RequestValues = z.infer<typeof requestSchema>;
type ResetValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-[26rem] space-y-5">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>

      {sentTo === null ? (
        <RequestStep onSent={setSentTo} />
      ) : (
        <ResetStep
          email={sentTo}
          onStartOver={() => setSentTo(null)}
          onDone={() => {
            toast.success('Password changed. Sign in with your new password.');
            router.push('/login');
          }}
        />
      )}
    </div>
  );
}

function RequestStep({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const request = useMutation({
    mutationFn: (v: RequestValues) => endpoints.forgotPassword(v.email),
    onSuccess: (_d, v) => onSent(v.email),
    onError: (e) =>
      toast.error(apiErrorMessage(e, "Couldn't send the code. Check your connection.")),
  });

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-6">
      <h1 className="text-[1.25rem] font-extrabold text-[var(--color-brand-fg)]">
        Forgot your password?
      </h1>
      <p className="mt-1 text-[0.84375rem] leading-relaxed text-[var(--color-brand-muted)]">
        Enter the email you signed up with and we&rsquo;ll send a 6-digit code.
      </p>

      <form
        onSubmit={form.handleSubmit((v) => request.mutate(v))}
        className="mt-5 space-y-4"
        noValidate
      >
        <div>
          <Label htmlFor="fp-email">Email address</Label>
          <Input
            id="fp-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="samuel.okoro@farms.ng"
            {...form.register('email')}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={request.isPending}>
          {request.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Send the code
        </Button>
      </form>
    </div>
  );
}

function ResetStep({
  email,
  onStartOver,
  onDone,
}: {
  email: string;
  onStartOver: () => void;
  onDone: () => void;
}) {
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', password: '', password_confirmation: '' },
  });

  const reset = useMutation({
    mutationFn: (v: ResetValues) =>
      endpoints.resetPassword({
        email,
        code: v.code,
        password: v.password,
        password_confirmation: v.password_confirmation,
      }),
    onSuccess: onDone,
    onError: (e) =>
      // The server returns one message for wrong, expired and
      // too-many-tries. Shown as given rather than reinterpreted —
      // guessing which it was would be guessing.
      toast.error(apiErrorMessage(e, 'That code is wrong or has expired. Ask for a new one.')),
  });

  const resend = useMutation({
    mutationFn: () => endpoints.forgotPassword(email),
    onSuccess: () => toast.success('A new code is on its way.'),
    onError: (e) => toast.error(apiErrorMessage(e, "Couldn't send another code.")),
  });

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-6">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <MailCheck className="h-5 w-5" />
      </span>

      <h1 className="mt-3 text-[1.25rem] font-extrabold text-[var(--color-brand-fg)]">
        Check your email
      </h1>
      {/* Phrased so it is true whether or not the address is registered
          — see the file docblock. */}
      <p className="mt-1 text-[0.84375rem] leading-relaxed text-[var(--color-brand-muted)]">
        If <span className="font-semibold text-[var(--color-brand-fg)]">{email}</span> is
        registered, a 6-digit code is on its way. It expires in 15 minutes. Check your spam folder
        if you don&rsquo;t see it.
      </p>

      <form
        onSubmit={form.handleSubmit((v) => reset.mutate(v))}
        className="mt-5 space-y-4"
        noValidate
      >
        <div>
          <Label htmlFor="fp-code">6-digit code</Label>
          <Input
            id="fp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            placeholder="123456"
            className="text-center text-[1.25rem] font-bold tracking-[0.4em]"
            {...form.register('code')}
          />
          <FieldError message={form.formState.errors.code?.message} />
        </div>

        <div>
          <Label htmlFor="fp-password">New password</Label>
          <Input
            id="fp-password"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
          {/* Said up front rather than discovered on submit. The server
              rejects passwords found in breach lists, and "that password
              has appeared in a data breach" is confusing if nobody
              mentioned the rule existed. */}
          <p className="mt-1 text-[0.71875rem] leading-relaxed text-[var(--color-brand-muted)]">
            At least 8 characters, and not one that has appeared in a known data breach.
          </p>
        </div>

        <div>
          <Label htmlFor="fp-confirm">Confirm new password</Label>
          <Input
            id="fp-confirm"
            type="password"
            autoComplete="new-password"
            {...form.register('password_confirmation')}
          />
          <FieldError message={form.formState.errors.password_confirmation?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Change my password
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[0.78125rem]">
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2 disabled:opacity-50"
        >
          {resend.isPending ? 'Sending…' : 'Send another code'}
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="text-[var(--color-brand-muted)] underline underline-offset-2"
        >
          Use a different email
        </button>
      </div>

      {/* The line that turns a takeover attempt into a report. Same
          wording as the email, deliberately — a farmer who sees it in
          both places is likelier to believe it when someone calls
          asking for the code. */}
      <p className="mt-4 border-t border-[var(--color-brand-border)] pt-3 text-[0.71875rem] leading-relaxed text-[var(--color-brand-muted)]">
        We will never ask you for this code by phone, WhatsApp or text. Anyone who does is not us.
      </p>
    </div>
  );
}
