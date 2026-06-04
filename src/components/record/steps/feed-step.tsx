'use client';

import { useState } from 'react';
import { Wheat } from 'lucide-react';
import type {
  DailyRecordGuidance, GuidanceMessage, MyPreferencesDto,
} from '@/lib/api';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import {
  StepShell, NumberKeypadInput, BeigeAlert, AnomalyWarning,
  LearnMoreDrawer, LearnMoreHeading,
} from '@/components/record/wizard-shell';
import {
  PillTiles, Dropdown, FieldStack,
} from '@/components/record/inputs';

/**
 * Step 1 — Feed consumption.
 *
 * Two sub-flows, picked by the user's `feed.twice_a_day` preference:
 *
 *   ONE moment (default for new accounts):
 *     [Feed type tiles] → [Feed brand dropdown] → [Feed amount + unit]
 *
 *   TWO moments:
 *     [Moment dropdown: Morning / Evening / Entire day]
 *     → above three again, scoped to that moment.
 *
 * Each Continue tap saves ONE event_type=feed record with:
 *   quantity, unit ('kg' or 'bags'), payload.{moment, item_type, item_brand}
 *
 * In "Two moments" mode, the user is expected to come back later for
 * the second moment — we don't try to capture both in one POST.
 * "Entire day" is a third option that lets a two-moment-pref user
 * still log a single combined value when they forgot to split it.
 */

/* ------------------------------------------------------------------ */
/*  Constants — feed type + brand catalogue                            */
/* ------------------------------------------------------------------ */

const FEED_TYPES = [
  { value: 'starter',  label: 'Starter'  },
  { value: 'grower',   label: 'Grower'   },
  { value: 'finisher', label: 'Finisher' },
] as const;
type FeedType = (typeof FEED_TYPES)[number]['value'];

const MOMENTS = [
  { value: 'morning',    label: 'Morning'    },
  { value: 'evening',    label: 'Evening'    },
  { value: 'entire_day', label: 'Entire day' },
] as const;
type Moment = (typeof MOMENTS)[number]['value'];

/**
 * Nigerian feed-brand shortlist seen in the figma. "Own feed" lets
 * the farmer record a home-blended ration; "Other" reveals a free-
 * text fallback for brands we haven't predefined.
 */
