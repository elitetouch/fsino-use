'use client';

import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Camera, ImageUp, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { Analysing } from '@/components/diagnose/analysing';
import { ResultCard } from '@/components/diagnose/result-card';
import { CyclePicker } from '@/components/diagnose/cycle-picker';
import { PastChecks } from '@/components/diagnose/past-checks';
import { endpoints, apiErrorMessage, type DiagnosisDto } from '@/lib/api';

/**
 * Disease diagnosis from a photograph of droppings.
 *
 * DESIGNED FOR ONE HAND, IN A PEN, IN SUNLIGHT.
 *
 * The farmer opening this has already seen something wrong with their
 * birds. So the screen opens directly on the camera button — no
 * dropdown to pick a cycle first, no explanation to read past. Every
 * optional thing is below the fold or removed.
 *
 * The photo guidance is the highest-leverage element here. Most
 * refusals are bad photos, not a bad model, and a farmer who gets
 * refused twice stops trusting the tool. Showing what a good photo
 * looks like BEFORE the camera opens prevents more failures than any
 * amount of error handling after the fact.
 */
export default function DiagnosePage() {
  // useSearchParams() forces client rendering of everything beneath it,
  // so the boundary lives here rather than around the whole route.
  return (
    <Suspense fallback={null}>
      <Diagnose />
    </Suspense>
  );
}

