import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'farm',   label: 'Farm' },
  { key: 'pens',   label: 'Pens' },
  { key: 'flocks', label: 'Flocks' },
  { key: 'done',   label: 'Done' },
] as const;

export type SetupStep = (typeof STEPS)[number]['key'];

/**
 * Horizontal step indicator at the top of the setup-flow card. Dot →
 * check transitions reflect completion. Reads as a path on desktop,
 * compacts to numbered dots on phones.
 */
export function SetupStepper({ current }: { current: SetupStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-7 flex items-center justify-between gap-1 sm:gap-2">
      {STEPS.map((step, i) => {
        const status: 'done' | 'current' | 'todo' =
          i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                status === 'done' && 'bg-[var(--color-brand-primary)] text-white',
                status === 'current' && 'bg-[var(--color-brand-primary)] text-white ring-4 ring-[var(--color-brand-primary)]/15',
                status === 'todo' && 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
              )}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              {status === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </div>
            <span
              className={cn(
                'hidden text-xs font-semibold uppercase tracking-wider transition-colors sm:inline',
                status === 'todo' ? 'text-[var(--color-brand-muted)]' : 'text-[var(--color-brand-fg)]',
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 transition-colors',
                  i < currentIndex
                    ? 'bg-[var(--color-brand-primary)]'
                    : 'bg-[var(--color-brand-border)]',
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