const FEED_BRANDS = [
  { value: 'own_feed',           label: 'Own feed' },
  { value: 'amo_byng_feed',      label: 'Amo Byng Feed' },
  { value: 'animal_care',        label: 'Animal Care' },
  { value: 'broxwell_feeds',     label: 'Broxwell Feeds' },
  { value: 'chikun_feeds',       label: 'Chikun Feeds' },
  { value: 'hybrid_feeds',       label: 'Hybrid Feeds' },
  { value: 'livestock_feeds_plc', label: 'Livestock Feeds Plc' },
  { value: 'stellar_feeds',      label: 'Stellar Feeds' },
  { value: 'top_feeds',          label: 'Top Feeds' },
  { value: 'vital_feed',         label: 'Vital Feed' },
  { value: 'ultima',             label: 'Ultima' },
  { value: 'other',              label: 'Other (type in)' },
] as const;
type FeedBrand = (typeof FEED_BRANDS)[number]['value'];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export function FeedStep({
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
  const twiceADay = !!prefs.dailyRecord.feed?.twice_a_day;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const createRecord = useCreateDailyRecord(flockId);

  // Unit default — backend stores text, the figma's "kg / bags" toggle
  // covers the only two units broiler farmers use in Nigeria.
  const lastUnit = (guidance.sections.feed.last_entry?.unit as string | undefined) ?? 'kg';
  const lastType = (guidance.sections.feed.last_entry?.item_type as FeedType | undefined) ?? null;
  const lastBrand = (guidance.sections.feed.last_entry?.item_brand as FeedBrand | undefined) ?? null;

  // ── State ──────────────────────────────────────────────────────────
  const [moment, setMoment] = useState<Moment>(twiceADay ? 'morning' : 'entire_day');
  const [type, setType] = useState<FeedType | null>(lastType);
  const [brand, setBrand] = useState<FeedBrand | ''>(lastBrand ?? '');
  const [otherBrand, setOtherBrand] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<string>(lastUnit);

  // ── Validity + anomaly ─────────────────────────────────────────────
  const amountNumeric = parseFloat(amount);
  const amountValid = !isNaN(amountNumeric) && amountNumeric > 0;
  const brandValid = brand !== '' && (brand !== 'other' || otherBrand.trim().length > 0);
  const isValid = type !== null && brandValid && amountValid;

  // Soft "Are you sure?" check — only when user has 14-day stats
  const usual = guidance.sections.feed.usual_quantity;
  const showHigh = !!usual && amountValid && amountNumeric > usual.high * 1.5;
  const showLow  = !!usual && amountValid && amountNumeric < usual.low * 0.5;

  // ── Hint messages from guidance ────────────────────────────────────
  const feedMessages = guidance.sections.feed.messages;

  // ── Submit ─────────────────────────────────────────────────────────
  const submit = () => {
    if (!isValid || createRecord.isPending) return;
    const finalBrand = brand === 'other' ? otherBrand.trim() : labelForBrand(brand);
    createRecord.mutate(
      {
        event_type: 'feed',
        record_date: recordDate,
        quantity: amountNumeric,
        unit,
        payload: {
          moment,
          item_type: type,
          item_brand: finalBrand,
        },
      },
      {
        onSuccess: onContinue,
      },
    );
  };

  return (
    <>
      <StepShell
        sectionIcon={<Wheat className="h-3.5 w-3.5" />}
        sectionLabel="Feed consumption"
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
          {/* Pre-input guidance from /guidance */}
          {feedMessages.length > 0 && (
            <BeigeAlert>{firstHint(feedMessages)}</BeigeAlert>
          )}

          {/* Moment dropdown — only for twice-a-day mode */}
          {twiceADay && (
            <Dropdown
              id="feed-moment"
              label="Feed moment"
              value={moment}
              onChange={(v) => setMoment(v as Moment)}
              options={[...MOMENTS]}
            />
          )}

          {/* Type tiles */}
          <div>
            <p className="mb-1.5 text-[12px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Feed type
            </p>
            <PillTiles
              value={type}
              onChange={setType}
              options={[...FEED_TYPES]}
            />
          </div>

          {/* Brand dropdown */}
          <Dropdown
            id="feed-brand"
            label="Feed brand"
            value={brand}
            onChange={(v) => setBrand(v as FeedBrand)}
            options={[...FEED_BRANDS]}
            placeholder="Select brand"
          />
          {brand === 'other' && (
            <div>
              <input
                type="text"
                value={otherBrand}
                onChange={(e) => setOtherBrand(e.target.value)}
                placeholder="Type the brand name"
                className="h-11 w-full rounded-lg border border-[var(--color-brand-input-border)] bg-white px-3.5 text-[13px] font-semibold text-[var(--color-brand-fg)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {/* Amount */}
          <div>
            <NumberKeypadInput
              id="feed-amount"
              label="Feed amount"
              description={momentDescription(moment)}
              prefix={<Wheat className="h-3 w-3" />}
              value={amount}
              onChange={setAmount}
              unit={unit}
              onUnitChange={setUnit}
              unitOptions={['kg', 'bags']}
            />
            {showHigh && (
              <AnomalyWarning>
                You have entered far more feed than usual ({fmtRange(usual!)} per day).
                Double-check that the figure is correct.
              </AnomalyWarning>
            )}
            {showLow && (
              <AnomalyWarning>
                You have entered far less feed than usual ({fmtRange(usual!)} per day).
                Double-check that the figure is correct.
              </AnomalyWarning>
            )}
          </div>
        </FieldStack>
      </StepShell>

      <LearnMoreDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Feed consumption"
      >
        <LearnMoreHeading>Keeping record of feed</LearnMoreHeading>
        <p>
          Enter the feed you give to the birds in this pen every day. In the
          dashboard you&rsquo;ll find an overview of the amount of feed you have
          given. The feed conversion ratio (FCR) will be calculated for you.
        </p>
        <LearnMoreHeading>Feed type</LearnMoreHeading>
        <p>
          Select the feed type you give to the birds in this pen. You can
          choose between starter, grower and finisher.
        </p>
        <LearnMoreHeading>Feed brand</LearnMoreHeading>
        <p>
          Select the feed brand you give to birds in this pen. You can choose
          from common Nigerian brands or pick <strong>Own feed</strong> for a
          home-blended ration.
        </p>
        <LearnMoreHeading>Feed amount</LearnMoreHeading>
        <p>
          Enter the amount of feed you give to the birds in this pen. You can
          switch between kilograms and bags in the unit toggle.
        </p>
        <LearnMoreHeading>Once or twice a day</LearnMoreHeading>
        <p>
          You can choose between recording feed once or twice a day (mornings
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

function labelForBrand(value: FeedBrand): string {
  return FEED_BRANDS.find((b) => b.value === value)?.label ?? value;
}

function momentDescription(moment: Moment): string {
  if (moment === 'morning') return 'Amount of feed provided in the morning';
  if (moment === 'evening') return 'Amount of feed provided in the evening';
  return 'Amount of feed provided during the day';
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
