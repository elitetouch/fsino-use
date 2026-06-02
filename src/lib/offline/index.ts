/**
 * Public surface of the offline subsystem.
 *
 * Usage:
 *   import { getOffline, mutateOffline, useOnline, useOutboxSize } from '@/lib/offline';
 *
 * Lifecycle: startSync() must be called once at app boot (done by
 * SwRegistration in src/components/offline/sw-registration.tsx).
 */

export { getOffline, mutateOffline, OfflineError } from './api';
export type { MutateInput, MutateResult } from './api';
export { useOnline, useOnlineTransition, forceNetworkProbe, isOnline } from './network';
export { useOutbox, useOutboxCounts, useOutboxSize } from './hooks';
export { drain, startSync, stopSync } from './sync';
export { retry as retryOutboxEntry, discard as discardOutboxEntry } from './queue';
export { requestPersistentStorage, getStorageQuota } from './db';
export type { OutboxEntry, OutboxStatus } from './db';
