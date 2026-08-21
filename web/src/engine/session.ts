/**
 * A GameSession is one running practice scene: it owns its simulation state
 * and knows how to draw itself. PracticeCanvas owns the loop, the input, and
 * the canvas element; sessions stay DOM-free apart from the 2D context they
 * are handed at render time.
 */

import type { InputFrame } from './types';

export interface GameSession {
  /** Advance the simulation by one fixed step (dt is always FIXED_DT). */
  step(input: InputFrame, dt: number): void;
  /**
   * Draw the current frame. `alpha` in [0, 1) interpolates between the last
   * two simulation states so high-refresh displays render smoothly.
   */
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
}
