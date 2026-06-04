'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  apiErrorMessage, endpoints,
  type CreateDailyRecordPayload, type DailyRecordWarning,
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
      qc.invalidateQueries({ queryKey: ['daily-records', flockId] });
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
