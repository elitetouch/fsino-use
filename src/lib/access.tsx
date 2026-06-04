'use client';

/**
 * Access-control engine for the farmer app.
 *
 * Backend is the authoritative line (farm.perm:<key> middleware) — this
 * module mirrors that policy on the frontend so we can:
 *
 *   1. Filter nav items so users never see a tab they can't open.
 *   2. Hide action buttons (Create / Edit / Delete) on every page.
 *   3. Render a friendly "no access" panel instead of 403'd content
 *      when a user deep-links to a route they shouldn't reach.
 *
 * Single source of truth: this file owns the route → permission table,
 * the role → bypass rules, and the React surface (hook + components).
 *
 * If a permission key is added to the backend, add it here too:
 *   - PERMISSION_GROUPS in lib/permissions.ts (the user-facing label)
 *   - ROUTE_ACCESS below (which routes require it)
 *   - Any Gate / can() call sites that need it
 *
 * The backend NEVER trusts this file. Every API call still goes through
 * RequireFarmPermission middleware; this file is purely UX.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ShieldOff, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { endpoints, type FarmDto } from './api';
import { useCurrentFarmId } from './farm-context';
import { normalisePermissions, type FarmRole } from './permissions';

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

/** Permission keys — must match backend farm.perm:<key>. */
export type PermissionKey =
  | 'pens.view' | 'pens.create' | 'pens.update' | 'pens.archive'
  | 'flocks.view' | 'flocks.create' | 'flocks.renew' | 'flocks.archive'
  | 'flocks.records.create' | 'flocks.records.update'
  | 'settings.view' | 'settings.update' | 'preferences.update'
  | 'staff_manage.view' | 'staff_manage.create' | 'staff_manage.update' | 'staff_manage.delete'
  | 'billing.manage';

/**
 * Route-access table.
 *
 * Each rule names the permission(s) needed to even SEE the page. Routes
 * not listed here are open to any authenticated farm member.
 *
 * Special values:
 *   { ownerOnly: true } — only role === 'owner' may enter
 *   { anyOf: [...]    } — any one of these perms suffices
 *
 * The matcher is longest-prefix, so /pens/abc-123 inherits /pens.
 */
export type AccessRule =
  | { perm: PermissionKey }
  | { anyOf: PermissionKey[] }
  | { ownerOnly: true }
  | { openToMembers: true };

export const ROUTE_ACCESS: Array<{ path: string; rule: AccessRule }> = [
  // Dashboard / generic
  { path: '/home',         rule: { openToMembers: true } },
  { path: '/reports',      rule: { openToMembers: true } },

  // Account-level — any member can switch farms / edit their profile
  { path: '/farms',        rule: { openToMembers: true } },
  { path: '/profile',      rule: { openToMembers: true } },
  { path: '/menu',         rule: { openToMembers: true } },

  // Pens & flocks
  { path: '/pens-flocks',  rule: { anyOf: ['pens.view', 'flocks.view'] } },
  { path: '/pens',         rule: { perm: 'pens.view' } },
  { path: '/flocks',       rule: { perm: 'flocks.view' } },
  { path: '/cycles',       rule: { perm: 'flocks.view' } },

  // Setup flows — write actions
  { path: '/setup/pens',   rule: { perm: 'pens.create' } },
  { path: '/setup/flocks', rule: { perm: 'flocks.create' } },
  // /setup/farm is owner-bound; the dedicated guard there enforces it.

  // Team + settings + billing
  { path: '/users',        rule: { perm: 'staff_manage.view' } },
  // Settings is structured as a menu hub + sub-pages. The hub itself
  // is open to anyone with either permission; the personal sub-pages
  // require preferences.update; the farm-wide sub-pages require
  // settings.view (with settings.update gating writes inside the page).
  { path: '/settings',                  rule: { anyOf: ['settings.view', 'preferences.update'] } },
  { path: '/settings/dashboard',        rule: { perm: 'preferences.update' } },
  { path: '/settings/daily-record',     rule: { perm: 'preferences.update' } },
  { path: '/settings/finance',          rule: { perm: 'preferences.update' } },
  { path: '/settings/notifications',    rule: { perm: 'preferences.update' } },
  { path: '/settings/farm/daily-record', rule: { perm: 'settings.view' } },
  { path: '/settings/farm/notifications', rule: { perm: 'settings.view' } },
  { path: '/wallet',       rule: { openToMembers: true } },        // anyone can see the balance
  { path: '/subscription', rule: { perm: 'billing.manage' } },     // only billing-managers see purchases

  // Storefront / static
  { path: '/shop',         rule: { openToMembers: true } },
  { path: '/about',        rule: { openToMembers: true } },
  { path: '/contact',      rule: { openToMembers: true } },
  { path: '/community',    rule: { openToMembers: true } },
];

