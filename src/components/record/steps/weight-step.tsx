'use client';

import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import type {
  DailyRecordGuidance, GuidanceMessage, MyPreferencesDto,
} from '@/lib/api';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, NumberKeypadInput, BeigeAlert, AnomalyWarning,
  YesNoPills, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import { FieldStack, FOCUS_WRAPPER } from '@/components/record/inputs';
import { cn } from '@/lib/utils';

/**
 * Step 6 — Bird weight.
 *
 * Two sub-flows, picked by user pref `bird_weight.auto_average`:
 *
 *   SELF-CALCULATED (auto_average=false):
 *     Single "Average weight" input the user fills with their own
 *     pre-computed average.
 *
 *   FIVE BIRDS  (auto_average=true):
 *     Five labelled inputs (Bird 1…Bird 5). We compute the average
 *     client-side and show it in a sticky read-only row above the
 *     keyboard — updates as the user types so they can see the
 *     calculation happening (matches the figma's "Make sure the
 *     average is also calculated over less than five entries" note).
 *
 * On submit, we send `event_type: 'weight'` with quantity = average,
 * unit = 'kg', and payload.weights[] when in five-birds mode so the
 * raw values are preserved for analytics.
 *
 * This is the FINAL step (when it's enabled) — the figma's CTA reads
 * "Complete record" here rather than "Continue". The shell already
 * supports a custom continueLabel.
 */

