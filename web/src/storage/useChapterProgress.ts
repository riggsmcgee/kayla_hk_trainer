/**
 * Which stops on the map are lit. Every chapter lights up the first time its
 * page is opened; a mini-game also lights up if a run was recorded there
 * before the visited record existed. All of it comes from localStorage (the
 * source of truth) — nothing here touches the server.
 */
import { useEffect, useState } from 'react';
import type { ChapterId } from '../chapters';
import { createLocalStore } from './local';

const store = createLocalStore();

function readLit(): Set<ChapterId> {
  const lit = new Set<ChapterId>(store.listVisited() as ChapterId[]);
  for (const run of store.listRuns()) {
    lit.add(run.mode === 'pogo' ? 'pogo-course' : 'dodge-arena');
  }
  return lit;
}

/** The set of lit chapter ids, read once on mount. */
export function useLitChapters(): ReadonlySet<ChapterId> {
  const [lit] = useState(readLit);
  return lit;
}

/** Mark a chapter visited the moment its page mounts. */
export function useMarkVisited(id: ChapterId): void {
  useEffect(() => {
    store.markVisited(id);
  }, [id]);
}
