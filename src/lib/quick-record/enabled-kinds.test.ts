import { describe, it, expect } from 'vitest';
import { enabledKinds, notTrackedReason } from './enabled-kinds';
import type { DailyRecordPrefs } from '@/lib/api';

/**
 * Quick record and the wizard must agree on what a farm records.
 *
 * When they disagreed, quick record posted an event the farm had
 * switched off, the server answered "water records are disabled in
 * this farm settings", and the outbox classed that 422 as permanent —
 * a record that could never be sent, under a "Try again" button that
 * would refuse it every time.
 */
const prefs = (p: DailyRecordPrefs): DailyRecordPrefs => p;

describe('what the farm records', () => {
  it('drops an event the farm has switched off', () => {
    const on = enabledKinds(prefs({ feed: { include: true }, water: { include: false } }));
    expect(on.has('feed')).toBe(true);
    expect(on.has('water')).toBe(false);
  });

  it('treats a missing section as off, matching the wizard', () => {
    // buildStepList uses `eff.water?.include`, so absent is no step.
    const on = enabledKinds(prefs({ feed: { include: true } }));
    expect(on.has('water')).toBe(false);
  });

  it('maps each bird movement to its own switch', () => {
    const on = enabledKinds(prefs({ bird_count: { dead: true, culled: false, sold: true } }));
    expect(on.has('dead')).toBe(true);
    expect(on.has('sold')).toBe(true);
    expect(on.has('culled')).toBe(false);
    expect(on.has('lost')).toBe(false);
  });

  it('only allows egg weight when eggs themselves are on', () => {
    // Egg weight rides on the eggs payload, so it cannot stand alone.
    const off = enabledKinds(prefs({ eggs: { include: false }, egg_metrics: { track_weight: true } }));
    expect(off.has('egg_weight')).toBe(false);

    const on = enabledKinds(prefs({ eggs: { include: true }, egg_metrics: { track_weight: true } }));
    expect(on.has('egg_weight')).toBe(true);
  });

  it('allows everything when preferences have not loaded', () => {
    // Discarding what the farmer said because a fetch was slow would
    // be worse than letting the server decide.
    for (const p of [null, undefined]) {
      const on = enabledKinds(p);
      expect(on.has('water')).toBe(true);
      expect(on.has('feed')).toBe(true);
      expect(on.has('dead')).toBe(true);
    }
  });

  it('explains itself in the farmer’s words, and says where to change it', () => {
    const reason = notTrackedReason('water');
    expect(reason).toContain('water');
    expect(reason).toMatch(/Daily record settings/i);
  });
});
