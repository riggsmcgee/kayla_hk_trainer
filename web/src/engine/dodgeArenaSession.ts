/**
 * Dodge Arena session — the arena as a staged game (playtest 2, note 1 +
 * the interview). A list of stages (engine/stages.ts) is played in order:
 * each is passed by surviving its time AND landing its hits, then the next
 * one steps in. A touch restarts the SAME stage — death is a checkpoint,
 * never the whole roster. After the last stage, the page is told.
 *
 * The same session plays Kbug's Colosseum (one enemy per stage) and the
 * finale's waves (two enemies per stage). Both are the same flat floor. Every
 * stage attempt is recorded as one run so the bests can read it back.
 */

import type { EnemyId } from '@dojo/shared';
import { RESPAWN_DELAY, createArenaState, stepArena } from './arena';
import type { ArenaState } from './arena';
import { CANVAS } from './constants';
import { createEnemy, stepEnemy, stepProjectile } from './enemies';
import type { Enemy, Projectile } from './enemies';
import { FEEDBACK, LAND_SQUASH_TIME, computeStretch, createEdgeCarry, createJuice } from './juice';
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
import { formatClock } from './clock';
import { createStageState, startStage, stepStage } from './stages';
import type { StageDef, StageState } from './stages';
import { recordRun } from '../storage/recordRun';
import type { GameSession, OverlayControls } from './session';
import { OVERLAY_LOCKOUT_SECONDS, tickDown } from './session';
import type { InputFrame, Vec2, World } from './types';

/**
 * The arena floor. Exported because the boss fight stands on the same one.
 * @internal exported for the boss session and the tests
 */
export const FLOOR_Y = 600;
/**
 * Where the Knight starts every stage and every checkpoint restart. Left of
 * centre, so the enemies always spawn on the far right of her. The floor is
 * flat now, so nothing overhangs it — but the value still matters, because
 * spawnX() picks the far wall by comparing against the canvas mid-point.
 * @internal exported for the tests
 */
export const PLAYER_SPAWN_X = 450;
/** Seconds the "Stage clear" banner hangs before the next stage steps in (Z skips it). */
export const STAGE_CLEAR_BANNER_SECONDS = 2;

/**
 * What the stages are: the Colosseum's roster (one enemy each; runs are
 * plain arena runs) or the finale's waves (runs carry `wave` = index + 1,
 * and the HUD says "wave 2 of 3"). When omitted it is inferred: any stage
 * with more than one enemy means waves.
 */
export type ArenaKind = 'roster' | 'waves';

export interface ArenaSessionConfig extends OverlayControls {
  stages: readonly StageDef[];
  /** Stage to begin at (resume); clamped into range. Default 0. */
  startIndex?: number;
  comfort: ComfortSettings;
  /**
   * DEV TOOL: remove in the final build. Observe mode: the nail is a feather
   * — no damage, hits don't count, so a stage can never be cleared. Out of
   * the progression entirely (runs are still recorded, flagged observeMode).
   */
  observe?: boolean;
  kind?: ArenaKind;
  /** Fires once per stage passed (never in observe mode), after the run is recorded. */
  onStageCleared?: (index: number) => void;
  /** Fires once, when the last stage is passed, right after its onStageCleared. */
  onAllCleared?: () => void;
  /**
   * Fires whenever a stage is loaded — at construction, on the restart
   * after a touch, on the auto-advance, and on the replay from the top —
   * so the page's strip always points at the stage the canvas is on.
   */
  onStageStarted?: (index: number) => void;
  /** Fires once per touch (never in observe mode), after the run is recorded. */
  onStageFailed?: (index: number) => void;
}

/**
 * The stage's floor and two walls. Flat, everywhere — the Colosseum's two
 * ledges are gone (playtest 3, note 7: she never used them and they broke up
 * a fight that reads better as one open floor).
 *
 * The ledge-avoidance behaviour in this module's enemies is deliberately
 * KEPT: stepWalker's edge turn, the flier's SIDESTEP_REACH and flyToward's
 * sidestep have no geometry to act on here any more, but they are still
 * covered by the hand-built platform worlds in the tests, and any future
 * arena with a platform in it needs them back working on day one.
 *
 * @internal exported for the tests
 */
export function arenaWorld(): World {
  return {
    solids: [
      { x: -200, y: FLOOR_Y, width: CANVAS.width + 400, height: 200 },
      { x: -32, y: -400, width: 32, height: CANVAS.height + 400 },
      { x: CANVAS.width, y: -400, width: 32, height: CANVAS.height + 400 },
    ],
  };
}

