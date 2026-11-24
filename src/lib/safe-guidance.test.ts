import { describe, it, expect } from 'vitest';
import { withSafeSections } from './safe-guidance';
import type { DailyRecordGuidance } from '@/lib/api';

/**
 * Each wizard step reads its own guidance section directly, so one
 * missing section is not a missing hint — it is "Cannot read
 * properties of undefined (reading 'usual_quantity')" and the whole
 * record screen replaced by an error page.
 *
 * The live API sends all eight. These cover the two bodies that are
 * not the live API: one restored from the persisted offline cache,
 * written by an older build, and one from a server that has not yet
 * caught up with a newly added step.
 */
const bodyWith = (sections: Record<string, unknown>) =>
  ({ flock: { id: 'f1' }, sections } as unknown as DailyRecordGuidance);

const ALL = [
  'feed', 'water', 'vaccination', 'treatment',
  'bird_count', 'weight', 'eggs', 'egg_size',
] as const;

describe('guidance always has every section', () => {
  it('fills in a section the server did not send', () => {
    const safe = withSafeSections(bodyWith({ feed: { enabled: true, messages: [] } }));
    for (const key of ALL) {
      expect(safe.sections[key], `${key} must be present`).toBeDefined();
      expect(Array.isArray(safe.sections[key].messages)).toBe(true);
    }
  });

  it('reading a filled section cannot throw', () => {
    // The exact crash: a step reaching for usual_quantity on a section
    // that was not in the body.
    const safe = withSafeSections(bodyWith({}));
    expect(() => safe.sections.weight.usual_quantity).not.toThrow();
    expect(safe.sections.weight.usual_quantity).toBeUndefined();
    expect(safe.sections.bird_count.messages).toEqual([]);
  });

  it('never overwrites a section the server did send', () => {
    const real = { enabled: true, messages: [], usual_quantity: { low: 1, high: 2, avg: 1.5 } };
    const safe = withSafeSections(bodyWith({ weight: real }));
    expect(safe.sections.weight).toBe(real);
  });

  it('returns the same object when nothing was missing', () => {
    const complete = bodyWith(
      Object.fromEntries(ALL.map((k) => [k, { enabled: true, messages: [] }])),
    );
    expect(withSafeSections(complete)).toBe(complete);
  });

  it('survives a body with no sections at all', () => {
    const safe = withSafeSections({ flock: { id: 'f1' } } as unknown as DailyRecordGuidance);
    expect(safe.sections.feed.messages).toEqual([]);
  });
});
