'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { endpoints, type DailyRecordGuidance, type MyPreferencesDto } from '@/lib/api';
import { useMyPreferences } from '@/lib/use-preferences';
import { useDailyRecordsForDate, pickRecord } from '@/lib/use-daily-record';
import { DatePickerStep } from '@/components/record/date-picker-step';
import { FeedStep } from '@/components/record/steps/feed-step';
import { WaterStep } from '@/components/record/steps/water-step';
import { VaccinationStep } from '@/components/record/steps/vaccination-step';
import { TreatmentStep } from '@/components/record/steps/treatment-step';
import { BirdCountStep } from '@/components/record/steps/bird-count-step';
import { WeightStep } from '@/components/record/steps/weight-step';
import { EggCollectionStep, type EggCollectionData } from '@/components/record/steps/egg-collection-step';
import { EggSizeWeightStep } from '@/components/record/steps/egg-size-weight-step';

/**
 * Daily-record wizard for a single cycle.
 *
 *   URL: /cycles/[id]/record  (id = flockId — flocks ARE cycles)
 *
 * Step 0 is the date picker. Steps 1..N are the per-event forms
 * (feed, water, vaccination, treatment, bird_count, weight, eggs).
 * The dynamic step list is built from the AND of:
 *
 *   - Farm ceiling      (farm_settings.daily_record_config.<event>.enabled)
 *   - User preference   (my-farm-preferences.daily_record.<event>.include)
 *   - Production type   (eggs only shows for layer flocks)
 *
 * Because every step is its own POST (per the agreed "per-step POST
 * with auto-skip" model), quitting halfway keeps whatever you saved
 * so far. There is no implicit batch save at the end.
 *
 * Phase 1 (this commit): date picker + orchestrator + placeholder
 * shells for the 6 event steps. Phase 2 wires each step's real form.
 */
