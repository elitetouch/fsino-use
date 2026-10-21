'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, FileText, Loader2, Package, Plus, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import { Gate } from '@/lib/access';
import { apiErrorMessage, endpoints, type ColdChainBatchDto, type ColdRoomDto } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';
import { money } from '@/lib/cold-chain-format';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currencies';

type KnownValues = { suppliers: string[]; customers: string[]; units: string[] };

/** Stable empty default, so `known` is not a new object every render. */
const EMPTY_KNOWN: KnownValues = { suppliers: [], customers: [], units: [] };

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
/**
 * The units stock is actually counted in around here.
 *
 * Carton, crate, bag and basket come first because that is how a
 * market trader counts; kg and tonne for anyone selling by weight;
 * vial and box for pharmaceutical storage, which is the other half of
 * this market.
 */
const UNIT_OPTIONS = [
  'carton',
  'crate',
  'bag',
  'basket',
  'kg',
  'tonne',
  'box',
  'pallet',
  'vial',
  'piece',
];

const OTHER_UNIT = '__other__';

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

  // Suppliers and customers cannot be a fixed list — they are
  // unbounded and different for every facility. But the grouping
  // problem is the same one the unit dropdown solves: four people
  // type "NPHCDA", "nphcda", "NPHCDA " and "Nphcda" and nothing can
  // be totalled by supplier afterwards. Offering what has already
  // been used makes the existing spelling the easy choice without
  // preventing a new one.
  //
  // Comes from the server rather than from `list`, because this page
  // shows in_store by default: a supplier whose stock has all been
  // dispatched would otherwise drop out of the suggestions and the
  // next delivery from them gets a second spelling.
  const known = batches.data?.known ?? EMPTY_KNOWN;

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
            value={
              summary.value_amount
                ? money(summary.value_amount, summary.currency ?? DEFAULT_CURRENCY)
                : '—'
            }
            // Only one currency is totalled. Saying so is the whole
            // point: the alternative is a number that looks complete.
            note={summary.value_mixed ? 'plus other currencies' : undefined}
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
          roomsLoading={rooms.isLoading}
          roomsError={rooms.error}
          onRetryRooms={() => rooms.refetch()}
          known={known}
          defaultCurrency={summary?.currency ?? DEFAULT_CURRENCY}
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

