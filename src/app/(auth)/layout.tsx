import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Sprout, Wallet } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { brand } from '@/config/brand';

/**
 * Auth-flow shell.
 *
 *   320–1023px : sticky mobile header (back + small logo), form fills column.
 *   1024–1535px: split — green brand sidebar left, form column right.
 *   1536–1919px: split with richer brand panel — bigger logo, third
 *                trust tile, more breathing room.
 *   ≥1920px    : capped container centered, green frame on either side.
 *
 * The form column scales gracefully — caps at max-w-md so reading line
 * length never blows past 65 characters on a 4K monitor.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative min-h-screen w-full"
      style={{
        background:
          'linear-gradient(160deg, #0f7c39 0%, #0a4d24 60%, #062c0d 100%)',
      }}
    >
      <div
        className="relative mx-auto grid min-h-screen w-full lg:grid-cols-[1fr_1.1fr] xl:grid-cols-[1fr_1.15fr]"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* Mobile/tablet header — replaced by brand sidebar at lg+. */}
        <header className="sticky top-0 z-20 col-span-full flex items-center justify-between border-b border-[var(--color-brand-border)]/70 bg-white/85 px-5 py-3 backdrop-blur lg:hidden">
          <Link
            href="/"
            aria-label="Back"
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-accent)]/40"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Logo size={92} />
          <span className="h-10 w-10" aria-hidden />
        </header>

        {/* ──────────────── DESKTOP BRAND PANEL ──────────────── */}
        <aside
          className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16 3xl:p-20"
          style={{
            background:
              'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
          }}
        >
          {/* Mesh + grain */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(50% 35% at 18% 12%, rgba(167, 243, 194, 0.22) 0%, transparent 60%),
                radial-gradient(45% 30% at 85% 85%, rgba(255, 255, 255, 0.12) 0%, transparent 65%)
              `,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          <Link href="/" aria-label="Home" className="relative z-10">
            <Logo
              tone="white"
              size={160}
              className="xl:!w-[190px] 3xl:!w-[210px]"
            />
          </Link>

          <div className="relative z-10 max-w-md xl:max-w-lg">
            <h2
              className="font-extrabold tracking-tight"
              style={{ fontSize: 'var(--text-h1)' }}
            >
              {brand.tagline}
            </h2>
            <p
              className="mt-4 leading-relaxed text-white/85"
              style={{ fontSize: 'var(--text-lead)' }}
            >
              One app for every flock. Track feed, vaccines, and finances
              in minutes a day — built with African poultry farmers, for
              African poultry farmers.
            </p>

            <ul className="mt-8 space-y-4 xl:mt-10 xl:space-y-5">
              {AUTH_TRUST.map((t) => (
                <li key={t.label} className="flex items-start gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur xl:h-10 xl:w-10">
                    <t.icon className="h-4 w-4 text-white xl:h-5 xl:w-5" strokeWidth={2.4} />
                  </span>
                  <div>
                    <p className="font-semibold text-white xl:text-[15px]">{t.label}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-white/75 xl:text-sm">
                      {t.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative z-10 text-[11px] uppercase tracking-[0.22em] text-white/60">
            © {new Date().getFullYear()} {brand.name}
          </p>
        </aside>

        {/* ──────────────── FORM COLUMN ──────────────── */}
        <section className="flex flex-col bg-[var(--color-brand-bg)]">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12 lg:max-w-md lg:items-center lg:justify-center lg:px-12 lg:py-16 xl:max-w-lg xl:px-16 3xl:max-w-xl">
            <div className="w-full">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

const AUTH_TRUST = [
  {
    icon: Sprout,
    label: 'Built for African farms',
    desc: 'Breeds, vaccines and prices tuned for each country.',
  },
  {
    icon: Wallet,
    label: 'See where the money goes',
    desc: 'Real cost-per-bird, FCR, margin per flock.',
  },
  {
    icon: ShieldCheck,
    label: 'Your data stays yours',
    desc: 'Encrypted at rest, never sold, exportable any time.',
  },
];
