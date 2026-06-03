'use client';

import { Sparkles, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';

/**
 * Friendly placeholder for routes that exist in the IA but aren't
 * implemented yet. Keeps the sidebar from 404-ing and sets expectations.
 */
export function ComingSoon({
  eyebrow,
  title,
  body,
  icon: Icon = Sparkles,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={eyebrow} title={title} />

      <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <p className="mt-4 text-[14px] font-bold text-[var(--color-brand-fg)]">Coming soon</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-[var(--color-brand-muted)]">{body}</p>
      </div>
    </div>
  );
}
