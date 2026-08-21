/**
 * Optional sync mirror. localStorage is the only source of truth; this layer
 * mirrors practice runs to the disposable practice server WHEN it happens to
 * be running, and silently does nothing when it isn't. The server being
 * absent, slow, or deleted forever must never surface to the UI — no errors,
 * no spinners, no console noise.
 */

import type { PracticeRun } from '@dojo/shared';

export interface SyncAdapter {
  /** Mirror one finished run. Resolves either way; never rejects. */
  pushRun(run: PracticeRun): Promise<void>;
  /** Fetch mirrored runs (debug/curiosity only). Empty array on any failure. */
  fetchRuns(): Promise<PracticeRun[]>;
  /** True when this adapter actually talks to a server. */
  readonly isLive: boolean;
}

/** Where the practice server lives during local dev. */
export const DEFAULT_SYNC_BASE_URL = 'http://localhost:4000';

/** How long the /health ping gets before we conclude "no server". */
const HEALTH_TIMEOUT_MS = 750;

/** The do-nothing adapter: the permanent state once the server is retired. */
export function createNoopSyncAdapter(): SyncAdapter {
  return {
    isLive: false,
    pushRun: () => Promise.resolve(),
    fetchRuns: () => Promise.resolve([]),
  };
}

/** HTTP adapter. Every failure is swallowed — the server may die mid-session. */
export function createHttpSyncAdapter(baseUrl: string): SyncAdapter {
  return {
    isLive: true,
    pushRun: async (run) => {
      try {
        await fetch(`${baseUrl}/api/runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(run),
        });
      } catch {
        // Server gone — that's fine, localStorage already has the run.
      }
    },
    fetchRuns: async () => {
      try {
        const res = await fetch(`${baseUrl}/api/runs`);
        if (!res.ok) return [];
        return (await res.json()) as PracticeRun[];
      } catch {
        return [];
      }
    },
  };
}

/**
 * Pick an adapter by pinging GET /health with a short timeout. Any outcome
 * other than a fast 2xx — timeout, network error, non-OK status — quietly
 * selects the no-op adapter.
 */
export async function chooseSyncAdapter(
  baseUrl: string = DEFAULT_SYNC_BASE_URL,
): Promise<SyncAdapter> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return createHttpSyncAdapter(baseUrl);
  } catch {
    // No server. Expected and silent.
  }
  return createNoopSyncAdapter();
}
