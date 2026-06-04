'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2, User as UserIcon, Bell, ClipboardList, LayoutDashboard,
  Wallet, Sparkles, ShieldCheck, Check, Settings as Cog,
  Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import {
  apiErrorMessage, endpoints,
  type FarmSettingsDto, type MyPreferencesDto, type DailyRecordPrefs,
} from '@/lib/api';
import { Gate, usePermissions } from '@/lib/access';
import { cn } from '@/lib/utils';

/**
 * Settings & Preferences — the place to configure how the app behaves.
 *
 * The backend models two distinct layers, and this page makes the
 * distinction explicit so the user is never confused about who their
 * change affects.
 *
 *   FARM SETTINGS — affects everyone on this farm.
 *     - Endpoint:    /farm-settings  (GET settings.view, PATCH settings.update)
 *     - Owner/manager bypass both permissions.
 *     - The `dailyRecordConfig` is the HARD CEILING — if the farm
 *       disables an event, no member can record it (server-enforced).
 *
 *   MY PREFERENCES — only affects this user on this farm (per-device,
 *   per-user). Any active member can change theirs; no permission
 *   needed.
 *     - Endpoint:    /my-farm-preferences  (GET/PATCH, both unguarded)
 *     - Can only narrow inside the farm ceiling; can't re-enable
 *       something the farm has disabled.
 *
 * The page renders the two sections side-by-side on desktop, stacked
 * on mobile. Each section has its own <Gate> so a staff user without
 * settings.view simply doesn't see the Farm Settings panel.
 *
 * All mutations are partial PATCHes — the server deep-merges, so we
 * only ever send the toggle that flipped. That keeps the over-the-wire
 * payload tiny and the optimistic UI honest.
 */
export default function SettingsPage() {
  const perms = usePermissions();

  // Anyone with EITHER farm-settings access OR personal-preferences
  // access reaches this page (see ROUTE_ACCESS). The page itself
  // gates each panel below.
  const canSeeFarmSettings = perms.can('settings.view') || perms.isOwner || perms.isManager;
  const canEditFarmSettings = perms.can('settings.update') || perms.isOwner || perms.isManager;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Settings & preferences"
        description="Configure FS Manager to fit how you run this farm. Farm settings affect the whole team; your preferences are just for you."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Farm-level — gated. Renders nothing for users without
            settings.view so the layout collapses cleanly to a single
            column. */}
        {canSeeFarmSettings && (
          <FarmSettingsPanel canEdit={canEditFarmSettings} />
        )}

        {/* User-level — every active member sees this. */}
        <MyPreferencesPanel />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  FARM SETTINGS PANEL                                                */
/* ================================================================== */

