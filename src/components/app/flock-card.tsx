import Link from 'next/link';
import { ChevronRight, Bird } from 'lucide-react';
import type { FlockDto } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Active flock summary card — used in the dashboard grid + flocks list.
 *
 * Computes cycle progress from age vs production-type baseline:
 *   broiler   → 42 days
 *   layer     → 72 weeks → 504 days
 *   dual_purpose → 120 days
 */
const CYCLE_BASELINES: Record<FlockDto['productionType'], number> = {
  broiler: 42,
  layer: 504,
  dual_purpose: 120,
};

export function FlockCard({ flock, className }: { flock: FlockDto; className?: string }) {
  const baseline = CYCLE_BASELINES[flock.productionType] ?? 42;
  const age = flock.ageDays ?? 0;
  const pct = Math.min(100, Math.max(0, Math.round((age / baseline) * 100)));
  const remaining = Math.max(0, baseline - age);
  const birds = flock.currentBirds ?? flock.placedBirds ?? 0;

  return (
    <Link
      href={`/flocks/${flock.id}`}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-brand-primary)]/40 hover:shadow-[0_20px_50px_-25px_rgba(15,80,30,0.20)]',
        className,
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
              <Bird className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-[var(--color-brand-fg)]">
                {flock.breed}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted)]">
                {labelForProduction(flock.productionType)}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-muted-soft)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-primary-deep)]" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Birds" value={birds.toLocaleString()} />
          <Stat label="Day" value={`${age}/${baseline}`} />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--color-brand-muted)]">
            <span>Cycle</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--color-brand-accent)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {remaining > 0 && (
            <p className="mt-1.5 text-[10px] text-[var(--color-brand-muted)]">
              {remaining} days to go
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted-soft)]">{label}</p>
      <p className="mt-0.5 text-[14px] font-bold text-[var(--color-brand-fg)]">{value}</p>
    </div>
  );
}

function labelForProduction(t: FlockDto['productionType']): string {
  return t === 'broiler' ? 'Broiler' : t === 'layer' ? 'Layer' : 'Dual-purpose';
}
