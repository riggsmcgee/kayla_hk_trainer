/**
 * Versioned-JSON localStorage module — the ONLY source of truth for user data.
 *
 * The server (when it exists at all) is an optional mirror; nothing here may
 * ever depend on it. The backend is injectable so tests run in plain node
 * with an in-memory stub, and every browser-storage touch is guarded: a
 * missing/blocked localStorage (private mode, SSR, storage quota) silently
 * degrades to an in-memory-less no-op rather than throwing.
 */

import type { ControllerChoice, EnemyId, PracticeRun, ProgressV1, SettingsV1 } from '@dojo/shared';
import { runCleared } from './bests';

/** The subset of the DOM Storage interface this module needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Envelope every stored value is wrapped in. */
interface VersionedEnvelope<T> {
  v: number;
  data: T;
}

const KEY_PREFIX = 'kayla-hk-dojo:';

const KEYS = {
  settings: `${KEY_PREFIX}settings`,
  runs: `${KEY_PREFIX}runs`,
  visited: `${KEY_PREFIX}visited`,
  progress: `${KEY_PREFIX}progress`,
} as const;

const SETTINGS_VERSION = 1;
const RUNS_VERSION = 1;
const VISITED_VERSION = 1;
const PROGRESS_VERSION = 1;

/**
 * Practice runs are append-only, so cap the history to keep localStorage
 * bounded (and each save cheap) over years of use. 500 runs ≈ tens of KB.
 * Uncleared runs go first (oldest first): the bests are read from the
 * cleared ones (bests.ts), and a grind of three-second checkpoint deaths
 * must never push a best out. Cleared runs cost real minutes each, so they
 * cannot blow the cap the way deaths can; the hard ceiling is a safety net.
 */
const MAX_STORED_RUNS = 500;
const HARD_CEILING = MAX_STORED_RUNS * 4;

/** Trim to the cap, dropping the oldest UNCLEARED runs before any cleared one. */
function trimRuns(runs: readonly PracticeRun[]): PracticeRun[] {
  let excess = runs.length - MAX_STORED_RUNS;
  if (excess <= 0) return [...runs];
  const kept = runs.filter((r) => runCleared(r) || excess-- <= 0);
  return kept.slice(-HARD_CEILING);
}

export const DEFAULT_SETTINGS: SettingsV1 = {
  version: 1,
  reduceShake: false,
  reduceFlashing: false,
};

/**
 * Nothing done yet. Frozen so nobody mutates the shared default by accident;
 * getProgress() hands out a fresh copy.
 */
export const DEFAULT_PROGRESS: Readonly<ProgressV1> = Object.freeze({
  version: 1,
  courseLevelsCleared: [],
  arenaEnemiesCleared: [],
  finaleLevelCleared: false,
  finaleWavesCleared: [],
  skipped: [],
});

function freshProgress(): ProgressV1 {
  return {
    version: 1,
    courseLevelsCleared: [],
    arenaEnemiesCleared: [],
    finaleLevelCleared: false,
    finaleWavesCleared: [],
    skipped: [],
  };
}

/** Append once, keeping order — marks are idempotent. */
function addUnique<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? [...list] : [...list, item];
}

/**
 * Resolve window.localStorage, guarded — accessing it can itself throw
 * (privacy modes), and it doesn't exist in plain node.
 */
function detectBrowserStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Blocked storage — fall through to null; the store becomes a no-op.
  }
  return null;
}

export interface LocalStore {
  getSettings(): SettingsV1;
  saveSettings(settings: SettingsV1): void;
  listRuns(): PracticeRun[];
  addRun(run: PracticeRun): void;
  clearRuns(): void;
  /** Chapter ids Kayla has opened, in first-visit order (lights the map). */
  listVisited(): string[];
  markVisited(chapterId: string): void;

  /** What is DONE (cleared / answered / skipped). Always a fresh, complete object. */
  getProgress(): ProgressV1;
  saveProgress(progress: ProgressV1): void;
  /** Pogo course level reached-the-goal (1–3; idempotent). */
  markLevelCleared(level: number): void;
  /** Dodge Arena stage passed for this enemy (idempotent). */
  markEnemyCleared(enemyId: EnemyId): void;
  /** Finale wave passed (1–3; idempotent). */
  markWaveCleared(wave: number): void;
  /** The finale's pogo level (level 4) reached-the-goal. */
  markFinaleLevelCleared(): void;
  /** Her answer to chapter 1's question; answering again overwrites. */
  setController(controller: ControllerChoice): void;
  /** Skip a chapter ('pogo-course') or a sub-step ('pogo-course:level:2', 'finale:wave:2'). */
  markSkipped(key: string): void;
  /** "Reset my progress": removes runs, visited and progress. Settings stay. */
  clearAllProgress(): void;
}

