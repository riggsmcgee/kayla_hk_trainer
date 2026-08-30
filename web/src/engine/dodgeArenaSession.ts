/**
 * Dodge Arena session — the arena as a staged game (playtest 2, note 1 +
 * the interview). A list of stages (engine/stages.ts) is played in order:
 * each is passed by surviving its time, then the next one steps in. A touch
 * restarts the SAME stage — death is a checkpoint, never the whole roster.
 * After the last stage, the page is told. Hits are counted throughout and
 * shown against her best, but they gate nothing (playtest 10).
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
  drawAssistPips,
  drawGodModeHud,
  drawKnight,
  drawNailSlash,
  drawProjectiles,
  drawWorld,
  lerpVec,
} from './render';
import { formatClock } from './clock';
import { createStageState, dueCount, startStage, stepStage } from './stages';
import type { StageDef, StageState } from './stages';
import { recordRun } from '../storage/recordRun';
import type { GameSession, OverlayControls } from './session';
import { createOverlayGate } from './session';
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

/** How long "Reinforcements." stays on screen after bodies walk in. */
export const JOIN_BANNER_SECONDS = 1.2;

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
  /**
   * DEV TOOL: remove in the final build. God mode: a touch no longer fails
   * the stage, but is still shown and counted. Unlike observe mode a stage
   * CAN still be cleared with it on, which is the point — it exists to reach
   * a stop without playing through everything before it. The run is flagged
   * so it can never become a personal best.
   */
  godMode?: boolean;
  /**
   * Assist mode: extra touches she may absorb per stage attempt before one
   * fails it. Refilled on every stage load, which is the smallest thing she
   * can retry (playtest 10).
   */
  assistLives?: number;
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
  /**
   * Her best hits against stage `index` so far, or null if she has never
   * scored there — the number the HUD shows her chasing.
   *
   * A FUNCTION, and asked rather than passed, for the same reason `jumpKey`
   * is: the session is built once and must not be rebuilt when a run is
   * recorded, because rebuilding restarts the run that produced the score.
   * The session asks at stage load rather than at draw time, so this is two
   * storage reads per attempt and not sixty a second.
   */
  bestHits?: (index: number) => number | null;
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

/**
 * The Two Bills' arena: the same floor and walls, plus a ceiling.
 *
 * The ceiling is BOSS-ONLY, and that is the whole reason this function
 * exists rather than a fourth solid in `arenaWorld()`. `arenaWorld()` is
 * shared by the Colosseum, the finale's waves and the boss, and the
 * spitter's shots currently leave the top of the screen and die there —
 * putting a lid on the shared world would silently change an enemy she has
 * already playtested. `enemies.test.ts` pins `arenaWorld()` at exactly three
 * solids for that reason.
 *
 * What the lid is for: the dog's thrown bones rebound off every surface, and
 * a bone that vanishes upward is a rebound she never gets to watch.
 *
 * @internal exported for the boss session and the tests
 */
