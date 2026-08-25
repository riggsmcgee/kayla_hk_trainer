/**
 * Engine tuning constants for the practice game.
 *
 * Derived from docs/research/hk-frame-data.md ("Recommended starting values —
 * 60 fps canvas clone, Knight ≈ 48 px tall"). That doc anchors nearly every
 * number to the decompiled Hollow Knight `HeroController` (KnightInSilkSong
 * prefab dump + decompiled C#), cross-checked against the wiki.
 *
 * UNITS AND CONVERSIONS
 * - Hollow Knight simulates in Unity world units (u) at 50 Hz FixedUpdate.
 * - The Knight is ≈ 1.2 u tall; we render him ≈ 48 px tall, so 1 u = 40 px.
 * - Speeds convert as px/s = u/s × 40 (e.g. run 8.3 u/s → 332 px/s).
 * - Our simulation runs a fixed 60 Hz step (see FIXED_DT); time-based
 *   constants stay in seconds so the tick rate difference doesn't matter.
 *
 * CONFIDENCE
 * - Everything below is a direct px conversion of a DECOMPILED constant,
 *   except where a comment says "estimated". GRAVITY is *the* estimated
 *   tuning knob: HK's project gravity isn't in any decompiled file, so
 *   0.79 × (working figure −60 u/s²) ≈ 47.4 u/s² ≈ 1900 px/s². If jumps
 *   feel wrong, tune gravity first — everything else is exact.
 */

import type { EnemyId } from '@dojo/shared';

/** Pixels per Hollow Knight world unit (Knight ≈ 1.2 u ≈ 48 px tall). */
export const UNIT_PX = 40;

/** Fixed-timestep simulation rate. HK uses 50 Hz; we standardize on 60. */
export const SIM_HZ = 60;

/** Seconds per simulation step. */
export const FIXED_DT = 1 / SIM_HZ;

/**
 * Logical canvas size. HK's camera shows ≈ 29.2 × 16.6 u (decompiled clamp
 * half-extents 14.6 / 8.3) → 1168 × 664 px at 40 px/u. A trainer may frame
 * tighter; this is the authentic-framing default.
 */
export const CANVAS = {
  width: 1168,
  height: 664,
} as const;

/** Knight hurtbox: 0.455 × 1.17 u (decompiled HeroBox collider). */
export const KNIGHT = {
  hurtboxWidth: 18, // 0.455 u ≈ 18.2 px
  hurtboxHeight: 47, // 1.17 u ≈ 46.8 px
  spriteHeight: 48, // visual ≈ 1.2 u
} as const;

/**
 * Movement, nail, pogo, and damage tuning.
 * Kayla's kit is deliberately minimal — jump + dash + nail. No double jump,
 * no spells: doubleJump constants are intentionally absent.
 */
export const PHYSICS = {
  // --- movement (decompiled unless noted) ---
  /** 8.3 u/s. Instant accel/decel, full air control — velocity is SET, never ramped. */
  runSpeed: 332,
  /** 16.65 u/s. PINNED (re-applied every step) while the jump is held. */
  jumpVelocity: 666,
  /** Hold vy at jumpVelocity for at most this long (9 steps @ 50 Hz = 0.18 s). */
  jumpHoldMax: 0.18,
  /** Always pin at least this long (4 steps = 0.08 s), even on a tap. */
  jumpHoldMin: 0.08,
  /** On release after min hold, vy snaps to 0 instantly — the crisp short hop. */
  jumpCutoff: true,
  /**
   * ESTIMATED — the one soft number. ≈ 47.4 u/s² (gravityScale 0.79 × the
   * community working figure of −60 u/s² project gravity) → ≈ 1900 px/s².
   * Sensible tuning range: 1700–2100.
   */
  gravity: 1900,
  /** 20 u/s hard fall-speed cap. */
  maxFallSpeed: 800,
  /** HK's famous near-zero coyote time is 0.04 s; 0.06 is kinder for a trainer (estimated tweak). */
  coyoteTime: 0.06,
  /** Jump input buffer (HK: 2 steps = 0.04 s; slightly widened, estimated tweak). */
  jumpBuffer: 0.05,

  // --- dash (decompiled) ---
  /** 20 u/s. */
  dashSpeed: 800,
  /** 0.25 s → 200 px dash. Vertical velocity is locked to 0 during the dash. */
  dashDuration: 0.25,
  /** 0.6 s; the air dash is restored on landing or on a successful pogo. */
  dashCooldown: 0.6,
  /** Dash input buffer: 10 steps = 0.2 s. */
  dashBuffer: 0.2,

  // --- nail (decompiled; hitbox px from decompiled collider bboxes) ---
  /** 0.41 s between swing starts (start-to-start cadence). */
  nailCadence: 0.41,
  /** 0.35 s swing animation. */
  nailSwingTime: 0.35,
  /** ~0.05 s before the hitbox is active (community/estimated — FSM-driven, no named constant). */
  nailStartup: 0.05,
  /** Side reach ≈ 2 u → 80 px from center; hitbox ≈ 80 × 64 px. */
  nailReachSide: 80,
  /** Up reach ≈ 2 u above the head → 80 px; ≈ 96 px wide. */
  nailReachUp: 80,
  /** Down reach ≈ 1.7 u below the feet → 70 px; ≈ 108 px wide — the generous width is what makes pogos forgiving. */
  nailReachDown: 70,
  /** Old Nail damage. */
  nailDamage: 5,
  /** Attack input buffer: 5 steps = 0.1 s. */
  attackBuffer: 0.1,
  /**
   * ESTIMATED — how long the slash hitbox stays live after startup. The
   * decompiled data gives swing duration (0.35 s) but the hitbox window is
   * FSM-driven with no named constant; community measurement puts it around
   * 0.13–0.17 s. Tune by feel alongside gravity.
   */
  nailActiveTime: 0.15,

  // --- pogo (decompiled) ---
  /** 12 u/s, PINNED for pogoTime then vy = 0 — a pinned ascent, not a bouncy impulse. */
  pogoVelocity: 480,
  /** 0.25 s → ≈ 120 px rise (~half a full jump). */
  pogoTime: 0.25,
  /** Every successful pogo refreshes the (air) dash. HK also refreshes double jump — Kayla's kit has none. */
  pogoRestoresDash: true,

  // --- damage / defense (decompiled unless noted) ---
  /** 1.3 s invulnerability after taking a hit. */
  iFrames: 1.3,
  /** Knockback away from the hit: (±15, 7.5) u/s → (600, 300) px/s. */
  knockback: { x: 600, y: 300 },
  /** 0.2 s knockback duration. */
  knockbackTime: 0.2,
  /** Hit-stop on damage. HK ≈ 0.25 s; 0.15 feels better at 60 fps (estimated tweak). */
  hitFreeze: 0.15,
} as const;

