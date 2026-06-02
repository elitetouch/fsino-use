'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bird,
  Warehouse,
  Tractor,
  ClipboardList,
  Syringe,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

const PRIMARY: Array<{ href: string; label: string; icon: React.ElementType }> = [
  { href: '/home',      label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/flocks',    label: 'Flocks',     icon: Bird },
  { href: '/pens',      label: 'Pens',       icon: Warehouse },
  { href: '/farms',     label: 'Farms',      icon: Tractor },
];

const SECONDARY: Array<{ href: string; label: string; icon: React.ElementType }> = [
  { href: '/records',   label: 'Daily logs', icon: ClipboardList },
  { href: '/vaccines',  label: 'Vaccines',   icon: Syringe },
];

const FOOTER_NAV: Array<{ href: string; label: string; icon: React.ElementType }> = [
  { href: '/settings',  label: 'Settings',   icon: Settings },
  { href: '/help',      label: 'Help',       icon: HelpCircle },
];

/**
 * Persistent left sidebar — desktop only.
 *
 * Pattern lifted from Mercury / Linear: brand at top, primary nav,
 * a subtle divider, secondary nav, then settings/help at the bottom.
 * Active items get a green accent strip + soft mint background.
 *
 * On phones the sidebar is replaced by the MobileDrawer.
 */
export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[260px] flex-col border-r border-[var(--color-brand-border)] bg-white lg:flex">
      {/* Logo block — fixed height so it always lines up with the topbar. */}
      <div className="flex h-[72px] items-center px-6">
        <Link href="/home" aria-label="Dashboard" className="inline-flex items-center">
          <Logo height={36} />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 pt-1">
        <NavGroup label="Workspace" items={PRIMARY} />
        <NavGroup label="Records" items={SECONDARY} className="mt-6" />

        <div className="mt-auto pt-6">
          <NavGroup items={FOOTER_NAV} />
        </div>
      </nav>
    </aside>
  );
}

function NavGroup({
  label,
  items,
  className,
}: {
  label?: string;
  items: Array<{ href: string; label: string; icon: React.ElementType }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)}>
      {label && (
        <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-muted-soft)]">
          {label}
        </p>
      )}
      {items.map((item) => <NavLink key={item.href} {...item} />)}
    </div>
  );
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/home' && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all',
        active
          ? 'bg-[var(--color-brand-accent)]/55 text-[var(--color-brand-primary-deep)]'
          : 'text-[var(--color-brand-fg-soft)] hover:bg-[var(--color-brand-surface-soft)] hover:text-[var(--color-brand-fg)]',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-brand-primary)]"
        />
      )}
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0 transition-colors',
          active ? 'text-[var(--color-brand-primary-deep)]' : 'text-[var(--color-brand-muted)] group-hover:text-[var(--color-brand-fg-soft)]',
        )}
        strokeWidth={2}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
