'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  apiErrorMessage, endpoints,
  type CreateDailyRecordPayload, type DailyRecordDto, type DailyRecordWarning,
} from '@/lib/api';
import { mutateOffline } from '@/lib/offline/api';

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
export interface CreateDailyRecordResult {
  record?: DailyRecordDto;
  flockCurrentBirds?: number;
  warnings: DailyRecordWarning[];
  /** False when the record is queued rather than stored on the server. */
  synced: boolean;
}

/**
 * Create a daily record, surviving no signal.
 *
 * Offline the server never answers, so there are no warnings and no
 * updated bird count to report. We return `synced: false` and an empty
 * warning list rather than inventing either — an "all clear" the server
 * never gave would be a lie, and a fabricated bird count would be worse.
 */
async function createDailyRecordOffline(
  flockId: string,
  payload: CreateDailyRecordPayload,
): Promise<CreateDailyRecordResult> {
  const res = await mutateOffline<{
    data?: { record: DailyRecordDto; flockCurrentBirds: number; warnings: DailyRecordWarning[] };
    record?: DailyRecordDto;
    flockCurrentBirds?: number;
    warnings?: DailyRecordWarning[];
  }>({
    method: 'POST',
    url: `/flocks/${flockId}/daily-records`,
    body: payload,
    scope: `flock:${flockId}`,
  });

  if (!res.sentNow || !res.data) {
    return { warnings: [], synced: false };
  }

  // The API wraps successful bodies in `data`; unwrap defensively rather
  // than asserting, since this path now also carries queued replays.
  const body = res.data.data ?? res.data;
  return {
    record: body.record,
    flockCurrentBirds: body.flockCurrentBirds,
    warnings: Array.isArray(body.warnings) ? body.warnings : [],
    synced: true,
  };
}

export function useCreateDailyRecord(flockId: string) {
  const qc = useQueryClient();

  return useMutation({
    /**
     * Routed through the offline outbox, NOT straight at the network.
     *
     * Before this, a record written with no signal threw and was lost —
     * the farmer had typed it, the app said it failed, and that was the
     * end of it. A farm shed is exactly where the signal goes, so the
     * one screen that must survive it was the one screen that did not.
     *
     * Online it still posts immediately and returns the server's body.
     * Offline (or on a transient failure) it is queued with an
     * idempotency key and drains by itself — the sync engine retries on
     * reconnect, on outbox change, on a 60-second failsafe and on the
     * service worker's background-sync event. There is no button and
     * there is nothing for the farmer to remember.
     */
    mutationFn: (payload: CreateDailyRecordPayload) =>
      createDailyRecordOffline(flockId, payload),
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
      // Pen dashboard powers every card on /home and /cycles/[id]
      // (feed, water, mortality, eggs, vaccination). Without this
      // invalidation the user submits a record, navigates back to the
      // dashboard, and sees yesterday's numbers until they hard-refresh.
      // Keyed by penId on the consumer side — broadcast to all penIds
      // by omitting the second key segment.
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
      // If the POST shrank the flock (mortality/sale/bird_count), the
      // flock's current_birds also changed — kick the flocks-list query
      // so any dashboards reading aggregate counts pick it up.
      qc.invalidateQueries({ queryKey: ['flocks'] });
      // Surface any soft anomaly warnings the server returned. These
      // are advisory — the record was already saved.
      // Queued records get a plain confirmation instead of warnings —
      // the server has not seen it yet, so there is nothing to warn
      // about and claiming otherwise would be false reassurance.
      if (data.synced) {
        surfaceWarnings(data.warnings);
      } else {
        toast.success('Saved on your phone. It will upload by itself.');
      }
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
      // Same rationale as createDailyRecord — edits change the
      // aggregates that drive every dashboard card.
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
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
