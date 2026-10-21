'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  /**
   * Spelled out rather than cycle + "s". "Stock batch" pluralises to
   * "Stock batches", and naive concatenation produced "Stock batchs"
   * in the setup stepper.
   */
  cyclePlural: string | null;
  hasCycles: boolean;
  /** Poultry bills per bird; everything else on device subscription. */
  usesTokens: boolean;
  /** Where the unit list lives. Cold chain has its own screen. */
  unitsHref: string;

  /**
   * Setup-wizard copy.
   *
   * "Capacity (birds)" on a cold room is the kind of detail that tells
   * an operator this product was not built for them, however good the
   * rest of it is.
   */
  capacityLabel: string;
  capacityPlaceholder: string;
  /** Placeholder for the FARM name, on setup step 1. */
  namePlaceholder: string;
  /** Placeholder for one UNIT's name, on setup step 2. */
  unitNamePlaceholder: string;
  /** Short noun for a capacity figure shown inline, e.g. "40 tonnes". */
  capacityUnit: string;
  /** One sentence saying what a unit is, for setup step 2. */
  unitDescription: string;
  /**
   * What goes in the "<unit> type" dropdown.
   *
   * Poultry housing types on a cold room was the giveaway that the
   * wizard had been renamed rather than actually made multi-vertical:
   * an operator picking "Deep litter" for their vaccine store is being
   * asked a poultry question in cold-chain words. For cold chain these
   * are the ColdChainPreset codes, so the choice also names the
   * temperature band the room will be held to.
   */
  unitTypes: ReadonlyArray<{ value: string; label: string }>;
};

