'use client';

import {
  SubPageHeader, Section, ToggleRow, SectionSkeleton,
} from '@/components/settings/primitives';
import { useFarmSettings, useUpdateFarmSettings } from '@/lib/use-preferences';
import { usePermissions } from '@/lib/access';

/**
 * Farm-wide notification defaults — admin sub-page.
 *
 * Edits `farm_settings.notification_config`. These act as the team
 * default — what new members start with, and the value the
 * notification dispatcher reads for farm-scoped sends. Individual
 * members can independently override any of these on themselves;
 * there's no farm AND user ceiling for notifications the way there
 * is for daily-record events (see PreferenceSchema::effectiveDailyRecord
 * for the asymmetric model).
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
        description="Default reminders the team gets for this farm. Members can override any of these on their own device, independently of what you pick here."
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
