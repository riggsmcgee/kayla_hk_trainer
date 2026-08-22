/**
 * Versioned-JSON localStorage module — the ONLY source of truth for user data.
 *
 * The server (when it exists at all) is an optional mirror; nothing here may
 * ever depend on it. The backend is injectable so tests run in plain node
 * with an in-memory stub, and every browser-storage touch is guarded: a
 * missing/blocked localStorage (private mode, SSR, storage quota) silently
 * degrades to an in-memory-less no-op rather than throwing.
 */

import type { PracticeRun, SettingsV1 } from '@dojo/shared';

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
} as const;

const SETTINGS_VERSION = 1;
const RUNS_VERSION = 1;
const VISITED_VERSION = 1;

/**
 * Practice runs are append-only, so cap the history to keep localStorage
 * bounded (and each save cheap) over years of use. 500 runs ≈ tens of KB.
 */
const MAX_STORED_RUNS = 500;

export const DEFAULT_SETTINGS: SettingsV1 = {
  version: 1,
  reduceShake: false,
  reduceFlashing: false,
};

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

  return {
    getSettings: () => read<SettingsV1>(KEYS.settings, SETTINGS_VERSION, DEFAULT_SETTINGS),
    saveSettings: (settings) => write(KEYS.settings, SETTINGS_VERSION, settings),
    listRuns: () => read<PracticeRun[]>(KEYS.runs, RUNS_VERSION, []),
    addRun: (run) => {
      const runs = read<PracticeRun[]>(KEYS.runs, RUNS_VERSION, []);
      runs.push(run);
      write(KEYS.runs, RUNS_VERSION, runs.slice(-MAX_STORED_RUNS));
    },
    listVisited: () => read<string[]>(KEYS.visited, VISITED_VERSION, []),
    markVisited: (chapterId) => {
      const visited = read<string[]>(KEYS.visited, VISITED_VERSION, []);
      if (visited.includes(chapterId)) return;
      write(KEYS.visited, VISITED_VERSION, [...visited, chapterId]);
    },
    clearRuns: () => {
      if (!backend) return;
      try {
        backend.removeItem(KEYS.runs);
      } catch {
        // Same best-effort stance as write().
      }
    },
  };
}
