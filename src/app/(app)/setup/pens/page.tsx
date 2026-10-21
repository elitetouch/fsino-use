'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Loader2, Plus, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { SetupStepper } from '@/components/setup/stepper';
import { useVertical } from '@/lib/vertical';
import {
  apiErrorMessage,
  endpoints,
  type ColdChainPresetKey,
  type CreatePenPayload,
  type PenDto,
} from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

/**
 * Step 2 — Add at least one pen.
 *
 * Mobile mockup: "Pen number + Capacity + Pen type + Save".
 *
 * Backend CreatePenRequest:
 *   name (required, 1-120) ← "Pen number" in mockup
 *   pen_type (optional)
 *   capacity (optional, 1-5M)
 *   house_code (optional)
 *   notes (optional)
 *
 * The page shows the list of already-created pens alongside the "Add
 * another" form so the farmer can keep adding before moving on.
 * Continue is disabled until at least one pen exists — the next step
 * (flocks) requires a free pen.
 */

/**
 * Cold-chain preset codes, as the backend validates them. Custom is
 * excluded on purpose: picking it here would create a room with a
 * band nobody has typed numbers for yet, so it is left unset and the
 * room screen asks for the range.
 */
const PRESET_KEYS = ['vaccine', 'chilled', 'frozen', 'produce'] as const;

function isPresetKey(v: string | undefined): v is ColdChainPresetKey {
  return typeof v === 'string' && (PRESET_KEYS as readonly string[]).includes(v);
}

const schema = z.object({
  name: z.string().trim().min(1, 'Give it a name or number').max(120),
  capacity: z
    .union([z.string(), z.number()])
    .optional()
    .refine((v) => v === undefined || v === '' || !isNaN(Number(v)), {
      message: 'Capacity must be a number',
    }),
  pen_type: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function SetupPensPage() {
  const router = useRouter();
  const qc = useQueryClient();
  // Reactive so query keys re-key on farm switch (previously stale after
  // a farm change). Outsider (no farm at all) is handled upstream by
  // AccessGuard — this page assumes a farm is selected.
  const farmId = useCurrentFarmId();

  // The farm exists by now (step 1 created it and set the current-farm
  // id), so the hook can read its vertical.
  const {
    unit,
    unitPlural,
    hasCycles,
    vertical,
    cyclePlural,
    unitTypes,
    unitDescription,
    unitNamePlaceholder,
    capacityLabel,
    capacityPlaceholder,
    capacityUnit,
  } = useVertical();

  const pens = useQuery({
    queryKey: ['pens', farmId],
    queryFn: () => endpoints.listPens(),
    enabled: !!farmId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', capacity: '' as unknown as number, pen_type: '' },
  });

  const create = useMutation({
    mutationFn: async (payload: CreatePenPayload) => {
      const created = await endpoints.createPen(payload);

      // For a cold room the type IS the temperature band — "Vaccine"
      // means 2 to 8°C. Creating the room without applying it leaves
      // it saying "No band set", monitoring nothing, and the operator
      // has every reason to believe they already answered this.
      //
      // Deliberately not fatal: the room exists either way, and the
      // band can be set from the room screen. Failing the whole step
      // because a device did not acknowledge would be worse.
      if (vertical === 'cold_chain' && isPresetKey(payload.pen_type)) {
        try {
          await endpoints.setColdRoomBand(created.pen.id, { preset: payload.pen_type });
        } catch {
          toast.message('Room added, but its temperature range was not saved.', {
            description: 'Open the room to set it.',
          });
        }
      }

      return created;
    },
    onSuccess: () => {
      toast.success(`${unit} added.`);
      form.reset({ name: '', capacity: '' as unknown as number, pen_type: '' });
      qc.invalidateQueries({ queryKey: ['pens', farmId] });
      qc.invalidateQueries({ queryKey: ['cold-rooms'] });
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, `Could not add the ${unit.toLowerCase()}.`)),
  });

  function onSubmit(v: FormValues) {
    const cap =
      v.capacity === '' || v.capacity === undefined
        ? undefined
        : Math.max(1, Math.min(5_000_000, Math.trunc(Number(v.capacity))));
    create.mutate({
      name: v.name,
      capacity: cap,
      pen_type: v.pen_type || undefined,
    });
  }

  const existing = pens.data?.pens ?? [];
  const canContinue = existing.length > 0;

  return (
    <div>
      <SetupStepper current="pens" vertical={vertical} />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
        Step 2 of 3
      </p>
      <h1
        className="mt-2 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        Add your {unitPlural.toLowerCase()}
      </h1>
      <p
        className="mt-2 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        {unitDescription} Add at least one — you can keep adding more before
        continuing.
      </p>

      {/* Existing pens */}
      {existing.length > 0 && (
        <div className="mt-7">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">
            {existing.length}{' '}
            {(existing.length === 1 ? unit : unitPlural).toLowerCase()} added
          </p>
          <ul className="space-y-2">
            {existing.map((p: PenDto) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-4 py-3"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-brand-primary-deep)] shadow-sm">
                  <Warehouse className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--color-brand-fg)]">
                    {p.name}
                  </p>
                  <p className="text-xs text-[var(--color-brand-muted)]">
                    {p.penType ? labelForType(p.penType, unitTypes) : 'No type'}
                    {p.capacity
                      ? ` · ${p.capacity.toLocaleString()} ${capacityUnit}`
                      : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add form */}
      <div className="mt-7 rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-[var(--color-brand-surface-soft)]/60 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-fg)]">
          <Plus className="h-4 w-4" />
          {existing.length === 0
            ? `Add your first ${unit.toLowerCase()}`
            : `Add another ${unit.toLowerCase()}`}
        </p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="name">{unit} name / number *</Label>
            <Input
              id="name"
              placeholder={unitNamePlaceholder}
              {...form.register('name')}
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="capacity">{capacityLabel}</Label>
              <Input
                id="capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={5_000_000}
                placeholder={capacityPlaceholder}
                {...form.register('capacity')}
              />
              <FieldError message={form.formState.errors.capacity?.message} />
            </div>
            <div>
              <Label htmlFor="pen_type">{unit} type</Label>
              <select
                id="pen_type"
                {...form.register('pen_type')}
                className="block h-12 w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[0.9375rem] text-[var(--color-brand-fg)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
              >
                <option value="">Select…</option>
                {unitTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" variant="outline" size="block" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
            <Plus className="h-5 w-5" />
            Add {unit.toLowerCase()}
          </Button>
        </form>
      </div>

      <Button
        type="button"
        size="block"
        className={cn('mt-7', !canContinue && 'pointer-events-none opacity-50')}
        disabled={!canContinue}
        // Cold chain has no cycles, so there is no flock step to send
        // them to — going there would strand an operator on a screen
        // asking which breed is in their cold room.
        onClick={() => router.push(hasCycles ? '/setup/flocks' : '/setup/done')}
      >
        {hasCycles ? `Continue to ${(cyclePlural ?? '').toLowerCase()}` : 'Finish setup'}
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function labelForType(
  v: string,
  types: ReadonlyArray<{ value: string; label: string }>,
): string {
  return types.find((t) => t.value === v)?.label ?? v.replace(/_/g, ' ');
}
