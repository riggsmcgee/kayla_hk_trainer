/**
 * Dodge Arena session (M3): one enemy at a time in a single-screen arena.
 * The run ends on the first hit taken; score is clean nail hits landed —
 * or survival time in observe mode, where the nail is a feather.
 */

import type { EnemyId } from '@dojo/shared';
import { RESPAWN_DELAY, createArenaState, stepArena } from './arena';
import type { ArenaState } from './arena';
import { CANVAS } from './constants';
import { createEnemy, enemyBox, stepEnemy, stepProjectile } from './enemies';
import type { Enemy, Projectile } from './enemies';
import {
  FEEDBACK,
  LAND_SQUASH_TIME,
  computeStretch,
  createEdgeCarry,
  createJuice,
} from './juice';
import type { ComfortSettings } from './juice';
import { createPlayer, stepPlayer } from './player';
import {
  COLORS,
  clearCanvas,
  drawEnemy,
  drawKnight,
  drawNailSlash,
  drawProjectiles,
  drawWorld,
  lerpVec,
} from './render';
import { recordRun } from '../storage/recordRun';
import type { GameSession } from './session';
import type { InputFrame, Vec2, World } from './types';

const FLOOR_Y = 600;
const ENEMY_NAMES: Record<EnemyId, string> = {
  walker: 'the walker',
  flier: 'the flier',
  duelist: 'the duelist',
  spitter: 'the spitter',
  warden: 'the warden',
};

export interface ArenaConfig {
  enemyId: EnemyId;
  observe: boolean;
  comfort: ComfortSettings;
}

function arenaWorld(): World {
  return {
    solids: [
      { x: -200, y: FLOOR_Y, width: CANVAS.width + 400, height: 200 },
      { x: -32, y: -400, width: 32, height: CANVAS.height + 400 },
      { x: CANVAS.width, y: -400, width: 32, height: CANVAS.height + 400 },
      { x: 190, y: FLOOR_Y - 130, width: 140, height: 18 },
      { x: 838, y: FLOOR_Y - 130, width: 140, height: 18 },
    ],
  };
}

