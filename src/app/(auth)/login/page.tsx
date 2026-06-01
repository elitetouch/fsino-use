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
import { apiErrorMessage, endpoints } from '@/lib/api';
import { writeToken, writeUser } from '@/lib/auth';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const login = useMutation({
    mutationFn: (v: FormValues) => endpoints.login(v.email, v.password),
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
      toast.success(`Welcome back, ${session.user.name.split(' ')[0]}.`);
      router.replace('/home');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not sign you in.')),
  });

  return (
    <div>
      <h1
        className="font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        Welcome back
      </h1>
      <p
        className="mt-2 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        Sign in to keep managing your farm.
      </p>

      <form
        className="mt-7 space-y-5"
        onSubmit={form.handleSubmit((v) => login.mutate(v))}
        noValidate
      >
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            {...form.register('password')}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </div>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-[var(--color-brand-primary)] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="block" disabled={login.isPending}>
          {login.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
          Log in
        </Button>

        <p className="pt-3 text-center text-sm text-[var(--color-brand-muted)]">
          New to Farm Support?{' '}
          <Link
            href="/register"
            className="font-semibold text-[var(--color-brand-primary)] hover:underline"
          >
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
