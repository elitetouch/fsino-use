'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Multi-box OTP input — matches the verify-phone screen from the mobile
 * design. Auto-advances on type, auto-rewinds on backspace, accepts
 * paste of the full code, suggests SMS autofill via autocomplete=
 * one-time-code (iOS/Android both honour this).
 *
 * The visible field is `<input type="tel">` so the numeric keypad opens
 * on mobile without the heavy iOS spinner that comes with type=number.
 */
export function OtpInput({
  value,
  onChange,
  length = 4,
  autoFocus = true,
  disabled = false,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setDigitAt(index: number, digit: string) {
    const padded = value.padEnd(length, ' ');
    const next = (padded.substring(0, index) + digit + padded.substring(index + 1))
      .replace(/\s/g, '')
      .slice(0, length);
    onChange(next);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length === 0) {
      setDigitAt(index, '');
      return;
    }
    // Handle paste of full code.
    if (raw.length >= length) {
      onChange(raw.slice(0, length));
      refs.current[length - 1]?.focus();
      return;
    }
    setDigitAt(index, raw[raw.length - 1]);
    if (index < length - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
  }

  return (
    // Grid columns equal the OTP length so each cell flexes within the
    // capped container. `aspect-square` keeps cells square at any width.
    // The container caps via `max-w-*` so cells stop growing on tablet+
    // (otherwise a 448px container produces awkward 70px cells).
    <div
      className={cn(
        'mx-auto grid w-full gap-2 sm:gap-3',
        length >= 6 ? 'max-w-[320px] sm:max-w-sm' : 'max-w-[260px]',
      )}
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="tel"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          disabled={disabled}
          className={cn(
            'aspect-square w-full min-w-0 rounded-2xl border-2 border-[var(--color-brand-input-border)] bg-white text-center font-bold text-[var(--color-brand-fg)]',
            'text-xl sm:text-2xl',
            'transition focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        />
      ))}
    </div>
  );
}
