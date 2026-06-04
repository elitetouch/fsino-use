'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { endpoints, type DailyRecordEventType, type DailyRecordGuidance, type MyPreferencesDto } from '@/lib/api';
import { useMyPreferences } from '@/lib/use-preferences';
import { DatePickerStep } from '@/components/record/date-picker-step';

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

  // Phase 1 placeholder — each event step renders this until Phase 2
  // wires up the real forms.
  const currentEvent = stepList[stepIdx - 1]!;
  return (
    <StepPlaceholder
      eventType={currentEvent.eventType}
      label={currentEvent.label}
      stepIndex={stepIdx}
      stepCount={stepList.length}
      onBack={goBack}
      onCancel={exit}
      onSkip={goNext}
      onContinue={goNext}
    />
  );
}

/* ================================================================== */
/*  Dynamic step builder                                               */
/* ================================================================== */

interface WizardStep {
  eventType: DailyRecordEventType;
  label: string;
}

/**
 * Compute which event steps to show, in what order. Mirrors the
 * mobile figma's section ordering (feed → water → vaccination →
 * treatment → bird_count → weight → eggs for layers).
 *
 * A step is included when ALL of:
 *   1. The user's `effectiveDailyRecord.<event>.include` is true
 *      (which already factors in the farm ceiling — see
 *      PreferenceSchema::effectiveDailyRecord on the backend).
 *   2. For `eggs`, the flock's production_type is 'layer' or 'mixed'.
 *
 * `bird_count` is always shown when the user has any of its sub-flags
 * (dead/culled/sold/lost) enabled — even one flag justifies the step.
 */
function buildStepList(
  guidance: DailyRecordGuidance,
  prefs: MyPreferencesDto,
): WizardStep[] {
  const eff = prefs.effectiveDailyRecord;
  const type = guidance.flock.production_type;

  const steps: WizardStep[] = [];

  if (eff.feed?.include) steps.push({ eventType: 'feed', label: 'Feed consumption' });
  if (eff.water?.include) steps.push({ eventType: 'water', label: 'Water consumption' });
  if (eff.vaccination?.include) steps.push({ eventType: 'vaccination', label: 'Vaccination' });
  if (eff.treatment?.include) steps.push({ eventType: 'treatment', label: 'Treatment' });

  // Bird count appears when any of its sub-flags are on. The figma's
  // step shows all four sub-fields together, so we don't split them.
  const bc = eff.bird_count ?? {};
  if (bc.dead || bc.culled || bc.sold || bc.lost) {
    steps.push({ eventType: 'bird_count', label: 'Bird count' });
  }

  if (eff.bird_weight?.include) steps.push({ eventType: 'weight', label: 'Bird weight' });

  // Eggs only for layer / mixed flocks
  if ((type === 'layer' || type === 'mixed') && eff.eggs?.include) {
    steps.push({ eventType: 'eggs', label: 'Egg collection' });
  }

  return steps;
}

/* ================================================================== */
/*  Placeholder step (Phase 2 replaces this with real forms)           */
/* ================================================================== */

function StepPlaceholder({
  eventType, label, stepIndex, stepCount, onBack, onCancel, onSkip, onContinue,
}: {
  eventType: DailyRecordEventType;
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
        <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--color-brand-primary-deep)]">
          Phase 2
        </p>
        <h2 className="mt-1 text-[15px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
          {label}
        </h2>
        <p className="mt-1.5 text-[12px] leading-snug text-[var(--color-brand-muted)]">
          The real form for <strong>{eventType}</strong> ships in Phase 2. For now, use
          Continue or Skip to move through the wizard and verify the navigation flow.
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
