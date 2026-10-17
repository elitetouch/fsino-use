import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';

/**
 * Shell for the public marketing pages that are not the landing page.
 *
 * WHY THIS GROUP EXISTS — /about used to sit under (app), whose layout
 * does `if (!readToken()) router.replace('/login')`. Its own docblock
 * said the page was there so "farmers, investors and grant funders"
 * could land on it, which is precisely the audience that has no token
 * and was therefore bounced to a login screen. The marketing nav links
 * to it, so every logged-out visitor who clicked About hit /login.
 *
 * Route groups do not appear in the URL, so /about is still /about: the
 * in-app menu entry, the deep links and anything already shared keep
 * working. What changes is that logged-in users now see the marketing
 * chrome on it rather than the app shell — acceptable for a page whose
 * content is a pitch, not a tool.
 *
 * Wider than the legal column (which is set for long prose at ~70
 * characters) and narrower than the landing page's full-bleed sections.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-brand-bg)]">
      <MarketingNav />
      <main className="mx-auto w-full max-w-[64rem] flex-1 px-5 py-10 pb-20 sm:px-8">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
