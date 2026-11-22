'use client';

import { getDB } from '@/lib/offline/db';
import { mutateOffline, getOffline } from '@/lib/offline/api';
import { allAliases, isLearnableToken, NEVER_LEARNED } from './learning';

/**
 * Keep a farmer's learned vocabulary with their account, not their
 * handset.
 *
 * WHY IT SYNCS AT ALL. The vocabulary is earned slowly — three
 * corrections per word — and losing it to a cracked screen or a new
 * phone would mean starting over. It is also the raw material for the
 * shipped list: a word dozens of farmers independently teach the app
 * is a word the app should simply know.
 *
 * WHAT CROSSES THE WIRE, AND WHAT NEVER DOES. A token and the kind it
 * maps to. Never a sentence, never a transcript, never audio. The
 * dictation is the most personal thing this app touches and it stays
 * on the phone — syncing "zobo means feed" carries essentially nothing
 * about the farmer, while syncing what they said would carry
 * everything.
 *
 * THERE IS NO BUTTON, AND THERE IS NOTHING TO REMEMBER. The push goes
 * through the same outbox as a daily record, so it inherits
 * retry-on-reconnect, the 60-second failsafe, background sync and the
 * idempotency key for free. Offline it simply queues. The pull runs on
 * app start through the offline-aware GET, which serves cache when
 * there is no signal.
 *
 * Nothing here ever throws into a caller. A vocabulary that fails to
 * sync is a vocabulary that works locally, which is the whole point of
 * it being local first.
 */

const LAST_PUSH_KEY = 'vocab.lastPushAt';
const LAST_PULL_KEY = 'vocab.lastPullAt';

/** Don't re-push more than once an hour; nothing here is urgent. */
const MIN_INTERVAL_MS = 60 * 60 * 1000;

interface RemoteAlias {
  token: unknown;
  kind: unknown;
  hits?: unknown;
  active?: unknown;
}

async function readMeta(key: string): Promise<number> {
  try {
    const db = await getDB();
    const row = await db.get('meta', key);
    const v = (row as { value?: unknown } | undefined)?.value;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

async function writeMeta(key: string, value: number): Promise<void> {
  try {
    const db = await getDB();
    await db.put('meta', { key, value });
  } catch {
    /* non-fatal */
  }
}

/**
 * Push this device's vocabulary up, tombstones included.
 *
 * Deactivations must travel too — a word the farmer deleted here has
 * to stay deleted on their other phone, and sending only the active
 * rows would let the other device keep teaching it back.
 */
export async function pushVocab(): Promise<void> {
  try {
    const since = await readMeta(LAST_PUSH_KEY);
    if (Date.now() - since < MIN_INTERVAL_MS) return;

    const rows = await allAliases();
    if (rows.length === 0) return;

    await mutateOffline({
      method: 'POST',
      url: '/vocab-aliases',
      body: {
        aliases: rows.map((a) => ({
          token: a.token,
          kind: a.kind,
          hits: a.hits,
          active: a.active,
        })),
      },
      scope: 'vocab',
    });

    await writeMeta(LAST_PUSH_KEY, Date.now());
  } catch {
    // Queued or not, the local vocabulary is unaffected.
  }
}

/**
 * Pull the account's vocabulary down and merge it in.
 *
 * EVERY ROW IS RE-VALIDATED AGAINST THE SAME RULES AS A LOCALLY
 * LEARNED ONE. The server validates on write, but a response is still
 * input: this device cannot know which version of the API answered,
 * and a token that fails the local rules must never be installed
 * merely because it arrived over the network.
 *
 * A locally deactivated word stays deactivated, whatever the server
 * says. The farmer rejected it on this device; a sync is not an
 * argument.
 */
export async function pullVocab(): Promise<void> {
  try {
    const since = await readMeta(LAST_PULL_KEY);
    if (Date.now() - since < MIN_INTERVAL_MS) return;

    const res = await getOffline<{ data?: { aliases?: RemoteAlias[] }; aliases?: RemoteAlias[] }>(
      '/vocab-aliases',
      { staleMs: MIN_INTERVAL_MS, expireMs: 7 * 24 * 60 * 60 * 1000 },
    );
    const remote = res.data?.data?.aliases ?? res.data?.aliases;
    if (!Array.isArray(remote)) return;

    const db = await getDB();
    for (const row of remote.slice(0, 300)) {
      const token = row?.token;
      const kind = row?.kind;
      if (!isLearnableToken(token)) continue;
      if (typeof kind !== 'string') continue;
      // The server refuses these too. Refused again here, because a
      // client should not install an alias that can move a flock count
      // on the word of any response.
      if (NEVER_LEARNED.has(kind as never)) continue;

      const existing = await db.get('vocabAliases', token);
      const localActive = (existing as { active?: boolean } | undefined)?.active;
      if (localActive === false) continue; // the farmer said no here

      await db.put('vocabAliases', {
        token,
        kind,
        hits: typeof row.hits === 'number' && Number.isFinite(row.hits) ? row.hits : 0,
        createdAt:
          (existing as { createdAt?: number } | undefined)?.createdAt ?? Date.now(),
        active: row.active !== false,
        syncedAt: Date.now(),
      });
    }

    await writeMeta(LAST_PULL_KEY, Date.now());
  } catch {
    // No signal, no endpoint, bad shape — the local vocabulary stands.
  }
}

/**
 * Run both, in the background, on app start.
 *
 * Pull first so a new phone is useful immediately, then push so
 * anything learned here reaches the account. Deliberately fire-and-
 * forget: nothing the farmer is doing should wait on this.
 */
export function syncVocabInBackground(): void {
  if (typeof window === 'undefined') return;
  void (async () => {
    await pullVocab();
    await pushVocab();
  })();
}
