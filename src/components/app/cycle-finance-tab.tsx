'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight, DollarSign, Loader2, MinusCircle, Plus, PlusCircle,
  Receipt, TrendingDown, TrendingUp, Wallet, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Gate } from '@/lib/access';
import { endpoints, type FlockFinanceDto, type ExpenseCategory } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Finance tab on the cycle detail page.
 *
 * Reads the backend's per-cycle P&L endpoint and lays it out as a
 * plain profit-and-loss card the farmer can screenshot for a bank
 * without editing. Every number in the headline P&L is in the
 * primary currency (farm default). Amounts logged in a secondary
 * currency (e.g. USD-billed imported drugs) appear in a subordinate
 * "also spent" strip, never added into the headline total.
 *
 * The tab intentionally does NOT project or forecast — that's the
 * job of the dashboard's CostProjectionCard. Here we only surface
 * numbers the farmer has actually logged, so screenshots of this
 * page are always defensible.
 */
export function CycleFinanceTab({ flockId }: { flockId: string }) {
  const query = useQuery({
    queryKey: ['flock-finance', flockId],
    queryFn: () => endpoints.getFlockFinance(flockId),
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--color-brand-border)] bg-white p-10 text-[13px] text-[var(--color-brand-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading finance…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
        <div>
          <p className="text-[13px] font-bold text-rose-900">Couldn&apos;t load the finance summary</p>
          <p className="mt-1 text-[12px] text-rose-900">
            Try again in a moment. If it keeps failing, the cycle may be brand-new and have no financial data yet.
          </p>
        </div>
      </div>
    );
  }

  const f = query.data;

  return (
    <div className="space-y-4">
      <PnlHeadline finance={f} />
      <ExpensesBreakdown finance={f} />
      <RevenueBlock finance={f} />
      <InlineCostsBlock finance={f} />
      <RecentExpensesList finance={f} />
      <FooterActions />
    </div>
  );
}

/* ─────────────────────────── P&L HEADLINE ─────────────────────────── */

function PnlHeadline({ finance }: { finance: FlockFinanceDto }) {
  const s = finance.summary;
  const positive = s.margin >= 0;

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            Cycle P&amp;L · {s.currency}
          </p>
          <h2 className="mt-1 text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {finance.flock.name ?? 'This cycle'}
          </h2>
        </div>
        <div className={cn(
          'rounded-lg px-3 py-1.5 text-[13px] font-bold',
          positive ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800',
        )}>
          {positive ? <TrendingUp className="mr-1 inline h-3.5 w-3.5" /> : <TrendingDown className="mr-1 inline h-3.5 w-3.5" />}
          Margin {fmtMoney(s.margin, s.currency)}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <PnlRow icon={Wallet} label="Placement cost" value={s.placementCost} currency={s.currency} sub="Cost of buying the birds at placement." />
        <PnlRow icon={MinusCircle} label="Operating expenses" value={s.operatingExpenses} currency={s.currency} sub={`${finance.expenses.entryCount} entr${finance.expenses.entryCount === 1 ? 'y' : 'ies'} in the expenses ledger.`} />
        {s.inlineDailyRecordCosts > 0 && (
          <PnlRow icon={Receipt} label="Inline record costs" value={s.inlineDailyRecordCosts} currency={s.currency} sub="Amounts entered directly on daily records." />
        )}
        <PnlRow icon={PlusCircle} label="Revenue" value={s.revenue} currency={s.currency} sub={`${finance.revenue.birdsSold} bird${finance.revenue.birdsSold === 1 ? '' : 's'} sold across ${finance.revenue.salesCount} sale${finance.revenue.salesCount === 1 ? '' : 's'}.`} accent="positive" />
      </dl>

      <div className="mt-4 border-t border-[var(--color-brand-border)] pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
            Total cost
          </span>
          <span className="text-[16px] font-bold text-[var(--color-brand-fg)]">
            {fmtMoney(s.totalCost, s.currency)}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
            Margin
          </span>
          <span className={cn(
            'text-[18px] font-bold',
            positive ? 'text-emerald-800' : 'text-rose-800',
          )}>
            {fmtMoney(s.margin, s.currency)}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] italic text-[var(--color-brand-muted)]">{s.note}</p>
    </section>
  );
}

function PnlRow({
  icon: Icon,
  label,
  value,
  currency,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  currency: string;
  sub?: string;
  accent?: 'positive';
}) {
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 p-3.5">
      <div className="flex items-start gap-3">
        <span className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          accent === 'positive'
            ? 'bg-emerald-50 text-emerald-800'
            : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
        )}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
            {label}
          </p>
          <p className="mt-0.5 text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {fmtMoney(value, currency)}
          </p>
          {sub && (
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-brand-muted)]">{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── EXPENSES BREAKDOWN ─────────────────────────── */

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  feed: 'Feed',
  vaccine: 'Vaccine',
  treatment: 'Treatment / Drugs',
  fuel: 'Fuel / Generator',
  utilities: 'Utilities',
  repairs: 'Repairs',
  wages: 'Wages',
  equipment: 'Equipment',
  transport: 'Transport',
  other: 'Other',
};

