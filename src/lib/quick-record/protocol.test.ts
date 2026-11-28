import { describe, it, expect } from 'vitest';
import { matchProtocol, scheduleChoices, reasonForTarget } from '@/lib/quick-record/protocol';
import type { FlockScheduleItemDto } from '@/lib/api';

/**
 * Rows copied from the Nigerian broiler protocol in
 * VaccinationProtocolSeeder, because the point of this module is that
 * it works on the farm's real protocol and not on a tidy fixture.
 */
const row = (p: Partial<FlockScheduleItemDto>): FlockScheduleItemDto => ({
  id: p.id ?? 'x', kind: p.kind ?? 'vaccine', name: p.name ?? 'X',
  diseaseTarget: p.diseaseTarget ?? null, vaccineStrain: p.vaccineStrain ?? null,
  altNames: p.altNames ?? [], method: p.method ?? null, dosage: p.dosage ?? null,
  ageDays: p.ageDays ?? 0, scheduledDate: p.scheduledDate ?? '2026-11-28',
  windowDays: p.windowDays ?? 1, critical: p.critical ?? false,
  completedAt: p.completedAt ?? null, skipped: p.skipped ?? false,
});

const SCHEDULE: FlockScheduleItemDto[] = [
  row({
    id: 'nd1', name: 'Newcastle Disease (HB1) + Infectious Bronchitis',
    diseaseTarget: 'newcastle', vaccineStrain: 'HB1 + Ma5', ageDays: 1,
    altNames: ['NDV HB1', 'Newcastle B1', 'IB Ma5', 'NCD HB1+IB'],
    scheduledDate: '2026-11-01', windowDays: 1, critical: true,
  }),
  row({
    id: 'stress', kind: 'treatment', name: 'Glucose + Multivitamin (anti-stress)',
    diseaseTarget: 'antistress', ageDays: 1, windowDays: 0,
    altNames: ['Vitalyte', 'Stress Pack', 'Anti-stress'],
    dosage: '50g glucose + 5g multivit per 5 L water',
    scheduledDate: '2026-11-28',
  }),
  row({
    id: 'abx', kind: 'treatment', name: 'Broad-spectrum antibiotic (prophylactic)',
    diseaseTarget: 'antibiotic', ageDays: 4, windowDays: 1,
    altNames: ['Oxytet', 'Enrofloxacin', 'Tylosin', 'Doxycycline'],
    scheduledDate: '2026-11-04',
  }),
  row({
    id: 'gum7', name: 'Gumboro / Infectious Bursal Disease (intermediate)',
    diseaseTarget: 'gumboro', vaccineStrain: 'IBD intermediate (D78 / Bursine-2)',
    ageDays: 7, altNames: ['Gumboro', 'IBD', 'IBDV', 'Bursine'],
    scheduledDate: '2026-11-07', critical: true,
  }),
  row({
    id: 'nd10', name: 'Newcastle Disease Booster (Lasota)',
    diseaseTarget: 'newcastle', vaccineStrain: 'Lasota', ageDays: 10,
    altNames: ['Lasota', 'NDV Lasota', 'Newcastle Lasota'],
    scheduledDate: '2026-11-26', critical: true,
  }),
  row({
    id: 'cocci', kind: 'treatment', name: 'Anticoccidial (Amprolium)',
    diseaseTarget: 'coccidiosis', ageDays: 14,
    altNames: ['Amprolium', 'Embazin', 'Coccidiostat'],
    scheduledDate: '2026-12-02', critical: true,
  }),
];

const TODAY = '2026-11-28';
const match = (clause: string) => matchProtocol(clause, SCHEDULE, TODAY);

