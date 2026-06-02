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
        'group relative overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-brand-primary)]/40 hover:shadow-[0_20px_50px_-25px_rgba(15,80,30,0.20)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105', TONE_BG[tone])}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-muted-soft)]">
          {label}
        </p>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-[28px] font-extrabold tracking-tight text-[var(--color-brand-fg)] sm:text-3xl">
          {value}
        </p>
        {trend && (
          <span className={cn('shrink-0 pb-1 text-[11px] font-semibold uppercase tracking-wider', TREND_TONE[trend.tone ?? 'neutral'])}>
            {trend.value}
          </span>
        )}
      </div>
      {sub && (
        <p className="mt-1 text-xs text-[var(--color-brand-muted)]">{sub}</p>
      )}
    </div>
  );
}
