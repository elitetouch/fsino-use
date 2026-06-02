const STEPS = [
  {
    number: '01',
    title: 'Create your farm',
    body: 'Add your farm name, location and pens in under a minute. We pre-load your country\'s vaccination programme.',
  },
  {
    number: '02',
    title: 'Add your flocks',
    body: 'Place birds, pick a breed, set hatch date. We generate your vaccine schedule from day one.',
  },
  {
    number: '03',
    title: 'Log each day, watch margins grow',
    body: 'Daily records take less than a minute. By end of cycle, you know your true cost-per-bird and FCR.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-[var(--color-brand-surface-soft)]">
      <div
        className="mx-auto px-6 py-20 sm:px-8 md:py-28 lg:px-12 lg:py-32"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            How it works
          </p>
          <h2
            className="mt-4 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
            style={{ fontSize: 'var(--text-hero)' }}
          >
            Set up in 5 minutes. Run forever.
          </h2>
        </div>

        <div className="reveal-stagger mt-16 grid gap-6 md:grid-cols-3 lg:mt-20">
          {STEPS.map((s, i) => (
            <article
              key={s.number}
              className="reveal relative overflow-hidden rounded-3xl border border-[var(--color-brand-border)] bg-white p-8"
            >
              {/* Connector line between cards on desktop */}
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute right-0 top-1/2 hidden h-px w-12 -translate-y-1/2 translate-x-full bg-gradient-to-r from-[var(--color-brand-primary)]/30 to-transparent md:block"
                />
              )}

              <p className="font-extrabold tracking-tight text-[var(--color-brand-primary)]/30" style={{ fontSize: 'var(--text-hero)' }}>
                {s.number}
              </p>
              <h3 className="mt-3 text-xl font-bold tracking-tight text-[var(--color-brand-fg)]">
                {s.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-muted)]">
                {s.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
