'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PenClimateHistory } from '@/components/app/pen-climate-history';
import {
  Activity, AlertTriangle, BadgeCheck, Battery, BatteryCharging, BatteryFull,
  Calendar, CloudOff, Flame, Loader2, MapPin, Plug, Plus, Power, QrCode, Radio,
  RefreshCw, Signal, Thermometer, ThermometerSnowflake, ThermometerSun, Wifi,
  Wind, Droplet, ArrowRight, BarChart3, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  apiErrorMessage, endpoints,
  type PenClimateDto, type PenClimateRelay, type PenClimateStation, type PenClimateZone,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Pen Climate — the live environmental dashboard for a pen's PENKEEP
 * IoT unit.
 *
 * Surface layered by urgency, top → bottom:
 *
 *   1. Device status strip — online indicator, last-seen time, battery,
 *      signal. This is the "is the box alive?" question every other
 *      number depends on, so it sits above the fold.
 *   2. Zone temperature trio — the three heater zones (left / middle /
 *      right) with current vs threshold, status pill, heater on/off.
 *      The colour of each card mirrors the PENKEEP LCD so the farmer
 *      reads the app the same way they read the box.
 *   3. Environment row — humidity, AQI, NH3, CO2 chips. Anything
 *      out-of-range gets the amber/rose treatment so the farmer scans
 *      this in seconds.
 *   4. Controls — relays (T1/T2/T3) and master socket. Optimistic
 *      toggle with rollback on error. Permission-gated upstream.
 *   5. Device info — subscription window, flock age, network, GPS.
 *      Read-only context.
 *
 * Empty / setup state: when the backend returns null device + null
 * current readings (no PENKEEP paired), we render a clean "pair your
 * PENKEEP" panel with the steps to take. No fake zeros.
 */
/**
 * Container that switches between the live climate view and the
 * per-flock reading log. Owned here (not in the cycle page) so both
 * sub-views share the same react-query cache for
 * `['pen-climate', penId]` and the toggle stays close to the data.
 *
 * `flockId` is optional so pages without a flock context (pen detail,
 * standalone climate pages) can still use <PenClimate> directly and
 * skip the history tab.
 */
export function PenClimateWithHistory({
  penId, penName, flockId,
}: {
  penId: string;
  penName?: string;
  flockId?: string;
}) {
  const [view, setView] = useState<'live' | 'history'>('live');

  // Pull the same pen-climate query the live view uses so the history
  // toggle can name the stations without a second network round-trip.
  const climate = useQuery({
    queryKey: ['pen-climate', penId],
    queryFn: () => endpoints.getPenClimate(penId),
    enabled: !!penId && !!flockId, // only needed when history is reachable
    staleTime: 10_000,
  });

  const stations = climate.data?.stations ?? [];

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden">
      {flockId && (
        <div className="inline-flex rounded-xl border border-[var(--color-brand-border)] bg-white p-1">
          {(['live', 'history'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors',
                view === v
                  ? 'bg-[var(--color-brand-primary)] text-white'
                  : 'text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]',
              )}
            >
              {v === 'live' ? 'Live' : 'History'}
            </button>
          ))}
        </div>
      )}

      {view === 'live' || !flockId
        ? <PenClimate penId={penId} penName={penName} />
        : <PenClimateHistory flockId={flockId} stations={stations} />}
    </div>
  );
}

