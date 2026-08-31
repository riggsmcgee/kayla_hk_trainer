/**
 * The ending — the twenty seconds after 1:30, and nothing else.
 *
 * Written as its own clock for the same reason `boss.ts` is: the fight's
 * clock, the intro's clock and the ending's clock must never be the same
 * number. The score stopped at 1:30 and this runs afterwards, so a slow
 * celebration can no more eat her time than Bill's entrance could.
 *
 * The sequence is ratified in docs/feedback/2026-08-27-playtest-7.md, which
 * REDESIGNED the two-beat version shipped in 66a89ac. The load-bearing change
 * is the first beat: the Bills STOP, they do not kneel. A kneeling Bill
 * announces the win, and the walk-on that follows then has nothing left to
 * frighten her with. The whole point of the sequence is that for thirteen
 * seconds she believes she is about to fight five more enemies.
 *
 * Beat names are what is HAPPENING, never what is drawn — the painters
 * translate.
 */

import { tickDown } from './session';
import { CANVAS } from './constants';
import { ENEMY_SIZES } from './enemies';
import type { EnemyId } from '@dojo/shared';

/**
 * - `stop`   — the clock dies mid-attack. Both Bills freeze, Bill's foam
 *   finger goes up and he shouts. No win text of any kind.
 * - `gather` — the roster walks in from both walls. Total silence otherwise.
 * - `hold`   — they arrive, and nothing happens. The peak of the fear.
 * - `kneel`  — everyone goes down to her, the Bills included.
 * - `rise`   — she lifts off the floor and drifts to the centre.
 * - `cheer`  — everyone stands and applauds. Runs until she says she is
 *   finished, so nothing about the ending is on a timer she has to keep up
 *   with.
 */
export type EndingBeat = 'stop' | 'gather' | 'hold' | 'kneel' | 'rise' | 'cheer';

/** The beats in the order they play. `cheer` is last and never ends. */
export const ENDING_ORDER: readonly EndingBeat[] = [
  'stop',
  'gather',
  'hold',
  'kneel',
  'rise',
  'cheer',
];

export const ENDING = {
  /** Bill's first word, and the frame where the fight stops being a fight. */
  stopSeconds: 1.2,
  /** The walk-on. The user's instruction was "don't rush it". */
  gatherSeconds: 5,
  /**
   * They arrive and nothing happens. This beat has no content at all, which
   * is exactly its job: it is the moment she is most sure she is in trouble,
   * and it exists only because the sequence was stretched to twenty seconds.
   */
  holdSeconds: 1.5,
  /** The kneel: the going-down, then the pose held. */
  kneelSeconds: 3.5,
  /**
   * How much of `kneelSeconds` is the going-down. The rest is the pose held,
   * which is what turns a movement into a gesture.
   */
  kneelMotionSeconds: 2,
  /** Her rise, and the drift to the horizontal centre. */
  riseSeconds: 2.6,
  /**
   * Seconds into the cheer before the dog starts backflipping. He applauds
   * with everyone first: the flip lands as a PUNCHLINE rather than as
   * texture, and it gives the held tableau a beat change instead of one held
   * picture.
   */
  cheerFlipAt: 3,
  /** Seconds into the cheer before the prompt fades in. */
  cheerPromptAt: 5.7,
  /** How long the cast takes to stand back up out of the kneel. */
  standSeconds: 0.6,
} as const;

/** Beat lengths, in order. `cheer` is 0 — it runs forever. */
const BEAT_SECONDS: Record<EndingBeat, number> = {
  stop: ENDING.stopSeconds,
  gather: ENDING.gatherSeconds,
  hold: ENDING.holdSeconds,
  kneel: ENDING.kneelSeconds,
  rise: ENDING.riseSeconds,
  cheer: 0,
};

/**
 * What follows what. Written as a total map rather than as an index into
 * `ENDING_ORDER` so the sequence cannot fall off its own end: `cheer` points
 * at itself, and `stepEnding` returns before ever reading it.
 */
const NEXT_BEAT: Record<EndingBeat, EndingBeat> = {
  stop: 'gather',
  gather: 'hold',
  hold: 'kneel',
  kneel: 'rise',
  rise: 'cheer',
  cheer: 'cheer',
};

/** Where the cheer starts, measured from 1:30. Every finite beat, summed. */
const CHEER_STARTS_AT =
  ENDING.stopSeconds +
  ENDING.gatherSeconds +
  ENDING.holdSeconds +
  ENDING.kneelSeconds +
  ENDING.riseSeconds;

