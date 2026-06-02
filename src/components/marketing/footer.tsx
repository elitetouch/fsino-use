import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { brand } from '@/config/brand';

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]">
      <div
        className="mx-auto grid gap-10 px-6 py-14 sm:px-8 md:grid-cols-[2fr_1fr_1fr_1fr] lg:px-12 lg:py-16"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div>
          <Logo size={132} />
          <p className="mt-4 max-w-xs text-sm text-[var(--color-brand-muted)]">
            One app for every flock. Track feed, vaccines, and finances —
            built with African poultry farmers, for African poultry farmers.
          </p>
        </div>

        {[
          {
            heading: 'Product',
            links: [
              ['Features', '#features'],
              ['How it works', '#how'],
              ['Pricing', '/pricing'],
            ],
          },
          {
            heading: 'Company',
            links: [
              ['About', '/about'],
              ['Contact', 'mailto:support@fsinnovation.net'],
              ['Careers', '/careers'],
            ],
          },
          {
            heading: 'Legal',
            links: [
              ['Terms', '/legal/terms'],
              ['Privacy', '/legal/privacy'],
              ['Cookies', '/legal/cookies'],
            ],
          },
        ].map((col) => (
          <div key={col.heading}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-muted)]">
              {col.heading}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-[var(--color-brand-fg-soft)] underline-offset-4 hover:underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--color-brand-border)]">
        <div
          className="mx-auto flex flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-[var(--color-brand-muted)] sm:flex-row sm:px-8 lg:px-12"
          style={{ maxWidth: 'var(--container-page)' }}
        >
          <p>© {year} {brand.name}. All rights reserved.</p>
          <p>Made in Nigeria, for poultry farmers across Africa.</p>
        </div>
      </div>
    </footer>
  );
}
