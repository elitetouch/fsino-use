'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mutateOffline } from '@/lib/offline/api';
import type { ExpensePayload } from '@/lib/quick-record/to-payloads';

/**
 * Record an expense, surviving no signal.
 *
 * The same outbox the daily records use, so an expense spoken in a
 * pen with no coverage is queued and sent when the signal returns —
 * and, like a daily record, a 4xx is thrown rather than queued, so a
 * rejection surfaces as a rejection instead of sitting in the outbox
 * being retried forever.
 *
 * `scope` is per farm rather than per flock: a farm-wide cost (a
 * generator, a wage) has no flock at all, and grouping those under a
 * flock that happens to be open would misreport which cycle is
 * waiting to sync.
 */
export function useCreateExpense() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ExpensePayload) => {
      const res = await mutateOffline({
        method: 'POST',
        url: '/expenses',
        body: payload,
        scope: 'expenses',
      });
      return { synced: res.sentNow };
    },
    onSuccess: () => {
      // The ledger and everything computed from it. Cost projection
      // and the margin cards read these, so an expense that did not
      // invalidate them would show the farmer a figure they had just
      // changed.
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-totals'] });
      qc.invalidateQueries({ queryKey: ['flock-report-summary'] });
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
    },
  });
}
