'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button — pill geometry matches the mobile mockups. Tap targets are
 * generous (56px on `lg`, 48px on `default`) so they remain comfortable
 * for farmers on phones with thumb-only input.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-semibold tracking-tight ring-offset-white transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-brand-primary)] text-white shadow-[0_8px_16px_-8px_rgba(21,163,74,0.5)] hover:bg-[var(--color-brand-primary-deep)]',
        secondary:
          'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-dark)] hover:brightness-95',
        outline:
          'border-2 border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-fg)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]',
        ghost:
          'bg-transparent text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-accent)]/40',
        link:
          'h-auto rounded-none p-0 text-[var(--color-brand-primary)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-10 px-4 text-sm',
        default: 'h-12 px-5',
        lg: 'h-14 px-6 text-[17px] xl:h-16 xl:px-7 xl:text-lg',
        block: 'h-14 w-full px-6 text-[17px] xl:h-16 xl:text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, asChild = false, ...props }, ref) {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
