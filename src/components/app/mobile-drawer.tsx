'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  LayoutDashboard, BarChart3, Tractor, User, Bird, Users2, Settings,
  CreditCard, ShoppingBag, Info, Phone, MessageCircle, ChevronRight, X, Wallet,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

const GROUPS: Array<{
  heading?: string;
  items: Array<{ href: string; label: string; icon: React.ElementType }>;
}> = [
  {
    // First group has no heading — the brand block above already
    // identifies the workspace; a redundant label crowds the logo.
    items: [
      { href: '/home',    label: 'Dashboard', icon: LayoutDashboard },
      { href: '/reports', label: 'Reports',   icon: BarChart3 },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/farms',         label: 'Farms',           icon: Tractor },
      { href: '/profile',       label: 'Profile',         icon: User },
      { href: '/pens-flocks',   label: 'Pens and flocks', icon: Bird },
      { href: '/users',         label: 'Users',           icon: Users2 },
      { href: '/settings',      label: 'Settings',        icon: Settings },
      { href: '/wallet',        label: 'Wallet',           icon: Wallet },
      { href: '/subscription',  label: 'Subscription',    icon: CreditCard },
    ],
  },
  {
    heading: 'Shop',
    items: [
      { href: '/shop',  label: 'Pen accessories', icon: ShoppingBag },
    ],
  },
  {
    heading: 'Customer support',
    items: [
      { href: '/about',     label: 'About this app',     icon: Info },
      { href: '/contact',   label: 'Call us',            icon: Phone },
      { href: '/community', label: 'WhatsApp community', icon: MessageCircle },
    ],
  },
];

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

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
          {GROUPS.map((group, gi) => (
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
