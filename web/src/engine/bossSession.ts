/**
 * The Two Bills — the boss session at the bottom of the well.
 *
 * A survival clock, not a kill. Neither Bill can be damaged, one touch ends
 * the run, and the score is time survived; 1:30 marks the stop done and the
 * fight keeps escalating past it for a better time.
 *
 * This is its own session rather than a mode on `createDodgeArenaSession`,
 * which is a `stages[]` driver end to end and would fork about ten branches
 * for a fight that shares none of its rules. What IS reused is every piece
 * underneath: the same arena floor, the same juice and edge-carry, the same
 * player, the same `stepArena`, the same draw helpers. The fight's clock and
 * its three thresholds live in engine/boss.ts; this file is the wiring.
 */

import { BOSS, createBossState, skipCard, startBoss, stepBoss, stepIntro } from './boss';
import {
  INTRO_FAST_FORWARD,
  arrivalX,
  billEntrance,
  dogArrivalT,
  entranceSeconds,
  stepEntrance,
} from './entrance';
import { dogLook } from './dogLook';
import type { EntranceShape } from './entrance';
import { createArenaState, stepArena } from './arena';
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
  drawGodModeHud,
  drawKnight,
  drawNailSlash,
  drawProjectiles,
  drawWorld,
  lerpVec,
} from './render';
import { formatClock } from './clock';
import { FLOOR_Y, PLAYER_SPAWN_X, bossWorld } from './dodgeArenaSession';
import { recordRun } from '../storage/recordRun';
import { createOverlayGate } from './session';
import type { GameSession, OverlayControls } from './session';
import type { InputFrame, Vec2 } from './types';

/** Where Bill the man is waiting when she walks in. */
const BILL_SPAWN_X = CANVAS.width - 300;
/**
 * Where Bill stands before his entrance begins: past the right edge with his
 * whole 68 px body clear of it.
 *
 * Ratified in playtest 4: he is NOT on screen when the beat opens. The arena
 * is empty but for the Knight, the thumps land while he is still out of
 * frame, and he enters from the RIGHT — the far side from her spawn, and the
 * same side the dog already walks in from, so the well keeps a consistent
 * "they come from over there" geography.
 */
const BILL_OFFSTAGE_X = CANVAS.width + 80;

/** Where the dog stops after walking in, measured from the wall he came through. */
const DOG_WALK_IN_INSET = 200;

export interface BossSessionConfig extends OverlayControls {
  comfort: ComfortSettings;
  /**
   * True once she has already survived 1:30. The HUD then drops the target
   * and shows a bare clock: past that point the fight is about her best time.
   */
  cleared?: boolean;
  /**
   * DEV TOOL: remove in the final build. God mode: neither Bill can touch
   * her, so the clock only stops when she leaves. The run is flagged so a
   * fight nothing could end never becomes her best time.
   */
  godMode?: boolean;
  /**
   * DEV TOOL: remove in the final build. Which of ROLL_VARIANTS the dog
   * rolls with. Defaults to the first.
   */
  rollVariant?: number;
  /**
   * DEV TOOL: remove in the final build. Which of BILL_ENTRANCES plays
   * before the fight. Defaults to the first.
   */
  entranceVariant?: number;
  /**
   * DEV TOOL: remove in the final build. Which of DOG_LOOKS the ball and the
   * bones wear. Defaults to the first.
   */
  dogLook?: number;
  /** Fires live at the 1:30 crossing, not at the end of the run. */
  onPassed?: () => void;
  /** Fires once per touch, after the run is recorded. */
  onFailed?: () => void;
}

function pressedAnything(input: InputFrame): boolean {
  return input.left || input.right || input.jumpPressed || input.dashPressed || input.attackPressed;
}

