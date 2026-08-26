/**
 * The one "Best:" line under the map's next-stop sign — her furthest
 * personal best for that stop, in as few words as possible (playtest 2
 * interview: one line per cleared level / enemy, display only).
 *
 * A lesson shows the best of the mini-game that proves it, so the sign
 * says the same thing whether the Knight stands on the Crossroads or in
 * the Bounce Bog. Pure: runs in, string (or null) out.
 */
import type { PracticeRun } from '@dojo/shared';
import type { Chapter } from '../chapters';
import { COURSE_LEVEL_COUNT, FINALE_LEVEL, FINALE_WAVE_COUNT, ROSTER } from '../engine/roster';
import { arenaBest, bossBest, courseBest, waveBest, type StageBest } from '../storage/bests';

/** Milliseconds as the in-game clock reads them: m:ss.t. */
export function formatClock(ms: number): string {
  const seconds = ms / 1000;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function hits(best: StageBest): string {
  return `${best.hitsLanded} ${best.hitsLanded === 1 ? 'hit' : 'hits'}`;
}

function courseLine(runs: readonly PracticeRun[]): string | null {
  for (let level = COURSE_LEVEL_COUNT; level >= 1; level--) {
    const best = courseBest(runs, level);
    if (best) return `Best: level ${level} in ${formatClock(best.durationMs)}`;
  }
  return null;
}

function arenaPhrase(name: string, best: StageBest): string {
  return best.hitsLanded > 0
    ? `Best: ${hits(best)} on the ${name}`
    : `Best: ${formatClock(best.durationMs)} against the ${name}`;
}

/**
 * The furthest enemy she has PASSED, and only if she has passed none, the
 * furthest she has faced.
 *
 * The roster runs easiest to hardest, so walking it backwards is the same
 * "how far down the road are you" that `courseLine` does. It used to take
 * the first enemy with any run at all, which is not the same thing:
 * `courseBest` only counts clears, but `arenaBest` also returns her longest
 * survival among failures, so one panicked ten seconds against the warden
 * quietly outranked a passed stage on everything before it. The sign was
 * reporting how far she had WANDERED, not how far she had got.
 */
function arenaLine(runs: readonly PracticeRun[]): string | null {
  let attempted: string | null = null;
  for (let i = ROSTER.length - 1; i >= 0; i--) {
    const enemy = ROSTER[i]!;
    const best = arenaBest(runs, enemy.id);
    if (!best) continue;
    if (best.cleared) return arenaPhrase(enemy.name.toLowerCase(), best);
    attempted ??= arenaPhrase(enemy.name.toLowerCase(), best);
  }
  return attempted;
}

/**
 * The finale in its own order: the Bills, then the waves, then the level.
 *
 * The Bills had no line here at all, so the last and hardest of the twelve
 * scoreable things in the dojo was invisible on the one surface that would
 * have shown it — a run that costs 1:30 of not being touched, reported as
 * whichever wave she happened to clear. The fight is scored in seconds and
 * nothing down there can be hurt, so its line speaks in time, like its HUD.
 */
function finaleLine(runs: readonly PracticeRun[]): string | null {
  const boss = bossBest(runs);
  if (boss) {
    return boss.cleared
      ? `Best: ${formatClock(boss.durationMs)} against the Bills — past 1:30`
      : `Best: ${formatClock(boss.durationMs)} against the Bills`;
  }
  for (let wave = FINALE_WAVE_COUNT; wave >= 1; wave--) {
    const best = waveBest(runs, wave);
    if (!best) continue;
    return best.hitsLanded > 0
      ? `Best: ${hits(best)} in wave ${wave}`
      : `Best: ${formatClock(best.durationMs)} in wave ${wave}`;
  }
  const level = courseBest(runs, FINALE_LEVEL);
  return level ? `Best: level ${FINALE_LEVEL} in ${formatClock(level.durationMs)}` : null;
}

/** Her best for this stop, or null when there is nothing to brag about yet. */
export function bestLine(chapter: Chapter, runs: readonly PracticeRun[]): string | null {
  switch (chapter.id) {
    case 'setup':
      return null;
    case 'pogo':
    case 'pogo-course':
      return courseLine(runs);
    case 'reading-enemies':
    case 'dodge-arena':
      return arenaLine(runs);
    case 'finale':
      return finaleLine(runs);
  }
}
