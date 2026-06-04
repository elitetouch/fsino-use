'use client';

import {
  SubPageHeader, Section, ToggleRow, SectionSkeleton,
} from '@/components/settings/primitives';
import { useFarmSettings, useUpdateFarmSettings } from '@/lib/use-preferences';
import { usePermissions } from '@/lib/access';

/**
 * Farm-wide notification defaults — admin sub-page.
 *
 * Edits `farm_settings.notification_config`. Members keep their own
 * narrowed versions in personal preferences; the farm value is the
 * default they fall back to and the ceiling above which they can't
 * subscribe.
 */
export default function FarmNotificationsPage() {
  const perms = usePermissions();
  const settings = useFarmSettings();
  const mutate = useUpdateFarmSettings();

  const canEdit = perms.can('settings.update') || perms.isOwner || perms.isManager;

  if (settings.isLoading || !settings.data) {
    return (
      <div>
        <SubPageHeader
          backTo="/settings"
          title="Farm notifications"
          description="Default reminders for everyone on this farm."
        />
        <SectionSkeleton rows={4} />
      </div>
    );
  }

  const n = settings.data.settings.notificationConfig ?? {};

  const flip = (key: string, value: boolean) =>
    mutate.mutate({ notification_config: { [key]: value } });

  return (
    <div>
      <SubPageHeader
        backTo="/settings"
        title="Farm notifications"
        description="Default reminders the team gets for this farm. Members can mute these on their own device but can't add ones the farm has switched off."
        lockedNote={canEdit ? undefined : 'You can review these defaults but only owners and managers can change them.'}
      />

      <div className="space-y-4">
        <Section title="Reminders">
          <ToggleRow
            label="Daily record reminders"
            desc="A daily ping if a member hasn't logged today's record."
            checked={!!n.daily_record_reminders}
            onChange={(v) => flip('daily_record_reminders', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Vaccination reminders"
            desc="Heads-up when an upcoming vaccination falls due."
            checked={!!n.vaccination_reminders}
            onChange={(v) => flip('vaccination_reminders', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Bird weighing reminders"
            desc="Weekly nudge to record manual weigh-ins."
            checked={!!n.bird_weighing_reminders}
            onChange={(v) => flip('bird_weighing_reminders', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Daily / weekly report"
            desc="Send a bundled summary email at the end of each day or week."
            checked={!!n.daily_weekly_report}
            onChange={(v) => flip('daily_weekly_report', v)}
            disabled={!canEdit}
          />
        </Section>
      </div>
    </div>
  );
}
