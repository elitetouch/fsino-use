'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Mic, Square, X } from 'lucide-react';
import { useDictation } from '@/lib/quick-record/use-dictation';
import { applyCarryForward, type LastFeedEntry } from '@/lib/quick-record/carry-forward';
import { activeAliases } from '@/lib/quick-record/learning';
import { learnFromSave } from '@/lib/quick-record/learn-from-save';
import type { FieldKind } from '@/lib/quick-record/vocabulary';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import {
  MAX_INPUT,
  parseQuickRecord,
  type ParsedField,
} from '@/lib/quick-record/parse';
import { buildQuickRecordPayloads, buildExpensePayloads, MAX_NOTE } from '@/lib/quick-record/to-payloads';
import { useCreateExpense } from '@/lib/use-expense';
import { DEFAULT_CURRENCY } from '@/lib/currencies';
import { enabledKinds, notTrackedReason } from '@/lib/quick-record/enabled-kinds';
import { apiErrorMessage, type DailyRecordPrefs } from '@/lib/api';
import { toast } from 'sonner';

/**
 * One sentence instead of eight screens.
 *
 * THE VOICE IS THE PHONE'S, NOT OURS. This is a plain <textarea>. The
 * farmer taps the microphone on their own keyboard and Android or iOS
 * writes text into it. We request no microphone permission, record no
 * audio, upload no audio and call no speech API — so there is no new
 * permission prompt, no new network call, and no new way in. It also
 * means this works with no signal and costs the farmer no data, which
 * matters more here than any of the rest of it.
 *
 * NOTHING SAVES WITHOUT A TAP. The parser proposes; the farmer decides.
 * Every value appears as a chip they can read, remove or correct before
 * Save does anything, and a value the parser is unsure about is marked
 * rather than quietly dropped — a farmer who sees a wrong number can fix
 * it, a farmer who sees nothing cannot.
 *
 * THE WIZARD IS STILL THERE. This writes the same payloads to the same
 * endpoints through the same offline outbox. It is a faster door into
 * the room, not a different room, and anything it cannot parse is handed
 * to the wizard rather than guessed at.
 */

interface QuickRecordProps {
  readonly flockId: string;
  /** YYYY-MM-DD, chosen on the date step exactly as the wizard does. */
  readonly recordDate: string;
  /** Drives the "more than the birds you have" check. */
  readonly currentBirds?: number;
  /**
   * The farmer's previous feed entry, from guidance. Used to fill in a
   * ration or brand they didn't repeat — always shown as carried over,
   * never applied silently.
   */
  readonly lastFeed?: LastFeedEntry | null;
  /** Gates egg entries — broilers do not lay. */
  readonly productionType?: 'broiler' | 'layer' | 'mixed';
  /**
   * What this farm records, from the same `effectiveDailyRecord` the
   * wizard builds its steps from. Anything switched off is refused
   * here with a reason rather than posted and rejected by the server.
   */
  readonly enabled?: DailyRecordPrefs | null;
  /** Fired after every payload saved, so the parent can refresh or exit. */
  readonly onSaved?: () => void;
  /** Escape hatch to the full wizard. */
  readonly onUseWizard?: () => void;
}

const KIND_LABEL: Readonly<Record<ParsedField['kind'], string>> = {
  expense: 'Spent',
  dead: 'Died',
  culled: 'Culled',
  sold: 'Sold',
  lost: 'Lost',
  feed: 'Feed',
  water: 'Water',
  eggs: 'Eggs',
  weight: 'Weight',
  vaccination: 'Vaccine',
  treatment: 'Treatment',
  egg_weight: 'Egg weight',
};

type Moment = 'morning' | 'evening' | 'entire_day';

const MOMENTS: ReadonlyArray<{ value: Moment; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'evening', label: 'Evening' },
  { value: 'entire_day', label: 'All day' },
];

