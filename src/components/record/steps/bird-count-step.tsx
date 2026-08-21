'use client';

import { useMemo, useState } from 'react';
import { Bird, Loader2, Pencil } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage, endpoints, type DailyRecordDto, type DailyRecordGuidance, type MyPreferencesDto } from '@/lib/api';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import { usePermissions } from '@/lib/access';
import { Button } from '@/components/ui/button';
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

  // What the sold birds went for. Optional — a farmer who hasn't been
  // paid yet, or who doesn't know the figure at logging time, must still
  // be able to record that the birds left the pen.
  //
  // Capturing it HERE is the fix for a real production bug: this step
  // was the only way most farmers recorded sales, it had no money field
  // at all, and so a flock that sold 588 birds reported NGN 0 revenue
  // and a -NGN 16.2M margin on its cycle P&L. Leaving it blank is still
  // supported and now shows up honestly as an incomplete margin rather
  // than a fake loss.
  const [soldAmount, setSoldAmount] = useState('');

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
          // `amount` is only attached when the farmer actually entered
          // one. Omitting the key entirely (rather than writing 0) is
          // what lets the backend tell "sold for nothing" apart from
          // "price not captured yet" — the latter is what drives the
          // incomplete-margin disclosure on the P&L.
          sold: {
            count: safeInt(counts.sold),
            ...(safeInt(counts.sold) > 0 && parseFloat(soldAmount) > 0
              ? { amount: parseFloat(soldAmount) }
              : {}),
          },
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
        // Void support — shell renders a "Void this entry" link in edit
        // mode. Backend enforces the role gate. Post-void we cancel the
        // wizard because the row it was showing no longer exists.
        voidableRecord={existing ?? null}
        voidFlockId={flockId}
        onVoided={onCancel}
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
              flockId={flockId}
              record={existing!}
              livingBirds={livingBirds}
              onSwitchEntry={onSwitchEntry}
              onSaved={onContinue}
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

              {/* Sale amount — only asked once birds are actually marked
                  sold, so a farmer logging pure mortality never sees a
                  money question. Optional by design: birds leaving the pen
                  is a fact, the price may not be known yet. */}
              {safeInt(counts.sold) > 0 && (
                <SoldAmountField
                  value={soldAmount}
                  onChange={setSoldAmount}
                  birds={safeInt(counts.sold)}
                />
              )}

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

/**
 * Optional "what did they sell for?" input, shown only when the Sold
 * count is above zero.
 *
 * Deliberately NOT required. A farmer who sold on credit, or who is
 * logging the day's movement before settling up, must still be able to
 * record that the birds left the pen. When it's left blank the cycle
 * P&L reports the margin as incomplete rather than inventing a figure
 * or silently reporting the sale as zero revenue.
 */
