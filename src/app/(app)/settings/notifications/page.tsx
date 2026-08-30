'use client';

import {
  SubPageHeader, Section, ToggleRow, ComingSoonRow, SectionSkeleton,
} from '@/components/settings/primitives';
import { PushDeviceCard } from '@/components/settings/push-device-card';
import { useMyPreferences, useUpdateMyPreferences } from '@/lib/use-preferences';

/**
 * Push notifications — sub-page reached from /settings.
 *
 * TWO LAYERS, deliberately separated:
 *
 *   1. PushDeviceCard — does THIS handset ring at all? Permission is
 *      granted per browser, per device, and cannot follow the user
 *      anywhere.
 *   2. The category toggles — which things are worth ringing about.
 *      These are stored server-side and DO follow the user everywhere.
 *
 * Collapsing the two is why push settings confuse people: a farmer who
 * switched every category on and still hears nothing, because they never
 * granted permission on their phone, has no way to discover that from a
 * screen of category switches alone.
 *
 * PenKeep alerts and cycle reminders were "coming soon" rows until push
 * delivery existed. They are now the two most valuable notifications the
 * product sends, so they lead.
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
        <PushDeviceCard />

        <Section
          title="Farm alerts"
          hint="Problems worth knowing about before they cost you birds."
        >
          <ToggleRow
            label="Pen alerts"
            desc="Sudden mortality, feed drop, heat stress, ammonia spike, stalled growth."
            checked={!!n.penkeep_alerts}
            onChange={(v) => flip('penkeep_alerts', v)}
          />
          <ToggleRow
            label="Cycle reminders"
            desc="A heads-up 7, 3 and 1 day before a cycle's tracking window closes."
            checked={!!n.cycle_reminders}
            onChange={(v) => flip('cycle_reminders', v)}
          />
        </Section>

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
          hint="Everything below is on the roadmap — we'll switch it on once the underlying signal is wired up."
        >
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
