'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2, Plus, Bird, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { SetupStepper } from '@/components/setup/stepper';
import { BuyTokensDialog } from '@/components/billing/buy-tokens-dialog';
import { AddPenInline } from '@/components/app/add-pen-inline';
import {
  apiErrorMessage,
  endpoints,
  type CreateFlockPayload,
  type FlockDto,
  type PenDto,
  type BreedDto,
  type TokenBalanceDto,
} from '@/lib/api';
import { readCurrentFarmId } from '@/lib/farm-context';
import { cn } from '@/lib/utils';

/**
 * Step 3 — Add at least one flock.
 *
 * Mobile mockup splits the form into three "step 1 of 3" pages
 * (production + pen + dates, then breed + numbers, then price + tier).
 * We mirror that on the web with a single page and an internal stepper
 * so progress is preserved without route hops.
 *
 * Backend CreateFlockRequest:
 *   production_type   broiler | layer | dual_purpose      (required)
 *   placed_birds      int 1-10M                            (required)
 *   breed             string max 255                       (required)
 *   age_when_placed   int days 1-1000                      (required)
 *   flock_price       int 10-10M                           (required)
 *   start_date        date YYYY-MM-DD                      (required)
 *   tier              basic | premium                      (required)
 *   pen_id            uuid (must belong to current farm)   (optional)
 *   breed_id          uuid (must be active)                (optional)
 *   hatchery_id       uuid (must be active)                (optional)
 */

const STEPS = ['basics', 'breed', 'tokens'] as const;
type SubStep = (typeof STEPS)[number];

const schema = z.object({
  // Step 1
  production_type: z.enum(['broiler', 'layer', 'dual_purpose'], {
    errorMap: () => ({ message: 'Pick a production type' }),
  }),
  // pen_id is required client-side even though the backend allows
  // unassigned flocks — keeping bird ownership to a pen from day one
  // is much cleaner data and avoids mid-cycle "where are these birds
  // actually housed" confusion. Inline pen creator lets the user
  // make a pen on the fly without leaving the form.
  pen_id: z.string().uuid('Pick a pen to house this flock'),
  start_date: z.string().min(1, 'Pick the placement date'),
  age_when_placed: z
    .union([z.string(), z.number()])
    .refine((v) => v !== '' && v !== undefined && Number(v) >= 1 && Number(v) <= 1000, {
      message: 'Age must be between 1 and 1000 days',
    }),
  // Step 2
  breed: z.string().min(1, 'Pick or enter a breed'),
  breed_id: z.string().optional().or(z.literal('')),
  placed_birds: z
    .union([z.string(), z.number()])
    .refine((v) => v !== '' && v !== undefined && Number(v) >= 1 && Number(v) <= 10_000_000, {
      message: 'Birds must be between 1 and 10,000,000',
    }),
  // Step 3
  flock_price: z
    .union([z.string(), z.number()])
    .refine((v) => v !== '' && v !== undefined && Number(v) >= 10 && Number(v) <= 10_000_000, {
      message: 'Price must be between 10 and 10,000,000',
    }),
  tier: z.enum(['basic', 'premium'], { errorMap: () => ({ message: 'Pick a token tier' }) }),
});

type FormValues = z.infer<typeof schema>;

