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
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
            {eyebrow}
          </p>
        )}
        <h1
          className="mt-1 text-[18px] font-bold leading-tight tracking-tight text-[var(--color-brand-fg)] sm:text-[20px]"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-[var(--color-brand-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
