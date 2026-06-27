'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Camera, Check, ChevronRight,
  Cpu, Keyboard, Loader2, QrCode, ShieldAlert, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import { apiErrorMessage, endpoints } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Pair PENKEEP to this pen.
 *
 * Two paths into the same submission:
 *
 *   1. Scan the QR code on the back of the unit. We use the native
 *      BarcodeDetector API where supported (Chrome / Edge / Brave on
 *      Android + desktop; Safari from iOS 17 with the flag). When the
 *      API is missing, the scanner tab is hidden and the page falls
 *      back to manual entry — no library dependency, no surprise
 *      camera permission dialogs.
 *
 *   2. Type the device id from the label. Same validation either way
 *      — both paths route through endpoints.lookupPenkeepDevice +
 *      pairPenkeepDevice.
 *
 * Verification is two-stage so the user sees a green "yes, that's
 * yours" line before committing the pair POST:
 *
 *   a. lookupPenkeepDevice — checks the id exists AND is allocated to
 *      the user's farm AND isn't deactivated.
 *   b. pairPenkeepDevice — actually attaches device.pen_id and
 *      triggers new_flock_cmd on the server.
 *
 * After a successful pair, we route to /cycles/<active>/ → climate
 * tab if there's an active flock, otherwise to /pens/<id>.
 */
export default function PairDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: penId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const [mode, setMode] = useState<'scan' | 'manual'>('manual');
  const [deviceId, setDeviceId] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const [scannerSupported, setScannerSupported] = useState<boolean | null>(null);

  // Detect BarcodeDetector. Done after mount so SSR doesn't crash on
  // window access; we set null first to render a "checking" state.
  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    setScannerSupported(ok);
    if (ok) setMode('scan');
  }, []);

  const pair = useMutation({
    mutationFn: (id: string) => endpoints.pairPenkeepDevice(penId, id),
    onSuccess: () => {
      toast.success('PENKEEP paired with this pen.');
      qc.invalidateQueries({ queryKey: ['pen-climate'] });
      qc.invalidateQueries({ queryKey: ['flocks'] });
      router.push('/pens');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not pair this device.')),
  });

  /**
   * Verify a device id against the server. Called on form submit
   * (manual mode) and on successful QR decode (scan mode). On a
   * green result we don't auto-pair — we wait for an explicit
   * confirm tap so the user has a chance to verify the label /
   * status before committing.
   */
  const verify = async (raw: string) => {
    const id = raw.trim().toUpperCase();
    if (id === '') {
      setLookup({ kind: 'error', message: 'Type the device id from the label on the back of the unit.' });
      return;
    }
    setLookup({ kind: 'verifying', deviceId: id });
    try {
      const result = await endpoints.lookupPenkeepDevice(id);
      setLookup({ kind: 'ok', device: result });
    } catch (err) {
      setLookup({ kind: 'error', message: apiErrorMessage(err, 'Could not verify that device.') });
    }
  };

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden sm:space-y-5">
      <Link
        href="/pens"
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-brand-muted)] hover:text-[var(--color-brand-primary-deep)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to pens
      </Link>

      <PageHeader
        eyebrow="PENKEEP"
        title="Pair a device with this pen"
        description="Scan the QR code on the back of the unit, or type its device id. Once paired, the pen climate tab will go live."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Left: pair flow */}
        <div className="space-y-4">
          {/* Mode toggle */}
          {scannerSupported && (
            <div className="inline-flex rounded-full bg-[var(--color-brand-bg)] p-1">
              <ModeTab
                active={mode === 'scan'}
                onClick={() => setMode('scan')}
                icon={QrCode}
                label="Scan QR"
              />
              <ModeTab
                active={mode === 'manual'}
                onClick={() => setMode('manual')}
                icon={Keyboard}
                label="Type id"
              />
            </div>
          )}

          {mode === 'scan' && scannerSupported ? (
            <ScannerCard onDecode={(id) => { setDeviceId(id); verify(id); }} />
          ) : (
            <ManualCard
              deviceId={deviceId}
              onChange={setDeviceId}
              onSubmit={() => verify(deviceId)}
              verifying={lookup.kind === 'verifying'}
            />
          )}

          {/* Lookup feedback */}
          <LookupResult
            state={lookup}
            onConfirm={() => {
              if (lookup.kind === 'ok') pair.mutate(lookup.device.device_id);
            }}
            pairing={pair.isPending}
            onTryAnother={() => { setLookup({ kind: 'idle' }); setDeviceId(''); }}
          />
        </div>

        {/* Right: help / setup steps */}
        <HelpPanel />
      </div>
    </div>
  );
}

