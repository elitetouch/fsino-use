/**
 * Turning a bay's readings into something a grower can act on.
 *
 * Pure functions, no React, no network — the dashboard reads bands from
 * the server (GreenhouseCrop is the one source for those) and uses this
 * to decide what they mean right now.
 */

import type { CropCycleDto } from '@/lib/api';

/**
 * Saturation vapour pressure, in kPa, by the Tetens equation.
 *
 * The standard form used across horticulture. Accurate to well within
 * a percent over any temperature a greenhouse reaches, which is far
 * finer than the sensor feeding it.
 */
function saturationVapourPressure(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

/**
 * Vapour pressure deficit, in kPa — how hard the air is pulling water
 * out of the plant.
 *
 * WHY THIS AND NOT JUST HUMIDITY. 70% RH at 20°C and 70% RH at 32°C are
 * the same number and completely different growing conditions: the warm
 * air holds far more water, so it pulls far harder. A grower managing
 * to a humidity figure is managing to something that changes meaning
 * every time the temperature moves. VPD is the figure that does not.
 *
 * Too low and the plant stops transpiring — it cannot pull calcium up
 * to the fruit, which is where blossom-end rot comes from, and wet
 * leaves invite botrytis. Too high and it shuts its stomata to stop
 * losing water, which also stops it taking in CO2, so growth halts
 * while the house looks bright and healthy.
 *
 * Computed from AIR temperature. True VPD uses leaf temperature, which
 * runs a degree or two below air under transpiration, so this reads
 * very slightly high. Correcting it would need a leaf sensor nobody
 * has; the error is smaller than the bands below are wide.
 */
export function vpdKpa(tempC: number, relativeHumidityPct: number): number {
  const rh = Math.min(100, Math.max(0, relativeHumidityPct));
  return saturationVapourPressure(tempC) * (1 - rh / 100);
}

export type VpdVerdict = {
  kpa: number;
  level: 'too_humid' | 'good' | 'dry_side' | 'too_dry' | 'not_applicable';
  label: string;
  note: string;
};

/**
 * What a VPD figure means for this crop.
 *
 * MUSHROOMS ARE EXCLUDED, not given a different band. They are a fungus
 * with no stomata and no transpiration stream, so the entire concept
 * does not apply — and their correct growing condition (85-95% RH) sits
 * exactly where a plant-oriented reading would scream "too humid".
 * Showing them a red VPD warning for doing the right thing is how a
 * grower learns to ignore the dashboard.
 */
export function assessVpd(
  tempC: number,
  relativeHumidityPct: number,
  crop: string,
): VpdVerdict {
  const kpa = vpdKpa(tempC, relativeHumidityPct);

  if (crop === 'mushroom') {
    return {
      kpa,
      level: 'not_applicable',
      label: 'n/a',
      note: 'Mushrooms do not transpire — humidity is the figure that matters here, not VPD.',
    };
  }

  if (kpa < 0.4) {
    return {
      kpa,
      level: 'too_humid',
      label: 'Too humid',
      note: 'The air is too wet for the plant to pull water up. Calcium stops reaching the fruit and wet leaves invite botrytis. Ventilate.',
    };
  }

  if (kpa <= 1.2) {
    return {
      kpa,
      level: 'good',
      label: 'Good',
      note: 'The plant can transpire freely without losing more water than it takes up.',
    };
  }

  if (kpa <= 1.6) {
    return {
      kpa,
      level: 'dry_side',
      label: 'Dry side',
      note: 'Still workable, but the plant is working harder for its water. Watch irrigation through the afternoon.',
    };
  }

  return {
    kpa,
    level: 'too_dry',
    label: 'Too dry',
    note: 'The plant is closing its stomata to save water, which also stops it taking in CO₂. Growth halts even though the house looks fine. Damp down or shade.',
  };
}

/**
 * Is it day or night for band purposes?
 *
 * A fixed 06:00-18:00 split, which would be wrong almost anywhere else
 * and is right here: Nigeria sits near the equator, so day length moves
 * by well under an hour across the whole year. Sunrise and sunset
 * arithmetic would add a dependency to chase a few minutes that no
 * temperature band is sensitive to.
 */
export function isDaytime(now: Date = new Date()): boolean {
  const hour = now.getHours();
  return hour >= 6 && hour < 18;
}

export type BandVerdict = {
  status: 'critical' | 'high' | 'low' | 'ok';
  /** The band actually in force right now. */
  min: number;
  max: number;
  phase: 'day' | 'night';
  headline: string;
  note: string;
};

/**
 * Where a temperature sits against the crop's band for this time of day.
 *
 * CRITICAL IS NOT 'VERY HIGH'. Above the comfort ceiling a crop yields
 * less; above the critical high it is lost, usually with no visible
 * symptom until harvest — tomato and sweet pepper pollen goes sterile
 * at 32°C and the plant keeps flowering and setting nothing. The two
 * deserve different words and different colours, which is why this
 * returns a separate status rather than a severity number.
 */
export function assessTemperature(
  tempC: number,
  cycle: CropCycleDto,
  now: Date = new Date(),
): BandVerdict | null {
  const climate = cycle.climate;
  if (climate === null) return null;

  const day = isDaytime(now);

  // A crop held steady — mushrooms — has identical bands, so the phase
  // is cosmetic for them and the arithmetic stays the same.
  const phase: 'day' | 'night' =
    day || !climate.wants_night_drop ? 'day' : 'night';

  const min = phase === 'day' ? climate.day_min_c : climate.night_min_c;
  const max = phase === 'day' ? climate.day_max_c : climate.night_max_c;

  if (tempC >= climate.critical_high_c) {
    return {
      status: 'critical',
      min,
      max,
      phase,
      headline: `Above ${climate.critical_high_c}°C`,
      note: criticalNote(cycle.crop),
    };
  }

  if (tempC > max) {
    return {
      status: 'high',
      min,
      max,
      phase,
      headline: `Over the ${phase} band`,
      note: `Comfortable is ${min}–${max}°C right now. Yield suffers above it; the crop is lost above ${climate.critical_high_c}°C.`,
    };
  }

  if (tempC < min) {
    return {
      status: 'low',
      min,
      max,
      phase,
      headline: `Under the ${phase} band`,
      note:
        phase === 'night'
          ? `Nights should sit at ${min}–${max}°C. Colder than this slows the crop without doing any harm you can see.`
          : `Comfortable is ${min}–${max}°C. Cool days just grow slowly.`,
    };
  }

  return {
    status: 'ok',
    min,
    max,
    phase,
    headline: `In band`,
    note: `${min}–${max}°C is right for ${cycle.crop_label.toLowerCase()} ${phase === 'day' ? 'during the day' : 'overnight'}.`,
  };
}

/**
 * Why passing the critical high costs the crop, in the crop's own
 * terms. Generic wording here would be worse than none — "too hot"
 * tells a grower nothing they cannot see on the thermometer.
 */
function criticalNote(crop: string): string {
  switch (crop) {
    case 'tomato':
    case 'sweet_pepper':
      return 'Pollen goes sterile at this temperature. The plant keeps flowering and sets no fruit, and nothing looks wrong until the picks never come. Vent or shade now.';
    case 'leafy_green':
      return 'This is where lettuce bolts — it runs to seed and turns bitter, and it does not come back. Shade or cool immediately.';
    case 'mushroom':
      return 'The mycelium stalls here and green mould takes the substrate instead. It spreads through a room of bags, not one tray.';
    case 'cucumber':
      return 'Fruit turns bitter and misshapen above this. The plant survives; the crop is not saleable.';
    case 'hot_pepper':
      return 'Past what even hot pepper tolerates — flowers drop rather than set.';
    default:
      return 'Past the point where this crop can be saved by cooling later.';
  }
}

/**
 * Sort worst first, so the bay that needs the grower is at the top.
 *
 * Same reasoning as the cold room index: a list ordered by name makes
 * someone with eleven bays read all eleven to find the one with a
 * problem. Ordered by trouble, either the answer is first or there
 * isn't one.
 */
export function severityRank(status: BandVerdict['status'] | null): number {
  switch (status) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'low':
      return 2;
    case 'ok':
      return 3;
    default:
      // No reading at all ranks last: a bay with no sensor is a gap in
      // coverage, not an emergency, and it must not push a bay that is
      // actually cooking down the page.
      return 4;
  }
}
