import Link from 'next/link';
import { ArrowRight, Globe, Smartphone, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhoneMockup } from './phone-mockup';

/**
 * "Available everywhere" platforms section — positions the product as
 * one brand on two surfaces (web app + mobile app). Phone mockup on
 * the left at lg+, copy + dual CTAs on the right. Sub-features below
 * communicate the sync story: same account, same data, anywhere.
 */
export function Platforms() {
  return (
    <section id="platforms" className="relative overflow-hidden bg-white">
      {/* Subtle mint blob */}
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -left-32 top-32 hidden h-96 w-96 rounded-full bg-[var(--color-brand-accent)] opacity-40 blur-3xl md:block"
      />

      <div
        className="relative mx-auto grid items-center gap-12 px-6 py-20 sm:px-8 md:py-28 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:px-12 lg:py-32"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* LEFT — phone mockup */}
        <div className="reveal order-2 lg:order-1">
          <PhoneMockup />
        </div>

        {/* RIGHT — copy + CTAs */}
        <div className="reveal order-1 lg:order-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            Available everywhere
          </p>
          <h2
            className="mt-4 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
            style={{ fontSize: 'var(--text-hero)' }}
          >
            One account.{' '}
            <span className="bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] bg-clip-text text-transparent">
              Web or phone.
            </span>
          </h2>
          <p
            className="mt-5 max-w-[52ch] leading-relaxed text-[var(--color-brand-muted)]"
            style={{ fontSize: 'var(--text-lead)' }}
          >
            Plan and review from the laptop in the office. Log feed, weigh-ins
            and vaccines on the phone in the pen. Same data, same farm — your
            staff are never out of sync.
          </p>

          {/* Feature rail */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Globe,     title: 'Use any browser',   body: 'Chrome, Safari, Edge. No install.' },
              { icon: Smartphone, title: 'Android app',       body: 'Free on the Play Store.' },
              { icon: RefreshCw, title: 'Auto-sync',         body: 'Records on one device show on all.' },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-3.5"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-brand-primary-deep)] shadow-sm">
                  <f.icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{f.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-brand-muted)]">{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dual CTAs */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="group h-14 px-6 text-[15px] sm:h-[60px]">
              <Link href="/register">
                Open the web app
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <PlayStoreLink />
          </div>

          {/* Offline hint — now true for both surfaces */}
          <p className="mt-5 flex items-center gap-2 text-xs text-[var(--color-brand-muted)]">
            <Wifi className="h-3.5 w-3.5" />
            Works offline on web and Android — logs sync the moment you reconnect.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Inline Play Store link styled to match the primary button geometry
 * (h-14 → 60 desktop, full-pill) but in the dark "Get it on Google
 * Play" treatment. Imported here so the file stays self-contained.
 */
function PlayStoreLink() {
  const PLAY_STORE_URL =
    process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? 'https://play.google.com/store';
  return (
    <Link
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get it on Google Play"
      className="group inline-flex h-14 items-center gap-3 rounded-full bg-[var(--color-brand-fg)] px-5 text-white transition-all duration-200 hover:bg-black active:scale-[0.98] sm:h-[60px] sm:px-6"
    >
      <svg width="22" height="24" viewBox="0 0 22 24" fill="none" aria-hidden className="transition-transform group-hover:scale-105">
        <path d="M0.5 1.2 L0.5 22.8 L11.3 12 Z" fill="#34A853" />
        <path d="M0.5 1.2 L15.5 9.6 L11.3 12 Z" fill="#FBBC04" />
        <path d="M0.5 22.8 L15.5 14.4 L11.3 12 Z" fill="#EA4335" />
        <path d="M15.5 9.6 L20.5 12 L15.5 14.4 L11.3 12 Z" fill="#4285F4" />
      </svg>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
          Get it on
        </span>
        <span className="text-[15px] font-semibold tracking-tight">Google Play</span>
      </span>
    </Link>
  );
}