function SoldAmountField({
  value, onChange, birds,
}: {
  value: string;
  onChange: (v: string) => void;
  birds: number;
}) {
  const amount = parseFloat(value || '0') || 0;
  const perBird = birds > 0 && amount > 0 ? amount / birds : null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          Total sale amount <span className="font-normal text-[var(--color-brand-muted)]">(optional)</span>
        </label>
        <span className="text-[11px] text-[var(--color-brand-muted)]">
          What you were paid for {birds.toLocaleString()} {birds === 1 ? 'bird' : 'birds'}
        </span>
      </div>
      <div className={cn(
        'flex h-11 items-center gap-2 rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3',
        FOCUS_WRAPPER,
      )}>
        <span className="shrink-0 text-[13px] font-semibold text-[var(--color-brand-muted)]">₦</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          // Digits and a single decimal point only — keeps the value
          // parseable server-side without a validation round-trip.
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)] outline-none placeholder:font-normal placeholder:text-[var(--color-brand-muted-soft)]"
        />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-[var(--color-brand-muted)]">
        {perBird !== null ? (
          <>
            About <strong>₦{perBird.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> per bird.
          </>
        ) : (
          'Leave blank if you don’t know yet — your cycle profit will show as incomplete until you add it.'
        )}
      </p>
    </div>
  );
}

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
  flockId,
  record,
  livingBirds,
  onSwitchEntry,
  onSaved,
}: {
  flockId: string;
  record: DailyRecordDto;
  livingBirds: number;
  /** When the day has 2+ bird-count rows, lets the user go back to the picker. */
  onSwitchEntry?: () => void;
  /** Called after a successful in-place edit so the wizard can continue. */
  onSaved: () => void;
}) {
  const perms = usePermissions();
  const qc = useQueryClient();
  const canEditCounts = perms.isOwner || perms.isManager;

  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const originalCounts = {
    sold:   readCount(payload, 'sold'),
    dead:   readCount(payload, 'dead'),
    culled: readCount(payload, 'culled'),
    lost:   readCount(payload, 'lost'),
  };
  const originalTotal = originalCounts.sold + originalCounts.dead + originalCounts.culled + originalCounts.lost;

  // Owner / manager EDIT mode. Staff never gets to flip this true — the
  // backend enforces the same restriction, so any UI toggle would still
  // fail. Default false so the read-only summary is always the first
  // thing the user sees.
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState({
    sold:   String(originalCounts.sold),
    dead:   String(originalCounts.dead),
    culled: String(originalCounts.culled),
    lost:   String(originalCounts.lost),
  });

  // Sale amount is edited separately from the counts because it is
  // optional and may be absent on every record written before the field
  // existed. Empty string means "no amount on file" — distinct from 0.
  //
  // This is also the ONLY way to price a sale that was already logged
  // without one, which is the path finance uses to complete a cycle's
  // P&L retroactively.
  const originalAmount = readAmount(payload, 'sold');
  const [editedAmount, setEditedAmount] = useState(
    originalAmount === null ? '' : String(originalAmount),
  );

  const editedInt = {
    sold:   parseInt(edited.sold   || '0', 10) || 0,
    dead:   parseInt(edited.dead   || '0', 10) || 0,
    culled: parseInt(edited.culled || '0', 10) || 0,
    lost:   parseInt(edited.lost   || '0', 10) || 0,
  };
  const editedAmountNum = parseFloat(editedAmount || '') || 0;
  const newTotal = editedInt.sold + editedInt.dead + editedInt.culled + editedInt.lost;
  const totalDelta = newTotal - originalTotal;
  // New running-birds figure = current − Δ (bird_count REDUCES the flock,
  // so a positive delta pulls the count DOWN further).
  const newLivingBirds = livingBirds - totalDelta;
  const overCap = newLivingBirds < 0;
  const anyChange = totalDelta !== 0;

  const save = useMutation({
    mutationFn: () => {
      // Only send the payload keys the backend expects for a bird_count
      // row. `anyChange: true` is what the store endpoint sets on a Yes-
      // branch bird_count; keeping it consistent avoids surprising a
      // future reducer that reads it.
      // The amount key is only written when there IS one. Rebuilding
      // `sold` as `{ count }` unconditionally would silently wipe the
      // sale amount off any record that had one — a correction to the
      // bird count would quietly delete that cycle's revenue.
      const patchedPayload = {
        anyChange: true,
        sold: {
          count: editedInt.sold,
          ...(editedInt.sold > 0 && editedAmountNum > 0
            ? { amount: editedAmountNum }
            : {}),
        },
        dead:   { count: editedInt.dead   },
        culled: { count: editedInt.culled },
        lost:   { count: editedInt.lost   },
      };
      return endpoints.updateDailyRecord(flockId, record.id, {
        payload: patchedPayload,
      });
    },
    onSuccess: () => {
      toast.success('Bird count updated. Running flock count reconciled.');
      // Reset every surface that reads either the records list or the
      // derived flock count so the correction shows up everywhere.
      qc.invalidateQueries({ queryKey: ['flock-report', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-records', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-record-calendar', flockId] });
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
      qc.invalidateQueries({ queryKey: ['flocks'] });
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not update the bird count.')),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--color-brand-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-4 py-2.5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">
            Logged for this day
          </p>
          {onSwitchEntry && !editing && (
            <button
              type="button"
              onClick={onSwitchEntry}
              className="text-[11px] font-bold tracking-tight text-[var(--color-brand-primary-deep)] underline-offset-2 hover:underline"
            >
              Pick a different entry
            </button>
          )}
        </div>

        {editing ? (
          <div className="divide-y divide-[var(--color-brand-border)]">
            <CountInput label="Sold"   value={edited.sold}   onChange={(v) => setEdited((c) => ({ ...c, sold:   v }))} />
            {editedInt.sold > 0 && (
              <AmountInput
                label="Sale amount"
                value={editedAmount}
                onChange={setEditedAmount}
                birds={editedInt.sold}
              />
            )}
            <CountInput label="Dead"   value={edited.dead}   onChange={(v) => setEdited((c) => ({ ...c, dead:   v }))} />
            <CountInput label="Culled" value={edited.culled} onChange={(v) => setEdited((c) => ({ ...c, culled: v }))} />
            <CountInput label="Lost"   value={edited.lost}   onChange={(v) => setEdited((c) => ({ ...c, lost:   v }))} />
            <Stat label="Total out" value={newTotal} bold />
            <Stat label="Birds remaining" value={Math.max(0, newLivingBirds)} bold />
          </div>
        ) : (
          <dl className="divide-y divide-[var(--color-brand-border)]">
            <Stat label="Sold"   value={originalCounts.sold} />
            {/* Surfaced read-only so it's obvious at a glance whether a
                sale still needs pricing — that's the whole trigger for
                someone to hit Edit. */}
            {originalCounts.sold > 0 && (
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-[12.5px] text-[var(--color-brand-muted)]">Sale amount</dt>
                <dd className={cn(
                  'text-[13px] font-bold tracking-tight',
                  originalAmount === null
                    ? 'text-amber-700'
                    : 'text-[var(--color-brand-fg)]',
                )}>
                  {originalAmount === null
                    ? 'Not recorded'
                    : `₦${originalAmount.toLocaleString()}`}
                </dd>
              </div>
            )}
            <Stat label="Dead"   value={originalCounts.dead} />
            <Stat label="Culled" value={originalCounts.culled} />
            <Stat label="Lost"   value={originalCounts.lost} />
            <Stat label="Total out" value={originalTotal} bold />
            <Stat label="Birds remaining" value={livingBirds} bold />
          </dl>
        )}
      </div>

      {canEditCounts ? (
        editing ? (
          <div className="space-y-2">
            {overCap && (
              <BeigeAlert title="Not enough birds">
                Your edited counts would take the running flock below zero.
                Reduce one of the numbers before saving.
              </BeigeAlert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={!anyChange || overCap || save.isPending}
              >
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save corrected counts
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setEditing(false);
                setEdited({
                  sold:   String(originalCounts.sold),
                  dead:   String(originalCounts.dead),
                  culled: String(originalCounts.culled),
                  lost:   String(originalCounts.lost),
                });
              }}>
                Discard
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--color-brand-muted)]">
              Your edit is logged in the audit trail (who + when + which fields), and the running flock count is reconciled from the new total. This action is only available to owners and managers.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[var(--color-brand-muted)]">
              As an owner / manager you can correct these counts if they were entered incorrectly. The edit is captured in the audit trail.
            </p>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Correct counts
            </Button>
          </div>
        )
      ) : (
        <BeigeAlert title="Counts can't be edited">
          Bird-count totals are frozen once saved — editing them would
          let the running flock count drift. If today&rsquo;s figures are
          wrong, tap Cancel and log a <strong>fresh bird-count entry</strong>{' '}
          on this same date. Multiple rows on one day are allowed. Owners
          and managers can also correct the entry directly.
        </BeigeAlert>
      )}
    </div>
  );
}

