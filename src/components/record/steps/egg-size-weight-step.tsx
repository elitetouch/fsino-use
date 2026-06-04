'use client';

import { useState } from 'react';
import { Egg, Scale } from 'lucide-react';
import type {
  DailyRecordGuidance, GuidanceMessage, MyPreferencesDto,
} from '@/lib/api';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, NumberKeypadInput, BeigeAlert, AnomalyWarning,
  YesNoPills, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import { PillTiles, FieldStack } from '@/components/record/inputs';
import type { EggCollectionData } from './egg-collection-step';

/**
 * Step 8 — Egg size and weight.
 *
 * Three variants from the user's egg_metrics preference:
 *   - track_size + track_weight  → "Egg size and weight" (Step 8 in figma)
 *   - track_size only            → "Egg size"            (Step 8A)
 *   - track_weight only          → "Egg weight"          (Step 8B, implied)
 *
 * Both pieces of data flow into the SAME `eggs` event POST as the
 * collection step that preceded this one — the backend's
 * CreateFlockEventRequest::eggs validator requires `payload.good >= 0`
 * on every eggs event, so we can't POST size or weight in isolation.
 * That's why the orchestrator buffers the collection in `eggsBuffer`
 * and hands it to us here.
 *
 * Sample size for weight: 13 eggs (figma annotation: "Enter the total
 * weight of 13 eggs"). Average egg weight = total / 13, shown live in
 * the dark footer card.
 *
 * Default Yes/No: No. The figma's design treats this step as opt-in
 * (you're not expected to record size/weight every day, only "at
 * least three times per week" once the flock starts laying). Skipping
 * a day still submits the collection from the previous step.
 */

const EGG_SIZES = [
  { value: 'small',  label: 'Small'  },
  { value: 'medium', label: 'Medium' },
  { value: 'jumbo',  label: 'Jumbo'  },
] as const;
type EggSize = (typeof EGG_SIZES)[number]['value'];

/** Sample size for the weight calculation (figma's "total weight of 13 eggs"). */
const WEIGHT_SAMPLE = 13;

