'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  apiErrorMessage, endpoints,
  type CreateDailyRecordPayload, type DailyRecordDto, type DailyRecordWarning,
} from '@/lib/api';

/**
 * Shared create-record mutation for every event step in the wizard.
 *
 * Why each step doesn't define its own useMutation:
 *  - Single invalidation rule for guidance/calendar/cycle state on
 *    every successful POST — we don't want each step to remember.
 *  - Single error toast formatting — one place to tweak copy.
 *  - The `onSuccess` argument lets the caller react with warnings
 *    handling (Are-you-sure red text) and step-advance logic without
 *    re-implementing the cache plumbing.
 */
export function useCreateDailyRecord(flockId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDailyRecordPayload) =>
      endpoints.createDailyRecord(flockId, payload),
    onSuccess: (data) => {
      // Guidance changes after every record (usual-range stats shift,
      // last-entry snapshot moves, etc) — invalidate so the next step
      // re-pulls fresh hints.
      qc.invalidateQueries({ queryKey: ['daily-record-guidance', flockId] });
      // Calendar coloring changes — the day the record belongs to now
      // has data, so the picker shows the right tint next time.
      qc.invalidateQueries({ queryKey: ['daily-record-calendar', flockId] });
      // Cycle detail dashboard summarises records; nudge it.
      qc.invalidateQueries({ queryKey: ['cycle', flockId] });
      qc.invalidateQueries({ queryKey: ['flock', flockId] });
      // If the POST shrank the flock (mortality/sale/bird_count), the
      // flock's current_birds also changed — kick the flocks-list query
      // so any dashboards reading aggregate counts pick it up.
      qc.invalidateQueries({ queryKey: ['flocks'] });
      // Surface any soft anomaly warnings the server returned. These
      // are advisory — the record was already saved.
      surfaceWarnings(data.warnings);
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Could not save this record.'));
    },
  });
}

/**
 * List records for a flock on a specific date — drives the wizard's
 * EDIT mode. Each step component picks the row matching its
 * event_type from the returned list and pre-fills its form.
 *
 * The query is keyed on (flockId, date) so re-visits and date changes
 * are instant. Invalidated on every mutation success so post-edit
 * state stays consistent.
 *
 * Pass `enabled: false` (via the `enabled` arg) on the FIRST date
 * picker render so we don't burn a request for a date that almost
 * certainly has no records.
 */
export function useDailyRecordsForDate(flockId: string, date: string, enabled = true) {
  return useQuery({
    queryKey: ['daily-records', flockId, date],
    queryFn: () => endpoints.listDailyRecords(flockId, date),
    staleTime: 30_000,
    enabled: enabled && !!flockId && !!date,
  });
}

/**
 * Pick the most-recent record for a given event_type from the list.
 *
 * Retained for the cases where only one row makes semantic sense
 * (the egg_metrics synthetic step always reads "the eggs row for
 * this day"). For everything else prefer `pickAllRecords` and let
 * the step's EntryPicker make the ambiguity explicit when there
 * are 2+ rows.
 */
export function pickRecord(
  records: DailyRecordDto[] | undefined,
  eventType: DailyRecordDto['eventType'],
): DailyRecordDto | undefined {
  if (!records || records.length === 0) return undefined;
  return records
    .filter((r) => r.eventType === eventType)
    .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))[0];
}

/**
 * Pull every record of a given event_type from the day's list.
 *
 * Used by the edit-mode picker: when the day has 2+ feed rows logged
 * by different staff, we hand the array to the FeedStep which shows
 * an EntryPicker rather than silently overwriting the most-recent
 * one. Returned sorted oldest-first (chronological); the picker
 * renders that order to match the mental picture of "morning →
 * midday → afternoon → evening".
 */
export function pickAllRecords(
  records: DailyRecordDto[] | undefined,
  eventType: DailyRecordDto['eventType'],
): DailyRecordDto[] {
  if (!records || records.length === 0) return [];
  return records
    .filter((r) => r.eventType === eventType)
    .sort((a, b) => (a.occurredAt ?? '').localeCompare(b.occurredAt ?? ''));
}

/**
 * The PATCH-instead-of-POST companion for EDIT mode. Backend restricts
 * which fields can be edited (see UpdateFlockDailyRecordRequest); the
 * caller is expected to compose only those descriptive fields.
 */
export function useUpdateDailyRecord(flockId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: { recordId: string; payload: Parameters<typeof endpoints.updateDailyRecord>[2] }) =>
      endpoints.updateDailyRecord(flockId, vars.recordId, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-record-guidance', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-record-calendar', flockId] });
      qc.invalidateQueries({ queryKey: ['daily-records', flockId] });
      qc.invalidateQueries({ queryKey: ['cycle', flockId] });
      qc.invalidateQueries({ queryKey: ['flock', flockId] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Could not save your edits.'));
    },
  });
}

/**
 * Render server-returned warnings as toasts. Anomaly warnings are
 * advisory only — the record was already persisted. The "Are you
 * sure?" red text under each input shows the same data inline for the
 * common cases; the toast is a safety net for any code path the
 * inline check missed.
 */
function surfaceWarnings(warnings: DailyRecordWarning[] | undefined): void {
  if (!warnings?.length) return;
  for (const w of warnings) {
    toast.warning(w.message);
  }
}
