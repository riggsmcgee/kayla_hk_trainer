/**
 * Pogo Course (M2): course geometry types, the pure progression state
 * machine, and the layout of Course 1.
 *
 * Design intent (PLAN §5): a spike/bounce-target obstacle course crossed by
 * chaining downslash pogos, checkpointed so a miss costs seconds, not the
 * run. Spikes ARE pogoable — nail-bouncing off spikes is a real (and
 * eventually essential) Hollow Knight skill — but touching them with your
 * body sends you back to the last checkpoint.
 */

import type { AABB, Vec2 } from './types';

export interface Checkpoint {
  /** Zone that arms this checkpoint when the player's hurtbox enters it. */
  trigger: AABB;
  /** Feet position the player respawns at once armed. */
  respawn: Vec2;
}

export interface CourseDef {
  /** Total course width in px (for camera clamping). */
  width: number;
  /** Feet position of the initial spawn. */
  spawn: Vec2;
  solids: AABB[];
  /** Body contact → respawn at the last checkpoint. Also pogoable. */
  spikes: AABB[];
  /** Bounce orbs: pogoable, harmless. */
  orbs: AABB[];
  /** Ordered along the course; passing one moves the respawn point forward. */
  checkpoints: Checkpoint[];
  /** Touching this zone completes the course. */
  goal: AABB;
}

export interface CourseState {
  /** Set by the session on the first movement input; the clock waits for it. */
  started: boolean;
  finished: boolean;
  /** Run clock in seconds; frozen once finished. */
  elapsed: number;
  /** Spike touches this run. */
  misses: number;
  /** Highest checkpoint reached; −1 = none (respawn at spawn). */
  checkpointIndex: number;
  /** Where a spike hit sends the player back to. */
  respawnPoint: Vec2;
}

export interface CourseEvents {
  /** The player touched a spike this step and must be moved to respawnPoint. */
  respawned: boolean;
  /** Index of a checkpoint newly armed this step, else null. */
  checkpointReached: number | null;
  /** The goal was reached this step. */
  finishedNow: boolean;
}

function overlaps(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function createCourseState(course: CourseDef): CourseState {
  return {
    started: false,
    finished: false,
    elapsed: 0,
    misses: 0,
    checkpointIndex: -1,
    respawnPoint: { ...course.spawn },
  };
}

/**
 * Advance course progression by one step against the player's hurtbox.
 * Pure with respect to the player: movement/respawn is the session's job;
 * this only reports what happened.
 */
export function stepCourse(
  course: CourseDef,
  state: CourseState,
  playerBox: AABB,
  dt: number,
): CourseEvents {
  const events: CourseEvents = {
    respawned: false,
    checkpointReached: null,
    finishedNow: false,
  };
  if (state.finished) return events;

  if (state.started) state.elapsed += dt;

  for (let i = state.checkpointIndex + 1; i < course.checkpoints.length; i++) {
    const cp = course.checkpoints[i];
    if (cp && overlaps(playerBox, cp.trigger)) {
      state.checkpointIndex = i;
      state.respawnPoint = { ...cp.respawn };
      events.checkpointReached = i;
    }
  }

  if (overlaps(playerBox, course.goal)) {
    state.finished = true;
    events.finishedNow = true;
    return events;
  }

  for (const spike of course.spikes) {
    if (overlaps(playerBox, spike)) {
      state.misses += 1;
      events.respawned = true;
      break;
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Course 1 layout
// ---------------------------------------------------------------------------

/** Main walkway surface height (matches the arena floor). */
export const COURSE_FLOOR_Y = 600;
/** Pit floors sit lower; spikes stand on them. */
const PIT_FLOOR_Y = 656;
const SPIKE_HEIGHT = 24;
const ORB_SIZE = 28;

interface PitSpec {
  from: number;
  to: number;
}

/** Orb spec: center x and TOP y (orb boxes are ORB_SIZE square). */
interface OrbSpec {
  cx: number;
  top: number;
}

function buildCourse(
  width: number,
  spawn: Vec2,
  pits: PitSpec[],
  orbSpecs: OrbSpec[],
  checkpoints: Checkpoint[],
  goal: AABB,
): CourseDef {
  const solids: AABB[] = [];
  const spikes: AABB[] = [];

  // Walkway floor: the complement of the pits, with generous outer margins.
  let cursor = -400;
  for (const pit of pits) {
    solids.push({ x: cursor, y: COURSE_FLOOR_Y, width: pit.from - cursor, height: 200 });
    // Pit floor and its spike strip.
    solids.push({ x: pit.from, y: PIT_FLOOR_Y, width: pit.to - pit.from, height: 200 });
    spikes.push({
      x: pit.from + 6,
      y: PIT_FLOOR_Y - SPIKE_HEIGHT,
      width: pit.to - pit.from - 12,
      height: SPIKE_HEIGHT,
    });
    cursor = pit.to;
  }
  solids.push({ x: cursor, y: COURSE_FLOOR_Y, width: width + 400 - cursor, height: 200 });
  // Bounding walls so the course can't be walked out of.
  solids.push({ x: -432, y: -800, width: 32, height: 1600 });
  solids.push({ x: width + 400, y: -800, width: 32, height: 1600 });

  const orbs = orbSpecs.map((o) => ({
    x: o.cx - ORB_SIZE / 2,
    y: o.top,
    width: ORB_SIZE,
    height: ORB_SIZE,
  }));

  return { width, spawn, solids, spikes, orbs, checkpoints, goal };
}

function checkpointAt(x: number): Checkpoint {
  return {
    // Full-height trigger column: a pogo arc or air dash can cross well
    // above the lantern, and passing a checkpoint must always arm it.
    trigger: { x: x - 20, y: -400, width: 40, height: COURSE_FLOOR_Y + 400 },
    respawn: { x, y: COURSE_FLOOR_Y },
  };
}

/**
 * Course 1: four pits of rising demand.
 *  A (320 px) — one orb: learn the single bounce.
 *  B (560 px) — three orbs in a row: hold the rhythm.
 *  C (960 px) — six orbs, heights staggered: read while you bounce.
 *  D (460 px) — two LOW orbs over spikes: precision, spike-pogo courage.
 */
export const POGO_COURSE_1: CourseDef = buildCourse(
  4200,
  { x: 120, y: COURSE_FLOOR_Y },
  [
    { from: 560, to: 880 },
    { from: 1160, to: 1720 },
    { from: 2160, to: 3120 },
    { from: 3400, to: 3860 },
  ],
  [
    // Pit A
    { cx: 720, top: 486 },
    // Pit B — steady rhythm at one height
    { cx: 1250, top: 486 },
    { cx: 1410, top: 486 },
    { cx: 1570, top: 486 },
    // Pit C — staggered heights
    { cx: 2250, top: 470 },
    { cx: 2410, top: 430 },
    { cx: 2570, top: 475 },
    { cx: 2730, top: 425 },
    { cx: 2890, top: 470 },
    { cx: 3050, top: 500 },
    // Pit D — low bounces over the spikes
    { cx: 3500, top: 530 },
    { cx: 3690, top: 530 },
  ],
  [checkpointAt(1000), checkpointAt(1900), checkpointAt(3260)],
  { x: 3980, y: COURSE_FLOOR_Y - 160, width: 60, height: 160 },
);