function CountInput({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <label htmlFor={`bc-${label}`} className="text-[12.5px] text-[var(--color-brand-fg-soft)]">
        {label}
      </label>
      <input
        id={`bc-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        className="w-24 rounded-md border border-[var(--color-brand-input-border)] bg-white px-3 py-1.5 text-right text-[13.5px] font-semibold tabular-nums focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
      />
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

/**
 * Money row inside the edit form. Mirrors CountInput's layout so the
 * amount sits in the same column as the counts, with a naira prefix and
 * a per-bird readout underneath for sanity-checking a large figure.
 */
function AmountInput({
  label, value, onChange, birds,
}: { label: string; value: string; onChange: (v: string) => void; birds: number }) {
  const amount = parseFloat(value || '') || 0;
  const perBird = birds > 0 && amount > 0 ? amount / birds : null;

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`bc-${label}`} className="text-[12.5px] text-[var(--color-brand-fg-soft)]">
          {label} <span className="text-[var(--color-brand-muted)]">(₦)</span>
        </label>
        <input
          id={`bc-${label}`}
          value={value}
          // Digits plus a single decimal point.
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1'))}
          inputMode="decimal"
          placeholder="0"
          className="w-32 rounded-md border border-[var(--color-brand-input-border)] bg-white px-3 py-1.5 text-right text-[13.5px] font-semibold tabular-nums focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
        />
      </div>
      {perBird !== null && (
        <p className="mt-1 text-right text-[11px] text-[var(--color-brand-muted)]">
          ≈ ₦{perBird.toLocaleString(undefined, { maximumFractionDigits: 0 })} per bird
        </p>
      )}
    </div>
  );
}

/**
 * Reads payload.<key>.amount. Returns null (not 0) when absent, because
 * "no amount on file" and "sold for zero" are different facts and only
 * the former should drive the incomplete-margin warning.
 */
function readAmount(payload: Record<string, unknown>, key: string): number | null {
  const section = payload[key];
  if (section && typeof section === 'object') {
    const a = (section as Record<string, unknown>).amount;
    if (typeof a === 'number' && Number.isFinite(a)) return a;
    if (typeof a === 'string') {
      const n = parseFloat(a);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
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
