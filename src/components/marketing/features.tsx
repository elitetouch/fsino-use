import { CalendarCheck2, TrendingUp, ShieldCheck, Users2, FileBarChart2, Bell } from 'lucide-react';

const FEATURES = [
  {
    icon: CalendarCheck2,
    title: 'Daily records, done in seconds',
    body: 'Feed, water, vaccinations, mortality, bird count — log everything from the same screen, no spreadsheets.',
  },
  {
    icon: TrendingUp,
    title: 'See where the money goes',
    body: 'Real cost-per-bird, FCR and margin per flock. Know which pen is making you money — and which one is bleeding.',
  },
  {
    icon: ShieldCheck,
    title: 'Country-tuned vaccination',
    body: 'Programmes built with NVRI, KEVEVAPI, CLEVB and country veterinary boards. Reminders before each due day.',
  },
  {
    icon: Users2,
    title: 'Work as a team',
    body: 'Invite your farm manager and field staff. Everyone records on their own phone — you see one source of truth.',
  },
  {
    icon: FileBarChart2,
    title: 'Reports for the bank',
    body: 'Export production, cost and inventory reports as PDF or CSV. Pitch loans and grants with real numbers.',
  },
  {
    icon: Bell,
    title: 'Never miss a vaccine',
    body: 'Smart alerts a day before, on the day, and if you skip. Critical vaccines flagged so flock loss is rare.',
  },
];

export function Features() {
  return (
    <section id="features" className="relative overflow-hidden bg-white">
      <div
        className="mx-auto px-6 py-20 sm:px-8 md:py-28 lg:px-12 lg:py-32"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            What you get
          </p>
          <h2
            className="mt-4 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
            style={{ fontSize: 'var(--text-hero)' }}
          >
            Everything you need to run a tighter flock
          </h2>
          <p
            className="mt-4 text-[var(--color-brand-muted)]"
            style={{ fontSize: 'var(--text-lead)' }}
          >
            Six tools that turn a notebook full of guesses into a farm that
            knows itself.
          </p>
        </div>

        <div className="reveal-stagger mt-16 grid gap-5 md:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-6">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="reveal group relative overflow-hidden rounded-3xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-primary)]/40 hover:shadow-[0_20px_50px_-25px_rgba(15,80,30,0.30)]"
            >
              {/* Soft mint glow on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(60% 70% at 50% 0%, rgba(167, 243, 194, 0.35) 0%, transparent 70%)',
                }}
              />

              <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)] transition-transform duration-300 group-hover:scale-105">
                <f.icon className="h-6 w-6" strokeWidth={2.2} />
              </div>

              <h3 className="relative mt-5 text-lg font-bold tracking-tight text-[var(--color-brand-fg)]">
                {f.title}
              </h3>
              <p className="relative mt-2 text-[15px] leading-relaxed text-[var(--color-brand-muted)]">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
