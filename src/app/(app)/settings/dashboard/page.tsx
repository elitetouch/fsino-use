'use client';

import {
  SubPageHeader, Section, ToggleRow, SectionSkeleton,
} from '@/components/settings/primitives';
import { useMyPreferences, useUpdateMyPreferences } from '@/lib/use-preferences';

/**
 * Dashboard preferences — sub-page reached from /settings.
 *
 * Mirrors the figma "Dashboard preferences / Preferences for your
 * dashboard" layout. Each card on the dashboard has a toggle here;
 * turning it off hides that card from this user's dashboard only.
 *
 * Card keys match the backend PreferenceSchema::cardDefaults() shape
 * exactly — anything we render here is server-truth.
 */
export default function DashboardPreferencesPage() {
  const prefs = useMyPreferences();
  const mutate = useUpdateMyPreferences();

  if (prefs.isLoading || !prefs.data) {
    return (
      <div>
        <SubPageHeader
          title="Dashboard preferences"
          description="Choose which cards appear on your dashboard. Just for you."
        />
        <SectionSkeleton />
      </div>
    );
  }

  const cards = prefs.data.preferences.dashboard.cards;

  /** Send a single-card patch; the server deep-merges. */
  const flip = (key: string, value: boolean) =>
    mutate.mutate({ dashboard_config: { dashboard: { cards: { [key]: value } } } });

  return (
    <div>
      <SubPageHeader
        title="Dashboard preferences"
        description="Choose which cards appear on your dashboard. These are just for you — teammates can pick their own."
      />

      <div className="space-y-4">
        <Section
          title="Bird performance"
          hint="Headline cards that summarise how your flock is doing day to day."
        >
          <ToggleRow
            label="Feed consumption"
            desc="Daily feed weight and feed-conversion ratio (FCR)."
            checked={!!cards.feed}
            onChange={(v) => flip('feed', v)}
          />
          <ToggleRow
            label="Water consumption"
            desc="Daily water volume per bird."
            checked={!!cards.water}
            onChange={(v) => flip('water', v)}
          />
          <ToggleRow
            label="Bird weight"
            desc="Average weight, growth trajectory, weigh-in cadence."
            checked={!!cards.weight}
            onChange={(v) => flip('weight', v)}
          />
          <ToggleRow
            label="Vaccination"
            desc="Upcoming and past vaccinations for the active cycle."
            checked={!!cards.vaccination}
            onChange={(v) => flip('vaccination', v)}
          />
        </Section>

        <Section
          title="Mortality & sales"
          hint="What happened to the birds — losses and revenue moves."
        >
          <ToggleRow
            label="Mortality"
            desc="Dead, culled and missing birds with a mortality rate trend."
            checked={!!cards.mortality}
            onChange={(v) => flip('mortality', v)}
          />
          <ToggleRow
            label="Birds sold"
            desc="Outflow tally with revenue if finance is enabled."
            checked={!!cards.birdsSold}
            onChange={(v) => flip('birdsSold', v)}
          />
        </Section>

        <Section
          title="Egg production"
          hint="Layer-flock cards. Have no effect on broiler-only farms."
        >
          <ToggleRow
            label="Egg collection"
            desc="Daily count, damaged eggs."
            checked={!!cards.eggCollection}
            onChange={(v) => flip('eggCollection', v)}
          />
          <ToggleRow
            label="Egg size"
            desc="Grade distribution if you record sizes."
            checked={!!cards.eggSize}
            onChange={(v) => flip('eggSize', v)}
          />
          <ToggleRow
            label="Egg weight"
            desc="Average egg mass over time."
            checked={!!cards.eggWeight}
            onChange={(v) => flip('eggWeight', v)}
          />
        </Section>
      </div>
    </div>
  );
}
