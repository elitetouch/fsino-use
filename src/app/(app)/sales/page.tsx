'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, Bird, Check, Coins, Loader2, Plus, Search, TrendingUp, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { Gate } from '@/lib/access';
import { apiErrorMessage, endpoints, type SaleRow } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Sales — the money-IN ledger, counterpart to /expenses.
 *
 * Exists because a finance-only member (expenses.* but not
 * flocks.records.*) previously had no way to record revenue at all:
 * sales live inside daily records, and granting those permissions would
 * also let them rewrite feed, mortality and weight data sitting behind
 * a bank-facing report.
 *
 * The page leads with the UNPRICED queue rather than the full ledger,
 * because the job that actually brings finance here is "birds left the
 * pen and nobody recorded what they went for" — which shows up as a
 * ₦0 revenue line and a fake loss on the cycle P&L.
 */
export default function SalesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [logOpen, setLogOpen] = useState(false);

  const list = useQuery({
    queryKey: ['sales'],
    queryFn: () => endpoints.listSales({ per_page: 200 }),
  });

  const rows = useMemo(() => list.data?.sales ?? [], [list.data]);
  const unpriced = useMemo(() => rows.filter((r) => r.needsPricing), [rows]);
  const priced = useMemo(() => rows.filter((r) => !r.needsPricing), [rows]);

  const filteredPriced = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return priced;
    return priced.filter((r) =>
      (r.flockName ?? '').toLowerCase().includes(q)
      || (r.note ?? '').toLowerCase().includes(q)
      || (r.createdByName ?? '').toLowerCase().includes(q));
  }, [priced, search]);

  const totals = useMemo(() => ({
    revenue: priced.reduce((s, r) => s + (r.amount ?? 0), 0),
    birdsPriced: priced.reduce((s, r) => s + r.birds, 0),
    birdsUnpriced: unpriced.reduce((s, r) => s + r.birds, 0),
  }), [priced, unpriced]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sales"
        title="Money-in ledger"
        description="Every bird sale on this farm. Sales logged without a price show at the top — pricing them is what completes a cycle's profit figure."
        actions={
          <Gate perm="sales.record">
            <Button size="sm" className="h-10" onClick={() => setLogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Log a sale
            </Button>
          </Gate>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={Coins} label="Revenue recorded" value={money(totals.revenue)} tone="bg-emerald-50 text-emerald-800" />
        <StatTile icon={Bird} label="Birds priced" value={num(totals.birdsPriced)} tone="bg-slate-50 text-slate-800" />
        <StatTile
          icon={AlertTriangle}
          label="Birds awaiting a price"
          value={num(totals.birdsUnpriced)}
          tone={totals.birdsUnpriced > 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-800'}
        />
      </div>

      {/* Unpriced queue — the reason this page exists, so it leads. */}
      {list.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-[var(--color-brand-surface-soft)]" />
      ) : unpriced.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
          <div className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-[13px] font-bold text-amber-900">
                {num(unpriced.length)} {unpriced.length === 1 ? 'sale needs' : 'sales need'} a price
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-amber-900">
                These birds left the pen but no sale amount was recorded, so they count as
                ₦0 revenue and make the cycle look like a loss. Add what they sold for to
                complete the profit figure.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {unpriced.map((r) => (
              <UnpricedRow key={r.id} row={r} onPriced={() => qc.invalidateQueries({ queryKey: ['sales'] })} />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
        <div className="border-b border-[var(--color-brand-border)] p-4">
          <label htmlFor="q" className="mb-1 block text-[12px] font-semibold text-[var(--color-brand-fg)]">
            Search cycle / note / who logged it
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-muted)]" />
            <input
              id="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. BR-5779L"
              className="h-10 w-full rounded-lg border border-[var(--color-brand-input-border)] bg-white pl-9 pr-3 text-[13.5px] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
            />
          </div>
        </div>

        {list.isLoading ? (
          <div className="p-4"><div className="h-40 animate-pulse rounded-lg bg-[var(--color-brand-surface-soft)]" /></div>
        ) : filteredPriced.length === 0 ? (
          <div className="p-10 text-center">
            <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
              <TrendingUp className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">
              {priced.length === 0 ? 'No sales recorded yet' : 'No sales match that search'}
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
              {priced.length === 0
                ? 'Log a sale when birds leave the farm. Revenue here feeds straight into each cycle’s profit figure.'
                : 'Try a different cycle name or note.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {filteredPriced.map((r) => <PricedRow key={r.id} row={r} />)}
          </ul>
        )}
      </div>

      <LogSaleDialog open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function num(n: number): string {
  return n.toLocaleString();
}
function money(n: number): string {
  return `₦${Math.round(n).toLocaleString()}`;
}

function StatTile({ icon: Icon, label, value, tone }: {
  icon: React.ElementType; label: string; value: string; tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
      <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-lg', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted)]">{label}</p>
        <p className="truncate text-lg font-bold text-[var(--color-brand-fg)]">{value}</p>
      </div>
    </div>
  );
}

/** A sale with birds but no money — priced inline, no dialog. */
function UnpricedRow({ row, onPriced }: { row: SaleRow; onPriced: () => void }) {
  const [amount, setAmount] = useState('');
  const value = parseFloat(amount || '') || 0;
  const perBird = row.birds > 0 && value > 0 ? value / row.birds : null;

  const price = useMutation({
    mutationFn: () => endpoints.priceSale(row.flockId, row.id, value),
    onSuccess: () => {
      toast.success(`${money(value)} recorded for ${num(row.birds)} birds.`);
      onPriced();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-[var(--color-brand-fg)]">
          {num(row.birds)} {row.birds === 1 ? 'bird' : 'birds'}
          <span className="ml-2 font-normal text-[var(--color-brand-muted)]">
            {row.flockName ?? 'Unknown cycle'}
          </span>
        </p>
        <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
          {row.recordDate ? fmtDate(row.recordDate) : '—'}
          {row.createdByName ? ` · logged by ${row.createdByName}` : ''}
          {row.source === 'bird_count' ? ' · from daily record' : ''}
          {perBird !== null ? ` · ≈ ${money(perBird)} per bird` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3 focus-within:border-[var(--color-brand-primary)] focus-within:ring-2 focus-within:ring-[var(--color-brand-primary)]/20">
          <span className="text-[13px] font-semibold text-[var(--color-brand-muted)]">₦</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
            inputMode="decimal"
            placeholder="Sale amount"
            aria-label={`Sale amount for ${row.birds} birds`}
            className="w-32 bg-transparent text-[13.5px] font-bold tabular-nums outline-none placeholder:font-normal placeholder:text-[var(--color-brand-muted-soft)]"
          />
        </div>
        <Gate perm="sales.record">
          <Button size="sm" className="h-10" disabled={value <= 0 || price.isPending} onClick={() => price.mutate()}>
            {price.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </Button>
        </Gate>
      </div>
    </li>
  );
}

function PricedRow({ row }: { row: SaleRow }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-[var(--color-brand-fg)]">
          {num(row.birds)} {row.birds === 1 ? 'bird' : 'birds'}
          <span className="ml-2 font-normal text-[var(--color-brand-muted)]">
            {row.flockName ?? 'Unknown cycle'}
          </span>
        </p>
        <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-brand-muted)]">
          {row.recordDate ? fmtDate(row.recordDate) : '—'}
          {row.pricePerBird ? ` · ${money(row.pricePerBird)} per bird` : ''}
          {row.createdByName ? ` · ${row.createdByName}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {row.source === 'bird_count' && (
          <span className="rounded-full bg-[var(--color-brand-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted)]">
            daily record
          </span>
        )}
        <span className="text-[14px] font-bold tabular-nums text-emerald-800">
          {money(row.amount ?? 0)}
        </span>
      </div>
    </li>
  );
}

/** Log a brand-new sale against a cycle. */
function LogSaleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [flockId, setFlockId] = useState('');
  const [birds, setBirds] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  const flocks = useQuery({
    queryKey: ['flocks'],
    queryFn: () => endpoints.listFlocks({}),
    enabled: open,
  });

  const birdsNum = parseInt(birds || '0', 10) || 0;
  const amountNum = parseFloat(amount || '') || 0;
  const valid = flockId !== '' && birdsNum > 0 && amountNum > 0;

  const create = useMutation({
    mutationFn: () => endpoints.createSale(flockId, {
      birds_delta: birdsNum,
      amount: amountNum,
      currency: 'NGN',
      record_date: date,
      ...(note.trim() ? { note: note.trim() } : {}),
    }),
    onSuccess: () => {
      toast.success('Sale recorded.');
      // The flock's running bird count and every financial surface move
      // with this, so refresh them rather than leaving stale numbers on
      // screen behind the dialog.
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['flocks'] });
      qc.invalidateQueries({ queryKey: ['flock-finance'] });
      qc.invalidateQueries({ queryKey: ['flock-report'] });
      setBirds(''); setAmount(''); setNote('');
      onClose();
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-fade-up relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-30px_rgba(15,80,30,0.30)] sm:max-w-[520px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-5 py-4">
          <div>
            <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">Log a sale</p>
            <p className="text-[11px] text-[var(--color-brand-muted)]">
              Records the birds leaving the cycle and the money they brought in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          <Field label="Cycle" htmlFor="flock">
            <select
              id="flock"
              value={flockId}
              onChange={(e) => setFlockId(e.target.value)}
              disabled={flocks.isLoading}
              className="h-10 w-full rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3 text-[13.5px]"
            >
              <option value="">— pick a cycle —</option>
              {(flocks.data?.flocks ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.name} · {f.currentBirds} birds</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Birds sold" htmlFor="birds">
              <TextInput
                id="birds"
                value={birds}
                onChange={(v) => setBirds(v.replace(/[^\d]/g, ''))}
                inputMode="numeric"
              />
            </Field>
            <Field label="Total amount (₦)" htmlFor="amt">
              <TextInput
                id="amt"
                value={amount}
                onChange={(v) => setAmount(v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
                inputMode="decimal"
              />
            </Field>
          </div>

          {birdsNum > 0 && amountNum > 0 && (
            <p className="text-[12px] text-[var(--color-brand-muted)]">
              That&rsquo;s <strong>{money(amountNum / birdsNum)}</strong> per bird.
            </p>
          )}

          <Field label="Sale date" htmlFor="date">
            <TextInput id="date" type="date" value={date} onChange={setDate} />
          </Field>

          <Field label="Note (optional)" htmlFor="note">
            <TextInput
              id="note"
              value={note}
              onChange={setNote}
              placeholder="e.g. Sold to Ikeja market trader"
              maxLength={200}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-brand-border)] bg-white px-5 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Record sale
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: {
  label: string; htmlFor: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-semibold text-[var(--color-brand-fg)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  id, value, onChange, inputMode, type, placeholder, maxLength,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: 'numeric' | 'decimal' | 'text';
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      inputMode={inputMode}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3 text-[13.5px] outline-none focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
    />
  );
}
