'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2, AlertTriangle, Loader2, ShieldCheck, Mail, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { Logo } from '@/components/brand/logo';
import {
  apiErrorMessage, endpoints, normalisePhone,
  type InvitePreviewDto,
} from '@/lib/api';
import { readToken, writeToken, writeUser } from '@/lib/auth';
import { brand } from '@/config/brand';
import { normalisePermissions, PERMISSION_GROUPS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/**
 * Staff-invite landing page.
 *
 * URL: /invite/accept?token=<rawToken>
 * (Matches the backend's `INVITE_ACCEPT_URL` builder in
 * StaffInviteController::store, which appends `?token=…` to the
 * configured base.)
 *
 * Three sub-flows driven by `nextAction.type` from the preview endpoint:
 *
 * - `accept`   → user is logged in and their account email matches the
 *                invite. One-click accept.
 * - `login`    → an account with this email already exists. Send them
 *                to login with a return-to that brings them back here
 *                so the accept call fires after sign-in.
 * - `register` → no account yet. Inline form collects name, phone +
 *                password and calls /accept-and-register, which both
 *                creates the user, marks the invite accepted, and
 *                returns a session token.
 *
 * The token is the only thing in the URL — everything else comes from
 * the public preview endpoint (no auth required).
 */
export default function InviteAcceptPage() {
  return (
    // useSearchParams() must run inside a Suspense boundary in app router
    <Suspense fallback={
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      </Shell>
    }>
      <InviteAcceptInner />
    </Suspense>
  );
}

function InviteAcceptInner() {
  const search = useSearchParams();
  const token = (search.get('token') ?? '').trim();

  const preview = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: () => endpoints.previewInvite(token),
    enabled: token.length > 0,
    retry: false,
  });

  if (!token) {
    return (
      <Shell>
        <ErrorState message="No invite token in the link. Please open the link from your email." />
      </Shell>
    );
  }

  if (preview.isLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
          <p className="text-[12.5px] text-[var(--color-brand-muted)]">Checking your invite…</p>
        </div>
      </Shell>
    );
  }

  if (preview.isError || !preview.data) {
    return (
      <Shell>
        <ErrorState message={apiErrorMessage(preview.error, 'This invite is no longer valid.')} />
      </Shell>
    );
  }

  return (
    <Shell>
      <InviteHeader data={preview.data} />
      <ActionPanel data={preview.data} token={token} />
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/*  Layout shell                                                       */
/* ------------------------------------------------------------------ */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-svh bg-[var(--color-brand-surface-soft)] px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[560px]">
        <Link href="/" className="inline-flex items-center justify-center">
          <Logo size={180} />
        </Link>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white shadow-[0_30px_80px_-30px_rgba(15,80,30,0.18)]">
          {children}
        </div>
        <p className="mt-4 text-center text-[11px] text-[var(--color-brand-muted)]">
          Invites are farm-scoped. Accepting only grants access to the farm shown above.
        </p>
      </div>
    </main>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h1 className="mt-4 text-[18px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
        Invite unavailable
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--color-brand-muted)]">{message}</p>
      <p className="mt-1.5 text-[12px] text-[var(--color-brand-muted)]">
        Ask the farm owner to send you a fresh link.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-5 h-9">
        <Link href="/login">Sign in to {brand.name}</Link>
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Invite header — farm name, role, permissions summary                */
/* ------------------------------------------------------------------ */