export function PenClimate({ penId, penName }: { penId: string; penName?: string }) {
  // Poll every 10s so the page feels near-live without a websocket.
  // Devices broadcast on a similar cadence, so this catches the freshest
  // reading soon after it lands in the database. Background refetches
  // don't show a skeleton — the previous reading stays painted until
  // the new one arrives.
  const query = useQuery({
    queryKey: ['pen-climate', penId],
    queryFn: () => endpoints.getPenClimate(penId),
    enabled: !!penId,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (query.isLoading && !query.data) {
    return <Skeleton />;
  }

  const data = query.data;
  // Multi-station rollout: the backend returns `stations: [...]`. Fall
  // back to synthesising a single station from the deprecated
  // top-level `device` + `current` aliases so an old cached bundle
  // keeps working during the deploy window.
  const stations: PenClimateStation[] = data?.stations && data.stations.length > 0
    ? data.stations
    : data?.device && data.current
      ? [{
          stationLabel: null,
          stationOrder: null,
          device: data.device,
          current: data.current,
        }]
      : [];

  // A station without a reading yet (device paired but never reported)
  // still counts as "present" — we render the strip so the farmer sees
  // "offline / no data yet" instead of the setup empty state.
  if (!data || stations.length === 0) {
    return <SetupEmptyState penId={penId} penName={penName} />;
  }

  return <Live data={data} stations={stations} penName={penName} />;
}

/* ─────────────────────────── Live (data present) ─────────────────────────── */

function Live({
  data, stations, penName,
}: {
  data: PenClimateDto;
  stations: PenClimateStation[];
  penName?: string;
}) {
  const { subscription, flockAgeDays } = data;

  // Station picker — hidden on single-station pens so the layout is
  // visually identical to today. On multi-station pens the picker is
  // the first thing under the pen title so the farmer can compare
  // corners without scrolling.
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, stations.length - 1);
  const active = stations[safeIdx];
  const activeCurrent = active.current;

  const multiStation = stations.length > 1;

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      {/* Pen-level worst-status strip — mirrors what a farmer would
          check first: is anything actively wrong ANYWHERE in the pen? */}
      <PenOverviewStrip
        penName={penName}
        stations={stations}
      />

      {/* Above-the-fold action row — Resync fans out to every station
          on the pen so it's a pen-level control, not a station one. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {multiStation && (
          <StationPicker
            stations={stations}
            activeIdx={safeIdx}
            onChange={setActiveIdx}
          />
        )}
        <div className={cn('flex flex-wrap items-center gap-2', !multiStation && 'ml-auto')}>
          {/* Add-station link — sends to the existing pair-device wizard
              which now supports naming the physical spot. Deep-linked
              here for the "my pen just got bigger" flow. */}
          <Button asChild variant="outline" size="sm">
            <Link href={`/pens/${data.pen.id}/pair-device`}>
              <Plus className="h-3.5 w-3.5" />
              Add station
            </Link>
          </Button>
          <ResyncButton penId={data.pen.id} />
        </div>
      </div>

      {activeCurrent ? (
        <>
          {/* Per-station device status strip (below the picker so the
              context is obvious — this is THIS station's health). */}
          <DeviceStatusStrip
            deviceStatus={active.device.status}
            lastSeenLabel={relativeTime(active.device.lastSeenAt)}
            battery={activeCurrent.battery}
            signal={activeCurrent.network.signal}
            overallStatus={computeOverallStatus(activeCurrent)}
            penName={multiStation ? undefined : penName}
            firmwareVersion={active.device.version}
            stationLabel={multiStation ? active.stationLabel : null}
          />

          {/* Zone trio — this station's heater zones. */}
          <section>
            <SectionHeader
              eyebrow="Heater zones"
              title={multiStation ? `${active.stationLabel ?? 'This station'} — temperature` : 'Pen temperature'}
              description="Each zone has its own heater. Status reads against the min / max thresholds set on the device."
            />
            <div className="mt-3 grid gap-3 sm:gap-4 md:grid-cols-3">
              <ZoneCard label="Left"   tone="amber" zone={activeCurrent.zones.left} />
              <ZoneCard label="Middle" tone="green" zone={activeCurrent.zones.middle} />
              <ZoneCard label="Right"  tone="sky"   zone={activeCurrent.zones.right} />
            </div>
          </section>

          {/* Environment row */}
          <section>
            <SectionHeader
              eyebrow="Air quality"
              title="Environment"
              description="Ammonia, CO2 and humidity. Out-of-range readings get the amber treatment so issues are obvious at a glance."
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <EnvChip
                icon={Droplet}
                label="Humidity"
                value={`${Math.round(activeCurrent.humidity.value)}%`}
                sub={activeCurrent.humidity.unit}
                tone={toneForStatus(activeCurrent.humidity.status)}
              />
              <EnvChip
                icon={Wind}
                label="Air quality"
                value={String(activeCurrent.airQuality.aqi)}
                sub={aqiLabel(activeCurrent.airQuality.status)}
                tone={toneForAQ(activeCurrent.airQuality.status)}
              />
              <EnvChip
                icon={Wind}
                label="NH₃"
                value={`${activeCurrent.airQuality.nh3Ppm}`}
                sub="ppm"
                tone={activeCurrent.airQuality.nh3Ppm > 25 ? 'rose' : activeCurrent.airQuality.nh3Ppm > 10 ? 'amber' : 'mint'}
              />
              <EnvChip
                icon={Wind}
                label="CO₂"
                value={`${activeCurrent.airQuality.co2Ppm.toLocaleString()}`}
                sub="ppm"
                tone={activeCurrent.airQuality.co2Ppm > 5000 ? 'rose' : activeCurrent.airQuality.co2Ppm > 2500 ? 'amber' : 'mint'}
              />
            </div>
          </section>

          {/* Controls — scoped to the active station's device_id so the
              MQTT publish lands on the right unit. */}
          <section>
            <SectionHeader
              eyebrow="Manual controls"
              title={multiStation ? `${active.stationLabel ?? 'This station'} — relays & socket` : 'Relays & socket'}
              description="Override the device's automatic decisions. Useful for one-off tasks like draining a drinker or testing a heater coil."
            />
            <ControlsPanel
              penId={data.pen.id}
              deviceId={active.device.deviceId}
              relays={activeCurrent.relays}
              socket={activeCurrent.socket}
            />
          </section>
        </>
      ) : (
        /* Station paired but never sent a reading yet — probably a
           freshly-plugged unit that hasn't finished its first cycle. */
        <section className="rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-8 text-center">
          <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <CloudOff className="h-4.5 w-4.5" />
          </span>
          <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">
            No readings yet from {active.stationLabel ?? 'this station'}
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
            Waiting for the device to send its first data frame. Check the
            unit is powered on and connected to Wi-Fi.
          </p>
        </section>
      )}

      {/* Device info grid — pen subscription + this station's device */}
      <section>
        <SectionHeader
          eyebrow="Device"
          title={multiStation ? `${active.stationLabel ?? 'Station'} info` : 'PENKEEP info'}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard icon={Calendar} label="Subscription">
            {subscription ? (
              <>
                <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
                  {fmtDate(subscription.startDate)} → {fmtDate(subscription.endDate)}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
                  {subscription.daysRemaining > 0
                    ? `${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? '' : 's'} remaining`
                    : 'Expired'}
                </p>
              </>
            ) : (
              <p className="text-[12px] text-[var(--color-brand-muted)]">No active subscription</p>
            )}
          </InfoCard>

          <InfoCard icon={Layers} label="Flock age">
            <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
              {flockAgeDays != null ? `${flockAgeDays} day${flockAgeDays === 1 ? '' : 's'}` : '—'}
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
              Actual bird age today
            </p>
          </InfoCard>

          {activeCurrent && (
            <InfoCard icon={Wifi} label="Network">
              <p className="break-all text-[13px] font-semibold text-[var(--color-brand-fg)]">
                {activeCurrent.network.ssid}
              </p>
              <p className="mt-0.5 break-all text-[11.5px] text-[var(--color-brand-muted)]">
                {activeCurrent.network.ipAddress} · {activeCurrent.network.signal}
              </p>
            </InfoCard>
          )}

          {activeCurrent?.location && (
            <InfoCard icon={MapPin} label="Location">
              <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
                {activeCurrent.location.lat.toFixed(4)}, {activeCurrent.location.lon.toFixed(4)}
              </p>
              <a
                href={`https://www.google.com/maps?q=${activeCurrent.location.lat},${activeCurrent.location.lon}`}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
              >
                Open in Maps
                <ArrowRight className="h-3 w-3" />
              </a>
            </InfoCard>
          )}

          {activeCurrent && (
            <InfoCard icon={Activity} label="Battery health">
              <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
                {activeCurrent.battery.healthPct.toFixed(1)}%
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
                {activeCurrent.battery.voltage.toFixed(2)} V
              </p>
            </InfoCard>
          )}

          <InfoCard icon={Radio} label="Firmware">
            <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
              PENKEEP v{active.device.version}
            </p>
            {active.device.serialNumber && (
              <p className="mt-0.5 break-all text-[11.5px] text-[var(--color-brand-muted)]">
                SN {active.device.serialNumber}
              </p>
            )}
          </InfoCard>
        </div>
      </section>
    </div>
  );
}

