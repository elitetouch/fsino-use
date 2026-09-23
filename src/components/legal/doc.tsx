/**
 * Shared pieces for the legal documents.
 *
 * Extracted so terms and privacy cannot drift into two different
 * typographic systems, and so the numbering stays a real structural
 * device rather than hand-typed digits that go wrong the first time a
 * clause is inserted in the middle.
 */

export function DocTitle({
  title,
  updated,
  summary,
}: {
  title: string;
  /** ISO date. Rendered long-form — legal documents are cited by date. */
  updated: string;
  summary: string;
}) {
  return (
    <header className="border-b border-[var(--color-brand-border)] pb-6">
      <h1 className="text-[1.75rem] font-extrabold leading-tight text-[var(--color-brand-fg)]">
        {title}
      </h1>
      <p className="mt-1 text-[0.78125rem] text-[var(--color-brand-muted)]">
        Last updated{' '}
        {new Date(updated).toLocaleDateString('en-NG', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>

      {/* A plain-language summary above the document itself. Not a
          substitute for the clauses below and does not replace them —
          but almost nobody reads these top to bottom, and the people
          who skim deserve to leave with the right idea rather than
          none. */}
      <p className="mt-4 rounded-xl border border-[var(--color-brand-border)] bg-white p-4 text-[0.875rem] leading-relaxed text-[var(--color-brand-fg)]">
        {summary}
      </p>
    </header>
  );
}

export function Section({
  n,
  title,
  children,
}: {
  /** Clause number. Numbered because these ARE cited — "clause 7" has
   *  to mean something stable. */
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 scroll-mt-6" id={`clause-${n}`}>
      <h2 className="text-[1.0625rem] font-bold text-[var(--color-brand-fg)]">
        <span className="mr-2 text-[var(--color-brand-muted)] tabular-nums">{n}.</span>
        {title}
      </h2>
      <div className="mt-2 space-y-3 text-[0.875rem] leading-relaxed text-[var(--color-brand-fg)]">
        {children}
      </div>
    </section>
  );
}

/** A clause that carries real risk to the reader, lifted out of the run of text. */
export function Important({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border-l-[3px] border-[var(--color-brand-danger)] bg-[var(--color-brand-danger)]/[0.05] p-3.5">
      <div className="space-y-2 text-[0.84375rem] leading-relaxed text-[var(--color-brand-fg)]">
        {children}
      </div>
    </div>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-[var(--color-brand-primary)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Two-column term/detail list — used for the data inventory. */
export function Defs({ rows }: { rows: Array<[React.ReactNode, React.ReactNode]> }) {
  return (
    <dl className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
      {rows.map(([term, detail], i) => (
        <div key={i} className="grid gap-1 p-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-[0.8125rem] font-semibold text-[var(--color-brand-fg)]">{term}</dt>
          <dd className="text-[0.8125rem] leading-relaxed text-[var(--color-brand-muted)]">
            {detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}
