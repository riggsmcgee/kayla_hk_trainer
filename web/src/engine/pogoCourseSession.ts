/**
 * Pogo Course session (M2, levels from playtest 2): wires the player sim,
 * one level's geometry, the course state machine, a scrolling camera, and
 * the HUD into one playable mode. On completion the run is recorded to
 * localStorage (and mirrored to the practice server when it happens to
 * exist) and `onClear` fires once so the page can unlock the next level.
 */

import { CANVAS } from './constants';
import {
  COURSE_FLOOR_Y,
  POGO_COURSES,
  POGO_COURSE_1,
  createCourseState,
  moverBox,
  stepCourse,
} from './course';
import type { CourseDef, CourseState } from './course';
import { FEEDBACK, LAND_SQUASH_TIME, computeStretch, createEdgeCarry, createJuice } from './juice';
import type { ComfortSettings } from './juice';
import { createPlayer, playerHurtbox, respawnPlayer, stepPlayer } from './player';
import {
  COLORS,
  clearCanvas,
  drawCheckpoint,
  drawGoal,
  drawHazardOrbs,
  drawKnight,
  drawMovers,
  drawGodModeHud,
  drawNailSlash,
  drawOrbs,
  drawSpikes,
  drawWorld,
  lerpVec,
} from './render';
import { recordRun } from '../storage/recordRun';
import type { GameSession, OverlayControls } from './session';
import { createOverlayGate } from './session';
import type { InputFrame, Vec2, World } from './types';

export interface PogoClearInfo {
  /** 1-based level that was just cleared. */
  level: number;
  durationMs: number;
  misses: number;
}