export function bossWorld(): World {
  const world = arenaWorld();
  world.solids.push({ x: -200, y: -200, width: CANVAS.width + 400, height: 200 });
  return world;
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

/**
 * How close to the wall a body that walks in mid-fight is placed. A flier
 * bobs ±80 px horizontally (`ATTACKS.flier.bobX`) around its home and is 32
 * px wide, so 110 keeps even the far end of its bob inside the arena.
 */
export const WALL_INSET = 110;

/**
 * How far apart two bodies arriving on the SAME frame stand.
 *
 * Playtest 5, note 5 put a spitter and a warden on the same arrival, and
 * before this they landed on the identical pixel: `joinX` had no slot term,
 * so simultaneous reinforcements stacked into one silhouette. A spitter is
 * the worst case for that — unlike the flier twins, whose bob is horizontal
 * and pulls them apart on its own, a spitter only bobs vertically, so two of
 * them on one spot would read as one body forever.
 *
 * 90 px is a body and a half. It costs the second arrival 90 px of the 474 px
 * clearance floor below, which leaves 384 px — still most of the arena.
 */
export const JOIN_SPREAD = 90;

/**
 * Where an enemy that arrives mid-stage appears: hard against the wall on
 * the far side from the Knight, stepped `order` places along it.
 *
 * Deliberately NOT `spawnX`, which steps inward 170 px per slot. With a
 * third and fourth body that walks the last slot to within 56 px of her —
 * a reinforcement (or a respawn) materialising on top of her, which in a
 * one-hit mode is not a difficulty spike, it is a bug. The clearance here is
 * a floor and not an average: (1168 - 220) / 2 = 474 px, whichever half of
 * the arena she is standing in.
 *
 * `order` counts arrivals on THIS frame, not slots, so a lone reinforcement
 * is always flush against the wall exactly as before.
 * @internal exported for the tests
 */
export function joinX(awayFromX: number, order = 0): number {
  const inward = order * JOIN_SPREAD;
  return awayFromX < CANVAS.width / 2 ? CANVAS.width - WALL_INSET - inward : WALL_INSET + inward;
}

/**
 * Enemies never see each other — `stepEnemy` takes only the player — and
 * every machine is deterministic. Two fliers hunting the same Knight would
 * converge on the same home point at the same speed with the same bob and
 * become a single body. Staggering the bob phase per slot separates them
 * with no RNG and no cross-enemy awareness.
 *
 * Slot 0 stays at zero so every single-enemy stage and every lesson demo is
 * bit-identical to before.
 */
export const SLOT_PHASE_STAGGER = 1.7;

/**
 * How far apart consecutive slots want to stand, for the ground chasers that
 * have no bob to stagger.
 *
 * Not simply "wider than a walker". Each one paces inside its own
 * `ATTACKS.walker.turnSlack` dead zone of ±12 px, so the CLOSEST the pair ever
 * comes is the offset minus about 24 — and at 64 that measured 43 px, which is
 * narrower than the 44 px body and so still one silhouette at the tightest
 * point of the dance. 100 leaves roughly 30 px of daylight even then.
 */
export const SLOT_OFFSET_PX = 100;

/**
 * Where slot `index` wants to stand relative to the Knight: 0, +100, −100,
 * +200… — alternating sides so they flank her rather than queueing up on one
 * shoulder, and slot 0 always exactly on her, so every single-enemy stage and
 * every lesson demo behaves precisely as it did before.
 * @internal exported for the tests
 */
export function slotOffsetX(index: number): number {
  if (index <= 0) return 0; // and not -0, which is a real value in a test
  const pair = Math.ceil(index / 2);
  const side = index % 2 === 1 ? 1 : -1;
  return pair * side * SLOT_OFFSET_PX;
}

function spawnEnemy(id: EnemyId, index: number, awayFromX: number): Enemy {
  return placeEnemy(createEnemy(id, spawnX(index, awayFromX), spawnHeight(id)), index);
}

/** A reinforcement or a respawn: same body, placed at the wall instead of a slot. */
function joinEnemy(id: EnemyId, index: number, awayFromX: number, order = 0): Enemy {
  return placeEnemy(createEnemy(id, joinX(awayFromX, order), spawnHeight(id)), index);
}

function placeEnemy(enemy: Enemy, index: number): Enemy {
  enemy.bobPhase = index * SLOT_PHASE_STAGGER;
  enemy.slotOffsetX = slotOffsetX(index);
  return enemy;
}

function describeTime(seconds: number): string {
  return seconds === 60 ? 'a minute' : `${seconds} seconds`;
}

/**
 * A GameSession plus the one thing the wave tests have to see from outside:
 * how many bodies are in the arena right now.
 *
 * Deliberately a WIDER type rather than a wider `GameSession` — the pogo
 * course implements that interface too and has no enemies to count. Every
 * caller still holds a GameSession, so nothing else changes.
 */
export interface ArenaSession extends GameSession {
  /** Live bodies in the arena, dead-but-respawning included. @internal for the tests */
  enemyCount(): number;
  /**
   * The arena's own enemy array — the tests kill a body in a known slot and
   * watch what walks back in. @internal for the tests
   */
  debugEnemies(): readonly Enemy[];
}

export function createDodgeArenaSession(config: ArenaSessionConfig): ArenaSession {
  const { stages, comfort, onNext, nextLabel, jumpKey = () => 'Z', attackKey = () => 'X' } = config;
  if (stages.length === 0) throw new Error('createDodgeArenaSession: no stages');
  const observe = config.observe ?? false;
  const godMode = config.godMode ?? false;
  const assistLives = config.assistLives ?? 0;
  /*
   * Defaulted, never inferred. This used to read the shape of the stage list
   * — "more than one enemy on a stage means these are waves" — which was true
   * right up until playtest 10 opened the Colosseum's dummy stages with two
   * walkers. An inference like that does not fail loudly: it silently
   * relabels a roster run as wave 1, which changes what `record()` writes,
   * what the fail screen calls the enemy, and which banner the all-clear
   * shows. Every caller in the app passes `kind` explicitly; the default is
   * for tests, and 'roster' is the safe one.
   */
  const kind: ArenaKind = config.kind ?? 'roster';
  const world = arenaWorld();
  const juice = createJuice(comfort);
  const edgeCarry = createEdgeCarry();

  let stageIndex = Math.min(Math.max(0, Math.floor(config.startIndex ?? 0)), stages.length - 1);
  let def: StageDef = stages[stageIndex]!;
  let stage: StageState = createStageState();
  let player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
  let enemies: Enemy[] = [];
  let arena: ArenaState = createArenaState(observe, godMode, assistLives);
  let projectiles: Projectile[] = [];
  let prevFeet: Vec2 = { ...player.position };
  let prevEnemyFeet: Vec2[] = [];
  let simTime = 0;
  let startedAtIso = '';
  let hitFlash = 0;
  /** God mode: hits she did not take on this stage, and the toast that says so. */
  let phantomHits = 0;
  let godToast = 0;
  /** Her best hits on the stage being played, cached at load and after each run. */
  let bestHits: number | null = null;
  let landSquash = 0;
  const clearGate = createOverlayGate();
  const failGate = createOverlayGate();
  const allClearedGate = createOverlayGate();
  /** How many of this stage's reinforcements have actually walked in. */
  let joined = 0;
  /** Seconds the "Reinforcements." line stays up after an arrival. */
  let joinBanner = 0;

  let allCleared = false;
  let wasGrounded = false;

  /** Fresh attempt at stage `index` — the Knight and the enemies reset. */
  function loadStage(index: number): void {
    stageIndex = index;
    def = stages[index]!;
    stage = createStageState();
    player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
    enemies = def.enemies.map((id, i) => spawnEnemy(id, i, PLAYER_SPAWN_X));
    // A fresh set of lives: the stage is the retry unit, so it is the refill
    // unit too.
    arena = createArenaState(observe, godMode, assistLives);
    projectiles = [];
    prevFeet = { ...player.position };
    prevEnemyFeet = enemies.map((e) => ({ ...e.position }));
    hitFlash = 0;
    phantomHits = 0;
    godToast = 0;
    bestHits = config.bestHits?.(index) ?? null;
    landSquash = 0;
    joined = 0;
    joinBanner = 0;
    allCleared = false;
    wasGrounded = false;
    startedAtIso = '';
    config.onStageStarted?.(index);
  }

  /**
   * The goal the stage rule checks — unreachable in observe mode, by
   * construction.
   *
   * Observe mode used to be built on an infinite hits requirement, which was
   * elegant while hits were the gate and became nothing at all the moment
   * playtest 10 removed them: without this, a thirty-second observe run would
   * quietly CLEAR the stage. The clock is the only gate left, so the clock is
   * what has to be out of reach. Note the HUD deliberately reads the real
   * `def` rather than this one, so it still prints "0:30" and not "Infinity".
   */
  function goal(): StageDef {
    return observe ? { ...def, surviveSeconds: Number.POSITIVE_INFINITY } : def;
  }

  function record(cleared: boolean): void {
    recordRun({
      mode: 'dodge',
      enemyId: def.enemies[0],
      wave: kind === 'waves' ? stageIndex + 1 : undefined,
      cleared,
      observeMode: observe || undefined,
      godMode: godMode || undefined,
      assisted: assistLives > 0 || undefined,
      hitsLanded: stage.hits,
      durationMs: Math.round(stage.elapsed * 1000),
      startedAt: startedAtIso || new Date().toISOString(),
    });
  }

  function advance(): void {
    if (stageIndex + 1 < stages.length) loadStage(stageIndex + 1);
  }

  /**
   * Walk in whoever the schedule says is overdue (playtest 4, note 3).
   *
   * `dueCount` is monotone and `joined` counts who actually arrived, so
   * spawning the difference can neither double-spawn nor skip an arrival —
   * and a checkpoint reload, which resets `joined` to zero with the stage
   * clock, starts the schedule over for free.
   *
   * The cap CONSUMES rather than defers: a slot that is full when a body is
   * due burns that arrival. A wave whose data respects ARENA_MAX_ALIVE can
   * never hit it (stages.test.ts pins that as an invariant); the guard is
   * here so a future wave that gets it wrong drops an enemy instead of
   * quietly filling the arena forever.
   */
  function joinDue(): void {
    const cap = def.maxAlive ?? def.enemies.length;
    // Everything this loop admits arrives on the same frame, so the count is
    // what keeps two of them off the same pixel.
    let arrivals = 0;
    while (joined < dueCount(def, stage.elapsed)) {
      const id = def.reinforcements?.[joined]?.id;
      joined += 1;
      if (id === undefined || enemies.length >= cap) continue;
      const slot = enemies.length;
      enemies.push(joinEnemy(id, slot, player.position.x, arrivals));
      arrivals += 1;
      prevEnemyFeet.push({ ...enemies[slot]!.position });
      juice.addTrauma(FEEDBACK.enemyDeath.trauma);
      joinBanner = JOIN_BANNER_SECONDS;
    }
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
    enemyCount(): number {
      return enemies.length;
    },

    debugEnemies(): readonly Enemy[] {
      return enemies;
    },

    step(rawInput: InputFrame, dt: number): void {
      simTime += dt;
      juice.update(dt);
      if (juice.frozen()) {
        edgeCarry.absorb(rawInput);
        return;
      }
      const input = edgeCarry.merge(rawInput);
      hitFlash = Math.max(0, hitFlash - dt);
      godToast = Math.max(0, godToast - dt);
      landSquash = Math.max(0, landSquash - dt);

      // The overlays read the RAW press for BOTH keys: a reflexive X inside
      // the death hit-stop must not be carried across the freeze and restart
      // the stage before she has seen "Got you." (merge() above has drained
      // the carry, so reading rawInput here inherits that protection).
      //
      // Z = forward, X = again, on every screen (playtest 3, note 11).
      if (allCleared) {
        const pressing = rawInput.attackPressed || rawInput.jumpPressed;
        if (allClearedGate.open(dt, pressing)) {
          // Replaying from the top is practice; the clears are already kept.
          if (rawInput.attackPressed) loadStage(0);
          else if (rawInput.jumpPressed && onNext) onNext();
        }
        return;
      }
      if (stage.status === 'cleared') {
        // X is deliberately NOT "again" here: replaying the stage she just
        // passed would fire onStageCleared twice for one index and record a
        // second run. Z is the only way on.
        //
        // The 2 s auto-advance this screen used to have is DELETED (playtest
        // 5, note 4): it was the purest form of the complaint, a screen that
        // moved on with no input from her at all.
        const pressing = rawInput.attackPressed || rawInput.jumpPressed;
        if (clearGate.open(dt, pressing) && rawInput.jumpPressed) advance();
        return;
      }
      if (stage.status === 'failed') {
        // Both keys retry. There is no forward from a stage she just failed,
        // and a dead Z would read as broken after two playtests of it
        // restarting the stage.
        const pressing = rawInput.attackPressed || rawInput.jumpPressed;
        if (failGate.open(dt, pressing) && pressing) {
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
      if (events.wouldHaveHit) {
        // Trauma but no hit-stop: she is being told, not interrupted. A
        // freeze on a hit that costs nothing only gets in the way of testing.
        phantomHits += 1;
        godToast = 1.1;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
      }
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
        // The id comes off the DEAD BODY in the slot, not off `def.enemies`
        // — `def.enemies` is only the OPENING cast, so reading it here meant
        // a reinforcement that died never came back. It walks in at the
        // wall, the same read as an arrival: "one steps back in from over
        // there".
        const dead = enemies[slot];
        if (!dead) continue;
        enemies[slot] = joinEnemy(dead.id, slot, player.position.x);
        prevEnemyFeet[slot] = { ...enemies[slot].position };
      }

      const outcome = stepStage(
        stage,
        goal(),
        { playerHit: events.playerHit, nailLanded: events.nailLanded, hits: events.hits },
        dt,
      );
      if (outcome === 'failed') {
        failGate.arm();
        hitFlash = 0.5;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
        juice.hitStop(FEEDBACK.playerHit.hitStop);
        record(false);
        // Re-read AFTER recording, so a run that just set the high score sees
        // its own number on the screen that follows it.
        bestHits = config.bestHits?.(stageIndex) ?? null;
        if (!observe) config.onStageFailed?.(stageIndex);
      } else if (outcome === 'cleared') {
        juice.addTrauma(FEEDBACK.courseClear.trauma);
        record(true);
        bestHits = config.bestHits?.(stageIndex) ?? null;
        const cleared = stageIndex;
        // Observe mode can't get here (the goal is unreachable); the guard
        // keeps it out of the progression even if that ever changes.
        if (!observe) config.onStageCleared?.(cleared);
        if (cleared + 1 >= stages.length) {
          allCleared = true;
          allClearedGate.arm();
          if (!observe) config.onAllCleared?.();
        } else {
          clearGate.arm();
        }
      }

      // Reinforcements are read AFTER stepStage, deliberately and in this
      // order: `stage.elapsed` only advances inside stepStage, a newcomer
      // must not be stepped or collided with on the frame it appears, and a
      // stage that cleared or failed on this very step must not gain a body.
      joinBanner = Math.max(0, joinBanner - dt);
      if (stage.status === 'running') joinDue();
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
        observe
          ? 'observe — feather nail, no clears'
          : `hits ${stage.hits} · best ${bestHits ?? '—'}`,
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
            : `Survive ${describeTime(def.surviveSeconds)}. Get touched, and you start this one over.`,
          CANVAS.width / 2,
          96,
        );
      }

      if (joinBanner > 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '26px system-ui, sans-serif';
        ctx.globalAlpha = Math.min(1, joinBanner / 0.4);
        ctx.fillText('Reinforcements.', CANVAS.width / 2, 140);
        ctx.globalAlpha = 1;
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
            ? `Press ${jumpKey()} for ${nextLabel ?? 'the next stop'} · ${attackKey()} to run it again from the top.`
            : `Press ${attackKey()} to run it again from the top.`,
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
          `${stage.hits} ${stage.hits === 1 ? 'hit' : 'hits'} · ${formatClock(stage.elapsed)} — press ${jumpKey()} for the next one.`,
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
          `Press ${attackKey()} to face ${foe()} again.`,
          CANVAS.width / 2,
          CANVAS.height / 2 + 24,
        );
      }

      // Last, so it survives the clear and fail washes above — a badge you
      // cannot see on the very screenshot you are taking is no safeguard.
      drawAssistPips(ctx, assistLives, arena.assistLivesLeft, CANVAS.height - 40);
      if (godMode) drawGodModeHud(ctx, phantomHits, godToast, comfort.reduceFlashing);
    },
  };
}