/**
 * Segmented station picker — the primary navigation on a multi-station
 * pen. Mobile keeps it single-row scroll; desktop stretches to fill.
 * We deliberately don't aggregate across stations: a hot corner is a
 * per-station problem and averaging hides it.
 */
function StationPicker({
  stations, activeIdx, onChange,
}: {
  stations: PenClimateStation[];
  activeIdx: number;
  onChange: (idx: number) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Station picker"
      className="inline-flex max-w-full snap-x flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-[var(--color-brand-border)] bg-white p-1"
    >
      {stations.map((s, i) => {
        const on = i === activeIdx;
        const status = s.current ? computeOverallStatus(s.current) : { tone: 'amber' as const, label: 'No data' };
        return (
          <button
            key={s.device.deviceId}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(i)}
            className={cn(
              'flex snap-start items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors',
              on
                ? 'bg-[var(--color-brand-primary)] text-white'
                : 'bg-transparent text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]',
            )}
          >
            {/* Small status dot borrows the same tone the overall strip
                would show, so a red corner shouts even from the picker. */}
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status.tone === 'rose' ? 'bg-rose-500'
                  : status.tone === 'amber' ? 'bg-amber-500'
                  : 'bg-emerald-500',
              )}
            />
            <span className="whitespace-nowrap">
              {s.stationLabel ?? `Station ${i + 1}`}
            </span>
            {s.device.status === 'offline' && (
              <span
                aria-label="offline"
                className={cn(
                  'inline-block rounded px-1 text-[9px] font-bold uppercase',
                  on ? 'bg-white/25' : 'bg-rose-100 text-rose-700',
                )}
              >
                off
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Pen-level overview — one card that tells the farmer, before they've
 * picked a station, whether ANY corner of the pen needs their attention.
 * Aggregates the worst status across stations because a hot corner
 * matters more than a warm average.
 */
function PenOverviewStrip({
  penName, stations,
}: {
  penName?: string;
  stations: PenClimateStation[];
}) {
  const withData = stations.filter((s): s is PenClimateStation & { current: NonNullable<PenClimateStation['current']> } => s.current !== null);

  // Worst-status wins so the badge screams when even one station is off.
  const worst = withData.reduce<'mint' | 'amber' | 'rose' | null>((acc, s) => {
    const t = computeOverallStatus(s.current).tone;
    if (acc === 'rose' || t === 'rose') return 'rose';
    if (acc === 'amber' || t === 'amber') return 'amber';
    return 'mint';
  }, null) ?? 'amber';

  const online = stations.filter((s) => s.device.status === 'online').length;
  const total = stations.length;

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            Pen climate
          </p>
          <h1 className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)] sm:text-[18px]">
            {penName ?? 'This pen'}
            {total > 1 && (
              <span className="ml-2 rounded-full bg-[var(--color-brand-accent)] px-2 py-0.5 align-middle text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
                {total} stations
              </span>
            )}
          </h1>
          <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
            {online} of {total} online · pick a station below to inspect its readings.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
            worst === 'rose' ? 'bg-rose-50 text-rose-700'
              : worst === 'amber' ? 'bg-amber-50 text-amber-800'
              : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
          )}
        >
          {worst === 'rose'
            ? <AlertTriangle className="h-3.5 w-3.5" />
            : worst === 'amber'
              ? <AlertTriangle className="h-3.5 w-3.5" />
              : <BadgeCheck className="h-3.5 w-3.5" />}
          {worst === 'rose'
            ? 'Attention needed'
            : worst === 'amber'
              ? 'Watch closely'
              : 'All good'}
        </span>
      </div>
    </section>
  );
}

