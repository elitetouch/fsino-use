'use client';

import { useState } from 'react';
import { Droplet } from 'lucide-react';
import type {
  DailyRecordDto, DailyRecordGuidance, GuidanceMessage, MyPreferencesDto,
} from '@/lib/api';
import { useCreateDailyRecord, useUpdateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, NumberKeypadInput, BeigeAlert, AnomalyWarning,
  EditingBanner, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import { Dropdown, FieldStack } from '@/components/record/inputs';

/**
 * Step 2 — Water consumption.
 *
 * Same one-moment / two-moment pattern as Feed, just simpler: there's
 * only an amount + unit, no type/brand. Unit is always `liters` in
 * the figma (the backend stores whatever string we send).
 *
 * Each Continue saves a single `event_type: water` row with quantity
 * + payload.moment.
 */

const MOMENTS = [
  { value: 'morning',    label: 'Morning'    },
  { value: 'evening',    label: 'Evening'    },
  { value: 'entire_day', label: 'Entire day' },
] as const;
type Moment = (typeof MOMENTS)[number]['value'];

export function WaterStep({
  flockId,
  recordDate,
  guidance,
  prefs,
  existing,
  stepIndex,
  stepCount,
  onBack,
  onCancel,
  onContinue,
  onSkip,
}: {
  flockId: string;
  recordDate: string;
  guidance: DailyRecordGuidance;
  prefs: MyPreferencesDto;
  existing?: DailyRecordDto;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const twiceADay = !!prefs.dailyRecord.water?.twice_a_day;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRecord = useCreateDailyRecord(flockId);
  const updateRecord = useUpdateDailyRecord(flockId);
  const editing = !!existing;

  const initialMoment = (existing?.moment as Moment | undefined)
    ?? (twiceADay ? 'morning' : 'entire_day');
  const initialAmount = existing?.quantity != null ? String(existing.quantity) : '';

  const [moment, setMoment] = useState<Moment>(initialMoment);
  const [amount, setAmount] = useState(initialAmount);

  const amountNumeric = parseFloat(amount);
  const amountValid = !isNaN(amountNumeric) && amountNumeric > 0;
  const isValid = amountValid;

  const usual = guidance.sections.water.usual_quantity;
  const showHigh = !!usual && amountValid && amountNumeric > usual.high * 1.5;
  const showLow  = !!usual && amountValid && amountNumeric < usual.low * 0.5;

  const waterMessages = guidance.sections.water.messages;

  const pending = createRecord.isPending || updateRecord.isPending;
  const submit = () => {
    if (!isValid || pending) return;
    if (editing && existing) {
      updateRecord.mutate(
        {
          recordId: existing.id,
          payload: {
            quantity: amountNumeric,
            unit: 'liters',
            moment,
            payload: { moment },
          },
        },
        { onSuccess: onContinue },
      );
      return;
    }
    createRecord.mutate(
      {
        event_type: 'water',
        record_date: recordDate,
        quantity: amountNumeric,
        unit: 'liters',
        payload: { moment },
      },
      { onSuccess: onContinue },
    );
  };

  return (
    <>
      <StepShell
        sectionIcon={<Droplet className="h-3.5 w-3.5" />}
        sectionLabel="Water consumption"
        stepIndex={stepIndex}
        stepCount={stepCount}
        editing={editing}
        onBack={onBack}
        onCancel={onCancel}
        onLearnMore={() => setDrawerOpen(true)}
        onSkip={onSkip}
        onContinue={submit}
        continueDisabled={!isValid}
        continuePending={pending}
        continueLabel={editing ? 'Save changes' : 'Continue'}
      >
        <FieldStack>
          {editing && (
            <EditingBanner
              authorName={existing?.createdByUser?.name}
              loggedAt={existing?.occurredAt}
            />
          )}

          {waterMessages.length > 0 && (
            <BeigeAlert>{firstHint(waterMessages)}</BeigeAlert>
          )}

          {twiceADay && (
            <Dropdown
              id="water-moment"
              label="Water moment"
              value={moment}
              onChange={(v) => setMoment(v as Moment)}
              options={[...MOMENTS]}
            />
          )}

          <div>
            <NumberKeypadInput
              id="water-amount"
              label="Water amount"
              description={momentDescription(moment)}
              prefix={<Droplet className="h-3 w-3" />}
              value={amount}
              onChange={setAmount}
              unit="liters"
            />
            {showHigh && (
              <AnomalyWarning>
                You have entered far more water than usual ({fmtRange(usual!)} per day).
                Double-check that the figure is correct.
              </AnomalyWarning>
            )}
            {showLow && (
              <AnomalyWarning>
                You have entered far less water than usual ({fmtRange(usual!)} per day).
                Double-check that the figure is correct.
              </AnomalyWarning>
            )}
          </div>
        </FieldStack>
      </StepShell>

      <LearnMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Water consumption"
      >
        <LearnMoreHeading>Keeping record of water</LearnMoreHeading>
        <p>
          Enter the water you give to the birds in this pen every day. In the
          dashboard you&rsquo;ll find an overview of the amount of water you have
          given.
        </p>
        <LearnMoreHeading>Water amount</LearnMoreHeading>
        <p>
          Enter the amount of water you give to the birds in this pen. If you
          don&rsquo;t want to record water, you can turn it off in the{' '}
          <strong>Daily record preferences</strong>.
        </p>
        <LearnMoreHeading>Once or twice a day</LearnMoreHeading>
        <p>
          You can choose between recording water once or twice a day (mornings
          and evenings) in your{' '}
          <strong>Daily record preferences</strong>. Two-moment mode adds a
          moment selector at the top of this step.
        </p>
      </LearnMoreDrawer>
    </>
  );
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function momentDescription(moment: Moment): string {
  if (moment === 'morning') return 'Amount of water provided in the morning';
  if (moment === 'evening') return 'Amount of water provided in the evening';
  return 'Amount of water provided during the day';
}

function firstHint(messages: GuidanceMessage[]): string {
  return messages[0]?.text ?? '';
}

function fmtRange(u: { low: number; high: number }): string {
  return `${fmt(u.low)}–${fmt(u.high)}`;
}

function fmt(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}
