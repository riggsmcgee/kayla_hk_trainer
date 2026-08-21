/**
 * Juice (M6): trauma-based screen shake and hit-stop, per the game-feel
 * skill's models. Both are VISUAL-layer tools: shake offsets the camera at
 * render time (never the simulated bodies), and hit-stop pauses the sim for
 * a real-time beat while rendering continues.
 *
 * Accessibility: reduce-shake zeroes the render offset (the trauma clock
 * still runs so nothing else changes); reduce-flashing is read by sessions
 * to dim/skip full-screen flashes.
 */

import type { Stretch } from './render';
import type { InputFrame, Vec2 } from './types';

/** The two comfort toggles, mirrored from SettingsV1. */
export interface ComfortSettings {
  reduceShake: boolean;
  reduceFlashing: boolean;
}

/** trauma lost per second — shakes self-end in well under a second. */
const TRAUMA_DECAY = 1.6;
const MAX_OFFSET_X = 10;
const MAX_OFFSET_Y = 7;

export interface Juice {
  /** Impacts ADD trauma (clamped 0..1); they never reset it. */
  addTrauma(amount: number): void;
  /** Freeze the sim for a real-time duration. Longest wins; never stacks. */
  hitStop(seconds: number): void;
  /** Advance the real-time clocks once per loop step. */
  update(dt: number): void;
  /** True while the simulation should hold (render keeps running). */
  frozen(): boolean;
  /** Camera offset for this frame; {0,0} under reduce-shake. */
  shakeOffset(timeS: number): Vec2;
  trauma(): number;
}

export function createJuice(settings: ComfortSettings): Juice {
  let trauma = 0;
  let freezeTimer = 0;
  let frozenThisStep = false;

  return {
    addTrauma(amount) {
      trauma = Math.min(1, Math.max(0, trauma + amount));
    },
    hitStop(seconds) {
      freezeTimer = Math.max(freezeTimer, seconds);
    },
    update(dt) {
      trauma = Math.max(0, trauma - TRAUMA_DECAY * dt);
      // Check-then-decrement: a 0.05 s stop freezes exactly the next three
      // 60 Hz steps, with float error unable to add or drop one.
      frozenThisStep = freezeTimer > 1e-9;
      freezeTimer = Math.max(0, freezeTimer - dt);
    },
    frozen: () => frozenThisStep,
    shakeOffset(timeS) {
      if (settings.reduceShake || trauma <= 0) return { x: 0, y: 0 };
      // Quadratic response + smooth sampled sines (random-per-frame buzzes).
      const shake = trauma * trauma;
      const t = timeS * 30;
      return {
        x: MAX_OFFSET_X * shake * Math.sin(t * 1.7),
        y: MAX_OFFSET_Y * shake * Math.sin(t * 2.3),
      };
    },
    trauma: () => trauma,
  };
}

/** How long the landing squash lasts before easing back to rest. */
export const LAND_SQUASH_TIME = 0.14;

/**
 * Volume-conserving squash/stretch for the Knight: a brief squash on
 * landing that eases back (k² = settle), else a slight vertical stretch
 * proportional to fall/rise speed. Pure visual — hitboxes never change.
 */
export function computeStretch(vy: number, landSquashRemaining: number): Stretch {
  if (landSquashRemaining > 0) {
    const k = landSquashRemaining / LAND_SQUASH_TIME; // 1 → 0
    const amt = 0.22 * k * k;
    return { sx: 1 + amt, sy: 1 - amt * 0.8 };
  }
  const s = Math.min(Math.abs(vy) / 3200, 0.09);
  return { sx: 1 - s, sy: 1 + s };
}

/**
 * Press edges must survive a hit-stop: the loop samples input every frame
 * and edges are consumed per sample, so a press landing during a freeze
 * would vanish. Sessions absorb frozen-frame edges here and merge them
 * into the first simulated frame after the freeze.
 */
export function createEdgeCarry() {
  let jump = false;
  let attack = false;
  let dash = false;
  return {
    absorb(input: InputFrame): void {
      jump ||= input.jumpPressed;
      attack ||= input.attackPressed;
      dash ||= input.dashPressed;
    },
    merge(input: InputFrame): InputFrame {
      const merged: InputFrame = {
        ...input,
        jumpPressed: input.jumpPressed || jump,
        attackPressed: input.attackPressed || attack,
        dashPressed: input.dashPressed || dash,
      };
      jump = false;
      attack = false;
      dash = false;
      return merged;
    },
  };
}

/**
 * Feedback tiers so juice stays proportional across the whole game
 * (game-feel skill: scale to event importance; reserve the big guns).
 */
export const FEEDBACK = {
  /** A clean nail hit landing. */
  nailHit: { trauma: 0.14, hitStop: 0.045 },
  /** A pogo bounce connecting. */
  pogo: { trauma: 0.1, hitStop: 0.03 },
  /** An enemy dying. */
  enemyDeath: { trauma: 0.3, hitStop: 0.08 },
  /** The player getting hit — the run-ending event. */
  playerHit: { trauma: 0.55, hitStop: 0.15 },
  /** Course cleared. */
  courseClear: { trauma: 0.25, hitStop: 0 },
} as const;