function InviteHeader({ data }: { data: InvitePreviewDto }) {
  const { invite, farm } = data;
  const perms = normalisePermissions(invite.permissions);
  const grantedKeys = Object.keys(perms);
  const totalKeys = PERMISSION_GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="border-b border-[var(--color-brand-border)] px-6 py-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
        You&rsquo;ve been invited
      </p>
      <h1 className="mt-1.5 text-[20px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
        Join <span className="text-[var(--color-brand-primary-deep)]">{farm?.name ?? 'this farm'}</span>
      </h1>
      <p className="mt-1.5 text-[13px] text-[var(--color-brand-muted)]">
        Sent to <strong className="text-[var(--color-brand-fg)]">{invite.email}</strong>.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Pill icon={ShieldCheck} label="Role" value={invite.role} />
        <Pill
          icon={CheckCircle2}
          label={invite.role === 'staff' ? 'Permissions' : 'Access'}
          value={
            invite.role === 'staff'
              ? `${grantedKeys.length} of ${totalKeys} granted`
              : invite.role === 'owner'
                ? 'Full access (owner)'
                : 'Full access (manager)'
          }
        />
      </div>

      {invite.role === 'staff' && grantedKeys.length > 0 && (
        <details className="group mt-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline">
            See exactly what you can do
          </summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {PERMISSION_GROUPS.flatMap((g) => g.items)
              .filter((p) => perms[p.key])
              .map((p) => (
                <li
                  key={p.key}
                  className="flex items-start gap-2 rounded-md bg-[var(--color-brand-accent)]/40 px-2.5 py-1.5 text-[11.5px] text-[var(--color-brand-fg)]"
                >
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-brand-primary-deep)]" />
                  {p.label}
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Pill({
  icon: Icon, label, value,
}: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">
        {label}
      </p>
      <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] font-bold capitalize text-[var(--color-brand-fg)]">
        <Icon className="h-3.5 w-3.5 text-[var(--color-brand-primary-deep)]" />
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Action panel — pick path by nextAction.type                         */
/* ------------------------------------------------------------------ */

function ActionPanel({ data, token }: { data: InvitePreviewDto; token: string }) {
  const router = useRouter();
  const loggedIn = !!readToken();
  const returnTo = `/invite/accept?token=${encodeURIComponent(token)}`;

  // If the server says "accept" but locally we have no token, the
  // session was wiped — fall back to login.
  const next = data.nextAction.type === 'accept' && !loggedIn ? 'login' : data.nextAction.type;

  const accept = useMutation({
    mutationFn: () => endpoints.acceptInvite(token),
    onSuccess: () => {
      toast.success('Welcome aboard. You now have access to this farm.');
      router.replace('/home');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not accept this invite.')),
  });

  if (next === 'accept') {
    return (
      <div className="px-6 py-6">
        <p className="text-[13px] text-[var(--color-brand-muted)]">
          You&rsquo;re signed in with the same email this invite was sent to. One tap and you&rsquo;re in.
        </p>
        <Button
          size="block"
          className="mt-4"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
        >
          {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Accept invite
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (next === 'login') {
    return (
      <div className="px-6 py-6">
        <p className="text-[13px] text-[var(--color-brand-muted)]">
          You already have an account with this email. Sign in to accept the invite.
        </p>
        <Button asChild size="block" className="mt-4">
          <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>
            <Mail className="h-4 w-4" />
            Sign in to accept
          </Link>
        </Button>
      </div>
    );
  }

  // next === 'register'
  return <RegisterPanel data={data} token={token} />;
}

/* ------------------------------------------------------------------ */
/*  Inline register panel                                              */
/* ------------------------------------------------------------------ */

function RegisterPanel({ data, token }: { data: InvitePreviewDto; token: string }) {
  const router = useRouter();
  const returnTo = `/invite/accept?token=${encodeURIComponent(token)}`;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Tell us your full name.';
    const digits = normalisePhone(phone);
    if (digits.length < 7 || digits.length > 20) next.phone = 'Use 7–20 digits, e.g. +234 701 234 5678.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    if (password !== confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const submit = useMutation({
    mutationFn: () => endpoints.acceptAndRegister({
      token,
      name: name.trim(),
      phone: normalisePhone(phone),
      password,
      password_confirmation: confirm,
    }),
    onSuccess: (session) => {
      writeToken(session.token);
      writeUser({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        phone: session.user.phone ?? null,
        emailVerifiedAt: session.user.emailVerifiedAt ?? null,
        phoneVerifiedAt: session.user.phoneVerifiedAt ?? null,
      });
      toast.success(`Welcome, ${session.user.name.split(' ')[0]}.`);
      router.replace('/home');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create your account.')),
  });

  return (
    <form
      className="px-6 py-6"
      noValidate
      onSubmit={(e) => { e.preventDefault(); if (validate()) submit.mutate(); }}
    >
      <div className="mb-4 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)]/40 px-3.5 py-3 text-[12.5px] text-[var(--color-brand-fg)]">
        <strong className="text-[var(--color-brand-primary-deep)]">First time on {brand.name}?</strong>{' '}
        Set up your account in 30 seconds. You&rsquo;ll sign in with{' '}
        <strong>{data.invite.email}</strong> from now on.
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Full name *</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Samuel Okoro"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FieldError message={errors.name} />
        </div>
        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+234 701 234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <FieldError message={errors.phone} />
        </div>
        <div>
          <Label htmlFor="password">Choose a password *</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldError message={errors.password} />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password *</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat the password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <FieldError message={errors.confirm} />
        </div>
      </div>

      <Button
        type="submit"
        size="block"
        className={cn('mt-6', submit.isPending && 'cursor-wait')}
        disabled={submit.isPending}
      >
        {submit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account &amp; join farm
        <ArrowRight className="h-4 w-4" />
      </Button>

      <p className="mt-3 text-center text-[11.5px] text-[var(--color-brand-muted)]">
        Already have an account?{' '}
        <Link
          href={`/login?next=${encodeURIComponent(returnTo)}`}
          className="font-semibold text-[var(--color-brand-primary)] hover:underline"
        >
          Sign in instead
        </Link>
      </p>
    </form>
  );
}
