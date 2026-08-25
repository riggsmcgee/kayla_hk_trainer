/**
 * What is done, what is skipped, what is locked, and where the Knight stands
 * — pure functions over ProgressV1 (the store's record of what she has
 * cleared) and the set of chapters she has opened. No React, no storage:
 * the hooks in useChapterProgress.ts feed these, and pages/map/gates call
 * them.
 *
 * The road is learn → prove → practice → next (playtest 2, note 5):
 *
 * - A lesson with `provesAt` is done exactly when its mini-game is done, and
 *   counts as skipped when its mini-game is skipped. They are one unit.
 * - A stop is locked until the stop before it is PASSED (done or skipped).
 *   A mini-game that proves a lesson is gated on the stop BEFORE the lesson
 *   (otherwise "Prove it →" would be locked behind itself).
 * - Everything is skippable. A skip counts for unlocking, never for "done".
 *
 * Imports chapters.ts; chapters.ts must never import this file.
 */
import type { PracticeRun, ProgressV1 } from '@dojo/shared';
import { CHAPTERS, chapterById, prevChapter, type Chapter, type ChapterId } from '../chapters';
import { COURSE_LEVEL_COUNT, FINALE_LEVEL, FINALE_WAVE_COUNT, ROSTER } from '../engine/roster';
import { runCleared } from './bests';

/** How a stop is drawn on the map and in the chapter strip. */
export type ChapterState = 'done' | 'skipped' | 'visited' | 'locked' | 'open';

export interface MapProgress {
  /** Where the Knight stands — the stop to play next. Null when the road is walked. */
  next: Chapter | null;
  /** Count of contiguous PASSED stops from the start — the legs already walked. */
  reached: number;
  states: Record<ChapterId, ChapterState>;
}

/** The `skipped` key for a Pogo Course level. */
export function levelSkipKey(level: number): string {
  return `pogo-course:level:${level}`;
}

/** The `skipped` key for a finale wave. */
export function waveSkipKey(wave: number): string {
  return `finale:wave:${wave}`;
}

/**
 * The `skipped` key for walking past the finale's pogo level into the waves.
 * Only the finale page's beat strip reads it; it never affects chapter state.
 */
export function finaleLevelSkipKey(): string {
  return 'finale:level';
}

/** The `skipped` key for walking past the Two Bills. */
export function bossSkipKey(): string {
  return 'finale:boss';
}

/**
 * Progress plus what the runs prove: a cleared Pogo Course run means its
 * level is cleared, even when the progress record never saw it — runs from
 * before the record existed only ever reached the goal (bests.ts reads them
 * the same way), so the picker, the gates and the sign agree with the
 * "Best:" line. Pure; the store is not written.
 */
export function withRunClears(progress: ProgressV1, runs: readonly PracticeRun[]): ProgressV1 {
  const levels = [...progress.courseLevelsCleared];
  for (const r of runs) {
    if (r.mode !== 'pogo' || !runCleared(r)) continue;
    const level = r.level ?? 1;
    if (level !== FINALE_LEVEL && !levels.includes(level)) levels.push(level);
  }
  return levels.length === progress.courseLevelsCleared.length
    ? progress
    : { ...progress, courseLevelsCleared: levels };
}

function allCleared(cleared: readonly number[], count: number): boolean {
  for (let n = 1; n <= count; n++) if (!cleared.includes(n)) return false;
  return true;
}

/** Every Bounce Bog level (1..COURSE_LEVEL_COUNT) reached-the-goal. */
export function courseCleared(progress: ProgressV1): boolean {
  return allCleared(progress.courseLevelsCleared, COURSE_LEVEL_COUNT);
}

/** Every enemy on the roster passed. */
export function arenaCleared(progress: ProgressV1): boolean {
  return ROSTER.every((e) => progress.arenaEnemiesCleared.includes(e.id));
}

/**
 * The finale's level, every wave, and the Two Bills.
 *
 * The boss counts: the ratified road is "level 4 → the waves → the Bills",
 * and beat 3 is done at 1:30. So the well is not finished until she has met
 * them — which is what moves the Knight to the end of the road.
 */
