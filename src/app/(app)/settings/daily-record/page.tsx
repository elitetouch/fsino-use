'use client';

import {
  SubPageHeader, Section, ToggleRow, PresetTiles, SectionSkeleton,
} from '@/components/settings/primitives';
import { useMyPreferences, useUpdateMyPreferences } from '@/lib/use-preferences';
import type { MyPreferencesDto } from '@/lib/api';

/**
 * Daily record preferences — sub-page reached from /settings.
 *
 * The figma flow:
 *   - Choose a preset: Easy / Expert / Custom.
 *   - Below the preset row, every metric the daily-record form can
 *     capture has its own toggle, grouped into sections.
 *
 * Preset behaviour (matches the mobile app):
 *   - Easy:    minimum viable capture. Vaccination/treatment off.
 *   - Expert:  everything on.
 *   - Custom:  read-only — the server auto-sets this whenever a
 *              per-field toggle is patched without naming a preset.
 *              Picking Easy or Expert again replaces the whole
 *              daily_record block with that preset's defaults.
 *
 * The hard ceiling lives at the farm level: if the farm has disabled
 * an event, the personal toggle here greys out with the explanation
 * "Disabled by the farm." — so users know why something is off
 * instead of just seeing a broken toggle.
 */
export default function DailyRecordPreferencesPage() {
  const prefs = useMyPreferences();
  const mutate = useUpdateMyPreferences();

  if (prefs.isLoading || !prefs.data) {
    return (
      <div>
        <SubPageHeader
          title="Daily record preferences"
          description="Choose what your daily record form captures. Just for you."
        />
        <SectionSkeleton rows={5} />
      </div>
    );
  }

  const p = prefs.data.preferences;
  const dr = p.dailyRecord;
  const farmDR = p.farmDailyRecord ?? {};

  const farmAllows = (event: string): boolean => {
    const section = (farmDR as Record<string, Record<string, boolean> | undefined>)[event];
    if (!section) return true;
    if (!('enabled' in section)) return true;
    return !!section.enabled;
  };

  const patch = (delta: Record<string, unknown>) =>
    mutate.mutate({ dashboard_config: { daily_record: delta } });

  return (
    <div>
      <SubPageHeader
        title="Daily record preferences"
        description="Pick a preset to get started, or fine-tune each metric below. We'll mark you as Custom once you change anything by hand."
      />

      <div className="space-y-4">
        {/* Preset row */}
        <Section
          title="Choose a preset"
          hint='Easy turns on the basics. Expert captures every metric. Custom appears automatically once you toggle anything below.'
        >
          <div className="p-4">
            <PresetTiles
              value={p.dailyRecordPreset}
              onPick={(preset) => mutate.mutate({ preset })}
            />
          </div>
        </Section>

        {/* Feed consumption */}
        <Section title="Feed consumption">
          <SubToggleRow
            label="Include feed consumption"
            checked={dr.feed?.include}
            farmAllowed={farmAllows('feed')}
            onChange={(v) => patch({ feed: { include: v } })}
          />
          <SubToggleRow
            label="Enter feed consumption twice a day"
            desc="Some farms log morning and evening separately."
            checked={dr.feed?.twice_a_day}
            farmAllowed={farmAllows('feed')}
            onChange={(v) => patch({ feed: { twice_a_day: v } })}
          />
        </Section>

        {/* Water */}
        <Section title="Water consumption">
          <SubToggleRow
            label="Include water consumption"
            checked={dr.water?.include}
            farmAllowed={farmAllows('water')}
            onChange={(v) => patch({ water: { include: v } })}
          />
          <SubToggleRow
            label="Enter water consumption twice a day"
            checked={dr.water?.twice_a_day}
            farmAllowed={farmAllows('water')}
            onChange={(v) => patch({ water: { twice_a_day: v } })}
          />
        </Section>

        {/* Vaccination */}
        <Section title="Vaccination">
          <SubToggleRow
            label="Include vaccination"
            checked={dr.vaccination?.include}
            farmAllowed={farmAllows('vaccination')}
            onChange={(v) => patch({ vaccination: { include: v } })}
          />
          <SubToggleRow
            label="Enter the dosage of the vaccine"
            desc="Adds a dosage field to each vaccination entry."
            checked={dr.vaccination?.capture_dosage}
            farmAllowed={farmAllows('vaccination')}
            onChange={(v) => patch({ vaccination: { capture_dosage: v } })}
          />
        </Section>

        {/* Treatment */}
        <Section title="Treatment">
          <SubToggleRow
            label="Include treatment"
            desc="Antibiotics or other medication given to the flock."
            checked={dr.treatment?.include}
            farmAllowed={farmAllows('treatment')}
            onChange={(v) => patch({ treatment: { include: v } })}
          />
        </Section>

        {/* Bird weight */}
        <Section title="Bird weight">
          <SubToggleRow
            label="Generate average of five birds"
            desc="Auto-compute the average after you enter five weights."
            checked={dr.bird_weight?.auto_average}
            farmAllowed={farmAllows('weight')}
            onChange={(v) => patch({ bird_weight: { auto_average: v } })}
          />
          <SubToggleRow
            label="Calculate and enter your own average"
            desc="Skip auto-average and enter a single computed value."
            checked={!dr.bird_weight?.auto_average && !!dr.bird_weight?.include}
            farmAllowed={farmAllows('weight')}
            onChange={(v) => patch({ bird_weight: { include: true, auto_average: !v } })}
          />
        </Section>

        {/* Bird count */}
        <Section title="Bird count">
          <SubToggleRow
            label="Enter dead birds"
            checked={dr.bird_count?.dead}
            farmAllowed={farmAllowsBirdCount(farmDR, 'dead')}
            onChange={(v) => patch({ bird_count: { dead: v } })}
          />
          <SubToggleRow
            label="Enter culled birds"
            checked={dr.bird_count?.culled}
            farmAllowed={farmAllowsBirdCount(farmDR, 'culled')}
            onChange={(v) => patch({ bird_count: { culled: v } })}
          />
          <SubToggleRow
            label="Enter sold birds"
            checked={dr.bird_count?.sold}
            farmAllowed={farmAllowsBirdCount(farmDR, 'sold')}
            onChange={(v) => patch({ bird_count: { sold: v } })}
          />
          <SubToggleRow
            label="Enter lost birds"
            desc="Birds that went missing without being recorded as dead or culled."
            checked={dr.bird_count?.lost}
            // farm side uses `missing` instead of `lost` — see PreferenceSchema.
            farmAllowed={farmAllowsBirdCount(farmDR, 'missing')}
            onChange={(v) => patch({ bird_count: { lost: v } })}
          />
        </Section>

        {/* Egg collection */}
        <Section title="Egg collection" hint="Layer flocks only.">
          <SubToggleRow
            label="Include egg collection"
            checked={dr.eggs?.include}
            farmAllowed={farmAllows('eggs')}
            onChange={(v) => patch({ eggs: { include: v } })}
          />
          <SubToggleRow
            label="Enter egg collection twice a day"
            checked={dr.eggs?.twice_a_day}
            farmAllowed={farmAllows('eggs')}
            onChange={(v) => patch({ eggs: { twice_a_day: v } })}
          />
          <SubToggleRow
            label="Enter damaged eggs"
            checked={dr.eggs?.track_damaged}
            farmAllowed={farmAllows('eggs')}
            onChange={(v) => patch({ eggs: { track_damaged: v } })}
          />
        </Section>

        {/* Egg size & weight */}
        <Section title="Egg size and weight" hint="Layer flocks only.">
          <SubToggleRow
            label="Enter egg size"
            desc="Small / medium / large grading per collection."
            checked={dr.egg_metrics?.track_size}
            farmAllowed={farmAllows('eggs')}
            onChange={(v) => patch({ egg_metrics: { track_size: v } })}
          />
          <SubToggleRow
            label="Enter egg weight"
            desc="Average mass per egg in grams."
            checked={dr.egg_metrics?.track_weight}
            farmAllowed={farmAllows('eggs')}
            onChange={(v) => patch({ egg_metrics: { track_weight: v } })}
          />
        </Section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle row with farm-ceiling awareness                              */
/* ------------------------------------------------------------------ */

function SubToggleRow({
  label, desc, checked, onChange, farmAllowed,
}: {
  label: string;
  desc?: string;
  checked?: boolean;
  onChange: (v: boolean) => void;
  farmAllowed: boolean;
}) {
  return (
    <ToggleRow
      label={label}
      desc={desc}
      checked={!!checked && farmAllowed}
      onChange={onChange}
      disabled={!farmAllowed}
      lockedReason={!farmAllowed ? 'Disabled by the farm — owner must turn this on first.' : undefined}
    />
  );
}

/**
 * Bird-count gating. The farm config uses `bird_count.{dead,culled,sold,missing}`
 * as per-flag booleans rather than a single `enabled` ceiling — see
 * PreferenceSchema::effectiveDailyRecord(). If the section is absent
 * entirely, every flag is allowed by default.
 */
function farmAllowsBirdCount(
  farmDR: NonNullable<MyPreferencesDto['farmDailyRecord']> | Record<string, never>,
  flag: 'dead' | 'culled' | 'sold' | 'missing',
): boolean {
  const section = (farmDR as Record<string, Record<string, boolean> | undefined>).bird_count;
  if (!section) return true;
  if (!(flag in section)) return true;
  return !!section[flag];
}
