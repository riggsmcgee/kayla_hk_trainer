/**
 * Course progression seam tests (M2).
 *
 * Seam: stepCourse — the pure pogo-course state machine: spike respawns,
 * ordered checkpoints, goal detection, and the run clock. Geometry is fed in
 * as a tiny synthetic course so the tests are independent of the real
 * course's layout data.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { POGO_COURSE_1, createCourseState, stepCourse, type CourseDef } from './course';
import { createPlayer, playerHurtbox, respawnPlayer, stepPlayer } from './player';
import type { AABB, InputFrame, World } from './types';

const DT = 1 / 60;

/** A tiny linear course: spawn → spike strip → checkpoint → goal. */
function tinyCourse(): CourseDef {
  return {
    width: 1000,
    spawn: { x: 50, y: 100 },
    solids: [{ x: 0, y: 100, width: 1000, height: 50 }],
    spikes: [{ x: 200, y: 80, width: 100, height: 20 }],
    orbs: [],
    checkpoints: [
      { trigger: { x: 400, y: 0, width: 40, height: 100 }, respawn: { x: 420, y: 100 } },
    ],
    goal: { x: 900, y: 0, width: 50, height: 100 },
  };
}

function boxAt(x: number, y: number): AABB {
  return { x, y: y - 47, width: 18, height: 47 }; // knight-sized, feet at (x, y)
}

describe('course progression', () => {
  it('starts at the spawn point with a zeroed clock', () => {
    const state = createCourseState(tinyCourse());
    expect(state.respawnPoint).toEqual({ x: 50, y: 100 });
    expect(state.elapsed).toBe(0);
    expect(state.misses).toBe(0);
    expect(state.finished).toBe(false);
  });

  it('only runs the clock once started, and freezes it on finish', () => {
    const course = tinyCourse();
    const state = createCourseState(course);
    stepCourse(course, state, boxAt(50, 100), DT);
    expect(state.elapsed).toBe(0); // not started yet
    state.started = true;
    stepCourse(course, state, boxAt(50, 100), DT);
    expect(state.elapsed).toBeCloseTo(DT, 10);
    // Finish, then step more: the clock must hold.
    stepCourse(course, state, boxAt(910, 100), DT);
    expect(state.finished).toBe(true);
    const t = state.elapsed;
    stepCourse(course, state, boxAt(910, 100), DT);
    expect(state.elapsed).toBe(t);
  });

  it('reports a respawn and counts the miss on spike contact', () => {
    const course = tinyCourse();
    const state = createCourseState(course);
    state.started = true;
    const events = stepCourse(course, state, boxAt(250, 100), DT); // inside the spikes
    expect(events.respawned).toBe(true);
    expect(state.misses).toBe(1);
    expect(state.respawnPoint).toEqual({ x: 50, y: 100 }); // back to spawn
  });

  it('advances the respawn point at a checkpoint, and never regresses', () => {
    const course = tinyCourse();
    const state = createCourseState(course);
    state.started = true;
    const events = stepCourse(course, state, boxAt(420, 100), DT);
    expect(events.checkpointReached).toBe(0);
    expect(state.respawnPoint).toEqual({ x: 420, y: 100 });
    // Walking back through the same trigger fires nothing new.
    const again = stepCourse(course, state, boxAt(420, 100), DT);
    expect(again.checkpointReached).toBeNull();
    // A later spike hit respawns at the checkpoint, not the spawn.
    stepCourse(course, state, boxAt(250, 100), DT);
    expect(state.respawnPoint).toEqual({ x: 420, y: 100 });
  });

  it('finishes on goal contact', () => {
    const course = tinyCourse();
    const state = createCourseState(course);
    state.started = true;
    const events = stepCourse(course, state, boxAt(910, 100), DT);
    expect(events.finishedNow).toBe(true);
    expect(state.finished).toBe(true);
  });
});

describe('Course 1 geometry', () => {
  it('checkpoint triggers reach full height — no altitude can skip them', () => {
    // The natural crossing is a pogo arc or an air dash, which can pass well
    // above a short trigger. Every trigger must cover the whole playfield
    // column so any crossing arms it.
    for (const cp of POGO_COURSE_1.checkpoints) {
      expect(cp.trigger.y).toBeLessThanOrEqual(-200); // starts far above
      expect(cp.trigger.y + cp.trigger.height).toBeGreaterThanOrEqual(600); // reaches the floor
    }
  });
});

describe('Course 1 completability', () => {
  /**
   * A simple scripted player: run right, jump when the floor runs out ahead,
   * and mash downslash while airborne so any orb (or spike) under the nail
   * becomes a bounce. If this bot can finish, the course is beatable with
   * the shipped physics — no orb is out of reach, no gap is too wide.
   */
  it('is beatable by a run-right + downslash-mash bot', () => {
    const course = POGO_COURSE_1;
    const world: World = {
      solids: course.solids,
      pogoables: [...course.orbs, ...course.spikes],
    };
    const player = createPlayer(course.spawn.x, course.spawn.y);
    const state = createCourseState(course);
    state.started = true;

    const groundAhead = (x: number, y: number): boolean =>
      course.solids.some(
        (s) => x >= s.x && x <= s.x + s.width && y + 6 >= s.y && y <= s.y + s.height,
      );

    let jumpHoldSteps = 0;
    const maxSteps = 240 * 60; // four sim-minutes is miles of headroom

    for (let tick = 0; tick < maxSteps && !state.finished; tick++) {
      const airborne = !player.grounded;
      let jumpPressed = false;
      if (player.grounded && !groundAhead(player.position.x + 34, player.position.y)) {
        jumpPressed = true;
        jumpHoldSteps = 11; // released as the pin ends: a ≈122 px jump, a deliberately conservative bound (a full held jump is ≈236 px)
      }
      const input: InputFrame = {
        left: false,
        right: true,
        up: false,
        down: airborne,
        jumpPressed,
        jumpHeld: jumpPressed || jumpHoldSteps > 0,
        attackPressed: airborne && tick % 3 === 0,
        dashPressed: false,
      };
      if (jumpHoldSteps > 0) jumpHoldSteps--;

      stepPlayer(player, input, world, FIXED_DT);
      const events = stepCourse(course, state, playerHurtbox(player), FIXED_DT);
      if (events.respawned) respawnPlayer(player, state.respawnPoint);
    }

    expect(state.finished).toBe(true);
    expect(state.elapsed).toBeLessThan(240);
  });
});
