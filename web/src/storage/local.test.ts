import { describe, expect, it } from 'vitest';
import type { PracticeRun, SettingsV1 } from '@dojo/shared';
import { arenaBest, courseBest } from './bests';
import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, createLocalStore, type StorageLike } from './local';

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

  it('evicts uncleared runs first, so a grind of checkpoint deaths never erases a best', () => {
    const store = createLocalStore(createMemoryStorage());
    const death = { ...sampleRun, observeMode: undefined, cleared: false, durationMs: 3_000 };
    store.addRun({
      ...sampleRun,
      id: 'pogo-1',
      mode: 'pogo',
      level: 1,
      cleared: true,
      durationMs: 14_300,
    });
    store.addRun({ ...sampleRun, id: 'legacy-pogo', mode: 'pogo', durationMs: 20_000 }); // before `cleared` existed
    store.addRun({
      ...sampleRun,
      id: 'walker-1',
      enemyId: 'walker',
      observeMode: undefined,
      cleared: true,
      hitsLanded: 7,
    });
    for (let i = 0; i < 600; i++) store.addRun({ ...death, id: `death-${i}` });
    const runs = store.listRuns();
    expect(runs.length).toBe(500);
    expect(runs.slice(0, 3).map((r) => r.id)).toEqual(['pogo-1', 'legacy-pogo', 'walker-1']);
    expect(runs[499]!.id).toBe('death-599');
    expect(courseBest(runs, 1)).toEqual({ durationMs: 14_300 });
    expect(arenaBest(runs, 'walker')).toMatchObject({ cleared: true, hitsLanded: 7 });
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

describe('visited chapters', () => {
  it('records which chapters Kayla has opened, once each, in a versioned envelope', () => {
    const backend = createMemoryStorage();
    const store = createLocalStore(backend);
    expect(store.listVisited()).toEqual([]);
    store.markVisited('setup');
    store.markVisited('pogo');
    store.markVisited('setup'); // idempotent
    expect(store.listVisited()).toEqual(['setup', 'pogo']);
    const raw = backend.dump().get('kayla-hk-dojo:visited');
    expect(raw).toBeDefined();
    expect((JSON.parse(raw as string) as { v: number }).v).toBe(1);
    // A null backend no-ops like everything else.
    const noop = createLocalStore(null);
    expect(() => noop.markVisited('setup')).not.toThrow();
    expect(noop.listVisited()).toEqual([]);
  });
});

describe('progress', () => {
  it('starts empty: nothing cleared, nothing skipped, no controller', () => {
    const store = createLocalStore(createMemoryStorage());
    expect(store.getProgress()).toEqual({
      version: 1,
      courseLevelsCleared: [],
      arenaEnemiesCleared: [],
      finaleLevelCleared: false,
      finaleWavesCleared: [],
      skipped: [],
    });
    expect(store.getProgress()).toEqual(DEFAULT_PROGRESS);
    // The default is handed out fresh each time — a caller mutating it can't poison the store.
    expect(store.getProgress()).not.toBe(DEFAULT_PROGRESS);
  });

  it('marks are idempotent and keep what was already there', () => {
    const store = createLocalStore(createMemoryStorage());
    store.markLevelCleared(1);
    store.markLevelCleared(2);
    store.markLevelCleared(1);
    store.markEnemyCleared('walker');
    store.markEnemyCleared('walker');
    store.markWaveCleared(1);
    store.markWaveCleared(1);
    store.markSkipped('pogo-course:level:3');
    store.markSkipped('pogo-course:level:3');
    store.markFinaleLevelCleared();
    store.markFinaleLevelCleared();
    store.setController('joycon');
    store.setController('leverless');
    expect(store.getProgress()).toEqual({
      version: 1,
      controller: 'leverless',
      courseLevelsCleared: [1, 2],
      arenaEnemiesCleared: ['walker'],
      finaleLevelCleared: true,
      finaleWavesCleared: [1],
      skipped: ['pogo-course:level:3'],
    });
  });

  it('lives in its own versioned envelope and round-trips through saveProgress', () => {
    const backend = createMemoryStorage();
    const store = createLocalStore(backend);
    store.markEnemyCleared('flier');
    const raw = backend.dump().get('kayla-hk-dojo:progress');
    expect(raw).toBeDefined();
    expect((JSON.parse(raw as string) as { v: number }).v).toBe(1);

    store.saveProgress({ ...DEFAULT_PROGRESS, courseLevelsCleared: [1, 2, 3] });
    expect(store.getProgress().courseLevelsCleared).toEqual([1, 2, 3]);
    expect(store.getProgress().arenaEnemiesCleared).toEqual([]);

    // A foreign version falls back to the empty default rather than crashing.
    backend.setItem('kayla-hk-dojo:progress', JSON.stringify({ v: 99, data: {} }));
    expect(store.getProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it('clearAllProgress wipes runs, visited and progress but keeps settings', () => {
    const backend = createMemoryStorage();
    const store = createLocalStore(backend);
    store.saveSettings({ version: 1, reduceShake: true, reduceFlashing: false });
    store.addRun(sampleRun);
    store.markVisited('setup');
    store.markLevelCleared(1);
    store.setController('joycon');

    store.clearAllProgress();

    expect(store.listRuns()).toEqual([]);
    expect(store.listVisited()).toEqual([]);
    expect(store.getProgress()).toEqual(DEFAULT_PROGRESS);
    expect(store.getSettings()).toEqual({ version: 1, reduceShake: true, reduceFlashing: false });
    expect(backend.dump().has('kayla-hk-dojo:progress')).toBe(false);
  });

  it('no-ops on a null backend', () => {
    const noop = createLocalStore(null);
    expect(() => {
      noop.markLevelCleared(1);
      noop.markEnemyCleared('warden');
      noop.markWaveCleared(2);
      noop.markFinaleLevelCleared();
      noop.setController('joycon');
      noop.markSkipped('finale');
      noop.clearAllProgress();
    }).not.toThrow();
    expect(noop.getProgress()).toEqual(DEFAULT_PROGRESS);
  });
});
