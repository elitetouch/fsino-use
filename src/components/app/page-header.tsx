import { cn } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page header for every authenticated page. Eyebrow line
 * (small uppercase brand-green label) + big bold title + optional
 * supporting copy. Right-side slot for actions (buttons / filters).
 */
export function PageHeader({ title, description, eyebrow, actions, className }: Props) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-1 font-extrabold leading-tight tracking-tight text-[var(--color-brand-fg)]"
          style={{ fontSize: 'var(--text-h1)' }}
        >
          {title}
        </h1>
        {description && (
          <p
            className="mt-2 max-w-[60ch] text-[var(--color-brand-muted)]"
            style={{ fontSize: 'var(--text-lead)' }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