function FarmSettingsPanel({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['farm-settings'],
    queryFn: () => endpoints.getFarmSettings(),
    staleTime: 30_000,
  });

  const mutate = useMutation({
    mutationFn: endpoints.updateFarmSettings,
    onMutate: async (patch) => {
      // Optimistic — pre-apply the patch so toggles feel instant.
      await qc.cancelQueries({ queryKey: ['farm-settings'] });
      const previous = qc.getQueryData<{ settings: FarmSettingsDto }>(['farm-settings']);
      if (previous) {
        const next: FarmSettingsDto = {
          ...previous.settings,
          dailyRecordPreset: (patch.daily_record_preset as FarmSettingsDto['dailyRecordPreset']) ?? previous.settings.dailyRecordPreset,
          dailyRecordConfig: deepMerge(previous.settings.dailyRecordConfig, (patch.daily_record_config as object) ?? {}) as FarmSettingsDto['dailyRecordConfig'],
          notificationConfig: { ...previous.settings.notificationConfig, ...(patch.notification_config as object ?? {}) } as FarmSettingsDto['notificationConfig'],
        };
        qc.setQueryData(['farm-settings'], { settings: next });
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['farm-settings'], ctx.previous);
      toast.error(apiErrorMessage(err, 'Could not save farm settings.'));
    },
    onSuccess: () => {
      // My-prefs depend on the farm ceiling — invalidate so the
      // effectiveDailyRecord re-computes on the server.
      qc.invalidateQueries({ queryKey: ['my-preferences'] });
    },
  });

  if (settings.isLoading) {
    return <PanelSkeleton title="Farm settings" />;
  }

  if (settings.isError || !settings.data) {
    return (
      <Panel
        icon={Building2}
        eyebrow="Affects everyone on this farm"
        title="Farm settings"
        description="Could not load the farm settings right now. Try refreshing."
      >
        <p className="text-[12px] text-rose-600">
          {apiErrorMessage(settings.error, 'Failed to load farm settings.')}
        </p>
      </Panel>
    );
  }

  const s = settings.data.settings;
  const farmDR = (s.dailyRecordConfig ?? {}) as Record<string, Record<string, boolean>>;
  const farmNotif = (s.notificationConfig ?? {}) as Record<string, boolean>;

  // Helper that prepares a patch for a nested key on the farm's
  // daily-record config so the server deep-merge ends up with the
  // intended value.
  const patchEvent = (event: string, key: string, value: boolean) => {
    mutate.mutate({
      daily_record_config: {
        [event]: { [key]: value },
      },
    });
  };

  return (
    <Panel
      icon={Building2}
      eyebrow="Affects everyone on this farm"
      title="Farm settings"
      description="The data your team captures, and farm-wide alerts. Changes here apply to every member of this farm."
      lockedNote={canEdit ? undefined : 'You can see these settings but only owners and managers can change them.'}
    >
      <Section title="Daily record preset" hint="Choose what your team captures by default. Easy is the minimum, Expert is the full grid.">
        <PresetRow
          value={s.dailyRecordPreset}
          onChange={(p) => mutate.mutate({ daily_record_preset: p })}
          disabled={!canEdit}
        />
      </Section>

      <Section title="What data your team can capture" hint="If you turn something off here, nobody on the farm can record it.">
        <ToggleGrid>
          <ToggleRow label="Feed consumption" desc="Daily feed weight per pen." checked={!!farmDR.feed?.enabled} onChange={(v) => patchEvent('feed', 'enabled', v)} disabled={!canEdit} />
          <ToggleRow label="Water consumption" desc="Daily water volume per pen." checked={!!farmDR.water?.enabled} onChange={(v) => patchEvent('water', 'enabled', v)} disabled={!canEdit} />
          <ToggleRow label="Vaccination" desc="Vaccine name, date and dosage." checked={!!farmDR.vaccination?.enabled} onChange={(v) => patchEvent('vaccination', 'enabled', v)} disabled={!canEdit} />
          <ToggleRow label="Treatment" desc="Antibiotics or other medication." checked={!!farmDR.treatment?.enabled} onChange={(v) => patchEvent('treatment', 'enabled', v)} disabled={!canEdit} />
          <ToggleRow label="Bird weighing" desc="Manual weigh-ins for growth tracking." checked={!!farmDR.weight?.enabled} onChange={(v) => patchEvent('weight', 'enabled', v)} disabled={!canEdit} />
          <ToggleRow label="Egg production" desc="Daily egg count, broken or damaged." checked={!!farmDR.eggs?.enabled} onChange={(v) => patchEvent('eggs', 'enabled', v)} disabled={!canEdit} />
        </ToggleGrid>
      </Section>

      <Section title="Farm-wide notifications" hint="Default channels for everyone on the farm. Members can still narrow these on their own device.">
        <ToggleGrid>
          <ToggleRow label="Daily record reminders" checked={!!farmNotif.daily_record_reminders} onChange={(v) => mutate.mutate({ notification_config: { daily_record_reminders: v } })} disabled={!canEdit} />
          <ToggleRow label="Vaccination reminders" checked={!!farmNotif.vaccination_reminders} onChange={(v) => mutate.mutate({ notification_config: { vaccination_reminders: v } })} disabled={!canEdit} />
          <ToggleRow label="Bird-weighing reminders" checked={!!farmNotif.bird_weighing_reminders} onChange={(v) => mutate.mutate({ notification_config: { bird_weighing_reminders: v } })} disabled={!canEdit} />
          <ToggleRow label="Daily / weekly reports" checked={!!farmNotif.daily_weekly_report} onChange={(v) => mutate.mutate({ notification_config: { daily_weekly_report: v } })} disabled={!canEdit} />
        </ToggleGrid>
      </Section>
    </Panel>
  );
}

/* ================================================================== */
/*  MY PREFERENCES PANEL                                               */
/* ================================================================== */

