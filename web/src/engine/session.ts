/**
 * A GameSession is one running practice scene: it owns its simulation state
 * and knows how to draw itself. PracticeCanvas owns the loop, the input, and
 * the canvas element; sessions stay DOM-free apart from the 2D context they
 * are handed at render time.
 */

import { PHYSICS } from './constants';
import type { InputFrame } from './types';

/**
 * The two-key overlay contract every clear/fail screen follows (playtest 3,
 * note 11): Z goes FORWARD, X goes AGAIN, everywhere, every time.
 *
 * Both keys are read from the RAW input frame, never the carried one, so a
 * reflex press inside a hit-stop cannot skip the screen she has not read yet.
 */
export interface OverlayControls {
  /**
   * What the copy calls the FORWARD control, asked for at DRAW time.
   *
   * A function and not a string, deliberately. These used to be baked in
   * when the session was built, so the only way to change the copy was to
   * rebuild the session — which restarts her run. Asking at draw time lets
   * the name follow a rebind, and follow which board she is holding, without
   * any session ever learning what a gamepad is (playtest 6, note 1).
   */
  jumpKey?: () => string;
  /** What the copy calls the AGAIN control, asked for at draw time. */
  attackKey?: () => string;
  /**
   * Where Z goes from a clear screen. Absent means there is nowhere forward
   * (the last level, a fail): Z is inert and the copy offers X only.
   */
  onNext?: () => void;
  /** What Z leads to, in her words: "level 2", "the waves", "Reading Enemies". */
  nextLabel?: string;
}

/**
 * Seconds an overlay ignores BOTH keys after it appears.
 *
 * X is far more exposed than Z ever was. The pogo course has no hit-stop on a
 * clear (FEEDBACK.courseClear.hitStop is 0) and course.ts sets `finished` on
 * the same step the goal is touched — so she arrives at the clear screen
 * mid pogo-mash, with X held down. Without this the screen would be gone
 * before she read a word of it.
 *
 * DERIVED, NOT GUESSED (playtest 5, note 4). It used to be a flat 0.35 s and
 * it lost to a mashing thumb by 0.06 s every single time. `nailCadence` is
 * how fast the nail can re-fire, so it is the fastest rhythm her presses can
 * arrive in; a quiet stretch one frame longer than that is proof she has
 * STOPPED, which is the thing the gate below actually waits for. It stays
 * short on purpose — a screen she has read and cannot leave is its own bug.
 */
export const OVERLAY_LOCKOUT_SECONDS = PHYSICS.nailCadence + 1 / 60;

/**
 * The guard every end screen dismisses through (playtest 5, note 4).
 *
 * > "The end screen automatically start the level again with no input for the
 * > final gauntlet pogo challenge."
 *
 * The rule is a FRESH press, not a longer wait, and the difference is the
 * whole fix. A plain countdown cannot win: she arrives mashing at
 * `nailCadence`, and whatever the countdown is, her next press is on the far
 * side of it. So EVERY press restarts the clock. The screen opens when she
 * has been quiet for one full mash period — proof the mash is over — and it
 * is then dismissed by the next press she actually chooses to make.
 *
 * She never has to press twice. The presses that re-arm the gate are the
 * ones she was already throwing at the fight; the first press she aims at
 * the screen is the one that works.
 *
 * Four screens used to disagree about this — two had a countdown, one had a
 * 2 s timer that needed no input at all, and one had nothing but a hope that
 * the 0.15 s hit-stop would absorb her reflex. They all go through here now,
 * so they cannot drift apart again.
 */
export interface OverlayGate {
  /** The screen just appeared. Starts the quiet period. */
  arm(): void;
  /**
   * Advance one step. `pressing` is true on any frame she pressed either
   * overlay key; such a frame restarts the quiet period. Returns true once a
   * press is allowed to dismiss the screen.
   */
  open(dt: number, pressing: boolean): boolean;
}

export function createOverlayGate(): OverlayGate {
  let quietFor = 0;
  return {
    arm(): void {
      quietFor = OVERLAY_LOCKOUT_SECONDS;
    },
    open(dt: number, pressing: boolean): boolean {
      if (quietFor <= 0) return true;
      quietFor = pressing ? OVERLAY_LOCKOUT_SECONDS : tickDown(quietFor, dt);
      return false;
    },
  };
}

/**
 * Tick a countdown by one step, landing on exactly 0 instead of on a float
 * residue.
 *
 * 0.35 is 21 steps of 1/60, but subtracting dt twenty-one times leaves about
 * 5e-17 rather than zero — so a plain `> 0` test runs one step long. Same
 * arithmetic that pinned the dash streak on (playtest 3, note 5); here it
 * would cost her a frame of input on every overlay.
 */
export function tickDown(seconds: number, dt: number): number {
  const left = seconds - dt;
  return left <= 1e-9 ? 0 : left;
}

export interface GameSession {
  /** Advance the simulation by one fixed step (dt is always FIXED_DT). */
  step(input: InputFrame, dt: number): void;
  /**
   * Draw the current frame. `alpha` in [0, 1) interpolates between the last
   * two simulation states so high-refresh displays render smoothly.
   */
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
}
