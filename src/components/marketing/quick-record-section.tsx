import { QuickRecordDemo } from './quick-record-demo';

/**
 * The one section on this page that shows rather than tells.
 *
 * Everything else here makes a claim. This runs the product's own
 * parser on a sentence as it is typed, so a visitor watches the thing
 * work before they are asked for an email address.
 */
const POINTS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'One sentence, every book',
    body: 'Deaths, feed, what you spent and what you sold, all from the way a farmer already talks. The app sorts it. You tap save.',
  },
  {
    title: 'Nigerian English, Nigerian prices',
    body: 'Pidgin is fine. 45k, forty-five thousand or ₦45,000 all mean the same thing, and it learns the words you actually say.',
  },
  {
    title: 'It tells you what it cost',
    body: 'Not just that you spent money, but what it does to this cycle. Per bird, and where your feed bill now stands.',
  },
  {
    title: 'No signal, no problem',
    body: 'Everything saves on the phone first and uploads by itself when the network comes back. Nothing waits on a bar of signal.',
  },
];

export function QuickRecordSection() {
  return (
    <section id="quick-record" className="relative overflow-hidden bg-white">
      <div
        className="mx-auto px-6 py-20 sm:px-8 md:py-28 lg:px-12 lg:py-32"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div className="reveal mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            Quick record
          </p>
          <h2
            className="mt-4 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
            style={{ fontSize: 'var(--text-hero)' }}
          >
            Just say what happened.
          </h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-[var(--color-brand-muted)]">
            Talk or type one sentence. Your mortality, feed, expenses and sales
            all land in the right place, even with no network.
          </p>
        </div>

        <div className="mt-14 grid items-center gap-12 lg:mt-20 lg:grid-cols-2 lg:gap-16">
          <div className="reveal order-2 lg:order-1">
            <dl className="grid gap-7 sm:grid-cols-2 lg:grid-cols-1">
              {POINTS.map((p) => (
                <div key={p.title}>
                  <dt className="text-[0.9375rem] font-bold text-[var(--color-brand-fg)]">
                    {p.title}
                  </dt>
                  <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-[var(--color-brand-muted)]">
                    {p.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="reveal order-1 lg:order-2">
            <QuickRecordDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