function Diagnose() {
  // Set by the push notification a vet's reply sends:
  // /diagnose?check=<id>. Opens that check in Past checks below.
  const highlightId = useSearchParams().get('check');

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DiagnosisDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Which cycle this check belongs to. Optional — droppings turn up
  // outside tracked pens — but it is what makes the result eligible for
  // the cycle report.
  const [flockId, setFlockId] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const diagnose = useMutation({
    mutationFn: (f: File) => endpoints.diagnose(f, flockId ?? undefined),
    onSuccess: (d) => {
      setResult(d.diagnosis);
      setError(null);
    },
    onError: (e) =>
      setError(
        apiErrorMessage(
          e,
          "Couldn't check the photo. You need an internet connection for this — everything else in the app works offline.",
        ),
      ),
  });

  const choose = (f: File | undefined) => {
    if (!f) return;

    // Revoke the previous object URL before replacing it. Each preview
    // holds the full image in memory until released, and a farmer
    // retaking a photo four times on a cheap Android would otherwise
    // accumulate all four.
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    setFile(f);
    setResult(null);
    setError(null);
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setResult(null);
    setError(null);
    diagnose.reset();
  };

  const busy = diagnose.isPending;

  return (
    /*
     * The page is wide on desktop; each STATE decides how to use it.
     *
     * An earlier cut kept the camera screens pinned to 35rem on the
     * reasoning that stretching "take a photo" across a 27-inch monitor
     * makes it harder to use. That is true of the BUTTON and not of the
     * PAGE — the fix is a second column, not a wider button. So the
     * container is wide throughout and the states that need a narrow
     * measure (confirm, analysing) impose it on themselves.
     */
    <div className="mx-auto w-full max-w-[68.75rem] space-y-5 pb-8">
      <PageHeader
        eyebrow="Health check · Beta"
        title="Disease check"
        description="Photograph droppings from the pen and get a likely diagnosis in about ten seconds."
      />

      <BetaNotice />

      {/* Hidden inputs. `capture="environment"` opens the REAR camera
          directly on a phone rather than a file browser — one tap
          instead of three, which matters when the other hand is holding
          a torch. Gallery stays available for a photo taken earlier. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => choose(e.target.files?.[0])}
      />

      {/*
        * ABOVE THE CAMERA, not on the confirm step.
        *
        * It used to sit after the photo, on the reasoning that asking
        * which cycle before the shutter puts a question between the
        * farmer and the camera. That held while the link was optional.
        * Now it is required, and a farm with no running cycle cannot
        * run a check at all — finding that out AFTER walking to the pen
        * and taking a photo is the worse interruption by far.
        *
        * It is not much of a question in practice: with one running
        * cycle it auto-selects and just states which birds are being
        * checked, and with none it explains why the camera is off.
        */}
      {!result && <CyclePicker value={flockId} onChange={setFlockId} />}

      {busy && preview ? (
        // Narrow on purpose: one photograph and a progress line. There
        // is nothing to put beside it.
        <div className="mx-auto w-full max-w-[35rem]">
          <Analysing preview={preview} />
        </div>
      ) : result ? (
        <ResultCard result={result} onRetake={reset} />
      ) : preview ? (
        /*
         * PHOTO LEFT, DECISION RIGHT.
         *
         * An earlier cut kept this narrow on the reasoning that there
         * was "nothing to put beside the photograph". There is: the
         * cycle picker and both buttons. Stacked, "Check this photo"
         * sat below a 380px image and on a laptop could fall under the
         * fold — the primary action of the screen, out of sight.
         *
         * Side by side the photograph also gets more room, which is the
         * thing the farmer is actually being asked to judge.
         */
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <Confirm
            preview={preview}
            error={error}
            onDiagnose={() => file && diagnose.mutate(file)}
            onRetake={reset}
          />

          <div className="space-y-4">
            <p className="text-[0.78125rem] leading-relaxed text-[var(--color-brand-muted)]">
              Can you see the droppings clearly? If not, take it again.
            </p>

            {error && (
              <p className="rounded-lg border border-[var(--color-brand-danger)]/30 bg-[var(--color-brand-danger)]/[0.06] p-3 text-[0.78125rem] font-medium text-[var(--color-brand-danger)]">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={reset}>
                Retake
              </Button>
              {/* Gated on a cycle. The server rejects an unlinked check,
                  so letting the tap through would spend a ten-second
                  upload to earn a validation error. */}
              <Button
                size="sm"
                className="flex-1"
                disabled={!flockId}
                onClick={() => file && flockId && diagnose.mutate(file)}
              >
                Check this photo
              </Button>
            </div>

            {!flockId && (
              // Only once a photo exists. Saying "pick a cycle" before
              // they have taken one would put a question between the
              // farmer and the camera, which is the thing this screen
              // exists to avoid.
              <p className="text-[0.71875rem] leading-relaxed text-[var(--color-brand-muted)]">
                Choose a cycle above to run the check.
              </p>
            )}
          </div>
        </div>
      ) : (
        <Start
          ready={flockId !== null}
          onCamera={() => cameraRef.current?.click()}
          onGallery={() => galleryRef.current?.click()}
        />
      )}

      {/* Below the camera on purpose — someone opening this page usually
          has sick birds and wants to take a photo, not read an archive.
          It is also the screen a vet's reply notification lands on. */}
      <PastChecks highlightId={highlightId} />
    </div>
  );
}

/**
 * Says plainly that this is not finished.
 *
 * Shown on every state, not tucked into the result card, because the
 * farmer needs the caveat BEFORE they act — and because both failure
 * directions have been seen on real photos: genuine droppings refused,
 * and (before the guards were fixed) a photograph of groceries
 * diagnosed as Coccidiosis at 100% confidence.
 *
 * The honest framing is also what makes the feedback prompt work. People
 * tell you when a tool is wrong if you have admitted it might be; they
 * quietly stop using one that claims to be certain.
 */
function BetaNotice() {
  return (
    <div className="rounded-xl border border-[var(--color-brand-primary)]/25 bg-[var(--color-brand-accent)]/25 p-3.5">
      <p className="text-[0.78125rem] font-semibold text-[var(--color-brand-fg)]">
        This is an early version
      </p>
      <p className="mt-0.5 text-[0.75rem] leading-relaxed text-[var(--color-brand-muted)]">
        It was trained on a limited set of photos, so it will sometimes say it cannot read a
        perfectly good picture — and it can be wrong. Treat every answer as a second opinion,
        never as a replacement for a vet. Telling us whether it got it right is what improves it.
      </p>
    </div>
  );
}

/** Opening state: one obvious action, and how to make it work. */
function Start({
  ready,
  onCamera,
  onGallery,
}: {
  /**
   * False when no cycle is selected — either the farm has none running,
   * or several exist and none is chosen yet.
   *
   * The camera is closed rather than left open to fail later. A check
   * without a cycle is rejected by the server, so opening the camera
   * would walk someone to the pen, have them photograph droppings, and
   * only then tell them it cannot be used. The picker directly above
   * already explains why.
   */
  ready: boolean;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    /*
     * CAMERA LEFT, GUIDANCE RIGHT on wide screens.
     *
     * Stacked, the photo rules sat below the camera button — read after
     * the decision they were meant to inform, if at all. Beside it they
     * are in view while the farmer is still deciding how to frame the
     * shot, which is the only moment they can change anything.
     *
     * That matters more here than it looks. Most refusals are bad
     * photographs rather than a bad model, and a farmer refused twice
     * concludes the tool is broken and stops using it. Guidance read
     * BEFORE the shutter prevents more failures than any error message
     * after it.
     *
     * The camera column is capped rather than filling its half: a
     * dashed drop target stretched across a monitor reads as a page
     * background, not a button.
     */
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-4 lg:mx-auto lg:w-full lg:max-w-[28rem]">
      <button
        type="button"
        onClick={onCamera}
        disabled={!ready}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-accent)]/30 px-6 py-9 transition-colors hover:bg-[var(--color-brand-accent)]/50 disabled:cursor-not-allowed disabled:border-[var(--color-brand-border)] disabled:bg-[var(--color-brand-surface-soft)]/50 disabled:opacity-60 disabled:hover:bg-[var(--color-brand-surface-soft)]/50 lg:py-14"
      >
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-primary)] text-white">
          <Camera className="h-6 w-6" />
        </span>
        <span className="mt-1 text-[0.9375rem] font-bold text-[var(--color-brand-fg)]">Take a photo</span>
        <span className="text-[0.75rem] text-[var(--color-brand-muted)]">
          Opens your camera
        </span>
      </button>

      <button
        type="button"
        onClick={onGallery}
        disabled={!ready}
        className="flex w-full items-center justify-center gap-2 text-[0.78125rem] font-semibold text-[var(--color-brand-primary-deep)] underline underline-offset-2 disabled:no-underline disabled:opacity-45"
      >
        <ImageUp className="h-3.5 w-3.5" />
        Choose a photo you already took
      </button>
      </div>

      <PhotoGuide />
    </div>
  );
}

