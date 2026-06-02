'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/app/sidebar';
import { Topbar } from '@/components/app/topbar';
import { MobileDrawer } from '@/components/app/mobile-drawer';
import { readToken } from '@/lib/auth';

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
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!readToken()) router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[var(--color-brand-surface-soft)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenDrawer={() => setDrawer(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}
