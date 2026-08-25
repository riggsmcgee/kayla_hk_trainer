/**
 * A GameSession is one running practice scene: it owns its simulation state
 * and knows how to draw itself. PracticeCanvas owns the loop, the input, and
 * the canvas element; sessions stay DOM-free apart from the 2D context they
 * are handed at render time.
 */

import type { InputFrame } from './types';

/**
 * The two-key overlay contract every clear/fail screen follows (playtest 3,
 * note 11): Z goes FORWARD, X goes AGAIN, everywhere, every time.
 *
 * Both keys are read from the RAW input frame, never the carried one, so a
 * reflex press inside a hit-stop cannot skip the screen she has not read yet.
 */
export interface OverlayControls {
  /** What the copy calls the forward key. Remappable; the page passes the name. */
  jumpKey?: string;
  /** What the copy calls the again key. Remappable; the page passes the name. */
  attackKey?: string;
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
 */
export const OVERLAY_LOCKOUT_SECONDS = 0.35;

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
