'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, Loader2, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { apiErrorMessage, endpoints, type CreatePenPayload, type PenDto } from '@/lib/api';
import { readCurrentFarmId } from '@/lib/farm-context';

/**
 * Inline pen creator — drops into any form where the user might need a
 * pen they haven't created yet (most importantly the flock placement
 * form). Collapsed by default; expands into a small triangular form
 * with name + capacity + type; on success calls `onCreated(pen)` so
 * the caller can pre-select the new pen in its dropdown.
 *
 * Visually it looks like a dashed-border "Add another option" rail to
 * communicate "this is creating something, not switching contexts."
 */
export function AddPenInline({
  onCreated,
}: {
  onCreated?: (pen: PenDto) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [penType, setPenType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const farmId = readCurrentFarmId();

  const create = useMutation({
    mutationFn: (payload: CreatePenPayload) => endpoints.createPen(payload),
    onSuccess: ({ pen }) => {
      toast.success(`Pen "${pen.name}" added.`);
      qc.invalidateQueries({ queryKey: ['pens', farmId] });
      onCreated?.(pen);
      // Reset + collapse so the form is ready for another add.
      setName('');
      setCapacity('');
      setPenType('');
      setOpen(false);
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not add the pen.')),
  });

  function submit() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Give the pen a name or number.');
      return;
    }
    const cap =
      capacity === '' || capacity === undefined
        ? undefined
        : Math.max(1, Math.min(5_000_000, Math.trunc(Number(capacity))));
    create.mutate({
      name: trimmed,
      capacity: cap,
      pen_type: penType || undefined,
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-[var(--color-brand-primary-deep)] hover:bg-[var(--color-brand-accent)]/40"
      >
        <Plus className="h-3.5 w-3.5" />
        Create a new pen
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-[var(--color-brand-surface-soft)]/60 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-brand-fg)]">
          <Warehouse className="h-3.5 w-3.5 text-[var(--color-brand-primary-deep)]" />
          New pen
        </p>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          aria-label="Cancel"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <Label className="text-[11px]">Pen name / number *</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pen 1, House A…"
            className="h-9 text-[13px]"
            autoFocus
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-[11px]">Capacity</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={5_000_000}
              value={capacity}
              onChange={(e) =>
                setCapacity(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
              }
              placeholder="500"
              className="h-9 text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[11px]">Type</Label>
            <select
              value={penType}
              onChange={(e) => setPenType(e.target.value)}
              className="block h-9 w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-2.5 text-[13px]"
            >
              <option value="">Select…</option>
              <option value="deep_litter">Deep litter</option>
              <option value="battery_cage">Battery cage</option>
              <option value="free_range">Free range</option>
              <option value="semi_intensive">Semi-intensive</option>
            </select>
          </div>
        </div>
        <FieldError message={error ?? undefined} />
        <Button
          type="button"
          size="sm"
          className="h-9 w-full"
          onClick={submit}
          disabled={create.isPending}
        >
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <Plus className="h-3.5 w-3.5" />
          Save pen
        </Button>
      </div>
    </div>
  );
}