/** The panel chrome the add-stock dialog shows in every state. */
function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded p-1 hover:bg-[var(--color-brand-surface-soft)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'warn';
}) {
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
      {note && <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">{note}</p>}
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
  roomsLoading,
  roomsError,
  onRetryRooms,
  known,
  defaultCurrency,
  onClose,
  onSaved,
}: {
  rooms: ColdRoomDto[];
  /** Still fetching — not the same as "this farm has no rooms". */
  roomsLoading: boolean;
  /** The rooms request failed — also not the same as having none. */
  roomsError: unknown;
  onRetryRooms: () => void;
  known: KnownValues;
  /** What this facility already values stock in. */
  defaultCurrency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [penId, setPenId] = useState(rooms[0]?.id ?? '');

  // The rooms query may still be in flight when this dialog opens, and
  // a useState initialiser runs once — so without this the select
  // stays empty forever even after the rooms arrive, with Save
  // disabled and nothing on screen explaining why.
  useEffect(() => {
    if (!penId && rooms.length > 0) setPenId(rooms[0].id);
  }, [rooms, penId]);
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('');
  // Two pieces of state for one field: the dropdown choice, and the
  // free text that only matters when that choice is "Other". Keeping
  // them separate means switching away from Other and back does not
  // silently resurrect what was typed before.
  const [unitChoice, setUnitChoice] = useState('');
  const [unitOther, setUnitOther] = useState('');
  const unit = unitChoice === OTHER_UNIT ? unitOther.trim() : unitChoice;

  // A unit somebody typed under "Other" becomes a normal choice next
  // time. Without this the list never learns, and the second person
  // to store drums types "drum" again from scratch — and spells it
  // differently.
  const unitOptions = useMemo(
    () => Array.from(new Set([...UNIT_OPTIONS, ...known.units])).sort(),
    [known.units],
  );
  const [more, setMore] = useState(false);
  const [batchCode, setBatchCode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [customer, setCustomer] = useState('');
  const [expires, setExpires] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);

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
        currency: value ? currency : null,
      }),
    onSuccess: () => {
      toast.success('Stock recorded.');
      onSaved();
    },
    // The server's own reason, not a generic failure. "Could not
    // record the stock" tells an operator nothing they can act on,
    // and tells us nothing when they report it.
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not record the stock.')),
  });

  // THREE DIFFERENT THINGS LOOK THE SAME IF YOU ONLY CHECK
  // `rooms.length === 0`: still loading, the request failed, and the
  // farm genuinely has no rooms. Telling an operator who has just
  // created two cold rooms that they need a cold room first is worse
  // than showing nothing — it sends them back to build a third.
  if (roomsLoading) {
    return (
      <Shell title="Add stock" onClose={onClose}>
        <div className="h-24 animate-pulse rounded-xl bg-[var(--color-brand-surface-soft)]" />
      </Shell>
    );
  }

  if (roomsError) {
    return (
      <Shell title="Add stock" onClose={onClose}>
        <p className="text-[13px] text-rose-700">
          Could not load your cold rooms, so there is nowhere to file this yet.
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--color-brand-muted)]">
          {apiErrorMessage(roomsError, 'The server did not say why.')}
        </p>
        <Button size="sm" variant="outline" className="mt-3" onClick={onRetryRooms}>
          Try again
        </Button>
      </Shell>
    );
  }

  // Stock lives IN a room, so there is nothing to record until one
  // exists. Saying so beats an empty dropdown and a dead Save button,
  // which is indistinguishable from the page being broken.
  if (rooms.length === 0) {
    return (
      <Shell title="Add stock" onClose={onClose}>
        <p className="text-[13px] text-[var(--color-brand-muted)]">
          You need a cold room first — stock is recorded as being inside one, so there is
          nowhere to put this yet.
        </p>
        <div className="mt-4">
          <Button asChild size="sm">
            <Link href="/setup/pens">
              <Plus className="h-4 w-4" />
              Add a cold room
            </Link>
          </Button>
        </div>
      </Shell>
    );
  }

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
            {penId === '' && <option value="">Choose a room…</option>}
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
            {/* A list rather than free text: typed units arrive as
                "carton", "Cartons", "ctn" and "CARTON" from four
                people in the same store, and nothing can then be
                grouped or totalled. Other stays, because no list
                survives contact with a real warehouse. */}
            <select
              value={unitChoice}
              onChange={(e) => setUnitChoice(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--color-brand-input-border)] bg-white px-3 text-[14px]"
            >
              <option value="">Choose…</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value={OTHER_UNIT}>Other…</option>
            </select>
          </label>
        </div>

        {unitChoice === OTHER_UNIT && (
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
              What unit?
            </span>
            <Input
              value={unitOther}
              onChange={(e) => setUnitOther(e.target.value)}
              placeholder="e.g. drum, sack, pallet"
              autoFocus
            />
          </label>
        )}
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
            <Field
              label="Supplier"
              value={supplier}
              onChange={setSupplier}
              suggestions={known.suppliers}
            />
            <Field
              label="Customer / destination"
              value={customer}
              onChange={setCustomer}
              suggestions={known.customers}
            />
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
                Expires
              </span>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field
              label="Value — used to show what is at risk during an excursion"
              value={value}
              onChange={setValue}
              placeholder="2400000"
            />
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
                Currency
              </span>
              {/* Defaults to whatever this facility already values
                  stock in, so the picker is touched once and then
                  never again. A select rather than a 3-letter box
                  because "ngn", "NGN" and "N" all pass size:3 and
                  then nothing totals. */}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2 text-[0.8125rem] sm:w-[9.5rem]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
  suggestions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /**
   * Values already used on this farm.
   *
   * A datalist rather than a select: the operator can still type
   * anything, but the spelling they used last time is one keystroke
   * away — which is what keeps a supplier groupable without pretending
   * we can enumerate every supplier in Nigeria.
   */
  suggestions?: string[];
}) {
  const listId = suggestions?.length
    ? `sug-${label.replace(/[^a-z]/gi, '').toLowerCase()}`
    : undefined;

  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
      />
      {listId && (
        <datalist id={listId}>
          {suggestions?.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </label>
  );
}
