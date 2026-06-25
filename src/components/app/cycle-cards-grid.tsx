'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BreedSummaryCard, FeedConsumptionCard, WaterConsumptionCard,
  MortalityCard, BirdsSoldCard, BirdWeightCard,
  EggCollectionCard, EggSizeCard, EggWeightCard, VaccinationCard,
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
  const router = useRouter();
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

  // Card footers route to the same wizard the user adds with — the
  // wizard already handles edit-mode safely:
  //   - EntryPicker surfaces when >=2 records of the same event_type
  //     exist for the day, so we never silently overwrite another
  //     staff's entry.
  //   - Server-side UpdateFlockDailyRecord enforces "staff can only
  //     edit records they themselves created" — foreign rows 403
  //     with a clear toast.
  //   - Bird-count invariants (mortality/sale can't exceed current
  //     birds, etc.) are validated server-side, so partial edits
  //     can't corrupt the cycle's running totals.
  // We don't build a parallel "edit only" path — every safeguard
  // would have to be reimplemented and kept in sync.
  const openRecord = () => router.push(`/cycles/${cycle.id}/record`);

  // Backend reports `state` per card; cards in `not_applicable` (e.g.
  // egg cards for broilers) and `not_yet` (e.g. egg cards for pre-lay
  // layer flocks under ~16 weeks with no eggs ever logged) ship null
  // summaries and shouldn't render — they'd just paint as empty noise
  // on a dashboard the farmer can't act on yet. The cards reappear
  // automatically the moment the backend flips state to something
  // visible (any egg event logged, or the flock crosses the
  // point-of-lay threshold).
  const isVisible = (card?: { state?: string } | null) =>
    !!card && card.state !== 'not_applicable' && card.state !== 'not_yet';

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <BreedSummaryCard flock={cycle} />
      <FeedConsumptionCard data={cards?.feed} onEdit={openRecord} />
      <WaterConsumptionCard data={cards?.water} onEdit={openRecord} />
      <MortalityCard data={cards?.mortality} onEdit={openRecord} />
      <BirdsSoldCard data={cards?.birdsSold} onEdit={openRecord} />
      <BirdWeightCard data={cards?.weight} onEdit={openRecord} />
      {isLayerOrMixed && isVisible(cards?.eggCollection) && (
        <EggCollectionCard data={cards?.eggCollection} onEdit={openRecord} />
      )}
      {isLayerOrMixed && isVisible(cards?.eggSize) && (
        <EggSizeCard data={cards?.eggSize} onEdit={openRecord} />
      )}
      {isLayerOrMixed && isVisible(cards?.eggWeight) && (
        <EggWeightCard data={cards?.eggWeight} onEdit={openRecord} />
      )}
      {/* VaccinationCard's footer now matches every other card's
          Learn-more pattern — no edit slot; vaccinations are managed
          via the wizard step rather than a card-level edit jump. */}
      <VaccinationCard data={cards?.vaccination} />
    </div>
  );
}
