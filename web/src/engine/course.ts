/**
 * Pogo Course (M2, levels 2–4 from playtest 2): course geometry types, the
 * pure progression state machine, drifting-orb motion, and the hand-placed
 * layouts of the four levels.
 *
 * Design intent (PLAN §5): a spike/bounce-target obstacle course crossed by
 * chaining downslash pogos, checkpointed so a miss costs seconds, not the
 * run. Spikes ARE pogoable — nail-bouncing off spikes is a real (and
 * eventually essential) Hollow Knight skill — but touching them with your
 * body sends you back to the last checkpoint.
 *
 * Playtest 2 added two more things to bounce on:
 * - HAZARD ORBS (red): the nail bounces off them exactly like a blue orb,
 *   but the body touching one counts like spikes. They teach bouncing early.
 * - MOVERS (drifting blue orbs): harmless, pogoable, and on a fixed path that
 *   is a pure function of course time — no RNG, so a run is reproducible.
 */

import type { AABB, Vec2 } from './types';

export interface Checkpoint {
  /** Zone that arms this checkpoint when the player's hurtbox enters it. */
  trigger: AABB;
  /** Feet position the player respawns at once armed. */
  respawn: Vec2;
}

export interface MoverPath {
  kind: 'horizontal' | 'vertical' | 'circle';
  /** Half-travel for lines, radius for circles, in px. */
  amplitude: number;
  /** Seconds per full cycle. */
  period: number;
  /** Offset along the cycle as a fraction of the period (0.25 = a quarter ahead). */
  phase: number;
}

/** A drifting orb: a square box of `size` px whose center rides `path` around `center`. */
export interface Mover {
  size: number;
  center: Vec2;
  path: MoverPath;
}

export interface CourseDef {
  /** Short in-world name, shown as "Level N — name". */
  name: string;
  /** One line shown before the run starts. */
  intro: string;
  /** Total course width in px (for camera clamping). */
  width: number;
  /** Feet position of the initial spawn. */
  spawn: Vec2;
  solids: AABB[];
  /** Body contact → respawn at the last checkpoint. Also pogoable. */
  spikes: AABB[];
  /** Bounce orbs: pogoable, harmless. */
  orbs: AABB[];
  /** Red orbs: pogoable like an orb, but body contact counts like spikes. */
  hazardOrbs: AABB[];
  /** Drifting orbs: pogoable, harmless; their boxes come from moverBox(m, t). */
  movers: Mover[];
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
  /** Spike and hazard-orb touches this run. */
  misses: number;
  /** Highest checkpoint reached; −1 = none (respawn at spawn). */
  checkpointIndex: number;
  /** Where a spike hit sends the player back to. */
  respawnPoint: Vec2;
}

export interface CourseEvents {
  /** The player touched a spike or hazard orb this step and must be moved to respawnPoint. */
  respawned: boolean;
  /** Index of a checkpoint newly armed this step, else null. */
  checkpointReached: number | null;
  /** The goal was reached this step. */
  finishedNow: boolean;
}

function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Where a drifting orb is at course time t. Pure and deterministic: the
 * session and the renderer both call this with the same t, so what she sees
 * is what the nail hits. Circles run clockwise on screen (right → down →
 * left → up, since +y is down on a canvas).
 */
