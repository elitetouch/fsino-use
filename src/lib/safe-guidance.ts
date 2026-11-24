import type { DailyRecordGuidance, GuidanceSection } from '@/lib/api';

/**
 * Guidance with every section present.
 *
 * WHY. Each wizard step reads its own section directly —
 * `guidance.sections.weight.usual_quantity`, and so on — so a single
 * missing section is not a missing hint, it is
 * "Cannot read properties of undefined" and the whole record screen
 * replaced by an error.
 *
 * The live API sends all eight, so this is not about today's server.
 * It is about the two ways the client gets a body that is not today's
 * server: a response restored from the persisted offline cache,
 * written by an older build, and a deploy that adds a step before the
 * API that feeds it. Both are routine here, and neither should cost a
 * farmer the screen they record on.
 *
 * `enabled: false` with no messages is the honest default — the step
 * renders with no hints rather than inventing any.
 */
const EMPTY: GuidanceSection = { enabled: false, messages: [] };

const SECTIONS = [
  'feed', 'water', 'vaccination', 'treatment',
  'bird_count', 'weight', 'eggs', 'egg_size',
] as const;

export function withSafeSections(guidance: DailyRecordGuidance): DailyRecordGuidance {
  const sections = { ...(guidance.sections ?? {}) } as DailyRecordGuidance['sections'];
  let patched = false;

  for (const key of SECTIONS) {
    if (!sections[key]) {
      sections[key] = EMPTY;
      patched = true;
    }
  }

  return patched ? { ...guidance, sections } : guidance;
}
