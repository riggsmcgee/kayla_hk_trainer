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

/**
 * How he crosses the ground between the frame edge and his mark.
 *
 * - `steady` — one pace the whole way. He is not hurrying, because he does
 *   not need to.
 * - `stomp`  — most of the distance in the first third, then he plants. He
 *   arrives before you have finished reading that he is arriving.
 * - `loom`   — slow at first and slower still at the end, easing onto the
 *   mark. The walk you notice rather than the walk you see finish.
 *
 * The curve is applied to progress and THEN stepped to whole 4 px, so no
 * style can smuggle in interpolation.
 */
export type ArrivalStyle = 'steady' | 'stomp' | 'loom';

export interface EntranceShape {
  /** What the picker calls it. */
  name: string;
  /** One line: what this entrance feels like to sit through. */
  feel: string;
  /** Seconds of off-screen footfalls before he appears. */
  thumps: number;
  /** How many footfalls fit in that time, evenly spaced. */
  thumpCount: number;
  /** Seconds he spends walking from the frame edge to his mark. */
  arrival: number;
  /** Seconds the name card holds afterwards. */
  card: number;
  style: ArrivalStyle;
  /**
   * THE DOG'S ENTRANCE, at 0:30 — the duration of each of its three timed
   * beats, in seconds. The fourth beat, the card, has no duration: it waits
   * for her.
   *
   * Ratified: Bill looks winded and calls for help, barking arrives from
   * off-screen, and the dog bursts in. There is no audio anywhere in this
   * project, so the calling and the barking are both DRAWN.
   *
   * These used to be FRACTIONS of one flat 2.5 s card on which everything
   * happened at once — shout, woof, walk and name card all overlapping.
   * Playtest 10 pulled them apart into a sequence, in his words: "Let's have
   * everything pause when Bill calls... You hear a wolf from off screen, and
   * then the dog comes on screen. Only after that point does the screen pop
   * up with the card."
   *
   * One casualty, struck deliberately: the "Sudden" variant used to land the
   * woof BEFORE the shout — the dog was already coming, and Bill was asking
   * for help that was halfway across the arena. A strictly sequential
   * cause-then-effect makes that reading impossible. The variants still differ
   * in pace, which is what they were mostly for.
   *
   * It lives on the same variant as Bill's own entrance rather than on a
   * picker of its own, for the same reason the ball and the bones share one:
   * they are the same scene, and choosing them separately invites a
   * frantic shout answered by a leisurely dog.
   */
  dogShout: number;
  dogWoof: number;
  dogWalk: number;
  dogStyle: ArrivalStyle;
}

/**
 * THREE ENTRANCES for Bill the man, for the user to choose between.
 *
 * Playtest 4 ratified that every artistic decision this round ships as a
 * PORTFOLIO rather than a pick: _"have multiple different variations for
 * different possibilities of directions we can go, and then I'll pick my
 * favorite from the options."_ These are the directions.
 *
 * All three keep what the interview settled and vary only what it left
 * open: he is always off-frame when the beat opens, always enters from the
 * right, always lands inside the 2–3 s the note asked for, and always moves
 * in whole 4 px steps.
 *
 * Four thumps at 0.3 s apart is a walking pace for something 160 px tall,
 * and four is the count that reads as "footsteps" rather than as "a noise" —
 * three can pass for a stumble and five starts to feel like a machine. The
 * other two variants push deliberately either side of that.
 */
export const BILL_ENTRANCES: readonly EntranceShape[] = [
  {
    name: 'Heavy',
    feel: 'Four even footfalls, then he walks in at his own pace. Unhurried, because he does not need to hurry.',
    thumps: 1.2,
    thumpCount: 4,
    arrival: 0.9,
    card: 2,
    style: 'steady',
    // He calls, and a moment later he is answered. The scene in its plainest
    // reading: cause, then effect.
    dogShout: 1.1,
    dogWoof: 0.9,
    dogWalk: 1.6,
    dogStyle: 'steady',
  },
  {
    name: 'Sudden',
    feel: 'Two thumps, a pause long enough to wonder, and then he is just THERE.',
    thumps: 1.0,
    thumpCount: 2,
    arrival: 0.5,
    card: 2,
    style: 'stomp',
    // Everything quick: he barely gets the word out and the dog is already
    // through the wall.
    dogShout: 0.8,
    dogWoof: 0.6,
    dogWalk: 1.1,
    dogStyle: 'stomp',
  },
  {
    name: 'Looming',
    feel: 'Six footfalls closing in, and a long slow walk that takes its time settling onto the mark.',
    thumps: 1.5,
    thumpCount: 6,
    arrival: 1.1,
    card: 2,
    style: 'loom',
    // He calls, and nothing happens, and nothing keeps happening, and then
    // the answer arrives late and takes its time getting there.
    dogShout: 1.5,
    dogWoof: 1.3,
    dogWalk: 2.1,
    dogStyle: 'loom',
  },
];