/**
 * When the prompt appears, measured from 1:30. DERIVED, never written down —
 * the ratified figure is 19.5 s and the beat lengths must keep summing to it,
 * so a beat that is retuned without the others moves this number rather than
 * silently disagreeing with it.
 */
export const ENDING_PROMPT_SECONDS = CHEER_STARTS_AT + ENDING.cheerPromptAt;

export interface EndingState {
  beat: EndingBeat;
  /** Seconds since the whole sequence started; never rewinds. */
  elapsed: number;
  /** Seconds left in the current beat; zero once a beat runs forever. */
  beatTimer: number;
}

export function createEndingState(): EndingState {
  return { beat: 'stop', elapsed: 0, beatTimer: ENDING.stopSeconds };
}

/**
 * Advance the celebration by `dt` and report the beat it just moved INTO, or
 * null if it stayed where it was. One transition per step, like `stepBoss`.
 */
export function stepEnding(s: EndingState, dt: number): EndingBeat | null {
  s.elapsed += dt;
  if (s.beat === 'cheer') return null;

  s.beatTimer = tickDown(s.beatTimer, dt);
  if (s.beatTimer > 0) return null;

  const next = NEXT_BEAT[s.beat];
  s.beat = next;
  s.beatTimer = BEAT_SECONDS[next];
  return next;
}

/**
 * Seconds spent inside the current beat. During the cheer it is measured off
 * `elapsed` instead of the timer, because the cheer has no timer to subtract
 * from — it is the beat that runs until she ends it.
 */
export function beatElapsed(s: EndingState): number {
  if (s.beat === 'cheer') return Math.max(0, s.elapsed - CHEER_STARTS_AT);
  return BEAT_SECONDS[s.beat] - s.beatTimer;
}

/**
 * 0 → 1 through the current beat, for anything that has to animate across it.
 * A beat with no timer (the cheer) is always finished, which is what makes it
 * safe to feed a fade or a slide without special-casing the last beat.
 */
export function beatProgress(s: EndingState): number {
  const total = BEAT_SECONDS[s.beat];
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - s.beatTimer / total));
}

/**
 * How far down the cast is bowed, 0 → 1.
 *
 * ONE number for the whole tableau, because the kneel is a TRANSFORM applied
 * to whatever silhouette a body happens to have rather than five new
 * painters: a walker is a shell with leg nubs, a flier is a hovering ball, a
 * spitter has no legs. It ramps in over `kneelMotionSeconds`, holds through
 * the rest of the kneel AND through her rise — she is lifting while they are
 * still down, which is the picture — and unwinds when they stand to applaud.
 */
export function reverence(s: EndingState): number {
  switch (s.beat) {
    case 'kneel':
      return Math.min(1, beatElapsed(s) / ENDING.kneelMotionSeconds);
    case 'rise':
      return 1;
    case 'cheer':
      return Math.max(0, 1 - beatElapsed(s) / ENDING.standSeconds);
    default:
      return 0;
  }
}

/**
 * How high body `i` of the crowd is off the floor right now, celebrating.
 *
 * `Math.max(0, sin)` rather than a plain sine, so each body spends half its
 * cycle ON the floor: a crowd that hovers sinusoidally reads as floating, and
 * a crowd that hops reads as cheering. The stagger is what stops five bodies
 * from moving as one object — they are cheering, not marching.
 *
 * A DRAW-time offset on purpose. Nothing in the tableau is simulated after
 * 1:30, and a hop written into `position` would be one more piece of state the
 * restart has to remember to clear.
 *
 * This carries the whole celebration for the five, and it is doing so because
 * the alternative was TRIED and rejected on sight. PLAN.md §8 ratified giving
 * each of them its own party state through the fields its painter already
 * reads — the warden waving its shield, the duelist's upward anti-air, the
 * spitter's volley. In a browser the warden's `skyward` telegraph paints its
 * LANDING ZONE, a grey slab the height of the arena, and a hazard marker is
 * the last thing a celebration should be drawing; the duelist's anti-air
 * reads as a lamp post rather than as raised arms. Both wanted new drawing,
 * not new state, so they are written up in PLAN.md rather than half-shipped.
 */
export function crowdHop(timeS: number, i: number): number {
  return Math.max(0, Math.sin(timeS * 5.2 + i * 1.3)) * CROWD_HOP_HEIGHT;
}

/** How high a celebrating body leaves the floor at the top of its hop. */
export const CROWD_HOP_HEIGHT = 9;

