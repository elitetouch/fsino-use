'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

/**
 * Underlined form input — matches the mobile design language. Soft
 * border at rest, primary-green border on focus, generous height for
 * thumb-tapping accuracy.
 */
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-4 py-3.5 text-[15px] text-[var(--color-brand-fg)] placeholder:text-[var(--color-brand-muted)]/70',
        'transition focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20',
        'disabled:cursor-not-allowed disabled:bg-[var(--color-brand-bg)] disabled:text-[var(--color-brand-muted)]',
        className,
      )}
      {...props}
    />
  );
});

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        'mb-1.5 block text-sm font-medium text-[var(--color-brand-fg)]',
        className,
      )}
      {...props}
    />
  );
});

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-[var(--color-brand-danger)]">
      {message}
    </p>
  );
}
