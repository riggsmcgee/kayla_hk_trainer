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
  /** The run was played with assist mode on. */
  assisted: boolean;
}

export interface StageBest {
  hitsLanded: number;
  durationMs: number;
  /** True when this is a passed stage; false when it's only her longest survival so far. */
  cleared: boolean;
  /** The run was played with assist mode on, and the line says so. */
  assisted: boolean;
}

/** Fastest cleared run for a Pogo Course level (1–3; 4 is the finale's). */
export function courseBest(runs: readonly PracticeRun[], level: number): CourseBest | null {
  let best: CourseBest | null = null;
  for (const r of runs) {
    if (r.mode !== 'pogo') continue;
    if (r.godMode) continue; // DEV TOOL: a run nothing could end is not a best
    if ((r.level ?? 1) !== level) continue;
    if (!runCleared(r)) continue;
    const candidate: CourseBest = { durationMs: r.durationMs, assisted: r.assisted === true };
    if (!best || beatsCourse(candidate, best)) best = candidate;
  }
  return best;
}

/**
 * A clean clear outranks an assisted one however slow it was; among equals,
 * fastest wins. Note the polarity is the opposite of `beats` below — a course
 * is scored in seconds saved, a stage in seconds survived.
 */
function beatsCourse(a: CourseBest, b: CourseBest): boolean {
  if (a.assisted !== b.assisted) return !a.assisted;
  return a.durationMs < b.durationMs;
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
    // NOTE: assist runs are deliberately NOT skipped here. God mode is a
    // cheat that makes a run meaningless; assist is a choice she is allowed to
    // make, so its runs count — they just rank below clean ones and carry the
    // tag that says so (playtest 10).
    if (r.godMode) continue; // DEV TOOL: a run nothing could end is not a best
    const candidate: StageBest = {
      hitsLanded: r.hitsLanded,
      durationMs: r.durationMs,
      cleared: runCleared(r),
      assisted: r.assisted === true,
    };
    if (!best || beats(candidate, best)) best = candidate;
  }
  return best;
}

function beats(a: StageBest, b: StageBest): boolean {
  if (a.cleared !== b.cleared) return a.cleared;
  // Below `cleared` and above every number: a clean run outranks an assisted
  // one at any hit count and any survival time, so the asterisk clears itself
  // the moment she does it without the net.
  if (a.assisted !== b.assisted) return !a.assisted;
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
 * Has she ever survived the Bills with nothing helping her?
 *
 * The ending letter asks this at RENDER time rather than storing an answer,
 * which is what lets a clean run later restore the full letter she was once
 * shown a trimmed version of — the two lines about never being touched become
 * true retroactively, so the letter should say them.
 *
 * `!godMode` is load-bearing rather than belt-and-braces: `cleared` on a boss
 * run is `boss.passed`, and that is set at 1:30 whether or not anything could
 * have stopped her.
 */
export function clearedBillsClean(runs: readonly PracticeRun[]): boolean {
  return runs.some(
    (r) => r.mode === 'dodge' && r.boss === true && r.cleared === true && !r.godMode && !r.assisted,
  );
}

/**
 * Should the ending letter drop the two lines that say she was never touched?
 *
 * Only on EVIDENCE, and the asymmetry is deliberate. The trim exists to stop
 * the letter telling her something untrue; where there is no assisted win on
 * record there is nothing untrue to avoid, so his words stand as written. That
 * also keeps the full letter for the cases where the runs are simply missing —
 * an old save, an evicted history, a developer arriving at the page directly —
 * rather than quietly handing her a trimmed letter she never earned the trim
 * for.
 *
 * A clean win always wins: do it once without the net and the full letter is
 * yours for good, however many assisted clears sit beside it.
 */
export function billsWinWasAssisted(runs: readonly PracticeRun[]): boolean {
  if (clearedBillsClean(runs)) return false;
  return runs.some(
    (r) => r.mode === 'dodge' && r.boss === true && r.cleared === true && r.assisted === true,
  );
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
