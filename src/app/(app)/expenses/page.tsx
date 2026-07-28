'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Receipt, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { Gate } from '@/lib/access';
import {
  apiErrorMessage, endpoints,
  type ExpenseCategory, type ExpenseDto, type FlockDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Expenses ledger — the finance-only surface.
 *
 * A staff member invited with ONLY `expenses.view` + `expenses.record`
 * can reach this page but nothing else operational — no daily records,
 * no dashboard, no setup. That's the "financial staff" role by
 * composition rather than a new hard-coded role.
 *
 * Every write goes through a single mutation → toast → cache
 * invalidation flow so the page never falls out of sync with the
 * server. Void takes a mandatory reason (same audit-trail pattern as
 * daily records) and the row stays in the ledger struck through.
 */

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  birds: 'Birds / DOC placement',
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

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

export default function ExpensesPage() {
  const [filterFlockId, setFilterFlockId] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | ''>('');
  const [addOpen, setAddOpen] = useState(false);
  const [voiding, setVoiding] = useState<ExpenseDto | null>(null);

  const flocks = useQuery({
    queryKey: ['flocks', { includeArchived: true }],
    queryFn: () => endpoints.listFlocks({ includeArchived: true }),
  });

  const expenses = useQuery({
    queryKey: ['expenses', { flockId: filterFlockId, category: filterCategory }],
    queryFn: () => endpoints.listExpenses({
      ...(filterFlockId ? { flock_id: filterFlockId } : {}),
      ...(filterCategory ? { category: filterCategory } : {}),
      per_page: 50,
    }),
  });

  const rows = expenses.data?.expenses ?? [];
  const totals = expenses.data?.meta.pageTotals ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Expenses"
        title="Money-out ledger"
        description="Log every cost — feed, drugs, fuel, wages, repairs. The reports and cost projection read from this ledger."
        actions={
          <Gate perm="expenses.record">
            <Button size="sm" className="h-10" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add expense
            </Button>
          </Gate>
        }
      />

      {totals.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
            Page total{totals.length > 1 ? 's' : ''}
          </p>
          {totals.map((t) => (
            <span
              key={t.currency}
              className="rounded-md bg-[var(--color-brand-accent)] px-2.5 py-1 text-[13px] font-bold text-[var(--color-brand-primary-deep)]"
            >
              {formatAmount(t.amount, t.currency)}
            </span>
          ))}
          <p className="text-[11px] text-[var(--color-brand-muted)]">
            {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} · voided rows excluded
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--color-brand-border)] bg-white p-3">
        <select
          value={filterFlockId}
          onChange={(e) => setFilterFlockId(e.target.value)}
          className="h-9 rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[12.5px]"
        >
          <option value="">All flocks</option>
          {(flocks.data?.flocks ?? []).map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as ExpenseCategory | '')}
          className="h-9 rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[12.5px]"
        >
          <option value="">All categories</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
        {expenses.isLoading ? (
          <div className="flex items-center justify-center p-10 text-[13px] text-[var(--color-brand-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading expenses…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <Receipt className="mx-auto h-8 w-8 text-[var(--color-brand-muted)]" />
            <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">
              No expenses logged yet
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
              Add costs like feed purchases, vaccines, drugs and fuel so the reports show the true margin.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {rows.map((r) => (
              <ExpenseRow
                key={r.id}
                expense={r}
                onVoid={() => setVoiding(r)}
              />
            ))}
          </ul>
        )}
      </div>

      {addOpen && (
        <AddExpenseDialog
          onClose={() => setAddOpen(false)}
          flocks={flocks.data?.flocks ?? []}
        />
      )}

      {voiding && (
        <VoidExpenseDialog
          expense={voiding}
          onClose={() => setVoiding(null)}
        />
      )}
    </div>
  );
}

