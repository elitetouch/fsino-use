'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/app/sidebar';
import { Topbar } from '@/components/app/topbar';
import { MobileDrawer } from '@/components/app/mobile-drawer';
import { VerifyEmailBanner } from '@/components/app/verify-email-banner';
import { AccessGuard, ruleForPath } from '@/lib/access';
import { readToken } from '@/lib/auth';

const TITLE_BY_PATH: Record<string, string> = {
  '/home':        'Dashboard',
  '/reports':     'Reports',
  '/farms':       'Farms',
  '/profile':     'Profile',
  '/pens-flocks': 'Pens and flocks',
  '/pens':        'Pens',
  '/flocks':      'Flocks',
  '/cycles':      'Cycles',
  '/users':       'Users',
  '/settings':    'Settings',
  '/wallet':      'Wallet',
  '/subscription':'Subscription',
  '/shop':        'Shop',
  '/about':       'About this app',
  '/contact':     'Call us',
  '/community':   'WhatsApp community',
  '/menu':        'Menu',
  '/records':     'Records',
  '/vaccines':    'Vaccines',
};

/**
 * Authenticated app shell — runs as a route group `(app)` so it doesn't
 * add a URL segment. Persistent sidebar on lg+, hamburger drawer below.
 *
 * Auth guard bounces back to /login on missing token. The actual
 * server-side enforcement is in the bearer middleware; this is a
 * UX shortcut so we don't even attempt to render the protected pages.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!readToken()) router.replace('/login');
  }, [router]);

  const title = useMemo(() => {
    if (!pathname) return undefined;
    // Exact match first, then longest prefix.
    if (TITLE_BY_PATH[pathname]) return TITLE_BY_PATH[pathname];
    const matched = Object.keys(TITLE_BY_PATH)
      .filter((p) => pathname.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    return matched ? TITLE_BY_PATH[matched] : undefined;
  }, [pathname]);

  // Layout-level route guard: every (app) page goes through this
  // single AccessGuard, keyed by the longest-prefix match in the
  // ROUTE_ACCESS table. Page bodies don't need their own guards
  // (though they can still wrap individual sections with <Gate>
  // for finer-grained button-level hiding).
  const accessRule = useMemo(() => ruleForPath(pathname), [pathname]);

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-surface-soft)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onOpenDrawer={() => setDrawer(true)} />
        <VerifyEmailBanner />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[1200px]">
            <AccessGuard rule={accessRule ?? { openToMembers: true }}>
              {children}
            </AccessGuard>
          </div>
        </main>
      </div>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
