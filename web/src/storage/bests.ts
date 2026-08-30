/**
 * Personal bests, derived from the recorded runs — one line per cleared
 * level / enemy / wave on the map's next-stop sign and on the mini-game
 * pages (playtest 2 interview). Display only, pure: the runs are already in
 * localStorage; nothing is stored separately.
 *
 * Backward compatibility with runs recorded before levels, waves and
 * `cleared` existed: a pogo run with no `level` is level 1, and a pogo run
 * with no `cleared` is read as cleared (the old course only recorded runs
 * that reached the goal). A dodge run with no `cleared` is NOT cleared (the
 * old arena ended on the first hit).
 */
import type { EnemyId, PracticeRun } from '@dojo/shared';

/**
 * Did this run reach its goal? The one reading of `cleared` for legacy runs
 * (see above); the store's eviction uses it too, so a best is never evicted.
 */
export function runCleared(r: PracticeRun): boolean {
  return r.cleared ?? r.mode === 'pogo';
}

export interface CourseBest {
  /** Fastest clear, in milliseconds. */
  durationMs: number;
}

export interface StageBest {
  hitsLanded: number;
  durationMs: number;
  /** True when this is a passed stage; false when it's only her longest survival so far. */
  cleared: boolean;
}

/** Fastest cleared run for a Pogo Course level (1–3; 4 is the finale's). */
export function courseBest(runs: readonly PracticeRun[], level: number): CourseBest | null {
  let best: CourseBest | null = null;
  for (const r of runs) {
    if (r.mode !== 'pogo') continue;
    if (r.godMode) continue; // DEV TOOL: a run nothing could end is not a best
    if ((r.level ?? 1) !== level) continue;
    if (!runCleared(r)) continue;
    if (!best || r.durationMs < best.durationMs) best = { durationMs: r.durationMs };
  }
  return best;
}

/**
 * Best among a stage's runs: the best cleared run (most hits, then longest
 * survival), else the longest survival among uncleared runs (then most
 * hits). Observe-mode runs never count.
 */
function stageBest(runs: readonly PracticeRun[]): StageBest | null {
  let best: StageBest | null = null;
  for (const r of runs) {
    if (r.observeMode) continue;
    if (r.godMode) continue; // DEV TOOL: a run nothing could end is not a best
    const candidate: StageBest = {
      hitsLanded: r.hitsLanded,
      durationMs: r.durationMs,
      cleared: runCleared(r),
    };
    if (!best || beats(candidate, best)) best = candidate;
  }
  return best;
}

function beats(a: StageBest, b: StageBest): boolean {
  if (a.cleared !== b.cleared) return a.cleared;
  if (a.cleared) {
    if (a.hitsLanded !== b.hitsLanded) return a.hitsLanded > b.hitsLanded;
    return a.durationMs > b.durationMs;
  }
  if (a.durationMs !== b.durationMs) return a.durationMs > b.durationMs;
  return a.hitsLanded > b.hitsLanded;
}

/**
 * The most hits she has ever landed on the runs `pick` selects, or null if she
 * has never scored on them. The number the arena HUD shows her chasing.
 *
 * Deliberately NOT `arenaBest(...).hitsLanded`, which is a different question
 * with a different answer: `beats()` ranks a cleared run above an uncleared
 * one before it looks at any number, so her best CLEAR might be three hits
 * while her best SCORE is nine. Since playtest 10 made hits a score rather
 * than a gate, the score is the honest thing to put on screen — and reusing
 * the ranking here would have quietly shown her the smaller number.
 *
 * Observe runs land no real hits and god-mode runs are not hers, so both are
 * skipped, the same way every other best in this module skips them.
 */
export function bestHits(
  runs: readonly PracticeRun[],
  pick: (run: PracticeRun) => boolean,
): number | null {
  let best: number | null = null;
  for (const r of runs) {
    if (r.observeMode) continue;
    if (r.godMode) continue; // DEV TOOL: a run nothing could end is not a best
    if (!pick(r)) continue;
    if (best === null || r.hitsLanded > best) best = r.hitsLanded;
  }
  return best;
}

/** Best single-enemy Dodge Arena run against this enemy (finale waves excluded). */
export function arenaBest(runs: readonly PracticeRun[], enemyId: EnemyId): StageBest | null {
  return stageBest(
    runs.filter((r) => r.mode === 'dodge' && r.enemyId === enemyId && r.wave === undefined),
  );
}

/** Best finale run for this wave (1–3). */
export function waveBest(runs: readonly PracticeRun[], wave: number): StageBest | null {
  return stageBest(runs.filter((r) => r.mode === 'dodge' && r.wave === wave));
}

/**
 * Best run against the Two Bills.
 *
 * `stageBest` already means the right thing here without a special case: it
 * prefers a cleared run, and among uncleared ones takes the LONGEST survival
 * — which for a fight scored in seconds is precisely "her best time". Boss
 * runs land no hits, so the hits tie-breaker never fires.
 */
export function bossBest(runs: readonly PracticeRun[]): StageBest | null {
  return stageBest(runs.filter((r) => r.mode === 'dodge' && r.boss === true));
}