function MyPreferencesPanel() {
  const qc = useQueryClient();
  const prefs = useQuery({
    queryKey: ['my-preferences'],
    queryFn: () => endpoints.getMyPreferences(),
    staleTime: 30_000,
  });

  const mutate = useMutation({
    mutationFn: endpoints.updateMyPreferences,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['my-preferences'] });
      const previous = qc.getQueryData<{ preferences: MyPreferencesDto }>(['my-preferences']);
      if (previous) {
        // Optimistic merge of the patch's dashboard_config into the
        // current snapshot. We don't try to be clever about effective
        // vs raw — the server returns the recomputed effective on
        // success so we'll catch up.
        const dc = (patch.dashboard_config ?? {}) as Record<string, unknown>;
        const next: MyPreferencesDto = {
          ...previous.preferences,
          viewMode: (dc.view_mode as MyPreferencesDto['viewMode']) ?? previous.preferences.viewMode,
          dailyRecordPreset: (patch.preset as MyPreferencesDto['dailyRecordPreset']) ?? (dc.daily_record_preset as MyPreferencesDto['dailyRecordPreset']) ?? previous.preferences.dailyRecordPreset,
          dailyRecord: deepMerge(previous.preferences.dailyRecord, (dc.daily_record as object) ?? {}) as DailyRecordPrefs,
          dashboard: {
            cards: {
              ...previous.preferences.dashboard.cards,
              ...((dc.dashboard as { cards?: Record<string, boolean> })?.cards ?? {}),
            },
          },
          finance: {
            ...previous.preferences.finance,
            ...((dc.finance as object) ?? {}),
          },
          notifications: {
            ...previous.preferences.notifications,
            ...((dc.notifications as object) ?? {}),
          },
        };
        qc.setQueryData(['my-preferences'], { preferences: next });
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['my-preferences'], ctx.previous);
      toast.error(apiErrorMessage(err, 'Could not save your preferences.'));
    },
  });

  if (prefs.isLoading) {
    return <PanelSkeleton title="My preferences" />;
  }

  if (prefs.isError || !prefs.data) {
    return (
      <Panel
        icon={UserIcon}
        eyebrow="Only for you on this device"
        title="My preferences"
        description="Could not load your preferences right now."
      >
        <p className="text-[12px] text-rose-600">
          {apiErrorMessage(prefs.error, 'Failed to load preferences.')}
        </p>
      </Panel>
    );
  }

  const p = prefs.data.preferences;
  const farmDR = p.farmDailyRecord ?? {};

  // Whether the farm allows a given event — used to grey out my
  // personal toggle when the farm has switched it off. Matches the
  // backend's farmAllows() in PreferenceSchema.
  const farmAllows = (event: string): boolean => {
    const section = (farmDR as Record<string, Record<string, boolean> | undefined>)[event];
    if (!section) return true;
    if (!('enabled' in section)) return true;
    return !!section.enabled;
  };

  // Field-worker permission gate for sections that should only be
  // toggleable when the user has preferences.update.
  return (
    <Panel
      icon={UserIcon}
      eyebrow="Only for you on this device"
      title="My preferences"
      description="How you want the app to look and feel. These settings only affect what you see; teammates have their own."
    >
      <Gate
        perm="preferences.update"
        fallback={
          <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-[var(--color-brand-surface-soft)] p-3.5 text-[12px] text-[var(--color-brand-muted)]">
            Your role doesn&rsquo;t include personal preferences. Ask the farm owner if you need this.
          </div>
        }
      >
        <Section
          icon={LayoutDashboard}
          title="Dashboard view"
          hint="Easy gives you the key cards; Expert adds finance and detailed breakdowns."
        >
          <SegmentedControl
            value={p.viewMode}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'expert', label: 'Expert' },
            ]}
            onChange={(v) => mutate.mutate({ dashboard_config: { view_mode: v } })}
          />
        </Section>

        <Section
          icon={ClipboardList}
          title="My daily record"
          hint="Choose how detailed your daily logging form is. You can only enable what the farm has enabled."
        >
          <PresetRow
            value={p.dailyRecordPreset}
            onChange={(preset) => mutate.mutate({ preset })}
          />
          <ToggleGrid className="mt-3">
            <ToggleRow
              label="Feed"
              desc={farmAllows('feed') ? 'Log feed consumption.' : 'Disabled by the farm.'}
              checked={!!p.dailyRecord.feed?.include && farmAllows('feed')}
              disabled={!farmAllows('feed')}
              onChange={(v) => mutate.mutate({ dashboard_config: { daily_record: { feed: { include: v } } } })}
            />
            <ToggleRow
              label="Water"
              desc={farmAllows('water') ? 'Log water consumption.' : 'Disabled by the farm.'}
              checked={!!p.dailyRecord.water?.include && farmAllows('water')}
              disabled={!farmAllows('water')}
              onChange={(v) => mutate.mutate({ dashboard_config: { daily_record: { water: { include: v } } } })}
            />
            <ToggleRow
              label="Vaccination"
              desc={farmAllows('vaccination') ? 'Log vaccinations.' : 'Disabled by the farm.'}
              checked={!!p.dailyRecord.vaccination?.include && farmAllows('vaccination')}
              disabled={!farmAllows('vaccination')}
              onChange={(v) => mutate.mutate({ dashboard_config: { daily_record: { vaccination: { include: v } } } })}
            />
            <ToggleRow
              label="Treatment"
              desc={farmAllows('treatment') ? 'Log antibiotics or medication.' : 'Disabled by the farm.'}
              checked={!!p.dailyRecord.treatment?.include && farmAllows('treatment')}
              disabled={!farmAllows('treatment')}
              onChange={(v) => mutate.mutate({ dashboard_config: { daily_record: { treatment: { include: v } } } })}
            />
            <ToggleRow
              label="Bird weighing"
              desc={farmAllows('weight') ? 'Manual weigh-ins.' : 'Disabled by the farm.'}
              checked={!!p.dailyRecord.bird_weight?.include && farmAllows('weight')}
              disabled={!farmAllows('weight')}
              onChange={(v) => mutate.mutate({ dashboard_config: { daily_record: { bird_weight: { include: v } } } })}
            />
            <ToggleRow
              label="Eggs"
              desc={farmAllows('eggs') ? 'Egg collection & metrics.' : 'Disabled by the farm.'}
              checked={!!p.dailyRecord.eggs?.include && farmAllows('eggs')}
              disabled={!farmAllows('eggs')}
              onChange={(v) => mutate.mutate({ dashboard_config: { daily_record: { eggs: { include: v } } } })}
            />
          </ToggleGrid>
        </Section>

        <Section
          icon={LayoutDashboard}
          title="Dashboard cards"
          hint="Which cards show up on your dashboard."
        >
          <ToggleGrid>
            <ToggleRow label="Feed" checked={!!p.dashboard.cards.feed} onChange={(v) => mutate.mutate({ dashboard_config: { dashboard: { cards: { feed: v } } } })} />
            <ToggleRow label="Water" checked={!!p.dashboard.cards.water} onChange={(v) => mutate.mutate({ dashboard_config: { dashboard: { cards: { water: v } } } })} />
            <ToggleRow label="Mortality" checked={!!p.dashboard.cards.mortality} onChange={(v) => mutate.mutate({ dashboard_config: { dashboard: { cards: { mortality: v } } } })} />
            <ToggleRow label="Birds sold" checked={!!p.dashboard.cards.birdsSold} onChange={(v) => mutate.mutate({ dashboard_config: { dashboard: { cards: { birdsSold: v } } } })} />
            <ToggleRow label="Bird weight" checked={!!p.dashboard.cards.weight} onChange={(v) => mutate.mutate({ dashboard_config: { dashboard: { cards: { weight: v } } } })} />
            <ToggleRow label="Egg collection" checked={!!p.dashboard.cards.eggCollection} onChange={(v) => mutate.mutate({ dashboard_config: { dashboard: { cards: { eggCollection: v } } } })} />
            <ToggleRow label="Vaccination" checked={!!p.dashboard.cards.vaccination} onChange={(v) => mutate.mutate({ dashboard_config: { dashboard: { cards: { vaccination: v } } } })} />
          </ToggleGrid>
        </Section>

        <Section icon={Wallet} title="Finance" hint="Show or hide the finance section in your dashboard.">
          <ToggleRow label="Show finance section" checked={!!p.finance.enabled} onChange={(v) => mutate.mutate({ dashboard_config: { finance: { enabled: v } } })} />
        </Section>

        <Section icon={Bell} title="My notifications" hint="Personal reminders. These narrow the farm-wide defaults — you can't turn ON something the farm has switched off.">
          <ToggleGrid>
            <ToggleRow label="Daily record reminders" checked={!!p.notifications.daily_record_reminders} onChange={(v) => mutate.mutate({ dashboard_config: { notifications: { daily_record_reminders: v } } })} />
            <ToggleRow label="Vaccination reminders" checked={!!p.notifications.vaccination_reminders} onChange={(v) => mutate.mutate({ dashboard_config: { notifications: { vaccination_reminders: v } } })} />
            <ToggleRow label="Bird-weighing reminders" checked={!!p.notifications.bird_weighing_reminders} onChange={(v) => mutate.mutate({ dashboard_config: { notifications: { bird_weighing_reminders: v } } })} />
            <ToggleRow label="Daily / weekly reports" checked={!!p.notifications.daily_weekly_report} onChange={(v) => mutate.mutate({ dashboard_config: { notifications: { daily_weekly_report: v } } })} />
          </ToggleGrid>
        </Section>
      </Gate>
    </Panel>
  );
}

