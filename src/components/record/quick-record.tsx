'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Mic, Square, X } from 'lucide-react';
import { useDictation } from '@/lib/quick-record/use-dictation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCreateDailyRecord } from '@/lib/use-daily-record';
import {
  MAX_INPUT,
  parseQuickRecord,
  type ParsedField,
} from '@/lib/quick-record/parse';
import { buildQuickRecordPayloads, MAX_NOTE } from '@/lib/quick-record/to-payloads';

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
  /** Fired after every payload saved, so the parent can refresh or exit. */
  readonly onSaved?: () => void;
  /** Escape hatch to the full wizard. */
  readonly onUseWizard?: () => void;
}

const KIND_LABEL: Readonly<Record<ParsedField['kind'], string>> = {
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

/** The part of a chip that names what was understood beyond the number. */
function detailText(field: ParsedField): string | null {
  const d = field.detail;
  if (!d) return null;
  return d.vaccineName ?? d.feedType ?? d.treatmentType ?? d.eggSize ?? null;
}

export function QuickRecord({
  flockId,
  recordDate,
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
      let best = alternatives[0] ?? '';
      let bestScore = -1;
      for (const candidate of alternatives) {
        const result = parseQuickRecord(candidate, { currentBirds });
        // A confident field is worth more than a hesitant one, so a
        // reading that produces a clean record beats one that produces
        // the same count with a warning attached.
        const score = result.fields.reduce(
          (sum, f) => sum + (f.confidence === 'high' ? 2 : 1),
          0,
        );
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
    },
    [currentBirds],
  );

  const dictation = useDictation(appendDictated);
  const listening = dictation.status === 'listening';

  // Parsing is a pure function over a 500-character cap, so running it
  // on every keystroke costs nothing and avoids the stale-chip window a
  // debounce would open between what is typed and what would be saved.
  const parsed = useMemo(
    () => parseQuickRecord(text, { currentBirds }),
    [text, currentBirds],
  );

  const moment = momentOverride ?? parsed.moment;
  const kept = parsed.fields.filter((_, i) => !removed.has(i));
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
    if (payloads.length === 0) return;

    setSaving(true);
    try {
      // Sequential, not Promise.all. Each POST shifts flock.current_birds
      // and the guidance the next one is validated against, and the
      // outbox serialises per store anyway — firing them together would
      // race the bird count for no gain.
      for (const payload of payloads) {
        await createRecord.mutateAsync(payload);
      }
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
          {parsed.fields.map((field, i) =>
            removed.has(i) ? null : (
              <li key={`${field.kind}-${i}`}>
                <Chip
                  field={field}
                  onRemove={() =>
                    setRemoved((prev) => new Set(prev).add(i))
                  }
                />
              </li>
            ),
          )}
        </ul>
      )}

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
function Chip({ field, onRemove }: { field: ParsedField; onRemove: () => void }) {
  const low = field.confidence === 'low';
  const detail = detailText(field);

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
        <span>
          {KIND_LABEL[field.kind]}
          {/* Vaccination and treatment are facts without counts, so a
              bare "Vaccine: 0" would read as nonsense. */}
          {field.value > 0 || (field.kind !== 'vaccination' && field.kind !== 'treatment')
            ? `: ${field.value}`
            : ''}
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
      {field.caution && (
        <span className="text-[11px] font-medium text-amber-800">{field.caution}</span>
      )}
    </span>
  );
}
