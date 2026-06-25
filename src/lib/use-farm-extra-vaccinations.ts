'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage, endpoints, type FarmExtraVaccinationPayload } from '@/lib/api';

/**
 * Mutation: adopt a vaccine/treatment into the farm's standing
 * protocol. Called from the dashboard's vaccination card — both from
 * an off-schedule row's "+ Add to my protocol" tap and from a
 * cross-cycle suggestion banner.
 *
 * On success we invalidate the pen-dashboard query so the off-schedule
 * row disappears and the suggestion banner refreshes — the materializer
 * pulls farm extras at flock creation time, so they only appear in
 * existing flock schedules when a new flock is placed. The dashboard
 * recompute is still useful: the off-schedule row this came from no
 * longer needs the "Add to my protocol" CTA (the user just adopted it)
 * and the suggestion list collapses by one.
 */
export function useAddFarmExtraVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FarmExtraVaccinationPayload) =>
      endpoints.addFarmExtraVaccination(payload),
    onSuccess: () => {
      toast.success('Added to your farm protocol.');
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
      qc.invalidateQueries({ queryKey: ['farm-extra-vaccinations'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Could not add to your protocol.'));
    },
  });
}

export function useRemoveFarmExtraVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => endpoints.removeFarmExtraVaccination(id),
    onSuccess: () => {
      toast.success('Removed from your farm protocol.');
      qc.invalidateQueries({ queryKey: ['pen-dashboard'] });
      qc.invalidateQueries({ queryKey: ['farm-extra-vaccinations'] });
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Could not remove from your protocol.'));
    },
  });
}
