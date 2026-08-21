/**
 * Dodge Arena state machine (M3). Pure logic, session-agnostic.
 *
 * The mode's whole philosophy in one rule: the run ends on the FIRST hit
 * you take. Score = clean nail hits landed. Observe mode disarms the nail
 * (no damage, no score — just a flash showing where a hit WOULD land) so
 * the only thing left to practice is watching and not getting hit.
 */

import { activeNailHitbox, playerHurtbox } from './player';
import type { Player } from './player';
import { enemyAttackHitbox, enemyBox, resolveNailHit } from './enemies';
import type { Enemy, Projectile } from './enemies';
import type { AABB } from './types';

/** Seconds between a kill and the next enemy appearing. */
export const RESPAWN_DELAY = 1.4;

export interface ArenaState {
  started: boolean;
  /** True once the player has been hit — the run is over. */
  over: boolean;
  /** Run clock in seconds; frozen when the run ends. */
  elapsed: number;
  hitsLanded: number;
  observe: boolean;
  /** Counts down after a kill; at zero the session spawns a fresh enemy. */
  respawnTimer: number;
}

export interface ArenaEvents {
  playerHit: boolean;
  nailLanded: boolean;
  enemyDied: boolean;
  /** The respawn delay just expired — replace the dead enemy now. */
  respawnEnemy: boolean;
}

export function createArenaState(observe: boolean): ArenaState {
  return {
    started: false,
    over: false,
    elapsed: 0,
    hitsLanded: 0,
    observe,
    respawnTimer: 0,
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
  enemy: Enemy,
  dt: number,
  projectiles: Projectile[] = [],
): ArenaEvents {
  const events: ArenaEvents = {
    playerHit: false,
    nailLanded: false,
    enemyDied: false,
    respawnEnemy: false,
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

  // Respawn countdown after a kill.
  if (enemy.dead) {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) events.respawnEnemy = true;
    return events; // a dead enemy neither hurts nor takes hits
  }

  // Nail contact — resolveNailHit dedupes per swing and handles the
  // warden's block + riposte; lethal only outside observe mode.
  if (nail && overlaps(nail, enemyBox(enemy))) {
    const result = resolveNailHit(player, enemy, !state.observe);
    if (result === 'hit' && !state.observe) {
      events.nailLanded = true;
      state.hitsLanded += 1;
      if (enemy.dead) {
        events.enemyDied = true;
        state.respawnTimer = RESPAWN_DELAY;
      }
    }
  }

  // An active attack (lunge, swipe, riposte) that catches the body, or
  // plain contact — either way, the run ends. The first hit is the lesson.
  const attack = enemyAttackHitbox(enemy);
  if ((attack && overlaps(hurtbox, attack)) || overlaps(hurtbox, enemyBox(enemy))) {
    state.over = true;
    events.playerHit = true;
  }

  return events;
}
