'use client';

import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@/lib/api';
import { useCurrentFarmId } from '@/lib/farm-context';

/**
 * What a farm's vertical implies, on the client.
 *
 * Mirrors app/Domain/Verticals/FarmVertical.php. Change one, change
 * the other — the same precedent as ProductionType / TOKEN_TYPES in
 * api.ts, which mirror FlockType.
 *
 * THE WHOLE POINT IS THAT MOST USERS NEVER SEE THIS. A poultry farmer
 * — which is nearly all of them — gets exactly the app they had: the
 * labels are the same words, the nav is the same list. Complexity
 * appears only for somebody who actually runs a second vertical, and
 * for them it arrives through the farm switcher they already use every
 * day rather than through a new concept.
 */

export type Vertical =
  | 'poultry'
  | 'greenhouse'
  | 'irrigation'
  | 'cold_chain'
  | 'aquaculture';

export type VerticalConfig = {
  /** What the farmer calls the thing a device sits in. */
  unit: string;
  unitPlural: string;
  /** What one run of production is called; null where there are none. */
  cycle: string | null;
  hasCycles: boolean;
  /** Poultry bills per bird; everything else on device subscription. */
  usesTokens: boolean;
  /** Where the unit list lives. Cold chain has its own screen. */
  unitsHref: string;
};

export const VERTICALS: Record<Vertical, VerticalConfig> = {
  poultry: {
    unit: 'Pen',
    unitPlural: 'Pens',
    cycle: 'Flock',
    hasCycles: true,
    usesTokens: true,
    unitsHref: '/pens',
  },
  greenhouse: {
    unit: 'Bay',
    unitPlural: 'Bays',
    cycle: 'Crop',
    hasCycles: true,
    usesTokens: false,
    unitsHref: '/pens',
  },
  irrigation: {
    unit: 'Plot',
    unitPlural: 'Plots',
    cycle: 'Crop',
    hasCycles: true,
    usesTokens: false,
    unitsHref: '/pens',
  },
  cold_chain: {
    unit: 'Cold room',
    unitPlural: 'Cold rooms',
    // A cold room is monitored continuously. It is never "between
    // cycles": no placement, no age, no harvest. Every screen that
    // reaches for a current cycle has to check hasCycles first.
    cycle: null,
    hasCycles: false,
    usesTokens: false,
    unitsHref: '/cold-rooms',
  },
  aquaculture: {
    unit: 'Pond',
    unitPlural: 'Ponds',
    cycle: 'Stock batch',
    hasCycles: true,
    usesTokens: false,
    unitsHref: '/pens',
  },
};

export const DEFAULT_VERTICAL: Vertical = 'poultry';

export function isVertical(value: unknown): value is Vertical {
  return typeof value === 'string' && value in VERTICALS;
}

/**
 * The current farm's vertical and its config.
 *
 * Falls back to poultry while the farm is still loading and for any
 * value the client does not recognise — a server that starts sending
 * a sixth vertical should render the app it has always rendered, not
 * a blank screen.
 */
export function useVertical(): VerticalConfig & {
  vertical: Vertical;
  isLoading: boolean;
} {
  const farmId = useCurrentFarmId();

  const farms = useQuery({
    queryKey: ['farms'],
    queryFn: () => endpoints.listFarms(),
    // Shares the cache key the rest of the app already uses, so this
    // adds no extra request on any screen that has loaded farms.
    staleTime: 60_000,
  });

  const farm = farms.data?.farms.find((f) => f.id === farmId);
  const raw = farm?.vertical;
  const vertical: Vertical = isVertical(raw) ? raw : DEFAULT_VERTICAL;

  return { ...VERTICALS[vertical], vertical, isLoading: farms.isLoading };
}