export function billEntrance(index: number): EntranceShape {
  return BILL_ENTRANCES[index] ?? BILL_ENTRANCES[0]!;
}

/** The default, and what every test that does not care about the choice uses. */
export const BILL_ENTRANCE: EntranceShape = BILL_ENTRANCES[0]!;

export function entranceSeconds(shape: EntranceShape): number {
  return shape.thumps + shape.arrival + shape.card;
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
  if (afterArrival < shape.card - TIME_EPS) {
    return { beat: 'name', progress: afterArrival / shape.card, thumped };
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

/**
 * Where the dog is on his walk in, as a fraction of the distance covered —
 * the same curve family Bill's own arrival uses, so a variant's two halves
 * move the same way.
 */
export function dogArrivalT(shape: EntranceShape, progress: number): number {
  return curve(shape.dogStyle, Math.min(1, Math.max(0, progress)));
}

/** The arrival curves. Each maps 0→0 and 1→1; everything between is taste. */
function curve(style: ArrivalStyle, t: number): number {
  switch (style) {
    case 'steady':
      return t;
    // Most of the ground in the first third, then he plants.
    case 'stomp':
      return 1 - (1 - t) ** 3;
    // Slow, and slower still at the end.
    case 'loom':
      return t * t;
  }
}

export function arrivalX(
  from: number,
  to: number,
  progress: number,
  style: ArrivalStyle = 'steady',
): number {
  const eased = curve(style, Math.min(1, Math.max(0, progress)));
  const raw = from + (to - from) * eased;
  return to + Math.round((raw - to) / ENTRANCE_STEP_PX) * ENTRANCE_STEP_PX;
}

// ---------------------------------------------------------------------------
// The dog's arrival, at 0:30
// ---------------------------------------------------------------------------

/**
 * The beats of the dog's arrival, in order.
 *
 * - `shout` — Bill calls for help. EVERYTHING holds: the fight's clock, both
 *   Bills, her Knight. Nothing is on screen but the word.
 * - `woof`  — the answer, from off-screen, still with no dog in sight.
 * - `walk`  — he crosses the frame edge and trots to his mark.
 * - `card`  — and only now, his name and who he is. UNTIMED: it holds until
 *   she presses something.
 * - `done`  — the fight resumes.
 */
export type DogBeat = 'shout' | 'woof' | 'walk' | 'card' | 'done';

export interface DogArrivalState {
  beat: DogBeat;
  /** Seconds spent in the CURRENT beat. */
  elapsed: number;
}

export function createDogArrival(): DogArrivalState {
  return { beat: 'shout', elapsed: 0 };
}

/** How long `beat` runs for on this variant; Infinity for the untimed card. */
export function dogBeatSeconds(shape: EntranceShape, beat: DogBeat): number {
  switch (beat) {
    case 'shout':
      return shape.dogShout;
    case 'woof':
      return shape.dogWoof;
    case 'walk':
      return shape.dogWalk;
    default:
      // The card waits for her, and `done` is over. Neither has a length.
      return Number.POSITIVE_INFINITY;
  }
}

/** 0 → 1 through the current beat; 0 for the two that have no length. */
export function dogBeatProgress(shape: EntranceShape, s: DogArrivalState): number {
  const total = dogBeatSeconds(shape, s.beat);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, s.elapsed / total);
}

/**
 * Advance the arrival by one step, returning the beat it ENTERED this step or
 * null if it stayed put.
 *
 * The card is deliberately terminal here: nothing this function does can leave
 * it, because the only thing that may is a fresh press, and that is the
 * session's business. `releaseDogCard` is the one door out.
 */
export function stepDogArrival(
  shape: EntranceShape,
  s: DogArrivalState,
  dt: number,
): DogBeat | null {
  if (s.beat === 'card' || s.beat === 'done') return null;
  s.elapsed += dt;

  // A LOOP and not a single advance: a held jump runs this at 2.5x, and the
  // shortest beat on the shortest variant is 0.6 s — so one hurried step can
  // cross a whole beat and land inside the next. Advancing once per call would
  // stall the sequence a beat behind the clock and make the hurried version
  // drift longer, not shorter, the faster she pushed it.
  let entered: DogBeat | null = null;
  while (s.beat !== 'card') {
    const total = dogBeatSeconds(shape, s.beat);
    if (s.elapsed + TIME_EPS < total) break;
    // Carry the overshoot rather than dropping it, so no time is invented or
    // lost at a boundary.
    s.elapsed -= total;
    s.beat = s.beat === 'shout' ? 'woof' : s.beat === 'woof' ? 'walk' : 'card';
    entered = s.beat;
  }
  return entered;
}

/** She pressed something on the card. Nothing else may leave it. */
export function releaseDogCard(s: DogArrivalState): void {
  if (s.beat === 'card') s.beat = 'done';
}

/** Seconds of theatre before the card, which is what a fast-forward can skip. */
export function dogTimedSeconds(shape: EntranceShape): number {
  return shape.dogShout + shape.dogWoof + shape.dogWalk;
}