export function createBossSession(config: BossSessionConfig): GameSession {
  const { comfort, jumpKey = 'Z', attackKey = 'X', onNext, nextLabel } = config;
  const godMode = config.godMode ?? false;
  const world = bossWorld();
  /** Which entrance plays, and how long it runs at normal speed. */
  const entrance = billEntrance(config.entranceVariant ?? 0);
  /** Which hazard markers the dog's ball and bones wear. */
  const look = dogLook(config.dogLook ?? 0);
  const INTRO_SECONDS = entranceSeconds(entrance);
  const juice = createJuice(comfort);
  const edgeCarry = createEdgeCarry();

  let boss = createBossState();
  let arena = createArenaState(false, godMode);
  let player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
  let bill = createEnemy('bill', BILL_OFFSTAGE_X, FLOOR_Y);
  /** Null until 0:30. */
  let dog: Enemy | null = null;
  /** Where the dog is heading while his card is up, and how fast. */
  let dogWalkTo = 0;
  let dogWalkFrom = 0;
  /** 0 → 1 across the dog’s card; the variant’s curve shapes the walk. */
  let dogWalkT = 0;
  let projectiles: Projectile[] = [];

  let simTime = 0;
  let hitFlash = 0;
  /** God mode: hits she did not take this run, and the toast that says so. */
  let phantomHits = 0;
  let godToast = 0;
  let landSquash = 0;
  let wasGrounded = true;
  const overGate = createOverlayGate();
  let startedAtIso = '';

  const prevFeet: Vec2 = { ...player.position };
  const prevBillFeet: Vec2 = { ...bill.position };
  const prevDogFeet: Vec2 = { x: 0, y: 0 };

  function restart(): void {
    overGate.arm();
    boss = createBossState();
    arena = createArenaState(false, godMode);
    player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
    bill = createEnemy('bill', BILL_OFFSTAGE_X, FLOOR_Y);
    dog = null;
    projectiles = [];
    hitFlash = 0;
    phantomHits = 0;
    godToast = 0;
    startedAtIso = '';
    prevFeet.x = player.position.x;
    prevFeet.y = player.position.y;
    prevBillFeet.x = bill.position.x;
    prevBillFeet.y = bill.position.y;
  }

  /**
   * The dog comes in through the wall she is furthest from, so he never
   * appears on top of her, and walks to his mark over the length of his card.
   * His position is set directly rather than drifted: he starts outside the
   * arena wall, and `drift` correctly refuses to walk a body through geometry.
   */
  function bringInTheDog(): void {
    const fromRight = player.position.x < CANVAS.width / 2;
    const startX = fromRight ? CANVAS.width + 80 : -80;
    dogWalkTo = fromRight ? CANVAS.width - DOG_WALK_IN_INSET : DOG_WALK_IN_INSET;
    dogWalkFrom = startX;
    dogWalkT = 0;
    dog = createEnemy('dog', startX, FLOOR_Y);
    dog.rollVariantIndex = config.rollVariant ?? 0;
    dog.facing = fromRight ? -1 : 1;
    prevDogFeet.x = startX;
    prevDogFeet.y = FLOOR_Y;
  }

  function walkTheDogIn(dt: number): void {
    if (!dog) return;
    dogWalkT = Math.min(1, dogWalkT + dt / BOSS.cardSeconds);
    // Stepped like everything else the Bills do: the curve shapes the pace,
    // and the result lands on a whole 4 px step from his mark.
    dog.position.x = arrivalX(dogWalkFrom, dogWalkTo, dogArrivalT(entrance, dogWalkT));
  }

  function record(): void {
    // No enemyId and no wave, deliberately: that is what keeps arenaBest and
    // waveBest from ever picking a boss run up as one of theirs.
    recordRun({
      mode: 'dodge',
      boss: true,
      godMode: godMode || undefined,
      cleared: boss.passed,
      hitsLanded: 0,
      durationMs: Math.round(boss.elapsed * 1000),
      startedAt: startedAtIso || new Date().toISOString(),
    });
  }

  /** Both Bills, in list order, for the loops that treat them the same. */
  function bills(): Enemy[] {
    return dog && boss.dogIn ? [bill, dog] : [bill];
  }

  return {
    step(rawInput: InputFrame, dt: number): void {
      simTime += dt;
      juice.update(dt);
      if (juice.frozen()) {
        edgeCarry.absorb(rawInput);
        return;
      }

      // Bill's entrance (playtest 4, note 4). Everything holds — the fight's
      // clock has not started and the Knight cannot move, so the beat costs
      // her nothing. Holding jump does NOT skip it; it runs it at 2.5x, so
      // an impatient twentieth attempt still gets the theatre, briefly.
      //
      // The raw frame is read and the carry is neither absorbed nor merged,
      // for the same reason the card branch does it: the hold that
      // fast-forwarded the intro must not also arrive as a jump on the
      // fight's first frame.
      if (boss.phase === 'intro') {
        const rate = rawInput.jumpHeld || rawInput.jumpPressed ? INTRO_FAST_FORWARD : 1;
        const before = boss.introElapsed;
        stepIntro(boss, INTRO_SECONDS, dt * rate);
        const beat = stepEntrance(entrance, before, boss.introElapsed);
        if (beat.thumped) juice.addTrauma(FEEDBACK.enemyDeath.trauma);
        bill.position.x =
          beat.beat === 'thumps'
            ? BILL_OFFSTAGE_X
            : arrivalX(
                BILL_OFFSTAGE_X,
                BILL_SPAWN_X,
                beat.beat === 'arrival' ? beat.progress : 1,
                entrance.style,
              );
        return;
      }

      // The card. Everything holds, including the clock, and any key skips.
      //
      // The raw frame is read and the carry is NEITHER absorbed nor merged:
      // the press that dismisses the card must not also arrive as a jump on
      // the fight's first frame. That is verbatim the bug playtest 2 fixed.
      if (boss.phase === 'card') {
        if (pressedAnything(rawInput)) skipCard(boss);
        // It also fast-forwards, like Bill's entrance. Two mechanisms on one
        // overlay is untidy, and the tidy version costs her a fight: this one
        // interrupts a run already in progress and she may be mid-panic, so
        // the instant out stays.
        const cardDt = rawInput.jumpHeld ? dt * INTRO_FAST_FORWARD : dt;
        walkTheDogIn(cardDt);
        stepBoss(boss, { playerHit: false }, cardDt);
        if (boss.phase !== 'card' && dog) dog.position.x = dogWalkTo;
        return;
      }

      // Both keys retry. There is no forward from a run she just lost, and a
      // dead Z would read as broken.
      //
      // This screen used to trust the 0.15 s hit-stop to eat her reflex press
      // and had no guard of its own. It loses to a mashing thumb, so it goes
      // through the same gate as every other end screen now (playtest 5).
      if (boss.phase === 'over') {
        const pressing = rawInput.attackPressed || rawInput.jumpPressed;
        if (overGate.open(dt, pressing) && pressing) restart();
        return;
      }

      const input = edgeCarry.merge(rawInput);
      hitFlash = Math.max(0, hitFlash - dt);
      godToast = Math.max(0, godToast - dt);
      landSquash = Math.max(0, landSquash - dt);

      if (boss.phase === 'ready' && pressedAnything(input)) {
        startBoss(boss);
        arena.started = true;
        startedAtIso = new Date().toISOString();
      }

      prevFeet.x = player.position.x;
      prevFeet.y = player.position.y;
      prevBillFeet.x = bill.position.x;
      prevBillFeet.y = bill.position.y;
      if (dog) {
        prevDogFeet.x = dog.position.x;
        prevDogFeet.y = dog.position.y;
      }

      const pogosBefore = player.totalPogos;
      stepPlayer(player, input, world, dt);
      if (!wasGrounded && player.grounded) landSquash = LAND_SQUASH_TIME;
      wasGrounded = player.grounded;

      // Nobody moves until she does — reading the arena is free.
      if (boss.phase === 'fighting') {
        const target = { position: player.position, grounded: player.grounded };
        for (const enemy of bills()) {
          const shots = stepEnemy(enemy, world, dt, target);
          if (shots) projectiles.push(...shots);
        }
        for (const shot of projectiles) stepProjectile(shot, world, dt);
      }

      const events = stepArena(arena, player, bills(), dt, projectiles);
      projectiles = projectiles.filter((s) => !s.dead);
      if (events.wouldHaveHit) {
        // Trauma but no hit-stop: she is being told, not interrupted.
        phantomHits += 1;
        godToast = 1.1;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
      }
      // Only the pogo can fire here: the Bills never take a hit and never
      // die, so nailHit and enemyDeath have nothing to react to.
      if (player.totalPogos > pogosBefore) {
        juice.addTrauma(FEEDBACK.pogo.trauma);
        juice.hitStop(FEEDBACK.pogo.hitStop);
      }
      // The volley is a secret, so the FEEL is the only thing that tells her
      // it worked. It is the loudest confirmation in the fight for that reason.
      if (events.rallied) {
        juice.addTrauma(FEEDBACK.rally.trauma);
        juice.hitStop(FEEDBACK.rally.hitStop);
      }

      switch (stepBoss(boss, { playerHit: events.playerHit }, dt)) {
        case 'dog-arrives':
          bringInTheDog();
          break;
        case 'heat':
          bill.hot = true;
          if (dog) dog.hot = true;
          break;
        case 'passed':
          config.onPassed?.();
          break;
        case 'over':
          overGate.arm();
          hitFlash = 0.5;
          juice.addTrauma(FEEDBACK.playerHit.trauma);
          juice.hitStop(FEEDBACK.playerHit.hitStop);
          record();
          config.onFailed?.();
          break;
      }
    },

    render(ctx: CanvasRenderingContext2D, alpha: number): void {
      const feet = lerpVec(prevFeet, player.position, alpha);
      const shake = juice.shakeOffset(simTime);

      clearCanvas(ctx, CANVAS.width, CANVAS.height);
      ctx.save();
      ctx.translate(shake.x, shake.y);
      drawWorld(ctx, world);
      drawEnemy(ctx, lerpVec(prevBillFeet, bill.position, alpha), bill, simTime, 0);
      if (dog)
        drawEnemy(ctx, lerpVec(prevDogFeet, dog.position, alpha), dog, simTime, 0, look.ring);
      drawProjectiles(ctx, projectiles, look.boneSteps);
      drawNailSlash(ctx, feet, player);
      drawKnight(ctx, feet, player, computeStretch(player.velocity.y, landSquash));
      ctx.restore();

      // --- HUD: the clock is the whole score. No hits line, ever. ---
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillStyle = COLORS.hudText;
      const target = ` / ${formatClock(BOSS.targetSeconds)}`;
      ctx.fillText(`${formatClock(boss.elapsed)}${config.cleared ? '' : target}`, 16, 14);
      if (boss.hot) {
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText('they have your number now', 16, 50);
      }
      ctx.textAlign = 'right';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(
        boss.passed ? 'past 1:30 — how long can you go?' : 'the thing at the bottom',
        CANVAS.width - 16,
        14,
      );

      if (hitFlash > 0) {
        ctx.fillStyle = comfort.reduceFlashing
          ? `rgba(7, 9, 18, ${0.3 * (hitFlash / 0.5)})`
          : `rgba(233, 228, 213, ${0.35 * (hitFlash / 0.5)})`;
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
      }

      if (boss.phase === 'intro') {
        const beat = stepEntrance(entrance, boss.introElapsed, boss.introElapsed);
        if (beat.beat === 'thumps') {
          // Nothing but the Knight and a floor that will not stop moving.
          // The line is deliberately not his name: she should be looking at
          // the empty right-hand side of the arena, wondering.
          ctx.textAlign = 'center';
          ctx.fillStyle = COLORS.hudDim;
          ctx.font = '19px system-ui, sans-serif';
          ctx.fillText('Something is coming.', CANVAS.width / 2, CANVAS.height / 2 - 40);
        } else if (beat.beat === 'name') {
          drawCard(
            ctx,
            'BILL THE MAN',
            "Kayla's uncle. You cannot hurt him — only outlast him.",
            0.7 * beat.progress,
          );
        }
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.hudDim;
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillText(`hold ${jumpKey} to hurry`, CANVAS.width - 16, CANVAS.height - 26);
      } else if (boss.phase === 'ready') {
        drawCard(
          ctx,
          'BILL THE MAN',
          "Kayla's uncle. You cannot hurt him — only outlast him.",
          0.7,
        );
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudDim;
        ctx.font = '17px system-ui, sans-serif';
        ctx.fillText(
          'One touch ends it. Survive 1:30. Move to begin.',
          CANVAS.width / 2,
          CANVAS.height / 2 + 76,
        );
      } else if (boss.phase === 'card') {
        drawBarking(ctx, 1 - boss.cardTimer / BOSS.cardSeconds, bill.position.x, entrance);
        drawCard(
          ctx,
          'BILL THE DOG',
          `The family had two. Any key to skip, hold ${jumpKey} to hurry — your clock is paused.`,
          0.7,
        );
      } else if (boss.phase === 'over') {
        ctx.fillStyle = 'rgba(7, 9, 18, 0.78)';
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText('Got you.', CANVAS.width / 2, CANVAS.height / 2 - 70);
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          boss.passed
            ? `${formatClock(boss.elapsed)} — past 1:30, and still going when they got you.`
            : `${formatClock(boss.elapsed)} survived.`,
          CANVAS.width / 2,
          CANVAS.height / 2 - 24,
        );
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText(
          onNext
            ? `Press ${attackKey} to face them again · ${jumpKey} for ${nextLabel ?? 'the next stop'}.`
            : `Press ${attackKey} to face them again.`,
          CANVAS.width / 2,
          CANVAS.height / 2 + 24,
        );
      }

      // Last, so it survives the card and fail washes above.
      if (godMode) drawGodModeHud(ctx, phantomHits, godToast, comfort.reduceFlashing);
    },
  };
}