/** Longest-prefix match against the access table. */
export function ruleForPath(pathname: string | null | undefined): AccessRule | null {
  if (!pathname) return null;
  const hit = ROUTE_ACCESS
    .filter((r) => pathname === r.path || pathname.startsWith(`${r.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return hit?.rule ?? { openToMembers: true };
}

/* ------------------------------------------------------------------ */
/*  Permissions state hook                                             */
/* ------------------------------------------------------------------ */

export interface MembershipState {
  /** True while the farms query is in flight — UI should defer decisions. */
  loading: boolean;
  /** True if the user has NO membership at all on the active farm. */
  outsider: boolean;
  /** Active farm (current farm id matched against farms list). */
  farm: FarmDto | undefined;
  /** Role on the active farm, or null if outsider. */
  role: FarmRole | null;
  /** Flat-dot permission keys granted on the active farm. */
  perms: Record<string, true>;

  /**
   * Authoritative check — does the user satisfy `key`?
   * Owners and managers bypass (matching server behaviour).
   * Staff need the explicit key.
   */
  can: (key: PermissionKey) => boolean;

  /** True if any of `keys` are satisfied. */
  canAny: (keys: PermissionKey[]) => boolean;

  /** True if all of `keys` are satisfied. */
  canAll: (keys: PermissionKey[]) => boolean;

  /** Evaluate an AccessRule (used by the route guard + nav filter). */
  satisfies: (rule: AccessRule) => boolean;

  /** Role helpers — match server semantics. */
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
}

/**
 * Reactive permission state for the active farm.
 *
 * Wrap the result around an empty-permissions guard while loading — the
 * default everything-denied stance prevents flash-of-protected-content
 * when a staff user lands on a page mid-fetch.
 */
export function usePermissions(): MembershipState {
  const farmId = useCurrentFarmId();
  const farms = useQuery({
    queryKey: ['farms'],
    queryFn: () => endpoints.listFarms(),
    staleTime: 60_000,
  });

  return useMemo<MembershipState>(() => {
    const list = farms.data?.farms ?? [];
    const farm = list.find((f) => f.id === farmId) ?? list[0];
    const role = (farm?.membership?.role ?? null) as FarmRole | null;
    const rawPerms = farm?.membership?.permissions ?? null;
    const perms = rawPerms ? normalisePermissions(rawPerms) : {};

    const isOwner = role === 'owner';
    const isManager = role === 'manager';
    const isStaff = role === 'staff';

    const can = (key: PermissionKey): boolean => {
      if (!farm || !role) return false;
      // Server: RequireFarmPermission bypasses for owner/manager.
      if (isOwner || isManager) return true;
      return perms[key] === true;
    };

    const canAny = (keys: PermissionKey[]) => keys.some(can);
    const canAll = (keys: PermissionKey[]) => keys.every(can);

    const satisfies = (rule: AccessRule): boolean => {
      if (!farm || !role) return false;
      if ('openToMembers' in rule) return true;          // any active member
      if ('ownerOnly' in rule) return isOwner;
      if ('perm' in rule) return can(rule.perm);
      if ('anyOf' in rule) return canAny(rule.anyOf);
      return false;
    };

    return {
      loading: farms.isLoading || farms.isFetching && !farms.data,
      outsider: !!farms.data && !farm,
      farm,
      role,
      perms,
      can, canAny, canAll, satisfies,
      isOwner, isManager, isStaff,
    };
  }, [farms.data, farms.isLoading, farms.isFetching, farmId]);
}

/* ------------------------------------------------------------------ */
/*  <Gate> — inline guard for buttons / sections                       */
/* ------------------------------------------------------------------ */

type GateProps =
  | { perm: PermissionKey; anyOf?: never; ownerOnly?: never; children: React.ReactNode; fallback?: React.ReactNode }
  | { anyOf: PermissionKey[]; perm?: never; ownerOnly?: never; children: React.ReactNode; fallback?: React.ReactNode }
  | { ownerOnly: true; perm?: never; anyOf?: never; children: React.ReactNode; fallback?: React.ReactNode };

/**
 * Conditional render — `<Gate perm="pens.create"><Button>...</Button></Gate>`.
 *
 * Loading state: renders the fallback (or null) until the membership
 * query resolves, so we never flash a Create button to a staff user.
 */
export function Gate(props: GateProps): React.ReactElement | null {
  const { children, fallback = null } = props;
  const p = usePermissions();

  if (p.loading) return <>{fallback}</>;

  let ok = false;
  if ('perm' in props && props.perm) ok = p.can(props.perm);
  else if ('anyOf' in props && props.anyOf) ok = p.canAny(props.anyOf);
  else if ('ownerOnly' in props && props.ownerOnly) ok = p.isOwner;

  return ok ? <>{children}</> : <>{fallback}</>;
}

/* ------------------------------------------------------------------ */
/*  <AccessGuard> — page-level wrap                                    */
/* ------------------------------------------------------------------ */

interface AccessGuardProps {
  /** Single perm shortcut. */
  perm?: PermissionKey;
  /** Any-of-many shortcut. */
  anyOf?: PermissionKey[];
  /** Owner-only shortcut. */
  ownerOnly?: boolean;
  /** Or pass the full rule (used by the layout-level matcher). */
  rule?: AccessRule;
  children: React.ReactNode;
}

/**
 * Page-level access guard.
 *
 * Use at the top of each protected page. Renders a friendly
 * not-authorised panel if the current user doesn't satisfy the rule,
 * instead of letting them hit API 403s further down. Loading state
 * shows nothing (the surrounding layout already has its own skeleton).
 */
export function AccessGuard({ perm, anyOf, ownerOnly, rule, children }: AccessGuardProps) {
  const p = usePermissions();

  if (p.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-brand-border)] border-t-[var(--color-brand-primary)]" />
      </div>
    );
  }

  const resolved: AccessRule =
    rule
      ? rule
      : perm
        ? { perm }
        : anyOf
          ? { anyOf }
          : ownerOnly
            ? { ownerOnly: true }
            : { openToMembers: true };

  if (p.satisfies(resolved)) return <>{children}</>;

  return <NotAuthorisedPanel role={p.role} />;
}

function NotAuthorisedPanel({ role }: { role: FarmRole | null }) {
  return (
    <div className="mx-auto max-w-[520px] py-10">
      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-8 text-center shadow-[0_8px_30px_-12px_rgba(15,80,30,0.10)]">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldOff className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[18px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
          You don&rsquo;t have access to this page
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-brand-muted)]">
          {role === 'staff'
            ? 'Your current permissions on this farm don’t include this section. Ask the farm owner to grant you access if you need it.'
            : 'You don’t have permission to view this page on this farm.'}
        </p>
        <Button asChild size="sm" className="mt-5 h-9">
          <Link href="/home">
            <Home className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
