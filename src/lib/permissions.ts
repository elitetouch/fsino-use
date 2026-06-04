/**
 * Farm-permission catalogue — the source of truth for what an owner
 * can grant a staff member, presented in farmer-friendly groups so the
 * invite & edit dialogs show checkboxes (not JSON).
 *
 * Keys here MUST match the backend's farm.perm:<key> middleware so the
 * frontend selection has actual effect server-side. The list was lifted
 * by grepping every `->middleware('farm.perm:…')` in routes/api/v1.php.
 *
 * Role defaults:
 *   owner   → bypasses all permission checks (full access)
 *   manager → bypasses all permission checks (full access bar owner-grant)
 *   staff   → no permissions by default — owner picks the checkboxes
 */

export type FarmRole = 'owner' | 'manager' | 'staff';

export interface PermissionDef {
  /** Server-side key — passed as the middleware argument and stored in pivot.permissions. */
  key: string;
  /** Short human label shown next to the checkbox. */
  label: string;
  /** One-line explanation under the label so the owner knows what they're granting. */
  hint: string;
}

export interface PermissionGroup {
  /** Section heading — must read clearly to a non-technical farm owner. */
  heading: string;
  /** Sub-explanation rendered in muted type below the heading. */
  description?: string;
  items: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    heading: 'Pens',
    description: 'What this person can do with the physical houses.',
    items: [
      { key: 'pens.view',    label: 'See pens',       hint: 'Browse the pen list and pen details.' },
      { key: 'pens.create',  label: 'Add new pens',   hint: 'Create new houses, cages or sections.' },
      { key: 'pens.update',  label: 'Edit pens',      hint: 'Rename, change capacity, change pen type.' },
      { key: 'pens.archive', label: 'Archive pens',   hint: 'Retire a pen so it no longer accepts flocks.' },
    ],
  },
  {
    heading: 'Flocks',
    description: 'Placing, renewing and archiving cycles of birds.',
    items: [
      { key: 'flocks.view',    label: 'See flocks',          hint: 'View the cycles list and each cycle’s results.' },
      { key: 'flocks.create',  label: 'Place new flocks',    hint: 'Start a new cycle in a free pen (consumes tokens).' },
      { key: 'flocks.renew',   label: 'Renew flocks',        hint: 'Extend the validity of an existing cycle.' },
      { key: 'flocks.archive', label: 'Archive flocks',      hint: 'Close out a cycle and free up its pen.' },
    ],
  },
  {
    heading: 'Daily records',
    description: 'Logging feed, water, vaccines, mortality and weigh-ins.',
    items: [
      { key: 'flocks.records.create', label: 'Add records',  hint: 'Log new feed / water / vaccine / mortality entries.' },
      { key: 'flocks.records.update', label: 'Edit records', hint: 'Fix typos or adjust a previously-logged entry.' },
    ],
  },
  {
    heading: 'Settings & preferences',
    description: 'Farm-wide configuration and personal preferences.',
    items: [
      { key: 'settings.view',        label: 'See farm settings',   hint: 'Read the farm’s configuration.' },
      { key: 'settings.update',      label: 'Change farm settings', hint: 'Edit name, address, timezone, etc.' },
      { key: 'preferences.update',   label: 'Set their preferences', hint: 'Personal layout/notification preferences on this farm.' },
    ],
  },
  {
    heading: 'Team & billing',
    description: 'Power-user actions — grant carefully.',
    items: [
      { key: 'staff_manage.view',   label: 'See team members',   hint: 'View the people list and pending invites.' },
      { key: 'staff_manage.create', label: 'Invite new members', hint: 'Send invite emails to add new staff.' },
      { key: 'staff_manage.update', label: 'Edit member access', hint: 'Change roles and permissions of others.' },
      { key: 'staff_manage.delete', label: 'Revoke invites',     hint: 'Cancel a pending invitation.' },
      { key: 'billing.manage',      label: 'Buy tokens & pay',   hint: 'Initiate token purchases for the account.' },
    ],
  },
];

/** Flat list of every key — handy for "select all" / "clear all" actions. */
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap(
  (g) => g.items.map((i) => i.key),
);

/**
 * Reasonable preset for the most common staff role: a field worker who
 * logs daily records and can see (but not place) flocks. The owner can
 * tick more on top.
 */
export const STAFF_DEFAULT_PRESET: Record<string, true> = {
  'pens.view': true,
  'flocks.view': true,
  'flocks.records.create': true,
  'preferences.update': true,
};

/**
 * Manager preset — everything except billing and team-admin tasks the
 * owner usually keeps for themselves. Useful as a one-click "make
 * manager-like" button when assigning the staff role with broad access.
 */
export const MANAGER_LIKE_PRESET: Record<string, true> = ALL_PERMISSION_KEYS.reduce(
  (acc, k) => {
    if (k.startsWith('staff_manage.')) return acc;
    if (k === 'billing.manage') return acc;
    acc[k] = true;
    return acc;
  },
  {} as Record<string, true>,
);

/**
 * Normalise permissions — accept three shapes and return the flat-key map:
 *
 *   1. Modern flat-key object  { "flocks.records.create": true }
 *   2. Legacy nested object    { flocks: { records: { create: true } } }
 *   3. Raw JSON string         '{"flocks.records.create":true}'
 *
 * (3) exists because the pivot column is jsonb on Postgres and older
 * API responses sometimes returned it as a raw string when the resource
 * forgot to decode it. Defensive handling here means a single resource
 * regression doesn't wipe out a staff user's permissions client-side.
 */
export function normalisePermissions(value: unknown): Record<string, true> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalisePermissions(parsed);
    } catch {
      return {};
    }
  }
  const out: Record<string, true> = {};
  if (!value || typeof value !== 'object') return out;
  const flatten = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (v === true) {
        out[full] = true;
      } else if (v && typeof v === 'object') {
        flatten(v as Record<string, unknown>, full);
      }
    }
  };
  flatten(value as Record<string, unknown>, '');
  return out;
}
