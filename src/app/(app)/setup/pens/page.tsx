'use client';

import { useEffect, useState } from 'react';
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
import { apiErrorMessage, endpoints, type CreatePenPayload, type PenDto } from '@/lib/api';
import { readCurrentFarmId } from '@/lib/farm-context';
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

const PEN_TYPES = [
  { value: 'deep_litter', label: 'Deep litter' },
  { value: 'battery_cage', label: 'Battery cage' },
  { value: 'free_range', label: 'Free range' },
  { value: 'semi_intensive', label: 'Semi-intensive' },
] as const;

const schema = z.object({
  name: z.string().trim().min(1, 'Give the pen a name or number').max(120),
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
  const [farmId, setFarmId] = useState<string | null>(null);

  useEffect(() => {
    const id = readCurrentFarmId();
    if (!id) {
      toast.error('Set up your farm first.');
      router.replace('/setup/farm');
      return;
    }
    setFarmId(id);
  }, [router]);

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
    mutationFn: (payload: CreatePenPayload) => endpoints.createPen(payload),
    onSuccess: () => {
      toast.success('Pen added.');
      form.reset({ name: '', capacity: '' as unknown as number, pen_type: '' });
      qc.invalidateQueries({ queryKey: ['pens', farmId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not add the pen.')),
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
      <SetupStepper current="pens" />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
        Step 2 of 3
      </p>
      <h1
        className="mt-2 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        Add your pens
      </h1>
      <p
        className="mt-2 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        A pen is a house, cage, or section where a flock lives. Add at least one
        — you can keep adding more before continuing.
      </p>

      {/* Existing pens */}
      {existing.length > 0 && (
        <div className="mt-7">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">
            {existing.length} {existing.length === 1 ? 'pen' : 'pens'} added
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
                    {p.penType ? labelForType(p.penType) : 'No type'}
                    {p.capacity ? ` · ${p.capacity.toLocaleString()} birds` : ''}
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
          {existing.length === 0 ? 'Add your first pen' : 'Add another pen'}
        </p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
          <div>
            <Label htmlFor="name">Pen name / number *</Label>
            <Input
              id="name"
              placeholder="Pen 1, or House A"
              {...form.register('name')}
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="capacity">Capacity (birds)</Label>
              <Input
                id="capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={5_000_000}
                placeholder="500"
                {...form.register('capacity')}
              />
              <FieldError message={form.formState.errors.capacity?.message} />
            </div>
            <div>
              <Label htmlFor="pen_type">Pen type</Label>
              <select
                id="pen_type"
                {...form.register('pen_type')}
                className="block h-12 w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[15px] text-[var(--color-brand-fg)] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
              >
                <option value="">Select…</option>
                {PEN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" variant="outline" size="block" disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
            <Plus className="h-5 w-5" />
            Add pen
          </Button>
        </form>
      </div>

      <Button
        type="button"
        size="block"
        className={cn('mt-7', !canContinue && 'pointer-events-none opacity-50')}
        disabled={!canContinue}
        onClick={() => router.push('/setup/flocks')}
      >
        Continue to flocks
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function labelForType(v: string): string {
  return PEN_TYPES.find((t) => t.value === v)?.label ?? v.replace(/_/g, ' ');
}