describe('what the farmer said, resolved to the farm\'s own protocol', () => {
  // The sentence that started this. "vitamin" wrote "vitamin", and the
  // scheduled dose it was meant to tick stayed upcoming.
  it('resolves "vitamin" to the row it means', () => {
    const m = match('i gave them vitamin');
    expect(m?.name).toBe('Glucose + Multivitamin (anti-stress)');
    expect(m?.kind).toBe('treatment');
    expect(m?.due).toBe(true);
  });

  it('resolves the brand names a farmer actually says', () => {
    expect(match('gave them vitalyte today')?.id).toBe('stress');
    expect(match('started oxytet')?.id).toBe('abx');
    expect(match('gave amprolium in the water')?.id).toBe('cocci');
  });

  it('carries the dose back so it can be shown before saving', () => {
    expect(match('gave them stress pack')?.dosage)
      .toBe('50g glucose + 5g multivit per 5 L water');
  });

  // Three Newcastle rows in one cycle, differing by strain and day.
  it('prefers the more specific name', () => {
    expect(match('gave them lasota')?.id).toBe('nd10');
    expect(match('gave the newcastle lasota booster')?.id).toBe('nd10');
  });

  it('prefers the dose that is actually due', () => {
    // "newcastle" alone matches both rows equally. The day-10 booster
    // is two days ago; the day-1 priming is four weeks back.
    expect(match('vaccinated them for newcastle')?.id).toBe('nd10');
  });

  it('knows whether it was due', () => {
    expect(match('gave them vitamin')?.due).toBe(true);
    expect(match('gave amprolium')?.due).toBe(false);
    expect(match('gave amprolium')?.daysFromToday).toBe(4);
  });

  it('fills the treatment reason from what the row is for', () => {
    expect(reasonForTarget(match('gave them vitamin')?.diseaseTarget))
      .toBe('Stress (heat, transport, etc.)');
    expect(reasonForTarget('coccidiosis')).toBe('Digestive illness');
    // Anything not mapped stays empty rather than inventing a reason.
    expect(reasonForTarget('newcastle')).toBeUndefined();
    expect(reasonForTarget(null)).toBeUndefined();
  });
});

describe('what must not resolve', () => {
  it('returns null when nothing in the sentence names a protocol row', () => {
    expect(match('15 birds died')).toBeNull();
    expect(match('gave them 2 bags of feed')).toBeNull();
  });

  it('returns null without a schedule', () => {
    expect(matchProtocol('gave them vitamin', undefined, TODAY)).toBeNull();
    expect(matchProtocol('gave them vitamin', [], TODAY)).toBeNull();
  });

  // Every protocol name contains these. Matching on them would make
  // the first row answer every sentence.
  it('does not match on a word that identifies nothing', () => {
    expect(match('gave them a dose of something')).toBeNull();
    expect(match('treatment given in drinking water')).toBeNull();
  });

  it('does not find a short code inside an ordinary word', () => {
    // "ib" is infectious bronchitis and also sits inside "bird".
    expect(match('15 birds died in the night')).toBeNull();
  });

  it('does not find a term starting mid-word', () => {
    expect(match('gave them revitamind')).toBeNull();
  });

  it('skips a row the farmer removed from the protocol', () => {
    const skipped = SCHEDULE.map((i) =>
      i.id === 'stress' ? { ...i, skipped: true } : i);
    expect(matchProtocol('gave them vitalyte', skipped, TODAY)).toBeNull();
  });

  // Names arrive from the API. If any of this were compiled into a
  // regex, a row called "Gumboro (D78/+)" would be a pattern.
  it('treats a name with regex characters as plain text', () => {
    const odd = [row({ id: 'odd', name: 'Gumboro (D78/+)', altNames: ['D78/+'] })];
    expect(matchProtocol('gave them gumboro', odd, TODAY)?.id).toBe('odd');
    expect(matchProtocol('gave them aaaa', odd, TODAY)).toBeNull();
  });
});

describe('the picker', () => {
  it('opens where the farmer is in the cycle', () => {
    const list = scheduleChoices(SCHEDULE, TODAY);
    expect(list[0]?.id).toBe('stress');
    expect(list.map((i) => i.id)).toContain('cocci');
  });

  it('offers only the kind being corrected', () => {
    expect(scheduleChoices(SCHEDULE, TODAY, 'vaccination').every((i) => i.kind === 'vaccine'))
      .toBe(true);
    expect(scheduleChoices(SCHEDULE, TODAY, 'treatment').map((i) => i.id))
      .toEqual(['stress', 'cocci', 'abx']);
  });
});
