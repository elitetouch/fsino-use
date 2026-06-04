'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  apiErrorMessage, endpoints,
  type FarmSettingsDto, type MyPreferencesDto,
} from '@/lib/api';
import { deepMerge } from '@/components/settings/primitives';

/* ------------------------------------------------------------------ */
/*  My preferences                                                     */
/* ------------------------------------------------------------------ */

/**
 * Reactive read of the current user's preferences for the active farm.
 * Single React-Query key so every sub-page shares one cache entry.
 */
export function useMyPreferences() {
  return useQuery({
    queryKey: ['my-preferences'],
    queryFn: () => endpoints.getMyPreferences(),
    staleTime: 30_000,
  });
}

/**
 * Mutation hook with built-in optimistic update + rollback on error.
 * Accepts the same partial shape the server does — see
 * UpdateMyFarmPreferenceRequest for the contract.
 *
 * The server auto-flips `daily_record_preset` to "custom" whenever a
 * per-field toggle is patched without naming `preset`, so the caller
 * never has to know about that nuance: send a toggle, get the new
 * preset back in the response.
 */
export function useUpdateMyPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: endpoints.updateMyPreferences,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['my-preferences'] });
      const previous = qc.getQueryData<{ preferences: MyPreferencesDto }>(['my-preferences']);
      if (previous) {
        const dc = (patch.dashboard_config ?? {}) as Record<string, unknown>;
        const next: MyPreferencesDto = {
          ...previous.preferences,
          viewMode: (dc.view_mode as MyPreferencesDto['viewMode']) ?? previous.preferences.viewMode,
          // Preset: explicit `preset` wins, then dashboard_config.daily_record_preset,
          // otherwise — if any daily_record key was patched, optimistically flip
          // to "custom" to match the server's behaviour. The real value comes
          // back on success so this only matters for the 200ms before then.
          dailyRecordPreset:
            (patch.preset as MyPreferencesDto['dailyRecordPreset']) ??
            (dc.daily_record_preset as MyPreferencesDto['dailyRecordPreset']) ??
            (dc.daily_record ? 'custom' : previous.preferences.dailyRecordPreset),
          dailyRecord: deepMerge(
            previous.preferences.dailyRecord as Record<string, unknown>,
            (dc.daily_record as object) ?? {},
          ) as MyPreferencesDto['dailyRecord'],
          dashboard: {
            cards: {
              ...previous.preferences.dashboard.cards,
              ...((dc.dashboard as { cards?: Record<string, boolean> })?.cards ?? {}),
            },
          },
          finance: {
            ...previous.preferences.finance,
            ...((dc.finance as object) ?? {}),
          },
          notifications: {
            ...previous.preferences.notifications,
            ...((dc.notifications as object) ?? {}),
          },
        };
        qc.setQueryData(['my-preferences'], { preferences: next });
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['my-preferences'], ctx.previous);
      toast.error(apiErrorMessage(err, 'Could not save your preferences.'));
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Farm settings                                                      */
/* ------------------------------------------------------------------ */

export function useFarmSettings() {
  return useQuery({
    queryKey: ['farm-settings'],
    queryFn: () => endpoints.getFarmSettings(),
    staleTime: 30_000,
  });
}

export function useUpdateFarmSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: endpoints.updateFarmSettings,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['farm-settings'] });
      const previous = qc.getQueryData<{ settings: FarmSettingsDto }>(['farm-settings']);
      if (previous) {
        const next: FarmSettingsDto = {
          ...previous.settings,
          dailyRecordPreset: (patch.daily_record_preset as FarmSettingsDto['dailyRecordPreset']) ?? previous.settings.dailyRecordPreset,
          dailyRecordConfig: deepMerge(
            previous.settings.dailyRecordConfig as Record<string, unknown>,
            (patch.daily_record_config as object) ?? {},
          ) as FarmSettingsDto['dailyRecordConfig'],
          notificationConfig: {
            ...previous.settings.notificationConfig,
            ...((patch.notification_config as object) ?? {}),
          },
        };
        qc.setQueryData(['farm-settings'], { settings: next });
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['farm-settings'], ctx.previous);
      toast.error(apiErrorMessage(err, 'Could not save farm settings.'));
    },
    onSuccess: () => {
      // Farm setting changes alter the user-pref ceiling; force a
      // re-fetch of my-preferences so effectiveDailyRecord reflects
      // the new ceiling immediately.
      qc.invalidateQueries({ queryKey: ['my-preferences'] });
    },
  });
}
