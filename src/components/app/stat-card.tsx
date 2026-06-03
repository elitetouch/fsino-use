import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  /** Optional trend hint — "+12%", "↓3 vs yesterday", etc. */
  trend?: { value: string; tone?: 'positive' | 'negative' | 'neutral' };
  /** Tone of the icon chip. Default = mint (brand accent). */
  tone?: 'mint' | 'amber' | 'sky' | 'rose';
  className?: string;
}

const TONE_BG: Record<NonNullable<Props['tone']>, string> = {
  mint:  'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
  amber: 'bg-amber-50 text-amber-700',
  sky:   'bg-sky-50 text-sky-700',
  rose:  'bg-rose-50 text-rose-700',
};

const TREND_TONE: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: 'text-[var(--color-brand-primary-deep)]',
  negative: 'text-rose-600',
  neutral:  'text-[var(--color-brand-muted)]',
};

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  tone = 'mint',
  className,
}: Props) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white p-4 transition-all duration-200 hover:border-[var(--color-brand-primary)]/40 hover:shadow-[0_8px_24px_-12px_rgba(15,80,30,0.12)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', TONE_BG[tone])}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted-soft)]">
          {label}
        </p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-[20px] font-bold leading-none tracking-tight text-[var(--color-brand-fg)] sm:text-[22px]">
          {value}
        </p>
        {trend && (
          <span className={cn('shrink-0 pb-0.5 text-[10px] font-semibold uppercase tracking-wider', TREND_TONE[trend.tone ?? 'neutral'])}>
            {trend.value}
          </span>
        )}
      </div>
      {sub && (
        <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">{sub}</p>
      )}
    </div>
  );
}
