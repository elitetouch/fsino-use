'use client';

import { Check } from 'lucide-react';
import {
  ALL_PERMISSION_KEYS, MANAGER_LIKE_PRESET, PERMISSION_GROUPS,
  STAFF_DEFAULT_PRESET, type PermissionDef,
} from '@/lib/permissions';
import { cn } from '@/lib/utils';

/**
 * PermissionsPicker — owner-friendly checkbox grid for granting
 * farm-permission keys to a staff member or invite.
 *
 * Replaces the raw-JSON editor a farm owner can't reasonably parse.
 * Each row pairs a plain-English label with a one-line hint so they
 * know what they're granting. Three quick-set buttons cover the
 * common cases: All on / Manager-like / Field-worker.
 *
 * Controlled — caller owns the state object (record of key → true).
 */
export function PermissionsPicker({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, true>;
  onChange: (next: Record<string, true>) => void;
  disabled?: boolean;
}) {
  function toggle(key: string) {
    const next = { ...value };
    if (next[key]) delete next[key];
    else next[key] = true;
    onChange(next);
  }

  function setAll(map: Record<string, true>) {
    onChange({ ...map });
  }

  const selectedCount = Object.values(value).filter(Boolean).length;

  return (
    <div className={cn(disabled && 'pointer-events-none opacity-60')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--color-brand-muted)]">
          <strong className="text-[var(--color-brand-fg)]">{selectedCount}</strong> of {ALL_PERMISSION_KEYS.length} permissions selected
        </p>
        <div className="flex flex-wrap gap-1.5">
          <PresetButton
            label="Field worker"
            active={isSubsetEqual(value, STAFF_DEFAULT_PRESET)}
            onClick={() => setAll(STAFF_DEFAULT_PRESET)}
          />
          <PresetButton
            label="Manager-like"
            active={isSubsetEqual(value, MANAGER_LIKE_PRESET)}
            onClick={() => setAll(MANAGER_LIKE_PRESET)}
          />
          <PresetButton
            label="Everything"
            active={selectedCount === ALL_PERMISSION_KEYS.length}
            onClick={() => setAll(Object.fromEntries(ALL_PERMISSION_KEYS.map((k) => [k, true])) as Record<string, true>)}
          />
          <PresetButton
            label="Clear"
            active={selectedCount === 0}
            onClick={() => setAll({})}
          />
        </div>
      </div>

      <div className="space-y-4">
        {PERMISSION_GROUPS.map((group) => (
          <fieldset
            key={group.heading}
            className="rounded-xl border border-[var(--color-brand-border)] bg-white"
          >
            <legend className="ml-3 mr-3 px-1.5 text-[12px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
              {group.heading}
            </legend>
            {group.description && (
              <p className="px-4 pt-1 text-[11.5px] text-[var(--color-brand-muted)]">{group.description}</p>
            )}
            <div className="grid gap-1 px-2 pb-2 pt-1 sm:grid-cols-2">
              {group.items.map((perm) => (
                <PermissionRow
                  key={perm.key}
                  perm={perm}
                  checked={!!value[perm.key]}
                  onChange={() => toggle(perm.key)}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function PermissionRow({
  perm, checked, onChange,
}: {
  perm: PermissionDef;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-lg p-2.5 transition-colors',
        checked
          ? 'bg-[var(--color-brand-accent)]/55'
          : 'hover:bg-[var(--color-brand-surface-soft)]',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-all',
          checked
            ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]'
            : 'border-[var(--color-brand-input-border)] bg-white group-hover:border-[var(--color-brand-primary)]/50',
        )}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3.5} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">{perm.label}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">{perm.hint}</p>
      </div>
    </label>
  );
}

function PresetButton({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
        active
          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
          : 'border-[var(--color-brand-input-border)] bg-white text-[var(--color-brand-muted)] hover:border-[var(--color-brand-primary)]/40 hover:text-[var(--color-brand-fg)]',
      )}
    >
      {label}
    </button>
  );
}

function isSubsetEqual(a: Record<string, true>, b: Record<string, true>): boolean {
  const ak = Object.keys(a).filter((k) => a[k]).sort();
  const bk = Object.keys(b).filter((k) => b[k]).sort();
  if (ak.length !== bk.length) return false;
  return ak.every((k, i) => k === bk[i]);
}
