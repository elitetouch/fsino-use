'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, FileText, Loader2, Package, Plus, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import { Gate } from '@/lib/access';
import { endpoints, type ColdChainBatchDto, type ColdRoomDto } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';
import { money } from '@/lib/cold-chain-format';

/**
 * Stock in and out of the rooms.
 *
 * THE FORM IS THE PRODUCT DECISION HERE. A trader at Mile 12 with one
 * room needs three fields and will abandon anything longer; a
 * pharmaceutical distributor needs lot code, supplier, customer,
 * expiry and value and finds anything less useless. Same screen: the
 * three required fields are visible, everything else sits behind
 * "More details" and is remembered open if you use it.
 *
 * Get that balance wrong in either direction and you lose one of the
 * two markets entirely.
 */
export default function BatchesPage() {
  const farmId = useCurrentFarmId();
  const [adding, setAdding] = useState(false);

  const batches = useQuery({
    queryKey: ['cold-batches', farmId],
    queryFn: () => endpoints.listColdChainBatches(),
    enabled: !!farmId,
  });

  const rooms = useQuery({
    queryKey: ['cold-rooms', farmId],
    queryFn: () => endpoints.listColdRooms(),
    enabled: !!farmId,
  });

  const list = batches.data?.batches ?? [];
  const summary = batches.data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cold chain"
        title="Stock in store"
        description="What is in each room, what it is worth, and what it was exposed to."
        actions={
          <Gate perm="pens.update">
            <Button size="sm" className="h-10" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Add stock
            </Button>
          </Gate>
        }
      />

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Batches in store" value={String(summary.count)} />
          <Stat
            label="Value in store"
            value={summary.value_amount ? money(summary.value_amount, 'NGN') : '—'}
          />
          <Stat
            label="Expiring in 14 days"
            value={String(summary.expiring_14d)}
            tone={summary.expiring_14d > 0 ? 'warn' : undefined}
          />
        </div>
      )}

      {adding && (
        <AddBatch
          rooms={rooms.data?.rooms ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => {
            batches.refetch();
            setAdding(false);
          }}
        />
      )}

      {batches.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-brand-surface-soft)]" />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-brand-border)] bg-white p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-[var(--color-brand-muted)]" />
          <p className="mt-3 text-[15px] font-bold">Nothing recorded yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--color-brand-muted)]">
            Record what goes into a room and any excursion it sits through is attached to it
            automatically — that record is what a buyer or an insurer asks for.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <BatchRow key={b.id} batch={b} onChanged={() => batches.refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4',
        tone === 'warn' ? 'border-amber-300' : 'border-[var(--color-brand-border)]',
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

function BatchRow({ batch, onChanged }: { batch: ColdChainBatchDto; onChanged: () => void }) {
  const qc = useQueryClient();

  const close = useMutation({
    mutationFn: (status: 'dispatched' | 'discarded') =>
      endpoints.closeColdChainBatch(batch.id, { status }),
    onSuccess: (_r, status) => {
      toast.success(status === 'dispatched' ? 'Marked dispatched.' : 'Marked discarded.');
      qc.invalidateQueries({ queryKey: ['cold-rooms'] });
      onChanged();
    },
    onError: () => toast.error('Could not update the batch.'),
  });

  const expiringSoon = batch.days_to_expiry !== null && batch.days_to_expiry <= 14;

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold text-[var(--color-brand-fg)]">{batch.label}</p>
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
            {[
              batch.pen.name,
              batch.quantity ? `${batch.quantity}${batch.unit ? ` ${batch.unit}` : ''}` : null,
              batch.batch_code,
              batch.customer ? `for ${batch.customer}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {batch.days_to_expiry !== null && (
            <p
              className={cn(
                'mt-1 text-[12px] font-semibold',
                expiringSoon ? 'text-amber-700' : 'text-[var(--color-brand-muted)]',
              )}
            >
              {batch.days_to_expiry < 0
                ? `Expired ${Math.abs(batch.days_to_expiry)} days ago`
                : `Expires in ${batch.days_to_expiry} days`}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {batch.value_amount !== null && (
            <span className="text-[13.5px] font-bold tabular-nums">
              {money(batch.value_amount, batch.currency)}
            </span>
          )}
          <Link
            href={`/cold-chain/batches/${batch.id}/report`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-brand-border)] px-3 text-[12.5px] font-semibold hover:bg-[var(--color-brand-surface-soft)]"
          >
            <FileText className="h-3.5 w-3.5" />
            Report
          </Link>
        </div>
      </div>

      {batch.status === 'in_store' && (
        <Gate perm="pens.update">
          <div className="mt-3 flex gap-2 border-t border-[var(--color-brand-border)] pt-3">
            <button
              type="button"
              onClick={() => close.mutate('dispatched')}
              disabled={close.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--color-brand-fg-soft)] hover:bg-[var(--color-brand-surface-soft)]"
            >
              <Truck className="h-3.5 w-3.5" />
              Dispatched
            </button>
            <button
              type="button"
              onClick={() => close.mutate('discarded')}
              disabled={close.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-50"
            >
              <X className="h-3.5 w-3.5" />
              Discarded
            </button>
          </div>
        </Gate>
      )}

      {batch.status !== 'in_store' && (
        <p className="mt-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-brand-muted)]">
          {batch.status}
        </p>
      )}
    </div>
  );
}

function AddBatch({
  rooms,
  onClose,
  onSaved,
}: {
  rooms: ColdRoomDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [penId, setPenId] = useState(rooms[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [more, setMore] = useState(false);
  const [batchCode, setBatchCode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [customer, setCustomer] = useState('');
  const [expires, setExpires] = useState('');
  const [value, setValue] = useState('');

  const save = useMutation({
    mutationFn: () =>
      endpoints.createColdChainBatch({
        pen_id: penId,
        label: label.trim(),
        quantity: quantity ? Number(quantity) : null,
        unit: unit || null,
        batch_code: batchCode || null,
        supplier: supplier || null,
        customer: customer || null,
        expires_at: expires || null,
        value_amount: value ? Number(value) : null,
        currency: value ? 'NGN' : null,
      }),
    onSuccess: () => {
      toast.success('Stock recorded.');
      onSaved();
    },
    onError: () => toast.error('Could not record the stock.'),
  });

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Add stock</h2>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-[var(--color-brand-surface-soft)]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* The three fields that are always required. Everything else is
          optional, because a trader with twenty cartons of tilapia will
          not fill in a lot number and should not be asked to. */}
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
            Room
          </span>
          <select
            value={penId}
            onChange={(e) => setPenId(e.target.value)}
            className="h-11 w-full rounded-xl border border-[var(--color-brand-input-border)] bg-white px-3 text-[14px]"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
            What is it?
          </span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="20 cartons tilapia"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
              Quantity
            </span>
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
              Unit
            </span>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="carton" />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-brand-primary-deep)]"
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform', more && 'rotate-180')} />
        {more ? 'Fewer details' : 'More details — lot, supplier, expiry, value'}
      </button>

      {more && (
        <div className="mt-3 space-y-3 border-t border-[var(--color-brand-border)] pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lot / batch code" value={batchCode} onChange={setBatchCode} placeholder="LOT-4471" />
            <Field label="Supplier" value={supplier} onChange={setSupplier} />
            <Field label="Customer / destination" value={customer} onChange={setCustomer} />
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
                Expires
              </span>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </label>
          </div>
          <Field
            label="Value (₦) — used to show what is at risk during an excursion"
            value={value}
            onChange={setValue}
            placeholder="2400000"
          />
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !label.trim() || !penId}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
        {label}
      </span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
