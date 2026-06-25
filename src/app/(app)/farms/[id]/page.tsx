'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Beef, Bird, Camera, Check, Egg, ImageIcon, Loader2,
  MapPin, Pencil, Tractor, Trash2, Warehouse, Wheat,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import { apiErrorMessage, endpoints, type FarmDto } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Farm detail + edit page.
 *
 *   - All members see the farm at a glance: logo, name, location,
 *     primary production, capacity, pen/flock counts.
 *   - Owners get inline edit for name / state / address / capacity /
 *     primary production, plus logo upload + remove.
 *   - Managers and staff see the same view but without the edit
 *     affordances (the backend would 403 anyway; hiding the buttons
 *     matches the dashboard's Gate-based UX).
 *
 * Layout mirrors the profile page so the two pages feel like siblings.
 */
export default function FarmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const farmQuery = useQuery({
    queryKey: ['farm', id],
    queryFn: () => endpoints.showFarm(id),
    staleTime: 30_000,
  });

  const farm = farmQuery.data?.farm;
  const canEdit = farm?.membership?.role === 'owner';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/farms"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary-deep)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All farms
        </Link>
      </div>

      {farmQuery.isLoading && !farm ? (
        <SkeletonStack />
      ) : !farm ? (
        <ErrorState onRetry={() => qc.invalidateQueries({ queryKey: ['farm', id] })} />
      ) : (
        <>
          <PageHeader
            eyebrow="Farm"
            title={farm.name}
            description={[farm.state, farm.address].filter(Boolean).join(' · ') || 'No location set'}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <LogoBlock farm={farm} canEdit={canEdit} />
            <div className="space-y-4">
              <DetailsBlock farm={farm} canEdit={canEdit} />
              <StatsBlock farm={farm} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────── Logo ─────────────────────────── */

function LogoBlock({ farm, canEdit }: { farm: FarmDto; canEdit: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => endpoints.uploadFarmLogo(farm.id, file),
    // Write the server's authoritative farm back into the cache so the
    // UI swaps the logo immediately. See profile page for the same
    // pattern.
    onSuccess: (data) => {
      toast.success('Logo updated.');
      qc.setQueryData(['farm', farm.id], { farm: data.farm });
      qc.invalidateQueries({ queryKey: ['farm', farm.id] });
      qc.invalidateQueries({ queryKey: ['farms'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not upload the logo.')),
  });

  const remove = useMutation({
    mutationFn: () => endpoints.removeFarmLogo(farm.id),
    onSuccess: (data) => {
      toast.success('Logo removed.');
      qc.setQueryData(['farm', farm.id], { farm: data.farm });
      qc.invalidateQueries({ queryKey: ['farm', farm.id] });
      qc.invalidateQueries({ queryKey: ['farms'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not remove the logo.')),
  });

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-6">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Logo src={farm.logoUrl ?? null} size={104} />
          {canEdit && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className={cn(
                'absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[var(--color-brand-primary)] text-white shadow-md transition hover:bg-[var(--color-brand-primary-deep)]',
                upload.isPending && 'opacity-60',
              )}
              aria-label="Upload logo"
            >
              {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
        </div>

        <p className="mt-4 text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)]">{farm.name}</p>
        {farm.membership?.role && (
          <span className={cn(
            'mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
            farm.membership.role === 'owner'
              ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
              : farm.membership.role === 'manager'
                ? 'bg-sky-50 text-sky-700'
                : 'bg-[var(--color-brand-bg)] text-[var(--color-brand-fg-soft)]',
          )}>
            You are {farm.membership.role}
          </span>
        )}
        <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
          {productionLabel(farm.primaryProduction)}
        </p>

        {canEdit && farm.logoUrl && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-8 text-[11.5px] text-[var(--color-brand-muted)]"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            <Trash2 className="h-3 w-3" />
            Remove logo
          </Button>
        )}
      </div>
    </article>
  );
}

function Logo({ src, size }: { src: string | null; size: number }) {
  if (src) {
    return (
      // key={src} — see Avatar in /profile for the rationale.
      <img
        key={src}
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-2xl border-2 border-[var(--color-brand-border)] object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-2xl border-2 border-white bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] text-white shadow-[0_8px_24px_-12px_rgba(15,80,30,0.30)]"
      style={{ width: size, height: size }}
    >
      <Tractor className="h-10 w-10" />
    </div>
  );
}

/* ─────────────────────────── Details (view + edit) ─────────────────────────── */

function DetailsBlock({ farm, canEdit }: { farm: FarmDto; canEdit: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(farm.name);
  const [state, setState] = useState(farm.state ?? '');
  const [address, setAddress] = useState(farm.address ?? '');
  const [capacity, setCapacity] = useState(farm.estimatedCapacity?.toString() ?? '');
  const [production, setProduction] = useState<'broiler' | 'layer' | 'mixed'>(
    farm.primaryProduction ?? 'mixed',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(farm.name);
    setState(farm.state ?? '');
    setAddress(farm.address ?? '');
    setCapacity(farm.estimatedCapacity?.toString() ?? '');
    setProduction(farm.primaryProduction ?? 'mixed');
  }, [farm.name, farm.state, farm.address, farm.estimatedCapacity, farm.primaryProduction]);

  const save = useMutation({
    mutationFn: () => {
      // Only changed fields — `sometimes` on the backend means omitted
      // keys stay at their current value.
      const payload: Parameters<typeof endpoints.updateFarm>[1] = {};
      if (name.trim() && name !== farm.name) payload.name = name.trim();
      if (state !== (farm.state ?? '')) payload.state = state;
      if (address !== (farm.address ?? '')) payload.address = address;
      const cap = capacity === '' ? null : Math.max(1, Math.min(10_000_000, Math.trunc(Number(capacity))));
      if (cap !== null && cap !== farm.estimatedCapacity) payload.estimated_capacity = cap;
      if (production !== farm.primaryProduction) payload.primary_production = production;
      return endpoints.updateFarm(farm.id, payload);
    },
    onSuccess: () => {
      toast.success('Farm details updated.');
      setEditing(false);
      setErrors({});
      qc.invalidateQueries({ queryKey: ['farm', farm.id] });
      qc.invalidateQueries({ queryKey: ['farms'] });
    },
    onError: (err) => {
      const ax = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      const fieldErrs = ax.response?.data?.errors ?? null;
      if (fieldErrs) {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(fieldErrs)) {
          next[k] = Array.isArray(v) ? (v[0] ?? '') : String(v);
        }
        setErrors(next);
      }
      toast.error(apiErrorMessage(err, 'Could not save the farm.'));
    },
  });

  if (editing) {
    return (
      <article className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Farm details</h2>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <div>
            <Label htmlFor="farm-name">Farm name</Label>
            <Input
              id="farm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={save.isPending}
              autoComplete="organization"
            />
            <FieldError message={errors.name} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="farm-state">State</Label>
              <Input
                id="farm-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Lagos"
                disabled={save.isPending}
              />
              <FieldError message={errors.state} />
            </div>
            <div>
              <Label htmlFor="farm-capacity">Capacity (birds)</Label>
              <Input
                id="farm-capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={10_000_000}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="2,500"
                disabled={save.isPending}
              />
              <FieldError message={errors.estimated_capacity} />
            </div>
          </div>
          <div>
            <Label htmlFor="farm-address">Address</Label>
            <Input
              id="farm-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="No 12, Iyaba rd, Ikorodu"
              disabled={save.isPending}
              autoComplete="street-address"
            />
            <FieldError message={errors.address} />
          </div>
          <div>
            <Label>Primary production</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(['broiler', 'layer', 'mixed'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setProduction(opt)}
                  disabled={save.isPending}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-[11.5px] font-semibold transition',
                    production === opt
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40 text-[var(--color-brand-primary-deep)]'
                      : 'border-[var(--color-brand-border)] bg-white text-[var(--color-brand-fg-soft)] hover:border-[var(--color-brand-primary)]/40',
                  )}
                >
                  {opt === 'broiler' && <Beef className="h-4 w-4" />}
                  {opt === 'layer' && <Egg className="h-4 w-4" />}
                  {opt === 'mixed' && <Bird className="h-4 w-4" />}
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
            <FieldError message={errors.primary_production} />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save changes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(false);
                setErrors({});
                setName(farm.name);
                setState(farm.state ?? '');
                setAddress(farm.address ?? '');
                setCapacity(farm.estimatedCapacity?.toString() ?? '');
                setProduction(farm.primaryProduction ?? 'mixed');
              }}
              disabled={save.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Farm details</h2>
        {canEdit && (
          <Button variant="outline" size="sm" className="h-8 text-[11.5px]" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
      </div>
      <div className="space-y-3">
        <DetailRow icon={Tractor} label="Farm name" value={farm.name} />
        <DetailRow
          icon={MapPin}
          label="Location"
          value={[farm.state, farm.address].filter(Boolean).join(' · ') || 'Not set'}
        />
        <DetailRow
          icon={productionIcon(farm.primaryProduction)}
          label="Primary production"
          value={productionLabel(farm.primaryProduction)}
        />
        <DetailRow
          icon={Wheat}
          label="Capacity"
          value={farm.estimatedCapacity
            ? `${farm.estimatedCapacity.toLocaleString()} birds`
            : 'Not set'}
        />
      </div>
    </article>
  );
}

function DetailRow({
  icon: Icon, label, value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 px-3 py-2.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-muted)]">{label}</p>
        <p className="truncate text-[13px] font-semibold text-[var(--color-brand-fg)]">{value}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── Stats ─────────────────────────── */

function StatsBlock({ farm }: { farm: FarmDto }) {
  return (
    <article className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Activity</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={Warehouse}
          label="Pens"
          value={farm.farmStat?.activePensCount ?? 0}
        />
        <Stat
          icon={Bird}
          label="Active flocks"
          value={farm.farmStat?.activeFlocksCount ?? 0}
        />
        <Stat
          icon={Warehouse}
          label="Free pens"
          value={farm.farmStat?.freePens ?? 0}
        />
      </div>
    </article>
  );
}

function Stat({
  icon: Icon, label, value,
}: {
  icon: typeof Warehouse;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 px-3 py-3 text-center">
      <span className="mx-auto mb-1 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <p className="text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)]">{value.toLocaleString()}</p>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-muted)]">{label}</p>
    </div>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function productionLabel(p: FarmDto['primaryProduction']): string {
  if (p === 'broiler') return 'Broilers for meat';
  if (p === 'layer') return 'Layers for eggs';
  if (p === 'mixed') return 'Mixed (meat + eggs)';
  return 'Not set';
}

function productionIcon(p: FarmDto['primaryProduction']): typeof Bird {
  if (p === 'broiler') return Beef;
  if (p === 'layer') return Egg;
  return Bird;
}

/* ─────────────────────────── Skeletons / errors ─────────────────────────── */

function SkeletonStack() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="h-72 animate-pulse rounded-2xl bg-white" />
      <div className="space-y-4">
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <ImageIcon className="mx-auto h-6 w-6 text-[var(--color-brand-muted)]" />
      <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">
        Could not load this farm
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
