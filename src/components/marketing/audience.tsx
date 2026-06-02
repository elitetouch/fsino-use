import { Bird, Briefcase, GraduationCap } from 'lucide-react';

const AUDIENCES = [
  {
    icon: Bird,
    title: 'Smallholder farmers',
    body: 'One pen, one notebook to retire. Run lean, see your true margin.',
  },
  {
    icon: Briefcase,
    title: 'Commercial operators',
    body: 'Multiple pens, multiple staff, one source of truth. Cost the operation, not the guess.',
  },
  {
    icon: GraduationCap,
    title: 'Training & cooperatives',
    body: 'Onboard members in minutes. Compare flock outcomes across your group.',
  },
];

export function Audience() {
  return (
    <section id="audience" className="bg-white">
      <div
        className="mx-auto px-6 py-20 sm:px-8 md:py-24 lg:px-12"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            For who
          </p>
          <h2
            className="mt-4 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
            style={{ fontSize: 'var(--text-hero)' }}
          >
            Built for every kind of poultry operation
          </h2>
        </div>

        <div className="reveal-stagger mt-14 grid gap-5 md:grid-cols-3 lg:gap-7">
          {AUDIENCES.map((a) => (
            <article
              key={a.title}
              className="reveal flex items-start gap-4 rounded-3xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-6 transition-all duration-300 hover:border-[var(--color-brand-primary)]/40"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-brand-primary-deep)] shadow-sm">
                <a.icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <h3 className="text-base font-bold text-[var(--color-brand-fg)]">{a.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-brand-muted)]">{a.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