/* ─────────────────────────── Section header ─────────────────────────── */

function SectionHeader({
  eyebrow, title, description,
}: { eyebrow: string; title: string; description?: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)] sm:text-[16px]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 max-w-[60ch] text-[12px] leading-relaxed text-[var(--color-brand-muted)]">
          {description}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────── Resync button ─────────────────────────── */

/**
 * Force the paired PENKEEP to re-sync flock data with the pen's active
 * flock. Backend republishes `new_flock_cmd`; the device reboots and
 * refreshes its subscription window / placement age / batch on next
 * contact. `mqtt_published: false` = broker unreachable now, so we warn
 * rather than success.
 */
function ResyncButton({ penId, className }: { penId: string; className?: string }) {
  const qc = useQueryClient();
  const resync = useMutation({
    mutationFn: () => endpoints.resyncPenkeep(penId),
    onSuccess: (res) => {
      // Backend returns { mqtt_published, stations?: [...] } — the boolean
      // is true only when every station's publish succeeded. Multi-station
      // pens land in the mixed-success branch when some units are offline.
      if (res.mqtt_published) {
        toast.success('Resync sent — devices will reboot and refresh.');
      } else {
        toast.warning('Some stations couldn’t be reached — they’ll pick up the change on next contact.');
      }
      qc.invalidateQueries({ queryKey: ['pen-climate', penId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not send resync.')),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => resync.mutate()}
      disabled={resync.isPending}
      className={cn('shrink-0', className)}
    >
      {resync.isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <RefreshCw className="h-3.5 w-3.5" />}
      Resync
    </Button>
  );
}

/* ─────────────────────────── Status strip ─────────────────────────── */

function DeviceStatusStrip({
  deviceStatus, lastSeenLabel, battery, signal, overallStatus, penName, firmwareVersion, stationLabel,
}: {
  deviceStatus: 'online' | 'offline';
  lastSeenLabel: string;
  battery: NonNullable<PenClimateStation['current']>['battery'];
  signal: 'excellent' | 'good' | 'fair' | 'poor';
  overallStatus: { tone: 'mint' | 'amber' | 'rose'; label: string };
  penName?: string;
  firmwareVersion: string;
  /** Set on multi-station pens to disambiguate which corner this is. */
  stationLabel?: string | null;
}) {
  const offline = deviceStatus === 'offline';

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            PENKEEP {firmwareVersion}
            {stationLabel && <span className="ml-2 text-[var(--color-brand-muted)]">· {stationLabel}</span>}
          </p>
          <h1 className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)] sm:text-[18px]">
            {stationLabel
              ? `${stationLabel} station`
              : penName ? `${penName} climate` : 'Pen climate'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
              offline
                ? 'bg-rose-50 text-rose-700'
                : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
            )}>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                offline ? 'bg-rose-500' : 'bg-[var(--color-brand-primary)] animate-pulse',
              )} />
              {offline ? 'Offline' : 'Live'}
            </span>
            <span className="text-[11px] text-[var(--color-brand-muted)]">· last seen {lastSeenLabel}</span>
          </div>
        </div>

        {/* Right-side mini metrics */}
        <div className="flex flex-wrap items-center gap-2">
          <PillMetric icon={signalIcon()} label={signal} />
          <PillMetric
            icon={battery.charging ? BatteryCharging : batteryIcon(battery.level)}
            label={`${battery.level}%`}
            tone={battery.level < 20 ? 'rose' : battery.level < 40 ? 'amber' : 'mint'}
          />
          <PillMetric
            icon={overallStatus.tone === 'mint' ? BadgeCheck : AlertTriangle}
            label={overallStatus.label}
            tone={overallStatus.tone}
          />
        </div>
      </div>
    </section>
  );
}

