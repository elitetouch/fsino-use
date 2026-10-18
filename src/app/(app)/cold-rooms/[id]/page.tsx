'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Package, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import { Gate } from '@/lib/access';
import {
  endpoints,
  type ColdChainPresetDto,
  type ColdChainPresetKey,
  type ColdRoomDto,
} from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';
import { mins, money } from '@/lib/cold-chain-format';

/**
 * One cold room: what it is doing, and what it is supposed to be doing.
 *
 * The band editor is the heart of this screen and the reason presets
 * exist rather than two number boxes. "Cold chain" is four products
 * sharing a cabinet — a vaccine fridge at 2–8°C, a chiller at 0–4°C, a
 * freezer at −18°C, and a yam store RUINED below 12°C. Asking an
 * operator to type two numbers invites exactly the mistake that
 * destroys a load; asking them to pick what is in the room does not.
 */
export default function ColdRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const farmId = useCurrentFarmId();

  const room = useQuery({
    queryKey: ['cold-room', id, farmId],
    queryFn: () => endpoints.getColdRoom(id),
    enabled: !!farmId,
    refetchInterval: 30_000,
  });

  const data = room.data?.room;

  return (
    <div className="space-y-6">
      <Link
        href="/cold-rooms"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        All cold rooms
      </Link>

      {room.isLoading || !data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--color-brand-surface-soft)]" />
      ) : (
        <>
          <PageHeader
            eyebrow="Cold room"
            title={data.name}
            description={
              data.band.configured
                ? `Holding ${data.band.min_c}°C to ${data.band.max_c}°C`
                : 'No temperature band set — nothing is being watched yet.'
            }
          />

          <Current room={data} />

          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-rose-200 bg-rose-50 p-4"
                >
                  <p className="text-[13.5px] font-bold text-rose-900">{a.headline}</p>
                  <p className="mt-1 text-[12.5px] text-rose-900">{a.detail}</p>
                  {a.minutes_running !== null && (
                    <p className="mt-1.5 text-[11.5px] text-rose-700">
                      Running for {mins(a.minutes_running)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <Gate perm="pens.update">
            <BandEditor
              roomId={id}
              room={data}
              presets={room.data?.presets ?? []}
            />
          </Gate>
        </>
      )}
    </div>
  );
}

function Current({ room }: { room: ColdRoomDto }) {
  const offline = room.minutes_since_reading === null || room.minutes_since_reading > 15;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
          Now
        </p>
        <p
          className={cn(
            'mt-2 text-[34px] font-bold leading-none tabular-nums',
            offline ? 'text-[var(--color-brand-muted)]' : 'text-[var(--color-brand-fg)]',
          )}
        >
          {room.temp_c !== null ? `${room.temp_c.toFixed(1)}°C` : '—'}
        </p>
        <p className="mt-2 text-[12px] text-[var(--color-brand-muted)]">
          {room.minutes_since_reading === null
            ? 'No readings yet'
            : `Updated ${mins(room.minutes_since_reading)} ago`}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
          Band
        </p>
        <p className="mt-2 text-[20px] font-bold tabular-nums">
          {room.band.configured ? `${room.band.min_c} to ${room.band.max_c}°C` : 'Not set'}
        </p>
        <p
          className={cn(
            'mt-2 flex items-center gap-1.5 text-[12px] font-semibold',
            room.band.in_force ? 'text-emerald-700' : 'text-amber-700',
          )}
        >
          {room.band.in_force ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Enforced by the device
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              {room.band.configured ? 'Not confirmed by the device' : 'Nothing enforcing it'}
            </>
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
          Inside
        </p>
        <p className="mt-2 text-[20px] font-bold">
          {room.stock.batches} {room.stock.batches === 1 ? 'batch' : 'batches'}
        </p>
        {room.stock.value_amount !== null && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--color-brand-muted)]">
            <Package className="h-3.5 w-3.5" />
            {money(room.stock.value_amount, room.stock.currency)} at risk
          </p>
        )}
      </div>
    </div>
  );
}

function BandEditor({
  roomId,
  room,
  presets,
}: {
  roomId: string;
  room: ColdRoomDto;
  presets: ColdChainPresetDto[];
}) {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<ColdChainPresetKey>(room.band.preset ?? 'chilled');
  const [min, setMin] = useState(String(room.band.min_c ?? ''));
  const [max, setMax] = useState(String(room.band.max_c ?? ''));

  const save = useMutation({
    mutationFn: () =>
      endpoints.setColdRoomBand(roomId, {
        preset,
        ...(preset === 'custom' ? { min_c: Number(min), max_c: Number(max) } : {}),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['cold-room', roomId] });
      qc.invalidateQueries({ queryKey: ['cold-rooms'] });
      // Not a blanket success tick. A band the device never
      // acknowledged is not in force, and the operator has to know
      // that before they walk away believing the room is watched.
      res.pushed_to_device
        ? toast.success('Band saved and sent to the device.')
        : toast.warning(
            'Band saved, but the device has not confirmed it. It will keep using its old band until it does.',
          );
    },
    onError: () => toast.error('Could not save the band.'),
  });

  const chosen = presets.find((p) => p.key === preset);

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <h2 className="text-[15px] font-bold">What is stored in this room?</h2>
      <p className="mt-1 text-[12.5px] text-[var(--color-brand-muted)]">
        Pick what is inside and the right temperature band is applied. Getting this wrong is how
        stock is lost — a chiller setting will damage yam, and a freezer setting will destroy
        vaccines.
      </p>

      <div className="mt-4 space-y-2">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={cn(
              'block w-full rounded-xl border p-3.5 text-left transition-colors',
              preset === p.key
                ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40'
                : 'border-[var(--color-brand-border)] hover:bg-[var(--color-brand-surface-soft)]',
            )}
          >
            <p className="text-[13.5px] font-bold text-[var(--color-brand-fg)]">{p.label}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-brand-muted)]">
              {p.hint}
            </p>
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
              Minimum °C
            </span>
            <Input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-[var(--color-brand-fg-soft)]">
              Maximum °C
            </span>
            <Input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" />
          </label>
        </div>
      )}

      {chosen?.low_side_critical && preset !== 'custom' && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            For this setting, <strong>too cold is as damaging as too warm</strong>. You will be
            alerted on both ends of the band.
          </span>
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Snowflake className="h-4 w-4" />}
          Save band
        </Button>
        <p className="text-[11.5px] text-[var(--color-brand-muted)]">
          Sent to the device immediately.
        </p>
      </div>
    </section>
  );
}
