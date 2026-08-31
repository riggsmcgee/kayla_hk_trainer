/**
 * Course progression seam tests (M2, extended for playtest-2 note 3).
 *
 * Seam: stepCourse — the pure pogo-course state machine: spike and hazard-orb
 * respawns, ordered checkpoints, goal detection, and the run clock. Geometry
 * is fed in as a tiny synthetic course so the tests are independent of the
 * real levels' layout data.
 *
 * Plus: moverBox (drifting orbs as a pure function of course time), a frozen
 * snapshot of Level 1 ("a perfect level 1 — nothing needs to be changed"),
 * and a scripted bot that proves EVERY shipped level beatable on the shipped
 * physics. If a level fails the bot, fix the level, never the physics.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT, PHYSICS } from './constants';
import {
  COURSE_FLOOR_Y,
  POGO_COURSES,
  POGO_COURSE_1,
  createCourseState,
  moverBox,
  stepCourse,
  type CourseDef,
  type CourseState,
  type Mover,
} from './course';
import { activeNailHitbox, createPlayer, playerHurtbox, respawnPlayer, stepPlayer } from './player';
import type { AABB, InputFrame, World } from './types';

const DT = 1 / 60;

/** A tiny linear course: spawn → spike strip → hazard orb → checkpoint → goal. */
function tinyCourse(): CourseDef {
  return {
    name: 'Tiny',
    intro: 'A test course.',
    width: 1000,
    spawn: { x: 50, y: 100 },
    solids: [{ x: 0, y: 100, width: 1000, height: 50 }],
    spikes: [{ x: 200, y: 80, width: 100, height: 20 }],
    orbs: [],
    hazardOrbs: [{ x: 320, y: 40, width: 28, height: 28 }],
    movers: [],
    checkpoints: [
      { trigger: { x: 400, y: 0, width: 40, height: 100 }, respawn: { x: 420, y: 100 } },
    ],
    goal: { x: 900, y: 0, width: 50, height: 100 },
  };
}

function boxAt(x: number, y: number): AABB {
  return { x, y: y - 47, width: 18, height: 47 }; // knight-sized, feet at (x, y)
}