/**
 * How to take a photo that works.
 *
 * Deliberately on the FIRST screen rather than shown after a failure.
 * The model refuses blurry, distant and cluttered photos by design, and
 * a farmer who is refused twice concludes the tool is broken. Four
 * rules, phrased physically — what to do with the phone, not what the
 * model requires.
 */
function PhotoGuide() {
  return (
    <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
      <h2 className="text-[0.6875rem] font-bold uppercase tracking-wide text-[var(--color-brand-muted)]">
        For the best result
      </h2>
      <ul className="mt-2.5 space-y-2">
        {[
          // "Get close, fill the frame" used to be the first rule here.
          // Measured against the model, that advice was actively
          // harmful: cropping a TRAINING image to a close-up pushed it
          // from 0.248 to 0.572 in feature distance — past its own class
          // threshold. The model learned small droppings within a wider
          // field of ground, so the guidance now matches that.
          'Stand over the droppings and shoot downwards, as you normally would',
          'Include some of the ground around them — do not fill the whole frame',
          'Use daylight if you can, or your torch in a dark pen',
          'Photograph fresh droppings, one patch at a time',
          'Keep birds, hands and feet out of the frame',
        ].map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-[0.8125rem] text-[var(--color-brand-fg)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-primary)]" />
            {tip}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-1.5 text-[0.71875rem] leading-relaxed text-[var(--color-brand-muted)]">
        <WifiOff className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          This check needs internet. The rest of the app keeps working offline.
        </span>
      </p>
    </section>
  );
}

/**
 * Confirm before spending ten seconds and the farmer's mobile data.
 *
 * A blurry photo is obvious to a human at a glance and invisible to the
 * model until it has finished. Letting someone see their own photo
 * large, before committing, catches most bad captures for free.
 */
/**
 * The photograph, for checking before it is sent.
 *
 * Just the image now — the cycle picker, the prompt and the buttons
 * live in the column beside it on wide screens, and stack underneath on
 * a phone. Taller here than the old 380px cap: this is the one thing
 * the farmer is being asked to judge, and on a desktop there is room to
 * let them actually see it.
 */
function Confirm({
  preview, onRetake,
}: {
  preview: string;
  error: string | null;
  onDiagnose: () => void;
  onRetake: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt="The photo you took"
        className="max-h-[23.75rem] w-full object-contain lg:max-h-[32rem]"
      />
      <button
        type="button"
        onClick={onRetake}
        aria-label="Remove this photo"
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
