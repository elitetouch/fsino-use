'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Egg, Wheat, Syringe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlayStoreButton } from './play-store-button';

/**
 * Marketing hero — left column holds the headline + CTA, right column
 * holds a "product preview" card visualising a flock card. Both columns
 * stack on phones and read with a single focal element at each width.
 *
 * The product preview is intentionally illustrative (not a screenshot)
 * because the actual app UI changes; an illustrative card communicates
 * the value (track feed/vaccines/eggs) without coupling marketing to
 * the live UI.
 */
export function MarketingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background mesh — subtle mint blooms */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(60% 50% at 15% 0%, rgba(167, 243, 194, 0.45) 0%, transparent 60%),
            radial-gradient(50% 40% at 85% 100%, rgba(167, 243, 194, 0.35) 0%, transparent 60%)
          `,
        }}
      />
      {/* Animated soft blob */}
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -right-32 top-24 hidden h-96 w-96 rounded-full bg-[var(--color-brand-accent-strong)] opacity-40 blur-3xl md:block"
      />

      <div
        className="relative mx-auto grid items-center gap-12 px-6 pt-12 pb-20 sm:px-8 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:px-12 lg:pt-24 lg:pb-32"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {/* LEFT — copy */}
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-accent)] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-brand-primary)]" />
            Built for African poultry farmers
          </span>

          <h1
            className="mt-6 font-extrabold leading-[1.02] tracking-tight text-[var(--color-brand-fg)]"
            style={{ fontSize: 'var(--text-display)' }}
          >
            Run a tighter farm.{' '}
            <span className="bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] bg-clip-text text-transparent">
              Lose less money.
            </span>
          </h1>

          <p
            className="mt-6 max-w-[58ch] leading-relaxed text-[var(--color-brand-muted)]"
            style={{ fontSize: 'var(--text-lead)' }}
          >
            Track every flock, every feed bag, every vaccine in minutes a day.
            On the web in the office, on Android in the pen — one account,
            always in sync.
          </p>

          {/* Dual CTA: web app sign-up + Play Store. Both have equal
              visual weight so we don't favour one surface over the other. */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <Button asChild size="lg" className="group h-14 px-7 text-[16px] sm:h-[60px]">
              <Link href="/register">
                Start on the web
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <PlayStoreButton />
          </div>

          <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--color-brand-muted)]">
            {['Free to start', 'No card required', '5-minute setup'].map((line) => (
              <li key={line} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-brand-primary)]" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT — illustrative product preview */}
        <div className="animate-fade-up [animation-delay:120ms] lg:justify-self-end">
          <FlockPreviewCard />
        </div>
      </div>
    </section>
  );
}

/**
 * Illustrative "flock card" — communicates what the app tracks without
 * coupling to live UI. Big enough to read on a phone, scales with the
 * column.
 */
function FlockPreviewCard() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* Floating chip behind the card */}
      <div
        aria-hidden
        className="animate-float absolute -left-6 -top-6 hidden rounded-2xl border border-[var(--color-brand-border)] bg-white px-4 py-3 shadow-[0_10px_30px_-15px_rgba(15,80,30,0.25)] md:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">Today</p>
        <p className="mt-1 text-base font-bold text-[var(--color-brand-fg)]">2 vaccines due</p>
      </div>

      <div className="relative rounded-[28px] border border-[var(--color-brand-border)] bg-white p-6 shadow-[0_30px_80px_-30px_rgba(15,80,30,0.25)] sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">
              Flock · Pen 4
            </p>
            <p className="mt-1 text-lg font-bold text-[var(--color-brand-fg)]">Broiler · Cobb 500</p>
            <p className="mt-0.5 text-xs text-[var(--color-brand-muted)]">Day 21 of 42 · 1,485 birds</p>
          </div>
          <span className="rounded-full bg-[var(--color-brand-accent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
            Healthy
          </span>
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-brand-muted)]">
            <span>Cycle</span>
            <span>50%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-brand-accent)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)]"
              style={{ width: '50%' }}
            />
          </div>
        </div>

        {/* Metric grid */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Wheat,   label: 'Feed today',   value: '124 kg' },
            { icon: Egg,     label: 'Mortality',    value: '0.4%' },
            { icon: Syringe, label: 'Next vaccine', value: 'In 2 days' },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-3"
            >
              <m.icon className="h-4 w-4 text-[var(--color-brand-primary-deep)]" />
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted)]">
                {m.label}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[var(--color-brand-fg)]">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Cost line */}
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-[var(--color-brand-primary-dark)] px-4 py-3 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Cost / bird so far
            </p>
            <p className="mt-0.5 text-lg font-bold">₦ 1,840</p>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
            ↓ 6% vs last
          </span>
        </div>
      </div>

      {/* Floating chip in front */}
      <div
        aria-hidden
        className="animate-float [animation-delay:1.5s] absolute -bottom-5 -right-3 hidden rounded-2xl border border-[var(--color-brand-border)] bg-white px-4 py-3 shadow-[0_10px_30px_-15px_rgba(15,80,30,0.25)] md:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">FCR</p>
        <p className="mt-1 text-base font-bold text-[var(--color-brand-fg)]">1.68</p>
      </div>
    </div>
  );
}
