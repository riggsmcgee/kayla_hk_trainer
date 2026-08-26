/**
 * THREE LOOKS for the dog's two hazards, for the user to choose between
 * (playtest 4 — every artistic decision this round ships as a portfolio).
 *
 * The ball and the bones are grouped into one choice rather than two,
 * because they are the same character's visual language and picking them
 * separately invites a ball and a bone that do not look related.
 *
 * WHY THIS EXISTS AT ALL: the pale pogo-safe cap on the ball was struck this
 * round (the ball is lethal everywhere now), so the ball needs a marker that
 * says "bounce off this and it still hurts" rather than one that says "ride
 * here". Shipping no marker was not an option — a rule the simulation
 * enforces but the picture never mentions is exactly how the warden's
 * invisible telegraph shipped.
 *
 * A FINDING THE PORTFOLIO SURFACED, which is what the portfolio process is
 * for: the bones as first built rotate CONTINUOUSLY. `PLAN.md` §3 ratifies
 * that nothing in either Bill module interpolates — every offset is a whole
 * step on a `Math.floor(t * hz)` clock, and that was the single axis
 * separating the two designs the user chose from the seven they did not. A
 * smoothly spinning bone quietly breaks it. `boneSteps` is the fix.
 *
 * PLAYTEST 5 PICKED "Stepped for the bones" — and picked the BONES, not the
 * broken ring that "Stepped" happened to be bundled with. The two were one
 * entry only because the portfolio grouped them, so there is a fourth entry
 * now that separates them: the stepped bones on the plain orb ring. It is
 * the DEFAULT, because every fallback in this file used to resolve to index
 * 0 and a fresh browser therefore played the SMOOTH bones — the version the
 * user has just voted against.
 */

export type RingStyle =
  /** The red hazard orb's own thin dark ring, exactly. Quietest, and already her vocabulary. */
  | 'thin'
  /** The same ring, twice as heavy. Reads at a glance across a busy arena. */
  | 'bold'
  /** A broken ring whose gaps travel — the ball's spin, drawn. */
  | 'spun';

export interface DogLook {
  name: string;
  feel: string;
  ring: RingStyle;
  /**
   * Rotation positions a bone snaps to, or 0 for a continuous spin. 8 gives
   * a 45° step, which is coarse enough to read as animation frames rather
   * than as motion.
   */
  boneSteps: number;
}

export const DOG_LOOKS: readonly DogLook[] = [
  {
    name: 'Orb rules',
    feel: "The ball wears the red orb's own thin ring, and the bones spin smoothly. Quietest, and the vocabulary she already reads.",
    ring: 'thin',
    boneSteps: 0,
  },
  {
    name: 'Loud',
    feel: 'The same ring at double weight, so the ball reads across a busy arena. Bones still spin smoothly.',
    ring: 'bold',
    boneSteps: 0,
  },
  {
    name: 'Stepped',
    feel: "A broken ring whose gaps travel with the ball's spin, and bones that tumble in whole frames — the same rule the rest of the Bills are held to.",
    ring: 'spun',
    boneSteps: 8,
  },
  {
    name: 'Stepped, plain ring',
    feel: "The bones tumble in whole frames, and the ball keeps the red orb's own quiet ring. The rule kept, without the louder marker.",
    ring: 'thin',
    boneSteps: 8,
  },
];

/**
 * The look the fight wears, and what an unset or out-of-range setting means.
 *
 * Playtest 5 asked for the stepped bones on the plain ring, and this is the
 * entry that is both. It is LAST rather than first for the same reason the
 * ratified roll is: re-pointing a stored index at a different design on a
 * picker whose only job is comparison is the one thing it must not do.
 */
export const DEFAULT_DOG_LOOK = DOG_LOOKS.length - 1;

export function dogLook(index: number): DogLook {
  return DOG_LOOKS[index] ?? DOG_LOOKS[DEFAULT_DOG_LOOK]!;
}

/**
 * A bone's drawn angle: its true angle, or the nearest of `steps` positions.
 *
 * Snapping happens at DRAW time, never in the simulation — the hitbox is a
 * circle, so what the bone's rotation looks like can never change what it
 * hits. That separation is why this is a taste knob and not a balance one.
 */
export function boneAngle(angle: number, steps: number): number {
  if (steps <= 0) return angle;
  const turn = (Math.PI * 2) / steps;
  return Math.round(angle / turn) * turn;
}
