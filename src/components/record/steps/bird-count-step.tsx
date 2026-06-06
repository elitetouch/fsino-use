'use client';

import { useMemo, useState } from 'react';
import { Bird } from 'lucide-react';
import type { DailyRecordDto, DailyRecordGuidance, MyPreferencesDto } from '@/lib/api';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, BeigeAlert, AnomalyWarning,
  YesNoPills, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import { FieldStack, FOCUS_WRAPPER } from '@/components/record/inputs';
import { EntryPicker, useEntryChoice } from '@/components/record/entry-picker';
import { cn } from '@/lib/utils';

/**
 * Step 5 — Bird count (mortality/sales/culls/losses).
 *
 * "Any dead, culled, sold or lost birds today?" Yes/No (default No).
 *
 * NO path: show the "keep a correct count" beige banner referencing
 * the last entry from guidance + the running living-birds total. One
 * tap → Continue moves on without saving.
 *
 * YES path: 4 inputs (Sold / Dead / Culled / Lost), only those the
 * user has enabled in preferences (so a farmer who's only tracking
 * mortality won't see Sold/Lost). Below the inputs, a live "Total
 * bird count" recalculates current_birds − Σ as the user types. If
 * the sum exceeds living birds we red-flag it (matches the figma's
 * hard cap).
 *
 * On save: payload.anyChange=true so the backend's bird-math
 * invariant kicks in. Backend updates flock.current_birds atomically.
 */

type Field = 'sold' | 'dead' | 'culled' | 'lost';

const FIELDS: Array<{
  key: Field;
  label: string;
  desc: string;
  prefKey: keyof NonNullable<MyPreferencesDto['effectiveDailyRecord']['bird_count']>;
}> = [
  { key: 'sold',   label: 'Sold',   desc: 'Enter how many birds sold',   prefKey: 'sold' },
  { key: 'dead',   label: 'Dead',   desc: 'Enter how many birds died',   prefKey: 'dead' },
  { key: 'culled', label: 'Culled', desc: 'Enter how many birds were culled', prefKey: 'culled' },
  { key: 'lost',   label: 'Lost',   desc: 'Enter how many birds were lost', prefKey: 'lost' },
];