export default function RecordWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: flockId } = use(params);
  const router = useRouter();

  // Selected date — defaults to today, drives both the calendar
  // selection and every step's POST payload (record_date).
  const [selectedDate, setSelectedDate] = useState<string>(() => todayYmd());

  // Current step index. 0 = date picker; 1..N = event steps.
  const [stepIdx, setStepIdx] = useState(0);

  // Buffered egg-collection data for the layer sub-flow.
  //
  // The backend's eggs event validator (CreateFlockEventRequest::eggs)
  // requires payload.good on EVERY eggs row, so we can't POST the
  // collection step and the size/weight step as two independent rows.
  // Instead, when both steps are in the wizard, the collection step
  // stashes here and the size/weight step submits one combined event.
  // When the size/weight step isn't in the wizard at all (egg_metrics
  // disabled), the collection step POSTs directly — see its
  // `postDirectly` prop.
  const [eggsBuffer, setEggsBuffer] = useState<EggCollectionData | null>(null);

  // Guidance — drives the dynamic step list (which events the farm
  // allows) plus per-section hints for each event step.
  const guidance = useQuery({
    queryKey: ['daily-record-guidance', flockId],
    queryFn: () => endpoints.getDailyRecordGuidance(flockId),
    staleTime: 60_000,
  });

  // User prefs — `effectiveDailyRecord` is the AND of farm ceiling +
  // user choice that we want, already computed server-side.
  const prefs = useMyPreferences();

  // Calendar — drives the "has records on selected date" flag so the
  // CTA reads "Edit record" instead of "Add record" when the user
  // picks a green day.
  const calendarMonth = ymOf(selectedDate);
  const calendar = useQuery({
    queryKey: ['daily-record-calendar', flockId, calendarMonth],
    queryFn: () => endpoints.getDailyRecordCalendar(flockId, calendarMonth),
    staleTime: 30_000,
  });

  const hasRecordsOnSelectedDate = useMemo(() => {
    return !!calendar.data?.days.some((d) => d.date === selectedDate && d.recordCount > 0);
  }, [calendar.data, selectedDate]);

  // EDIT mode — when the picked date already has records, fetch them
  // so each step can pre-fill from the matching row. Disabled until
  // we know the date has data (saves a roundtrip on the happy path
  // of "log today's record").
  const dayRecords = useDailyRecordsForDate(flockId, selectedDate, hasRecordsOnSelectedDate);
  const existingRecords = dayRecords.data?.records ?? [];

  /* ------------------------------------------------------------------ */
  /*  Dynamic step list                                                 */
  /* ------------------------------------------------------------------ */

  const stepList = useMemo(() => {
    if (!guidance.data || !prefs.data) return null;
    return buildStepList(guidance.data, prefs.data.preferences);
  }, [guidance.data, prefs.data]);

  const totalSteps = (stepList?.length ?? 0) + 1; // +1 for date picker

  /* ------------------------------------------------------------------ */
  /*  Navigation                                                        */
  /* ------------------------------------------------------------------ */

  const goBack = () => setStepIdx((i) => Math.max(0, i - 1));
  const goNext = () => setStepIdx((i) => i + 1);
  const exit = () => router.push(`/cycles/${flockId}`);

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  // Loading state — keep the chrome simple, the actual steps render
  // inside StepShell so a centred spinner here is fine.
  if (guidance.isLoading || prefs.isLoading || !stepList) {
    return <FullPageSpinner />;
  }

  if (guidance.isError || !guidance.data) {
    return (
      <FullPageError
        title="Couldn't load this cycle"
        message="We couldn't fetch the cycle's guidance. Try refreshing, or open this cycle from the cycles list."
        onBack={() => router.push(`/cycles/${flockId}`)}
      />
    );
  }

  // Step 0 — date picker.
  if (stepIdx === 0) {
    return (
      <DatePickerStep
        flockId={flockId}
        value={selectedDate}
        onChange={setSelectedDate}
        onCancel={exit}
        onContinue={goNext}
        stepCount={totalSteps - 1}
        hasRecordsOnSelectedDate={hasRecordsOnSelectedDate}
      />
    );
  }

  // After the last event step, redirect back to the cycle detail.
  if (stepIdx > stepList.length) {
    router.replace(`/cycles/${flockId}?recorded=1`);
    return <FullPageSpinner />;
  }

  // ── Real event steps ──────────────────────────────────────────────
  const currentStep = stepList[stepIdx - 1]!;
  const isLast = stepIdx === stepList.length;
  const sharedProps = {
    flockId,
    recordDate: selectedDate,
    guidance: guidance.data,
    prefs: prefs.data!.preferences,
    stepIndex: stepIdx,
    stepCount: stepList.length,
    onBack: goBack,
    onCancel: exit,
    onContinue: goNext,
    onSkip: goNext,
  };

  // Whether an egg_metrics step follows the eggs collection step —
  // determines whether the collection step POSTs or stashes.
  const nextKind = stepList[stepIdx]?.kind;
  const eggsHasFollowUp = nextKind === 'egg_metrics';

  // Each step asks for "the row that matches my event_type". For the
  // synthetic egg_metrics step, the matching backend row is also
  // event_type=eggs (size/weight is just extra payload on the same
  // event), so we hand it the same record.
  const existingFor = (kind: StepKind) => {
    switch (kind) {
      case 'feed':        return pickRecord(existingRecords, 'feed');
      case 'water':       return pickRecord(existingRecords, 'water');
      case 'vaccination': return pickRecord(existingRecords, 'vaccination');
      case 'treatment':   return pickRecord(existingRecords, 'treatment');
      case 'bird_count':  return pickRecord(existingRecords, 'bird_count');
      case 'weight':      return pickRecord(existingRecords, 'weight');
      case 'eggs':        return pickRecord(existingRecords, 'eggs');
      case 'egg_metrics': return pickRecord(existingRecords, 'eggs');
      default:            return undefined;
    }
  };
  const existing = existingFor(currentStep.kind);

  switch (currentStep.kind) {
    case 'feed':
      return <FeedStep {...sharedProps} existing={existing} />;
    case 'water':
      return <WaterStep {...sharedProps} existing={existing} />;
    case 'vaccination':
      return <VaccinationStep {...sharedProps} existing={existing} />;
    case 'treatment':
      return <TreatmentStep {...sharedProps} existing={existing} />;
    case 'bird_count':
      return <BirdCountStep {...sharedProps} existing={existing} />;
    case 'weight':
      return <WeightStep {...sharedProps} existing={existing} isLast={isLast} />;
    case 'eggs':
      return (
        <EggCollectionStep
          {...sharedProps}
          existing={existing}
          postDirectly={!eggsHasFollowUp}
          onCollect={setEggsBuffer}
          isLast={isLast}
        />
      );
    case 'egg_metrics':
      return (
        <EggSizeWeightStep
          {...sharedProps}
          existing={existing}
          pendingCollection={eggsBuffer}
          isLast={isLast}
        />
      );
    default:
      // Defensive — buildStepList only emits the kinds above. If a
      // future kind sneaks in we render the placeholder so navigation
      // isn't blocked.
      return (
        <StepPlaceholder
          label={currentStep.label}
          stepIndex={stepIdx}
          stepCount={stepList.length}
          onBack={goBack}
          onCancel={exit}
          onSkip={goNext}
          onContinue={goNext}
        />
      );
  }
}

/* ================================================================== */
/*  Dynamic step builder                                               */
/* ================================================================== */

/**
 * Internal step kinds. Most map 1:1 to a backend event_type, but
 * `egg_metrics` is synthetic — it's part of the eggs event, just
 * captured in its own UI step. The orchestrator buffers the
 * collection result and the size/weight step submits the combined
 * row.
 */
type StepKind =
  | 'feed'
  | 'water'
  | 'vaccination'
  | 'treatment'
  | 'bird_count'
  | 'weight'
  | 'eggs'
  | 'egg_metrics';

interface WizardStep {
  kind: StepKind;
  label: string;
}