export interface PogoCourseOptions extends OverlayControls {
  /** 1-based index into POGO_COURSES; out-of-range values clamp to the ends. */
  level: number;
  comfort: ComfortSettings;
  /**
   * DEV TOOL: remove in the final build. Spikes and red orbs stop sending her
   * back; every touch is still counted in `misses` and called out on screen.
   */
  godMode?: boolean;
  /** Fires once per finish, after the run is recorded. */
  onClear?: (info: PogoClearInfo) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** Everything a downslash can bounce off at course time t. */
function pogoablesAt(course: CourseDef, t: number) {
  return [
    ...course.orbs,
    ...course.hazardOrbs,
    // Spikes are deliberately pogoable, like the real game.
    ...course.spikes,
    ...course.movers.map((m) => moverBox(m, t)),
  ];
}

export function createPogoCourseSession(options: PogoCourseOptions): GameSession;
/** @deprecated Level 1 only; pass `{ level, comfort }` instead. */
export function createPogoCourseSession(comfort: ComfortSettings): GameSession;
export function createPogoCourseSession(arg: PogoCourseOptions | ComfortSettings): GameSession {
  const options: PogoCourseOptions = 'level' in arg ? arg : { level: 1, comfort: arg };
  const level = Math.min(Math.max(1, Math.floor(options.level)), POGO_COURSES.length);
  const course = POGO_COURSES[level - 1] ?? POGO_COURSE_1;
  const {
    comfort,
    onClear,
    onNext,
    nextLabel,
    godMode = false,
    jumpKey = 'Z',
    attackKey = 'X',
  } = options;

  const world: World = {
    solids: course.solids,
    pogoables: pogoablesAt(course, 0),
  };
  const juice = createJuice(comfort);
  const edgeCarry = createEdgeCarry();

  let player = createPlayer(course.spawn.x, course.spawn.y);
  let courseState: CourseState = createCourseState(course, godMode);
  let prevFeet: Vec2 = { ...player.position };
  let pogosAtRunStart = 0;
  let startedAtIso = '';
  let simTime = 0; // drives ambient animation (orb pulse, goal glow)
  let moverTime = 0; // the course time the drifters were simulated at this step
  let respawnFlash = 0;
  let checkpointToast = 0;
  let landSquash = 0;
  let wasGrounded = false;
  let recorded = false;
  /** God mode: hits she did not take this run, and the toast that says so. */
  let phantomHits = 0;
  let godToast = 0;
  /** Seconds the clear screen still ignores both keys. See OVERLAY_LOCKOUT_SECONDS. */
  const clearGate = createOverlayGate();

  function resetRun(): void {
    player = createPlayer(course.spawn.x, course.spawn.y);
    courseState = createCourseState(course, godMode);
    prevFeet = { ...player.position };
    pogosAtRunStart = player.totalPogos;
    moverTime = 0;
    respawnFlash = 0;
    checkpointToast = 0;
    landSquash = 0;
    wasGrounded = false;
    recorded = false;
    phantomHits = 0;
    godToast = 0;
  }

  return {
    step(rawInput: InputFrame, dt: number): void {
      simTime += dt;
      juice.update(dt);
      if (juice.frozen()) {
        // Hit-stop: the sim holds a beat, but presses must not be lost.
        edgeCarry.absorb(rawInput);
        return;
      }
      const input = edgeCarry.merge(rawInput);
      respawnFlash = Math.max(0, respawnFlash - dt);
      godToast = Math.max(0, godToast - dt);
      checkpointToast = Math.max(0, checkpointToast - dt);
      landSquash = Math.max(0, landSquash - dt);

      if (courseState.finished) {
        // Both keys read the RAW press, not the carried one, so a reflex
        // inside a hit-stop cannot skip a screen she has not read. The
        // lockout is the other half of that: this session has no hit-stop on
        // a clear at all and `finished` is set on the step the goal is
        // touched, so she gets here with X still going from the pogo mash.
        if (clearGate.open(dt, rawInput.attackPressed || rawInput.jumpPressed)) {
          if (rawInput.attackPressed) resetRun();
          else if (rawInput.jumpPressed && onNext) onNext();
        }
        return;
      }

      if (!courseState.started) {
        const anyInput =
          input.left ||
          input.right ||
          input.jumpPressed ||
          input.dashPressed ||
          input.attackPressed;
        if (anyInput) {
          courseState.started = true;
          startedAtIso = new Date().toISOString();
        }
      }

      prevFeet.x = player.position.x;
      prevFeet.y = player.position.y;
      // Drifters sit where the course clock says; the clock only runs once
      // she has started, so they wait for her first input.
      moverTime = courseState.elapsed;
      world.pogoables = pogoablesAt(course, moverTime);
      const pogosBefore = player.totalPogos;
      stepPlayer(player, input, world, dt);
      if (player.totalPogos > pogosBefore) {
        juice.addTrauma(FEEDBACK.pogo.trauma);
        juice.hitStop(FEEDBACK.pogo.hitStop);
      }
      if (!wasGrounded && player.grounded) landSquash = LAND_SQUASH_TIME;
      wasGrounded = player.grounded;

      const events = stepCourse(course, courseState, playerHurtbox(player), dt);
      if (events.respawned) {
        respawnPlayer(player, courseState.respawnPoint);
        prevFeet = { ...player.position };
        respawnFlash = 0.4;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
        juice.hitStop(FEEDBACK.playerHit.hitStop);
      }
      if (events.wouldHaveRespawned) {
        // Trauma but no hit-stop: she is being told, not interrupted. A
        // freeze on a hit that costs nothing only gets in the way of testing.
        phantomHits += 1;
        godToast = 1.1;
        juice.addTrauma(FEEDBACK.playerHit.trauma);
      }
      if (events.checkpointReached !== null) {
        checkpointToast = 1.6;
      }
      if (events.finishedNow) clearGate.arm();
      if (events.finishedNow && !recorded) {
        recorded = true;
        juice.addTrauma(FEEDBACK.courseClear.trauma);
        const durationMs = Math.round(courseState.elapsed * 1000);
        recordRun({
          mode: 'pogo',
          level,
          godMode: godMode || undefined,
          cleared: true,
          hitsLanded: player.totalPogos - pogosAtRunStart,
          durationMs,
          startedAt: startedAtIso || new Date().toISOString(),
        });
        onClear?.({ level, durationMs, misses: courseState.misses });
      }
    },

    render(ctx: CanvasRenderingContext2D, alpha: number): void {
      const feet = lerpVec(prevFeet, player.position, alpha);
      const camX = Math.min(Math.max(feet.x - CANVAS.width / 2, 0), course.width - CANVAS.width);
      const shake = juice.shakeOffset(simTime);

      clearCanvas(ctx, CANVAS.width, CANVAS.height);
      ctx.save();
      // Shake moves the CAMERA (this translate), never the simulated bodies.
      ctx.translate(-camX + shake.x, shake.y);

      drawWorld(ctx, world);
      drawSpikes(ctx, course.spikes);
      drawOrbs(ctx, course.orbs, simTime);
      drawHazardOrbs(ctx, course.hazardOrbs, simTime);
      drawMovers(ctx, course.movers, moverTime, simTime);
      course.checkpoints.forEach((cp, i) => {
        drawCheckpoint(ctx, cp.respawn.x, COURSE_FLOOR_Y, i <= courseState.checkpointIndex);
      });
      drawGoal(ctx, course.goal, simTime);
      drawNailSlash(ctx, feet, player);
      drawKnight(ctx, feet, player, computeStretch(player.velocity.y, landSquash));

      ctx.restore();

      // --- HUD ---
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(formatTime(courseState.elapsed), 16, 14);
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(`pogos ${player.totalPogos - pogosAtRunStart}`, 16, 36);
      ctx.fillText(`misses ${courseState.misses}`, 16, 58);

      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.hudText;
      ctx.fillText(`Level ${level} — ${course.name}`, CANVAS.width - 16, 14);

      if (!courseState.started) {
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText(course.intro, CANVAS.width / 2, 96);
      }

      if (checkpointToast > 0) {
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, checkpointToast / 0.4);
        ctx.fillStyle = COLORS.checkpointArmed;
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText('Checkpoint.', CANVAS.width / 2, 96);
        ctx.globalAlpha = 1;
      }

      if (respawnFlash > 0) {
        ctx.fillStyle = `rgba(7, 9, 18, ${0.55 * (respawnFlash / 0.4)})`;
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
      }

      if (courseState.finished) {
        ctx.fillStyle = 'rgba(7, 9, 18, 0.78)';
        ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '30px system-ui, sans-serif';
        ctx.fillText(`Level ${level} clear, Kayla!`, CANVAS.width / 2, CANVAS.height / 2 - 70);
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          `${formatTime(courseState.elapsed)}  ·  ${player.totalPogos - pogosAtRunStart} pogos  ·  ${courseState.misses} ${courseState.misses === 1 ? 'miss' : 'misses'}`,
          CANVAS.width / 2,
          CANVAS.height / 2 - 24,
        );
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText(
          onNext
            ? `Press ${jumpKey} for ${nextLabel ?? 'the next one'} · ${attackKey} to run it again.`
            : `Press ${attackKey} to run it again.`,
          CANVAS.width / 2,
          CANVAS.height / 2 + 24,
        );
      }

      // Last, so it survives the respawn and clear washes above — a badge you
      // cannot see on the very screenshot you are taking is no safeguard.
      if (godMode) drawGodModeHud(ctx, phantomHits, godToast, comfort.reduceFlashing);
    },
  };
}
