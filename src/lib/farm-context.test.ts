import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Which farm a farmer lands on when they come back.
 *
 * Getting this wrong is quiet and constant: they sign in, land on a
 * farm they were not working in, and either notice and switch every
 * time or record against the wrong one.
 */

const user = { value: { id: 7 } as { id: number } | null };
vi.mock('./auth', () => ({ readUser: () => user.value }));

const store = new Map<string, string>();

beforeEach(async () => {
  vi.resetModules();
  store.clear();
  user.value = { id: 7 };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener() {},
    removeEventListener() {},
  });
});

const load = () => import('./farm-context');

describe('remembering the farm', () => {
  it('returns the farm this user last chose', async () => {
    const { writeCurrentFarmId, readCurrentFarmId } = await load();
    writeCurrentFarmId('farm-b');
    expect(readCurrentFarmId()).toBe('farm-b');
  });

  it('keeps two users on one phone apart', async () => {
    const { writeCurrentFarmId, readCurrentFarmId } = await load();
    writeCurrentFarmId('farm-a');

    user.value = { id: 99 };
    expect(readCurrentFarmId()).toBeNull();
    writeCurrentFarmId('farm-z');

    user.value = { id: 7 };
    expect(readCurrentFarmId()).toBe('farm-a');
  });

  it('adopts a choice made before the key was scoped per user', async () => {
    // Nobody should be bounced to another farm by the upgrade itself.
    store.set('fsm.app.currentFarmId', 'farm-legacy');
    const { readCurrentFarmId } = await load();
    expect(readCurrentFarmId()).toBe('farm-legacy');
    // And it is adopted, so the legacy value is not re-read forever.
    expect(store.get('fsm.app.currentFarmId:7')).toBe('farm-legacy');
  });

  it('clears only this user’s choice, never everyone’s', async () => {
    const { writeCurrentFarmId, readCurrentFarmId } = await load();
    writeCurrentFarmId('farm-a');

    user.value = { id: 99 };
    writeCurrentFarmId('farm-z');
    writeCurrentFarmId(null);
    expect(readCurrentFarmId()).toBeNull();

    user.value = { id: 7 };
    expect(readCurrentFarmId()).toBe('farm-a');
  });

  it('falls back to the unscoped key when nobody is signed in', async () => {
    // readUser() is null before sign-in; writes must still land
    // somewhere readable rather than being dropped.
    user.value = null;
    const { writeCurrentFarmId, readCurrentFarmId } = await load();
    writeCurrentFarmId('farm-pre-login');
    expect(readCurrentFarmId()).toBe('farm-pre-login');
  });

  it('treats the stored junk values as nothing', async () => {
    const { readCurrentFarmId } = await load();
    for (const junk of ['null', 'undefined', '']) {
      store.set('fsm.app.currentFarmId:7', junk);
      expect(readCurrentFarmId()).toBeNull();
    }
  });
});
