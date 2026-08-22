/**
 * Dodge Arena state machine (M3, multi-enemy since playtest 2). Pure logic,
 * session-agnostic.
 *
 * The mode's whole philosophy in one rule: the run ends on the FIRST hit
 * you take — from ANY enemy's body, attack or projectile. Score = clean nail
 * hits landed, counted across every enemy in the arena (one per swing per
 * enemy). Observe mode disarms the nail (no damage, no score — just a flash
 * showing where a hit WOULD land) so the only thing left to practice is
 * watching and not getting hit.
 *
 * Whether the run PASSES (survive the time AND land the hits) is the stage
 * rule in stages.ts; this file only says what touched what.
 */

import { activeNailHitbox, applyPogoBounce, playerHurtbox } from './player';
import type { Player } from './player';
import { enemyAttackHitbox, enemyBox, resolveNailHit } from './enemies';
import type { Enemy, Projectile } from './enemies';
import type { AABB } from './types';

/** Seconds between a kill and that enemy appearing again. */
export const RESPAWN_DELAY = 1.4;

export interface ArenaState {
  started: boolean;
  /** True once the player has been hit — the run is over. */
  over: boolean;
  /** Run clock in seconds; frozen when the run ends. */
  elapsed: number;
  /** Clean nail hits landed, across every enemy. */
  hitsLanded: number;
  observe: boolean;
  /**
   * Per-enemy countdown after a kill, indexed like the enemies array the
   * session passes to stepArena; at zero the session spawns a fresh enemy
   * in that slot. Missing entries read as zero (a live enemy).
   */
  respawnTimers: number[];
}

export interface ArenaEvents {
  playerHit: boolean;
  /** At least one clean hit landed this step. */
  nailLanded: boolean;
  /** How many clean hits landed this step (a swing can pass through two bodies). */
  hits: number;
  /** At least one enemy died this step. */
  enemyDied: boolean;
  /** Indices of enemies whose respawn delay just expired — replace them now. */
  respawn: number[];
}

export function createArenaState(observe: boolean): ArenaState {
  return {
    started: false,
    over: false,
    elapsed: 0,
    hitsLanded: 0,
    observe,
    respawnTimers: [],
  };
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function projectileBox(p: Projectile): AABB {
  return {
    x: p.position.x - p.radius,
    y: p.position.y - p.radius,
    width: p.radius * 2,
    height: p.radius * 2,
  };
}

export function stepArena(
  state: ArenaState,
  player: Player,
  enemies: readonly Enemy[],
  dt: number,
  projectiles: Projectile[] = [],
): ArenaEvents {
  const events: ArenaEvents = {
    playerHit: false,
    nailLanded: false,
    hits: 0,
    enemyDied: false,
    respawn: [],
  };
  if (state.over) return events;

  if (state.started) state.elapsed += dt;

  const nail = activeNailHitbox(player);
  const hurtbox = playerHurtbox(player);

  // The nail destroys projectiles — attacks are pokeable (pillar 2). This
  // works in observe mode too: nullifying a shot is defense, not offense.
  if (nail) {
    for (const shot of projectiles) {
      if (!shot.dead && overlaps(nail, projectileBox(shot))) shot.dead = true;
    }
  }

  // A projectile that reaches the body ends the run like any other hit.
  for (const shot of projectiles) {
    if (!shot.dead && overlaps(hurtbox, projectileBox(shot))) {
      shot.dead = true;
      state.over = true;
      events.playerHit = true;
      return events;
    }
  }

  enemies.forEach((enemy, i) => {
    // Respawn countdown after a kill — each slot on its own clock.
    if (enemy.dead) {
      const left = (state.respawnTimers[i] ?? 0) - dt;
      state.respawnTimers[i] = left;
      if (left <= 0) events.respawn.push(i);
      return; // a dead enemy neither hurts nor takes hits
    }

    // Nail contact — resolveNailHit dedupes per swing per enemy and handles
    // the warden's block + riposte; lethal only outside observe mode.
    if (nail && overlaps(nail, enemyBox(enemy))) {
      const result = resolveNailHit(player, enemy, !state.observe);
      if (result === 'hit' && !state.observe) {
        events.nailLanded = true;
        events.hits += 1;
        state.hitsLanded += 1;
        if (enemy.dead) {
          events.enemyDied = true;
          state.respawnTimers[i] = RESPAWN_DELAY;
        }
      }
      // The bounce rides the SAME contact as the damage (playtest 2, note 2):
      // a killing blow bounces, a blocked overhead hit bounces off the shield,
      // a feather nail in observe mode still bounces. This is the only place
      // an enemy acts as a pogo surface — the session never lists them in
      // world.pogoables, so there is exactly one contact check. The bounce
      // dedupes itself per swing, so two bodies under one downslash give
      // two hits and one bounce.
      applyPogoBounce(player);
    }

    // An active attack (lunge, swipe, riposte) that catches the body, or
    // plain contact — either way, the run ends. The first hit is the lesson.
    const attack = enemyAttackHitbox(enemy);
    if ((attack && overlaps(hurtbox, attack)) || overlaps(hurtbox, enemyBox(enemy))) {
      state.over = true;
      events.playerHit = true;
    }
  });

  return events;
}
