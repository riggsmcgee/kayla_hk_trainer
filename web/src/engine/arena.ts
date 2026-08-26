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
import { PHYSICS } from './constants';
import { enemyAttackHitbox, enemyBox, rallyBall, resolveNailHit } from './enemies';
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
   * DEV TOOL: remove in the final build. God mode: nothing can end the run.
   * A touch is reported as `wouldHaveHit` instead, so the developer can reach
   * any part of the dojo without playing through it and still see exactly
   * what would have got her.
   */
  godMode: boolean;
  /**
   * God mode only: seconds until another touch counts. Standing inside a
   * walker would otherwise report a hit sixty times a second.
   */
  graceTimer: number;
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
  /** The rolling ball was volleyed back up this step. Feedback only. */
  rallied: boolean;
  /**
   * DEV TOOL: remove in the final build. God mode only: this step would have
   * ended the run. Deliberately a SECOND flag rather than a lie told through
   * the first — `playerHit` means "the run is over" to stepStage, stepBoss
   * and every session's fail branch, and none of them should have to learn
   * what god mode is. Only the display reads this one.
   */
  wouldHaveHit: boolean;
}

export function createArenaState(observe: boolean, godMode = false): ArenaState {
  return {
    started: false,
    over: false,
    elapsed: 0,
    hitsLanded: 0,
    observe,
    godMode,
    graceTimer: 0,
    respawnTimers: [],
  };
}

/**
 * Something touched her. Normally that is the end of the run — the mode's
 * whole philosophy. In god mode it is only news, and only once per grace
 * window, so leaning on an enemy reads as one hit rather than a hundred.
 *
 * The window is HK's own i-frame duration, which every one-hit mode in this
 * dojo has had no use for until now.
 */
function registerTouch(state: ArenaState, events: ArenaEvents): void {
  if (!state.godMode) {
    state.over = true;
    events.playerHit = true;
    return;
  }
  if (state.graceTimer > 0) return;
  state.graceTimer = PHYSICS.iFrames;
  events.wouldHaveHit = true;
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function projectileBox(p: Projectile): AABB {
  return {
    x: p.position.x - p.radius,
    y: p.position.y - p.radius,
    width: p.radius * 2,
    height: p.radius * 2,
  };
}

/**
 * The part of an enemy that DAMAGES her: its whole body, for everything.
 *
 * The rolling dog used to be the exception — the top 26 px of the ball were
 * safe to ride, deliberately the red orb's rule from course level 2. That
 * was STRUCK in playtest 4: the ball is lethal everywhere, rising or
 * falling, with no immunity window.
 *
 * The reason is not that riding it was too easy. It is that pogoing the top
 * was free, so nobody — the user included — ever noticed she could simply
 * RUN UNDER it: at the current apex the ball's underside sits 81 px above
 * her head and she is 47 px tall. Deleting the cap does not remove an
 * answer, it reveals the one that was there all along.
 *
 * The function stays (rather than collapsing into `enemyBox` at the call
 * sites) because "the part that hurts" and "the body" are different
 * questions that happen to have the same answer today, and the bones are
 * about to want one of them.
 */
export function enemyHurtsBox(e: Enemy): AABB {
  return enemyBox(e);
}

/**
 * Is this enemy something her nail can ring off?
 *
 * Everything is, except the rolling ball. `applyPogoBounce` fires on nail
 * contact with EVERY enemy, unconditionally — so without this exception a
 * downslash onto the ball would bounce her and kill her on the same frame,
 * which reads as a bug rather than as a rule. Ratified in playtest 4: "the
 * dog ball isn't really meant to be pogoed off of." She simply dies.
 */
function isPogoSurface(e: Enemy): boolean {
  return !(e.id === 'dog' && e.attackKind === 'roll');
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
    rallied: false,
    wouldHaveHit: false,
  };
  if (state.over) return events;

  if (state.started) state.elapsed += dt;
  if (state.godMode) state.graceTimer = Math.max(0, state.graceTimer - dt);

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
  // The shot is spent either way: god mode changes what a hit COSTS, never
  // what the simulation does, or testing would not be testing the game.
  for (const shot of projectiles) {
    if (!shot.dead && overlaps(hurtbox, projectileBox(shot))) {
      shot.dead = true;
      registerTouch(state, events);
      if (state.over) return events;
    }
  }

  enemies.forEach((enemy, i) => {
    // The run is over the moment anything touches her, and the rest of this
    // frame must not keep scoring. Without this, an enemy later in the list
    // could still land a nail hit into state.hitsLanded on the frame she
    // died — harmless with one enemy, three extra chances to mutate a dead
    // frame once a wave has four.
    if (state.over) return;

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
      // two hits and one bounce. The rolling ball is the one exception —
      // see isPogoSurface.
      if (isPogoSurface(enemy)) applyPogoBounce(player);

      // THE VOLLEY. An up-slash that catches the ball BEFORE it reaches her
      // sends it back up (playtest 4).
      //
      // "Before it reaches her" is the whole rule, and it is enforced by the
      // `!overlaps` below rather than by geometry: her up-nail covers a band
      // 48–128 px above the FLOOR (activeNailHitbox anchors at her feet, so
      // that is 0–80 px above her 48 px head, NOT 48–128 above it) while her
      // own hurtbox tops out at 47, so there is a 57 px strip of ball
      // positions that are inside both. The 57 was right; the prose around it
      // said "above her head" and was not (playtest 5). Connecting in
      // THAT strip does not save her — it has already got her, and the body
      // check a few lines down still ends the run. Ratified deliberately:
      // the target is the air above her, not a swat off her own face.
      if (player.nailDir === 'up' && !overlaps(hurtbox, enemyBox(enemy))) {
        if (rallyBall(enemy, player.swingId)) events.rallied = true;
      }
    }

    // An active attack (lunge, swipe, riposte) that catches the body, or
    // plain contact — either way, the run ends. The first hit is the lesson.
    const attack = enemyAttackHitbox(enemy);
    if ((attack && overlaps(hurtbox, attack)) || overlaps(hurtbox, enemyHurtsBox(enemy))) {
      registerTouch(state, events);
    }
  });

  return events;
}
