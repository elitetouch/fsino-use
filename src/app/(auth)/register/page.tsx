'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { apiErrorMessage, endpoints, normalisePhone, type RegisterPayload } from '@/lib/api';
import { writeToken, writeUser } from '@/lib/auth';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your full name'),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    phone: z
      .string()
      .trim()
      .min(7, 'Enter a valid phone number')
      // Be permissive on display (allow +, spaces, dashes) — we strip them
      // before posting. Backend rule is digits_between:7,20.
      .refine(
        (v) => {
          const digits = v.replace(/\D/g, '');
          return digits.length >= 7 && digits.length <= 20;
        },
        { message: 'Enter a valid phone number (7–20 digits)' },
      ),
    password: z.string().min(8, 'Use at least 8 characters'),
    password_confirmation: z.string(),
    accepted: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms of Service' }),
    }),
  })
  .refine((v) => v.password === v.password_confirmation, {
    path: ['password_confirmation'],
    message: 'Passwords do not match',
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      password_confirmation: '',
      accepted: false as unknown as true, // RHF defaults — coerced by zod on submit
    },
  });

  const register = useMutation({
    mutationFn: (payload: RegisterPayload) => endpoints.register(payload),
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
      toast.success('Account created — check your email for the code.');
      router.push('/verify');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create account.')),
  });

  function onSubmit(values: FormValues) {
    register.mutate({
      name: values.name,
      email: values.email,
      // Strip every non-digit — backend rule is digits_between:7,20.
      phone: normalisePhone(values.phone),
      password: values.password,
      password_confirmation: values.password_confirmation,
    });
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
        Get started
      </p>
      <h1
        className="mt-2 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        Create your account
      </h1>
      <p
        className="mt-2 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        Two minutes from here, your first flock is live.
      </p>

      <form className="mt-7 space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Samuel Okoro"
            {...form.register('name')}
          />
          <FieldError message={form.formState.errors.name?.message} />
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="samuel.okoro@farms.ng"
            {...form.register('email')}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0701 234 5678"
            {...form.register('phone')}
          />
          <FieldError message={form.formState.errors.phone?.message} />
        </div>

        <div>
          <Label htmlFor="password">Create password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </div>

        <div>
          <Label htmlFor="password_confirmation">Confirm password</Label>
          <Input
            id="password_confirmation"
            type="password"
            autoComplete="new-password"
            placeholder="Type it again"
            {...form.register('password_confirmation')}
          />
          <FieldError message={form.formState.errors.password_confirmation?.message} />
        </div>

        <label className="flex items-start gap-3 pt-1 text-sm text-[var(--color-brand-fg)]">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-2 border-[var(--color-brand-input-border)] text-[var(--color-brand-primary)] accent-[var(--color-brand-primary)]"
            {...form.register('accepted')}
          />
          <span className="leading-snug text-[var(--color-brand-muted)]">
            I have read and agree to the{' '}
            <Link href="/legal/terms" className="font-medium text-[var(--color-brand-primary)] hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="font-medium text-[var(--color-brand-primary)] hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <FieldError message={form.formState.errors.accepted?.message} />

        <Button type="submit" size="block" disabled={register.isPending}>
          {register.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
          Continue to register
        </Button>

        <p className="pt-3 text-center text-sm text-[var(--color-brand-muted)]">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-[var(--color-brand-primary)] hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
