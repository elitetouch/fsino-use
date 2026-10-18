import { MarketingNav } from '@/components/marketing/nav';
import { MarketingFooter } from '@/components/marketing/footer';
import { AndroidInstallBar } from '@/components/marketing/android-install-bar';

/**
 * Shell for the legal documents — terms, privacy, account deletion.
 *
 * PUBLIC, AND IT HAS TO BE. All three are linked from the registration
 * form, which nobody has an account on yet — putting them inside (app)
 * would bounce a prospective user to a login to read the terms they are
 * being asked to accept.
 *
 * SAME CHROME AS THE LANDING PAGE, deliberately. These are the pages a
 * Play reviewer, a prospective customer and a data subject each arrive
 * on directly, often as their first sight of the company — and a page
 * carrying no logo reads as a different site than the one that sent
 * them there. An earlier version used a bare text link for the opposite
 * reason, that no chrome competes with the text; an unbranded legal
 * page turned out to cost more trust than a nav bar costs attention.
 *
 * The CONTENT column stays at 44rem while the chrome runs full width.
 * Legal prose set to the marketing container's width runs past 120
 * characters a line, which is roughly double what these documents are
 * written for.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    // flex column + flex-1 on main so the footer sits at the bottom of
    // the viewport on short pages (delete-account is well under a
    // screen on desktop) rather than floating mid-page.
    <div className="flex min-h-screen flex-col bg-[var(--color-brand-bg)]">
      <MarketingNav />

      {/* prose-ish spacing set here rather than per page, so the three
          documents cannot drift apart typographically. */}
      <main className="mx-auto w-full max-w-[44rem] flex-1 px-5 py-10 pb-20">{children}</main>

      <MarketingFooter />
      {/* Android phones only, after 600px of scroll, dismissible. */}
      <AndroidInstallBar />
    </div>
  );
}
