'use client';

import { useMemo, useState } from 'react';
import { Bird } from 'lucide-react';
import type { DailyRecordGuidance, MyPreferencesDto } from '@/lib/api';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, BeigeAlert, AnomalyWarning,
  YesNoPills, LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import { FieldStack, FOCUS_WRAPPER } from '@/components/record/inputs';
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

export function BirdCountStep({
  flockId,
  recordDate,
  guidance,
  prefs,
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
  stepIndex: number;
  stepCount: number;
  onBack: () => void;
  onCancel: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
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
        onBack={onBack}
        onCancel={onCancel}
        onLearnMore={() => setDrawerOpen(true)}
        onSkip={onSkip}
        onContinue={submit}
        continueDisabled={!isValid}
        continuePending={createRecord.isPending}
      >
        <FieldStack>
          <div>
            <p className="mb-1.5 text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Any dead, culled, sold or lost birds today?
            </p>
            <YesNoPills value={answer} onChange={setAnswer} primary="no" />
          </div>

          {/* "No" branch */}
          {answer === 'no' && (
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
          {answer === 'yes' && (
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
