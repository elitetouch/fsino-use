'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BarChart3, Tractor, User, Bird, Users2, Settings,
  CreditCard, ShoppingBag, Info, Phone, MessageCircle, ChevronRight,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

/**
 * Sidebar — mirrors the mobile Menu screen sections so the IA
 * (Farmspeak / Account / Shop / Customer support) is consistent across
 * surfaces. Desktop only — phones use the mobile drawer with the same
 * grouping flattened.
 */

type Item = { href: string; label: string; icon: React.ElementType };
type Group = { heading: string; items: Item[] };

const GROUPS: Group[] = [
  {
    heading: 'Farmspeak',
    items: [
      { href: '/home',    label: 'Dashboard', icon: LayoutDashboard },
      { href: '/reports', label: 'Reports',   icon: BarChart3 },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/farms',         label: 'Farms',          icon: Tractor },
      { href: '/profile',       label: 'Profile',        icon: User },
      { href: '/pens-flocks',   label: 'Pens and flocks', icon: Bird },
      { href: '/users',         label: 'Users',          icon: Users2 },
      { href: '/settings',      label: 'Settings',       icon: Settings },
      { href: '/subscription',  label: 'Subscription',   icon: CreditCard },
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
      { href: '/about',     label: 'About this app',    icon: Info },
      { href: '/contact',   label: 'Call us',           icon: Phone },
      { href: '/community', label: 'WhatsApp community', icon: MessageCircle },
    ],
  },
];

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[240px] shrink-0 flex-col border-r border-[var(--color-brand-border)] bg-white lg:flex">
      <div className="flex h-[60px] items-center px-5">
        <Link href="/home" aria-label="Dashboard" className="inline-flex items-center">
          <Logo height={28} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 pt-2">
        {GROUPS.map((group, gi) => (
          <div key={group.heading} className={gi > 0 ? 'mt-5' : ''}>
            <p className="mb-1 px-3 text-[12px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
              {group.heading}
            </p>
            {group.items.map((item) => <SidebarLink key={item.href} {...item} />)}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-brand-border)] px-5 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-brand-muted-soft)]">
          Farmspeak is registered in Nigeria
        </p>
      </div>
    </aside>
  );
}

function SidebarLink({ href, label, icon: Icon }: Item) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/home' && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        'group flex h-10 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
          : 'text-[var(--color-brand-fg-soft)] hover:bg-[var(--color-brand-surface-soft)]',
      )}
    >
      <span
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
          active
            ? 'bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary-deep)]'
            : 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)] group-hover:bg-white',
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>
      <span className="flex-1 truncate">{label}</span>
      <ChevronRight
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-opacity',
          active ? 'opacity-100 text-[var(--color-brand-primary-deep)]' : 'opacity-0 group-hover:opacity-60',
        )}
      />
    </Link>
  );
}
