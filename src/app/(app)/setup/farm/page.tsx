'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, Loader2, Beef, Egg, Bird, Snowflake, Leaf, Droplets, Fish } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { SetupStepper } from '@/components/setup/stepper';
import { VERTICALS } from '@/lib/vertical';
import { apiErrorMessage, canCreateFarm, endpoints, type CreateFarmPayload } from '@/lib/api';
import { writeCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

/**
 * Step 1 — Set up your farm.
 *
 * Maps the mobile "Setup farm" screen to the CreateFarmRequest validator:
 *
 *   Field on mobile        → backend
 *   ───────────────────    ─────────────────────────
 *   Farm name              → farm_name (required)
 *   State                  → state
 *   Address                → address
 *   Capacity               → estimated_capacity
 *   Produce: Meat / Eggs   → primary_production
 *                              ✓ Meat only       → broiler
 *                              ✓ Eggs only       → layer
 *                              ✓ Meat and Eggs   → mixed
 *
 * (The mobile mockup also has a "Number of staff" field that doesn't
 * have a backend column — omitted here. Add when the column ships.)
 *
 * On success: persists the new farm's id as the current-farm context
 * so subsequent pen/flock calls auto-inject the X-Farm-ID header.
 */

const schema = z.object({
  farm_name: z
    .string()
    .trim()
    .min(2, 'Enter your farm name (at least 2 characters)')
    .max(120, 'Farm name is too long (max 120)'),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  estimated_capacity: z
    .union([z.string(), z.number()])
    .optional()
    .refine((v) => v === undefined || v === '' || !isNaN(Number(v)), {
      message: 'Capacity must be a number',
    }),
  vertical: z.enum(['poultry', 'greenhouse', 'irrigation', 'cold_chain', 'aquaculture']),
  produces_meat: z.boolean().default(false),
  produces_eggs: z.boolean().default(false),
}).refine((v) => v.vertical !== 'poultry' || v.produces_meat || v.produces_eggs, {
  path: ['produces_meat'],
  // Only poultry is asked meat-or-eggs. A cold room produces neither,
  // and requiring an answer there would block the form on a question
  // that does not apply.
  message: 'Pick at least one — meat, eggs, or both',
});

type FormValues = z.infer<typeof schema>;

export default function SetupFarmPage() {
  const router = useRouter();

  // Route guard — the backend (CreateFarmRequest::authorize) is the
  // authoritative line, but we redirect early so a user who joined a
  // farm via invite never sees the setup form. They can't have a farm
  // here unless the policy permits it (own an account OR have zero
  // memberships). If they have memberships and don't own an account,
  // submitting would 403 anyway — better to send them home with a
  // friendly toast than show an empty-state form.
  const farms = useQuery({
    queryKey: ['farms'],
    queryFn: () => endpoints.listFarms(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (farms.isLoading || !farms.data) return;
    if (!canCreateFarm(farms.data.farms)) {
      // Invited-staff path: they have memberships but no owner role,
      // so the backend would 403 a POST /farms. Send them home.
      toast.info('You already have access to a farm — opening your dashboard.');
      router.replace('/home');
    }
  }, [farms.data, farms.isLoading, router]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      farm_name: '',
      state: '',
      address: '',
      estimated_capacity: '' as unknown as number,
      // Poultry by default: it is what almost every farm here is, so
      // the common case needs no decision.
      vertical: 'poultry',
      produces_meat: false,
      produces_eggs: false,
    },
  });

  const create = useMutation({
    mutationFn: (payload: CreateFarmPayload) => endpoints.createFarm(payload),
    onSuccess: ({ farm }) => {
      writeCurrentFarmId(farm.id);
      toast.success('Farm saved — let’s add your first pen.');
      router.push('/setup/pens');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not create your farm.')),
  });

  function onSubmit(v: FormValues) {
    // primary_production is a poultry concept — it drives the breed
    // list and the default vaccination schedule. Sending it for a cold
    // room would seed a farm with a laying programme it can never use.
    const primary_production: CreateFarmPayload['primary_production'] | undefined =
      v.vertical !== 'poultry'
        ? undefined
        : v.produces_meat && v.produces_eggs
          ? 'mixed'
          : v.produces_meat
            ? 'broiler'
            : 'layer';

    const capacity =
      v.estimated_capacity === '' || v.estimated_capacity === undefined
        ? undefined
        : Math.max(1, Math.min(10_000_000, Math.trunc(Number(v.estimated_capacity))));

    create.mutate({
      farm_name: v.farm_name,
      state: v.state || undefined,
      address: v.address || undefined,
      estimated_capacity: capacity,
      primary_production,
      vertical: v.vertical,
    });
  }

  const meat = form.watch('produces_meat');
  const eggs = form.watch('produces_eggs');
  const vertical = form.watch('vertical');
  // Read from the FORM, not useVertical(): the farm does not exist
  // yet, so there is no current farm to look the vertical up from.
  const copy = VERTICALS[vertical];

  // Don't flash the form while we're deciding whether this user even
  // belongs here. The useEffect above redirects when they can't create.
  if (farms.isLoading || (farms.data && !canCreateFarm(farms.data.farms))) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-primary)]" />
      </div>
    );
  }

  return (
    <div>
      <SetupStepper current="farm" vertical={vertical} />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
        Step 1 of 3
      </p>
      <h1
        className="mt-2 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        Set up your farm
      </h1>
      <p
        className="mt-2 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        Tell us about the farm — you can add more later.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
        <div>
          <Label htmlFor="farm_name">Farm name *</Label>
          <Input
            id="farm_name"
            placeholder={copy.namePlaceholder}
            autoComplete="organization"
            {...form.register('farm_name')}
          />
          <FieldError message={form.formState.errors.farm_name?.message} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" placeholder="Lagos" {...form.register('state')} />
            <FieldError message={form.formState.errors.state?.message} />
          </div>
          <div>
            <Label htmlFor="estimated_capacity">{copy.capacityLabel}</Label>
            <Input
              id="estimated_capacity"
              inputMode="numeric"
              type="number"
              min={1}
              max={10_000_000}
              placeholder={copy.capacityPlaceholder}
              {...form.register('estimated_capacity')}
            />
            <FieldError message={form.formState.errors.estimated_capacity?.message} />
          </div>
        </div>

        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            placeholder="No 12, Iyaba rd, Ikorodu"
            autoComplete="street-address"
            {...form.register('address')}
          />
          <FieldError message={form.formState.errors.address?.message} />
        </div>

        {/* THE question this form was missing. Without it every farm
            was created as poultry — the column defaulted that way and
            nothing could change it — which made the other verticals
            unreachable no matter what was built behind them. */}
        <div>
          <Label>What do you manage here? *</Label>
          <p className="-mt-1 mb-2 text-xs text-[var(--color-brand-muted)]">
            This sets up the right records and alerts. One thing per farm — add another farm
            if you run more.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {VERTICAL_OPTIONS.map((o) => (
              <VerticalChip
                key={o.value}
                {...o}
                checked={vertical === o.value}
                onSelect={() => form.setValue('vertical', o.value, { shouldValidate: true })}
              />
            ))}
          </div>
        </div>

        {vertical === 'poultry' && (
        <div>
          <Label>What do you produce? *</Label>
          <p className="-mt-1 mb-2 text-xs text-[var(--color-brand-muted)]">
            Pick one or both — we’ll use this to tune your default schedules.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProduceChip
              icon={Beef}
              label="Meat"
              hint="Broilers"
              checked={meat}
              onChange={(v) => form.setValue('produces_meat', v, { shouldValidate: true })}
            />
            <ProduceChip
              icon={Egg}
              label="Eggs"
              hint="Layers"
              checked={eggs}
              onChange={(v) => form.setValue('produces_eggs', v, { shouldValidate: true })}
            />
          </div>
          <FieldError message={form.formState.errors.produces_meat?.message} />
        </div>
        )}

        <Button type="submit" size="block" disabled={create.isPending}>
          {create.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
          Continue
          <ArrowRight className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}

/**
 * Toggle chip — visually clearer than a vanilla checkbox for a binary
 * pick-list like Meat / Eggs. Same accessibility surface (real checkbox
 * underneath, keyboard + screen-reader friendly).
 */
/**
 * The five things a farm can be.
 *
 * Hints are written in the farmer's own words rather than ours — "cold
 * rooms, reefer trucks" lands where "cold chain logistics" does not.
 */
const VERTICAL_OPTIONS: Array<{
  value: 'poultry' | 'greenhouse' | 'irrigation' | 'cold_chain' | 'aquaculture';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}> = [
  { value: 'poultry', icon: Bird, label: 'Poultry', hint: 'Broilers, layers, cockerels' },
  { value: 'cold_chain', icon: Snowflake, label: 'Cold storage', hint: 'Cold rooms, reefer trucks' },
  { value: 'greenhouse', icon: Leaf, label: 'Greenhouse', hint: 'Tomato, pepper, vegetables' },
  { value: 'irrigation', icon: Droplets, label: 'Irrigation', hint: 'Field crops, pumps and plots' },
  { value: 'aquaculture', icon: Fish, label: 'Fish farm', hint: 'Catfish, tilapia, ponds' },
];

function VerticalChip({
  icon: Icon,
  label,
  hint,
  checked,
  onSelect,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all',
        checked
          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40 shadow-[0_8px_18px_-12px_rgba(15,80,30,0.30)]'
          : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
          checked
            ? 'bg-[var(--color-brand-primary)] text-white'
            : 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-primary-deep)] group-hover:bg-[var(--color-brand-accent)]/60',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[var(--color-brand-fg)]">{label}</span>
        <span className="block truncate text-xs text-[var(--color-brand-muted)]">{hint}</span>
      </span>
    </button>
  );
}

function ProduceChip({
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-all',
        checked
          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40 shadow-[0_8px_18px_-12px_rgba(15,80,30,0.30)]'
          : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
          checked
            ? 'bg-[var(--color-brand-primary)] text-white'
            : 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-primary-deep)] group-hover:bg-[var(--color-brand-accent)]/60',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-bold text-[var(--color-brand-fg)]">{label}</span>
        <span className="block text-xs text-[var(--color-brand-muted)]">{hint}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-1 h-5 w-5 shrink-0 rounded-full border-2 transition-all',
          checked
            ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]'
            : 'border-[var(--color-brand-input-border)] bg-white',
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="h-full w-full text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3.5 8.5 7 12 13 5" />
          </svg>
        )}
      </span>
    </label>
  );
}