function spawnEnemy(id: EnemyId, awayFromX: number): Enemy {
  const x = awayFromX < CANVAS.width / 2 ? CANVAS.width - 300 : 300;
  const airborne = id === 'flier' || id === 'spitter';
  return airborne ? createEnemy(id, x, 430) : createEnemy(id, x, FLOOR_Y);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function createDodgeArenaSession(config: ArenaConfig): GameSession {
  const world = arenaWorld();
  const juice = createJuice(config.comfort);
  const edgeCarry = createEdgeCarry();

  let player = createPlayer(280, FLOOR_Y);
  let enemy = spawnEnemy(config.enemyId, 280);
  let state: ArenaState = createArenaState(config.observe);
  let projectiles: Projectile[] = [];
  let prevFeet: Vec2 = { ...player.position };
  let prevEnemyFeet: Vec2 = { ...enemy.position };
  let simTime = 0;
  let startedAtIso = '';
  let hitFlash = 0;
  let landSquash = 0;
  let wasGrounded = false;
  let recorded = false;

  function resetRun(): void {
    player = createPlayer(280, FLOOR_Y);
    enemy = spawnEnemy(config.enemyId, 280);
    state = createArenaState(config.observe);
    projectiles = [];
    prevFeet = { ...player.position };
    prevEnemyFeet = { ...enemy.position };
    hitFlash = 0;
    landSquash = 0;
    wasGrounded = false;
    recorded = false;
  }

  return {
    step(rawInput: InputFrame, dt: number): void {
      simTime += dt;
      juice.update(dt);
      if (juice.frozen()) {
        edgeCarry.absorb(rawInput);
        return;
      }
      const input = edgeCarry.merge(rawInput);
      hitFlash = Math.max(0, hitFlash - dt);
      landSquash = Math.max(0, landSquash - dt);

      if (state.over) {
        if (input.jumpPressed) resetRun();
        return;
      }

      if (!state.started) {
        const anyInput =
          input.left || input.right || input.jumpPressed || input.dashPressed || input.attackPressed;
        if (anyInput) {
          state.started = true;
          startedAtIso = new Date().toISOString();
        }
      }

      prevFeet.x = player.position.x;
      prevFeet.y = player.position.y;
      prevEnemyFeet.x = enemy.position.x;
      prevEnemyFeet.y = enemy.position.y;

      // A live enemy is a pogo target; teach bouncing on moving things.
      world.pogoables = enemy.dead ? [] : [enemyBox(enemy)];
      const pogosBefore = player.totalPogos;
      stepPlayer(player, input, world, dt);
      if (player.totalPogos > pogosBefore) {
        juice.addTrauma(FEEDBACK.pogo.trauma);
        juice.hitStop(FEEDBACK.pogo.hitStop);
      }
      if (!wasGrounded && player.grounded) landSquash = LAND_SQUASH_TIME;
      wasGrounded = player.grounded;
      // The enemy holds still until the run starts — nobody gets shelled
      // while reading the instructions.
      if (state.started) {
        const shots = stepEnemy(enemy, world, dt, {
          position: player.position,
          grounded: player.grounded,
        });
        if (shots) projectiles.push(...shots);
        for (const shot of projectiles) stepProjectile(shot, world, dt);
      }

      const events = stepArena(state, player, enemy, dt, projectiles);
      projectiles = projectiles.filter((s) => !s.dead);
      if (events.nailLanded) {
        juice.addTrauma(FEEDBACK.nailHit.trauma);
        juice.hitStop(FEEDBACK.nailHit.hitStop);
      }
      if (events.enemyDied) {
        juice.addTrauma(FEEDBACK.enemyDeath.trauma);
        juice.hitStop(FEEDBACK.enemyDeath.hitStop);
      }
      if (events.respawnEnemy) {
        enemy = spawnEnemy(config.enemyId, player.position.x);
        prevEnemyFeet = { ...enemy.position };
      }
      if (events.playerHit) {
        hitFlash = 0.5;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
        juice.hitStop(FEEDBACK.playerHit.hitStop);
        if (!recorded) {
          recorded = true;
          recordRun({
            mode: 'dodge',
            enemyId: config.enemyId,
            observeMode: config.observe || undefined,
            hitsLanded: state.hitsLanded,
            durationMs: Math.round(state.elapsed * 1000),
            startedAt: startedAtIso || new Date().toISOString(),
          });
        }
      }
    },

    render(ctx: CanvasRenderingContext2D, alpha: number): void {
      const feet = lerpVec(prevFeet, player.position, alpha);
      const enemyFeet = lerpVec(prevEnemyFeet, enemy.position, alpha);
      const shake = juice.shakeOffset(simTime);

      clearCanvas(ctx, CANVAS.width, CANVAS.height);
      ctx.save();
      // Shake moves the CAMERA, never the simulated bodies.
      ctx.translate(shake.x, shake.y);
      drawWorld(ctx, world);

      const deathFade = enemy.dead ? 1 - Math.max(0, state.respawnTimer) / RESPAWN_DELAY : 0;
      drawEnemy(ctx, enemyFeet, enemy, simTime, deathFade);
      drawProjectiles(ctx, projectiles);
      drawNailSlash(ctx, feet, player);
      drawKnight(ctx, feet, player, computeStretch(player.velocity.y, landSquash));
      ctx.restore();

      // --- HUD ---
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = COLORS.hudText;
      if (state.observe) {
        ctx.fillText(`watching ${formatTime(state.elapsed)}`, 16, 14);
      } else {
        ctx.fillText(`hits ${state.hitsLanded}`, 16, 14);
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(formatTime(state.elapsed), 16, 36);
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(
        state.observe ? `${ENEMY_NAMES[config.enemyId]} · observe` : ENEMY_NAMES[config.enemyId],
        CANVAS.width - 16,
        14,
      );

      if (!state.started) {
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText(
          state.observe
            ? 'Observe mode: your nail is a feather. Just watch, dodge, and survive.'
            : 'One rule: don’t get hit. The run ends on the first touch.',
          CANVAS.width / 2,
          96,
        );
      }

      if (hitFlash > 0) {
        // Reduce-flashing swaps the bright white pulse for a gentle darkening.
        ctx.fillStyle = config.comfort.reduceFlashing
          ? `rgba(7, 9, 18, ${0.3 * (hitFlash / 0.5)})`
          : `rgba(233, 228, 213, ${0.35 * (hitFlash / 0.5)})`;
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
      }

      if (state.over) {
        ctx.fillStyle = 'rgba(7, 9, 18, 0.78)';
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText('Run over.', CANVAS.width / 2, CANVAS.height / 2 - 70);
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          state.observe
            ? `You watched ${ENEMY_NAMES[config.enemyId]} for ${formatTime(state.elapsed)} — that's how fights are learned.`
            : `${state.hitsLanded} clean ${state.hitsLanded === 1 ? 'hit' : 'hits'} before the one that got you.`,
          CANVAS.width / 2,
          CANVAS.height / 2 - 24,
        );
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText('Press Z to go again.', CANVAS.width / 2, CANVAS.height / 2 + 24);
      }
    },
  };
}