const BRAND_LABELS: Readonly<Record<string, string>> = {
  own_feed: 'Own feed',
  amo_byng_feed: 'Amo Byng Feed',
  animal_care: 'Animal Care',
  broxwell_feeds: 'Broxwell Feeds',
  chikun_feeds: 'Chikun Feeds',
  hybrid_feeds: 'Hybrid Feeds',
  livestock_feeds_plc: 'Livestock Feeds Plc',
  stellar_feeds: 'Stellar Feeds',
  top_feeds: 'Top Feeds',
  vital_feed: 'Vital Feed',
  ultima: 'Ultima',
  other: 'Other',
};

/** The part of a chip that names what was understood beyond the number. */
/** "feed" -> "Feed", for the expense chip. */
const EXPENSE_CATEGORY_LABEL: Readonly<Record<string, string>> = {
  birds: 'Birds', feed: 'Feed', vaccine: 'Vaccine', treatment: 'Treatment',
  fuel: 'Fuel', utilities: 'Utilities', repairs: 'Repairs', wages: 'Wages',
  equipment: 'Equipment', transport: 'Transport', other: 'Other',
};

function detailText(field: ParsedField): string | null {
  const d = field.detail;
  if (!d) return null;
  if (d.expenseCategory) {
    return EXPENSE_CATEGORY_LABEL[d.expenseCategory] ?? d.expenseCategory;
  }
  if (d.vaccineName) return d.vaccineName;
  if (d.treatmentType) return d.treatmentType;
  if (d.eggSize) return d.eggSize;
  // Feed reads "starter · Top Feeds", either part optional.
  const brand = d.feedBrand
    ? (d.feedBrandLabel ?? BRAND_LABELS[d.feedBrand] ?? d.feedBrand)
    : null;
  const parts = [d.feedType, brand].filter((p): p is string => typeof p === 'string');
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function QuickRecord({
  flockId,
  recordDate,
  lastFeed,
  productionType,
  enabled,
  currentBirds,
  onSaved,
  onUseWizard,
}: QuickRecordProps) {
  const inputId = useId();
  const [text, setText] = useState('');
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [keepNote, setKeepNote] = useState(true);
  const [saving, setSaving] = useState(false);
  // Null means "follow what the sentence said". Set once the farmer
  // picks, so an explicit choice is never overwritten by the next edit
  // to the text.
  const [momentOverride, setMomentOverride] = useState<Moment | null>(null);

  const createRecord = useCreateDailyRecord(flockId);
  const createExpense = useCreateExpense();

  // This farmer's learned words, loaded once. Failure is silent and
  // harmless — an empty map just means the shipped vocabulary alone.
  const [aliases, setAliases] = useState<ReadonlyMap<string, FieldKind>>(new Map());
  useEffect(() => {
    let cancelled = false;
    void activeAliases().then((rows) => {
      if (cancelled) return;
      setAliases(new Map(rows.map((a) => [a.token, a.kind])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Pick the alternative that is actually a farm record, then append it.
   *
   * THIS IS THE FIX FOR MISHEARD NIGERIAN SPEECH. The recogniser ranks
   * its guesses by acoustic likelihood against a model trained mostly
   * on American English, so "three crates" comes back as "three grits"
   * at rank one — while the right words often sit at rank two or three.
   * We cannot improve its hearing, but we can ask a question it cannot:
   * which of these is a poultry record? Scoring each alternative by how
   * many confident fields it yields re-ranks them on meaning instead of
   * sound. Ties keep the recogniser's own order, so this can only ever
   * improve on taking the first guess blindly.
   *
   * Text is APPENDED, never substituted — a farmer who typed half a
   * sentence and then reached for the mic must not lose their typing.
   */
  const appendDictated = useCallback(
    (alternatives: string[]) => {
      // Score with the SAME context the real parse uses. Scoring with
      // different rules was a bug: in a broiler cycle an alternative
      // containing "eggs" scored well here and was then rejected by
      // the actual parse, so the reading that mentioned eggs could
      // beat the one that mentioned the vaccine, and the vaccine was
      // lost.
      const ctx = { currentBirds, aliases, productionType };

      // ONLY high-confidence fields count, and alternative 0 has to be
      // beaten outright to be displaced.
      //
      // Counting every field let a garbled alternative that produced
      // three uncertain readings beat the recogniser's own best guess
      // carrying one clean one — which is how "100ml of Lasota
      // vaccine" stopped being recognised after alternatives were
      // added. The recogniser's ranking is good; this only overrides
      // it when another reading is unambiguously a better record.
      const scoreOf = (candidate: string) =>
        parseQuickRecord(candidate, ctx).fields.filter((f) => f.confidence === 'high').length;

      let best = alternatives[0] ?? '';
      let bestScore = scoreOf(best);
      for (const candidate of alternatives.slice(1)) {
        const score = scoreOf(candidate);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }

      setText((prev) => {
        const joined = prev.trim() === '' ? best : `${prev.trim()} ${best}`;
        return joined.slice(0, MAX_INPUT);
      });
      setRemoved(new Set());
    setEdited(new Map());
    },
    [currentBirds, aliases, productionType],
  );

  const dictation = useDictation(appendDictated);
  const listening = dictation.status === 'listening';

  // Parsing is a pure function over a 500-character cap, so running it
  // on every keystroke costs nothing and avoids the stale-chip window a
  // debounce would open between what is typed and what would be saved.

  const parsed = useMemo(() => {
    const result = parseQuickRecord(text, { currentBirds, aliases, productionType });
    return { ...result, fields: applyCarryForward(result.fields, lastFeed ?? null) };
  }, [text, currentBirds, lastFeed, aliases, productionType]);

  const moment = momentOverride ?? parsed.moment;

  /**
   * Values the farmer corrected by hand.
   *
   * Needed because a badly misheard sentence gets the KIND right and
   * the NUMBER wrong far more often than the reverse — one spoken
   * "25 culled birds" came back as "1 coil bed 25 coiled bed 25...",
   * where the first number is 1 and the real count is buried. Without
   * this they would have to re-dictate the whole sentence to fix a
   * digit, which on a destructive field like culling is the moment
   * they give up and guess.
   *
   * Keyed by index into parsed.fields, cleared whenever the text
   * changes, because the indices then mean something else.
   */
  const [edited, setEdited] = useState<ReadonlyMap<number, number>>(new Map());

  /**
   * Accept a hand-typed value, or ignore it.
   *
   * The same bounds the parser applies, applied again — a typed value
   * reaches the payload builder by the identical path as a spoken one
   * and must not be able to carry anything a spoken one could not.
   */
  const setValueAt = (index: number, raw: string) => {
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return;
    setEdited((prev) => new Map(prev).set(index, n));
  };

  const withEdits = parsed.fields.map((f, i) => {
    const override = edited.get(i);
    return override === undefined ? f : { ...f, value: override };
  });

  /*
   * Split off anything this farm does not record.
   *
   * The wizard never offers a step for a switched-off event, so quick
   * record must not post one either. It used to, and the server
   * answered "water records are disabled in this farm settings" — a
   * 422, which the outbox treats as permanent, leaving a record that
   * could never be sent under a "Try again" button that would refuse
   * it every time.
   *
   * Declined here instead, with the reason and where to change it,
   * alongside the parser's own rejections.
   */
  const allowed = enabledKinds(enabled);
  const offFields = withEdits.filter((f) => !allowed.has(f.kind));
  const onFields = withEdits.filter((f) => allowed.has(f.kind));
  const notTracked = offFields.map((f) => ({
    kind: f.kind,
    sourceText: f.sourceText,
    reason: notTrackedReason(f.kind),
  }));

  const kept = onFields.filter((_, i) => !removed.has(i));
  const hasLowConfidence = kept.some((f) => f.confidence === 'low');
  const note = keepNote ? parsed.leftover : '';
  const canSave = !saving && (kept.length > 0 || note.trim() !== '');

  // The button names what pressing it will actually do. While the box is
  // empty it must not read "Save note" — that promises an action that is
  // neither available nor what would happen, and a disabled control that
  // describes the wrong outcome reads as a bug rather than a prompt.
  const saveLabel =
    kept.length > 0
      ? `Save ${kept.length} ${kept.length === 1 ? 'entry' : 'entries'}`
      : note.trim() !== ''
        ? 'Save note'
        : 'Save record';

  const reset = () => {
    dictation.stop();
    setText('');
    setRemoved(new Set());
    setEdited(new Map());
  };

  const save = async () => {
    if (!canSave) return;
    // Close the microphone before the save round-trip. Leaving it open
    // across a navigation is how a hot mic outlives the screen that
    // opened it.
    dictation.stop();
    const payloads = buildQuickRecordPayloads(kept, {
      recordDate,
      moment,
      note,
    });
    // A different ledger and a different endpoint — see
    // buildExpensePayloads. The currency comes from the app's own
    // setting and never from what was said.
    const expenses = buildExpensePayloads(kept, {
      recordDate,
      currency: DEFAULT_CURRENCY,
      flockId,
    });
    if (payloads.length === 0 && expenses.length === 0) return;

    setSaving(true);
    try {
      // Sequential, not Promise.all. Each POST shifts flock.current_birds
      // and the guidance the next one is validated against, and the
      // outbox serialises per store anyway — firing them together would
      // race the bird count for no gain.
      //
      // BUT ONE REFUSAL MUST NOT SWALLOW THE REST. This loop used to
      // let the first rejection throw, so "15 birds died and 2 bags of
      // feed and 40 litres of water" lost the deaths and the feed if
      // the water was refused — they were never even attempted, and
      // nothing on screen said so. A farmer reporting mortality cannot
      // have it dropped because an unrelated line failed.
      //
      // Every payload is attempted; the failures are counted and named.
      const failures: string[] = [];
      for (const payload of payloads) {
        try {
          await createRecord.mutateAsync(payload);
        } catch (err) {
          failures.push(apiErrorMessage(err, `Could not save the ${payload.event_type} entry.`));
        }
      }

      // Expenses, under the same rule: each attempted, none allowed to
      // take the others down. A farmer who said what they spent AND
      // what died must not lose the deaths because the ledger refused.
      for (const expense of expenses) {
        try {
          await createExpense.mutateAsync(expense);
        } catch (err) {
          failures.push(apiErrorMessage(err, `Could not save the ${expense.category} expense.`));
        }
      }

      if (failures.length > 0) {
        // Said once, naming the first reason. The sync screen carries
        // the rest; repeating every message here would bury the fact
        // that the other entries DID save.
        const total = payloads.length + expenses.length;
        toast.error(
          failures.length === total
            ? failures[0]
            : `Saved ${total - failures.length} of ${total}. ${failures[0]}`,
        );
      }
      // Learn from what was just confirmed. The leftover text is the
      // part the app did not understand, and the kinds the farmer kept
      // are what it should have understood it as — that pairing is the
      // whole training signal, and it only exists at the moment of a
      // successful save.
      void learnFromSave(parsed.leftover, kept);

      reset();
      onSaved?.();
    } catch {
      // useCreateDailyRecord already surfaces the error toast. Leaving
      // the text in place lets the farmer retry without re-dictating.
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-[var(--color-brand-input-border)] bg-white p-4">
      <label
        htmlFor={inputId}
        className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-fg)]"
      >
        <Mic className="h-4 w-4 text-[var(--color-brand-primary)]" aria-hidden />
        Say what happened today
      </label>

      <div className="relative mt-2">
        <textarea
          id={inputId}
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, MAX_INPUT));
            setRemoved(new Set());
    setEdited(new Map());
          }}
          maxLength={MAX_INPUT}
          rows={3}
          inputMode="text"
          autoComplete="off"
          autoCorrect="on"
          spellCheck={false}
          placeholder="15 birds died and I gave them 2 bags of feed"
          className={cn(
            // Right padding clears the mic button so long text never
            // runs underneath it.
            'w-full resize-none rounded-xl border-2 bg-white p-3 pr-14 text-base leading-snug outline-none',
            listening
              ? 'border-red-500'
              : 'border-[var(--color-brand-input-border)] focus:border-[var(--color-brand-primary)]',
          )}
        />

        {dictation.isAvailable && (
          <button
            type="button"
            onClick={listening ? dictation.stop : dictation.start}
            aria-label={listening ? 'Stop recording' : 'Record what happened'}
            aria-pressed={listening}
            className={cn(
              'absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-full transition',
              listening
                ? 'bg-red-600 text-white'
                : 'bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-deep)]',
            )}
          >
            {listening ? (
              <Square className="h-4 w-4 fill-current" aria-hidden />
            ) : (
              <Mic className="h-5 w-5" aria-hidden />
            )}
            {/* A live microphone must be impossible to miss. */}
            {listening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/60" />
            )}
          </button>
        )}
      </div>

      {/* Live region: what the recogniser has heard but not settled on.
          Shown so the farmer can see it is working, never saved — only
          final text reaches the box. */}
      <p aria-live="polite" className="sr-only">
        {listening ? 'Recording' : ''}
      </p>
      {listening && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" />
          Listening{dictation.interim ? `: ${dictation.interim}` : '… say what happened'}
        </p>
      )}

      {dictation.message && !listening && (
        <p className="mt-1.5 text-xs font-medium text-amber-700">{dictation.message}</p>
      )}

      {!listening && !dictation.message && (
        <p className="mt-1.5 text-xs text-[var(--color-brand-muted)]">
          {dictation.isAvailable
            ? 'Tap the microphone and talk, or just type. Pidgin is fine.'
            : 'Type what happened, or use the microphone on your keyboard. Pidgin is fine.'}
        </p>
      )}

      {/* Time of day, always visible once anything parsed.
          It was being detected and silently applied — a farmer who said
          "in the morning" had no way to see it had landed, and one who
          forgot to say it had no way to set it. */}
      {kept.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--color-brand-muted)]">Time:</span>
          {MOMENTS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMomentOverride(m.value)}
              aria-pressed={moment === m.value}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold transition',
                moment === m.value
                  ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white'
                  : 'border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-muted)]',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {kept.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="What we understood">
          {/* withEdits, NOT parsed.fields — rendering the unedited
              list is how the number input silently ignored every
              correction the farmer typed into it. */}
          {withEdits.map((field, i) =>
            removed.has(i) ? null : (
              <li key={`${field.kind}-${i}`}>
                <Chip
                  field={field}
                  onRemove={() =>
                    setRemoved((prev) => new Set(prev).add(i))
                  }
                  onValue={(raw) => setValueAt(i, raw)}
                />
              </li>
            ),
          )}
        </ul>
      )}

      {/* Understood, then declined. Said plainly, because a farmer who
          sees nothing happen learns only that the app is unreliable. */}
      {[...parsed.rejected, ...notTracked].map((r) => (
        <p
          key={`${r.kind}-${r.sourceText}`}
          className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-700"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {r.reason}
        </p>
      ))}

      {hasLowConfidence && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[var(--color-brand-warning,#b45309)]">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Check the marked numbers before saving.
        </p>
      )}

      {parsed.leftover.trim() !== '' && (
        <label className="mt-3 flex items-start gap-2 text-xs text-[var(--color-brand-muted)]">
          <input
            type="checkbox"
            checked={keepNote}
            onChange={(e) => setKeepNote(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-primary)]"
          />
          {/* Rendered as text, never as markup. */}
          <span>
            Save the rest as a note: &ldquo;{parsed.leftover.slice(0, MAX_NOTE)}&rdquo;
          </span>
        </label>
      )}

      {text.trim() !== '' && parsed.understoodNothing && (
        <p className="mt-3 text-xs text-[var(--color-brand-muted)]">
          That didn&rsquo;t include a number we recognised.{' '}
          {onUseWizard && (
            <button
              type="button"
              onClick={onUseWizard}
              className="font-semibold text-[var(--color-brand-primary)] underline underline-offset-2"
            >
              Use the full form instead
            </button>
          )}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" onClick={save} disabled={!canSave} className="flex-1">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving
            </>
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden /> {saveLabel}
            </>
          )}
        </Button>
        {text !== '' && (
          <Button type="button" variant="outline" onClick={reset} disabled={saving}>
            Clear
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * One understood value, shown back in the farmer's own words.
 *
 * `sourceText` is echoed so they can see which part of what they said
 * produced this number — that is what makes a wrong parse obvious at a
 * glance instead of after the flock count drifts.
 */
function Chip({
  field,
  onRemove,
  onValue,
}: {
  field: ParsedField;
  onRemove: () => void;
  /** Raw input string; the caller validates before accepting it. */
  onValue: (raw: string) => void;
}) {
  const low = field.confidence === 'low';
  const showsValue =
    field.value > 0 || (field.kind !== 'vaccination' && field.kind !== 'treatment');
  const detail = detailText(field);
  const isMoney = field.kind === 'expense';
  const inherited = field.detail?.inherited ?? [];
  // Only the brand line is worth naming when just the type carried
  // over — a ration follows bird age and is far less likely to be
  // wrong than a brand the farmer may have switched.
  const inheritedCount = inherited.includes('feedBrand') ? inherited.length : 0;

  return (
    <span
      className={cn(
        'inline-flex max-w-full flex-col gap-0.5 rounded-xl border px-2.5 py-1.5',
        low
          ? 'border-[var(--color-brand-warning,#b45309)] bg-amber-50'
          : 'border-[var(--color-brand-input-border)] bg-[var(--color-brand-accent)]/30',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold leading-none">
        {low && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />}
        <span className="flex items-center gap-1">
          {KIND_LABEL[field.kind]}
          {/* Vaccination and treatment are facts without counts, so a
              bare "Vaccine: 0" would read as nonsense. */}
          {showsValue && (
            <>
              :
              {/* The number is editable in place. A badly misheard
                  sentence gets the kind right and the count wrong far
                  more often than the reverse, and making the farmer
                  re-dictate to fix one digit is where they give up and
                  guess instead. */}
              {/* Money reads as money. A bare "45000" beside a bird
                  count is the farmer's cue that the app has understood
                  a price rather than a quantity, and the naira sign is
                  what carries that in one glance. */}
              {isMoney && <span aria-hidden>&nbsp;&#8358;</span>}
              <input
                type="number"
                inputMode={isMoney ? 'decimal' : 'numeric'}
                min={0}
                // A count of a million birds is absurd; a spend of a
                // million naira is a batch of day-olds. Sharing one
                // ceiling would have silently clamped real prices.
                max={isMoney ? 999_999_999.99 : 1_000_000}
                step={isMoney ? '0.01' : '1'}
                value={field.value}
                onChange={(e) => onValue(e.target.value)}
                aria-label={isMoney ? 'Amount spent' : `${KIND_LABEL[field.kind]} amount`}
                className={cn(
                  'rounded border border-transparent bg-white/70 px-0.5 text-center font-semibold tabular-nums underline decoration-dotted underline-offset-2 focus:border-[var(--color-brand-primary)] focus:outline-none',
                  isMoney ? 'w-[9ch]' : 'w-[5.5ch]',
                )}
              />
            </>
          )}
          {field.unit && field.unit !== 'eggs' ? ` ${field.unit}` : ''}
          {detail ? ` · ${detail}` : ''}
          {field.amount !== undefined ? ` · ₦${field.amount}` : ''}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${KIND_LABEL[field.kind]}`}
          className="ml-0.5 rounded-full p-0.5 text-[var(--color-brand-muted)] hover:bg-black/5"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </span>

      {field.conversionNote && (
        <span className="text-[11px] text-[var(--color-brand-muted)]">
          {field.conversionNote}
        </span>
      )}
      {/* Anything filled in from the last record says so. A brand the
          farmer cannot see is how weeks of entries end up against a
          brand they stopped buying. */}
      {inheritedCount > 0 && (
        <span className="text-[11px] italic text-[var(--color-brand-muted)]">
          {inheritedCount === 2 ? 'Type and brand' : 'Brand'} kept from your last record
        </span>
      )}
      {field.caution && (
        <span className="text-[11px] font-medium text-amber-800">{field.caution}</span>
      )}
    </span>
  );
}
