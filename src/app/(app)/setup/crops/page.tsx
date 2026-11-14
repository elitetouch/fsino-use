'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Loader2, Sprout, ThermometerSun, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { SetupStepper } from '@/components/setup/stepper';
import { useVertical } from '@/lib/vertical';
import { useCurrentFarmId } from '@/lib/farm-context';
import {
  apiErrorMessage,
  endpoints,
  type CropOptionDto,
  type GreenhouseCropKey,
  type PenDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Step 3 (greenhouse) — Place your first crop.
 *
 * WHY THIS IS NOT setup/flocks WITH DIFFERENT WORDS. That page is a
 * 719-line three-part poultry wizard: production type, breed from the
 * breeds table, hatchery, bird count, age at placement, price per bird
 * and a token tier. A greenhouse has no breeds, no hatchery and no
 * tokens, so most of it is questions a grower cannot answer. It mirrors
 * the backend split, where CropCycleController sits beside
 * FlockController rather than inside it.
 *
 * THE CROP PICKER IS THE TEACHING MOMENT. Choosing a crop here fixes
 * the climate the bay will be judged against for the whole cycle, so
 * the band is shown at the point of choosing rather than buried in a
 * settings screen afterwards. The critical high is called out
 * separately from the comfort ceiling because the two fail differently:
 * drifting over the ceiling costs yield, while passing the critical
 * high loses the crop outright — and in this climate that is the one
 * that actually happens.
 */

const schema = z.object({
  crop: z.string().min(1, 'Choose what you are planting.'),
  pen_id: z.string().min(1, 'Choose which bay this is going into.'),
  plants_placed: z.coerce
    .number({ invalid_type_error: 'Enter a number.' })
    .int('Whole units only.')
    .min(1, 'At least one.')
    .max(10_000_000, 'That is more than we can record.'),
  variety: z.string().max(255).optional(),
  start_date: z.string().min(1, 'Pick a date.'),
});

type FormValues = z.infer<typeof schema>;

export default function SetupCropsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const farmId = useCurrentFarmId();
  const { vertical, unit, unitPlural, isLoading: verticalLoading } = useVertical();

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  // The catalogue comes from the server rather than being duplicated
  // here, so the bands a grower is shown are the same figures the
  // alerts will be judged against. GreenhouseCrop is the one source.
  const cycles = useQuery({
    queryKey: ['crop-cycles', farmId],
    queryFn: () => endpoints.listCropCycles(),
    enabled: !!farmId && vertical === 'greenhouse',
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      crop: '',
      pen_id: '',
      plants_placed: '' as unknown as number,
      variety: '',
      start_date: new Date().toISOString().slice(0, 10),
    },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      endpoints.createCropCycle({
        pen_id: v.pen_id,
        crop: v.crop as GreenhouseCropKey,
        plants_placed: v.plants_placed,
        variety: v.variety?.trim() ? v.variety.trim() : undefined,
        start_date: v.start_date,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['crop-cycles', farmId] });
      toast.success('Crop placed.');
      router.push('/setup/done');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not place the crop.')),
  });

  const crops: CropOptionDto[] = cycles.data?.crops ?? [];
  const selectedKey = form.watch('crop');

  // Not memoised: `crops` is a fresh array each render, so a useMemo
  // keyed on it recomputes every time anyway while costing a dependency
  // the linter is right to complain about. It is a find over six items.
  const selected = crops.find((c) => c.key === selectedKey) ?? null;

  // Mushrooms come in bags, everything else in plants. Asking a
  // mushroom grower how many "plants" went in is the same tell as
  // asking a cold store for its capacity in birds.
  const unitWord = selectedKey === 'mushroom' ? 'bags' : 'plants';

  const bays: PenDto[] = pens.data?.pens ?? [];

  if (verticalLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  return (
    <div>
      <SetupStepper current="flocks" vertical={vertical} />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
        Step 3 of 3
      </p>
      <h1
        className="mt-2 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        Place your first crop
      </h1>
      <p
        className="mt-2 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        What you pick sets the temperature and humidity this{' '}
        {unit.toLowerCase()} will be watched against. You can change it later.
      </p>

      <form
        onSubmit={form.handleSubmit((v) => create.mutate(v))}
        className="mt-7 space-y-6"
        noValidate
      >
        {/* Crop picker */}
        <div>
          <Label>What are you growing? *</Label>
          {cycles.isLoading ? (
            <div className="mt-2 flex h-24 items-center justify-center rounded-2xl border border-[var(--color-brand-border)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />
            </div>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {crops.map((c) => {
                const active = c.key === selectedKey;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() =>
                      form.setValue('crop', c.key, { shouldValidate: true })
                    }
                    aria-pressed={active}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left transition',
                      active
                        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40'
                        : 'border-[var(--color-brand-border)] bg-white hover:border-[var(--color-brand-primary)]/50',
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-[var(--color-brand-fg)]">
                      <Sprout className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                      {c.label}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--color-brand-muted)]">
                      {c.cycle_weeks} weeks · {c.day_min_c}–{c.day_max_c}°C day
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <FieldError message={form.formState.errors.crop?.message} />
        </div>

        {/* What the choice commits the bay to */}
        {selected && (
          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">
              {selected.label} needs
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-[var(--color-brand-muted)]">
                  <ThermometerSun className="h-3.5 w-3.5" /> Day
                </dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-brand-fg)]">
                  {selected.day_min_c}–{selected.day_max_c}°C
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-[var(--color-brand-muted)]">
                  <ThermometerSun className="h-3.5 w-3.5" /> Night
                </dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-brand-fg)]">
                  {selected.wants_night_drop
                    ? `${selected.night_min_c}–${selected.night_max_c}°C`
                    : 'Same as day'}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs text-[var(--color-brand-muted)]">
                  <Droplets className="h-3.5 w-3.5" /> Humidity
                </dt>
                <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-brand-fg)]">
                  {selected.rh_min_pct}–{selected.rh_max_pct}%
                </dd>
              </div>
            </dl>

            {/* Separate from the comfort ceiling on purpose: over the
                ceiling costs yield, over this loses the crop. */}
            <p className="mt-3 rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs leading-relaxed text-[#78350F]">
              <strong className="font-bold tabular-nums">
                Above {selected.critical_high_c}°C
              </strong>{' '}
              this crop is lost, not just slowed.
            </p>

            <p className="mt-2 text-xs leading-relaxed text-[var(--color-brand-muted)]">
              {selected.hint}
            </p>
          </div>
        )}

        {/* Bay */}
        <div>
          <Label htmlFor="pen_id">Which {unit.toLowerCase()}? *</Label>
          <select
            id="pen_id"
            {...form.register('pen_id')}
            className="block h-12 w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[0.9375rem] text-[var(--color-brand-fg)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
          >
            <option value="">Pick a {unit.toLowerCase()}…</option>
            {bays.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <FieldError message={form.formState.errors.pen_id?.message} />
          {bays.length === 0 && !pens.isLoading && (
            <p className="mt-1.5 text-xs text-[var(--color-brand-muted)]">
              No {unitPlural.toLowerCase()} yet — go back a step and add one.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="plants_placed">
              How many {unitWord}? *
            </Label>
            <Input
              id="plants_placed"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder={selectedKey === 'mushroom' ? '400' : '1,200'}
              {...form.register('plants_placed')}
            />
            <FieldError message={form.formState.errors.plants_placed?.message} />
          </div>
          <div>
            <Label htmlFor="start_date">
              {selectedKey === 'mushroom' ? 'Spawning date *' : 'Transplant date *'}
            </Label>
            <Input id="start_date" type="date" {...form.register('start_date')} />
            <FieldError message={form.formState.errors.start_date?.message} />
          </div>
        </div>

        <div>
          <Label htmlFor="variety">Variety</Label>
          <Input
            id="variety"
            placeholder={selectedKey === 'mushroom' ? 'Oyster' : 'Cobra F1'}
            {...form.register('variety')}
          />
          <p className="mt-1.5 text-xs text-[var(--color-brand-muted)]">
            Optional — useful later when you compare one season to the next.
          </p>
        </div>

        <Button type="submit" size="block" disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
          Finish setup
          <ArrowRight className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
