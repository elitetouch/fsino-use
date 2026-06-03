'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Check, Bird } from 'lucide-react';
import type { FlockDto, PenDto } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Cycle picker — the dark-green dropdown that anchors every cycle-aware
 * page (mirrors the "Cycle 1 ▾" control at the top of the mobile
 * dashboard).
 *
 * Lists every flock the current farm has across all pens, grouped by
 * pen. Active item gets the brand-primary check; click swaps the
 * selected cycle and routes to its detail page.
 */
export function CyclePicker({
  cycles,
  pens,
  currentCycleId,
}: {
  cycles: FlockDto[];
  pens: PenDto[];
  currentCycleId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  /**
   * Viewport-bounded positioning.
   *
   * Pure CSS positioning broke depending on the host container:
   *   - Dashboard:   picker sits in a left-aligned flex column → button
   *                  near viewport-left → `left-0` was fine, but
   *                  `-translate-x-1/2` pushed the panel off the LEFT
   *                  edge.
   *   - Cycle page:  picker sits inside flex-col items-center → button
   *                  centred → `left-0` overflowed RIGHT.
   *
   * Standard popover trick: measure the button on open, compute a
   * `position: fixed` left/top that anchors the panel to the button's
   * left edge while clamping it inside the viewport. Recomputed on
   * resize/scroll so a phone rotation or a page scroll keeps the
   * panel aligned (and prevents it visually detaching from the button
   * while the user scrolls under it).
   */
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function recompute() {
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const margin = 12;          // gutter from each viewport edge
      const ideal = 320;          // desired panel width
      const width = Math.min(ideal, window.innerWidth - margin * 2);
      const idealLeft = r.left;   // natural anchor: button's left edge
      const maxLeft = window.innerWidth - width - margin;
      const minLeft = margin;
      const left = Math.max(minLeft, Math.min(idealLeft, maxLeft));
      const top = r.bottom + 8;
      setPos({ left, top, width });
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = cycles.find((c) => c.id === currentCycleId) ?? cycles[0];

  // Group cycles by pen for the dropdown.
  const byPen = new Map<string | null, FlockDto[]>();
  for (const c of cycles) {
    const key = c.penId ?? null;
    if (!byPen.has(key)) byPen.set(key, []);
    byPen.get(key)!.push(c);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2.5 rounded-lg bg-[var(--color-brand-primary-dark)] px-4 py-2 text-white shadow-sm transition-colors hover:bg-[#062c0d]"
        aria-expanded={open}
      >
        <Bird className="h-4 w-4 text-[var(--color-brand-accent-strong)]" strokeWidth={2.2} />
        <span className="text-[13px] font-semibold tracking-tight">
          {current ? cycleLabel(current, cycles) : 'Select cycle'}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && pos && (
        // `position: fixed` with measured coords — see the
        // useLayoutEffect above for the clamp logic. The DOM tree
        // still has this <div> as a child of the `ref` wrapper, so
        // the click-outside detection (mousedown → ref.contains)
        // keeps working even though we're laid out in viewport space.
        <div
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          className="animate-fade-up fixed z-40 overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white shadow-[0_30px_60px_-25px_rgba(15,80,30,0.25)]"
        >
          <div className="max-h-[420px] overflow-y-auto p-1.5">
            {cycles.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--color-brand-muted)]">
                No cycles yet —{' '}
                <Link href="/setup/flocks" className="font-semibold text-[var(--color-brand-primary)] hover:underline">
                  place a flock
                </Link>
              </div>
            ) : (
              Array.from(byPen.entries()).map(([penId, items]) => {
                const pen = pens.find((p) => p.id === penId);
                return (
                  <div key={penId ?? 'unassigned'} className="mb-1">
                    <p className="px-2.5 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
                      {pen ? pen.name : 'Unassigned'}
                    </p>
                    {items.map((c, i) => {
                      const active = c.id === current?.id;
                      return (
                        <Link
                          key={c.id}
                          href={`/cycles/${c.id}`}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] transition-colors',
                            active ? 'bg-[var(--color-brand-accent)]' : 'hover:bg-[var(--color-brand-surface-soft)]',
                          )}
                        >
                          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary-deep)]">
                            <Bird className="h-3.5 w-3.5" strokeWidth={2.2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[var(--color-brand-fg)]">
                              Cycle {cycleOrdinal(c, items, i)} · {c.breed}
                            </p>
                            <p className="truncate text-[11px] text-[var(--color-brand-muted)]">
                              {labelForProduction(c.productionType)} · {c.placedBirds.toLocaleString()} birds · placed {fmtDate(c.startDate)}
                            </p>
                          </div>
                          {active && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
          <div className="border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-3 py-2.5">
            <Link
              href="/cycles"
              onClick={() => setOpen(false)}
              className="text-[12px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
            >
              View all cycles →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function cycleLabel(c: FlockDto, all: FlockDto[]): string {
  const idx = all.findIndex((x) => x.id === c.id);
  return `Cycle ${idx + 1} · ${c.breed}`;
}

function cycleOrdinal(c: FlockDto, items: FlockDto[], i: number): number {
  return i + 1;
}

function labelForProduction(t: FlockDto['productionType']): string {
  return t === 'broiler' ? 'Broiler' : t === 'layer' ? 'Layer' : 'Dual-purpose';
}
