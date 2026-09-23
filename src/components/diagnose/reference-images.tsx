'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DiagnosisDto } from '@/lib/api';

type ReferenceImage = DiagnosisDto['referenceImages'][number];

/**
 * Reference photographs of the disease.
 *
 * PLACEMENT IS THE WHOLE DESIGN.
 * ------------------------------
 * These belong under "Does this match what you are seeing?" and nowhere
 * else. That section asks the farmer to CHECK the result; the same
 * images placed under the disease name would confirm it instead, and a
 * farmer shown pictures beneath a verdict sees what they have been told
 * to see.
 *
 * The difference is not cosmetic. This model refuses genuine droppings
 * and, before its guards were fixed, diagnosed a photograph of
 * groceries as coccidiosis at full confidence. Photographs make any
 * answer feel more authoritative — which is exactly the wrong direction
 * for a result that is wrong often enough to carry a beta badge. Used
 * as a check they catch the model's mistakes; used as confirmation they
 * launder them.
 *
 * ORDERING: EARLY SIGNS FIRST, set by the backend.
 * ------------------------------------------------
 * A farmer two days into Newcastle who opens on a photograph of a
 * corpse concludes "mine look nothing like that" and does not act. By
 * the time the flock does look like that, nothing can be done. Early is
 * the only stage at which a farmer changes the outcome, so early leads.
 *
 * CAPTIONS ARE NOT OPTIONAL. A bare photo of a sick bird tells someone
 * who has never seen the disease almost nothing — they cannot tell
 * which part of the picture is the finding. The backend drops any
 * image without one rather than showing it bare.
 */
export function ReferenceImages({ images }: { images: ReferenceImage[] }) {
  const [open, setOpen] = useState<ReferenceImage | null>(null);

  // Escape closes the lightbox, and the body stops scrolling behind it.
  // Without the scroll lock a phone drags the page under the overlay,
  // which reads as the app having frozen.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };

    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (images.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-muted)]">
        What it looks like
      </p>

      {/* Horizontal scroller rather than a grid: on a phone a grid
          shrinks each photo to a thumbnail too small to read a clinical
          sign from, which defeats the point of showing them. */}
      <ul className="-mx-1 mt-2 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {images.map((image) => (
          <li key={image.url} className="w-[10.5rem] shrink-0">
            <button
              type="button"
              onClick={() => setOpen(image)}
              className="block w-full text-left"
              aria-label={`Enlarge: ${image.caption}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.caption}
                loading="lazy"
                className="h-[7.5rem] w-full rounded-lg border border-[var(--color-brand-border)] object-cover"
              />
              <p className="mt-1.5 text-[0.71875rem] leading-snug text-[var(--color-brand-fg)]">
                {image.caption}
              </p>
              {image.severity === 'early' && (
                // Worth calling out. The early photographs are the ones
                // a farmer can still act on, and they look far less
                // dramatic than the late ones — without a label they
                // read as the least important of the set.
                <span className="mt-1 inline-block rounded-full bg-[var(--color-brand-accent)] px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--color-brand-primary-deep)]">
                  Early sign
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-[var(--color-brand-muted)]">
        Examples from other farms. Birds vary — use these to compare, not to confirm.
      </p>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X className="h-4 w-4" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={open.url}
            alt={open.caption}
            className="max-h-[70vh] max-w-full rounded-lg object-contain"
          />

          <p className="mt-3 max-w-[32rem] text-center text-[0.84375rem] leading-relaxed text-white">
            {open.caption}
          </p>
          {/* Credit shown to the farmer, not just held in config. These
              are other people's photographs and attribution belongs
              where the image is actually looked at. */}
          <p className="mt-1.5 max-w-[32rem] text-center text-[0.65625rem] text-white/50">
            {open.credit}
          </p>
        </div>
      )}
    </div>
  );
}