function PillMetric({
  icon: Icon, label, tone = 'mint',
}: {
  icon: typeof BadgeCheck;
  label: string;
  tone?: 'mint' | 'amber' | 'rose';
}) {
  const toneClass = tone === 'rose'
    ? 'bg-rose-50 text-rose-700'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-800'
      : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wider',
      toneClass,
    )}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/* ─────────────────────────── Zone card ─────────────────────────── */

function ZoneCard({
  label, tone, zone,
}: {
  label: string;
  tone: 'amber' | 'green' | 'sky';
  zone: PenClimateZone;
}) {
  const unitGlyph = zone.unit === 'celsius' ? '°C' : '°F';
  const pctOfRange = clamp01((zone.current - zone.min) / Math.max(0.1, zone.max - zone.min)) * 100;

  // Tone palette — softened versions of the PENKEEP LCD colours so they
  // sit naturally inside the app's brand language while still echoing
  // the device the farmer reads on the wall.
  const toneClass =
    tone === 'amber' ? 'from-amber-50 to-amber-100/40 border-amber-200'
    : tone === 'sky'  ? 'from-sky-50 to-sky-100/40 border-sky-200'
    :                   'from-[var(--color-brand-accent)]/55 to-[var(--color-brand-accent)]/30 border-[var(--color-brand-primary)]/30';
  const accentText =
    tone === 'amber' ? 'text-amber-800'
    : tone === 'sky'  ? 'text-sky-800'
    :                   'text-[var(--color-brand-primary-deep)]';
  const fillColor =
    tone === 'amber' ? 'bg-amber-400'
    : tone === 'sky'  ? 'bg-sky-500'
    :                   'bg-[var(--color-brand-primary)]';
  const statusBadge = (() => {
    if (zone.status === 'high') return { label: 'High', tone: 'rose' as const, icon: ThermometerSun };
    if (zone.status === 'low')  return { label: 'Low',  tone: 'amber' as const, icon: ThermometerSnowflake };
    return { label: 'Normal', tone: 'mint' as const, icon: Thermometer };
  })();
  const Badge = statusBadge.icon;
  const badgeClass =
    statusBadge.tone === 'rose' ? 'bg-rose-100 text-rose-700'
    : statusBadge.tone === 'amber' ? 'bg-amber-100 text-amber-800'
    : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';

  return (
    <article className={cn(
      'w-full min-w-0 overflow-hidden rounded-2xl border bg-gradient-to-br p-4 sm:p-5',
      toneClass,
    )}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn(
          'inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
          accentText,
        )}>
          {label}
        </p>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
          badgeClass,
        )}>
          <Badge className="h-3 w-3" strokeWidth={2.4} />
          {statusBadge.label}
        </span>
      </div>

      <p className="mt-3 text-[36px] font-bold leading-none tracking-tight text-[var(--color-brand-fg)] sm:text-[40px]">
        {zone.current.toFixed(1)}<span className="text-[18px] font-semibold text-[var(--color-brand-muted)] sm:text-[20px]">{unitGlyph}</span>
      </p>

      {/* Min → Max range bar with current-value indicator */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-brand-fg-soft)]">
          <span>Min {zone.min}°</span>
          <span>Max {zone.max}°</span>
        </div>
        <div className="relative mt-1.5 h-1.5 rounded-full bg-white/70">
          <div
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all', fillColor)}
            style={{ width: `${pctOfRange}%` }}
          />
          <span
            className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white bg-[var(--color-brand-fg)] shadow"
            style={{ left: `${pctOfRange}%` }}
          />
        </div>
      </div>

      {/* Heater state */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-white/85 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-brand-fg)]">
          <Flame className={cn('h-3.5 w-3.5', zone.heaterOn ? 'text-rose-600' : 'text-[var(--color-brand-muted)]')} />
          Heater
        </span>
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
          zone.heaterOn ? 'bg-rose-100 text-rose-700' : 'bg-[var(--color-brand-bg)] text-[var(--color-brand-muted)]',
        )}>
          {zone.heaterOn ? 'On' : 'Off'}
        </span>
      </div>
    </article>
  );
}