/**
 * Bill calls for help, and the answer arrives from off-screen.
 *
 * There is no audio anywhere in this project — no `Audio`, no Web Audio, no
 * sound files — so the barking is DRAWN. Bill shouts in his own lettering
 * and "WOOF!" comes in from the right edge with motion lines behind it,
 * which is the same right edge both Bills walk in from.
 *
 * Stepped, like everything else the Bills do: the shout and the woof move in
 * whole 4 px jumps on a floored clock, never interpolated. That constraint
 * is what the user picked these designs FOR (PLAN.md §3), and an entrance
 * that glided would be the one place the fight stops honouring it.
 */
function drawBarking(
  ctx: CanvasRenderingContext2D,
  progress: number,
  billX: number,
  shape: EntranceShape,
): void {
  const step = (v: number) => Math.round(v / 4) * 4;
  ctx.textAlign = 'center';
  ctx.font = '22px system-ui, sans-serif';

  // Bill's shout comes first and stays up.
  if (progress > shape.dogShoutAt) {
    const bob = step(Math.floor(progress * 8) % 2 === 0 ? 0 : 4);
    ctx.fillStyle = COLORS.hudText;
    // Clamped inward: Bill can be standing against either wall when the
    // dog is due, and a shout that runs off the edge of the canvas reads as
    // a rendering bug rather than as a shout.
    const shoutX = Math.min(Math.max(billX, 90), CANVAS.width - 90);
    ctx.fillText('HELP!', step(shoutX), step(FLOOR_Y - 200) + bob);
  }

  // The woof crosses in from the right edge over the back half of the card.
  if (progress > shape.dogWoofAt) {
    const t = Math.min(1, (progress - shape.dogWoofAt) / 0.45);
    const x = step(CANVAS.width + 40 + (CANVAS.width * 0.45 - CANVAS.width - 40) * t);
    const y = step(FLOOR_Y - 150);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('WOOF!', x, y);
    ctx.strokeStyle = COLORS.hudDim;
    ctx.lineWidth = 3;
    for (const dy of [-12, 0, 12]) {
      ctx.beginPath();
      ctx.moveTo(x + 56, y + dy);
      ctx.lineTo(x + 56 + step(28 + dy * 0.6), y + dy);
      ctx.stroke();
    }
  }
}

/** A named card over a dimmed arena: the boss's one piece of theatre. */
function drawCard(ctx: CanvasRenderingContext2D, name: string, line: string, dim: number): void {
  ctx.fillStyle = `rgba(7, 9, 18, ${dim})`;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '38px system-ui, sans-serif';
  ctx.fillText(name, CANVAS.width / 2, CANVAS.height / 2 - 40);
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(line, CANVAS.width / 2, CANVAS.height / 2 + 14);
}