/* ================================================================== */
/*  PRIMITIVES                                                         */
/* ================================================================== */

function Panel({
  icon: Icon, eyebrow, title, description, children, lockedNote,
}: {
  icon: typeof Building2;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  /** If supplied, renders a beige banner explaining read-only state. */
  lockedNote?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand-primary-deep)]">
              {eyebrow}
            </p>
            <h2 className="mt-0.5 text-[15px] font-extrabold tracking-tight text-[var(--color-brand-fg)]">
              {title}
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-brand-muted)]">
              {description}
            </p>
          </div>
        </div>
      </header>
      {lockedNote && (
        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-5 py-3 text-[12px] text-amber-900">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{lockedNote}</p>
        </div>
      )}
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

function Section({
  icon: Icon, title, hint, children,
}: {
  icon?: typeof Building2;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-start gap-2">
        {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-muted)]" strokeWidth={2.2} />}
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-bold tracking-tight text-[var(--color-brand-fg)]">{title}</h3>
          {hint && (
            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">{hint}</p>
          )}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('grid gap-1 sm:grid-cols-2', className)}>{children}</div>;
}

/**
 * Single row with label + optional sub-text + a switch. Built so it
 * works on mobile (label-left, switch-right) without breaking on
 * desktop in the grid. Disabled state greys the row and explains why.
 */