/** Per-enemy tuning. HP is in Old Nail hits (5 dmg each); speeds in px/s. */
export interface EnemyTuning {
  /** Hit points measured in nail hits. */
  readonly hp: number;
  /** Masks of damage per contact/projectile hit (standard non-boss: 1). */
  readonly damage: number;
  /** Patrol/drift speed in px/s, where it applies. */
  readonly speed?: number;
  /** Telegraph duration in seconds before the attack's active phase. */
  readonly telegraph?: number;
  /**
   * Bosses only: the nail never damages this enemy. resolveNailHit returns
   * 'blocked' for it, so she still bounces off it and nothing is counted.
   */
  readonly invulnerable?: boolean;
}

/**
 * Roster tuning keyed by the canonical shared EnemyId.
 * Research analogs: walker ≈ Crawlid, flier ≈ Vengefly, spitter ≈ Aspid
 * Hunter, duelist ≈ Mantis Warrior. The warden (shield/counter) has no
 * single research analog — its numbers are estimated and will be tuned when
 * its state machine is built.
 * HP/patterns are wiki-sourced; most timings/speeds are community/estimated.
 */
export const ENEMIES: Record<EnemyId, EnemyTuning> = {
  /** Crawlid-like pacing dummy. Contact damage only; ≈ 2 u/s patrol. */
  walker: { hp: 2, damage: 1, speed: 80 },
  /** Vengefly-like drifting dummy. Squawk telegraph ≈ 0.5 s, chase ≈ 3.75 u/s. */
  flier: { hp: 2, damage: 1, speed: 150, telegraph: 0.5 },
  /** Aspid-like ranged: ≈ 0.5 s wind-up, 3-shot fan (spread ≈ 35°, shots ≈ 8.5 u/s = 340 px/s, volley every ≈ 2.5 s); projectiles are nail-pokeable. */
  spitter: { hp: 3, damage: 1, telegraph: 0.5 },
  /** Mantis-like reactive melee: ≈ 0.35 s crouch telegraph, lunge ≈ 15 u/s (600 px/s) for ≈ 0.3 s; rising swipe anti-air; punishable in recovery. */
  duelist: { hp: 4, damage: 1, telegraph: 0.35 },
  /** Shield/counter: blocks frontal + aerial hits, telegraphed riposte after blocking; only vulnerable in post-counter recovery. (All estimated.) */
  warden: { hp: 4, damage: 1, telegraph: 0.4 },
  /** Bill the man: a 160 px charger who cannot be killed, only outlasted. */
  bill: { hp: 1, damage: 1, speed: 90, telegraph: 0.6, invulnerable: true },
  /** Bill the dog: arrives at 0:30, spits bones and rolls. Also unkillable. */
  dog: { hp: 1, damage: 1, speed: 120, telegraph: 0.45, invulnerable: true },
} as const;
