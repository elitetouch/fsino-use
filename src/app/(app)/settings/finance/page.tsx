'use client';

import { Wallet, TrendingUp, Receipt } from 'lucide-react';
import {
  SubPageHeader, Section, ToggleRow, ComingSoonRow, SectionSkeleton,
} from '@/components/settings/primitives';
import { useMyPreferences, useUpdateMyPreferences } from '@/lib/use-preferences';

/**
 * Finance preferences — sub-page reached from /settings.
 *
 * Designed in the spirit of the figma (we don't have a finance frame
 * from the mocks, only the menu row). Keeps to what the backend
 * actually supports today, plus a couple of clearly-marked "Soon"
 * rows so the user knows what's coming.
 *
 * Backed by the user-pref `finance.enabled` flag — the only finance
 * preference the schema persists today. Anything else here is either
 * coming-soon or a UI hint with no server effect yet.
 */
export default function FinancePreferencesPage() {
  const prefs = useMyPreferences();
  const mutate = useUpdateMyPreferences();

  if (prefs.isLoading || !prefs.data) {
    return (
      <div>
        <SubPageHeader
          title="Finance preferences"
          description="Show or hide cost and revenue summaries on your dashboard."
        />
        <SectionSkeleton rows={3} />
      </div>
    );
  }

  const p = prefs.data.preferences;

  return (
    <div>
      <SubPageHeader
        title="Finance preferences"
        description="Show or hide cost and revenue summaries. Just for you."
      />

      <div className="space-y-4">
        <Section
          title="Finance section"
          hint="The cost-and-revenue block on your dashboard."
        >
          <ToggleRow
            label="Show finance section"
            desc="Daily cost so far, revenue from birds sold, and per-cycle margin."
            checked={!!p.finance.enabled}
            onChange={(v) => mutate.mutate({ dashboard_config: { finance: { enabled: v } } })}
          />
        </Section>

        {/* Coming-soon rows — the schema doesn't store these yet but
            they're on the roadmap. Marked clearly so users understand
            they aren't broken toggles. */}
        <Section
          title="Cost breakdown"
          hint="Where your money goes day to day. Some of this is still under construction."
        >
          <ComingSoonRow
            label="Show feed-cost trends"
            hint="Daily and weekly feed spend per cycle."
          />
          <ComingSoonRow
            label="Show medication cost"
            hint="Vaccinations and treatments rolled into the dashboard total."
          />
          <ComingSoonRow
            label="Default currency"
            hint="Currently follows your farm's currency (NGN). Per-user override is on the roadmap."
          />
        </Section>

        <Section title="Cycle margin" hint="What each cycle returned.">
          <ComingSoonRow
            label="Break-even forecast"
            hint="When the cycle is projected to turn profitable based on current FCR."
          />
          <ComingSoonRow
            label="Compare cycles"
            hint="Side-by-side margins for two or more recent cycles."
          />
        </Section>
      </div>

      {/* Tiny brand strip at the bottom — three icons to make the page
          feel finished even when most rows are soon. */}
      <div className="mt-6 flex items-center justify-center gap-6 text-[var(--color-brand-muted-soft)]">
        <Wallet className="h-3.5 w-3.5" />
        <TrendingUp className="h-3.5 w-3.5" />
        <Receipt className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}