/** Airborne enemies spawn at hover height; the rest on the floor. */
function spawnHeight(id: EnemyId): number {
  return id === 'flier' || id === 'spitter' ? 430 : FLOOR_Y;
}

/**
 * Where slot `index` of `count` enemies appears: on the far side from the
 * Knight, the slots stepping back toward the middle so a pair never lands
 * on top of each other.
 * @internal exported for the tests
 */
export function spawnX(index: number, awayFromX: number): number {
  const farSide = awayFromX < CANVAS.width / 2 ? CANVAS.width - 300 : 300;
  const inward = farSide < CANVAS.width / 2 ? 1 : -1;
  return farSide + inward * index * 170;
}

function spawnEnemy(id: EnemyId, index: number, awayFromX: number): Enemy {
  return createEnemy(id, spawnX(index, awayFromX), spawnHeight(id));
}

function describeTime(seconds: number): string {
  return seconds === 60 ? 'a minute' : `${seconds} seconds`;
}

export function createDodgeArenaSession(config: ArenaSessionConfig): GameSession {
  const { stages, comfort, onNext, nextLabel, jumpKey = 'Z', attackKey = 'X' } = config;
  if (stages.length === 0) throw new Error('createDodgeArenaSession: no stages');
  const observe = config.observe ?? false;
  const kind: ArenaKind =
    config.kind ?? (stages.some((s) => s.enemies.length > 1) ? 'waves' : 'roster');
  const world = arenaWorld();
  const juice = createJuice(comfort);
  const edgeCarry = createEdgeCarry();

  let stageIndex = Math.min(Math.max(0, Math.floor(config.startIndex ?? 0)), stages.length - 1);
  let def: StageDef = stages[stageIndex]!;
  let stage: StageState = createStageState();
  let player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
  let enemies: Enemy[] = [];
  let arena: ArenaState = createArenaState(observe);
  let projectiles: Projectile[] = [];
  let prevFeet: Vec2 = { ...player.position };
  let prevEnemyFeet: Vec2[] = [];
  let simTime = 0;
  let startedAtIso = '';
  let hitFlash = 0;
  let landSquash = 0;
  let bannerTimer = 0;
  /** Seconds a fail/all-cleared screen still ignores both keys. See OVERLAY_LOCKOUT_SECONDS. */
  let overlayLockout = 0;
  let allCleared = false;
  let wasGrounded = false;

  /** Fresh attempt at stage `index` — the Knight and the enemies reset. */
  function loadStage(index: number): void {
    stageIndex = index;
    def = stages[index]!;
    stage = createStageState();
    player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
    enemies = def.enemies.map((id, i) => spawnEnemy(id, i, PLAYER_SPAWN_X));
    arena = createArenaState(observe);
    projectiles = [];
    prevFeet = { ...player.position };
    prevEnemyFeet = enemies.map((e) => ({ ...e.position }));
    hitFlash = 0;
    landSquash = 0;
    bannerTimer = 0;
    overlayLockout = 0;
    allCleared = false;
    wasGrounded = false;
    startedAtIso = '';
    config.onStageStarted?.(index);
  }

  /** The goal the stage rule checks — unreachable in observe mode, by construction. */
  function goal(): StageDef {
    return observe ? { ...def, hitsRequired: Number.POSITIVE_INFINITY } : def;
  }

  function record(cleared: boolean): void {
    recordRun({
      mode: 'dodge',
      enemyId: def.enemies[0],
      wave: kind === 'waves' ? stageIndex + 1 : undefined,
      cleared,
      observeMode: observe || undefined,
      hitsLanded: stage.hits,
      durationMs: Math.round(stage.elapsed * 1000),
      startedAt: startedAtIso || new Date().toISOString(),
    });
  }

  function advance(): void {
    if (stageIndex + 1 < stages.length) loadStage(stageIndex + 1);
  }

  /** "the flier" / "wave 2" — what she is facing, for the overlays. */
  function foe(): string {
    return kind === 'waves' ? `wave ${stageIndex + 1}` : `the ${def.label.toLowerCase()}`;
  }

  /** "stage 2 of 5 — the flier" / "wave 2 of 3 — duelist + spitter". */
  function stageTitle(): string {
    const noun = kind === 'waves' ? 'wave' : 'stage';
    const who = kind === 'waves' ? def.label : `the ${def.label.toLowerCase()}`;
    return `${noun} ${stageIndex + 1} of ${stages.length} — ${who}`;
  }

  loadStage(stageIndex);

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

      // The overlays read the RAW press for BOTH keys: a reflexive X inside
      // the death hit-stop must not be carried across the freeze and restart
      // the stage before she has seen "Got you." (merge() above has drained
      // the carry, so reading rawInput here inherits that protection).
      //
      // Z = forward, X = again, on every screen (playtest 3, note 11).
      if (allCleared) {
        overlayLockout = tickDown(overlayLockout, dt);
        if (overlayLockout <= 0) {
          // Replaying from the top is practice; the clears are already kept.
          if (rawInput.attackPressed) loadStage(0);
          else if (rawInput.jumpPressed && onNext) onNext();
        }
        return;
      }
      if (stage.status === 'cleared') {
        // X is deliberately NOT "again" here: this banner expires on its own,
        // and replaying the stage she just passed would fire onStageCleared
        // twice for one index and record a second run. Z skips the wait.
        bannerTimer -= dt;
        if (rawInput.jumpPressed || bannerTimer <= 0) advance();
        return;
      }
      if (stage.status === 'failed') {
        // Both keys retry. There is no forward from a stage she just failed,
        // and a dead Z would read as broken after two playtests of it
        // restarting the stage.
        //
        // No lockout here: FEEDBACK.playerHit.hitStop is 0.15 s, and the
        // frozen branch above already swallows a reflex press. The clear
        // screens need one because their hit-stop is zero.
        if (rawInput.attackPressed || rawInput.jumpPressed) {
          loadStage(stageIndex); // the same stage, never the first
        }
        return;
      }

      if (stage.status === 'ready') {
        const anyInput =
          input.left ||
          input.right ||
          input.jumpPressed ||
          input.dashPressed ||
          input.attackPressed;
        if (anyInput) {
          startStage(stage);
          arena.started = true;
          startedAtIso = new Date().toISOString();
        }
      }

      prevFeet.x = player.position.x;
      prevFeet.y = player.position.y;
      enemies.forEach((e, i) => {
        const prev = prevEnemyFeet[i];
        if (prev) {
          prev.x = e.position.x;
          prev.y = e.position.y;
        }
      });

      const pogosBefore = player.totalPogos;
      stepPlayer(player, input, world, dt);
      if (!wasGrounded && player.grounded) landSquash = LAND_SQUASH_TIME;
      wasGrounded = player.grounded;
      // The enemies hold still until the stage starts — nobody gets shelled
      // while reading the instructions.
      if (stage.status === 'running') {
        const target = { position: player.position, grounded: player.grounded };
        for (const enemy of enemies) {
          const shots = stepEnemy(enemy, world, dt, target);
          if (shots) projectiles.push(...shots);
        }
        for (const shot of projectiles) stepProjectile(shot, world, dt);
      }

      const events = stepArena(arena, player, enemies, dt, projectiles);
      projectiles = projectiles.filter((s) => !s.dead);
      if (player.totalPogos > pogosBefore) {
        juice.addTrauma(FEEDBACK.pogo.trauma);
        juice.hitStop(FEEDBACK.pogo.hitStop);
      }
      if (events.nailLanded) {
        juice.addTrauma(FEEDBACK.nailHit.trauma);
        juice.hitStop(FEEDBACK.nailHit.hitStop);
      }
      if (events.enemyDied) {
        juice.addTrauma(FEEDBACK.enemyDeath.trauma);
        juice.hitStop(FEEDBACK.enemyDeath.hitStop);
      }
      for (const slot of events.respawn) {
        const id = def.enemies[slot];
        if (id === undefined) continue;
        enemies[slot] = spawnEnemy(id, slot, player.position.x);
        prevEnemyFeet[slot] = { ...enemies[slot].position };
      }

      const outcome = stepStage(
        stage,
        goal(),
        { playerHit: events.playerHit, nailLanded: events.nailLanded, hits: events.hits },
        dt,
      );
      if (outcome === 'failed') {
        hitFlash = 0.5;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
        juice.hitStop(FEEDBACK.playerHit.hitStop);
        record(false);
        if (!observe) config.onStageFailed?.(stageIndex);
      } else if (outcome === 'cleared') {
        juice.addTrauma(FEEDBACK.courseClear.trauma);
        record(true);
        const cleared = stageIndex;
        // Observe mode can't get here (the goal is unreachable); the guard
        // keeps it out of the progression even if that ever changes.
        if (!observe) config.onStageCleared?.(cleared);
        if (cleared + 1 >= stages.length) {
          allCleared = true;
          overlayLockout = OVERLAY_LOCKOUT_SECONDS;
          if (!observe) config.onAllCleared?.();
        } else {
          bannerTimer = STAGE_CLEAR_BANNER_SECONDS;
        }
      }
    },

    render(ctx: CanvasRenderingContext2D, alpha: number): void {
      const feet = lerpVec(prevFeet, player.position, alpha);
      const shake = juice.shakeOffset(simTime);

      clearCanvas(ctx, CANVAS.width, CANVAS.height);
      ctx.save();
      // Shake moves the CAMERA, never the simulated bodies.
      ctx.translate(shake.x, shake.y);
      drawWorld(ctx, world);

      enemies.forEach((enemy, i) => {
        const enemyFeet = lerpVec(prevEnemyFeet[i] ?? enemy.position, enemy.position, alpha);
        const deathFade = enemy.dead
          ? 1 - Math.max(0, arena.respawnTimers[i] ?? 0) / RESPAWN_DELAY
          : 0;
        drawEnemy(ctx, enemyFeet, enemy, simTime, deathFade);
      });
      drawProjectiles(ctx, projectiles);
      drawNailSlash(ctx, feet, player);
      drawKnight(ctx, feet, player, computeStretch(player.velocity.y, landSquash));
      ctx.restore();

      // --- HUD ---
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(`${formatClock(stage.elapsed)} / ${formatClock(def.surviveSeconds)}`, 16, 14);
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(
        observe ? 'observe — feather nail, no clears' : `hits ${stage.hits} / ${def.hitsRequired}`,
        16,
        36,
      );
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(observe ? `${stageTitle()} · observe` : stageTitle(), CANVAS.width - 16, 14);

      if (stage.status === 'ready') {
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText(
          observe
            ? 'Observe mode: your nail is a feather. Just watch, dodge, and survive.'
            : `Survive ${describeTime(def.surviveSeconds)} and land ${def.hitsRequired} hits. Get touched, and you start this one over.`,
          CANVAS.width / 2,
          96,
        );
      }

      if (hitFlash > 0) {
        // Reduce-flashing swaps the bright white pulse for a gentle darkening.
        ctx.fillStyle = comfort.reduceFlashing
          ? `rgba(7, 9, 18, ${0.3 * (hitFlash / 0.5)})`
          : `rgba(233, 228, 213, ${0.35 * (hitFlash / 0.5)})`;
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
      }

      if (allCleared) {
        ctx.fillStyle = 'rgba(7, 9, 18, 0.78)';
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText(
          kind === 'waves' ? 'Waves cleared, Kayla!' : 'Colosseum cleared, Kayla!',
          CANVAS.width / 2,
          CANVAS.height / 2 - 70,
        );
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          kind === 'waves'
            ? 'Every wave, survived and hit back.'
            : 'Every enemy, survived and hit back.',
          CANVAS.width / 2,
          CANVAS.height / 2 - 24,
        );
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText(
          onNext
            ? `Press ${jumpKey} for ${nextLabel ?? 'the next stop'} · ${attackKey} to run it again from the top.`
            : `Press ${attackKey} to run it again from the top.`,
          CANVAS.width / 2,
          CANVAS.height / 2 + 24,
        );
      } else if (stage.status === 'cleared') {
        ctx.fillStyle = 'rgba(7, 9, 18, 0.55)';
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText(
          kind === 'waves' ? 'Wave clear' : 'Stage clear',
          CANVAS.width / 2,
          CANVAS.height / 2 - 40,
        );
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          `${stage.hits} ${stage.hits === 1 ? 'hit' : 'hits'} · ${formatClock(stage.elapsed)} — next one stepping in. Press ${jumpKey} to go now.`,
          CANVAS.width / 2,
          CANVAS.height / 2 + 8,
        );
      } else if (stage.status === 'failed') {
        ctx.fillStyle = 'rgba(7, 9, 18, 0.78)';
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText('Got you.', CANVAS.width / 2, CANVAS.height / 2 - 70);
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          observe
            ? `You watched ${foe()} for ${formatClock(stage.elapsed)} — that's how fights are learned.`
            : `${stage.hits} clean ${stage.hits === 1 ? 'hit' : 'hits'} in ${formatClock(stage.elapsed)} before the one that got you.`,
          CANVAS.width / 2,
          CANVAS.height / 2 - 24,
        );
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText(
          `Press ${attackKey} to face ${foe()} again.`,
          CANVAS.width / 2,
          CANVAS.height / 2 + 24,
        );
      }
    },
  };
}