function ToggleRow({
  label, desc, checked, onChange, disabled,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'group flex cursor-pointer items-start justify-between gap-3 rounded-lg p-2.5 transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-55'
          : 'hover:bg-[var(--color-brand-surface-soft)]',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--color-brand-fg)]">{label}</p>
        {desc && (
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--color-brand-muted)]">{desc}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={(v) => !disabled && onChange(v)}
        disabled={disabled}
      />
    </label>
  );
}

/**
 * Mobile-style toggle switch. Pure CSS — no library — so it animates
 * predictably and supports keyboard focus/aria.
 */
function Switch({
  checked, onChange, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] focus-visible:ring-offset-2',
        checked ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-input-border)]',
        disabled && 'cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function SegmentedControl<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-[var(--color-brand-surface-soft)] p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all',
              active
                ? 'bg-white text-[var(--color-brand-fg)] shadow-sm'
                : 'text-[var(--color-brand-muted)] hover:text-[var(--color-brand-fg)]',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Preset row — Easy / Expert / Custom tiles. Picks the daily-record
 * style. "Custom" can't be selected directly (it's an implicit state
 * the server sets when a user hand-tweaks toggles); we show it only
 * to communicate that state.
 */
function PresetRow({
  value, onChange, disabled,
}: {
  value: 'easy' | 'expert' | 'custom';
  onChange: (v: 'easy' | 'expert') => void;
  disabled?: boolean;
}) {
  const tiles: Array<{ key: 'easy' | 'expert' | 'custom'; label: string; sub: string; icon: typeof Building2 }> = [
    { key: 'easy',   label: 'Easy',   sub: 'Minimum capture.',  icon: Sparkles },
    { key: 'expert', label: 'Expert', sub: 'Full grid.',         icon: ShieldCheck },
    { key: 'custom', label: 'Custom', sub: 'Your own mix.',      icon: Cog },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {tiles.map((t) => {
        const active = t.key === value;
        const clickable = !disabled && t.key !== 'custom';
        return (
          <button
            type="button"
            key={t.key}
            disabled={!clickable}
            onClick={() => clickable && onChange(t.key as 'easy' | 'expert')}
            className={cn(
              'rounded-xl border-2 p-3 text-left transition-all',
              active
                ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40'
                : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
              !clickable && 'cursor-not-allowed opacity-60 hover:border-[var(--color-brand-input-border)]',
            )}
          >
            <div className="flex items-center gap-2">
              <t.icon className="h-3.5 w-3.5 text-[var(--color-brand-primary-deep)]" />
              <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{t.label}</p>
              {active && <Check className="ml-auto h-3.5 w-3.5 text-[var(--color-brand-primary-deep)]" strokeWidth={3} />}
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">{t.sub}</p>
          </button>
        );
      })}
    </div>
  );
}

function PanelSkeleton({ title }: { title: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] px-5 py-4">
        <p className="text-[15px] font-extrabold text-[var(--color-brand-fg)]">{title}</p>
      </header>
      <div className="space-y-3 px-5 py-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--color-brand-surface-soft)]" />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Deep-merge — same shape as the server's so optimistic UI stays    */
/*  honest. Skips arrays-as-values; we only ever store objects of     */
/*  objects of primitives in this schema.                              */
/* ------------------------------------------------------------------ */

function deepMerge<T extends Record<string, unknown>>(base: T, patch: object): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const existing = out[k];
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      out[k] = deepMerge(existing as Record<string, unknown>, v as object);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
