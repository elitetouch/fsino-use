'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  LayoutDashboard, Bird, Warehouse, Tractor, ClipboardList, Syringe,
  Settings, HelpCircle, X,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

const NAV: Array<{ href: string; label: string; icon: React.ElementType }> = [
  { href: '/home',     label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/flocks',   label: 'Flocks',     icon: Bird },
  { href: '/pens',     label: 'Pens',       icon: Warehouse },
  { href: '/farms',    label: 'Farms',      icon: Tractor },
  { href: '/records',  label: 'Daily logs', icon: ClipboardList },
  { href: '/vaccines', label: 'Vaccines',   icon: Syringe },
  { href: '/settings', label: 'Settings',   icon: Settings },
  { href: '/help',     label: 'Help',       icon: HelpCircle },
];

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  // Body scroll lock + Escape close while open.
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
      <div
        aria-hidden
        className="animate-fade-in absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <aside className="animate-fade-up absolute left-0 top-0 flex h-full w-[280px] flex-col border-r border-[var(--color-brand-border)] bg-white">
        <div className="flex h-[72px] items-center justify-between px-5">
          <Logo height={32} />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/home' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'mb-1 flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-primary-deep)]'
                    : 'text-[var(--color-brand-fg-soft)] hover:bg-[var(--color-brand-surface-soft)]',
                )}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
