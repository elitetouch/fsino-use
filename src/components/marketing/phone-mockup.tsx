import { Bell, Egg, Syringe, Wheat, Plus, ChevronRight } from 'lucide-react';

/**
 * Mobile-app phone mockup — pure CSS frame with an illustrative
 * dashboard screen inside. Uses a modern bezel-less phone shape
 * (notch, status bar, rounded corners) and the same brand palette as
 * the web app so the dual-platform story reads as one product.
 */
export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[300px] sm:max-w-[340px]">
      {/* Phone frame */}
      <div className="relative rounded-[44px] border border-[var(--color-brand-border)] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] p-2 shadow-[0_30px_80px_-20px_rgba(15,80,30,0.35)]">
        {/* Inner screen */}
        <div className="relative overflow-hidden rounded-[36px] bg-[var(--color-brand-surface-soft)]">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-2.5 pb-1 text-[10px] font-semibold text-[var(--color-brand-fg)]">
            <span>9:41</span>
            <div className="absolute left-1/2 top-1 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-brand-fg)]" />
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-brand-fg)]" />
              <span className="inline-block h-2 w-3 rounded-sm border border-[var(--color-brand-fg)]" />
            </div>
          </div>

          {/* App header */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-muted)]">
                  Good morning
                </p>
                <p className="text-[18px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
                  Samuel 👋
                </p>
              </div>
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
                <Bell className="h-4 w-4 text-[var(--color-brand-fg-soft)]" />
                <span className="absolute -right-0.5 -top-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--color-brand-primary)]" />
              </div>
            </div>
          </div>

          {/* Today summary card */}
          <div className="mx-4 mt-2 rounded-[20px] bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] p-4 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                Today
              </p>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                4 tasks
              </span>
            </div>
            <p className="mt-2 text-[22px] font-extrabold leading-tight">
              2 vaccines, 1 weigh-in, 1 feed top-up
            </p>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-white/90">
              See plan <ChevronRight className="h-3 w-3" />
            </div>
          </div>

          {/* Quick log row */}
          <div className="mx-4 mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-muted)]">
              Quick log
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[
                { icon: Wheat,   label: 'Feed' },
                { icon: Egg,     label: 'Eggs' },
                { icon: Syringe, label: 'Vacc.' },
                { icon: Plus,    label: 'More' },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-[var(--color-brand-border)] bg-white py-2.5 transition-transform active:scale-95"
                >
                  <q.icon className="h-4 w-4 text-[var(--color-brand-primary-deep)]" />
                  <span className="text-[10px] font-semibold text-[var(--color-brand-fg)]">{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Flock card */}
          <div className="mx-4 mb-5 mt-4 rounded-[20px] border border-[var(--color-brand-border)] bg-white p-3.5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-muted)]">
                  Flock · Pen 4
                </p>
                <p className="mt-0.5 text-[14px] font-bold text-[var(--color-brand-fg)]">
                  Broiler · Cobb 500
                </p>
                <p className="text-[10px] text-[var(--color-brand-muted)]">
                  Day 21/42 · 1,485 birds
                </p>
              </div>
              <span className="rounded-full bg-[var(--color-brand-accent)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
                Healthy
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-accent)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)]"
                style={{ width: '50%' }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['Feed today', '124 kg'],
                ['FCR', '1.68'],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-[var(--color-brand-surface-soft)] px-2.5 py-1.5">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">{l}</p>
                  <p className="mt-0.5 text-[12px] font-bold text-[var(--color-brand-fg)]">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side button + volume rocker — tiny visual flourish */}
        <span aria-hidden className="absolute -right-[3px] top-32 h-12 w-[3px] rounded-r-full bg-[#0d0d0d]" />
        <span aria-hidden className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l-full bg-[#0d0d0d]" />
        <span aria-hidden className="absolute -left-[3px] top-36 h-14 w-[3px] rounded-l-full bg-[#0d0d0d]" />
      </div>
    </div>
  );
}
