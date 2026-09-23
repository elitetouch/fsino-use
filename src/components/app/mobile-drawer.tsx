'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ruleForPath, usePermissions } from '@/lib/access';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from '@/lib/nav';

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const p = usePermissions();

  // Same filter as the desktop sidebar — see sidebar.tsx for the
  // rationale on keeping all groups visible while loading.
  const visibleGroups = p.loading
    ? NAV_GROUPS
    : NAV_GROUPS
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => p.satisfies(ruleForPath(it.href) ?? { openToMembers: true })),
        }))
        .filter((g) => g.items.length > 0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="animate-fade-up absolute left-0 top-0 flex h-full w-[280px] flex-col border-r border-[var(--color-brand-border)] bg-white">
        <div className="flex h-[80px] items-center justify-between px-4">
          <Logo height={48} />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {visibleGroups.map((group, gi) => (
            <div key={group.heading ?? `g-${gi}`} className={gi > 0 ? 'mt-5' : ''}>
              {group.heading && (
                <p className="mb-1 px-3 text-[12px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
                  {group.heading}
                </p>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/home' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex h-11 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                        : 'text-[var(--color-brand-fg-soft)] hover:bg-[var(--color-brand-surface-soft)]',
                    )}
                  >
                    <span className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                      active ? 'bg-[var(--color-brand-primary)]/15' : 'bg-[var(--color-brand-surface-soft)]',
                    )}>
                      <item.icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {/* Phone users are most of the user base and the ones
                        standing in the pen with the camera — the beta
                        caveat has to reach them, not just desktop. */}
                    {item.beta && (
                      <span className="shrink-0 rounded-full border border-[var(--color-brand-primary)]/35 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-[var(--color-brand-primary-deep)]">
                        Beta
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--color-brand-muted-soft)]" />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}