/* ─────────────────────────── Environment chip ─────────────────────────── */

function EnvChip({
  icon: Icon, label, value, sub, tone,
}: {
  icon: typeof Droplet;
  label: string;
  value: string;
  sub?: string;
  tone: 'mint' | 'amber' | 'rose' | 'muted';
}) {
  const toneClass = tone === 'rose'
    ? 'border-rose-200 bg-rose-50/60'
    : tone === 'amber'
      ? 'border-amber-200 bg-amber-50/60'
      : tone === 'muted'
        ? 'border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40'
        : 'border-[var(--color-brand-primary)]/25 bg-[var(--color-brand-accent)]/30';
  const valueClass = tone === 'rose'
    ? 'text-rose-700'
    : tone === 'amber'
      ? 'text-amber-800'
      : tone === 'muted'
        ? 'text-[var(--color-brand-fg)]'
        : 'text-[var(--color-brand-primary-deep)]';

  return (
    <article className={cn(
      'w-full min-w-0 overflow-hidden rounded-2xl border p-4',
      toneClass,
    )}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-muted)]">
            {label}
          </p>
          <p className={cn('mt-0.5 break-words text-[20px] font-bold leading-tight tracking-tight', valueClass)}>
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-[11px] text-[var(--color-brand-muted)]">{sub}</p>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────── Controls panel ─────────────────────────── */

