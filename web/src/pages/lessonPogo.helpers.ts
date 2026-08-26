/**
 * The figures the Pogo lesson's dashing section quotes.
 *
 * They are DERIVED from the engine's own constants rather than typed into
 * the prose, because this project has twice shipped a sentence whose number
 * had stopped being true. A page that computes its numbers cannot drift; a
 * page that states them can only be watched.
 *
 * The escape window is the one pair that is measured rather than derived —
 * it comes out of a simulation, not out of arithmetic — so it is pinned by
 * `lessonPogo.helpers.test.ts`, which runs the same probe `attackers.test.ts`
 * runs. If the physics moves, the lesson goes red.
 */
import { ATTACKS } from '../engine/enemies';
import { PHYSICS } from '../engine/constants';

/** 200 px — one dash, start to finish. */
const DASH_DISTANCE_PX = PHYSICS.dashSpeed * PHYSICS.dashDuration;
/** 83 px — how far running carries her over the same quarter second. */
const RUN_DISTANCE_PX = PHYSICS.runSpeed * PHYSICS.dashDuration;

/** Round for prose: 2.4096… is a measurement, "2.4" is a sentence. */
function oneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export const DASH_NUMBERS = {
  distancePx: DASH_DISTANCE_PX,
  runDistancePx: RUN_DISTANCE_PX,
  /** 117 px — the daylight the dash buys over running. This is the point of it. */
  headStartPx: DASH_DISTANCE_PX - RUN_DISTANCE_PX,
  /** 2.4× run speed. */
  timesRunSpeed: oneDecimal(PHYSICS.dashSpeed / PHYSICS.runSpeed),
  /** 0.41 s — the nail is ready again this long after a swing starts. */
  nailReadySeconds: PHYSICS.nailCadence,
  /**
   * 0.6 s — and this is the number that sets the rhythm, because the dash
   * comes back SLOWER than the nail does. Hit-and-away repeats on the dash,
   * not on the swing.
   */
  dashReadySeconds: PHYSICS.dashCooldown,
  /** 950 px/s — Bill the man's lance once he is hot. Faster than her dash. */
  hotLancePxPerSecond: ATTACKS.bill.lanceSpeedHot,
  /** 800 px/s. Named beside the lance because the comparison is the lesson. */
  dashPxPerSecond: PHYSICS.dashSpeed,
} as const;

/**
 * How long after landing a hit she can still leave and not be caught, in
 * seconds — measured against the duelist's anti-air, the enemy that punishes
 * staying. Running buys a tenth of a second; dashing buys two.
 */
export const ESCAPE_WINDOW = {
  running: 0.1,
  dashing: 0.2,
} as const;
