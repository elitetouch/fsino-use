import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Shell for the terms and privacy pages.
 *
 * PUBLIC, AND IT HAS TO BE. Both are linked from the registration form,
 * which nobody has an account on yet — putting them inside (app) would
 * bounce a prospective user to a login to read the terms they are being
 * asked to accept.
 *
 * Plain by design: one narrow column, no product chrome, no navigation
 * to get lost in. Somebody reading these is looking for one clause, and
 * anything that competes with the text is in the way.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <header className="border-b border-[var(--color-brand-border)] bg-white">
        <div className="mx-auto flex max-w-[44rem] items-center gap-3 px-5 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Farm Support Innovation
          </Link>
        </div>
      </header>

      {/* prose-ish spacing set here rather than per page, so the two
          documents cannot drift apart typographically. */}
      <main className="mx-auto max-w-[44rem] px-5 py-10 pb-20">{children}</main>

      <footer className="border-t border-[var(--color-brand-border)] bg-white">
        <div className="mx-auto flex max-w-[44rem] flex-wrap items-center justify-between gap-3 px-5 py-5 text-[0.78125rem] text-[var(--color-brand-muted)]">
          <span>FS Innovation is registered in Nigeria</span>
          <span className="flex gap-4">
            <Link href="/legal/terms" className="hover:text-[var(--color-brand-fg)]">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-[var(--color-brand-fg)]">
              Privacy
            </Link>
            <a
              href="mailto:support@fsinnovation.net"
              className="hover:text-[var(--color-brand-fg)]"
            >
              Contact
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