function ExpenseRow({
  expense,
  onVoid,
}: {
  expense: ExpenseDto;
  onVoid: () => void;
}) {
  const voided = expense.voidedAt !== null;

  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto_auto] sm:items-center sm:gap-4 sm:px-5">
      <div>
        <span className={cn(
          'inline-block rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
          voided
            ? 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)] line-through'
            : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
        )}>
          {CATEGORY_LABELS[expense.category]}
        </span>
      </div>
      <div className="min-w-0">
        <p className={cn(
          'text-[13.5px] font-bold text-[var(--color-brand-fg)]',
          voided && 'text-[var(--color-brand-muted)] line-through',
        )}>
          {expense.description ?? expense.vendor ?? '—'}
        </p>
        <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
          {expense.flockName ?? 'Unknown flock'} · {expense.expenseDate}
          {expense.vendor && expense.description ? ` · ${expense.vendor}` : ''}
          {expense.createdByName ? ` · by ${expense.createdByName}` : ''}
          {voided ? ` · voided (${expense.voidReason ?? 'no reason given'})` : ''}
        </p>
      </div>
      <div className="text-right">
        <p className={cn(
          'text-[14px] font-bold text-[var(--color-brand-fg)]',
          voided && 'text-[var(--color-brand-muted)] line-through',
        )}>
          {formatAmount(expense.amount, expense.currency)}
        </p>
      </div>
      <Gate perm="expenses.record">
        {!voided && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-rose-700 hover:bg-rose-50"
            onClick={onVoid}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Void
          </Button>
        )}
      </Gate>
    </li>
  );
}

function AddExpenseDialog({
  onClose,
  flocks,
}: {
  onClose: () => void;
  flocks: FlockDto[];
}) {
  const qc = useQueryClient();
  const [flockId, setFlockId] = useState<string>(flocks[0]?.id ?? '');
  const [category, setCategory] = useState<ExpenseCategory>('feed');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('NGN');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const amountNum = Number(amount);
  const canSubmit = flockId !== '' && amountNum > 0 && date !== '' && currency.length === 3;

  const create = useMutation({
    mutationFn: () => endpoints.createExpense({
      flock_id: flockId,
      category,
      amount: amountNum,
      currency: currency.toUpperCase(),
      expense_date: date,
      vendor: vendor.trim() || undefined,
      description: description.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Expense logged.');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save the expense.')),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
              New expense
            </p>
            <h2 className="mt-0.5 text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Log a cost
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4 sm:p-5">
          <Field label="Flock (required)">
            <select
              value={flockId}
              onChange={(e) => setFlockId(e.target.value)}
              className="h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[13px]"
            >
              <option value="">Select a flock…</option>
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[13px]"
            >
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Amount">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  step="0.01"
                  className="h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[13px]"
                />
              </Field>
            </div>
            <Field label="Currency">
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
                className="h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[13px] uppercase"
              />
            </Field>
          </div>

          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[13px]"
            />
          </Field>

          <Field label="Vendor (optional)">
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value.slice(0, 120))}
              placeholder="e.g. Olam, Hipro Vet"
              className="h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[13px]"
            />
          </Field>

          <Field label="Description (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="e.g. 10 bags of starter mash"
              rows={2}
              className="w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 py-1.5 text-[13px]"
            />
          </Field>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/50 p-4 sm:flex-row-reverse sm:items-center sm:justify-start sm:p-5">
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={!canSubmit || create.isPending}
          >
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save expense
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </footer>
      </div>
    </div>
  );
}

function VoidExpenseDialog({
  expense,
  onClose,
}: {
  expense: ExpenseDto;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<string>('');

  const canSubmit = reason.trim().length >= 3 && reason.length <= 500;

  const voidIt = useMutation({
    mutationFn: () => endpoints.voidExpense(expense.id, reason.trim()),
    onSuccess: () => {
      toast.success('Expense voided. It stays in the ledger for audit but no longer counts.');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not void the expense.')),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-rose-700">
              Void expense
            </p>
            <h2 className="mt-0.5 text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Remove this expense from totals?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="text-[12.5px] font-bold text-amber-900">The row stays in the ledger</p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-900">
              Voiding is not a delete — the entry stays with your reason so a bank or co-op can trust the audit trail. It just stops counting in totals and cost projection.
            </p>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
              Reason (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="e.g. Duplicate entry — the same feed purchase was logged twice."
              className="mt-1 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-3 py-2 text-[13px]"
            />
            <p className={cn('mt-1 text-[11px]', canSubmit ? 'text-[var(--color-brand-muted)]' : 'text-amber-800')}>
              At least 3 characters. {reason.length}/500
            </p>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/50 p-4 sm:flex-row-reverse sm:items-center sm:justify-start sm:p-5">
          <Button
            size="sm"
            onClick={() => voidIt.mutate()}
            disabled={!canSubmit || voidIt.isPending}
            className="bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-600/30"
          >
            {voidIt.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
            Void expense
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
