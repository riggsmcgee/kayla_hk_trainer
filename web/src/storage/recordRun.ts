/**
 * One call to persist a finished practice run: localStorage first (the
 * source of truth), then a fire-and-forget mirror to the practice server
 * via the sync adapter. The adapter is chosen once, lazily, on first use;
 * a missing server stays completely silent (see sync/adapter.ts).
 */

import type { PracticeRun } from '@dojo/shared';
import { chooseSyncAdapter, createNoopSyncAdapter, type SyncAdapter } from '../sync/adapter';
import { createLocalStore } from './local';

const store = createLocalStore();
let adapterPromise: Promise<SyncAdapter> | null = null;

/**
 * crypto.randomUUID only exists in secure contexts (https/localhost); a
 * throw here would kill the game loop mid-step, so fall back to a
 * timestamp+random id. Uniqueness, not cryptography, is all an id needs.
 */
function makeRunId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function recordRun(runData: Omit<PracticeRun, 'id'>): void {
  const run: PracticeRun = { ...runData, id: makeRunId() };
  store.addRun(run);
  // The practice server only ever exists on the developer's machine, so the
  // health probe is dev-only: the deployed site must never fetch localhost
  // (the browser logs network noise for any failed fetch, and the plan's
  // hard rule is that the server's absence stays completely silent).
  adapterPromise ??= import.meta.env.DEV
    ? chooseSyncAdapter()
    : Promise.resolve(createNoopSyncAdapter());
  void adapterPromise.then((a) => a.pushRun(run));
}
