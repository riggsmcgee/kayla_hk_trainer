/**
 * Fixed-timestep game loop skeleton (60 Hz simulation, interpolated render).
 *
 * Pattern: the classic accumulator loop ("Fix Your Timestep"). The simulation
 * always steps in exact FIXED_DT increments regardless of display refresh
 * rate; the renderer draws between the previous and current simulation
 * states using an interpolation alpha, so 120 Hz+ displays stay smooth and
 * physics stays deterministic.
 *
 * React must NOT drive or re-render this — the loop runs on
 * requestAnimationFrame against a canvas React mounts exactly once.
 */

import { FIXED_DT } from './constants';

export interface LoopCallbacks {
  /**
   * Advance the simulation by exactly dt seconds (always FIXED_DT).
   * TODO(M1): sample an InputFrame here and step the SimState.
   */
  simulate: (dt: number) => void;
  /**
   * Draw one frame. `alpha` in [0, 1) is how far between the last two
   * simulation steps this frame falls — interpolate rendered positions as
   * prev + (curr - prev) * alpha.
   * TODO(M1): keep prev/curr SimState snapshots and lerp them here.
   */
  render: (alpha: number) => void;
}

export interface GameLoop {
  start: () => void;
  stop: () => void;
  /** True between start() and stop(). */
  isRunning: () => boolean;
}

/**
 * If a frame takes longer than this (tab was backgrounded, breakpoint hit),
 * clamp it so the accumulator doesn't spiral into a catch-up death loop.
 */
const MAX_FRAME_SECONDS = 0.25;

export function createGameLoop(callbacks: LoopCallbacks): GameLoop {
  let running = false;
  let rafId = 0;
  let lastTimeMs = 0;
  let accumulator = 0;

  const frame = (nowMs: number): void => {
    if (!running) return;

    const frameSeconds = Math.min((nowMs - lastTimeMs) / 1000, MAX_FRAME_SECONDS);
    lastTimeMs = nowMs;
    accumulator += frameSeconds;

    // Step the simulation zero or more times to consume real elapsed time.
    while (accumulator >= FIXED_DT) {
      // TODO(M1): snapshot current state into `prev` before stepping,
      // so render() can interpolate between the two.
      callbacks.simulate(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    // Leftover time as a fraction of one step = interpolation alpha.
    callbacks.render(accumulator / FIXED_DT);

    rafId = requestAnimationFrame(frame);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      accumulator = 0;
      rafId = requestAnimationFrame((nowMs) => {
        // Prime the clock on the first frame so frame one gets a sane delta.
        lastTimeMs = nowMs;
        rafId = requestAnimationFrame(frame);
      });
      // TODO(M1): pause/resume on document visibilitychange instead of
      // relying solely on the MAX_FRAME_SECONDS clamp.
    },
    stop: () => {
      running = false;
      cancelAnimationFrame(rafId);
    },
    isRunning: () => running,
  };
}