export function moverBox(m: Mover, t: number): AABB {
  const theta = Math.PI * 2 * (t / m.path.period + m.path.phase);
  const a = m.path.amplitude;
  let dx = 0;
  let dy = 0;
  switch (m.path.kind) {
    case 'horizontal':
      dx = a * Math.sin(theta);
      break;
    case 'vertical':
      dy = a * Math.sin(theta);
      break;
    case 'circle':
      dx = a * Math.cos(theta);
      dy = a * Math.sin(theta);
      break;
  }
  return {
    x: m.center.x + dx - m.size / 2,
    y: m.center.y + dy - m.size / 2,
    width: m.size,
    height: m.size,
  };
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
 * this only reports what happened. Movers never hurt, so they play no part
 * here — the session feeds them to the player sim as pogoables.
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

  for (const hazard of course.spikes) {
    if (overlaps(playerBox, hazard)) {
      state.misses += 1;
      events.respawned = true;
      return events;
    }
  }
  for (const hazard of course.hazardOrbs) {
    if (overlaps(playerBox, hazard)) {
      state.misses += 1;
      events.respawned = true;
      return events;
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Level layouts
// ---------------------------------------------------------------------------

/** Main walkway surface height (matches the arena floor). */
export const COURSE_FLOOR_Y = 600;
/** Pit floors sit lower; spikes stand on them. */
const PIT_FLOOR_Y = 656;
const SPIKE_HEIGHT = 24;
const ORB_SIZE = 28;
/** Resting orb height: center 100 px above the walkway (top 486), Level 1's norm. */
const ORB_REST_Y = 500;

interface PitSpec {
  from: number;
  to: number;
}

/** Orb spec: center x and TOP y (orb boxes are ORB_SIZE square). */
interface OrbSpec {
  cx: number;
  top: number;
}

interface LevelSpec {
  name: string;
  intro: string;
  width: number;
  spawn: Vec2;
  pits: PitSpec[];
  orbs: OrbSpec[];
  hazardOrbs?: OrbSpec[];
  movers?: Mover[];
  checkpoints: Checkpoint[];
  goal: AABB;
}

function orbBox(o: OrbSpec): AABB {
  return { x: o.cx - ORB_SIZE / 2, y: o.top, width: ORB_SIZE, height: ORB_SIZE };
}

function buildCourse(spec: LevelSpec): CourseDef {
  const { width, spawn, pits, checkpoints, goal } = spec;
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

  return {
    name: spec.name,
    intro: spec.intro,
    width,
    spawn,
    solids,
    spikes,
    orbs: spec.orbs.map(orbBox),
    hazardOrbs: (spec.hazardOrbs ?? []).map(orbBox),
    movers: spec.movers ?? [],
    checkpoints,
    goal,
  };
}

function checkpointAt(x: number): Checkpoint {
  return {
    // Full-height trigger column: a pogo arc or air dash can cross well
    // above the lantern, and passing a checkpoint must always arm it.
    trigger: { x: x - 20, y: -400, width: 40, height: COURSE_FLOOR_Y + 400 },
    respawn: { x, y: COURSE_FLOOR_Y },
  };
}

/** A drifting orb at rest height unless told otherwise. */
function mover(cx: number, path: MoverPath, cy: number = ORB_REST_Y): Mover {
  return { size: ORB_SIZE, center: { x: cx, y: cy }, path };
}

/** The goal doorway: a 60 × 160 arch standing on the walkway. */
function goalAt(x: number): AABB {
  return { x, y: COURSE_FLOOR_Y - 160, width: 60, height: 160 };
}

/**
 * Level 1 — The Shallows: four pits of rising demand. FROZEN: the user
 * called this "a perfect level 1" in playtest 2; course.test.ts pins its
 * geometry to a snapshot.
 *  A (320 px) — one orb: learn the single bounce.
 *  B (560 px) — three orbs in a row: hold the rhythm.
 *  C (960 px) — six orbs, heights staggered: read while you bounce.
 *  D (460 px) — two LOW orbs over spikes: precision, spike-pogo courage.
 */
export const POGO_COURSE_1: CourseDef = buildCourse({
  name: 'The Shallows',
  intro: 'Bounce across on the glowing orbs — jump, then slash DOWN in the air.',
  width: 4200,
  spawn: { x: 120, y: COURSE_FLOOR_Y },
  pits: [
    { from: 560, to: 880 },
    { from: 1160, to: 1720 },
    { from: 2160, to: 3120 },
    { from: 3400, to: 3860 },
  ],
  orbs: [
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
  checkpoints: [checkpointAt(1000), checkpointAt(1900), checkpointAt(3260)],
  goal: goalAt(3980),
});

/**
 * Level 2 — Ember Pools: "red means early". Red orbs bounce like blue ones
 * but burn the body, so a late, low swing that would have been fine on blue
 * sends her back to the lantern. Blue and red mix so the eye learns the
 * color; pit C is red only.
 *  A — blue then red: the same bounce, now with a rule.
 *  B — red, blue, red: read the color mid-rhythm.
 *  C — four reds in a row: no safety net, every swing early.
 *  D — staggered, the reds sitting LOW: the later you swing, the closer they are.
 */
export const POGO_COURSE_2: CourseDef = buildCourse({
  name: 'Ember Pools',
  intro: 'Red orbs burn to touch. Swing early, while they are still below you.',
  width: 4100,
  spawn: { x: 120, y: COURSE_FLOOR_Y },
  pits: [
    { from: 560, to: 960 },
    { from: 1240, to: 1800 },
    { from: 2040, to: 2760 },
    { from: 3040, to: 3620 },
  ],
  orbs: [
    // Pit A
    { cx: 720, top: 486 },
    // Pit B
    { cx: 1490, top: 486 },
    // Pit D
    { cx: 3290, top: 450 },
  ],
  hazardOrbs: [
    // Pit A
    { cx: 860, top: 486 },
    // Pit B
    { cx: 1330, top: 486 },
    { cx: 1650, top: 486 },
    // Pit C — red only
    { cx: 2130, top: 486 },
    { cx: 2290, top: 486 },
    { cx: 2450, top: 486 },
    { cx: 2610, top: 486 },
    // Pit D — low reds
    { cx: 3130, top: 510 },
    { cx: 3450, top: 525 },
  ],
  checkpoints: [checkpointAt(1080), checkpointAt(1920), checkpointAt(2900)],
  goal: goalAt(3880),
});

/**
 * Level 3 — The Drift: "things that drift". Blue orbs on fixed paths —
 * first sideways, then up and down, then circles, then all three. Timing
 * on a moving target: watch the path, meet the orb where it is going.
 *  A — a still orb, then one sideways drifter: it comes to you.
 *  B — a sideways drifter between two still orbs: cross it either way.
 *  C — three up-and-down drifters: swing when it is below you.
 *  D — two circles turning together, close enough to chain.
 *  E — sideways, up-and-down, circle: the mix.
 */
export const POGO_COURSE_3: CourseDef = buildCourse({
  name: 'The Drift',
  intro: 'These orbs drift. Watch the dotted path — meet them where they are going.',
  width: 4440,
  spawn: { x: 120, y: COURSE_FLOOR_Y },
  pits: [
    { from: 560, to: 1020 },
    { from: 1200, to: 1760 },
    { from: 2000, to: 2560 },
    { from: 2780, to: 3220 },
    { from: 3480, to: 4100 },
  ],
  orbs: [
    // Pit A — the familiar first bounce
    { cx: 720, top: 486 },
    // Pit B — still orbs either side of the drifter
    { cx: 1300, top: 486 },
    { cx: 1600, top: 486 },
  ],
  movers: [
    // Pit A
    mover(880, { kind: 'horizontal', amplitude: 60, period: 3, phase: 0 }),
    // Pit B
    mover(1450, { kind: 'horizontal', amplitude: 60, period: 2.5, phase: 0 }),
    // Pit C — up and down
    mover(2110, { kind: 'vertical', amplitude: 60, period: 2.5, phase: 0 }),
    mover(2300, { kind: 'vertical', amplitude: 80, period: 3, phase: 0.25 }),
    mover(2470, { kind: 'vertical', amplitude: 60, period: 2.5, phase: 0.5 }),
    // Pit D — circles
    mover(2900, { kind: 'circle', amplitude: 60, period: 3, phase: 0 }),
    mover(3060, { kind: 'circle', amplitude: 60, period: 3, phase: 0 }),
    // Pit E — the mix
    mover(3600, { kind: 'horizontal', amplitude: 60, period: 2.5, phase: 0 }),
    mover(3790, { kind: 'vertical', amplitude: 60, period: 2.5, phase: 0.25 }),
    mover(3960, { kind: 'circle', amplitude: 60, period: 3, phase: 0 }),
  ],
  checkpoints: [checkpointAt(1100), checkpointAt(1900), checkpointAt(2680), checkpointAt(3380)],
  goal: goalAt(4220),
});

/**
 * Level 4 — The Deep: "all of it at once", the finale's level. Red orbs,
 * drifters, and longer gaps between bounces — the full-speed rhythm from
 * Level 1, the early swing from Level 2, the tracking from Level 3.
 *  A — blue, red, 190 px gaps: full speed from the first bounce.
 *  B — red, an up-and-down drifter, a low red.
 *  C — red, a circle, two low reds.
 *  D — two low reds, a sideways drifter, a red to the ledge.
 */
export const POGO_COURSE_4: CourseDef = buildCourse({
  name: 'The Deep',
  intro: 'All of it at once — red, drifting, and further apart. You know this.',
  width: 4300,
  spawn: { x: 120, y: COURSE_FLOOR_Y },
  pits: [
    { from: 560, to: 1100 },
    { from: 1320, to: 1980 },
    { from: 2200, to: 2900 },
    { from: 3120, to: 3900 },
  ],
  orbs: [
    // Pit A
    { cx: 720, top: 486 },
  ],
  hazardOrbs: [
    // Pit A
    { cx: 910, top: 486 },
    // Pit B
    { cx: 1410, top: 500 },
    { cx: 1780, top: 520 },
    // Pit C
    { cx: 2290, top: 500 },
    { cx: 2590, top: 520 },
    { cx: 2780, top: 530 },
    // Pit D
    { cx: 3210, top: 530 },
    { cx: 3400, top: 530 },
    { cx: 3700, top: 486 },
  ],
  movers: [
    // Pit B
    mover(1600, { kind: 'vertical', amplitude: 70, period: 2.5, phase: 0 }),
    // Pit C
    mover(2440, { kind: 'circle', amplitude: 60, period: 3, phase: 0 }),
    // Pit D
    mover(3550, { kind: 'horizontal', amplitude: 60, period: 3, phase: 0 }),
  ],
  checkpoints: [checkpointAt(1220), checkpointAt(2100), checkpointAt(3020)],
  goal: goalAt(4080),
});

/** The Bounce Bog's levels in order; index 0 is Level 1. Level 4 is the finale's. */
export const POGO_COURSES: readonly CourseDef[] = [
  POGO_COURSE_1,
  POGO_COURSE_2,
  POGO_COURSE_3,
  POGO_COURSE_4,
];
