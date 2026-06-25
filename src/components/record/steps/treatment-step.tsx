'use client';

import { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import type { DailyRecordDto, DailyRecordGuidance } from '@/lib/api';
import { useCreateDailyRecord, useUpdateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell,
  YesNoPills, EditingBanner, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import {
  Dropdown, FieldStack, FOCUS_INPUT, FOCUS_WRAPPER,
} from '@/components/record/inputs';
import { EntryPicker, useEntryChoice } from '@/components/record/entry-picker';
import { cn } from '@/lib/utils';

/**
 * Step 4 — Treatment (antibiotics, antifungals, supplements).
 *
 * Yes/No gate. If Yes: how-many-birds + type + reason.
 *
 * The "All birds" pill next to the count is a quick-fill that sets
 * the value to the flock's current living-bird count. This stops
 * users from manually typing a number like 1,000 when the flock only
 * has 997 — a frequent source of the "Too many birds" hard error
 * (figma's red text: "You have only 997 living birds in this pen.
 * Select 'All birds' in case you wish to select all of them").
 */

const TREATMENT_TYPES = [
  { value: 'anti_biotics',  label: 'Anti-biotics' },
  { value: 'anti_fungals',  label: 'Anti-fungals' },
  { value: 'anti_virals',   label: 'Anti-virals' },
  { value: 'dewormer',      label: 'Dewormer' },
  { value: 'multivitamins', label: 'Multivitamins' },
  { value: 'probiotics',    label: 'Probiotics' },
  { value: 'other',         label: 'Other (type in)' },
] as const;
type TreatmentType = (typeof TREATMENT_TYPES)[number]['value'];

const REASONS = [
  { value: 'prophylactic',   label: 'Prophylactic / routine' },
  { value: 'respiratory',    label: 'Respiratory illness' },
  { value: 'digestive',      label: 'Digestive illness' },
  { value: 'parasites',      label: 'Internal / external parasites' },
  { value: 'stress',         label: 'Stress (heat, transport, etc.)' },
  { value: 'post_vaccine',   label: 'Post-vaccine support' },
  { value: 'other',          label: 'Other (type in)' },
] as const;
type Reason = (typeof REASONS)[number]['value'];

interface TreatmentStepProps {
  flockId: string;
  recordDate: string;
  guidance: DailyRecordGuidance;
  existingList: DailyRecordDto[];
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function TreatmentStep(props: TreatmentStepProps) {
  // Treatments are inherently multi-entry per day — a flock may need
  // two different treatments on the same day (e.g. antibiotic +
  // dewormer). See vaccination-step.tsx for the same rationale.
  const choice = useEntryChoice(props.existingList, { allowMultiplePerDay: true });
  if (choice.showPicker) {
    return (
      <TreatmentPickerView
        {...props}
        pickRecord={choice.pickRecord}
        pickAddNew={choice.pickAddNew}
      />
    );
  }
  return (
    <TreatmentForm
      key={choice.formKey}
      flockId={props.flockId}
      recordDate={props.recordDate}
      guidance={props.guidance}
      existing={choice.existing}
      onSwitchEntry={props.existingList.length >= 2 ? choice.goToPicker : undefined}
      stepIndex={props.stepIndex}
      stepCount={props.stepCount}
      onBack={props.onBack}
      onCancel={props.onCancel}
      onContinue={props.onContinue}
      onSkip={props.onSkip}
    />
  );
}

function TreatmentPickerView({
  existingList, stepIndex, stepCount,
  onBack, onCancel, onSkip,
  pickRecord, pickAddNew,
}: TreatmentStepProps & {
  pickRecord: (r: DailyRecordDto) => void;
  pickAddNew: () => void;
}) {
  return (
    <StepShell
      sectionIcon={<Stethoscope className="h-3.5 w-3.5" />}
      sectionLabel="Treatment"
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
        eventLabel="treatment"
        entries={existingList}
        summary={(r) => {
          const p = (r.payload ?? {}) as Record<string, unknown>;
          const type = typeof p.treatment_type === 'string' ? p.treatment_type : 'Treatment';
          const birds = typeof p.birds_affected === 'number'
            ? `${p.birds_affected.toLocaleString()} birds`
            : '';
          const reason = typeof p.reason === 'string' ? p.reason : '';
          return [type, birds, reason].filter(Boolean).join(' · ');
        }}
        onSelect={pickRecord}
        onAddAnother={pickAddNew}
        totalLine={`${existingList.length} ${existingList.length === 1 ? 'treatment' : 'treatments'} logged today`}
      />
    </StepShell>
  );
}

function TreatmentForm({
  flockId,
  recordDate,
  guidance,
  existing,
  onSwitchEntry,
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
  existing?: DailyRecordDto;
  onSwitchEntry?: () => void;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRecord = useCreateDailyRecord(flockId);
  const updateRecord = useUpdateDailyRecord(flockId);
  const editing = !!existing;

  // EDIT pre-fill — recover from payload. Treatment type and reason
  // could be either matching value or free-text Other; we try to
  // match against the curated lists first.
  const existingPayload = (existing?.payload ?? {}) as Record<string, unknown>;
  const existingBirds = typeof existingPayload.birds_affected === 'number'
    ? existingPayload.birds_affected
    : null;
  const existingAllBirds = existingPayload.all_birds === true;
  const existingTypeLabel = typeof existingPayload.treatment_type === 'string'
    ? existingPayload.treatment_type : '';
  const existingReasonLabel = typeof existingPayload.reason === 'string'
    ? existingPayload.reason : '';
  const matchingType = TREATMENT_TYPES.find((t) => t.label === existingTypeLabel)?.value
    ?? (existingTypeLabel ? 'other' as TreatmentType : '');
  const matchingReason = REASONS.find((r) => r.label === existingReasonLabel)?.value
    ?? (existingReasonLabel ? 'other' as Reason : '');

  const [answer, setAnswer] = useState<'yes' | 'no'>('yes');
  const [birds, setBirds] = useState(existingBirds != null ? String(existingBirds) : '');
  const [allBirds, setAllBirds] = useState(existingAllBirds);
  const [type, setType] = useState<TreatmentType | ''>(matchingType);
  const [otherType, setOtherType] = useState(matchingType === 'other' ? existingTypeLabel : '');
  const [reason, setReason] = useState<Reason | ''>(matchingReason);
  const [otherReason, setOtherReason] = useState(matchingReason === 'other' ? existingReasonLabel : '');

  const livingBirds = guidance.flock.current_birds;
  const birdsNumeric = allBirds ? livingBirds : parseInt(birds, 10);
  const birdsValid = !isNaN(birdsNumeric) && birdsNumeric > 0;
  const tooMany = birdsValid && birdsNumeric > livingBirds;
  const typeValid = type !== '' && (type !== 'other' || otherType.trim().length > 0);
  const reasonValid = reason !== '' && (reason !== 'other' || otherReason.trim().length > 0);
  const yesValid = birdsValid && !tooMany && typeValid && reasonValid;
  const isValid = answer === 'no' || yesValid;

  // Toggle "All birds" → pre-fill / clear the input.
  const pickAllBirds = () => {
    if (allBirds) {
      setAllBirds(false);
      setBirds('');
    } else {
      setAllBirds(true);
      setBirds(String(livingBirds));
    }
  };

  // Manually editing the count clears the All-birds flag.
  const onBirdsChange = (v: string) => {
    setAllBirds(false);
    setBirds(v.replace(/[^\d]/g, '')); // integers only
  };

  const pending = createRecord.isPending || updateRecord.isPending;
  const submit = () => {
    if (!isValid || pending) return;
    if (answer === 'no') {
      onContinue();
      return;
    }
    const finalType = type === 'other' ? otherType.trim() : labelForType(type as TreatmentType);
    const finalReason = reason === 'other' ? otherReason.trim() : labelForReason(reason as Reason);
    const payload = {
      birds_affected: birdsNumeric,
      treatment_type: finalType,
      reason: finalReason,
      all_birds: allBirds,
    };
    if (editing && existing) {
      updateRecord.mutate(
        { recordId: existing.id, payload: { payload } },
        { onSuccess: onContinue },
      );
      return;
    }
    createRecord.mutate(
      {
        event_type: 'treatment',
        record_date: recordDate,
        payload,
      },
      { onSuccess: onContinue },
    );
  };

  return (
    <>
      <StepShell
        sectionIcon={<Stethoscope className="h-3.5 w-3.5" />}
        sectionLabel="Treatment"
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
        continueLabel={editing && answer === 'yes' ? 'Save changes' : 'Continue'}
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
              Did you treat any birds today?
            </p>
            <YesNoPills value={answer} onChange={setAnswer} primary="yes" />
          </div>

          {answer === 'yes' && (
            <>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="treat-count" className="text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
                    How many?
                  </label>
                  <span className="text-[11px] text-[var(--color-brand-muted)]">
                    Enter how many or select all birds
                  </span>
                </div>
                <div className="flex items-stretch gap-2">
                  <div className="flex-1">
                    <div className={cn(
                      'flex h-11 items-center gap-2 rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3',
                      FOCUS_WRAPPER,
                    )}>
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
                        <Stethoscope className="h-3 w-3" />
                      </span>
                      <input
                        id="treat-count"
                        type="text"
                        inputMode="numeric"
                        value={birds}
                        onChange={(e) => onBirdsChange(e.target.value)}
                        placeholder="0"
                        className="min-w-0 flex-1 bg-transparent text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)] outline-none placeholder:font-normal placeholder:text-[var(--color-brand-muted-soft)]"
                      />
                      <span className="shrink-0 text-[12.5px] font-semibold text-[var(--color-brand-muted)]">
                        birds
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={pickAllBirds}
                    className={cn(
                      'h-11 shrink-0 rounded-lg border px-4 text-[12.5px] font-bold tracking-tight transition-colors',
                      allBirds
                        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white'
                        : 'border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-fg)] hover:border-[var(--color-brand-primary)]/40',
                    )}
                  >
                    All birds
                  </button>
                </div>
                {tooMany && (
                  <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--color-brand-danger)]">
                    Too many birds. You have only {livingBirds.toLocaleString()} living birds
                    in this pen. Select <strong>All birds</strong> if you want to select all of them.
                  </p>
                )}
              </div>

              <Dropdown
                id="treat-type"
                label="Treatment type"
                value={type}
                onChange={(v) => setType(v as TreatmentType)}
                options={[...TREATMENT_TYPES]}
                placeholder="Select treatment type"
              />
              {type === 'other' && (
                <input
                  type="text"
                  value={otherType}
                  onChange={(e) => setOtherType(e.target.value)}
                  placeholder="Type the treatment"
                  className={`h-11 w-full rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--color-brand-fg)] ${FOCUS_INPUT}`}
                />
              )}

              <Dropdown
                id="treat-reason"
                label="Reason for treatment"
                value={reason}
                onChange={(v) => setReason(v as Reason)}
                options={[...REASONS]}
                placeholder="Select reason"
              />
              {reason === 'other' && (
                <input
                  type="text"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Type the reason"
                  className={`h-11 w-full rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--color-brand-fg)] ${FOCUS_INPUT}`}
                />
              )}
            </>
          )}
        </FieldStack>
      </StepShell>

      <LearnMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Treatment"
      >
        <LearnMoreHeading>Keeping record of treatments</LearnMoreHeading>
        <p>
          Enter the treatment you give to the birds. In the dashboard you&rsquo;ll
          find a <strong>medical record of the treatments</strong> you&rsquo;ve given
          to your birds.
        </p>
        <LearnMoreHeading>Amount of birds</LearnMoreHeading>
        <p>
          You can enter the number of birds you gave a treatment to. Tap on
          <strong> All birds</strong> if you&rsquo;ve given treatment to your
          entire flock — it pre-fills the count from the living-bird tally so
          you can&rsquo;t accidentally enter more birds than you have.
        </p>
        <LearnMoreHeading>Treatment type and reason</LearnMoreHeading>
        <p>
          Select the treatment type and the reason for treatment. This will
          help you keep track of the health of your flock.
        </p>
      </LearnMoreDrawer>
    </>
  );
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function labelForType(v: TreatmentType): string {
  return TREATMENT_TYPES.find((t) => t.value === v)?.label ?? v;
}

function labelForReason(v: Reason): string {
  return REASONS.find((r) => r.value === v)?.label ?? v;
}