function ExpensesBreakdown({ finance }: { finance: FlockFinanceDto }) {
  const { byCategory, secondaryCurrencies, totalPrimary, primaryCurrency, entryCount } = finance.expenses;

  if (entryCount === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--color-brand-border)] bg-white p-6 text-center">
        <Receipt className="mx-auto h-6 w-6 text-[var(--color-brand-muted)]" />
        <p className="mt-2 text-[13px] font-bold text-[var(--color-brand-fg)]">
          No expenses logged for this cycle yet
        </p>
        <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
          Log feed purchases, vaccines, drugs, fuel, wages and repairs so the P&amp;L reflects reality.
        </p>
        <Gate perm="expenses.record">
          <Link href="/expenses" className="mt-3 inline-flex">
            <Button size="sm" variant="outline"><ArrowUpRight className="h-3.5 w-3.5" /> Open expenses</Button>
          </Link>
        </Gate>
      </section>
    );
  }

  const max = Math.max(...byCategory.map((r) => r.amount), 1);

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          Expenses by category
        </h3>
        <p className="text-[11px] text-[var(--color-brand-muted)]">
          Total {fmtMoney(totalPrimary, primaryCurrency)}
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {byCategory.map((r) => (
          <li key={r.category}>
            <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
              <span className="font-semibold text-[var(--color-brand-fg)]">{CATEGORY_LABELS[r.category] ?? r.category}</span>
              <span className="text-[var(--color-brand-fg)]">
                {fmtMoney(r.amount, primaryCurrency)}
                <span className="ml-2 text-[10.5px] text-[var(--color-brand-muted)]">
                  {r.count} entr{r.count === 1 ? 'y' : 'ies'}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-brand-surface-soft)]">
              <div
                className="h-full rounded-full bg-[var(--color-brand-primary)]"
                style={{ width: `${Math.min(100, (r.amount / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {secondaryCurrencies.length > 0 && (
        <div className="mt-4 rounded-lg bg-[var(--color-brand-surface-soft)]/60 p-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
            Also spent in other currencies
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-brand-muted)]">
            Not added into the headline total to avoid a misleading sum.{' '}
            {secondaryCurrencies.map((s) => `${fmtMoney(s.amount, s.currency)}`).join(' · ')}
          </p>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── REVENUE ─────────────────────────── */

function RevenueBlock({ finance }: { finance: FlockFinanceDto }) {
  const r = finance.revenue;

  if (r.salesCount === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--color-brand-border)] bg-white p-5 text-center">
        <DollarSign className="mx-auto h-5 w-5 text-[var(--color-brand-muted)]" />
        <p className="mt-2 text-[12.5px] font-bold text-[var(--color-brand-fg)]">No sales logged for this cycle yet</p>
        <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
          Revenue will appear here when you log a sale from the daily-record wizard.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">Sales</h3>
        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">
          {fmtMoney(r.totalPrimary, r.primaryCurrency)}
        </p>
      </div>
      <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
        {r.birdsSold} bird{r.birdsSold === 1 ? '' : 's'} sold across {r.salesCount} sale{r.salesCount === 1 ? '' : 's'}.
      </p>
      {r.secondaryCurrencies.length > 0 && (
        <p className="mt-2 text-[11px] italic text-[var(--color-brand-muted)]">
          Also received: {r.secondaryCurrencies.map((s) => fmtMoney(s.amount, s.currency)).join(' · ')} — not added into the primary total.
        </p>
      )}
    </section>
  );
}

/* ─────────────────────────── INLINE COSTS (LEGACY) ─────────────────────────── */

function InlineCostsBlock({ finance }: { finance: FlockFinanceDto }) {
  const i = finance.inlineCosts;
  if (i.byEvent.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 sm:p-6">
      <h3 className="text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">
        Costs entered on daily records
      </h3>
      <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">{i.note}</p>
      <ul className="mt-3 divide-y divide-[var(--color-brand-border)]">
        {i.byEvent.map((r) => (
          <li key={`${r.eventType}-${r.currency}`} className="flex items-center justify-between py-2 text-[12.5px]">
            <span className="capitalize text-[var(--color-brand-fg)]">{r.eventType}</span>
            <span className="text-[var(--color-brand-fg)]">
              {fmtMoney(r.amount, r.currency)}
              <span className="ml-2 text-[10.5px] text-[var(--color-brand-muted)]">
                {r.count} entr{r.count === 1 ? 'y' : 'ies'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────── RECENT EXPENSES ─────────────────────────── */

function RecentExpensesList({ finance }: { finance: FlockFinanceDto }) {
  const rows = finance.recentExpenses;
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">Recent expenses</h3>
        <Link href="/expenses" className="text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline">
          Open ledger →
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-[var(--color-brand-border)]">
        {rows.map((e) => (
          <li key={e.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2">
            <span className="rounded-md bg-[var(--color-brand-accent)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
              {CATEGORY_LABELS[e.category] ?? e.category}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-[var(--color-brand-fg)]">
                {e.description ?? e.vendor ?? '—'}
              </p>
              <p className="text-[10.5px] text-[var(--color-brand-muted)]">
                {e.expenseDate}{e.vendor && e.description ? ` · ${e.vendor}` : ''}
              </p>
            </div>
            <span className="text-[13px] font-bold text-[var(--color-brand-fg)]">
              {fmtMoney(e.amount, e.currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FooterActions() {
  return (
    <Gate perm="expenses.record">
      <div className="flex justify-end">
        <Link href="/expenses">
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" /> Add expense
          </Button>
        </Link>
      </div>
    </Gate>
  );
}

/* ─────────────────────────── FORMATTING ─────────────────────────── */

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}
