import { describe, it, expect } from 'vitest';
import { parseQuickRecord } from '@/lib/quick-record/parse';
import { buildQuickRecordPayloads } from '@/lib/quick-record/to-payloads';
import type { FlockScheduleItemDto } from '@/lib/api';

/**
 * Vaccines and treatments, read against the flock's own protocol.
 *
 * The rows are the real ones from VaccinationProtocolSeeder, because
 * the whole point is that a farmer's "I gave them vitamin" lands on
 * the row the dashboard is counting, and a tidy fixture would not
 * prove that.
 */
const TODAY = '2026-11-28';
const OPTS = { recordDate: TODAY, moment: 'entire_day' as const };

const STRESS_ID = '11111111-1111-4111-8111-111111111111';
const LASOTA_ID = '22222222-2222-4222-8222-222222222222';
const COCCI_ID = '33333333-3333-4333-8333-333333333333';

const row = (p: Partial<FlockScheduleItemDto>): FlockScheduleItemDto => ({
  id: p.id ?? 'x', kind: p.kind ?? 'vaccine', name: p.name ?? 'X',
  diseaseTarget: p.diseaseTarget ?? null, vaccineStrain: p.vaccineStrain ?? null,
  altNames: p.altNames ?? [], method: p.method ?? null, dosage: p.dosage ?? null,
  ageDays: p.ageDays ?? 0, scheduledDate: p.scheduledDate ?? TODAY,
  windowDays: p.windowDays ?? 1, critical: p.critical ?? false,
  completedAt: p.completedAt ?? null, skipped: p.skipped ?? false,
});

const SCHEDULE: FlockScheduleItemDto[] = [
  row({
    id: STRESS_ID, kind: 'treatment', name: 'Glucose + Multivitamin (anti-stress)',
    diseaseTarget: 'antistress', altNames: ['Vitalyte', 'Stress Pack', 'Anti-stress'],
    dosage: '50g glucose + 5g multivit per 5 L water', scheduledDate: TODAY, windowDays: 0,
  }),
  row({
    id: LASOTA_ID, name: 'Newcastle Disease Booster (Lasota)',
    diseaseTarget: 'newcastle', vaccineStrain: 'Lasota',
    altNames: ['Lasota', 'NDV Lasota'], scheduledDate: '2026-11-27', critical: true,
  }),
  row({
    id: COCCI_ID, kind: 'treatment', name: 'Anticoccidial (Amprolium)',
    diseaseTarget: 'coccidiosis', altNames: ['Amprolium', 'Embazin'],
    scheduledDate: '2026-12-05',
  }),
  row({
    id: '44444444-4444-4444-8444-444444444444', kind: 'treatment',
    name: 'Broad-spectrum antibiotic (prophylactic)', diseaseTarget: 'antibiotic',
    altNames: ['Oxytet', 'Enrofloxacin'], scheduledDate: '2026-11-20',
  }),
];

const ctx = { schedule: SCHEDULE, today: TODAY };
const parse = (text: string) => parseQuickRecord(text, ctx);
const payloadOf = (text: string) =>
  buildQuickRecordPayloads(parse(text).fields, OPTS)[0];

describe('a health record lands on the protocol row it means', () => {
  // The farmer's own example: they give Glucose + Multivitamin and
  // they say "vitamin".
  it('resolves a one-word treatment to the scheduled row', () => {
    const f = parse('i gave them vitamin').fields[0];
    expect(f?.kind).toBe('treatment');
    expect(f?.detail?.treatmentType).toBe('Glucose + Multivitamin (anti-stress)');
    expect(f?.confidence).toBe('high');
    expect(f?.caution).toBeUndefined();
  });

  it('writes the row\'s own name, the reason and the row it was', () => {
    expect(payloadOf('i gave them vitamin')).toMatchObject({
      event_type: 'treatment',
      payload: {
        treatment_type: 'Glucose + Multivitamin (anti-stress)',
        reason: 'Stress (heat, transport, etc.)',
        protocol_item_id: STRESS_ID,
        all_birds: true,
      },
    });
  });

  it('names a vaccine the way the schedule names it', () => {
    expect(payloadOf('vaccinated them with lasota today')).toMatchObject({
      event_type: 'vaccination',
      payload: {
        vaccine_name: 'Newcastle Disease Booster (Lasota)',
        protocol_item_id: LASOTA_ID,
      },
    });
  });

  // No keyword in the shipped tables matches this sentence at all.
  it('understands a product name only the protocol knows', () => {
    const f = parse('started them on oxytet this morning').fields[0];
    expect(f?.kind).toBe('treatment');
    expect(f?.detail?.treatmentType).toBe('Broad-spectrum antibiotic (prophylactic)');
  });

  it('keeps the bird count when one was said', () => {
    expect(payloadOf('treated 200 birds with amprolium')).toMatchObject({
      payload: { birds_affected: 200, all_birds: false },
    });
  });

  it('carries the dose for the chip but never saves it', () => {
    const f = parse('gave them stress pack').fields[0];
    expect(f?.detail?.protocolDosage).toBe('50g glucose + 5g multivit per 5 L water');
    expect(JSON.stringify(payloadOf('gave them stress pack'))).not.toContain('50g');
  });
});

describe('what the farmer is asked to look at', () => {
  it('flags a dose given early', () => {
    const f = parse('gave them amprolium').fields[0];
    expect(f?.confidence).toBe('low');
    expect(f?.caution).toMatch(/Not due for 7 more days/);
  });

  // Late is ordinary farming. Only early is a decision.
  it('says nothing about a dose given late', () => {
    expect(parse('started them on oxytet').fields[0]?.caution).toBeUndefined();
  });

  it('flags a second dose of something already recorded', () => {
    const done = SCHEDULE.map((i) =>
      i.id === STRESS_ID ? { ...i, completedAt: '2026-11-28T08:00:00Z' } : i);
    const f = parseQuickRecord('gave them vitalyte', { schedule: done, today: TODAY })
      .fields[0];
    expect(f?.caution).toMatch(/Already recorded/);
  });

  it('asks rather than guesses when nothing is recognised', () => {
    const f = parse('gave them the usual drug').fields[0];
    expect(f?.kind).toBe('treatment');
    expect(f?.detail?.treatmentType).toBeUndefined();
    expect(f?.caution).toBe('Treatment not recognised. Pick it before saving');
  });

  // The gate the composer puts in front of Save exists because of
  // this: a health field with no name produces no record at all, and
  // the farmer used to be told it had saved.
  it('produces no record while it has no name', () => {
    const fields = parse('gave them the usual drug').fields;
    expect(fields).toHaveLength(1);
    expect(buildQuickRecordPayloads(fields, OPTS)).toHaveLength(0);
  });
});

describe('without a protocol loaded', () => {
  // An older server has no schedule endpoint, and a farmer recording
  // mortality must not notice.
  const plain = (text: string) => parseQuickRecord(text, { today: TODAY });

  it('still reads the shipped vocabulary', () => {
    expect(plain('gave them lasota').fields[0]?.detail?.vaccineName).toBe('Lasota');
    expect(plain('gave them vitamin').fields[0]?.detail?.treatmentType).toBe('vitamin');
  });

  it('writes no protocol reference it cannot stand behind', () => {
    const p = buildQuickRecordPayloads(plain('gave them lasota').fields, OPTS)[0];
    expect(p?.payload).not.toHaveProperty('protocol_item_id');
  });

  it('leaves the reason out rather than inventing one', () => {
    const p = buildQuickRecordPayloads(plain('gave them vitamin').fields, OPTS)[0];
    expect(p?.payload).not.toHaveProperty('reason');
  });
});
