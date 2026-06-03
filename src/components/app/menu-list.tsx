'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuListItem {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  external?: boolean;
}

export interface MenuGroup {
  heading: string;
  items: MenuListItem[];
}

/**
 * Section list — reused by /menu and the various Customer Support /
 * Account index pages so the visual language is consistent.
 */
export function MenuList({ groups }: { groups: MenuGroup[] }) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.heading}>
          <p className="mb-1.5 px-1 text-[13px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
            {g.heading}
          </p>
          <ul className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
            {g.items.map((item, i) => (
              <li key={item.href} className={cn(i > 0 && 'border-t border-[var(--color-brand-border)]')}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-brand-surface-soft)]"
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-primary-deep)]">
                    <item.icon className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-[var(--color-brand-fg)]">{item.label}</p>
                    {item.hint && (
                      <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">{item.hint}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-muted-soft)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-primary-deep)]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
