'use client';

import { useState } from 'react';
import { Egg } from 'lucide-react';
import type {
  DailyRecordDto, DailyRecordGuidance, GuidanceMessage, MyPreferencesDto,
} from '@/lib/api';
import { useCreateDailyRecord, useUpdateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, NumberKeypadInput, BeigeAlert, AnomalyWarning,
  YesNoPills, EditingBanner, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import { Dropdown, FieldStack } from '@/components/record/inputs';
import { EntryPicker, useEntryChoice } from '@/components/record/entry-picker';

/**
 * Step 7 — Egg collection.
 *
 * Layer / mixed flocks only — the orchestrator gates broiler users out
 * via guidance.flock.production_type.
 *
 * Two sub-flows, mirroring the figma's 7A / 7B:
 *
 *   ONE collection  (eggs.twice_a_day = false):
 *     [How many eggs?]  → live crates total below.
 *
 *   TWO collections (eggs.twice_a_day = true):
 *     [Collection moment dropdown: Morning / Evening / Entire day]
 *     → [How many eggs?] → crates.
 *
 * Damaged-egg tracking is a separate user pref:
 *   - track_damaged = false:  single "How many eggs?" input
 *   - track_damaged = true:   split into "Eggs in good condition"
 *                             and "Damaged eggs" inputs.
 *
 * Live crates total = (good + damaged) / 30. Rendered as the dark
 * footer card the figma calls "Crates: 40.0".
 *
 * Sub-flow with the egg size / weight step that follows:
 *   - When the user has egg_metrics enabled (track_size or track_weight),
 *     this step does NOT POST. It stashes the collection data into
 *     `eggsBuffer` (an orchestrator-owned ref) and advances; the size /
 *     weight step picks it up and submits one combined eggs event.
 *   - When egg_metrics is OFF, this step POSTs directly because it's
 *     the only egg step.
 *
 * The decision is taken at the orchestrator level via the `postDirectly`
 * prop so the step component itself doesn't need to know about the
 * step list.
 */

const CRATE_SIZE = 30;

const MOMENTS = [
  { value: 'morning',    label: 'Morning'    },
  { value: 'evening',    label: 'Evening'    },
  { value: 'entire_day', label: 'Entire day' },
] as const;
type Moment = (typeof MOMENTS)[number]['value'];

/**
 * Output payload from a successful collection step — saved into the
 * orchestrator's eggsBuffer when postDirectly is false.
 */
export interface EggCollectionData {
  good: number;
  bad: number;
  moment: Moment;
}

interface EggCollectionStepProps {
  flockId: string;
  recordDate: string;
  guidance: DailyRecordGuidance;
  prefs: MyPreferencesDto;
  existingList: DailyRecordDto[];
  postDirectly: boolean;
  onCollect: (data: EggCollectionData | null) => void;
  stepIndex: number;
  stepCount: number;
  isLast: boolean;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function EggCollectionStep(props: EggCollectionStepProps) {
  const choice = useEntryChoice(props.existingList);
  if (choice.showPicker) {
    return (
      <EggCollectionPickerView
        {...props}
        pickRecord={choice.pickRecord}
        pickAddNew={choice.pickAddNew}
      />
    );
  }
  return (
    <EggCollectionForm
      key={choice.formKey}
      flockId={props.flockId}
      recordDate={props.recordDate}
      guidance={props.guidance}
      prefs={props.prefs}
      existing={choice.existing}
      onSwitchEntry={props.existingList.length >= 2 ? choice.goToPicker : undefined}
      postDirectly={props.postDirectly}
      onCollect={props.onCollect}
      stepIndex={props.stepIndex}
      stepCount={props.stepCount}
      isLast={props.isLast}
      onBack={props.onBack}
      onCancel={props.onCancel}
      onContinue={props.onContinue}
      onSkip={props.onSkip}
    />
  );
}

function EggCollectionPickerView({
  existingList, stepIndex, stepCount,
  onBack, onCancel, onSkip,
  pickRecord, pickAddNew,
}: EggCollectionStepProps & {
  pickRecord: (r: DailyRecordDto) => void;
  pickAddNew: () => void;
}) {
  // Sum good + bad eggs across all entries.
  const dayTotalEggs = existingList.reduce((s, r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    const good = typeof p.good === 'number' ? p.good : 0;
    const bad = typeof p.bad === 'number' ? p.bad : 0;
    return s + good + bad;
  }, 0);
  const dayCrates = dayTotalEggs / CRATE_SIZE;
  return (
    <StepShell
      sectionIcon={<Egg className="h-3.5 w-3.5" />}
      sectionLabel="Egg collection"
      stepIndex={stepIndex}
      stepCount={stepCount}
      onBack={onBack}
      onCancel={onCancel}
      onSkip={onSkip}
      onContinue={() => {}}
      continueDisabled
      continueLabel="Pick an entry above"
    >
      <EntryPicker
        eventLabel="egg collection"
        entries={existingList}
        summary={(r) => {
          const p = (r.payload ?? {}) as Record<string, unknown>;
          const good = typeof p.good === 'number' ? p.good : 0;
          const bad = typeof p.bad === 'number' ? p.bad : 0;
          const total = good + bad;
          const crates = total / CRATE_SIZE;
          const damaged = bad > 0 ? ` (${bad} damaged)` : '';
          return `${total} eggs · ${crates.toFixed(1)} crates${damaged}`;
        }}
        onSelect={pickRecord}
        onAddAnother={pickAddNew}
        totalLine={`Today total: ${dayTotalEggs.toLocaleString()} eggs · ${dayCrates.toFixed(1)} crates across ${existingList.length} entries`}
      />
    </StepShell>
  );
}

function EggCollectionForm({
  flockId,
  recordDate,
  guidance,
  prefs,
  existing,
  onSwitchEntry,
  postDirectly,
  onCollect,
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
  existing?: DailyRecordDto;
  onSwitchEntry?: () => void;
  postDirectly: boolean;
  onCollect: (data: EggCollectionData | null) => void;
  stepIndex: number;
  stepCount: number;
  isLast: boolean;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const twiceADay = !!prefs.dailyRecord.eggs?.twice_a_day;
  const trackDamaged = !!prefs.dailyRecord.eggs?.track_damaged;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRecord = useCreateDailyRecord(flockId);
  const updateRecord = useUpdateDailyRecord(flockId);
  const editing = !!existing;

  // EDIT-mode pre-fill — pull good/bad/moment from the existing
  // eggs row. We recover the per-input split based on the user's
  // current track_damaged preference, even if the record was
  // originally logged with a different setting.
  const existingPayload = (existing?.payload ?? {}) as Record<string, unknown>;
  const existingGood = typeof existingPayload.good === 'number' ? existingPayload.good : 0;
  const existingBad  = typeof existingPayload.bad  === 'number' ? existingPayload.bad  : 0;
  const existingMoment = (existing?.moment as Moment | undefined)
    ?? (typeof existingPayload.moment === 'string'
      ? existingPayload.moment as Moment
      : (twiceADay ? 'morning' : 'entire_day'));

  // Default Yes — if the user opened this step at all, they probably
  // collected eggs today; we save them a tap. In edit mode the row
  // already exists so Yes is the only sensible default.
  const [answer, setAnswer] = useState<'yes' | 'no'>('yes');
  const [moment, setMoment] = useState<Moment>(existingMoment);
  const [eggsAll, setEggsAll] = useState(editing && !trackDamaged ? String(existingGood + existingBad) : '');
  const [eggsGood, setEggsGood] = useState(editing && trackDamaged ? String(existingGood) : '');
  const [eggsBad, setEggsBad] = useState(editing && trackDamaged ? String(existingBad) : '');

  // Numeric working values (NaN if blank).
  const goodCount = safeInt(trackDamaged ? eggsGood : eggsAll);
  const badCount = trackDamaged ? safeInt(eggsBad) : 0;
  const totalCount = goodCount + badCount;
  const crates = totalCount > 0 ? totalCount / CRATE_SIZE : null;

  const eggsEntered = trackDamaged
    ? eggsGood.trim().length > 0
    : eggsAll.trim().length > 0;
  const yesValid = eggsEntered && goodCount >= 0;
  const isValid = answer === 'no' || yesValid;

  // Soft "Are you sure?" — vs the 14-day usual range from guidance.
  // We compare the total (good + damaged), since usual_quantity tracks
  // total collected per day.
  const usual = guidance.sections.eggs.usual_quantity;
  const showHigh = !!usual && totalCount > 0 && totalCount > usual.high * 1.5;
  const showLow  = !!usual && totalCount > 0 && totalCount < usual.low  * 0.5;

  const eggsMessages = guidance.sections.eggs.messages;

  const pending = createRecord.isPending || updateRecord.isPending;
  const submit = () => {
    if (!isValid || pending) return;

    if (answer === 'no') {
      // Nothing to POST; let the orchestrator know there's nothing in
      // the buffer either.
      onCollect(null);
      onContinue();
      return;
    }

    const data: EggCollectionData = {
      good: goodCount,
      bad: badCount,
      moment,
    };

    if (editing && existing) {
      // EDIT mode — PATCH the existing row. We preserve any
      // size/weight fields the row was originally saved with
      // (the egg_metrics step will overwrite them if reached).
      const mergedPayload: Record<string, unknown> = {
        ...existingPayload,
        good: data.good,
        moment: data.moment,
      };
      if (data.bad > 0) {
        mergedPayload.bad = data.bad;
      } else {
        delete mergedPayload.bad;
      }
      updateRecord.mutate(
        {
          recordId: existing.id,
          payload: { payload: mergedPayload },
        },
        { onSuccess: onContinue },
      );
      return;
    }

    if (postDirectly) {
      // No size/weight follow-up — POST the eggs event now.
      createRecord.mutate(
        {
          event_type: 'eggs',
          record_date: recordDate,
          payload: {
            good: data.good,
            ...(data.bad > 0 ? { bad: data.bad } : {}),
            moment: data.moment,
          },
        },
        { onSuccess: onContinue },
      );
      return;
    }

    // Stash into the orchestrator's buffer. The size/weight step
    // picks it up and POSTs the combined event.
    onCollect(data);
    onContinue();
  };

  return (
    <>
      <StepShell
        sectionIcon={<Egg className="h-3.5 w-3.5" />}
        sectionLabel="Egg collection"
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
        continueLabel={editing && answer === 'yes'
          ? 'Save changes'
          : (isLast ? 'Complete record' : 'Continue')}
      >
        <FieldStack>
          {editing && (
            <EditingBanner
              authorName={existing?.createdByUser?.name}
              loggedAt={existing?.occurredAt}
              onSwitchEntry={onSwitchEntry}
            />
          )}

          <div>
            <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Did you pick eggs today?
            </p>
            <YesNoPills value={answer} onChange={setAnswer} primary="yes" />
          </div>

          {answer === 'yes' && (
            <>
              {eggsMessages.length > 0 && (
                <BeigeAlert>{firstHint(eggsMessages)}</BeigeAlert>
              )}

              {twiceADay && (
                <Dropdown
                  id="eggs-moment"
                  label="Collection moment"
                  value={moment}
                  onChange={(v) => setMoment(v as Moment)}
                  options={[...MOMENTS]}
                />
              )}

              {!trackDamaged ? (
                <NumberKeypadInput
                  id="eggs-count"
                  label="How many eggs?"
                  description={momentDescription(moment)}
                  prefix={<Egg className="h-3 w-3" />}
                  value={eggsAll}
                  onChange={setEggsAll}
                  unit="eggs"
                />
              ) : (
                <>
                  <NumberKeypadInput
                    id="eggs-good"
                    label="Eggs in good condition"
                    description={momentDescription(moment)}
                    prefix={<Egg className="h-3 w-3" />}
                    value={eggsGood}
                    onChange={setEggsGood}
                    unit="eggs"
                  />
                  <NumberKeypadInput
                    id="eggs-bad"
                    label="Damaged eggs"
                    description="Cracked, broken or soiled"
                    prefix={<Egg className="h-3 w-3" />}
                    value={eggsBad}
                    onChange={setEggsBad}
                    unit="eggs"
                  />
                </>
              )}

              {showHigh && (
                <AnomalyWarning>
                  You entered far more eggs than usual ({fmtRange(usual!)}).
                  Double-check the figures.
                </AnomalyWarning>
              )}
              {showLow && (
                <AnomalyWarning>
                  You entered far fewer eggs than usual ({fmtRange(usual!)}).
                  Double-check the figures.
                </AnomalyWarning>
              )}

              {/* Live crates footer card (figma's dark green-on-black tile) */}
              {crates !== null && (
                <div className="rounded-xl bg-[var(--color-brand-fg)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold tracking-tight text-white/80">
                      Crates
                    </p>
                    <p className="text-[16px] font-extrabold tracking-tight text-white">
                      {crates.toFixed(1)}
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
        title="Egg collection"
      >
        <LearnMoreHeading>Keeping record of your egg collection</LearnMoreHeading>
        <p>
          Enter the eggs you collect from the birds. In the dashboard you&rsquo;ll
          find an overview of the eggs collected, the laying rate, and the
          amount of damaged eggs. The figures get translated into crates
          automatically &mdash; one crate is <strong>30 eggs</strong>.
        </p>
        <LearnMoreHeading>Eggs or crates</LearnMoreHeading>
        <p>
          Enter the eggs you collected. We&rsquo;ll show the total in crates
          underneath so you can sanity-check the figure against the eggs you
          have on the table.
        </p>
        <LearnMoreHeading>Damaged eggs</LearnMoreHeading>
        <p>
          If you split good and damaged eggs, both are kept on file but only
          the <em>good</em> count is used for the laying-rate chart on the
          dashboard. You can switch this on or off in your{' '}
          <strong>Daily record preferences</strong>.
        </p>
        <LearnMoreHeading>One or two collections a day</LearnMoreHeading>
        <p>
          You can set a preference for entering eggs once or twice a day
          (mornings and evenings) in your{' '}
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
  if (moment === 'morning') return 'Eggs collected in the morning';
  if (moment === 'evening') return 'Eggs collected in the evening';
  return 'Total eggs collected today';
}

function firstHint(messages: GuidanceMessage[]): string {
  return messages[0]?.text ?? '';
}

function fmtRange(u: { low: number; high: number }): string {
  return `${Math.round(u.low)}–${Math.round(u.high)}`;
}

function safeInt(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}
