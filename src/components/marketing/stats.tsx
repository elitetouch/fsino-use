export function StatsBar() {
  const stats: Array<{ value: string; label: string }> = [
    { value: '7', label: 'African countries served' },
    { value: '1,000+', label: 'Flocks tracked' },
    { value: '5★', label: 'Average farmer rating' },
    { value: '24/7', label: 'Records always with you' },
  ];

  return (
    <section className="border-y border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]">
      <div
        className="reveal-stagger mx-auto grid grid-cols-2 gap-y-8 px-6 py-10 sm:px-8 md:grid-cols-4 md:py-12 lg:px-12"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        {stats.map((s) => (
          <div key={s.label} className="reveal text-center">
            <p
              className="font-extrabold tracking-tight text-[var(--color-brand-primary-deep)]"
              style={{ fontSize: 'var(--text-h1)' }}
            >
              {s.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