export function EggSizeWeightStep({
  flockId,
  recordDate,
  guidance,
  prefs,
  pendingCollection,
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
  /** Collection from the previous egg step, or null when the user said No. */
  pendingCollection: EggCollectionData | null;
  stepIndex: number;
  stepCount: number;
  /** True when this is the last step in the wizard — drives the CTA copy. */
  isLast: boolean;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const trackSize   = !!prefs.dailyRecord.egg_metrics?.track_size;
  const trackWeight = !!prefs.dailyRecord.egg_metrics?.track_weight;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRecord = useCreateDailyRecord(flockId);

  // Default No — the figma marks the No button green by default.
  const [answer, setAnswer] = useState<'yes' | 'no'>('no');
  const [size, setSize] = useState<EggSize | null>(null);
  const [totalWeight, setTotalWeight] = useState('');

  const totalWeightNumeric = parseFloat(totalWeight);
  const totalWeightValid = !isNaN(totalWeightNumeric) && totalWeightNumeric > 0;
  const avgWeight = totalWeightValid ? totalWeightNumeric / WEIGHT_SAMPLE : null;

  // What's required to answer Yes depends on which sub-fields are
  // enabled in prefs — we only validate the fields the user can see.
  const sizeValid   = !trackSize   || size !== null;
  const weightValid = !trackWeight || totalWeightValid;
  const yesValid    = sizeValid && weightValid;
  const isValid     = answer === 'no' || yesValid;

  // Anomaly on average egg weight. A normal egg weighs ~50–65 g;
  // anything outside 30–80 g almost certainly means the user entered
  // a per-egg figure into the total field, or vice-versa. The figma's
  // demo numbers (49 g shown for a 491 g sample of "10 eggs") let us
  // sanity-check the formula too: 491/10 ≈ 49 ✓.
  const showHighAvg = avgWeight !== null && avgWeight > 80;
  const showLowAvg  = avgWeight !== null && avgWeight < 30 && avgWeight > 0;

  // Pre-input guidance — figma's "Ready to produce eggs" beige banner
  // comes from the guidance service when the flock is 15-18 weeks old.
  const sizeMessages = guidance.sections.egg_size.messages;

  const submit = () => {
    if (!isValid || createRecord.isPending) return;

    if (answer === 'no') {
      // Still need to flush any pending collection so the user's "Yes"
      // on the previous step isn't lost. If pendingCollection is null
      // there's nothing to POST and we just advance.
      if (pendingCollection) {
        createRecord.mutate(
          {
            event_type: 'eggs',
            record_date: recordDate,
            payload: {
              good: pendingCollection.good,
              ...(pendingCollection.bad > 0 ? { bad: pendingCollection.bad } : {}),
              moment: pendingCollection.moment,
            },
          },
          { onSuccess: onContinue },
        );
        return;
      }
      onContinue();
      return;
    }

    // Yes — POST collection + size/weight in a single eggs event.
    const good = pendingCollection?.good ?? 0;
    const bad  = pendingCollection?.bad  ?? 0;
    const moment = pendingCollection?.moment ?? 'entire_day';

    const payload: Record<string, unknown> = {
      good,
      moment,
    };
    if (bad > 0) payload.bad = bad;
    if (trackSize && size) {
      // Attribute all good eggs to the chosen size — matches the
      // backend's payload.sizes.{small,medium,large,etc.} shape from
      // CreateFlockEventRequest::eggs. We use the size keys the
      // request explicitly whitelists.
      payload.sizes = { [size]: good };
    }
    if (trackWeight && avgWeight !== null) {
      payload.weight_avg_grams = avgWeight;
      payload.weight_sample_size = WEIGHT_SAMPLE;
      payload.weight_total_grams = totalWeightNumeric;
    }

    createRecord.mutate(
      {
        event_type: 'eggs',
        record_date: recordDate,
        payload,
      },
      { onSuccess: onContinue },
    );
  };

  const sectionLabel = trackSize && trackWeight
    ? 'Egg size and weight'
    : trackSize
      ? 'Egg size'
      : 'Egg weight';

  const questionLabel = trackSize && trackWeight
    ? 'Do you want to enter egg size or weight today?'
    : trackSize
      ? 'Do you want to enter egg size today?'
      : 'Do you want to enter egg weight today?';

  return (
    <>
      <StepShell
        sectionIcon={<Egg className="h-3.5 w-3.5" />}
        sectionLabel={sectionLabel}
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
              {questionLabel}
            </p>
            <YesNoPills value={answer} onChange={setAnswer} primary="no" />
          </div>

          {answer === 'yes' && (
            <>
              {sizeMessages.length > 0 && (
                <BeigeAlert title="Ready to produce eggs">
                  {firstHint(sizeMessages)}
                </BeigeAlert>
              )}

              {trackSize && (
                <div>
                  <p className="mb-1.5 text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
                    Egg size
                    <span className="ml-2 font-normal text-[11px] text-[var(--color-brand-muted)]">
                      Select one
                    </span>
                  </p>
                  <PillTiles
                    value={size}
                    onChange={setSize}
                    options={[...EGG_SIZES]}
                  />
                </div>
              )}

              {trackWeight && (
                <div>
                  <NumberKeypadInput
                    id="eggs-total-weight"
                    label="Weight"
                    description={`Total weight of ${WEIGHT_SAMPLE} eggs`}
                    prefix={<Scale className="h-3 w-3" />}
                    value={totalWeight}
                    onChange={setTotalWeight}
                    unit="gram"
                  />
                  {showHighAvg && (
                    <AnomalyWarning>
                      Average is {Math.round(avgWeight!)} g per egg, which is unusually
                      high. Make sure you entered the total weight of {WEIGHT_SAMPLE} eggs,
                      not a single one.
                    </AnomalyWarning>
                  )}
                  {showLowAvg && (
                    <AnomalyWarning>
                      Average is {Math.round(avgWeight!)} g per egg, which is unusually
                      low. Double-check the figure.
                    </AnomalyWarning>
                  )}
                </div>
              )}

              {/* Live average weight footer card — only when tracking weight. */}
              {trackWeight && avgWeight !== null && avgWeight > 0 && (
                <div className="rounded-xl bg-[var(--color-brand-fg)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold tracking-tight text-white/80">
                      Average weight
                    </p>
                    <p className="text-[16px] font-extrabold tracking-tight text-white">
                      {Math.round(avgWeight)} gram
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </FieldStack>
      </StepShell>

      <LearnMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={sectionLabel}
      >
        <LearnMoreHeading>Keeping record of egg size and weight</LearnMoreHeading>
        <p>
          Enter the size and weight of the eggs you collect. In the dashboard
          you&rsquo;ll find an overview of the egg sizes and the weights, which
          gives insights into the productivity of your flock.
        </p>
        {trackSize && (
          <>
            <LearnMoreHeading>Egg size</LearnMoreHeading>
            <p>
              There are three sizes of eggs: <strong>Small</strong>,{' '}
              <strong>Medium</strong> and <strong>Jumbo</strong>. Select which
              size your eggs are. If you&rsquo;d rather only track the weight of
              your eggs, switch the size toggle off in your{' '}
              <strong>Daily record preferences</strong>.
            </p>
          </>
        )}
        {trackWeight && (
          <>
            <LearnMoreHeading>Egg weight</LearnMoreHeading>
            <p>
              Enter the <strong>total weight of {WEIGHT_SAMPLE} eggs</strong>{' '}
              chosen at random, not the weight of a single egg. We&rsquo;ll calculate
              the average for you (total &divide; {WEIGHT_SAMPLE}) and show it
              underneath. If you&rsquo;d rather only track size, switch the
              weight toggle off in your{' '}
              <strong>Daily record preferences</strong>.
            </p>
          </>
        )}
      </LearnMoreDrawer>
    </>
  );
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function firstHint(messages: GuidanceMessage[]): string {
  return messages[0]?.text ?? '';
}
