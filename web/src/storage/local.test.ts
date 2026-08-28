import { describe, expect, it } from 'vitest';
import type { PracticeRun, SettingsV1 } from '@dojo/shared';
import { SETUP_CHECKS } from '../engine/setupChecks';
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
  it('evicts god-mode clears before real runs — a cheat is not a best', () => {
    const store = createLocalStore(createMemoryStorage());
    // Her one honest run, recorded first so eviction would reach it first.
    store.addRun({
      ...sampleRun,
      id: 'real-clear',
      mode: 'pogo',
      level: 1,
      cleared: true,
      durationMs: 14_300,
    });
    // Six hundred cheated clears. A clear is normally protected from
    // eviction, so without the god-mode exception these would be the six
    // hundred runs the store kept, and her real one the one it dropped.
    for (let i = 0; i < 600; i++) {
      store.addRun({
        ...sampleRun,
        id: `god-${i}`,
        mode: 'pogo',
        level: 1,
        cleared: true,
        godMode: true,
        durationMs: 1_000,
      });
    }

    const runs = store.listRuns();
    expect(runs.length).toBe(500);
    expect(runs[0]!.id).toBe('real-clear');
    expect(courseBest(runs, 1)).toEqual({ durationMs: 14_300 });
  });

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

  it('remembers god mode, and reads an older blob as off', () => {
    const store = createLocalStore(createMemoryStorage());
    // Off unless it was deliberately switched on: a cheat must never be the
    // state she arrives in.
    expect(store.getSettings().godMode).toBe(false);

    store.saveSettings({ ...store.getSettings(), godMode: true });
    expect(store.getSettings().godMode).toBe(true);

    // A settings blob written before god mode existed has no such key. It is
    // optional precisely so this needs no migration - absent reads as off.
    const older = createLocalStore(createMemoryStorage());
    older.saveSettings({ version: 1, reduceShake: true, reduceFlashing: false });
    expect(older.getSettings().godMode).toBeUndefined();
    expect(older.getSettings().godMode === true).toBe(false);
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
      finaleBossCleared: false,
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
    store.markFinaleBossCleared();
    store.markFinaleBossCleared();
    store.setController('joycon');
    store.setController('leverless');
    expect(store.getProgress()).toEqual({
      version: 1,
      controller: 'leverless',
      courseLevelsCleared: [1, 2],
      arenaEnemiesCleared: ['walker'],
      finaleLevelCleared: true,
      finaleWavesCleared: [1],
      finaleBossCleared: true,
      skipped: ['pogo-course:level:3'],
      // Answering seeds an EMPTY sheet, which is what makes a new save gated:
      // an absent sheet means grandfathered, and the two must not be confused.
      setupChecks: [],
    });
  });

  /**
   * Playtest 9's gate rests on one distinction the store has to keep straight:
   * an ABSENT sheet means "answered the controller before the floor existed,
   * credit her with it", and an EMPTY sheet means "gated, nothing proved yet".
   *
   * These are the tests that stop the two collapsing into each other — which is
   * the failure that would either un-complete chapter 1 under Kayla or hand
   * every new save a free pass.
   */
  describe('the practice floor grandfather', () => {
    it('credits a save that answered the controller before the sheet existed', () => {
      const backend = createMemoryStorage();
      backend.setItem(
        'kayla-hk-dojo:progress',
        JSON.stringify({ v: 1, data: { version: 1, controller: 'leverless', skipped: [] } }),
      );
      const store = createLocalStore(backend);
      expect(store.getProgress().setupChecks).toEqual([...SETUP_CHECKS]);
    });

    it('keeps crediting her after she walks left on the floor out of curiosity', () => {
      // The hole that sinks an inference-based migration: markSetupChecks turns
      // an absent sheet into ['left'], and chapter 1 would un-complete on the
      // first frame she moved. Materialising the seven makes the write a no-op.
      const backend = createMemoryStorage();
      backend.setItem(
        'kayla-hk-dojo:progress',
        JSON.stringify({ v: 1, data: { version: 1, controller: 'leverless', skipped: [] } }),
      );
      const store = createLocalStore(backend);
      store.markSetupChecks(['left']);
      expect(store.getProgress().setupChecks).toEqual([...SETUP_CHECKS]);
    });

    it('keeps crediting her when she re-picks the same board', () => {
      // "change" then the same controller calls setController unconditionally.
      const backend = createMemoryStorage();
      backend.setItem(
        'kayla-hk-dojo:progress',
        JSON.stringify({ v: 1, data: { version: 1, controller: 'leverless', skipped: [] } }),
      );
      const store = createLocalStore(backend);
      store.setController('leverless');
      expect(store.getProgress().setupChecks).toEqual([...SETUP_CHECKS]);
    });

    it('does not credit a save that has an empty sheet', () => {
      // The one a future "drop empty arrays to keep the blob small" tidy-up
      // would break, silently, for every gated player.
      const backend = createMemoryStorage();
      backend.setItem(
        'kayla-hk-dojo:progress',
        JSON.stringify({
          v: 1,
          data: { version: 1, controller: 'leverless', setupChecks: [], skipped: [] },
        }),
      );
      const store = createLocalStore(backend);
      expect(store.getProgress().setupChecks).toEqual([]);
    });

    it('does not credit a save that never answered the controller', () => {
      const store = createLocalStore(createMemoryStorage());
      expect(store.getProgress().setupChecks).toBeUndefined();
    });

    it('gates a brand-new player from the moment she answers', () => {
      const store = createLocalStore(createMemoryStorage());
      store.setController('joycon');
      expect(store.getProgress().setupChecks).toEqual([]);
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

describe('the sandbox checklist survives being put down', () => {
  it('is still there after a reload, which is the only reason to store it', () => {
    // THE BUG THIS EXISTS FOR, caught by reloading a browser and not by any
    // test: `readProgress` rebuilds progress field by field rather than
    // spreading the stored blob — which is what keeps a hand-edited save from
    // injecting junk — so a new field that nobody adds to the READER is
    // written on every change and dropped on every read. The sheet filled up
    // on screen and was back at zero the moment she came back.
    // One backend, two stores: that is what a reload actually is.
    const backend = createMemoryStorage();
    const written = createLocalStore(backend);
    written.markSetupChecks(['left', 'right']);
    written.markSetupChecks(['right', 'jump']);

    // A second store over the same backend is what a reload actually is.
    const reloaded = createLocalStore(backend);
    expect(reloaded.getProgress().setupChecks).toEqual(['left', 'right', 'jump']);
  });

  it('reads a save written before the sandbox existed as none ticked', () => {
    // Every save Kayla already has is one of these. An absent list must not
    // read as a broken blob, or her whole progress falls back to default.
    const backend = createMemoryStorage();
    const store = createLocalStore(backend);
    store.markLevelCleared(1);
    const reloaded = createLocalStore(backend);
    expect(reloaded.getProgress().setupChecks).toBeUndefined();
    expect(reloaded.getProgress().courseLevelsCleared).toEqual([1]);
  });
});