/* ─────────────────────────── Lookup result ─────────────────────────── */

type LookupState =
  | { kind: 'idle' }
  | { kind: 'verifying'; deviceId: string }
  | { kind: 'ok'; device: { device_id: string; label: string | null; status: string; paired_pen_id: string | null; billing_ends_at: string | null } }
  | { kind: 'error'; message: string };

function LookupResult({
  state, onConfirm, pairing, onTryAnother,
}: {
  state: LookupState;
  onConfirm: () => void;
  pairing: boolean;
  onTryAnother: () => void;
}) {
  if (state.kind === 'idle') return null;

  if (state.kind === 'verifying') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-white p-4">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-primary-deep)]" />
        <p className="text-[12.5px] text-[var(--color-brand-fg-soft)]">
          Checking <span className="font-mono text-[var(--color-brand-fg)]">{state.deviceId}</span>…
        </p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold text-rose-900">Could not pair</p>
            <p className="mt-0.5 break-words text-[12px] leading-snug text-rose-900">{state.message}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onTryAnother}>
            Try another id
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/contact">
              Contact support
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const alreadyPaired = state.device.paired_pen_id !== null;
  return (
    <div className="rounded-2xl border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-accent)]/30 p-4">
      <div className="flex items-start gap-3">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 fill-[var(--color-brand-primary)] text-white" strokeWidth={2.4} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold text-[var(--color-brand-primary-deep)]">
            Device verified — ready to pair
          </p>
          <p className="mt-0.5 break-all text-[12px] text-[var(--color-brand-fg-soft)]">
            <span className="font-mono">{state.device.device_id}</span>
            {state.device.label ? <> · {state.device.label}</> : null}
          </p>
          {alreadyPaired && (
            <p className="mt-1.5 text-[11.5px] leading-snug text-amber-800">
              This device is currently paired to another pen on your farm. Pairing here will move it.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onConfirm} disabled={pairing}>
          {pairing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {alreadyPaired ? 'Move to this pen' : 'Confirm pair'}
        </Button>
        <Button variant="outline" size="sm" onClick={onTryAnother}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Scanner card ─────────────────────────── */

function ScannerCard({ onDecode }: { onDecode: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Start the camera + detection loop. Cleans up the stream and loop
  // on unmount, on stop, and on the page navigating away.
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    // BarcodeDetector isn't in the lib.dom types yet on Next's TS
    // toolchain; we use unknown + an inline cast at the call site.
    let detector: unknown = null;

    const start = async () => {
      try {
        // Prefer back camera on phones; ideal facingMode falls back to
        // any camera when the device only has one.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const track = stream.getVideoTracks()[0];
        // Torch / flash support — phones often have it, laptops don't.
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setHasFlash(!!caps?.torch);

        const BDClass = (window as unknown as { BarcodeDetector: new (init?: object) => unknown }).BarcodeDetector;
        detector = new BDClass({ formats: ['qr_code'] });
        setRunning(true);

        // Scan loop — once per ~150ms. Stop the moment we decode a
        // PENKEEP-prefixed string; ignore everything else (a random
        // QR on the table shouldn't pair).
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await (detector as { detect: (s: HTMLVideoElement) => Promise<{ rawValue?: string }[]> })
              .detect(videoRef.current);
            const found = codes
              .map((c) => c.rawValue ?? '')
              .find((v) => v.trim().toUpperCase().startsWith('PENKEEP-'));
            if (found) {
              onDecode(found.trim().toUpperCase());
              stopStream();
              return;
            }
          } catch {
            // Single-frame detector glitches happen; keep scanning.
          }
          rafId = window.setTimeout(() => requestAnimationFrame(tick), 150) as unknown as number;
        };
        tick();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera permission denied.');
      }
    };

    start();

    return () => {
      cancelled = true;
      window.clearTimeout(rafId);
      stopStream();
    };

    function stopStream() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRunning(false);
    }
  }, [onDecode]);

  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !flashOn } as MediaTrackConstraintSet] });
      setFlashOn((v) => !v);
    } catch {
      // not supported, ignore
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
        <p className="text-[12.5px] font-bold text-amber-900">Camera unavailable</p>
        <p className="mt-0.5 text-[12px] leading-snug text-amber-900">
          {error}. Use the <strong>Type id</strong> tab instead.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-black">
      <div className="relative aspect-[4/3] w-full">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
        />
        {/* Reticle */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-3/5 w-3/5 max-w-[260px]">
            <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white/90" />
            <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white/90" />
            <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/90" />
            <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/90" />
          </div>
        </div>
        {/* Helper line */}
        <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 px-4">
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur',
            running ? 'bg-[var(--color-brand-primary)]/85 text-white' : 'bg-white/70 text-[var(--color-brand-fg)]',
          )}>
            <Camera className="h-3.5 w-3.5" />
            {running ? 'Scanning' : 'Initialising'}
          </span>
          {hasFlash && (
            <button
              type="button"
              onClick={toggleFlash}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand-fg)] backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {flashOn ? 'Flash off' : 'Flash on'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Manual entry ─────────────────────────── */

function ManualCard({
  deviceId, onChange, onSubmit, verifying,
}: {
  deviceId: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  verifying: boolean;
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="space-y-3"
      >
        <div>
          <Label htmlFor="device-id">PENKEEP device id</Label>
          <Input
            id="device-id"
            placeholder="PENKEEP-88E48EB5AA8C"
            autoComplete="off"
            inputMode="text"
            value={deviceId}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            disabled={verifying}
            className="font-mono uppercase tracking-tight"
          />
          <FieldError message={undefined} />
          <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">
            Look on the back of the unit. The id starts with <code className="font-mono">PENKEEP-</code> followed by a 12-character hex string.
          </p>
        </div>
        <Button type="submit" size="sm" disabled={verifying} className="w-full sm:w-auto">
          {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Verify
        </Button>
      </form>
    </div>
  );
}

function ModeTab({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof QrCode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition',
        active
          ? 'bg-white text-[var(--color-brand-primary-deep)] shadow-sm'
          : 'text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ─────────────────────────── Help panel ─────────────────────────── */

function HelpPanel() {
  return (
    <aside className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Cpu className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            Before you pair
          </p>
          <h2 className="mt-1 text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            Check three things
          </h2>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        <Step n={1} title="Device is powered on">
          The screen should show three temperature zones. If it&rsquo;s blank, plug it in and wait 30 seconds.
        </Step>
        <Step n={2} title="Connected to Wi-Fi">
          The Wi-Fi icon on the screen should be solid green. If not, tap <strong>Reset Wi-Fi</strong> on the device and join the <code className="font-mono">PENKEEP-Setup</code> hotspot from your phone first.
        </Step>
        <Step n={3} title="Allocated to your farm">
          If the device isn&rsquo;t allocated to your farm, support can register your purchase from their end. We&rsquo;ll tell you with a friendly red box if it isn&rsquo;t yours.
        </Step>
      </ol>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
          <p className="text-[11.5px] leading-snug text-amber-900">
            One device per pen. Pairing here will move the unit if it&rsquo;s currently on a different pen on your farm.
          </p>
        </div>
      </div>
    </aside>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 p-3">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[11px] font-bold text-white">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold text-[var(--color-brand-fg)]">{title}</p>
        <p className="mt-0.5 break-words text-[11.5px] leading-snug text-[var(--color-brand-fg-soft)]">{children}</p>
      </div>
    </li>
  );
}