const IDLE: InputFrame = {
  left: false,
  right: false,
  up: false,
  down: false,
  jumpPressed: false,
  jumpHeld: false,
  attackPressed: false,
  dashPressed: false,
};

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

  it('treats body contact with a hazard orb exactly like spikes', () => {
    const course = tinyCourse();
    const state = createCourseState(course);
    state.started = true;
    // Feet at y=80 put the body (33..80) across the hazard orb (40..68).
    const events = stepCourse(course, state, boxAt(325, 80), DT);
    expect(events.respawned).toBe(true);
    expect(state.misses).toBe(1);
    expect(state.respawnPoint).toEqual({ x: 50, y: 100 });
    // Like spikes, the session respawns her on the same step, so the next
    // step sees her back at the lantern and reports nothing.
    const clear = stepCourse(course, state, boxAt(50, 100), DT);
    expect(clear.respawned).toBe(false);
    expect(state.misses).toBe(1);
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

describe('hazard orbs and the nail', () => {
  it('bounces a downslash exactly like a blue orb (the danger is body-only)', () => {
    // The player hangs in the air 40 px above a hazard orb and swings down.
    const hazard: AABB = { x: 100, y: 300, width: 28, height: 28 };
    const world: World = {
      solids: [{ x: 0, y: 900, width: 400, height: 50 }],
      pogoables: [hazard],
    };
    const player = createPlayer(114, 260);
    player.grounded = false;
    let bounced = false;
    for (let i = 0; i < 12 && !bounced; i++) {
      stepPlayer(player, { ...IDLE, down: true, attackPressed: i === 0 }, world, FIXED_DT);
      bounced = player.totalPogos === 1;
    }
    expect(bounced).toBe(true);
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
  });

  it('punishes a LATE swing on red but not on blue: same bounce, only red sends her back', () => {
    // The lesson of Level 2 in one step: she has fallen so low that her
    // body is already across the orb when the nail connects. Blue: a
    // bounce. Red: the same bounce, and back to the lantern.
    const orb: AABB = { x: 300, y: 486, width: 28, height: 28 };
    const run = (red: boolean) => {
      const course: CourseDef = {
        ...tinyCourse(),
        solids: [{ x: 0, y: 900, width: 1000, height: 50 }],
        spikes: [],
        orbs: red ? [] : [orb],
        hazardOrbs: red ? [orb] : [],
      };
      const state = createCourseState(course);
      state.started = true;
      const world: World = { solids: course.solids, pogoables: [orb] };
      // Feet 5 px below the orb's top: the hurtbox overlaps the orb.
      const player = createPlayer(314, orb.y + 5);
      player.grounded = false;
      let respawned = false;
      for (let i = 0; i < 12 && player.totalPogos === 0; i++) {
        stepPlayer(player, { ...IDLE, down: true, attackPressed: i === 0 }, world, FIXED_DT);
        respawned ||= stepCourse(course, state, playerHurtbox(player), FIXED_DT).respawned;
      }
      return { bounced: player.totalPogos === 1, respawned, misses: state.misses };
    };
    expect(run(false)).toEqual({ bounced: true, respawned: false, misses: 0 });
    expect(run(true)).toEqual({ bounced: true, respawned: true, misses: 1 });
  });
});

describe('moverBox', () => {
  const base = { size: 28, center: { x: 500, y: 400 } };
  const movers: Mover[] = [
    { ...base, path: { kind: 'horizontal', amplitude: 100, period: 3, phase: 0 } },
    { ...base, path: { kind: 'vertical', amplitude: 80, period: 2, phase: 0.25 } },
    { ...base, path: { kind: 'circle', amplitude: 60, period: 4, phase: 0.1 } },
  ];

  function centerOf(b: AABB) {
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  it('is a pure function of time that repeats every period', () => {
    for (const m of movers) {
      for (const t of [0, 0.37, 1.9, 7.25]) {
        const a = moverBox(m, t);
        const b = moverBox(m, t + m.path.period);
        expect(b.x).toBeCloseTo(a.x, 6);
        expect(b.y).toBeCloseTo(a.y, 6);
        expect(moverBox(m, t)).toEqual(a); // deterministic: no hidden state
      }
    }
  });

  it('sits at its center at t = 0 with phase 0 (horizontal, vertical)', () => {
    for (const m of movers.slice(0, 2)) {
      const c = centerOf(moverBox({ ...m, path: { ...m.path, phase: 0 } }, 0));
      expect(c.x).toBeCloseTo(500, 6);
      expect(c.y).toBeCloseTo(400, 6);
    }
  });

  it('never strays further than its amplitude from its center', () => {
    for (const m of movers) {
      for (let t = 0; t < 2 * m.path.period; t += 0.05) {
        const c = centerOf(moverBox(m, t));
        const d = Math.hypot(c.x - 500, c.y - 400);
        expect(d).toBeLessThanOrEqual(m.path.amplitude + 1e-6);
      }
      expect(moverBox(m, 0)).toMatchObject({ width: 28, height: 28 });
    }
  });

  it('moves only along its axis (horizontal keeps y, vertical keeps x)', () => {
    const h = movers[0]!;
    const v = movers[1]!;
    for (let t = 0; t < 3; t += 0.1) {
      expect(centerOf(moverBox(h, t)).y).toBeCloseTo(400, 6);
      expect(centerOf(moverBox(v, t)).x).toBeCloseTo(500, 6);
    }
  });

  it('runs circles clockwise on screen: right, then down, then left', () => {
    const m: Mover = { ...base, path: { kind: 'circle', amplitude: 60, period: 4, phase: 0 } };
    const right = centerOf(moverBox(m, 0));
    const down = centerOf(moverBox(m, 1));
    const left = centerOf(moverBox(m, 2));
    expect(right.x).toBeCloseTo(560, 6);
    expect(right.y).toBeCloseTo(400, 6);
    expect(down.x).toBeCloseTo(500, 6);
    expect(down.y).toBeCloseTo(460, 6); // +y is down on a canvas
    expect(left.x).toBeCloseTo(440, 6);
  });
});

// ---------------------------------------------------------------------------
// Level 1 is frozen. The user, playtest 2: "I think what we have currently is
// a perfect level 1. Nothing needs to be changed at all." This snapshot was
// captured from the shipped POGO_COURSE_1 before any other level existed.
// If this test fails, the fix is to put Level 1 back, not to update the JSON.
// ---------------------------------------------------------------------------
const LEVEL_1_SNAPSHOT = {
  width: 4200,
  spawn: { x: 120, y: 600 },
  solids: [
    { x: -400, y: 600, width: 960, height: 200 },
    { x: 560, y: 656, width: 320, height: 200 },
    { x: 880, y: 600, width: 280, height: 200 },
    { x: 1160, y: 656, width: 560, height: 200 },
    { x: 1720, y: 600, width: 440, height: 200 },
    { x: 2160, y: 656, width: 960, height: 200 },
    { x: 3120, y: 600, width: 280, height: 200 },
    { x: 3400, y: 656, width: 460, height: 200 },
    { x: 3860, y: 600, width: 740, height: 200 },
    { x: -432, y: -800, width: 32, height: 1600 },
    { x: 4600, y: -800, width: 32, height: 1600 },
  ],
  spikes: [
    { x: 566, y: 632, width: 308, height: 24 },
    { x: 1166, y: 632, width: 548, height: 24 },
    { x: 2166, y: 632, width: 948, height: 24 },
    { x: 3406, y: 632, width: 448, height: 24 },
  ],
  orbs: [
    { x: 706, y: 486, width: 28, height: 28 },
    { x: 1236, y: 486, width: 28, height: 28 },
    { x: 1396, y: 486, width: 28, height: 28 },
    { x: 1556, y: 486, width: 28, height: 28 },
    { x: 2236, y: 470, width: 28, height: 28 },
    { x: 2396, y: 430, width: 28, height: 28 },
    { x: 2556, y: 475, width: 28, height: 28 },
    { x: 2716, y: 425, width: 28, height: 28 },
    { x: 2876, y: 470, width: 28, height: 28 },
    { x: 3036, y: 500, width: 28, height: 28 },
    { x: 3486, y: 530, width: 28, height: 28 },
    { x: 3676, y: 530, width: 28, height: 28 },
  ],
  checkpoints: [
    { trigger: { x: 980, y: -400, width: 40, height: 1000 }, respawn: { x: 1000, y: 600 } },
    { trigger: { x: 1880, y: -400, width: 40, height: 1000 }, respawn: { x: 1900, y: 600 } },
    { trigger: { x: 3240, y: -400, width: 40, height: 1000 }, respawn: { x: 3260, y: 600 } },
  ],
  goal: { x: 3980, y: 440, width: 60, height: 160 },
};

describe('Level 1 is frozen', () => {
  it('matches the snapshot taken before levels 2–4 existed', () => {
    const { width, spawn, solids, spikes, orbs, checkpoints, goal } = POGO_COURSE_1;
    expect(
      JSON.parse(JSON.stringify({ width, spawn, solids, spikes, orbs, checkpoints, goal })),
    ).toEqual(LEVEL_1_SNAPSHOT);
  });

  it('has no hazard orbs and no drifting orbs', () => {
    expect(POGO_COURSE_1.hazardOrbs).toEqual([]);
    expect(POGO_COURSE_1.movers).toEqual([]);
  });

  it('is the first entry of POGO_COURSES', () => {
    expect(POGO_COURSES[0]).toBe(POGO_COURSE_1);
  });
});

describe('the level sequence', () => {
  it('has four levels: 1 + red + drift + the finale level', () => {
    expect(POGO_COURSES).toHaveLength(4);
  });

  it('names every level and gives it a one-line intro', () => {
    for (const c of POGO_COURSES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.name.length).toBeLessThan(24);
      expect(c.intro.length).toBeGreaterThan(0);
      expect(c.intro).not.toContain('\n');
    }
  });

  it('level 2 teaches red, level 3 teaches drift, level 4 has both and longer gaps', () => {
    const [l1, l2, l3, l4] = POGO_COURSES;
    expect(l1!.hazardOrbs.length + l1!.movers.length).toBe(0);
    expect(l2!.hazardOrbs.length).toBeGreaterThanOrEqual(4);
    expect(l2!.movers).toHaveLength(0);
    // At least one pit can only be crossed on red orbs.
    const l2Pits = l2!.solids.filter((s) => s.y > COURSE_FLOOR_Y && s.height === 200);
    const inPit = (p: AABB, o: AABB) => o.x > p.x && o.x < p.x + p.width;
    const redOnly = l2Pits.filter(
      (p) => l2!.hazardOrbs.some((o) => inPit(p, o)) && !l2!.orbs.some((o) => inPit(p, o)),
    );
    expect(redOnly.length).toBeGreaterThanOrEqual(1);
    expect(l3!.hazardOrbs).toHaveLength(0);
    const kinds = new Set(l3!.movers.map((m) => m.path.kind));
    expect(kinds).toEqual(new Set(['horizontal', 'vertical', 'circle']));
    expect(l4!.hazardOrbs.length).toBeGreaterThan(0);
    expect(l4!.movers.length).toBeGreaterThan(0);
  });

  it('keeps every drift within the tuned envelope (2–4 s, 60–140 px)', () => {
    for (const c of POGO_COURSES) {
      for (const m of c.movers) {
        expect(m.path.period).toBeGreaterThanOrEqual(2);
        expect(m.path.period).toBeLessThanOrEqual(4);
        expect(m.path.amplitude).toBeGreaterThanOrEqual(60);
        expect(m.path.amplitude).toBeLessThanOrEqual(140);
      }
    }
  });

  it('gives every level lanterns between its pits, full height like level 1', () => {
    for (const c of POGO_COURSES) {
      const pits = c.solids.filter((s) => s.y > COURSE_FLOOR_Y && s.height === 200);
      expect(c.checkpoints.length).toBeGreaterThanOrEqual(pits.length - 1);
      for (const cp of c.checkpoints) {
        expect(cp.trigger.y).toBeLessThanOrEqual(-200);
        expect(cp.trigger.y + cp.trigger.height).toBeGreaterThanOrEqual(COURSE_FLOOR_Y);
        // A lantern stands on the walkway, never over a pit.
        expect(pits.some((p) => cp.respawn.x > p.x && cp.respawn.x < p.x + p.width)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Completability: scripted bots on the shipped physics.
// ---------------------------------------------------------------------------

function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

interface BotResult {
  finished: boolean;
  elapsed: number;
  misses: number;
  /** Feet x at each miss — tells you WHICH pit is too hard. */
  missXs: number[];
  /**
   * Bounces whose nail touched no orb at all — i.e. spike pogos. The shipped
   * physics lets a downslash bounce off the spike strip that floors every
   * pit, so a bot that swings freely can cross ANY gap on spikes alone and
   * proves nothing about the orbs. The aiming bot never swings at spikes;
   * this counts the accidents, and the tests require zero.
   */
  spikeBounces: number;
}

/**
 * The "aiming" bot: a stand-in for a player who has learned the lesson.
 * It runs right, jumps at a ledge and releases once it is high enough above
 * the next orb, steers in the air to sit above that orb (re-read every step,
 * so drifting orbs are tracked), and swings DOWN only when the nail is about
 * to reach an ORB (blue, red, or drifting — never spikes). It never dashes
 * and never waits at a ledge, so it is a lower bound on what a patient human
 * can do on the orbs themselves.
 */
function runAimingBot(course: CourseDef, idleSteps = 0): BotResult {
  const player = createPlayer(course.spawn.x, course.spawn.y);
  const state = createCourseState(course);
  state.started = true;
  const world: World = { solids: course.solids, pogoables: [] };
  const missXs: number[] = [];
  let spikeBounces = 0;
  const walkways = course.solids.filter((s) => s.y === COURSE_FLOOR_Y);

  let minTargetX = -Infinity;
  // Indices (into `targets`) bounced on since the last landing: a drifter
  // that wanders back past the line must not be chased a second time.
  const used = new Set<number>();
  const maxSteps = 240 * 60;

  for (let tick = 0; tick < maxSteps && !state.finished; tick++) {
    const t = state.elapsed;
    const targets = [
      ...course.orbs,
      ...course.hazardOrbs,
      ...course.movers.map((m) => moverBox(m, t)),
    ];
    world.pogoables = [...targets, ...course.spikes];

    let input: InputFrame = IDLE;
    const feet = player.position;
    if (tick >= idleSteps) {
      if (player.grounded) {
        minTargetX = feet.x;
        used.clear();
      }
      // The next walkway: no point aiming at an orb beyond solid ground.
      let floorAhead = Infinity;
      for (const w of walkways) {
        if (w.x > feet.x + 9 && w.x < floorAhead) floorAhead = w.x;
      }
      let target: AABB | null = null;
      for (let i = 0; i < targets.length; i++) {
        const b = targets[i]!;
        const cx = b.x + b.width / 2;
        if (used.has(i) || cx < minTargetX || cx < feet.x - 30) continue;
        if (!target || cx < target.x + target.width / 2) target = b;
      }
      if (target && target.x + target.width / 2 > floorAhead) target = null;

      let right = true;
      let left = false;
      if (target && !player.grounded) {
        const cx = target.x + target.width / 2;
        right = feet.x < cx - 4;
        left = feet.x > cx + 4;
      }
      const groundAhead = course.solids.some(
        (s) =>
          feet.x + 34 >= s.x &&
          feet.x + 34 <= s.x + s.width &&
          feet.y + 6 >= s.y &&
          feet.y <= s.y + s.height,
      );
      const jumpPressed = player.grounded && !groundAhead;
      const releaseY = target ? target.y - 140 : -Infinity;
      const jumpHeld = jumpPressed || (player.velocity.y < 0 && feet.y > releaseY);

      // Swing when the nail will be squarely over an orb once its startup
      // ends (drifters are read at that moment too). The predicted box is
      // inset so a clipping swing is not wasted. Never at spikes: a spike
      // bounce would let the bot cross a gap the orbs do not actually span.
      const lead = 3 * FIXED_DT;
      const feetAtSwing = {
        x: feet.x + player.velocity.x * lead,
        y: feet.y + Math.max(0, player.velocity.y) * lead,
      };
      const predicted: AABB = {
        x: feetAtSwing.x - 54 + 10,
        y: feetAtSwing.y + 8,
        width: 108 - 20,
        height: PHYSICS.nailReachDown - 8,
      };
      const targetsAtSwing = [
        ...course.orbs,
        ...course.hazardOrbs,
        ...course.movers.map((m) => moverBox(m, t + lead)),
      ];
      const attackPressed = !player.grounded && targetsAtSwing.some((b) => overlaps(predicted, b));

      /*
       * The dash, added for playtest 10's dash gaps.
       *
       * Gated on NEED, not on opportunity, and the first draft got that wrong:
       * dashing whenever there was no orb left to aim at fired on level 1's
       * last pit too and sailed her clean over the landing — the dash locks
       * vertical velocity to zero for a quarter second, so a dash she does not
       * need is a dash that overshoots.
       *
       * So: work out how far a plain fall from here would carry her, and dash
       * only when that is not far enough. On every pit the course already had,
       * it is, and the bot behaves exactly as it always did.
       *
       * The other clauses are the lesson: airborne, the air dash refunded by a
       * bounce, and the pogo PIN finished. Dashing on the frame of the bounce
       * would throw the rise away — `stepPlayer` cancels the pin when a dash
       * starts — so "bounce, THEN dash" is both the reachable maximum and the
       * thing the page teaches.
       */
      const fallReach = (): number => {
        let y = feet.y;
        let vy = player.velocity.y;
        let seconds = 0;
        // The fall is capped at maxFallSpeed, so integrate it rather than
        // solving: 200 steps is a third of a second past any real arc.
        for (let n = 0; n < 200 && y < COURSE_FLOOR_Y; n++) {
          vy = Math.min(PHYSICS.maxFallSpeed, vy + PHYSICS.gravity * FIXED_DT);
          y += vy * FIXED_DT;
          seconds += FIXED_DT;
        }
        return PHYSICS.runSpeed * seconds;
      };
      const dashPressed =
        !player.grounded &&
        target === null &&
        player.airDashAvailable &&
        player.dashCooldownTimer <= 0 &&
        player.pogoPinElapsed < 0 &&
        player.velocity.y > 0 &&
        Number.isFinite(floorAhead) &&
        floorAhead + 9 - feet.x > fallReach();

      input = {
        left,
        right,
        up: false,
        down: !player.grounded,
        jumpPressed,
        jumpHeld,
        attackPressed,
        dashPressed,
      };
    }

    const pogosBefore = player.totalPogos;
    stepPlayer(player, input, world, FIXED_DT);
    if (player.totalPogos > pogosBefore) {
      // Bounced: aim past whatever the nail just hit.
      const nail = activeNailHitbox(player);
      let next = feet.x + 40;
      let hitAnOrb = false;
      if (nail) {
        targets.forEach((b, i) => {
          if (!overlaps(nail, b)) return;
          used.add(i);
          hitAnOrb = true;
          next = Math.max(next, b.x + b.width / 2 + 1);
        });
      }
      if (!hitAnOrb) spikeBounces += 1;
      minTargetX = next;
    }
    const events = stepCourse(course, state, playerHurtbox(player), FIXED_DT);
    if (events.respawned) {
      missXs.push(Math.round(player.position.x));
      respawnPlayer(player, state.respawnPoint);
    }
  }

  return {
    finished: state.finished,
    elapsed: state.elapsed,
    misses: state.misses,
    missXs,
    spikeBounces,
  };
}

describe('Level 1 completability', () => {
  /**
   * The original, dumber bot: run right, jump when the floor runs out ahead,
   * and mash downslash while airborne so any orb (or spike) under the nail
   * becomes a bounce. Level 1 must stay beatable even by this.
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

describe.each(POGO_COURSES.map((c, i) => [i + 1, c.name, c] as const))(
  'Level %i (%s) completability',
  (_level, _name, course) => {
    // Four different start delays shift every drifting orb's phase relative
    // to the bot's arrival: the level must not depend on lucky timing.
    it.each([0, 30, 60, 90])('is beatable by the aiming bot after a %i-step wait', (idle) => {
      const result = runAimingBot(course, idle);
      expect(result, `misses at x = ${result.missXs.join(', ')}`).toMatchObject({
        finished: true,
      });
      expect(result.elapsed).toBeLessThan(240);
      // "Still beatable" means a few slips, not a grind.
      expect(result.misses, `misses at x = ${result.missXs.join(', ')}`).toBeLessThanOrEqual(12);
      // Every bounce was on an orb: the orbs themselves span every gap.
      expect(result.spikeBounces).toBe(0);
    });
  },
);

/**
 * DEV TOOL: remove in the final build. God mode in the course.
 *
 * Same shape as the arena's: `respawned` keeps meaning "move her back to the
 * checkpoint", so pogoCourseSession's respawn branch needs no god-mode check
 * at all, and `wouldHaveRespawned` carries the news for the display.
 */
describe('god mode', () => {
  /** Standing in the tiny course's spike strip (x 200–300, y 80–100). */
  const inTheSpikes = (): AABB => boxAt(250, 100);

  it('reports the touch but leaves her where she is', () => {
    const course = tinyCourse();
    const state = createCourseState(course, true);
    state.started = true;

    const events = stepCourse(course, state, inTheSpikes(), DT);
    expect(events.wouldHaveRespawned).toBe(true);
    // The flag the session's respawn branch reads, which must not fire.
    expect(events.respawned).toBe(false);
  });

  it('still counts the miss, because the miss IS the display', () => {
    const course = tinyCourse();
    const state = createCourseState(course, true);
    state.started = true;
    stepCourse(course, state, inTheSpikes(), DT);
    expect(state.misses).toBe(1);
  });

  it('counts one miss per grace window while she stands in them', () => {
    const course = tinyCourse();
    const state = createCourseState(course, true);
    state.started = true;
    // One second in the spikes, inside the 1.3 s window: one miss, not sixty.
    for (let i = 0; i < 60; i++) stepCourse(course, state, inTheSpikes(), DT);
    expect(state.misses).toBe(1);

    // And the window really does reopen: three seconds is two more of them.
    for (let i = 0; i < 120; i++) stepCourse(course, state, inTheSpikes(), DT);
    expect(state.misses).toBe(3);
  });

  it('treats a hazard orb the same way', () => {
    const course = tinyCourse();
    const state = createCourseState(course, true);
    state.started = true;
    // The hazard orb sits at x 320–348, y 40–68.
    const events = stepCourse(course, state, { x: 325, y: 45, width: 18, height: 20 }, DT);
    expect(events.wouldHaveRespawned).toBe(true);
    expect(events.respawned).toBe(false);
  });

  it('is off unless asked for, and a spike still sends her back', () => {
    const course = tinyCourse();
    const state = createCourseState(course);
    state.started = true;
    expect(state.godMode).toBe(false);
    const events = stepCourse(course, state, inTheSpikes(), DT);
    expect(events.respawned).toBe(true);
    expect(events.wouldHaveRespawned).toBe(false);
  });
});

/**
 * Assist mode in the course. There is no death here to spend a life on, so a
 * life means one thing: the spikes stop costing her the walk back to the
 * lantern. The miss is still counted and still shown, because the miss counter
 * IS the honest display — she is told what it cost, not made to pay it.
 */
describe('assist mode', () => {
  const inTheSpikes = (): AABB => boxAt(250, 100);

  /** Step long enough for the i-frame window to expire between touches. */
  function waitOutGrace(course: CourseDef, state: CourseState): void {
    stepCourse(course, state, boxAt(0, 0), PHYSICS.iFrames + DT);
  }

  it('absorbs the touch and leaves her where she is', () => {
    const course = tinyCourse();
    const state = createCourseState(course, false, 3);
    state.started = true;

    const events = stepCourse(course, state, inTheSpikes(), DT);
    expect(events.absorbedByAssist).toBe(true);
    // The flag the session's respawn branch reads. It must not fire, or she
    // walks back anyway and the life bought her nothing.
    expect(events.respawned).toBe(false);
    expect(state.assistLivesLeft).toBe(2);
  });

  it('still counts the miss, because the miss IS the display', () => {
    const course = tinyCourse();
    const state = createCourseState(course, false, 3);
    state.started = true;
    stepCourse(course, state, inTheSpikes(), DT);
    expect(state.misses).toBe(1);
  });

  it('spends one life per grace window, not one per frame', () => {
    // Without a ticking grace timer, standing in a spike strip would eat all
    // three lives in a twentieth of a second — the bug the god-mode window was
    // written for, which assist has to inherit rather than rediscover.
    const course = tinyCourse();
    const state = createCourseState(course, false, 3);
    state.started = true;
    for (let i = 0; i < 30; i++) stepCourse(course, state, inTheSpikes(), DT);
    expect(state.assistLivesLeft).toBe(2);
    expect(state.misses).toBe(1);
  });

  it('lets the grace window expire, so a second touch costs a second life', () => {
    const course = tinyCourse();
    const state = createCourseState(course, false, 3);
    state.started = true;
    stepCourse(course, state, inTheSpikes(), DT);
    waitOutGrace(course, state);
    stepCourse(course, state, inTheSpikes(), DT);
    expect(state.assistLivesLeft).toBe(1);
    expect(state.misses).toBe(2);
  });

  it('sends her back once the lives are gone — the ordinary rule, unchanged', () => {
    const course = tinyCourse();
    const state = createCourseState(course, false, 1);
    state.started = true;
    stepCourse(course, state, inTheSpikes(), DT);
    waitOutGrace(course, state);

    const events = stepCourse(course, state, inTheSpikes(), DT);
    expect(events.absorbedByAssist).toBe(false);
    expect(events.respawned).toBe(true);
    expect(state.assistLivesLeft).toBe(0);
  });

  it('is off by default, so nothing changes for a run that did not ask for it', () => {
    const course = tinyCourse();
    const state = createCourseState(course);
    state.started = true;
    expect(state.assistLivesLeft).toBe(0);
    expect(stepCourse(course, state, inTheSpikes(), DT).respawned).toBe(true);
  });
});

/**
 * The dash gaps (playtest 10).
 *
 * "In level two, there should be one jump that requires a Pogo and then a dash
 * to clear the gap, so that we know that she knows how to do that."
 *
 * "Requires" is the load-bearing word, so these are sized by SIMULATION on the
 * shipped `stepPlayer` rather than by feel, and pinned here so a physics tune
 * can never quietly make them clearable the wrong way — or, worse, unclearable
 * at all, which would hard-block her.
 *
 * The three reaches that matter, measured against the real physics:
 *
 *   jump alone ................ 375 px
 *   jump + pogo ............... 579 px
 *   jump + air dash, NO pogo .. 636 px   <- the one that binds
 *   jump + pogo + air dash .... 840 px
 *
 * A gap merely wider than a pogo arc is NOT enough: a bare air dash with no
 * pogo at all clears anything under 636. Every gap below sits above that and
 * under 840, so it needs BOTH tools and neither alone.
 *
 * One honest caveat, and it is the same one every other orb-spanning claim in
 * this file carries: spikes are pogoable on purpose (PLAN §5), so a skilled
 * spike-pogo chain crosses any width. The searches below never swing at
 * spikes, exactly as `runAimingBot` does not, and the claim is "impossible
 * without a dash or a spike-pogo chain".
 */
describe('the dash gaps need a pogo AND a dash', () => {
  /** The reach of a bare air dash with no pogo — the number that binds. */
  const DASH_ONLY_REACH = 636;
  /** The reach of a pogo and a dash together. */
  const POGO_AND_DASH_REACH = 840;

  interface Gap {
    level: number;
    course: CourseDef;
    from: number;
    to: number;
  }

  /** The last pit of each level that has one — the dash gap is always last. */
  function dashGap(level: number): Gap {
    const course = POGO_COURSES[level - 1]!;
    // Pit floors sit below the walkway, so the widest low solid is the gap.
    const pits = course.solids
      .filter((s) => s.y > COURSE_FLOOR_Y)
      .map((s) => ({ from: s.x, to: s.x + s.width }));
    const last = pits[pits.length - 1]!;
    return { level, course, from: last.from, to: last.to };
  }

  const GAPS = [dashGap(2), dashGap(3), dashGap(4)];

  /**
   * Run her at the gap and report whether she reached the far walkway.
   *
   * `jumpOffset` is how many ticks after leaving the ledge she jumps (coyote
   * time is real and worth up to ~19 px). `swingAt` and `dashAt` are ticks
   * after the jump, or null for "never". Pogoables deliberately EXCLUDE the
   * spikes.
   */
  function attempt(
    gap: Gap,
    startPhase: number,
    jumpOffset: number,
    swingAt: number | null,
    dashAt: number | null,
  ): boolean {
    const pogoables = (t: number): AABB[] => [
      ...gap.course.orbs,
      ...gap.course.hazardOrbs,
      ...gap.course.movers.map((m) => moverBox(m, t)),
    ];
    const world: World = { solids: gap.course.solids };
    const player = createPlayer(gap.from - 40, COURSE_FLOOR_Y);
    let t = startPhase;
    let left = -1;
    for (let tick = 0; tick < 300; tick++) {
      const feet = player.position;
      if (left < 0 && feet.x - 9 >= gap.from) left = tick;
      const since = left < 0 ? -1 : tick - left;
      const jumpNow = since >= 0 && since === jumpOffset;
      const airborne = !player.grounded;
      const sinceJump = since - jumpOffset;
      const input: InputFrame = {
        left: false,
        right: true,
        up: false,
        down: airborne,
        jumpPressed: jumpNow,
        jumpHeld: jumpNow || (since >= 0 && sinceJump < 12),
        attackPressed: swingAt !== null && sinceJump === swingAt,
        dashPressed: dashAt !== null && sinceJump === dashAt,
      };
      world.pogoables = pogoables(t);
      stepPlayer(player, input, world, FIXED_DT);
      t += FIXED_DT;
      // Landed on the far walkway: her feet are back at floor height, past the
      // far lip. Anything below that is the pit, which is a miss.
      if (player.grounded && player.position.x + 9 > gap.to) return true;
      if (player.position.y > COURSE_FLOOR_Y + 8) return false;
    }
    return false;
  }

  /** Search every line she could take, and report whether ANY of them crosses. */
  function anyCrossing(gap: Gap, opts: { pogo: boolean; dash: boolean }): boolean {
    const phases = gap.course.movers.length > 0 ? [0, 0.4, 0.8, 1.2, 1.6, 2.0] : [0];
    for (const phase of phases) {
      for (let jOff = 0; jOff <= 4; jOff++) {
        const swings = opts.pogo ? Array.from({ length: 90 }, (_, i) => i) : [null];
        for (const swingAt of swings) {
          const dashes = opts.dash ? Array.from({ length: 90 }, (_, i) => i) : [null];
          for (const dashAt of dashes) {
            if (attempt(gap, phase, jOff, swingAt, dashAt)) return true;
          }
        }
      }
    }
    return false;
  }

  it('sits every gap inside the window that needs both tools', () => {
    for (const gap of GAPS) {
      const width = gap.to - gap.from;
      expect(width, `level ${gap.level}`).toBeGreaterThan(DASH_ONLY_REACH);
      expect(width, `level ${gap.level}`).toBeLessThan(POGO_AND_DASH_REACH);
    }
  });

  it('cannot be crossed by pogoing alone, however she times the swing', () => {
    for (const gap of GAPS) {
      expect(anyCrossing(gap, { pogo: true, dash: false }), `level ${gap.level}`).toBe(false);
    }
  });

  it('cannot be crossed by dashing alone, which is the trap the width had to clear', () => {
    // The one a naive sizing gets wrong: "wider than a pogo arc" still leaves a
    // gap a bare air dash clears with no pogo at all, and the drill would prove
    // nothing about the skill it exists to prove.
    for (const gap of GAPS) {
      expect(anyCrossing(gap, { pogo: false, dash: true }), `level ${gap.level}`).toBe(false);
    }
  });

  it('gives every gap a lantern immediately before it, so a miss costs seconds', () => {
    // This is the first thing on the road she cannot walk through, and that was
    // flagged and accepted. What makes it fair is that failing it is cheap.
    for (const gap of GAPS) {
      const before = gap.course.checkpoints
        .map((c) => c.respawn.x)
        .filter((x) => x < gap.from)
        .sort((a, b) => b - a)[0];
      expect(before, `level ${gap.level}`).toBeGreaterThan(gap.from - 200);
    }
  });

  it(`puts a RED drifter in the Gauntlet's gap, and only there`, () => {
    const hazardMovers = (c: CourseDef) => c.movers.filter((m) => m.hazard === true);
    expect(hazardMovers(POGO_COURSE_1)).toHaveLength(0);
    expect(hazardMovers(POGO_COURSES[1]!)).toHaveLength(0);
    expect(hazardMovers(POGO_COURSES[2]!)).toHaveLength(0);
    expect(hazardMovers(POGO_COURSES[3]!)).toHaveLength(1);
  });
});
