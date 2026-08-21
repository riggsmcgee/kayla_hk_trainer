/**
 * Engine-facing types. Pure data shapes — no gameplay logic lives here.
 * The simulation (M1) will fill these out; today they document the contract
 * between the fixed-timestep loop, the input layer, and the renderer.
 */

import type { EnemyId, PracticeMode } from '@dojo/shared';

/** 2D vector in canvas pixels (see UNIT_PX in constants.ts for u→px scale). */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * One frame's sampled input, produced once per simulation step.
 * Later sessions add Gamepad API sampling behind the same shape so keyboard
 * and controller practice share every code path (muscle-memory transfer).
 */
export interface InputFrame {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  /** True only on the step the button went down (edge, for buffering). */
  jumpPressed: boolean;
  attackPressed: boolean;
  up: boolean;
  down: boolean;
  dashPressed: boolean;
}

/** Axis-aligned box, the only collision primitive the engine uses. */
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Static collision geometry the player moves through. */
export interface World {
  solids: AABB[];
  /**
   * Boxes a downslash can bounce off (bounce orbs, spikes, enemies — the
   * session composes this list per step for anything dynamic). Spike pogos
   * are deliberately possible, like the real game.
   */
  pogoables?: AABB[];
}

/**
 * Attack phases for the three attacker enemies (duelist, spitter, warden).
 * Lesson demo overlays color these: red = hurtbox during active, green =
 * safe-poke window, gold = punish window (recovery).
 */
export type AttackPhase = 'idle' | 'telegraph' | 'active' | 'recovery';

/** Minimal snapshot of the Knight the renderer needs. Extended in M1. */
export interface PlayerState {
  position: Vec2;
  velocity: Vec2;
  facing: 1 | -1;
  grounded: boolean;
}

/** Minimal snapshot of one enemy. Extended in M1 with per-enemy data. */
export interface EnemyState {
  id: EnemyId;
  position: Vec2;
  velocity: Vec2;
  facing: 1 | -1;
  hp: number;
  phase: AttackPhase;
}

/**
 * The whole simulation state for one practice session.
 * The loop simulates this at a fixed 60 Hz; the renderer interpolates
 * between the previous and current snapshots (see loop.ts).
 */
export interface SimState {
  mode: PracticeMode;
  /** Dodge Arena: nail does no damage, score = survival time. */
  observeMode: boolean;
  tick: number;
  elapsedMs: number;
  player: PlayerState;
  enemies: EnemyState[];
}
