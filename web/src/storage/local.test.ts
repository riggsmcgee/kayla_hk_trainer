import { describe, expect, it } from 'vitest';
import type { PracticeRun, SettingsV1 } from '@dojo/shared';
import { DEFAULT_SETTINGS, createLocalStore, type StorageLike } from './local';

/** In-memory Storage stub so these tests run in plain node — no jsdom. */
function createMemoryStorage(): StorageLike & { dump(): Map<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => map,
  };
}

const sampleRun: PracticeRun = {
  id: 'run-1',
  mode: 'dodge',
  enemyId: 'duelist',
  observeMode: true,
  hitsLanded: 0,
  durationMs: 42_000,
  startedAt: '2026-08-21T12:00:00.000Z',
};

describe('run history cap', () => {
  it('keeps only the most recent runs so storage never grows unboundedly', () => {
    const store = createLocalStore(createMemoryStorage());
    for (let i = 0; i < 520; i++) {
      store.addRun({ ...sampleRun, id: `run-${i}` });
    }
    const runs = store.listRuns();
    expect(runs.length).toBe(500);
    expect(runs[0]!.id).toBe('run-20'); // oldest 20 dropped
    expect(runs[499]!.id).toBe('run-519'); // newest kept
  });
});

describe('local store round-trip', () => {
  it('round-trips settings through the injected backend', () => {
    const store = createLocalStore(createMemoryStorage());
    const settings: SettingsV1 = {
      version: 1,
      reduceShake: true,
      reduceFlashing: false,
      inputBindings: { jump: 'Space' },
    };
    store.saveSettings(settings);
    expect(store.getSettings()).toEqual(settings);
  });

  it('returns defaults when nothing is stored', () => {
    const store = createLocalStore(createMemoryStorage());
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(store.listRuns()).toEqual([]);
  });

  it('appends and lists practice runs, and clears them', () => {
    const store = createLocalStore(createMemoryStorage());
    store.addRun(sampleRun);
    store.addRun({ ...sampleRun, id: 'run-2', mode: 'pogo', hitsLanded: 7 });
    const runs = store.listRuns();
    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual(sampleRun);
    expect(runs[1]?.id).toBe('run-2');
    store.clearRuns();
    expect(store.listRuns()).toEqual([]);
  });

  it('stores versioned JSON envelopes and rejects mismatched versions', () => {
    const backend = createMemoryStorage();
    const store = createLocalStore(backend);
    store.saveSettings({ version: 1, reduceShake: true, reduceFlashing: true });

    const [key, raw] = [...backend.dump().entries()][0] ?? [];
    expect(key).toContain('kayla-hk-dojo:');
    expect(raw).toBeDefined();
    const envelope = JSON.parse(raw as string) as { v: number };
    expect(envelope.v).toBe(1);

    // A future/foreign version falls back to defaults instead of crashing.
    backend.setItem(key as string, JSON.stringify({ v: 99, data: { anything: true } }));
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('survives corrupt JSON and a missing backend silently', () => {
    const backend = createMemoryStorage();
    const store = createLocalStore(backend);
    store.saveSettings({ version: 1, reduceShake: false, reduceFlashing: true });
    const key = [...backend.dump().keys()][0] as string;
    backend.setItem(key, '{not json');
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS);

    // Null backend (blocked/absent localStorage): everything no-ops.
    const noopStore = createLocalStore(null);
    expect(() => {
      noopStore.saveSettings(DEFAULT_SETTINGS);
      noopStore.addRun(sampleRun);
      noopStore.clearRuns();
    }).not.toThrow();
    expect(noopStore.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(noopStore.listRuns()).toEqual([]);
  });
});
