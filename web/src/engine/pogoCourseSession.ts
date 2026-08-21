/**
 * Pogo Course session (M2): wires the player sim, Course 1 geometry, the
 * course state machine, a scrolling camera, and the HUD into one playable
 * mode. On completion the run is recorded to localStorage (and mirrored to
 * the practice server when it happens to exist).
 */

import { CANVAS } from './constants';
import { COURSE_FLOOR_Y, POGO_COURSE_1, createCourseState, stepCourse } from './course';
import type { CourseState } from './course';
import {
  FEEDBACK,
  LAND_SQUASH_TIME,
  computeStretch,
  createEdgeCarry,
  createJuice,
} from './juice';
import type { ComfortSettings } from './juice';
import { createPlayer, playerHurtbox, respawnPlayer, stepPlayer } from './player';
import {
  COLORS,
  clearCanvas,
  drawCheckpoint,
  drawGoal,
  drawKnight,
  drawNailSlash,
  drawOrbs,
  drawSpikes,
  drawWorld,
  lerpVec,
} from './render';
import { recordRun } from '../storage/recordRun';
import type { GameSession } from './session';
import type { InputFrame, Vec2, World } from './types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function createPogoCourseSession(comfort: ComfortSettings): GameSession {
  const course = POGO_COURSE_1;
  const world: World = {
    solids: course.solids,
    // Spikes are deliberately pogoable, like the real game.
    pogoables: [...course.orbs, ...course.spikes],
  };
  const juice = createJuice(comfort);
  const edgeCarry = createEdgeCarry();

  let player = createPlayer(course.spawn.x, course.spawn.y);
  let courseState: CourseState = createCourseState(course);
  let prevFeet: Vec2 = { ...player.position };
  let pogosAtRunStart = 0;
  let startedAtIso = '';
  let simTime = 0; // drives ambient animation (orb pulse, goal glow)
  let respawnFlash = 0;
  let checkpointToast = 0;
  let landSquash = 0;
  let wasGrounded = false;
  let recorded = false;

  function resetRun(): void {
    player = createPlayer(course.spawn.x, course.spawn.y);
    courseState = createCourseState(course);
    prevFeet = { ...player.position };
    pogosAtRunStart = player.totalPogos;
    respawnFlash = 0;
    checkpointToast = 0;
    landSquash = 0;
    wasGrounded = false;
    recorded = false;
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
      checkpointToast = Math.max(0, checkpointToast - dt);
      landSquash = Math.max(0, landSquash - dt);

      if (courseState.finished) {
        if (input.jumpPressed) resetRun();
        return;
      }

      if (!courseState.started) {
        const anyInput =
          input.left || input.right || input.jumpPressed || input.dashPressed || input.attackPressed;
        if (anyInput) {
          courseState.started = true;
          startedAtIso = new Date().toISOString();
        }
      }

      prevFeet.x = player.position.x;
      prevFeet.y = player.position.y;
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
      if (events.checkpointReached !== null) {
        checkpointToast = 1.6;
      }
      if (events.finishedNow && !recorded) {
        recorded = true;
        juice.addTrauma(FEEDBACK.courseClear.trauma);
        recordRun({
          mode: 'pogo',
          hitsLanded: player.totalPogos - pogosAtRunStart,
          durationMs: Math.round(courseState.elapsed * 1000),
          startedAt: startedAtIso || new Date().toISOString(),
        });
      }
    },

    render(ctx: CanvasRenderingContext2D, alpha: number): void {
      const feet = lerpVec(prevFeet, player.position, alpha);
      const camX = Math.min(
        Math.max(feet.x - CANVAS.width / 2, 0),
        course.width - CANVAS.width,
      );
      const shake = juice.shakeOffset(simTime);

      clearCanvas(ctx, CANVAS.width, CANVAS.height);
      ctx.save();
      // Shake moves the CAMERA (this translate), never the simulated bodies.
      ctx.translate(-camX + shake.x, shake.y);

      drawWorld(ctx, world);
      drawSpikes(ctx, course.spikes);
      drawOrbs(ctx, course.orbs, simTime);
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

      if (!courseState.started) {
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText(
          'Bounce across on the glowing orbs — jump, then slash DOWN in the air.',
          CANVAS.width / 2,
          96,
        );
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
        ctx.fillText('Course clear, Kayla!', CANVAS.width / 2, CANVAS.height / 2 - 70);
        ctx.font = '19px system-ui, sans-serif';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText(
          `${formatTime(courseState.elapsed)}  ·  ${player.totalPogos - pogosAtRunStart} pogos  ·  ${courseState.misses} ${courseState.misses === 1 ? 'miss' : 'misses'}`,
          CANVAS.width / 2,
          CANVAS.height / 2 - 24,
        );
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText('Press Z to run it again.', CANVAS.width / 2, CANVAS.height / 2 + 24);
      }
    },
  };
}
