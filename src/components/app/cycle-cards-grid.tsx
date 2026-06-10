'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BreedSummaryCard, FeedConsumptionCard, WaterConsumptionCard,
  MortalityCard, EggCollectionCard, VaccinationCard,
} from '@/components/app/cycle-cards';
import { endpoints, type FlockDto } from '@/lib/api';

/**
 * Card grid for one active cycle.
 *
 * Lives in a standalone component so both /home (current cycle) and
 * /cycles/[id] (any cycle) can import it via a single path. (Previously
 * it was exported from /cycles/[id]/page.tsx which Next.js rejects at
 * build time — page files only allow `default`, `metadata`,
 * `generateMetadata`, etc. as named exports.)
 *
 * Wraps the pen-dashboard fetch so the call sites don't repeat the
 * query+invalidation plumbing. Cards render their own empty state if
 * the dashboard is still loading or the user hasn't logged records
 * yet, so the layout doesn't pop.
 *
 * Skips the dashboard fetch entirely when penId is missing — the
 * BreedSummaryCard still renders so the user sees breed + age + bird
 * count even without records.
 */
export function CycleCardsGrid({
  cycle,
  penId,
}: {
  cycle: FlockDto;
  /** Active flock's pen id. Required for the dashboard query. */
  penId: string | undefined;
}) {
  const dashboard = useQuery({
    queryKey: ['pen-dashboard', penId],
    queryFn: () => endpoints.getPenDashboard(penId!),
    enabled: !!penId,
    staleTime: 30_000,
  });

  const cards = dashboard.data?.cards;
  // FlockDto.productionType uses "dual_purpose" but the dashboard
  // payload uses "mixed"; tolerate both so the egg-collection card
  // surfaces for either naming convention.
  const isLayerOrMixed = cycle.productionType === 'layer'
    || (cycle.productionType as string) === 'mixed'
    || cycle.productionType === 'dual_purpose';

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <BreedSummaryCard flock={cycle} />
      <FeedConsumptionCard data={cards?.feed} />
      <WaterConsumptionCard data={cards?.water} />
      <MortalityCard data={cards?.mortality} />
      {isLayerOrMixed && <EggCollectionCard data={cards?.eggCollection} />}
      <VaccinationCard data={cards?.vaccination} />
    </div>
  );
}