/**
 * Compute which event steps to show, in what order. Mirrors the
 * mobile figma's section ordering: feed → water → vaccination →
 * treatment → bird_count → bird weight → egg collection → egg
 * size/weight (the last two layer-only).
 *
 * A step is included when ALL of:
 *   1. The user's `effectiveDailyRecord.<event>.include` is true
 *      (which already factors in the farm ceiling — see
 *      PreferenceSchema::effectiveDailyRecord on the backend).
 *   2. For `eggs` and `egg_metrics`, the flock's production_type is
 *      'layer' or 'mixed' — broilers never see them even with the
 *      preference on (the farm ceiling enforces this server-side too).
 *
 * `bird_count` appears when any of its sub-flags (dead/culled/sold/
 * lost) are on — even one justifies the step.
 *
 * `egg_metrics` is only shown when `eggs.include` is also on (because
 * the size/weight payload piggy-backs on the eggs event, which
 * requires payload.good).
 */
function buildStepList(
  guidance: DailyRecordGuidance,
  prefs: MyPreferencesDto,
): WizardStep[] {
  const eff = prefs.effectiveDailyRecord;
  const type = guidance.flock.production_type;
  const isLayerOrMixed = type === 'layer' || type === 'mixed';

  const steps: WizardStep[] = [];

  if (eff.feed?.include)        steps.push({ kind: 'feed',        label: 'Feed consumption' });
  if (eff.water?.include)       steps.push({ kind: 'water',       label: 'Water consumption' });
  if (eff.vaccination?.include) steps.push({ kind: 'vaccination', label: 'Vaccination' });
  if (eff.treatment?.include)   steps.push({ kind: 'treatment',   label: 'Treatment' });

  // Bird count appears when any of its sub-flags are on. The figma's
  // step shows all four sub-fields together, so we don't split them.
  const bc = eff.bird_count ?? {};
  if (bc.dead || bc.culled || bc.sold || bc.lost) {
    steps.push({ kind: 'bird_count', label: 'Bird count' });
  }

  if (eff.bird_weight?.include) steps.push({ kind: 'weight', label: 'Bird weight' });

  // Layer-only steps. eggs.include gates BOTH collection and metrics
  // because the metrics step's POST payload includes a `good` egg
  // count from the buffered collection.
  if (isLayerOrMixed && eff.eggs?.include) {
    steps.push({ kind: 'eggs', label: 'Egg collection' });

    const em = eff.egg_metrics ?? {};
    if (em.track_size || em.track_weight) {
      steps.push({ kind: 'egg_metrics', label: labelForEggMetrics(em) });
    }
  }

  return steps;
}

function labelForEggMetrics(em: { track_size?: boolean; track_weight?: boolean }): string {
  if (em.track_size && em.track_weight) return 'Egg size and weight';
  if (em.track_size) return 'Egg size';
  return 'Egg weight';
}

/* ================================================================== */
/*  Placeholder step (Phase 2 replaces this with real forms)           */
/* ================================================================== */

function StepPlaceholder({
  label, stepIndex, stepCount, onBack, onCancel, onSkip, onContinue,
}: {
  label: string;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onCancel: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  // Lazy import to avoid the placeholder pulling icons into every
  // future step component's bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { StepShell } = require('@/components/record/wizard-shell') as typeof import('@/components/record/wizard-shell');
  return (
    <StepShell
      sectionIcon={<span className="text-[14px]">🌱</span>}
      sectionLabel={label}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onBack={onBack}
      onCancel={onCancel}
      onSkip={onSkip}
      onContinue={onContinue}
    >
      <div className="rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-8 text-center">
        <h2 className="text-[15px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
          {label}
        </h2>
        <p className="mt-1.5 text-[12px] leading-snug text-[var(--color-brand-muted)]">
          This step has no form yet. Tap Continue or Skip to move on.
        </p>
      </div>
    </StepShell>
  );
}

/* ================================================================== */
/*  Full-page states                                                   */
/* ================================================================== */

function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
    </div>
  );
}

function FullPageError({
  title, message, onBack,
}: { title: string; message: string; onBack: () => void }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-white p-6">
      <div className="max-w-[420px] rounded-2xl border border-[var(--color-brand-border)] bg-white p-6 text-center">
        <h1 className="text-[16px] font-extrabold text-[var(--color-brand-fg)]">{title}</h1>
        <p className="mt-1.5 text-[12.5px] text-[var(--color-brand-muted)]">{message}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-[var(--color-brand-primary)] px-4 text-[12.5px] font-bold text-white hover:bg-[var(--color-brand-primary-deep)]"
        >
          Back to cycle
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Date helpers (duplicate of date-picker-step.tsx — kept local so    */
/*  the orchestrator doesn't pull in the full picker module just for   */
/*  utilities)                                                          */
/* ================================================================== */

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ymOf(ymd: string): string {
  return ymd.slice(0, 7);
}