export const VERTICALS: Record<Vertical, VerticalConfig> = {
  poultry: {
    unit: 'Pen',
    unitPlural: 'Pens',
    cycle: 'Flock',
    cyclePlural: 'Flocks',
    hasCycles: true,
    usesTokens: true,
    unitsHref: '/pens',
    capacityLabel: 'Capacity (birds)',
    capacityPlaceholder: '2,500',
    namePlaceholder: 'Sunrise Poultry Farm',
    unitNamePlaceholder: 'Pen 1, or House A',
    capacityUnit: 'birds',
    unitDescription: 'A pen is a house, cage, or section where a flock lives.',
    unitTypes: [
      { value: 'deep_litter', label: 'Deep litter' },
      { value: 'battery_cage', label: 'Battery cage' },
      { value: 'free_range', label: 'Free range' },
      { value: 'semi_intensive', label: 'Semi-intensive' },
    ],
  },
  greenhouse: {
    unit: 'Bay',
    unitPlural: 'Bays',
    cycle: 'Crop',
    cyclePlural: 'Crops',
    hasCycles: true,
    usesTokens: false,
    unitsHref: '/pens',
    capacityLabel: 'Growing area (m²)',
    capacityPlaceholder: '1,200',
    namePlaceholder: 'Sunrise Greenhouse',
    unitNamePlaceholder: 'Bay 1, or Tunnel A',
    capacityUnit: 'm²',
    unitDescription: 'A bay is one enclosed growing space under its own climate control.',
    unitTypes: [
      { value: 'tunnel', label: 'Tunnel' },
      { value: 'gutter_connected', label: 'Gutter-connected' },
      { value: 'shade_net', label: 'Shade net' },
      { value: 'screen_house', label: 'Screen house' },
    ],
  },
  irrigation: {
    unit: 'Plot',
    unitPlural: 'Plots',
    cycle: 'Crop',
    cyclePlural: 'Crops',
    hasCycles: true,
    usesTokens: false,
    unitsHref: '/pens',
    capacityLabel: 'Area under irrigation (hectares)',
    capacityPlaceholder: '8',
    namePlaceholder: 'Sunrise Farm',
    unitNamePlaceholder: 'Plot 1, or North Field',
    capacityUnit: 'hectares',
    unitDescription: 'A plot is one block of land watered on its own schedule.',
    unitTypes: [
      { value: 'drip', label: 'Drip' },
      { value: 'sprinkler', label: 'Sprinkler' },
      { value: 'furrow', label: 'Furrow' },
      { value: 'flood', label: 'Flood' },
    ],
  },
  cold_chain: {
    unit: 'Cold room',
    unitPlural: 'Cold rooms',
    // A cold room is monitored continuously. It is never "between
    // cycles": no placement, no age, no harvest. Every screen that
    // reaches for a current cycle has to check hasCycles first.
    cycle: null,
    cyclePlural: null,
    hasCycles: false,
    usesTokens: false,
    unitsHref: '/cold-rooms',
    // Tonnes, not birds. An operator who reads "Capacity (birds)" on
    // their cold store learns the product was not built for them,
    // however good the rest of it is.
    capacityLabel: 'Storage capacity (tonnes)',
    capacityPlaceholder: '40',
    namePlaceholder: 'Sunrise Cold Store',
    unitNamePlaceholder: 'Cold Room 1',
    capacityUnit: 'tonnes',
    unitDescription:
      'A cold room is one space held at its own temperature — a walk-in, a chest freezer, or a vaccine fridge.',
    // These are the ColdChainPreset codes the backend knows, so the
    // choice made here is also the band the room is monitored against.
    unitTypes: [
      { value: 'vaccine', label: 'Vaccine / pharmaceutical (2 to 8°C)' },
      { value: 'chilled', label: 'Chilled (0 to 4°C)' },
      { value: 'frozen', label: 'Frozen (−25 to −15°C)' },
      { value: 'produce', label: 'Fresh produce (12 to 16°C)' },
      { value: 'custom', label: 'Something else — I will set the range' },
    ],
  },
  aquaculture: {
    unit: 'Pond',
    unitPlural: 'Ponds',
    cycle: 'Stock batch',
    cyclePlural: 'Stock batches',
    hasCycles: true,
    usesTokens: false,
    unitsHref: '/pens',
    capacityLabel: 'Capacity (fish)',
    capacityPlaceholder: '5,000',
    namePlaceholder: 'Sunrise Fish Farm',
    unitNamePlaceholder: 'Pond 1, or Tank A',
    capacityUnit: 'fish',
    unitDescription: 'A pond is one body of water stocked and managed on its own.',
    unitTypes: [
      { value: 'earthen', label: 'Earthen pond' },
      { value: 'concrete', label: 'Concrete tank' },
      { value: 'tarpaulin', label: 'Tarpaulin tank' },
      { value: 'cage', label: 'Cage in open water' },
      { value: 'ras', label: 'Recirculating (RAS)' },
    ],
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

/**
 * Routes that only make sense when the farm runs production cycles.
 *
 * WHY A LIST AND A REDIRECT, rather than rewording each page. Two
 * dozen screens here are built around a flock: cycles, reports, the
 * daily record, disease check, sales per bird. They are not "poultry
 * wording on a general page" — they are poultry all the way down, and
 * rewording them for a cold store would produce screens that still ask
 * questions a cold store cannot answer.
 *
 * So the honest answer is that they do not apply. The nav already
 * omits them; this catches a stale bookmark, a pasted link, or a farm
 * switched to cold chain while one of these pages was open.
 *
 * Prefix match, so /cycles also covers /cycles/{id}/record.
 */
const CYCLE_ONLY_PREFIXES = [
  '/home',
  '/cycles',
  '/flocks',
  '/pens',
  '/pens-flocks',
  '/reports',
  '/diagnose',
  '/sales',
  '/wallet',
  '/shop',
  '/setup/flocks',
  '/settings/daily-record',
  '/settings/farm/daily-record',
  '/settings/dashboard',
];

export function isCycleOnlyPath(pathname: string | null): boolean {
  if (!pathname) return false;

  return CYCLE_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Keep a cycle-less vertical off the cycle-only routes.
 *
 * Lives in the (app) layout rather than in each page: a guard inside a
 * page either runs before its other hooks — which breaks hook order
 * the moment it returns early — or runs after them, by which point the
 * poultry dashboard has already flashed on screen.
 *
 * Returns true while redirecting so the layout can hold the render.
 */
export function useVerticalRouteGuard(pathname: string | null): boolean {
  const router = useRouter();
  const { hasCycles, unitsHref, isLoading } = useVertical();

  const blocked = !isLoading && !hasCycles && isCycleOnlyPath(pathname);

  useEffect(() => {
    if (blocked) router.replace(unitsHref);
  }, [blocked, unitsHref, router]);

  return blocked;
}
