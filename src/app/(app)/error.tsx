'use client';

import { useEffect } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useOnline } from '@/lib/offline';

/**
 * What a farmer sees when a screen fails to load, instead of
 * "Application error: a client-side exception has occurred".
 *
 * WHY THIS EXISTS. Next splits every route into its own chunk and
 * fetches it on navigation. With no signal, a chunk the service worker
 * has not cached cannot be fetched, webpack throws ChunkLoadError, and
 * Next's default boundary renders a blank page with that sentence —
 * which tells a farmer nothing and looks like the app is broken rather
 * than like the one page is not downloaded yet.
 *
 * Caching is the real fix and is handled in the worker. This is the
 * floor under it: a missing chunk will always be possible, because a
 * deploy changes every hash and a farmer can lose signal between
 * caching one route and opening another.
 *
 * A chunk failure is also the one error here that a reload genuinely
 * fixes once there is signal, so the retry is honest rather than
 * decorative.
 */
function isChunkError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk \S+ failed/i.test(error.message) ||
    /Failed to fetch dynamically imported module/i.test(error.message)
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Kept for the console, which is where this gets diagnosed. The
    // screen stays in the farmer's language.
    console.error('[fsm] screen failed to load:', error);
  }, [error]);

  const online = useOnline();
  const chunk = isChunkError(error);

  const title = chunk && !online ? 'This page isn’t saved for offline yet' : 'This page didn’t load';

  const body = chunk && !online
    ? 'Open it once while you have signal and it will work offline afterwards. Anything you have already recorded is safe and will upload by itself.'
    : chunk
      ? 'Part of the app didn’t download. Reloading usually fixes it.'
      : 'Something went wrong on this screen. Anything you have already recorded is safe.';

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-[var(--color-brand-border)] bg-white p-6 text-center shadow-sm">
        <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]">
          <CloudOff className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <p className="text-base font-bold text-[var(--color-brand-fg)]">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-brand-muted)]">{body}</p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              // A chunk that failed to load is cached as failed by
              // webpack, so re-rendering alone will not retry it —
              // only a fresh document will.
              if (chunk) window.location.reload();
              else reset();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
          <a
            href="/home"
            className="text-sm font-semibold text-[var(--color-brand-primary-deep)] underline-offset-2 hover:underline"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