export function finaleCleared(progress: ProgressV1): boolean {
  return (
    progress.finaleLevelCleared &&
    allCleared(progress.finaleWavesCleared, FINALE_WAVE_COUNT) &&
    progress.finaleBossCleared
  );
}

/** Is this stop finished, by its own rule (see Chapter.done)? */
export function chapterDone(id: ChapterId, progress: ProgressV1): boolean {
  switch (id) {
    case 'setup':
      return progress.controller !== undefined;
    case 'pogo':
    case 'pogo-course':
      return courseCleared(progress);
    case 'reading-enemies':
    case 'dodge-arena':
      return arenaCleared(progress);
    case 'finale':
      return finaleCleared(progress);
  }
}

/** Did she skip this stop — or, for a lesson, the mini-game that proves it? */
export function chapterSkipped(id: ChapterId, progress: ProgressV1): boolean {
  if (progress.skipped.includes(id)) return true;
  const provesAt = chapterById(id).provesAt;
  return provesAt !== undefined && progress.skipped.includes(provesAt);
}

/** Done or skipped — enough to unlock what follows. */
export function chapterPassed(id: ChapterId, progress: ProgressV1): boolean {
  return chapterDone(id, progress) || chapterSkipped(id, progress);
}

/**
 * The stop that must be passed before this one opens — the previous stop,
 * except that a mini-game proving the lesson just before it shares that
 * lesson's gate (so "Prove it →" is never locked). Null for the first stop.
 * Gate copy reads "Finish the {gate.title} first".
 */
export function chapterGate(id: ChapterId): Chapter | null {
  const prev = prevChapter(id);
  if (!prev) return null;
  return prev.provesAt === id ? prevChapter(prev.id) : prev;
}

/** Locked while its gate is not passed. The first stop is never locked. */
export function chapterLocked(id: ChapterId, progress: ProgressV1): boolean {
  const gate = chapterGate(id);
  return gate !== null && !chapterPassed(gate.id, progress);
}

/**
 * Where the Knight stands: the first stop not passed — unless that stop is
 * a lesson whose proof she has already opened, in which case she has moved
 * on to proving it and stands there. Null once the whole road is passed.
 */
export function standingAt(progress: ProgressV1, visited: ReadonlySet<ChapterId>): Chapter | null {
  const first = CHAPTERS.find((c) => !chapterPassed(c.id, progress)) ?? null;
  if (first?.provesAt && visited.has(first.provesAt)) return chapterById(first.provesAt);
  return first;
}

/** Level 1 never; level N while N-1 is not cleared and N is not skipped. */
export function levelLocked(level: number, progress: ProgressV1): boolean {
  if (level <= 1) return false;
  if (progress.skipped.includes(levelSkipKey(level))) return false;
  return !progress.courseLevelsCleared.includes(level - 1);
}

/** Wave 1 never; wave N while N-1 is not cleared and N is not skipped. */
export function waveLocked(wave: number, progress: ProgressV1): boolean {
  if (wave <= 1) return false;
  if (progress.skipped.includes(waveSkipKey(wave))) return false;
  return !progress.finaleWavesCleared.includes(wave - 1);
}

export function chapterState(
  id: ChapterId,
  progress: ProgressV1,
  visited: ReadonlySet<ChapterId>,
): ChapterState {
  if (chapterDone(id, progress)) return 'done';
  if (chapterSkipped(id, progress)) return 'skipped';
  if (chapterLocked(id, progress)) return 'locked';
  return visited.has(id) ? 'visited' : 'open';
}

/**
 * Everything the map needs in one call. `next` is where the Knight stands;
 * `reached` is how many legs of the road are walked (contiguous passed
 * stops, so a header click straight into a later stop doesn't draw the road
 * there); `states` is how to draw each stop.
 */
export function mapProgress(progress: ProgressV1, visited: ReadonlySet<ChapterId>): MapProgress {
  let reached = 0;
  for (const c of CHAPTERS) {
    if (!chapterPassed(c.id, progress)) break;
    reached += 1;
  }
  const states = {} as Record<ChapterId, ChapterState>;
  for (const c of CHAPTERS) states[c.id] = chapterState(c.id, progress, visited);
  return { next: standingAt(progress, visited), reached, states };
}