export function WeightStep({
  flockId,
  recordDate,
  guidance,
  prefs,
  stepIndex,
  stepCount,
  isLast,
  onBack,
  onCancel,
  onContinue,
  onSkip,
}: {
  flockId: string;
  recordDate: string;
  guidance: DailyRecordGuidance;
  prefs: MyPreferencesDto;
  stepIndex: number;
  stepCount: number;
  /** True when this is the final step in the wizard — drives the CTA copy. */
  isLast: boolean;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const autoAverage = !!prefs.dailyRecord.bird_weight?.auto_average;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRecord = useCreateDailyRecord(flockId);

  // Default "Do you want to record bird weight today?" — flips with
  // the schedule guidance (figma: if it's almost time, default Yes;
  // if too soon, default No).
  const weightSection = guidance.sections.weight;
  const schedulingNow = !!weightSection.messages.find((m) =>
    m.code.startsWith('weight.time_to_weigh') || m.code.startsWith('weight.almost_time')
  );
  const [answer, setAnswer] = useState<'yes' | 'no'>(schedulingNow ? 'yes' : 'no');

  const [selfAvg, setSelfAvg] = useState('');
  const [bird1, setBird1] = useState('');
  const [bird2, setBird2] = useState('');
  const [bird3, setBird3] = useState('');
  const [bird4, setBird4] = useState('');
  const [bird5, setBird5] = useState('');

  /* ---- Compute the average ---- */

  const fiveBirdSamples = useMemo(
    () => [bird1, bird2, bird3, bird4, bird5].map((s) => parseFloat(s)).filter((n) => !isNaN(n) && n > 0),
    [bird1, bird2, bird3, bird4, bird5],
  );

  const fiveBirdAvg = fiveBirdSamples.length > 0
    ? fiveBirdSamples.reduce((s, n) => s + n, 0) / fiveBirdSamples.length
    : null;

  const submitAvg = autoAverage ? fiveBirdAvg : parseFloat(selfAvg);
  const submitAvgValid = submitAvg !== null && !isNaN(submitAvg) && submitAvg > 0;
  const yesValid = autoAverage
    ? fiveBirdSamples.length >= 1   // at least one bird entered
    : submitAvgValid;
  const isValid = answer === 'no' || yesValid;

  // Soft anomaly — vs the usual range from guidance.
  const usual = weightSection.usual_quantity;
  const showHigh = !!usual && submitAvgValid && submitAvg! > usual.high * 1.5;
  const showLow  = !!usual && submitAvgValid && submitAvg! < usual.low  * 0.5;

  /* ---- Submit ---- */

  const submit = () => {
    if (!isValid || createRecord.isPending) return;
    if (answer === 'no') {
      onContinue();
      return;
    }
    const finalAvg = submitAvg!;
    createRecord.mutate(
      {
        event_type: 'weight',
        record_date: recordDate,
        quantity: finalAvg,
        unit: 'kg',
        payload: autoAverage
          ? {
              auto_average: true,
              weights: fiveBirdSamples,
              sample_size: fiveBirdSamples.length,
            }
          : {
              auto_average: false,
              sample_size: null,
            },
      },
      { onSuccess: onContinue },
    );
  };

  return (
    <>
      <StepShell
        sectionIcon={<Scale className="h-3.5 w-3.5" />}
        sectionLabel="Bird weight"
        stepIndex={stepIndex}
        stepCount={stepCount}
        onBack={onBack}
        onCancel={onCancel}
        onLearnMore={() => setDrawerOpen(true)}
        onSkip={onSkip}
        onContinue={submit}
        continueDisabled={!isValid}
        continuePending={createRecord.isPending}
        continueLabel={isLast ? 'Complete record' : 'Continue'}
      >
        <FieldStack>
          <div>
            <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Do you want to record bird weight today?
            </p>
            <YesNoPills value={answer} onChange={setAnswer} primary={schedulingNow ? 'yes' : 'no'} />
          </div>

          {/* Schedule banner — visible in both branches */}
          {weightSection.messages.length > 0 && (
            <BeigeAlert title={scheduleTitle(weightSection.messages)}>
              {firstHint(weightSection.messages)}
            </BeigeAlert>
          )}

          {answer === 'yes' && !autoAverage && (
            <div>
              <NumberKeypadInput
                id="weight-self"
                label="Average weight"
                description="Calculate and enter the average weight"
                prefix={<Scale className="h-3 w-3" />}
                value={selfAvg}
                onChange={setSelfAvg}
                unit="kg"
              />
              {showHigh && (
                <AnomalyWarning>
                  You entered a very heavy weight ({fmtKg(submitAvg!)} kg) — usual range is{' '}
                  {fmtRange(usual!)} kg. Did you mean {fmtKg(submitAvg! / 10)} kg?
                </AnomalyWarning>
              )}
              {showLow && (
                <AnomalyWarning>
                  You entered a very light weight ({fmtKg(submitAvg!)} kg). Usual range is{' '}
                  {fmtRange(usual!)} kg.
                </AnomalyWarning>
              )}
            </div>
          )}

          {answer === 'yes' && autoAverage && (
            <>
              <p className="text-[11.5px] text-[var(--color-brand-muted)]">
                Select <strong>five birds at random</strong> and enter their weight. We&rsquo;ll
                calculate the average weight as you go.
              </p>
              <BirdRow label="Bird 1" value={bird1} onChange={setBird1} />
              <BirdRow label="Bird 2" value={bird2} onChange={setBird2} />
              <BirdRow label="Bird 3" value={bird3} onChange={setBird3} />
              <BirdRow label="Bird 4" value={bird4} onChange={setBird4} />
              <BirdRow label="Bird 5" value={bird5} onChange={setBird5} />

              {showHigh && (
                <AnomalyWarning>
                  Average is very heavy ({fmtKg(submitAvg!)} kg) — usual range is{' '}
                  {fmtRange(usual!)} kg. Double-check the figures.
                </AnomalyWarning>
              )}
              {showLow && (
                <AnomalyWarning>
                  Average is very light ({fmtKg(submitAvg!)} kg) — usual range is{' '}
                  {fmtRange(usual!)} kg. Double-check the figures.
                </AnomalyWarning>
              )}

              {/* Live computed average */}
              <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
                    Average weight
                  </p>
                  <p className="text-[15px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
                    {fiveBirdAvg !== null ? `${fmtKg(fiveBirdAvg)} kg` : '—'}
                  </p>
                </div>
                {fiveBirdSamples.length > 0 && fiveBirdSamples.length < 5 && (
                  <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">
                    Computed from {fiveBirdSamples.length} of 5 entries. Fill all five for the best estimate.
                  </p>
                )}
              </div>
            </>
          )}
        </FieldStack>
      </StepShell>

      <LearnMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Bird weight"
      >
        <LearnMoreHeading>Keeping record of weight</LearnMoreHeading>
        <p>
          Enter the weight of your birds at a weekly interval. This way you
          can keep track of the growth and health of your birds. The feed
          conversion ratio (FCR) will be calculated for you. You&rsquo;ll find the
          bird weight and FCR in the dashboard.
        </p>
        <LearnMoreHeading>Average weight</LearnMoreHeading>
        <p>
          Under <strong>Daily record preferences</strong> you can choose
          between entering your own self-calculated average or entering the
          weight of five birds — in which case the app calculates the average
          for you. Five-bird mode is more accurate because each entry has a
          visible effect on the running average.
        </p>
        <LearnMoreHeading>Time to weigh your birds</LearnMoreHeading>
        <p>
          The app will show you messages reminding you when it&rsquo;s time to
          weigh your birds, based on your last weighing date.
        </p>
      </LearnMoreDrawer>
    </>
  );
}

/* ================================================================== */
/*  Helpers + sub-components                                           */
/* ================================================================== */

function BirdRow({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <p className="w-20 shrink-0 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
        {label}
      </p>
      <div className={cn(
        'flex h-11 flex-1 items-center gap-2 rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3',
        FOCUS_WRAPPER,
      )}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitiseDecimal(e.target.value))}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)] outline-none placeholder:font-normal placeholder:text-[var(--color-brand-muted-soft)]"
        />
        <span className="shrink-0 text-[12.5px] font-semibold text-[var(--color-brand-muted)]">
          kg
        </span>
      </div>
    </div>
  );
}

function sanitiseDecimal(raw: string): string {
  const cleaned = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
}

function scheduleTitle(messages: GuidanceMessage[]): string | undefined {
  const code = messages[0]?.code ?? '';
  if (code.includes('time_to_weigh')) return 'Time to weigh your birds';
  if (code.includes('almost_time'))   return 'Almost time to weigh';
  if (code.includes('not_yet'))       return 'Not yet time to weigh';
  return undefined;
}

function firstHint(messages: GuidanceMessage[]): string {
  return messages[0]?.text ?? '';
}

function fmtKg(n: number): string {
  return n.toFixed(2);
}

function fmtRange(u: { low: number; high: number }): string {
  return `${fmtKg(u.low)}–${fmtKg(u.high)}`;
}
