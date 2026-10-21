'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Plus,
  CheckCircle2,
  DoorOpen,
  Package,
  Snowflake,
  ThermometerSun,
  WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Gate } from '@/lib/access';
import { endpoints, type ColdRoomDto } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';
import { fmt, mins, money } from '@/lib/cold-chain-format';

/**
 * The cold-chain operator's main screen.
 *
 * DESIGNED FOR ONE QUESTION — "is anything wrong right now" — because
 * that is what somebody opens this on their phone at 6am to find out,
 * usually standing up, usually in a hurry.
 *
 * So: worst room first (the server sorts by severity, not by name —
 * eleven rooms sorted alphabetically means reading all eleven to find
 * the one that needs you), the temperature big enough to read at
 * arm's length, and naira at risk on the card rather than two taps
 * away, because that is the number that decides whether somebody gets
 * in a car.
 *
 * Refetches every 30s. A cold-chain dashboard that needs a manual
 * refresh is a dashboard nobody trusts.
 */
export default function ColdRoomsPage() {
  const farmId = useCurrentFarmId();

  const rooms = useQuery({
    queryKey: ['cold-rooms', farmId],
    queryFn: () => endpoints.listColdRooms(),
    enabled: !!farmId,
    refetchInterval: 30_000,
  });

  const list = rooms.data?.rooms ?? [];
  const inTrouble = list.filter((r) => r.severity_rank > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cold chain"
        title="Cold rooms"
        description="Live temperature, the band each room should hold, and what is inside it."
        actions={
          // /pens is the poultry screen and is redirected away from
          // for this vertical, so without this there is no route to a
          // SECOND room once setup is done.
          <Gate perm="pens.create">
            <Button asChild size="sm" className="h-10">
              <Link href="/setup/pens">
                <Plus className="h-4 w-4" />
                Add cold room
              </Link>
            </Button>
          </Gate>
        }
      />

      {rooms.isLoading ? (
        <Skeleton />
      ) : list.length === 0 ? (
        <Empty />
      ) : (
        <>
          <Banner count={inTrouble} total={list.length} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Banner({ count, total }: { count: number; total: number }) {
  if (count === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
        <p className="text-[13.5px] font-semibold text-emerald-900">
          All {total} {total === 1 ? 'room is' : 'rooms are'} holding their band.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-700" />
      <p className="text-[13.5px] font-semibold text-rose-900">
        {count} of {total} {count === 1 ? 'room needs' : 'rooms need'} attention.
      </p>
    </div>
  );
}

function RoomCard({ room }: { room: ColdRoomDto }) {
  const offline = room.minutes_since_reading === null || room.minutes_since_reading > 15;
  const bad = room.severity === 'critical' || room.severity === 'high';
  const warn = room.severity === 'medium' || room.severity === 'info';

  return (
    <Link
      href={`/cold-rooms/${room.id}`}
      className={cn(
        'block rounded-2xl border bg-white p-5 transition-shadow hover:shadow-md',
        bad
          ? 'border-rose-300 ring-1 ring-rose-200'
          : warn
            ? 'border-amber-300'
            : 'border-[var(--color-brand-border)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-[var(--color-brand-fg)]">
            {room.name}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
            {room.band.configured
              ? `Target ${fmt(room.band.min_c)} to ${fmt(room.band.max_c)}`
              : 'No band set'}
          </p>
        </div>
        <Snowflake
          className={cn(
            'h-5 w-5 shrink-0',
            bad ? 'text-rose-600' : 'text-[var(--color-brand-muted)]',
          )}
        />
      </div>

      {/* The number, big. Read at arm's length or it has failed. */}
      <div className="mt-4 flex items-end gap-2">
        <span
          className={cn(
            'text-[34px] font-bold leading-none tracking-tight tabular-nums',
            offline
              ? 'text-[var(--color-brand-muted)]'
              : bad
                ? 'text-rose-700'
                : 'text-[var(--color-brand-fg)]',
          )}
        >
          {room.temp_c !== null ? room.temp_c.toFixed(1) : '—'}
        </span>
        <span className="pb-1 text-[15px] font-semibold text-[var(--color-brand-muted)]">°C</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {offline ? (
          <Row
            icon={WifiOff}
            tone="bad"
            text={
              room.minutes_since_reading === null
                ? 'No readings yet'
                : `Silent for ${mins(room.minutes_since_reading)}`
            }
          />
        ) : (
          <Row
            icon={room.in_band === false ? ThermometerSun : CheckCircle2}
            tone={room.in_band === false ? 'bad' : 'good'}
            text={
              room.in_band === false
                ? 'Outside its band'
                : room.in_band === true
                  ? 'Inside its band'
                  : 'Band not set'
            }
          />
        )}

        {/* A band saved but never acknowledged means the hardware is
            still enforcing the old one. Say so. */}
        {room.band.configured && !room.band.in_force && (
          <Row icon={AlertTriangle} tone="warn" text="Band not confirmed by the device" />
        )}

        {room.alerts.some((a) => a.rule_key === 'door_open') && (
          <Row icon={DoorOpen} tone="warn" text="Door open" />
        )}

        {room.stock.batches > 0 && (
          <Row
            icon={Package}
            tone="muted"
            text={
              room.stock.value_amount
                ? // "from" when the room also holds stock priced in
                  // another currency: the total is real but partial,
                  // and one word is all the space a card has to say so.
                  `${room.stock.batches} batch${room.stock.batches === 1 ? '' : 'es'} · ${room.stock.value_mixed ? 'from ' : ''}${money(room.stock.value_amount, room.stock.currency)}`
                : `${room.stock.batches} batch${room.stock.batches === 1 ? '' : 'es'} inside`
            }
          />
        )}
      </div>

      {room.alerts.length > 0 && (
        <p className="mt-3 border-t border-[var(--color-brand-border)] pt-3 text-[12.5px] font-semibold text-rose-800">
          {room.alerts[0].headline}
          {room.alerts[0].minutes_running !== null && (
            <span className="font-normal text-[var(--color-brand-muted)]">
              {' '}· {mins(room.alerts[0].minutes_running)}
            </span>
          )}
        </p>
      )}
    </Link>
  );
}

function Row({
  icon: Icon,
  text,
  tone,
}: {
  icon: typeof CheckCircle2;
  text: string;
  tone: 'good' | 'bad' | 'warn' | 'muted';
}) {
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-[12.5px]',
        tone === 'good' && 'text-emerald-700',
        tone === 'bad' && 'text-rose-700 font-semibold',
        tone === 'warn' && 'text-amber-700 font-semibold',
        tone === 'muted' && 'text-[var(--color-brand-muted)]',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-brand-border)] bg-white p-10 text-center">
      <Snowflake className="mx-auto h-8 w-8 text-[var(--color-brand-muted)]" />
      <p className="mt-3 text-[15px] font-bold">No cold rooms yet</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--color-brand-muted)]">
        Add a room, pair a PENKEEP to it and set the temperature band it should hold. Until a
        band is set nothing is being watched.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]"
        />
      ))}
    </div>
  );
}
