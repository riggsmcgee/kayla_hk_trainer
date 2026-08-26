/**
 * The Bills' entrances — the timeline only (playtest 4, note 4).
 *
 * > "I want both builds to have a 2- to 3-second animation where they enter
 * > the battle. It's where their intro is, and it tells their name and has a
 * > custom animation."
 *
 * Pure: no session, no canvas, no `Enemy`. It answers one question — given
 * how long the beat has been running, what is on screen and how far through
 * it is — so the drawing can be replaced without touching the timing and the
 * timing can be tested without a canvas.
 *
 * Two rules from the interview shape the whole thing:
 *
 * - **The clock is frozen throughout.** The fight's clock starts on HER first
 *   input, which it already did; the entrance simply happens before that
 *   moment. So a slow intro can never eat her best time, and an interruption
 *   she did not ask for costs her nothing. Both of those were already
 *   ratified rules; this is what it takes to keep them.
 * - **Holding jump does not SKIP it, it speeds it up.** Ratified in the
 *   user's own words: _"if you hold down the jump button, the intro isn't
 *   skipped, but it goes at two or three times speed."_ A skip would mean a
 *   retry never sees the theatre again; a fast-forward means an impatient
 *   twentieth attempt still gets the beat, just briefly.
 */

/**
 * Accumulated float error must not add or drop a frame at a beat boundary
 * — the same trick and the same value the nail window uses in player.ts.
 * 1.2 + 0.9 + 0.7 does not equal 2.8 in binary, and without this the beat
 * spends one extra frame on its last card.
 */
const TIME_EPS = 1e-9;

/** How much faster the intro runs while she holds jump. */
export const INTRO_FAST_FORWARD = 2.5;

/**
 * The beats of an entrance, in order.
 *
 * - `thumps`  — the arena is empty but for the Knight, and something very
 *   large is walking toward it from off-screen. Ratified: Bill is NOT on
 *   screen when the beat opens, so the first thing she reads is the shake.
 * - `arrival` — he crosses the frame edge and walks to his mark.
 * - `name`    — the card with his name on it.
 * - `done`    — the beat is over; the fight is waiting on her first input.
 */
export type EntranceBeat = 'thumps' | 'arrival' | 'name' | 'done';

export interface EntranceStep {
  beat: EntranceBeat;
  /** 0 → 1 through THIS beat. Always 1 once the whole thing is `done`. */
  progress: number;
  /**
   * Which thump this is, counted from 1, on the frame it lands — else 0. The
   * session turns this into trauma, so the shake and the footfall cannot
   * drift apart.
   */
  thumped: number;
}

export interface EntranceShape {
  /** Seconds of off-screen footfalls before he appears. */
  thumps: number;
  /** How many footfalls fit in that time, evenly spaced. */
  thumpCount: number;
  /** Seconds he spends walking from the frame edge to his mark. */
  arrival: number;
  /** Seconds the name card holds afterwards. */
  name: number;
}

/**
 * Bill the man's entrance: 2.8 s.
 *
 * Four thumps at 0.3 s apart is a walking pace for something 160 px tall,
 * and four is the count that reads as "footsteps" rather than as "a noise" —
 * three can pass for a stumble and five starts to feel like a machine.
 */
export const BILL_ENTRANCE: EntranceShape = {
  thumps: 1.2,
  thumpCount: 4,
  arrival: 0.9,
  name: 0.7,
};

export function entranceSeconds(shape: EntranceShape): number {
  return shape.thumps + shape.arrival + shape.name;
}

/**
 * Where the entrance is at `elapsed` seconds in.
 *
 * `prevElapsed` is last frame's value, and it is what makes `thumped` an
 * EDGE rather than a level: a footfall fires on the frame it is crossed and
 * on no other, so a fast-forward that steps over two thumps at once still
 * reports the later one rather than silently swallowing both. (It reports
 * one, not two — two shakes on one frame is one shake.)
 */
export function stepEntrance(
  shape: EntranceShape,
  prevElapsed: number,
  elapsed: number,
): EntranceStep {
  const gap = shape.thumps / shape.thumpCount;
  let thumped = 0;
  for (let i = 1; i <= shape.thumpCount; i++) {
    const at = gap * i;
    if (prevElapsed < at && elapsed >= at) thumped = i;
  }

  if (elapsed < shape.thumps - TIME_EPS) {
    return { beat: 'thumps', progress: elapsed / shape.thumps, thumped };
  }
  const afterThumps = elapsed - shape.thumps;
  if (afterThumps < shape.arrival - TIME_EPS) {
    return { beat: 'arrival', progress: afterThumps / shape.arrival, thumped };
  }
  const afterArrival = afterThumps - shape.arrival;
  if (afterArrival < shape.name - TIME_EPS) {
    return { beat: 'name', progress: afterArrival / shape.name, thumped };
  }
  return { beat: 'done', progress: 1, thumped };
}

/**
 * Where Bill is during his arrival, in whole 4 px steps.
 *
 * The stepping is not an optimisation — it is a ratified constraint. Nothing
 * in either Bill module interpolates: every offset is a whole 4 px step on a
 * `Math.floor(t * hz)` clock, and that was the single axis separating the two
 * designs the user chose from the seven they did not (PLAN.md §3). An
 * entrance that glided him smoothly to his mark would be the one place in
 * the fight where he stops being the thing they picked.
 */
export const ENTRANCE_STEP_PX = 4;

export function arrivalX(from: number, to: number, progress: number): number {
  const eased = Math.min(1, Math.max(0, progress));
  const raw = from + (to - from) * eased;
  return to + Math.round((raw - to) / ENTRANCE_STEP_PX) * ENTRANCE_STEP_PX;
}
