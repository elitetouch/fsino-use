'use client';

import { useState } from 'react';
import { Syringe } from 'lucide-react';
import type {
  DailyRecordDto, DailyRecordGuidance, GuidanceMessage,
} from '@/lib/api';
import { useCreateDailyRecord, useUpdateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, NumberKeypadInput, BeigeAlert, AnomalyWarning,
  YesNoPills, EditingBanner, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import { Dropdown, FieldStack, FOCUS_INPUT } from '@/components/record/inputs';
import { EntryPicker, useEntryChoice } from '@/components/record/entry-picker';

/**
 * Step 3 — Vaccination.
 *
 * Yes/No gate at the top. If "No" and a vaccine was scheduled for
 * today (signalled by the guidance section's messages), we surface
 * the beige "Vaccination recommended" banner from the figma so the
 * user knows they're about to skip something significant.
 *
 * If "Yes" → vaccine dropdown + optional Other text + dosage in ml
 * (total for the flock, not per bird — the figma flags this in red
 * if the user types a per-bird-sized value).
 */

/**
 * Curated vaccine list — common Nigerian broiler vaccines from the
 * figma. "Other" reveals a free-text input.
 */
const VACCINES = [
  { value: 'gumboro',      label: 'Gumboro' },
  { value: 'newcastle',    label: 'Newcastle (Lasota)' },
  { value: 'infectious_bronchitis', label: 'Infectious bronchitis' },
  { value: 'fowl_pox',     label: 'Fowl pox' },
  { value: 'marek',        label: 'Marek' },
  { value: 'coccidiosis',  label: 'Coccidiosis' },
  { value: 'other',        label: 'Other (type in)' },
] as const;
type Vaccine = (typeof VACCINES)[number]['value'];

interface VaccinationStepProps {
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

export function VaccinationStep(props: VaccinationStepProps) {
  const choice = useEntryChoice(props.existingList);
  if (choice.showPicker) {
    return (
      <VaccinationPickerView
        {...props}
        pickRecord={choice.pickRecord}
        pickAddNew={choice.pickAddNew}
      />
    );
  }
  return (
    <VaccinationForm
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

function VaccinationPickerView({
  existingList, stepIndex, stepCount,
  onBack, onCancel, onSkip,
  pickRecord, pickAddNew,
}: VaccinationStepProps & {
  pickRecord: (r: DailyRecordDto) => void;
  pickAddNew: () => void;
}) {
  return (
    <StepShell
      sectionIcon={<Syringe className="h-3.5 w-3.5" />}
      sectionLabel="Vaccination"
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
        eventLabel="vaccination"
        entries={existingList}
        summary={(r) => {
          const p = (r.payload ?? {}) as Record<string, unknown>;
          const vname = typeof p.vaccine_name === 'string' ? p.vaccine_name : 'Unknown vaccine';
          const dose = r.quantity != null ? ` · ${r.quantity} ml` : '';
          return `${vname}${dose}`;
        }}
        onSelect={pickRecord}
        onAddAnother={pickAddNew}
        totalLine={`${existingList.length} ${existingList.length === 1 ? 'vaccination' : 'vaccinations'} logged today`}
      />
    </StepShell>
  );
}

function VaccinationForm({
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

  // EDIT pre-fill — if there's an existing row, the user must have
  // answered Yes when they originally logged it. Pull vaccine name
  // from payload.vaccine_name; if it matches one of our known values
  // we restore that, otherwise it becomes 'other' with the original
  // string in the free-text field.
  const existingVaccineName = existing?.payload
    && typeof (existing.payload as Record<string, unknown>).vaccine_name === 'string'
      ? String((existing.payload as Record<string, unknown>).vaccine_name)
      : '';
  const matchingVaccine = VACCINES.find((v) => v.label === existingVaccineName)?.value
    ?? (existingVaccineName ? 'other' as Vaccine : '');

  // Default to Yes — the most likely answer on a day the user opened
  // this step. The figma's note: "By default Yes is selected."
  const [answer, setAnswer] = useState<'yes' | 'no'>(editing ? 'yes' : 'yes');
  const [vaccine, setVaccine] = useState<Vaccine | ''>(matchingVaccine);
  const [otherVaccine, setOtherVaccine] = useState(matchingVaccine === 'other' ? existingVaccineName : '');
  const [dosage, setDosage] = useState(existing?.quantity != null ? String(existing.quantity) : '');

  const dosageNumeric = parseFloat(dosage);
  const dosageValid = !isNaN(dosageNumeric) && dosageNumeric > 0;
  const vaccineValid = vaccine !== '' && (vaccine !== 'other' || otherVaccine.trim().length > 0);
  const yesValid = vaccineValid && dosageValid;
  const isValid = answer === 'no' || yesValid;

  // Scheduled-today signal — surfaced by the guidance service via
  // `messages[].code` like 'vaccination.scheduled_today'. We don't
  // hard-code the code; any message in the vaccination section is
  // worth surfacing. The mobile figma's example: "According to the
  // vaccination record your flock should receive Gumboro today."
  const vacMessages = guidance.sections.vaccination.messages;
  const hasSchedule = vacMessages.length > 0;

  // Per-flock dosage warning — if the user typed something tiny like
  // 1 ml on a 500-bird flock, that's almost certainly per-bird, not
  // total. The figma flags this with red "Are you sure?" text.
  const livingBirds = guidance.flock.current_birds;
  const isLikelyPerBird =
    dosageValid && livingBirds > 100 && dosageNumeric < livingBirds * 0.05; // < 0.05 ml/bird is too low

  const pending = createRecord.isPending || updateRecord.isPending;
  const submit = () => {
    if (!isValid || pending) return;
    if (answer === 'no') {
      // Don't post anything — just advance. In ADD mode this is a
      // proper opt-out. In EDIT mode we currently leave the existing
      // row untouched (the backend doesn't expose DELETE), so the
      // user can only modify Yes-rows or skip.
      onContinue();
      return;
    }
    const finalVaccine = vaccine === 'other' ? otherVaccine.trim() : labelForVaccine(vaccine as Vaccine);
    if (editing && existing) {
      updateRecord.mutate(
        {
          recordId: existing.id,
          payload: {
            quantity: dosageNumeric,
            unit: 'ml',
            payload: {
              vaccine_name: finalVaccine,
            },
          },
        },
        { onSuccess: onContinue },
      );
      return;
    }
    createRecord.mutate(
      {
        event_type: 'vaccination',
        record_date: recordDate,
        quantity: dosageNumeric,
        unit: 'ml',
        payload: {
          vaccine_name: finalVaccine,
        },
      },
      { onSuccess: onContinue },
    );
  };

  return (
    <>
      <StepShell
        sectionIcon={<Syringe className="h-3.5 w-3.5" />}
        sectionLabel="Vaccination"
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
              Did you vaccinate today?
            </p>
            <YesNoPills value={answer} onChange={setAnswer} primary="yes" />
          </div>

          {/* "No" branch — show schedule reminder if there is one */}
          {answer === 'no' && hasSchedule && (
            <BeigeAlert title="Vaccination recommended">
              {firstHint(vacMessages)} Provide the vaccine and update your
              record, or press <strong>Continue</strong> to proceed without
              vaccinating today.
            </BeigeAlert>
          )}

          {/* "Yes" branch — vaccine + dosage */}
          {answer === 'yes' && (
            <>
              <Dropdown
                id="vaccine-type"
                label="Vaccination type"
                value={vaccine}
                onChange={(v) => setVaccine(v as Vaccine)}
                options={[...VACCINES]}
                placeholder="Select vaccine"
              />

              {vaccine === 'other' && (
                <div>
                  <label htmlFor="other-vaccine" className="mb-1.5 block text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
                    Vaccine name
                    <span className="ml-2 font-normal text-[11px] text-[var(--color-brand-muted)]">
                      Describe the vaccine
                    </span>
                  </label>
                  <input
                    id="other-vaccine"
                    type="text"
                    value={otherVaccine}
                    onChange={(e) => setOtherVaccine(e.target.value)}
                    placeholder="Type the vaccine name"
                    className={`h-11 w-full rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--color-brand-fg)] ${FOCUS_INPUT}`}
                    autoFocus
                  />
                </div>
              )}

              <div>
                <NumberKeypadInput
                  id="vaccine-dosage"
                  label="Dosage"
                  description="Total amount for flock"
                  prefix={<Syringe className="h-3 w-3" />}
                  value={dosage}
                  onChange={setDosage}
                  unit="ml"
                />
                {isLikelyPerBird && (
                  <AnomalyWarning>
                    You should enter the total amount you give to your entire flock
                    ({livingBirds.toLocaleString()} birds), not the per-bird dose.
                  </AnomalyWarning>
                )}
              </div>
            </>
          )}
        </FieldStack>
      </StepShell>

      <LearnMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Vaccination"
      >
        <LearnMoreHeading>Keeping record of vaccines</LearnMoreHeading>
        <p>
          Enter the vaccines you give to the birds. In the dashboard you&rsquo;ll
          find a <strong>medical record of the vaccines</strong> you&rsquo;ve given
          to your birds. It also shows suggestions for the next vaccinations as
          recommended by expert veterinarians in Nigeria.
        </p>
        <LearnMoreHeading>Vaccine type</LearnMoreHeading>
        <p>
          Select the type of vaccine you&rsquo;ve given the birds in this pen. Pick
          <strong> Other</strong> to type a vaccine name we haven&rsquo;t predefined.
        </p>
        <LearnMoreHeading>Dosage</LearnMoreHeading>
        <p>
          Enter the <strong>total dosage</strong> provided to the entire flock,
          not the dosage per bird. If you type a value that looks like a
          per-bird dose, we&rsquo;ll flag it in red.
        </p>
      </LearnMoreDrawer>
    </>
  );
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function labelForVaccine(value: Vaccine): string {
  return VACCINES.find((v) => v.value === value)?.label ?? value;
}

function firstHint(messages: GuidanceMessage[]): string {
  return messages[0]?.text ?? '';
}
