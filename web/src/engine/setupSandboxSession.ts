/**
 * The Setup sandbox: a bare floor and her Knight, and nothing else.
 *
 * Playtest 8, note 5, in the user's own words: "She should have a sandbox with
 * her player character, where she can move around and test out the controls to
 * make sure they feel right." Asked what was in it: **"Just a bare floor."**
 *
 * So this is the ONE PLACE ON THE SITE WITH NO PASS AND NO FAIL. Every other
 * canvas is scored, timed, or lethal. Here nothing hunts her, nothing hurts
 * her, there is no clock and there is nothing to bounce off — the world is the
 * dodge arena's own three solids (a floor and two walls) and not one thing
 * more. The only thing that happens is that the checklist notices what she
 * has proved her controller can do.
 *
 * IT REUSES `arenaWorld()` RATHER THAN DEFINING A FLOOR. That world is flat
 * and already playtested (playtest 7 removed its two ledges because she could
 * wait out three of the five enemies up there), and a second definition of
 * "the ground" is a second thing that can drift from the physics she is about
 * to learn on.
 *
 * Nothing here knows what a checklist looks like on screen: it reports the
 * checks it earns through a callback and never renders them.
 */

import type { SetupCheck } from '@dojo/shared';
import { CANVAS } from './constants';
import { FLOOR_Y, PLAYER_SPAWN_X, arenaWorld } from './dodgeArenaSession';
import { createPlayer, stepPlayer } from './player';
import { clearCanvas, drawKnight, drawNailSlash, drawWorld } from './render';
import { earnedSetupChecks } from './setupChecks';
import type { GameSession } from './session';
import type { InputFrame, Vec2 } from './types';

/** Linear blend between the last two simulated positions, for a smooth draw. */
function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export interface SetupSandboxOptions {
  /** Checks she has already earned in an earlier visit; they never re-earn. */
  alreadyDone: ReadonlySet<SetupCheck>;
  /** Called with the checks earned on a step, only on steps that earn some. */
  onEarned: (checks: readonly SetupCheck[]) => void;
}

/**
 * Build the sandbox.
 *
 * The Knight is spawned at the arena's own spawn point so the floor she stands
 * on here is the floor she will stand on in the Dodge Arena — the point of the
 * screen is that what she practises transfers.
 */
export function createSetupSandbox(options: SetupSandboxOptions): GameSession {
  const world = arenaWorld();
  const player = createPlayer(PLAYER_SPAWN_X, FLOOR_Y);
  const done = new Set<SetupCheck>(options.alreadyDone);
  let prevFeet: Vec2 = { ...player.position };

  return {
    step(input: InputFrame, dt: number): void {
      prevFeet = { ...player.position };

      // Both read BEFORE the step, and that ordering is the whole correctness
      // of the down-slash check. `stepPlayer` decides the swing direction near
      // the top of its step, off the grounded state it entered with, and only
      // resolves collisions afterwards — so a swing thrown in mid-air that
      // lands on the same step would look grounded if we asked after.
      const groundedAtSwing = player.grounded;
      const swingsBefore = player.swingId;

      stepPlayer(player, input, world, dt);

      const earned = earnedSetupChecks(done, input, {
        grounded: groundedAtSwing,
        // `swingId` only advances when a swing actually STARTS. Reading the
        // press instead would tick a direction for a button pressed during
        // the nail's cadence, when no swing came out.
        swinging: player.swingId !== swingsBefore,
      });
      if (earned.length === 0) return;
      for (const check of earned) done.add(check);
      options.onEarned(earned);
    },

    render(ctx: CanvasRenderingContext2D, alpha: number): void {
      const feet = lerpVec(prevFeet, player.position, alpha);
      clearCanvas(ctx, CANVAS.width, CANVAS.height);
      drawWorld(ctx, world);
      drawNailSlash(ctx, feet, player);
      // No squash: the other sessions feed `drawKnight` a landing impulse they
      // track for their own juice, and this screen has no impacts to sell.
      drawKnight(ctx, feet, player);
    },
  };
}
