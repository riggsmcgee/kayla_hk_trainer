/**
 * React's view of Kayla's progress, all from localStorage (the source of
 * truth) — nothing here touches the server.
 *
 * Three records feed it: `progress` (what is DONE — see storage/progress.ts),
 * `visited` (chapters she has opened; lights the map), and `runs` (what she
 * played; the bests). The store is read once per change: any hook's
 * refresh() bumps one shared version, and every hook on the page re-reads,
 * so a clear recorded by the canvas updates the strip, the sign and the
 * gate on the same page together.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import type { ChapterId } from '../chapters';
import { FINALE_LEVEL } from '../engine/roster';
import { createLocalStore } from './local';
import { mapProgress, withRunClears, type MapProgress } from './progress';

/** The one store instance every page shares. Plain value, not a hook. */
export const progressStore = createLocalStore();

// --- change notification: a version counter every hook subscribes to ---
let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion(): number {
  return version;
}

/** Tell every hook the store changed. Call after marking anything. */
export function notifyProgressChanged(): void {
  version += 1;
  for (const listener of listeners) listener();
}

/**
 * Chapters she has opened. A mini-game also counts as opened if a run was
 * recorded there before the visited record existed.
 */
function readVisited(runs: readonly PracticeRun[]): Set<ChapterId> {
  const visited = new Set<ChapterId>(progressStore.listVisited() as ChapterId[]);
  for (const run of runs) {
    if (run.mode === 'pogo') visited.add(run.level === FINALE_LEVEL ? 'finale' : 'pogo-course');
    else visited.add(run.wave !== undefined ? 'finale' : 'dodge-arena');
  }
  return visited;
}

interface Snapshot {
  progress: ProgressV1;
  visited: ReadonlySet<ChapterId>;
  runs: PracticeRun[];
}

function readSnapshot(): Snapshot {
  const runs = progressStore.listRuns();
  return {
    progress: withRunClears(progressStore.getProgress(), runs),
    visited: readVisited(runs),
    runs,
  };
}

export interface ProgressView extends Snapshot {
  /** Re-read the store and re-render every hook on the page — call after marking something. */
  refresh(): void;
}

/** Progress, visited and runs; re-read whenever any hook calls refresh(). */
export function useProgress(): ProgressView {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  // The snapshot is a pure function of the store's version.
  const snapshot = useMemo(readSnapshot, [v]);
  const refresh = useCallback(notifyProgressChanged, []);
  return { ...snapshot, refresh };
}

/** mapProgress(progress, visited) from the same data, plus refresh(). */
export function useMapProgress(): MapProgress & { refresh(): void } {
  const { progress, visited, refresh } = useProgress();
  return { ...mapProgress(progress, visited), refresh };
}