/** True once the dog has stopped applauding and started showing off. */
export function dogIsFlipping(s: EndingState): boolean {
  return s.beat === 'cheer' && beatElapsed(s) >= ENDING.cheerFlipAt;
}

/** True once she has been told which button ends the celebration. */
export function promptIsUp(s: EndingState): boolean {
  return s.beat === 'cheer' && beatElapsed(s) >= ENDING.cheerPromptAt;
}

/**
 * NINE SLOTS, evenly spaced across the arena. The Knight takes the one she is
 * standing nearest, each Bill takes the one HE is nearest, and the roster
 * fills five of what is left.
 *
 * Fixed slots rather than offsets from the Knight, because the Bills are
 * planted wherever the fight left them — they do not walk to marks — and a
 * layout measured from her alone would happily stand a warden inside Bill the
 * man.
 */
export const CAST_SLOTS = 9;

/**
 * Drawn bounds, where they differ from the collision box.
 *
 * Playtest 6's correction, and the reason it is recorded rather than inferred:
 * `ENEMY_SIZES` is the HURTBOX. The flier's wings are 64 px across a 32 px
 * hurtbox, and sizing a tableau from the hurtbox is the same class of error
 * that shipped the warden's invisible telegraph.
 */
const INK_WIDTH: Partial<Record<EnemyId, number>> = {
  flier: 64,
  spitter: 58,
  dog: 68,
  bill: 88,
};

/** How wide this body actually draws, wings and props included. */
export function inkWidth(id: EnemyId): number {
  return INK_WIDTH[id] ?? ENEMY_SIZES[id].width;
}

/** Centre of slot `i` of `CAST_SLOTS`, spread evenly across the arena. */
export function slotX(i: number): number {
  return ((i + 0.5) * CANVAS.width) / CAST_SLOTS;
}

function nearestSlot(x: number): number {
  return Math.max(0, Math.min(CAST_SLOTS - 1, Math.round((x / CANVAS.width) * CAST_SLOTS - 0.5)));
}

export interface CastMark {
  id: EnemyId;
  /** Where this body ends up standing. */
  x: number;
  /** Which wall it walks in from. */
  fromLeft: boolean;
}

/**
 * Assign the roster to slots, given who is already standing where.
 *
 * `taken` is the Knight's x plus both Bills'. Roster members alternate ends of
 * the free list — leftmost, then rightmost, then inward — so the walk-on
 * arrives from both directions at once. That is the user's "all the other
 * enemies walk [on]", and it is only frightening if she cannot watch one edge
 * and feel safe about the other.
 */
export function castMarks(roster: readonly EnemyId[], taken: readonly number[]): CastMark[] {
  const free = new Set<number>();
  for (let i = 0; i < CAST_SLOTS; i++) free.add(i);
  for (const x of taken) free.delete(nearestSlot(x));

  const slots = [...free].sort((a, b) => a - b);
  const marks: CastMark[] = [];
  let lo = 0;
  let hi = slots.length - 1;
  for (const [i, id] of roster.entries()) {
    if (lo > hi) break;
    const fromLeft = i % 2 === 0;
    const slot = fromLeft ? slots[lo++] : slots[hi--];
    if (slot === undefined) break;
    marks.push({ id, x: slotX(slot), fromLeft });
  }
  return marks;
}

/** How tall a party hat stands above the head it sits on. */
export const HAT_HEIGHT = 18;

/** Where a party hat sits on a body: its brim, its point, and its half-width. */
export interface HatGeometry {
  /** y of the brim — the top of the body it is sitting on. */
  brim: number;
  /** y of the point. */
  peak: number;
  /** Half the brim's width. */
  half: number;
}

/**
 * Where the hat goes on `id`, given where its feet are.
 *
 * The numbers live here rather than in the painter for the same reason
 * `crowdHop` and `castMarks` do: this is the ending's tableau arithmetic, and
 * arithmetic is the part a test can hold onto. The painting stays in the
 * session, which is where painting lives.
 *
 * `ENEMY_SIZES` is the right table here and not `inkWidth`: the hat sits on the
 * BODY, and the body's box is what the collision table describes. The ink table
 * is wider because of the flier's wings, and a hat sized to a wingspan would
 * float beside its own head.
 */
export function hatGeometry(id: EnemyId, feetY: number): HatGeometry {
  const size = ENEMY_SIZES[id];
  const brim = feetY - size.height;
  return {
    brim,
    peak: brim - HAT_HEIGHT,
    // Capped, so the widest body does not get a hat wider than its own head.
    half: Math.min(11, size.width * 0.34),
  };
}
