'use client';

import { useId, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, Mic, X } from 'lucide-react';
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
};

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

  const createRecord = useCreateDailyRecord(flockId);

  // Parsing is a pure function over a 500-character cap, so running it
  // on every keystroke costs nothing and avoids the stale-chip window a
  // debounce would open between what is typed and what would be saved.
  const parsed = useMemo(
    () => parseQuickRecord(text, { currentBirds }),
    [text, currentBirds],
  );

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
    setText('');
    setRemoved(new Set());
  };

  const save = async () => {
    if (!canSave) return;
    const payloads = buildQuickRecordPayloads(kept, {
      recordDate,
      moment: parsed.moment,
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

      <textarea
        id={inputId}
        value={text}
        onChange={(e) => {
          setText(e.target.value.slice(0, MAX_INPUT));
          setRemoved(new Set());
        }}
        maxLength={MAX_INPUT}
        rows={3}
        // Plain text input. The keyboard's own mic does the speech, so
        // nothing here asks for a microphone or touches an audio API.
        inputMode="text"
        autoComplete="off"
        autoCorrect="on"
        spellCheck={false}
        placeholder="15 birds died and I gave them 2 bags of feed"
        className="mt-2 w-full resize-none rounded-xl border-2 border-[var(--color-brand-input-border)] bg-white p-3 text-base leading-snug outline-none focus:border-[var(--color-brand-primary)]"
      />

      <p className="mt-1.5 text-xs text-[var(--color-brand-muted)]">
        Tap the microphone on your keyboard and talk, or type it. Pidgin is fine.
      </p>

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
          {KIND_LABEL[field.kind]}: {field.value}
          {field.unit && field.unit !== 'eggs' ? ` ${field.unit}` : ''}
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