interface BirdCountStepProps {
  flockId: string;
  recordDate: string;
  guidance: DailyRecordGuidance;
  prefs: MyPreferencesDto;
  existingList: DailyRecordDto[];
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function BirdCountStep(props: BirdCountStepProps) {
  const choice = useEntryChoice(props.existingList);
  if (choice.showPicker) {
    return (
      <BirdCountPickerView
        {...props}
        pickRecord={choice.pickRecord}
        pickAddNew={choice.pickAddNew}
      />
    );
  }
  return (
    <BirdCountForm
      key={choice.formKey}
      flockId={props.flockId}
      recordDate={props.recordDate}
      guidance={props.guidance}
      prefs={props.prefs}
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

function BirdCountPickerView({
  existingList, stepIndex, stepCount,
  onBack, onCancel, onSkip,
  pickRecord, pickAddNew,
}: BirdCountStepProps & {
  pickRecord: (r: DailyRecordDto) => void;
  pickAddNew: () => void;
}) {
  // Sum of every entry's totalOut — gives the user a sense of the
  // day's total reduction across all rows.
  const dayTotalOut = existingList.reduce((s, r) => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    return s + readCount(p, 'sold') + readCount(p, 'dead')
      + readCount(p, 'culled') + readCount(p, 'lost');
  }, 0);
  return (
    <StepShell
      sectionIcon={<Bird className="h-3.5 w-3.5" />}
      sectionLabel="Bird count"
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
        eventLabel="bird-count entry"
        entries={existingList}
        summary={(r) => {
          const p = (r.payload ?? {}) as Record<string, unknown>;
          const sold = readCount(p, 'sold');
          const dead = readCount(p, 'dead');
          const culled = readCount(p, 'culled');
          const lost = readCount(p, 'lost');
          const out = sold + dead + culled + lost;
          const bits: string[] = [];
          if (sold > 0) bits.push(`${sold} sold`);
          if (dead > 0) bits.push(`${dead} dead`);
          if (culled > 0) bits.push(`${culled} culled`);
          if (lost > 0) bits.push(`${lost} lost`);
          return bits.length > 0 ? `${out} total · ${bits.join(', ')}` : 'No reductions';
        }}
        onSelect={pickRecord}
        onAddAnother={pickAddNew}
        totalLine={`Today's total reductions: ${dayTotalOut.toLocaleString()} birds across ${existingList.length} entries`}
      />
    </StepShell>
  );
}

function BirdCountForm({
  flockId,
  recordDate,
  guidance,
  prefs,
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
  prefs: MyPreferencesDto;
  existing?: DailyRecordDto;
  onSwitchEntry?: () => void;
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const editing = !!existing;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRecord = useCreateDailyRecord(flockId);

  // Default to No — figma's note: "Default state should be No so users
  // can continue quickly".
  const [answer, setAnswer] = useState<'yes' | 'no'>('no');
  const [counts, setCounts] = useState<Record<Field, string>>({
    sold: '', dead: '', culled: '', lost: '',
  });

  const livingBirds = guidance.flock.current_birds;
  const enabledFields = useMemo(
    () => FIELDS.filter((f) => prefs.effectiveDailyRecord.bird_count?.[f.prefKey]),
    [prefs.effectiveDailyRecord.bird_count],
  );

  const totalOut = enabledFields.reduce(
    (s, f) => s + safeInt(counts[f.key]),
    0,
  );
  const totalAfter = livingBirds - totalOut;
  const overBudget = totalAfter < 0;
  const yesValid = totalOut > 0 && !overBudget;
  const isValid = answer === 'no' || yesValid;

  // Soft anomaly — sudden spike vs the 14-day mortality rate.
  const usualMortality = guidance.sections.bird_count.usual_quantity?.high ?? null;
  const todayMortality = safeInt(counts.dead) + safeInt(counts.culled);
  const mortalitySpike = usualMortality !== null && todayMortality > usualMortality * 2;

  const onCountChange = (key: Field, v: string) => {
    setCounts((c) => ({ ...c, [key]: v.replace(/[^\d]/g, '') }));
  };

  const submit = () => {
    if (!isValid || createRecord.isPending) return;
    if (answer === 'no') {
      onContinue();
      return;
    }
    createRecord.mutate(
      {
        event_type: 'bird_count',
        record_date: recordDate,
        payload: {
          anyChange: true,
          sold:   { count: safeInt(counts.sold)   },
          dead:   { count: safeInt(counts.dead)   },
          culled: { count: safeInt(counts.culled) },
          lost:   { count: safeInt(counts.lost)   },
        },
      },
      { onSuccess: onContinue },
    );
  };

  // Beige banner copy for the "No" branch — references the last entry
  // from guidance ("[n] days ago you currently have [x] birds…").
  const lastEntryDays = (guidance.sections.bird_count.last_entry?.days_ago as number | undefined) ?? null;

  return (
    <>
      <StepShell
        sectionIcon={<Bird className="h-3.5 w-3.5" />}
        sectionLabel="Bird count"
        stepIndex={stepIndex}
        stepCount={stepCount}
        editing={editing}
        onBack={onBack}
        onCancel={onCancel}
        onLearnMore={() => setDrawerOpen(true)}
        onSkip={editing ? undefined : onSkip}
        onContinue={editing ? onContinue : submit}
        continueDisabled={!editing && !isValid}
        continuePending={!editing && createRecord.isPending}
        continueLabel={editing ? 'Continue' : 'Continue'}
      >
        <FieldStack>
          {/*
            EDIT mode — read-only summary.
            Bird-count payload counts are frozen on PATCH so the
            running flock.current_birds tally stays coherent. Show
            what was logged and let the user move on; if they need
            to correct the numbers, the figma's design says "log a
            fresh bird_count entry" — the same record_date can hold
            a second row.
          */}
          {editing && (
            <BirdCountEditView
              record={existing!}
              livingBirds={livingBirds}
              onSwitchEntry={onSwitchEntry}
            />
          )}

          {!editing && (
            <div>
              <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
                Any dead, culled, sold or lost birds today?
              </p>
              <YesNoPills value={answer} onChange={setAnswer} primary="no" />
            </div>
          )}

          {/* "No" branch */}
          {!editing && answer === 'no' && (
            <BeigeAlert title="Keep a correct count of birds">
              {lastEntryDays !== null ? (
                <>
                  According to your last entry <strong>{lastEntryDays} day{lastEntryDays === 1 ? '' : 's'} ago</strong>{' '}
                  you currently have <strong>{livingBirds.toLocaleString()} birds</strong> in the pen.
                  Tap Continue to keep this count, or pick Yes if anything changed today.
                </>
              ) : (
                <>
                  You currently have <strong>{livingBirds.toLocaleString()} birds</strong> in this pen.
                  Tap Continue to keep this count, or pick Yes if anything changed today.
                </>
              )}
            </BeigeAlert>
          )}

          {/* "Yes" branch — the enabled count inputs + live total */}
          {!editing && answer === 'yes' && (
            <>
              {enabledFields.map((f) => (
                <CountField
                  key={f.key}
                  label={f.label}
                  desc={f.desc}
                  value={counts[f.key]}
                  onChange={(v) => onCountChange(f.key, v)}
                />
              ))}

              {mortalitySpike && (
                <AnomalyWarning>
                  You&rsquo;ve entered far more cases of mortality than usual. We
                  recommend you consult a veterinarian.
                </AnomalyWarning>
              )}

              <div
                className={cn(
                  'rounded-xl border px-4 py-3 transition-colors',
                  overBudget
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
                    Total bird count
                  </p>
                  <p className={cn(
                    'text-[15px] font-extrabold tracking-tight',
                    overBudget ? 'text-rose-700' : 'text-[var(--color-brand-fg)]',
                  )}>
                    {Math.max(totalAfter, 0).toLocaleString()}
                  </p>
                </div>
                {overBudget && (
                  <p className="mt-1 text-[11.5px] leading-snug text-rose-700">
                    You only have <strong>{livingBirds.toLocaleString()}</strong> birds available
                    but you entered <strong>{totalOut.toLocaleString()}</strong> total reductions.
                    Please give the accurate numbers.
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
        title="Bird count"
      >
        <LearnMoreHeading>Keeping record of the bird count</LearnMoreHeading>
        <p>
          Enter the number of birds you have sold, that have died, were culled
          or got lost. This way you can keep track of the number of birds left
          in your pen. You&rsquo;ll find an overview of the bird count as well as
          the mortality rate in the dashboard.
        </p>
        <LearnMoreHeading>Birds sold</LearnMoreHeading>
        <p>Enter how many birds were sold.</p>
        <LearnMoreHeading>Birds dead or culled</LearnMoreHeading>
        <p>
          Enter how many birds have died. This way you can keep a clear record
          of what caused the mortality and prevent further cases. If you like,
          you can set your{' '}
          <strong>Daily record preferences</strong> so that you can also
          capture the cause of death or culling.
        </p>
        <LearnMoreHeading>Birds lost</LearnMoreHeading>
        <p>Enter how many birds were lost.</p>
      </LearnMoreDrawer>
    </>
  );
}

/* ================================================================== */
/*  Helpers + sub-components                                           */
/* ================================================================== */

function CountField({
  label, desc, value, onChange,
}: {
  label: string;
  desc: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          {label}
        </label>
        <span className="text-[11px] text-[var(--color-brand-muted)]">{desc}</span>
      </div>
      <div className={cn(
        'flex h-11 items-center gap-2 rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3',
        FOCUS_WRAPPER,
      )}>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)] outline-none placeholder:font-normal placeholder:text-[var(--color-brand-muted-soft)]"
        />
        <span className="shrink-0 text-[12.5px] font-semibold text-[var(--color-brand-muted)]">
          birds
        </span>
      </div>
    </div>
  );
}

function safeInt(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Read-only view of an existing bird_count row for EDIT mode.
 *
 * The backend's UpdateFlockDailyRecordRequest freezes bird-count
 * payload counts, so we can't safely let the user retype them — a
 * silent drift between the row and flock.current_birds would
 * compound across cycles. Instead, we show what was logged and
 * direct them to log a fresh bird_count if a correction is needed
 * (multiple rows on the same date are allowed).
 */
function BirdCountEditView({
  record,
  livingBirds,
  onSwitchEntry,
}: {
  record: DailyRecordDto;
  livingBirds: number;
  /** When the day has 2+ bird-count rows, lets the user go back to the picker. */
  onSwitchEntry?: () => void;
}) {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const counts = {
    sold:   readCount(payload, 'sold'),
    dead:   readCount(payload, 'dead'),
    culled: readCount(payload, 'culled'),
    lost:   readCount(payload, 'lost'),
  };
  const totalOut = counts.sold + counts.dead + counts.culled + counts.lost;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--color-brand-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-4 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">
            Logged for this day
          </p>
          {onSwitchEntry && (
            <button
              type="button"
              onClick={onSwitchEntry}
              className="text-[11px] font-bold tracking-tight text-[var(--color-brand-primary-deep)] underline-offset-2 hover:underline"
            >
              Pick a different entry
            </button>
          )}
        </div>
        <dl className="divide-y divide-[var(--color-brand-border)]">
          <Stat label="Sold"   value={counts.sold} />
          <Stat label="Dead"   value={counts.dead} />
          <Stat label="Culled" value={counts.culled} />
          <Stat label="Lost"   value={counts.lost} />
          <Stat label="Total out" value={totalOut} bold />
          <Stat label="Birds remaining" value={livingBirds} bold />
        </dl>
      </div>

      <BeigeAlert title="Counts can't be edited">
        Bird-count totals are frozen once saved — editing them would
        let the running flock count drift. If today&rsquo;s figures are
        wrong, tap Cancel and log a <strong>fresh bird-count entry</strong>{' '}
        on this same date. Multiple rows on one day are allowed.
      </BeigeAlert>
    </div>
  );
}

function Stat({
  label, value, bold,
}: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className={cn(
        'text-[12.5px] text-[var(--color-brand-fg-soft)]',
        bold && 'font-bold text-[var(--color-brand-fg)]',
      )}>
        {label}
      </dt>
      <dd className={cn(
        'text-[13.5px] font-semibold tracking-tight text-[var(--color-brand-fg)]',
        bold && 'text-[15px] font-extrabold',
      )}>
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function readCount(payload: Record<string, unknown>, key: string): number {
  const section = payload[key];
  if (section && typeof section === 'object') {
    const c = (section as Record<string, unknown>).count;
    if (typeof c === 'number') return c;
    if (typeof c === 'string') {
      const n = parseInt(c, 10);
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}
