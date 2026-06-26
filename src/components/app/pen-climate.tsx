'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, BadgeCheck, Battery, BatteryCharging, BatteryFull,
  Calendar, CloudOff, Flame, MapPin, Plug, Power, Radio, Settings, Signal,
  Thermometer, ThermometerSnowflake, ThermometerSun, Wifi, Wind, Droplet,
  ArrowRight, BarChart3, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  apiErrorMessage, endpoints,
  type PenClimateDto, type PenClimateRelay, type PenClimateZone,
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
export function PenClimate({ penId, penName }: { penId: string; penName?: string }) {
  // Poll every 30s so the page stays current without a websocket.
  // Background refetches don't show a skeleton — the previous reading
  // stays painted until the new one lands.
  const query = useQuery({
    queryKey: ['pen-climate', penId],
    queryFn: () => endpoints.getPenClimate(penId),
    enabled: !!penId,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (query.isLoading && !query.data) {
    return <Skeleton />;
  }

  const data = query.data;
  if (!data || !data.device || !data.current) {
    return <SetupEmptyState penName={penName} />;
  }

  return <Live data={data} penName={penName} />;
}

/* ─────────────────────────── Live (data present) ─────────────────────────── */

function Live({ data, penName }: { data: PenClimateDto; penName?: string }) {
  const { device, current, subscription, flockAgeDays } = data;
  if (!device || !current) return null;

  const overallStatus = computeOverallStatus(current);
  const lastSeen = relativeTime(device.lastSeenAt);

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      {/* Header strip — at-a-glance device health */}
      <DeviceStatusStrip
        deviceStatus={device.status}
        lastSeenLabel={lastSeen}
        battery={current.battery}
        signal={current.network.signal}
        overallStatus={overallStatus}
        penName={penName}
        firmwareVersion={device.version}
      />

      {/* Zone trio — primary content */}
      <section>
        <SectionHeader
          eyebrow="Heater zones"
          title="Pen temperature"
          description="Each zone has its own heater. Status reads against the min / max thresholds set on the device."
        />
        <div className="mt-3 grid gap-3 sm:gap-4 md:grid-cols-3">
          <ZoneCard label="Left"   tone="amber" zone={current.zones.left} />
          <ZoneCard label="Middle" tone="green" zone={current.zones.middle} />
          <ZoneCard label="Right"  tone="sky"   zone={current.zones.right} />
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
            value={`${Math.round(current.humidity.value)}%`}
            sub={current.humidity.unit}
            tone={toneForStatus(current.humidity.status)}
          />
          <EnvChip
            icon={Wind}
            label="Air quality"
            value={String(current.airQuality.aqi)}
            sub={aqiLabel(current.airQuality.status)}
            tone={toneForAQ(current.airQuality.status)}
          />
          <EnvChip
            icon={Wind}
            label="NH₃"
            value={`${current.airQuality.nh3Ppm}`}
            sub="ppm"
            tone={current.airQuality.nh3Ppm > 25 ? 'rose' : current.airQuality.nh3Ppm > 10 ? 'amber' : 'mint'}
          />
          <EnvChip
            icon={Wind}
            label="CO₂"
            value={`${current.airQuality.co2Ppm.toLocaleString()}`}
            sub="ppm"
            tone={current.airQuality.co2Ppm > 5000 ? 'rose' : current.airQuality.co2Ppm > 2500 ? 'amber' : 'mint'}
          />
        </div>
      </section>

      {/* Controls */}
      <section>
        <SectionHeader
          eyebrow="Manual controls"
          title="Relays & socket"
          description="Override the device's automatic decisions. Useful for one-off tasks like draining a drinker or testing a heater coil."
        />
        <ControlsPanel
          penId={data.pen.id}
          relays={current.relays}
          socket={current.socket}
        />
      </section>

      {/* Device info grid */}
      <section>
        <SectionHeader
          eyebrow="Device"
          title="PENKEEP info"
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
              Since the active flock was placed
            </p>
          </InfoCard>

          <InfoCard icon={Wifi} label="Network">
            <p className="break-all text-[13px] font-semibold text-[var(--color-brand-fg)]">
              {current.network.ssid}
            </p>
            <p className="mt-0.5 break-all text-[11.5px] text-[var(--color-brand-muted)]">
              {current.network.ipAddress} · {current.network.signal}
            </p>
          </InfoCard>

          <InfoCard icon={MapPin} label="Location">
            {current.location ? (
              <>
                <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
                  {current.location.lat.toFixed(4)}, {current.location.lon.toFixed(4)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${current.location.lat},${current.location.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
                >
                  Open in Maps
                  <ArrowRight className="h-3 w-3" />
                </a>
              </>
            ) : (
              <p className="text-[12px] text-[var(--color-brand-muted)]">No GPS fix</p>
            )}
          </InfoCard>

          <InfoCard icon={Activity} label="Battery health">
            <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
              {current.battery.healthPct.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
              {current.battery.voltage.toFixed(2)} V
            </p>
          </InfoCard>

          <InfoCard icon={Radio} label="Firmware">
            <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">
              PENKEEP v{device.version}
            </p>
            {device.serialNumber && (
              <p className="mt-0.5 break-all text-[11.5px] text-[var(--color-brand-muted)]">
                SN {device.serialNumber}
              </p>
            )}
          </InfoCard>
        </div>
      </section>
    </div>
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

/* ─────────────────────────── Status strip ─────────────────────────── */

function DeviceStatusStrip({
  deviceStatus, lastSeenLabel, battery, signal, overallStatus, penName, firmwareVersion,
}: {
  deviceStatus: 'online' | 'offline';
  lastSeenLabel: string;
  battery: NonNullable<PenClimateDto['current']>['battery'];
  signal: 'excellent' | 'good' | 'fair' | 'poor';
  overallStatus: { tone: 'mint' | 'amber' | 'rose'; label: string };
  penName?: string;
  firmwareVersion: string;
}) {
  const offline = deviceStatus === 'offline';

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            PENKEEP {firmwareVersion}
          </p>
          <h1 className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)] sm:text-[18px]">
            {penName ? `${penName} climate` : 'Pen climate'}
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
  penId, relays, socket,
}: {
  penId: string;
  relays: PenClimateRelay[];
  socket: { on: boolean };
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {relays.map((r) => (
        <RelayToggle key={r.id} penId={penId} relay={r} />
      ))}
      <RelayToggle
        penId={penId}
        relay={{ id: 'socket', label: 'Master socket', on: socket.on }}
        icon={Plug}
      />
    </div>
  );
}

function RelayToggle({
  penId, relay, icon = Power,
}: {
  penId: string;
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
    mutationFn: (on: boolean) => endpoints.setPenClimateRelay(penId, relay.id, on),
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

function SetupEmptyState({ penName }: { penName?: string }) {
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
          <Button asChild size="sm" variant="outline">
            <a href="/settings">
              <Settings className="h-3.5 w-3.5" />
              Open device settings
            </a>
          </Button>
          <Button asChild size="sm">
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

