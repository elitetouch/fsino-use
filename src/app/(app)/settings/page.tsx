'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { MenuRow, Section, ToggleRow } from '@/components/settings/primitives';
import { Gate } from '@/lib/access';

/**
 * Settings hub — the page the user lands on after clicking "Settings"
 * in the sidebar. Modelled on the mobile figma "Settings" screen:
 *
 *   Preferences
 *     - Dashboard preferences
 *     - Daily record preferences
 *     - Finance preferences
 *   Notifications
 *     - Push notifications
 *   Farm-wide defaults    [only owners/managers/settings.update]
 *     - Farm daily record
 *     - Farm notifications
 *   Updates
 *     - Install updates automatically
 *   Synchronisation
 *     - Synchronise data when online
 *
 * Each preference row is a link to a dedicated sub-page so the user
 * isn't drowning in toggles. The sub-pages share the same React-Query
 * cache via the hooks in lib/use-preferences.ts.
 */
export default function SettingsHubPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Customise FS Manager to your liking. Some sections affect the whole farm; most just affect you."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {/* Personal preferences — every active member sees these. */}
          <Section
            title="Preferences"
            hint="How the app looks and works for you. These don't affect your teammates."
          >
            <MenuRow
              href="/settings/dashboard"
              label="Dashboard preferences"
              hint="Choose which cards appear on your dashboard."
            />
            <MenuRow
              href="/settings/daily-record"
              label="Daily record preferences"
              hint="Choose what to capture on your daily record form."
            />
            <MenuRow
              href="/settings/finance"
              label="Finance preferences"
              hint="Show or hide finance summaries on your dashboard."
            />
          </Section>

          <Section
            title="Notifications"
            hint="Reminders and alerts you get for this farm on this device."
          >
            <MenuRow
              href="/settings/notifications"
              label="Push notifications"
              hint="Daily record, vaccination and weighing reminders."
            />
          </Section>

          {/* Local PWA controls — stored on this device, not synced. */}
          <SystemSection />
        </div>

        <div className="space-y-5">
          {/* Farm-wide defaults — owner/manager + anyone with
              settings.view. The page itself is reachable, but each
              card is also Gate'd inline so the right-hand column
              collapses cleanly for staff. */}
          <Gate anyOf={['settings.view']} fallback={<FarmCeilingExplainer />}>
            <Section
              title="Farm-wide defaults"
              hint="Settings that apply to every member of this farm. The cap on what the team can capture."
            >
              <MenuRow
                href="/settings/farm/daily-record"
                label="Farm daily record defaults"
                hint="The hard ceiling — events disabled here cannot be recorded by anyone."
              />
              <MenuRow
                href="/settings/farm/notifications"
                label="Farm notifications"
                hint="Default channels for the whole team."
              />
            </Section>
          </Gate>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  System (local PWA) section                                         */
/* ================================================================== */

const STORAGE_KEYS = {
  autoUpdate: 'fs-auto-update',
  syncWhenOnline: 'fs-sync-when-online',
};

/**
 * The "Updates" + "Synchronisation" rows from the figma. These are
 * pure client-side prefs — they control PWA behaviour, not a backend
 * column. Stored in localStorage so they persist across sessions on
 * this device.
 */
function SystemSection() {
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [syncOnline, setSyncOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const a = localStorage.getItem(STORAGE_KEYS.autoUpdate);
    if (a !== null) setAutoUpdate(a === '1');
    const s = localStorage.getItem(STORAGE_KEYS.syncWhenOnline);
    if (s !== null) setSyncOnline(s === '1');
  }, []);

  function writeAutoUpdate(v: boolean) {
    setAutoUpdate(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.autoUpdate, v ? '1' : '0');
    }
  }
  function writeSyncOnline(v: boolean) {
    setSyncOnline(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.syncWhenOnline, v ? '1' : '0');
    }
  }

  return (
    <>
      <Section
        title="Updates"
        hint="How this device handles new versions of the app."
      >
        <ToggleRow
          label="Install updates automatically"
          desc="Refresh in the background whenever a new version is available."
          checked={autoUpdate}
          onChange={writeAutoUpdate}
        />
      </Section>

      <Section
        title="Synchronisation"
        hint="What happens to records logged while you were offline."
      >
        <ToggleRow
          label="Synchronise data when online"
          desc="Drain the offline outbox automatically as soon as a connection is detected."
          checked={syncOnline}
          onChange={writeSyncOnline}
        />
      </Section>
    </>
  );
}

/* ================================================================== */
/*  Explainer card for staff without farm-settings access              */
/* ================================================================== */

function FarmCeilingExplainer() {
  return (
    <section className="overflow-hidden rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-bold text-[var(--color-brand-fg)]">Farm-wide defaults</h2>
          <p className="mt-1 text-[12px] leading-snug text-[var(--color-brand-muted)]">
            Owners and managers configure what data the whole team captures and how the farm
            is notified. Ask them to grant you the Settings permission if you need to change these.
          </p>
        </div>
      </div>
    </section>
  );
}

