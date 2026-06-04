'use client';

import {
  SubPageHeader, Section, ToggleRow, ComingSoonRow, SectionSkeleton,
} from '@/components/settings/primitives';
import { useMyPreferences, useUpdateMyPreferences } from '@/lib/use-preferences';

/**
 * Push notifications — sub-page reached from /settings.
 *
 * Mirrors the figma "Push notifications / Preferences for your
 * notifications" frame. The first block is the three live toggles the
 * backend supports today (daily-record, vaccination, bird-weighing
 * reminders). The second block is the roadmap rows the figma showed
 * in red — PenKeep alerts, finance reminders, daily / weekly reports
 * — marked here as "Soon" so the user knows we're aware.
 *
 * These override the farm-wide notification defaults for THIS user
 * on this device. The farm defaults seed new members; you can turn
 * anything on or off here independently of what the farm picked.
 * (Unlike daily-record toggles, notifications aren't subject to a
 * hard farm ceiling — see PreferenceSchema::effectiveDailyRecord
 * for the asymmetry.)
 */
export default function NotificationsPage() {
  const prefs = useMyPreferences();
  const mutate = useUpdateMyPreferences();

  if (prefs.isLoading || !prefs.data) {
    return (
      <div>
        <SubPageHeader
          title="Push notifications"
          description="Reminders and alerts you get on this device."
        />
        <SectionSkeleton rows={4} />
      </div>
    );
  }

  const n = prefs.data.preferences.notifications;

  const flip = (key: string, value: boolean) =>
    mutate.mutate({ dashboard_config: { notifications: { [key]: value } } });

  return (
    <div>
      <SubPageHeader
        title="Push notifications"
        description="Reminders and alerts you get on this device. These override the farm's defaults — turn any of them on or off, independently of the rest of the team."
      />

      <div className="space-y-4">
        <Section title="Reminders" hint="Nudges to keep your daily records up to date.">
          <ToggleRow
            label="Add daily record reminders"
            desc="A daily ping if you haven't logged today's record yet."
            checked={!!n.daily_record_reminders}
            onChange={(v) => flip('daily_record_reminders', v)}
          />
          <ToggleRow
            label="Vaccination reminders"
            desc="Heads-up when an upcoming vaccination falls due."
            checked={!!n.vaccination_reminders}
            onChange={(v) => flip('vaccination_reminders', v)}
          />
          <ToggleRow
            label="Bird weighing reminders"
            desc="Weekly nudge to record manual weigh-ins."
            checked={!!n.bird_weighing_reminders}
            onChange={(v) => flip('bird_weighing_reminders', v)}
          />
        </Section>

        <Section
          title="More alerts"
          hint="On the roadmap — we'll switch these on once the underlying signal is wired up."
        >
          <ComingSoonRow
            label="PenKeep alerts"
            hint="Pen-by-pen anomaly detection: water cut-out, sudden mortality spike, feeder empty."
          />
          <ComingSoonRow
            label="Finance reminders"
            hint="Margin warnings: cycle cost outpacing revenue, token balance low."
          />
          <ComingSoonRow
            label="Daily report / Weekly report"
            hint="A bundled summary email of yesterday's records or last week's totals."
          />
        </Section>
      </div>
    </div>
  );
}