function ControlsPanel({
  penId, deviceId, relays, socket,
}: {
  penId: string;
  /** Which station's relays we're toggling. Required now that pens can
      have multiple devices — the backend needs to know which unit to
      publish the MQTT command to. */
  deviceId: string;
  relays: PenClimateRelay[];
  socket: { on: boolean };
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {relays.map((r) => (
        <RelayToggle key={r.id} penId={penId} deviceId={deviceId} relay={r} />
      ))}
      <RelayToggle
        penId={penId}
        deviceId={deviceId}
        relay={{ id: 'socket', label: 'Master socket', on: socket.on }}
        icon={Plug}
      />
    </div>
  );
}

function RelayToggle({
  penId, deviceId, relay, icon = Power,
}: {
  penId: string;
  deviceId: string;
  relay: PenClimateRelay;
  icon?: typeof Power;
}) {
  const qc = useQueryClient();
  // Local-pending state so the toggle paints the new position immediately
  // — TanStack mutation state can't differentiate between "this relay
  // toggling" and "another relay toggling" inside the same panel.
  const [pendingOn, setPendingOn] = useState<boolean | null>(null);
  const isOn = pendingOn ?? relay.on;
  const Icon = icon;

  const set = useMutation({
    mutationFn: (on: boolean) => endpoints.setPenClimateRelay(penId, relay.id, on, deviceId),
    onMutate: (on) => setPendingOn(on),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pen-climate', penId] });
      setPendingOn(null);
    },
    onError: (err) => {
      // Rollback the optimistic position so the user can see the
      // previous truth restored.
      setPendingOn(null);
      toast.error(apiErrorMessage(err, 'Could not toggle that relay.'));
    },
  });

  return (
    <button
      type="button"
      onClick={() => set.mutate(!isOn)}
      disabled={set.isPending}
      className={cn(
        'group flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-colors',
        isOn
          ? 'border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-accent)]/30 hover:bg-[var(--color-brand-accent)]/50'
          : 'border-[var(--color-brand-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
        set.isPending && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          isOn ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-[var(--color-brand-bg)] text-[var(--color-brand-muted)]',
        )}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-muted)]">
            {relay.id}
          </p>
          <p className="truncate text-[13px] font-semibold text-[var(--color-brand-fg)]">
            {relay.label ?? `Relay ${relay.id}`}
          </p>
        </div>
      </div>
      {/* Switch */}
      <span className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
        isOn ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-input-border)]',
      )}>
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            isOn ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </span>
    </button>
  );
}

/* ─────────────────────────── Info card ─────────────────────────── */

function InfoCard({
  icon: Icon, label, children,
}: {
  icon: typeof Calendar;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-muted)]">
            {label}
          </p>
          <div className="mt-0.5">
            {children}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────── Empty / setup state ─────────────────────────── */

