'use client';

import {
  Bird, Droplet, Skull, Syringe, Wheat, ChevronRight, Egg, type LucideIcon,
} from 'lucide-react';
import type { FlockDto } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Cards shown on the cycle-results dashboard. Mirror the mobile
 * dashboard exactly (Leghorn summary → Feed consumption → Water →
 * Mortality → Egg collection → Vaccination), but scaled and laid out
 * for the web's wider canvas.
 *
 * For metrics we don't yet have a backend feed for, the cards render
 * a clean empty state ("Tracks once you log records") so the layout
 * stays complete and the feature roadmap is implicit.
 */

// ────────────── BREED SUMMARY CARD ──────────────

export function BreedSummaryCard({ flock }: { flock: FlockDto }) {
  const days = flock.ageDays ?? 0;
  return (
    <Card className="lg:col-span-2">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Bird className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-bold text-[var(--color-brand-fg)]">{flock.breed}</p>
            <span className="shrink-0 rounded-md bg-[var(--color-brand-primary-dark)] px-2 py-0.5 text-[11px] font-bold text-white">
              {flock.placedBirds.toLocaleString()} birds
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
            {labelForProduction(flock.productionType)}.{' '}
            <strong className="text-[var(--color-brand-fg)]">{days} days old</strong>.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ────────────── FEED CONSUMPTION ──────────────

export function FeedConsumptionCard({ fcr }: { fcr?: number | null }) {
  // Visual FCR meter — broiler good FCR is roughly 1.4–1.8.
  // We translate any FCR into a 0–1 progress on the bar.
  const value = fcr ?? null;
  const pct = value == null ? null : Math.max(0, Math.min(1, (value - 1.2) / 1.4)) * 100;

  return (
    <Card>
      <CardHeader icon={Wheat} title="Feed consumption" />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {value == null
          ? 'Log feed records to compute your conversion rate.'
          : 'Your birds show a healthy feed conversion rate.'}
      </p>

      <div className="mt-4">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
          Feed conversion rate (FCR)
        </p>
        <div className="relative h-7">
          <div className="absolute inset-y-0 left-0 right-0 my-auto h-2 overflow-hidden rounded-full bg-gradient-to-r from-rose-200 via-amber-200 to-emerald-300">
            <div className="absolute inset-0 opacity-0" />
          </div>
          {value != null && pct != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-md bg-[var(--color-brand-primary)] px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm"
              style={{ left: `${pct}%` }}
            >
              {value.toFixed(2)}
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-[var(--color-brand-muted-soft)]">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      <CardFooter href="#" label="Edit record" />
    </Card>
  );
}

// ────────────── WATER CONSUMPTION ──────────────

export function WaterConsumptionCard({
  daily,
}: {
  daily?: Array<{ date: string; ml: number }> | null;
}) {
  const items = daily ?? [];
  const empty = items.length === 0;

  return (
    <Card>
      <CardHeader
        icon={Droplet}
        title="Water consumption"
        rightSlot={
          !empty && (
            <span className="rounded-md bg-[var(--color-brand-primary-dark)] px-2 py-0.5 text-[11px] font-bold text-white">
              {averageMl(items)} ml
            </span>
          )
        }
      />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {empty
          ? 'No water consumption recorded yet.'
          : 'Average daily water per bird across the last 5 days.'}
      </p>

      {!empty && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
            Daily water amount
          </p>
          <DailyBars items={items} unit="ml" tone="sky" />
        </div>
      )}

      <CardFooter href="#" label={empty ? 'Log water' : 'Edit record'} />
    </Card>
  );
}

// ────────────── MORTALITY ──────────────

export function MortalityCard({ rate, dailyDeaths }: { rate?: number | null; dailyDeaths?: Array<{ date: string; n: number }> }) {
  const items = dailyDeaths ?? [];
  const empty = items.length === 0;
  return (
    <Card>
      <CardHeader
        icon={Skull}
        title="Mortality rate"
        rightSlot={
          rate != null && (
            <span className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-bold text-white',
              rate < 3 ? 'bg-[var(--color-brand-primary-dark)]' : 'bg-rose-600',
            )}>
              {rate.toFixed(1)}%
            </span>
          )
        }
      />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {empty
          ? 'No mortality logged yet.'
          : 'Birds dead or culled across the last 5 days.'}
      </p>

      {!empty && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
            Birds dead or culled
          </p>
          <DailyBars items={items.map((d) => ({ date: d.date, ml: d.n }))} unit="" tone="rose" />
        </div>
      )}

      <CardFooter href="#" label={empty ? 'Log mortality' : 'Edit record'} />
    </Card>
  );
}

// ────────────── EGGS (layers only) ──────────────

