'use client';

import Link from 'next/link';
import { ChevronRight, ArrowLeft, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ================================================================== */
/*  Page shells                                                        */
/* ================================================================== */

/**
 * Settings sub-page header. Mirrors the mobile "< Daily record
 * preferences / Preferences for layers and broilers" pattern: a back
 * link, then a tight title block. Adds a permission-locked banner if
 * the section is read-only for this user.
 */
export function SubPageHeader({
  backTo = '/settings',
  title,
  description,
  lockedNote,
}: {
  backTo?: string;
  title: string;
  description?: string;
  /** When set, renders an amber "view only" banner explaining why. */
  lockedNote?: string;
}) {
  return (
    <div className="mb-5">
      <Link
        href={backTo}
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to settings
      </Link>
      <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-[13px] leading-snug text-[var(--color-brand-muted)]">
          {description}
        </p>
      )}
      {lockedNote && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-snug text-amber-900">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{lockedNote}</p>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Sections + grouping                                                */
/* ================================================================== */

/**
 * Group of toggles under a single label. Looks like the mobile-figma
 * sections: a bold heading, optional hint, then the rows below.
 */
export function Section({
  title, hint, children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-4 py-3">
        <h2 className="text-[13px] font-bold tracking-tight text-[var(--color-brand-fg)]">{title}</h2>
        {hint && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">{hint}</p>
        )}
      </header>
      <div className="divide-y divide-[var(--color-brand-border)]">{children}</div>
    </section>
  );
}

/**
 * Single row with label + switch. Mirrors the mobile look exactly:
 * label on the left, optional small hint underneath, switch on the
 * right. Disabled state greys the row and explains why.
 */
export function ToggleRow({
  label, desc, checked, onChange, disabled, lockedReason,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Shown beneath the label when disabled — explains the lock. */
  lockedReason?: string;
}) {
  const effectiveDesc = disabled && lockedReason ? lockedReason : desc;
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-55'
          : 'hover:bg-[var(--color-brand-surface-soft)]',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-[var(--color-brand-fg)]">{label}</p>
        {effectiveDesc && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">
            {effectiveDesc}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={(v) => !disabled && onChange(v)}
        disabled={disabled}
      />
    </label>
  );
}

/**
 * "Coming soon" row — read-only placeholder for features the backend
 * doesn't ship yet. Matches the figma's red-text rows so the user
 * knows we know.
 */
export function ComingSoonRow({
  label, hint,
}: { label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5 opacity-70">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-[var(--color-brand-danger)]">{label}</p>
        {hint && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">{hint}</p>
        )}
      </div>
      <span className="rounded-full bg-[var(--color-brand-surface-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
        Soon
      </span>
    </div>
  );
}

/* ================================================================== */
/*  Switch (controlled)                                                */
/* ================================================================== */

export function Switch({
  checked, onChange, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] focus-visible:ring-offset-2',
        checked ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-input-border)]',
        disabled && 'cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

/* ================================================================== */
/*  Preset tiles (Easy / Expert / Custom)                              */
/* ================================================================== */

/**
 * The preset row from the figma. Three tiles in a segmented control,
 * Easy and Expert are clickable, Custom is read-only and lights up
 * automatically whenever the server flips into custom mode (which it
 * does when a per-field toggle was patched without naming a preset).
 *
 * Picking Easy or Expert sends `{ preset: '...' }` — the server replaces
 * the entire daily_record block with that preset's defaults.
 */
export function PresetTiles({
  value, onPick, disabled,
}: {
  value: 'easy' | 'expert' | 'custom';
  onPick: (next: 'easy' | 'expert') => void;
  disabled?: boolean;
}) {
  const tiles: Array<{ key: 'easy' | 'expert' | 'custom'; label: string; sub: string }> = [
    { key: 'easy',   label: 'Easy',    sub: 'Minimum capture' },
    { key: 'expert', label: 'Expert',  sub: 'Full grid' },
    { key: 'custom', label: 'Custom',  sub: 'Your own mix' },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {tiles.map((t) => {
        const active = t.key === value;
        const clickable = !disabled && t.key !== 'custom';
        return (
          <button
            type="button"
            key={t.key}
            disabled={!clickable}
            onClick={() => clickable && onPick(t.key as 'easy' | 'expert')}
            className={cn(
              'flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left transition-all',
              active
                ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/45'
                : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
              !clickable && 'cursor-not-allowed opacity-60 hover:border-[var(--color-brand-input-border)]',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{t.label}</p>
              <p className="mt-0.5 text-[11px] text-[var(--color-brand-muted)]">{t.sub}</p>
            </div>
            {active && (
              <Check
                className="h-4 w-4 shrink-0 text-[var(--color-brand-primary-deep)]"
                strokeWidth={3}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  Settings menu row (used on the hub page)                           */
/* ================================================================== */

/**
 * A single row in the /settings menu hub. Matches the mobile figma:
 * label + chevron, with a small description line underneath. Links to
 * a sub-page. When `disabled` is true (e.g. staff can't open it), the
 * chevron is greyed and clicks are inert.
 */
export function MenuRow({
  href, label, hint, disabled,
}: {
  href: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-[var(--color-brand-fg)]">{label}</p>
        {hint && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">{hint}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-muted-soft)]" />
    </>
  );
  if (disabled) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 opacity-50">{inner}</div>
    );
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--color-brand-surface-soft)]"
    >
      {inner}
    </Link>
  );
}

/* ================================================================== */
/*  Shared error / loading                                             */
/* ================================================================== */

export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-4 py-3">
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--color-brand-border)]" />
      </header>
      <div className="divide-y divide-[var(--color-brand-border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse bg-[var(--color-brand-surface-soft)]" />
        ))}
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Optimistic deep-merge                                              */
/* ================================================================== */

/**
 * Merge a partial server-shape patch into an existing config object,
 * recursing into plain objects but treating arrays/primitives as
 * atomic. Used by the optimistic-update path so the UI snaps instantly
 * before the server confirms.
 */
export function deepMerge<T extends Record<string, unknown>>(base: T, patch: object): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const existing = out[k];
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      out[k] = deepMerge(existing as Record<string, unknown>, v as object);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