function SetupEmptyState({ penId, penName }: { penId: string; penName?: string }) {
  return (
    <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-6 sm:p-10">
      <div className="mx-auto max-w-[520px] text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <CloudOff className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          No PENKEEP paired with {penName ?? 'this pen'} yet
        </h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-brand-muted)]">
          Once a PENKEEP unit is wired up and connected to Wi-Fi, this page
          lights up with live temperature for each heater zone, humidity,
          air quality (NH₃ / CO₂), battery, GPS and manual relay controls.
        </p>

        <ol className="mx-auto mt-5 max-w-[420px] space-y-2 text-left">
          <SetupStep n={1} title="Power up the PENKEEP">
            Plug in the unit and wait for the screen to show three temperature zones.
          </SetupStep>
          <SetupStep n={2} title="Connect to Wi-Fi">
            Tap <strong>Reset Wi-Fi</strong> on the device, join the <code>PENKEEP-Setup</code> hotspot from your phone, and pick your home network.
          </SetupStep>
          <SetupStep n={3} title="Pair to this pen">
            Open <strong>Settings → Devices</strong> on the app, scan the QR code on the back of the unit, and pick this pen.
          </SetupStep>
        </ol>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm">
            <a href={`/pens/${penId}/pair-device`}>
              <QrCode className="h-3.5 w-3.5" />
              Pair my PENKEEP
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="https://farmsupport.com/penkeep" target="_blank" rel="noreferrer">
              <BarChart3 className="h-3.5 w-3.5" />
              Buy a PENKEEP
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

function SetupStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 p-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[12px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold text-[var(--color-brand-fg)]">{title}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-fg-soft)]">{children}</p>
      </div>
    </li>
  );
}

/* ─────────────────────────── Skeleton ─────────────────────────── */

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-2xl bg-white" />
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function computeOverallStatus(current: NonNullable<PenClimateDto['current']>): {
  tone: 'mint' | 'amber' | 'rose';
  label: string;
} {
  const zones = [current.zones.left, current.zones.middle, current.zones.right];
  const anyHigh = zones.some((z) => z.status === 'high');
  if (anyHigh) return { tone: 'rose', label: 'Hot zone' };
  const anyLow = zones.some((z) => z.status === 'low');
  if (anyLow) return { tone: 'amber', label: 'Cold zone' };

  if (current.airQuality.status === 'poor' || current.airQuality.nh3Ppm > 25 || current.airQuality.co2Ppm > 5000) {
    return { tone: 'rose', label: 'Air quality' };
  }
  if (current.airQuality.status === 'moderate' || current.airQuality.nh3Ppm > 10 || current.airQuality.co2Ppm > 2500) {
    return { tone: 'amber', label: 'Air quality' };
  }

  return { tone: 'mint', label: 'All good' };
}

function toneForStatus(s: 'low' | 'normal' | 'high'): 'mint' | 'amber' | 'rose' {
  return s === 'normal' ? 'mint' : s === 'low' ? 'amber' : 'rose';
}

function toneForAQ(s: NonNullable<PenClimateDto['current']>['airQuality']['status']): 'mint' | 'amber' | 'rose' | 'muted' {
  if (s === 'good') return 'mint';
  if (s === 'moderate') return 'amber';
  if (s === 'poor' || s === 'error') return 'rose';
  return 'muted';
}

function aqiLabel(s: NonNullable<PenClimateDto['current']>['airQuality']['status']): string {
  if (s === 'stabilising') return 'Warming up sensor';
  if (s === 'error') return 'Sensor error';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function batteryIcon(level: number): typeof BatteryFull {
  if (level > 70) return BatteryFull;
  return Battery;
}

function signalIcon(): typeof Signal {
  // Lucide ships a single Signal glyph; quality is conveyed via the
  // pill label rather than glyph variants. Kept as a function for
  // symmetry with batteryIcon and to leave room for breakpoint
  // changes later (e.g. SignalLow when level === 'poor').
  return Signal;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const seconds = Math.max(0, Math.floor((now - then) / 1000));
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86_400)}d ago`;
  } catch {
    return '—';
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

