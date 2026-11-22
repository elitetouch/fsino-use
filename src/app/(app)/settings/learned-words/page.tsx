'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mic, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  allAliases,
  forgetAlias,
  forgetAll,
  PROMOTION_THRESHOLD,
  type LearnedAlias,
} from '@/lib/quick-record/learning';

/**
 * Every word this app has learned from one farmer, and a way to
 * un-learn it.
 *
 * THIS SCREEN IS A SAFETY REQUIREMENT, not a nicety. A learned alias
 * silently changes how someone's words are interpreted. Without a way
 * to see the list, a farmer whose app suddenly starts logging feed when
 * they talk about something else has no way to find out why and no way
 * to stop it — the app would just be mysteriously wrong, forever.
 *
 * Deleting tombstones the row rather than dropping it, so a sync from
 * another device cannot bring back a word the farmer has rejected.
 */

const KIND_LABEL: Readonly<Record<string, string>> = {
  feed: 'Feed',
  water: 'Water',
  eggs: 'Eggs',
  weight: 'Bird weight',
  sold: 'Birds sold',
  lost: 'Birds lost',
  vaccination: 'Vaccine',
  treatment: 'Treatment',
  egg_weight: 'Egg weight',
};

export default function LearnedWordsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<readonly LearnedAlias[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void allAliases().then(setRows);
  }, []);

  useEffect(load, [load]);

  const active = (rows ?? []).filter((r) => r.active);

  const remove = async (token: string) => {
    setBusy(true);
    await forgetAlias(token);
    load();
    setBusy(false);
  };

  const removeAll = async () => {
    setBusy(true);
    await forgetAll();
    load();
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-lg p-4">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand-primary)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>

      <h1 className="text-xl font-bold tracking-tight text-[var(--color-brand-fg)]">
        Words this app learned from you
      </h1>
      <p className="mt-2 text-sm text-[var(--color-brand-muted)]">
        When the microphone keeps hearing a word wrongly, this app remembers what
        you actually meant — after you have corrected it {PROMOTION_THRESHOLD} times.
        These words are kept on this phone and are only used to suggest an entry,
        never to save one by itself.
      </p>

      {rows === null ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-brand-muted)]" />
        </div>
      ) : active.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-[var(--color-brand-input-border)] p-6 text-center">
          <Mic className="mx-auto h-6 w-6 text-[var(--color-brand-muted)]" aria-hidden />
          <p className="mt-2 text-sm font-semibold">Nothing learned yet</p>
          <p className="mt-1 text-xs text-[var(--color-brand-muted)]">
            Keep using the microphone on the record screen. If a word is heard
            wrongly again and again, it will show up here.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2">
            {active.map((alias) => (
              <li
                key={alias.token}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-brand-input-border)] bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    &ldquo;{alias.token}&rdquo;
                  </p>
                  <p className="text-xs text-[var(--color-brand-muted)]">
                    treated as {KIND_LABEL[alias.kind] ?? alias.kind}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove(alias.token)}
                  aria-label={`Forget the word ${alias.token}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Forget
                </Button>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void removeAll()}
            className="mt-4 w-full"
          >
            Forget all {active.length} words
          </Button>
        </>
      )}
    </div>
  );
}
