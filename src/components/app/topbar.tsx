'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, LogOut, Menu, Plus, User as UserIcon, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { clearToken, readUser } from '@/lib/auth';
import { writeCurrentFarmId } from '@/lib/farm-context';
import { useOnline } from '@/lib/offline';
import { cn } from '@/lib/utils';

/**
 * Top bar.
 *
 * Desktop (≥lg): page title left, quick-add + user-menu right.
 * Mobile  (<lg): hamburger that opens the drawer, logo center, user
 *                avatar right.
 *
 * The page title is supplied by the caller so each route can label
 * itself without a hard dependency from the layout.
 */
export function Topbar({
  title,
  onOpenDrawer,
}: {
  title?: string;
  onOpenDrawer?: () => void;
}) {
  const router = useRouter();
  const online = useOnline();
  const user = readUser();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the dropdown on outside click — simple but covers the case.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  function signOut() {
    clearToken();
    writeCurrentFarmId(null);
    router.replace('/');
  }

  const initial = (user?.name ?? 'F').trim().charAt(0).toUpperCase();

  // Total token balance — surfaced as a small Wallet pill so farmers
  // see at a glance how many birds they can still place. Linked to
  // /wallet for top-up.
  const balances = useQuery({
    queryKey: ['token-balances'],
    queryFn: () => endpoints.listBalances(),
  });
  const totalTokens = (balances.data?.balances ?? []).reduce((s, b) => s + b.balance, 0);
  const lowBalance = !balances.isLoading && totalTokens < 50;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-brand-border)] bg-white/85 backdrop-blur-lg">
      <div className="flex h-[60px] items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
        {/* Left: mobile hamburger + (mobile-only) logo, OR (desktop) title */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-brand-fg)] transition-colors hover:bg-[var(--color-brand-surface-soft)] lg:hidden"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          <Link href="/home" aria-label="Dashboard" className="inline-flex shrink-0 lg:hidden">
            <Logo height={26} />
          </Link>
          {title && (
            <h1 className="hidden truncate text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)] lg:block">
              {title}
            </h1>
          )}
        </div>

        {/* Right: online indicator + quick add + user menu */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex',
              online
                ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-[var(--color-brand-primary)]' : 'bg-amber-600')} />
            {online ? 'Online' : 'Offline'}
          </span>

          <Link
            href="/wallet"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
              lowBalance
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)] hover:brightness-95',
            )}
            aria-label="Open wallet"
          >
            <Wallet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {balances.isLoading ? '—' : totalTokens.toLocaleString()}
            </span>
            <span className="hidden sm:inline">tokens</span>
          </Link>

          <Button asChild size="sm" className="hidden h-9 px-3.5 text-[13px] sm:inline-flex">
            <Link href="/setup/flocks">
              <Plus className="h-3.5 w-3.5" />
              New flock
            </Link>
          </Button>

          {/* User menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] bg-white p-1 pr-2.5 transition-all hover:border-[var(--color-brand-primary)]/40 hover:bg-[var(--color-brand-surface-soft)]"
              aria-expanded={menuOpen}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] text-[11px] font-bold text-white">
                {initial}
              </span>
              <span className="hidden text-[13px] font-semibold text-[var(--color-brand-fg)] sm:inline">
                {user?.name?.split(' ')[0] ?? 'Farmer'}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--color-brand-muted)] sm:inline" />
            </button>

            {menuOpen && (
              <div className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-2 shadow-[0_30px_60px_-25px_rgba(15,80,30,0.25)]">
                <div className="rounded-xl bg-[var(--color-brand-surface-soft)] px-3 py-3">
                  <p className="text-sm font-bold text-[var(--color-brand-fg)]">{user?.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-brand-muted)]">{user?.email}</p>
                </div>
                <div className="mt-1 py-1">
                  <MenuLink href="/settings" icon={UserIcon} label="Profile & settings" onClick={() => setMenuOpen(false)} />
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--color-brand-danger)] transition-colors hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-brand-fg-soft)] transition-colors hover:bg-[var(--color-brand-surface-soft)]"
    >
      <Icon className="h-4 w-4 text-[var(--color-brand-muted)]" />
      {label}
    </Link>
  );
}