export function EggCollectionCard({ daily }: { daily?: Array<{ date: string; n: number }> | null }) {
  const items = daily ?? [];
  const empty = items.length === 0;
  const totalEggs = items.reduce((s, x) => s + x.n, 0);
  return (
    <Card>
      <CardHeader
        icon={Egg}
        title="Egg collection"
        rightSlot={
          !empty && (
            <span className="rounded-md bg-[var(--color-brand-primary-dark)] px-2 py-0.5 text-[11px] font-bold text-white">
              {totalEggs.toLocaleString()} eggs
            </span>
          )
        }
      />
      <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
        {empty
          ? 'No eggs collected yet.'
          : 'Eggs collected across the last 5 days.'}
      </p>

      {!empty && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
            Eggs per day
          </p>
          <DailyBars items={items.map((d) => ({ date: d.date, ml: d.n }))} unit="" tone="mint" />
        </div>
      )}

      <CardFooter href="#" label={empty ? 'Log eggs' : 'Edit record'} />
    </Card>
  );
}

// ────────────── VACCINATION ──────────────

export function VaccinationCard({
  schedule,
}: {
  schedule?: Array<{ day: string; label: string; status: 'done' | 'today' | 'upcoming' }>;
}) {
  const items = schedule ?? [];
  const empty = items.length === 0;
  return (
    <Card>
      <CardHeader
        icon={Syringe}
        title="Vaccination record"
        rightSlot={
          !empty && (
            <span className="rounded-md bg-[var(--color-brand-primary-dark)] px-2 py-0.5 text-[11px] font-bold text-white">
              {items.filter((x) => x.status === 'done').length}/{items.length}
            </span>
          )
        }
      />
      {empty ? (
        <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
          Country-tuned vaccine programme starts at day 5 of cycle.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--color-brand-border)]">
          {items.map((row) => (
            <li key={row.label + row.day} className="flex items-center justify-between gap-3 py-2.5">
              <span className="inline-flex items-center gap-2">
                <span className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold',
                  row.status === 'done' && 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
                  row.status === 'today' && 'bg-amber-100 text-amber-700',
                  row.status === 'upcoming' && 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]',
                )}>
                  {row.day}
                </span>
                <span className="text-[13px] font-medium text-[var(--color-brand-fg)]">{row.label}</span>
              </span>
              <span className={cn(
                'text-[11px] font-semibold uppercase tracking-wider',
                row.status === 'done' && 'text-[var(--color-brand-primary-deep)]',
                row.status === 'today' && 'text-amber-600',
                row.status === 'upcoming' && 'text-[var(--color-brand-muted-soft)]',
              )}>
                {row.status === 'done' ? 'Done' : row.status === 'today' ? 'Today' : 'Upcoming'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <CardFooter href="#" label={empty ? 'View schedule' : 'Manage schedule'} />
    </Card>
  );
}

// ────────────── PRIMITIVES ──────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <article
      className={cn(
        'rounded-xl border border-[var(--color-brand-border)] bg-white p-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(15,80,30,0.10)]',
        className,
      )}
    >
      {children}
    </article>
  );
}

function CardHeader({
  icon: Icon,
  title,
  rightSlot,
}: {
  icon: LucideIcon;
  title: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{title}</p>
      </div>
      {rightSlot}
    </div>
  );
}

function CardFooter({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-3 flex items-center justify-between border-t border-[var(--color-brand-border)] pt-2.5">
      <button
        type="button"
        className="text-[12px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
      >
        Learn more
      </button>
      <a
        href={href}
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-fg-soft)] hover:text-[var(--color-brand-primary-deep)]"
      >
        {label}
        <ChevronRight className="h-3 w-3" />
      </a>
    </div>
  );
}

function DailyBars({
  items,
  unit,
  tone,
}: {
  items: Array<{ date: string; ml: number }>;
  unit: string;
  tone: 'sky' | 'rose' | 'mint';
}) {
  const max = Math.max(...items.map((x) => x.ml), 1);
  const barClass = {
    sky:  'from-sky-400 to-sky-600',
    rose: 'from-rose-400 to-rose-600',
    mint: 'from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)]',
  }[tone];
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map((d) => {
        const h = Math.max(8, Math.round((d.ml / max) * 64));
        return (
          <div key={d.date} className="flex flex-col items-center">
            <div className="relative flex h-16 w-full items-end justify-center">
              <div
                className={cn('w-full rounded bg-gradient-to-b', barClass)}
                style={{ height: `${h}px` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-semibold text-[var(--color-brand-fg)]">
              {d.ml}{unit}
            </p>
            <p className="text-[9px] text-[var(--color-brand-muted-soft)]">{d.date}</p>
          </div>
        );
      })}
    </div>
  );
}

function labelForProduction(t: FlockDto['productionType']): string {
  return t === 'broiler' ? 'Broilers for meat production' : t === 'layer' ? 'Layers for egg production' : 'Dual-purpose';
}

function averageMl(items: Array<{ ml: number }>): number {
  if (items.length === 0) return 0;
  return Math.round(items.reduce((s, x) => s + x.ml, 0) / items.length);
}