export default function SetupFlocksPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [step, setStep] = useState<SubStep>('basics');

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

  const flocks = useQuery({
    queryKey: ['flocks', farmId],
    queryFn: () => endpoints.listFlocks(),
    enabled: !!farmId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      production_type: 'broiler',
      pen_id: '',
      start_date: new Date().toISOString().slice(0, 10),
      age_when_placed: 1,
      breed: '',
      breed_id: '',
      placed_birds: '' as unknown as number,
      flock_price: '' as unknown as number,
      tier: 'basic',
    },
    mode: 'onBlur',
  });

  const productionType = form.watch('production_type');
  const selectedTier = form.watch('tier');
  const placedBirds = Number(form.watch('placed_birds') || 0);
  const [openBuy, setOpenBuy] = useState(false);

  // Map broiler/layer to backend token_type — dual_purpose flocks debit
  // broiler tokens by convention (matches backend behaviour).
  const tokenType: 'broiler' | 'layer' =
    productionType === 'layer' ? 'layer' : 'broiler';

  const balances = useQuery({
    queryKey: ['token-balances'],
    queryFn: () => endpoints.listBalances(),
    enabled: !!farmId,
  });

  const currentBalance: TokenBalanceDto | undefined =
    balances.data?.balances.find((b) => b.tokenType === tokenType && b.tier === selectedTier);
  const balance = currentBalance?.balance ?? 0;
  const shortBy = Math.max(0, placedBirds - balance);
  const freemiumLeft =
    balances.data?.freemium?.enabled && !balances.data.freemium.used && placedBirds <= 100;
  const blocked = shortBy > 0 && !freemiumLeft;

  const breeds = useQuery({
    queryKey: ['breeds', { production_type: productionType }],
    queryFn: () => endpoints.listBreeds({ production_type: productionType }),
    enabled: !!productionType,
  });

  const freePens = useMemo(() => {
    return (pens.data?.pens ?? []).filter(
      (p: PenDto) => p.occupancy?.status !== 'occupied',
    );
  }, [pens.data]);

  const create = useMutation({
    mutationFn: (payload: CreateFlockPayload) => endpoints.createFlock(payload),
    onSuccess: () => {
      toast.success('Flock added.');
      form.reset({
        production_type: 'broiler',
        pen_id: '',
        start_date: new Date().toISOString().slice(0, 10),
        age_when_placed: 1,
        breed: '',
        breed_id: '',
        placed_birds: '' as unknown as number,
        flock_price: '' as unknown as number,
        tier: 'basic',
      });
      setStep('basics');
      qc.invalidateQueries({ queryKey: ['flocks', farmId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not add the flock.')),
  });

  function submit() {
    form.handleSubmit((v) => {
      const payload: CreateFlockPayload = {
        production_type: v.production_type,
        pen_id: v.pen_id || undefined,
        breed: v.breed,
        breed_id: v.breed_id || undefined,
        placed_birds: Math.trunc(Number(v.placed_birds)),
        age_when_placed: Math.trunc(Number(v.age_when_placed)),
        flock_price: Math.trunc(Number(v.flock_price)),
        start_date: v.start_date,
        tier: v.tier,
      };
      create.mutate(payload);
    })();
  }

  async function nextStep() {
    const fieldsByStep: Record<SubStep, Array<keyof FormValues>> = {
      basics: ['production_type', 'pen_id', 'start_date', 'age_when_placed'],
      breed: ['breed', 'placed_birds'],
      tokens: ['flock_price', 'tier'],
    };
    const ok = await form.trigger(fieldsByStep[step]);
    if (!ok) return;

    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
    } else {
      submit();
    }
  }

  function prevStep() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  const existing = flocks.data?.flocks ?? [];
  const canContinue = existing.length > 0;
  const stepNumber = STEPS.indexOf(step) + 1;

  return (
    <div>
      <SetupStepper current="flocks" />

      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
        Step 3 of 3
      </p>
      <h1
        className="mt-2 font-extrabold tracking-tight text-[var(--color-brand-fg)]"
        style={{ fontSize: 'var(--text-h1)' }}
      >
        Place your first flock
      </h1>
      <p
        className="mt-2 text-[var(--color-brand-muted)]"
        style={{ fontSize: 'var(--text-lead)' }}
      >
        Three quick questions. You can add more flocks later from the dashboard.
      </p>

      {/* Existing flocks */}
      {existing.length > 0 && (
        <div className="mt-7">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">
            {existing.length} {existing.length === 1 ? 'flock' : 'flocks'} placed
          </p>
          <ul className="space-y-2">
            {existing.map((f: FlockDto) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-4 py-3"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-brand-primary-deep)] shadow-sm">
                  <Bird className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--color-brand-fg)]">
                    {f.breed} · {capitalise(f.productionType)}
                  </p>
                  <p className="text-xs text-[var(--color-brand-muted)]">
                    {f.placedBirds.toLocaleString()} birds · placed {f.startDate}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Inner stepper */}
      <div className="mt-7 rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-[var(--color-brand-surface-soft)]/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-muted)]">
            Add flock · part {stepNumber} of {STEPS.length}
          </p>
          <SubStepDots current={step} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            nextStep();
          }}
          className="space-y-5"
          noValidate
        >
          {step === 'basics' && (
            <>
              <div>
                <Label>Production type *</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(['broiler', 'layer', 'dual_purpose'] as const).map((t) => {
                    const checked = productionType === t;
                    return (
                      <label
                        key={t}
                        className={cn(
                          'cursor-pointer rounded-2xl border-2 p-3 text-center text-sm font-semibold transition-all',
                          checked
                            ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40 text-[var(--color-brand-fg)]'
                            : 'border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-muted)] hover:border-[var(--color-brand-primary)]/40',
                        )}
                      >
                        <input
                          type="radio"
                          value={t}
                          className="peer sr-only"
                          {...form.register('production_type')}
                        />
                        {labelForProduction(t)}
                      </label>
                    );
                  })}
                </div>
                <FieldError message={form.formState.errors.production_type?.message} />
              </div>

              <div>
                <Label htmlFor="pen_id">Place in pen *</Label>
                <select
                  id="pen_id"
                  {...form.register('pen_id')}
                  className="block h-12 w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[15px] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
                >
                  <option value="">{freePens.length === 0 ? 'No free pens yet — create one below' : 'Pick a pen…'}</option>
                  {freePens.map((p: PenDto) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.capacity ? ` — capacity ${p.capacity.toLocaleString()}` : ''}
                    </option>
                  ))}
                </select>
                <FieldError message={form.formState.errors.pen_id?.message} />
                {freePens.length === 0 && (
                  <p className="mt-1.5 text-xs text-[var(--color-brand-muted)]">
                    A pen keeps your birds&rsquo; records clean from day one. Create one below.
                  </p>
                )}
                {/* Inline pen creator — keeps the user in flow without
                    bouncing them out to /setup/pens. New pen is
                    auto-selected once saved. */}
                <AddPenInline
                  onCreated={(pen) => {
                    form.setValue('pen_id', pen.id, { shouldValidate: true });
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="start_date">Placement date *</Label>
                  <Input id="start_date" type="date" {...form.register('start_date')} />
                  <FieldError message={form.formState.errors.start_date?.message} />
                </div>
                <div>
                  <Label htmlFor="age_when_placed">Age at placement (days) *</Label>
                  <Input
                    id="age_when_placed"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    placeholder="1"
                    {...form.register('age_when_placed')}
                  />
                  <FieldError message={form.formState.errors.age_when_placed?.message} />
                </div>
              </div>
            </>
          )}

          {step === 'breed' && (
            <>
              <div>
                <Label htmlFor="breed_id">Breed *</Label>
                <select
                  id="breed_id"
                  {...form.register('breed_id', {
                    onChange: (e) => {
                      const id = e.target.value;
                      const found = (breeds.data?.breeds ?? []).find(
                        (b: BreedDto) => b.id === id,
                      );
                      if (found) form.setValue('breed', found.name);
                    },
                  })}
                  className="block h-12 w-full rounded-[var(--radius-input)] border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[15px] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
                >
                  <option value="">{breeds.isLoading ? 'Loading…' : 'Pick a breed'}</option>
                  {(breeds.data?.breeds ?? []).map((b: BreedDto) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.breederCompany ? ` · ${b.breederCompany}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-[var(--color-brand-muted)]">
                  Don’t see yours? Type the breed name below.
                </p>
              </div>
              <div>
                <Label htmlFor="breed">Breed name *</Label>
                <Input
                  id="breed"
                  placeholder="Cobb 500"
                  {...form.register('breed')}
                />
                <FieldError message={form.formState.errors.breed?.message} />
              </div>
              <div>
                <Label htmlFor="placed_birds">Number of birds placed *</Label>
                <Input
                  id="placed_birds"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10_000_000}
                  placeholder="500"
                  {...form.register('placed_birds')}
                />
                <FieldError message={form.formState.errors.placed_birds?.message} />
              </div>
            </>
          )}

          {step === 'tokens' && (
            <>
              {/* Token-balance status — shown before they hit submit so
                  they don't get an opaque server error mid-payment. */}
              <div
                className={cn(
                  'rounded-xl border p-3.5',
                  blocked
                    ? 'border-amber-300 bg-amber-50'
                    : freemiumLeft
                      ? 'border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-accent)]/40'
                      : 'border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]',
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                    blocked
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary-deep)]',
                  )}>
                    {blocked ? <AlertTriangle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {blocked ? (
                      <>
                        <p className="text-[13px] font-bold text-amber-900">
                          {balance === 0
                            ? `You have no ${tokenType} / ${selectedTier} tokens yet`
                            : `You're ${shortBy.toLocaleString()} tokens short`}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-amber-800">
                          One token = one bird. Top up to place {placedBirds.toLocaleString()} birds.
                        </p>
                      </>
                    ) : freemiumLeft ? (
                      <>
                        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">
                          Free first flock available
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
                          We&rsquo;ll cover this placement up to 100 birds — no tokens needed.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">
                          {balance.toLocaleString()} {tokenType} / {selectedTier} tokens available
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
                          Placing {placedBirds.toLocaleString()} birds will leave you with{' '}
                          {(balance - placedBirds).toLocaleString()}.
                        </p>
                      </>
                    )}
                  </div>
                  {blocked && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setOpenBuy(true)}
                      className="h-9 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Buy tokens
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="flock_price">Total cost of the placement *</Label>
                <Input
                  id="flock_price"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={10_000_000}
                  placeholder="350000"
                  {...form.register('flock_price')}
                />
                <p className="mt-1.5 text-xs text-[var(--color-brand-muted)]">
                  All-in cost of buying these birds — used to seed your cost-per-bird tracking.
                </p>
                <FieldError message={form.formState.errors.flock_price?.message} />
              </div>

              <div>
                <Label>Token tier *</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['basic', 'premium'] as const).map((t) => {
                    const checked = form.watch('tier') === t;
                    return (
                      <label
                        key={t}
                        className={cn(
                          'cursor-pointer rounded-2xl border-2 p-4 text-left transition-all',
                          checked
                            ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40'
                            : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
                        )}
                      >
                        <input
                          type="radio"
                          value={t}
                          className="peer sr-only"
                          {...form.register('tier')}
                        />
                        <p className="text-sm font-bold text-[var(--color-brand-fg)]">
                          {t === 'basic' ? 'Basic' : 'Premium'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-brand-muted)]">
                          {t === 'basic'
                            ? 'Core tracking — feed, vaccines, mortality.'
                            : 'Adds cost analytics, FCR, margins, exports.'}
                        </p>
                      </label>
                    );
                  })}
                </div>
                <FieldError message={form.formState.errors.tier?.message} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {step !== 'basics' && (
              <Button type="button" variant="outline" onClick={prevStep} className="sm:flex-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              type="submit"
              className="sm:flex-1"
              disabled={create.isPending || (step === 'tokens' && blocked)}
            >
              {create.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
              {step === 'tokens' ? (
                <>
                  <Plus className="h-5 w-5" />
                  Add flock
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Buy-tokens dialog — opens from the inline prompt when balance
          is insufficient. Refetches balances on close so the warning
          clears once the purchase completes. */}
      <BuyTokensDialog
        open={openBuy}
        onClose={() => {
          setOpenBuy(false);
          void balances.refetch();
        }}
        initial={{
          tokenType,
          tier: selectedTier,
          quantity: Math.max(100, shortBy || placedBirds || 100),
        }}
      />

      <Button
        type="button"
        size="block"
        className={cn('mt-7', !canContinue && 'pointer-events-none opacity-50')}
        disabled={!canContinue}
        onClick={() => router.push('/setup/done')}
      >
        Finish setup
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

function SubStepDots({ current }: { current: SubStep }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s}
          aria-hidden
          className={cn(
            'h-2 w-2 rounded-full transition-colors',
            i <= idx ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border)]',
          )}
        />
      ))}
    </div>
  );
}

function labelForProduction(t: 'broiler' | 'layer' | 'dual_purpose'): string {
  return t === 'broiler' ? 'Broiler' : t === 'layer' ? 'Layer' : 'Dual-purpose';
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, '-');
}