/**
 * Create the store. Pass a StorageLike for tests; omit it in the app to use
 * window.localStorage. A null backend yields a store whose writes no-op and
 * whose reads return defaults — the app keeps working either way.
 */
export function createLocalStore(backend: StorageLike | null = detectBrowserStorage()): LocalStore {
  function read<T>(key: string, expectedVersion: number, fallback: T): T {
    if (!backend) return fallback;
    try {
      const raw = backend.getItem(key);
      if (raw === null) return fallback;
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed === null ||
        typeof parsed !== 'object' ||
        (parsed as VersionedEnvelope<T>).v !== expectedVersion
      ) {
        // TODO: when version 2 of any schema exists, migrate here instead
        // of discarding. For v1 there is nothing older to migrate.
        return fallback;
      }
      return (parsed as VersionedEnvelope<T>).data;
    } catch {
      return fallback; // Corrupt JSON or a throwing backend — never crash the app.
    }
  }

  function write<T>(key: string, version: number, data: T): void {
    if (!backend) return;
    try {
      const envelope: VersionedEnvelope<T> = { v: version, data };
      backend.setItem(key, JSON.stringify(envelope));
    } catch {
      // Quota exceeded or blocked storage — silently drop; localStorage is
      // best-effort persistence, the session keeps running in memory.
    }
  }

  function remove(key: string): void {
    if (!backend) return;
    try {
      backend.removeItem(key);
    } catch {
      // Same best-effort stance as write().
    }
  }

  /**
   * Read progress, filling any field a partial/older v1 blob lacks, so
   * callers always get the complete shape (and never the shared default).
   */
  function readProgress(): ProgressV1 {
    const stored = read<Partial<ProgressV1> | null>(KEYS.progress, PROGRESS_VERSION, null);
    const fresh = freshProgress();
    if (!stored || typeof stored !== 'object') return fresh;
    return {
      version: 1,
      ...(stored.controller ? { controller: stored.controller } : {}),
      courseLevelsCleared: Array.isArray(stored.courseLevelsCleared)
        ? [...stored.courseLevelsCleared]
        : fresh.courseLevelsCleared,
      arenaEnemiesCleared: Array.isArray(stored.arenaEnemiesCleared)
        ? [...stored.arenaEnemiesCleared]
        : fresh.arenaEnemiesCleared,
      finaleLevelCleared: stored.finaleLevelCleared === true,
      finaleWavesCleared: Array.isArray(stored.finaleWavesCleared)
        ? [...stored.finaleWavesCleared]
        : fresh.finaleWavesCleared,
      skipped: Array.isArray(stored.skipped) ? [...stored.skipped] : fresh.skipped,
    };
  }

  function updateProgress(change: (p: ProgressV1) => ProgressV1): void {
    write(KEYS.progress, PROGRESS_VERSION, change(readProgress()));
  }

  return {
    getSettings: () => read<SettingsV1>(KEYS.settings, SETTINGS_VERSION, DEFAULT_SETTINGS),
    saveSettings: (settings) => write(KEYS.settings, SETTINGS_VERSION, settings),
    listRuns: () => read<PracticeRun[]>(KEYS.runs, RUNS_VERSION, []),
    addRun: (run) => {
      const runs = read<PracticeRun[]>(KEYS.runs, RUNS_VERSION, []);
      runs.push(run);
      write(KEYS.runs, RUNS_VERSION, trimRuns(runs));
    },
    listVisited: () => read<string[]>(KEYS.visited, VISITED_VERSION, []),
    markVisited: (chapterId) => {
      const visited = read<string[]>(KEYS.visited, VISITED_VERSION, []);
      if (visited.includes(chapterId)) return;
      write(KEYS.visited, VISITED_VERSION, [...visited, chapterId]);
    },
    clearRuns: () => remove(KEYS.runs),

    getProgress: readProgress,
    saveProgress: (progress) => write(KEYS.progress, PROGRESS_VERSION, progress),
    markLevelCleared: (level) =>
      updateProgress((p) => ({
        ...p,
        courseLevelsCleared: addUnique(p.courseLevelsCleared, level),
      })),
    markEnemyCleared: (enemyId) =>
      updateProgress((p) => ({
        ...p,
        arenaEnemiesCleared: addUnique(p.arenaEnemiesCleared, enemyId),
      })),
    markWaveCleared: (wave) =>
      updateProgress((p) => ({ ...p, finaleWavesCleared: addUnique(p.finaleWavesCleared, wave) })),
    markFinaleLevelCleared: () => updateProgress((p) => ({ ...p, finaleLevelCleared: true })),
    setController: (controller) => updateProgress((p) => ({ ...p, controller })),
    markSkipped: (key) => updateProgress((p) => ({ ...p, skipped: addUnique(p.skipped, key) })),
    clearAllProgress: () => {
      remove(KEYS.runs);
      remove(KEYS.visited);
      remove(KEYS.progress);
    },
  };
}
