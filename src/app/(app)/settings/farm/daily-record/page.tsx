'use client';

import {
  SubPageHeader, Section, ToggleRow, PresetTiles, SectionSkeleton,
} from '@/components/settings/primitives';
import { useFarmSettings, useUpdateFarmSettings } from '@/lib/use-preferences';
import { usePermissions } from '@/lib/access';

/**
 * Farm-wide daily record defaults — admin sub-page.
 *
 * This page edits `farm_settings.daily_record_preset` and the
 * `daily_record_config` ceiling. Whatever's switched off here cannot
 * be recorded by any member of the farm — backend enforces this in
 * FlockDailyRecordController::assertEventEnabledForFarm().
 *
 * Auth model:
 *   - settings.view: can land on the page (read-only view).
 *   - settings.update: full edit.
 *   - Owner/manager: bypass both.
 *
 * The route-level AccessGuard already blocks staff without
 * settings.view from reaching this URL, so this page only deals with
 * the read-only / read-write split.
 */
export default function FarmDailyRecordDefaultsPage() {
  const perms = usePermissions();
  const settings = useFarmSettings();
  const mutate = useUpdateFarmSettings();

  const canEdit = perms.can('settings.update') || perms.isOwner || perms.isManager;

  if (settings.isLoading || !settings.data) {
    return (
      <div>
        <SubPageHeader
          backTo="/settings"
          title="Farm daily record defaults"
          description="The hard ceiling for what your team can capture in a daily record."
        />
        <SectionSkeleton rows={5} />
      </div>
    );
  }

  const s = settings.data.settings;
  const dr = s.dailyRecordConfig ?? {};

  // The farm ceiling stores per-event sections with an `enabled` flag
  // (and per-event sub-fields below it). The schema's behaviour is:
  // missing section = allowed; present section with `enabled: false`
  // = blocked. So we read with a default of `true`.
  const enabled = (event: string): boolean => {
    const section = (dr as Record<string, Record<string, boolean> | undefined>)[event];
    if (!section) return true;
    if (!('enabled' in section)) return true;
    return !!section.enabled;
  };

  /** Per-event ceiling patch. */
  const patchEvent = (event: string, key: string, value: boolean) =>
    mutate.mutate({
      daily_record_config: { [event]: { [key]: value } },
    });

  /** Per-flag patch for `bird_count` (no top-level enabled key). */
  const patchCount = (flag: string, value: boolean) =>
    mutate.mutate({
      daily_record_config: { bird_count: { [flag]: value } },
    });

  return (
    <div>
      <SubPageHeader
        backTo="/settings"
        title="Farm daily record defaults"
        description="What your team is allowed to record. Switching something off here turns it off for everyone on the farm — they can't override it from their personal preferences."
        lockedNote={canEdit ? undefined : 'You can review these defaults but only owners and managers can change them.'}
      />

      <div className="space-y-4">
        <Section
          title="Choose a preset"
          hint="A starting point you can fine-tune below. Custom is auto-set when you change anything by hand."
        >
          <div className="p-4">
            <PresetTiles
              value={s.dailyRecordPreset}
              onPick={(preset) => mutate.mutate({ daily_record_preset: preset })}
              disabled={!canEdit}
            />
          </div>
        </Section>

        <Section title="What your team can capture">
          <ToggleRow
            label="Feed consumption"
            desc="Allow members to log daily feed weight per pen."
            checked={enabled('feed')}
            onChange={(v) => patchEvent('feed', 'enabled', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Water consumption"
            desc="Allow members to log water volume per pen."
            checked={enabled('water')}
            onChange={(v) => patchEvent('water', 'enabled', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Vaccination"
            desc="Vaccine name, date and dosage."
            checked={enabled('vaccination')}
            onChange={(v) => patchEvent('vaccination', 'enabled', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Treatment"
            desc="Antibiotics or other medication."
            checked={enabled('treatment')}
            onChange={(v) => patchEvent('treatment', 'enabled', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Bird weighing"
            desc="Manual weigh-ins for growth tracking."
            checked={enabled('weight')}
            onChange={(v) => patchEvent('weight', 'enabled', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Eggs"
            desc="Egg collection, sizes, weight (layer flocks only)."
            checked={enabled('eggs')}
            onChange={(v) => patchEvent('eggs', 'enabled', v)}
            disabled={!canEdit}
          />
        </Section>

        <Section title="Bird-count flags" hint="Granular control over what kinds of bird losses your team can log.">
          <ToggleRow
            label="Dead"
            checked={!!(dr.bird_count?.dead ?? true)}
            onChange={(v) => patchCount('dead', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Culled"
            checked={!!(dr.bird_count?.culled ?? true)}
            onChange={(v) => patchCount('culled', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Sold"
            checked={!!(dr.bird_count?.sold ?? true)}
            onChange={(v) => patchCount('sold', v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Missing"
            desc="Birds that disappeared without being recorded as dead or culled."
            checked={!!(dr.bird_count?.missing ?? true)}
            onChange={(v) => patchCount('missing', v)}
            disabled={!canEdit}
          />
        </Section>
      </div>
    </div>
  );
}
