/**
 * Player simulation seam tests (M1).
 *
 * Seam: stepPlayer(state, input, world, dt) — the pure fixed-timestep player
 * step. Expected values come from the decompiled constants in
 * docs/research/hk-frame-data.md, independently of the implementation:
 * run 8.3 u/s = 332 px/s, jump pin 666 px/s for 0.08–0.18 s with instant
 * cutoff, full jump ≈ 236 px, tap jump ≈ 53 px, dash 800 px/s × 0.25 s
 * = 200 px with vy locked, fall cap 800 px/s.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT, KNIGHT, PHYSICS } from './constants';
import {
  activeNailHitbox,
  applyPogoBounce,
  createPlayer,
  respawnPlayer,
  stepPlayer,
} from './player';
import type { InputFrame, World } from './types';

const FLOOR_Y = 600;

/** A wide flat floor with plenty of air above it. */
function flatWorld(): World {
  return { solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }] };
}

function frame(partial: Partial<InputFrame> = {}): InputFrame {
  return {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
    up: false,
    down: false,
    dashPressed: false,
    ...partial,
  };
}

/** Spawn standing on the flat floor (feet exactly on the surface, settled). */
function spawnGrounded(world: World, x = 0) {
  const player = createPlayer(x, FLOOR_Y);
  // One idle step so ground contact is established through the normal path.
  stepPlayer(player, frame(), world, FIXED_DT);
  return player;
}

function steps(
  player: ReturnType<typeof createPlayer>,
  world: World,
  n: number,
  input: InputFrame,
) {
  for (let i = 0; i < n; i++) stepPlayer(player, input, world, FIXED_DT);
}

describe('horizontal movement', () => {
  it('reaches full run speed on the very first step (instant accel)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ right: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(PHYSICS.runSpeed);
  });

  it('stops dead the step input is released (instant decel)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    steps(player, world, 10, frame({ right: true }));
    stepPlayer(player, frame(), world, FIXED_DT);
    expect(player.velocity.x).toBe(0);
  });

  it('reverses to full speed in one step and flips facing', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    steps(player, world, 10, frame({ right: true }));
    expect(player.facing).toBe(1);
    stepPlayer(player, frame({ left: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(-PHYSICS.runSpeed);
    expect(player.facing).toBe(-1);
  });

  it('covers run-speed distance over a second of held input', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    const startX = player.position.x;
    steps(player, world, 60, frame({ right: true }));
    expect(player.position.x - startX).toBeCloseTo(PHYSICS.runSpeed, 0);
  });
});

/** Step until vy turns non-negative (apex passed); return peak rise in px. */
function riseUntilApex(
  player: ReturnType<typeof createPlayer>,
  world: World,
  held: boolean,
): number {
  const startY = player.position.y;
  let peak = 0;
  for (let i = 0; i < 240; i++) {
    stepPlayer(player, frame({ jumpHeld: held }), world, FIXED_DT);
    peak = Math.max(peak, startY - player.position.y);
    if (player.velocity.y >= 0 && i > 2) break;
  }
  return peak;
}

describe('jump', () => {
  it('pins vy to jumpVelocity on the press step', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.velocity.y).toBe(-PHYSICS.jumpVelocity);
    expect(player.grounded).toBe(false);
  });

  it('keeps vy pinned while held through the full hold window', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    // 0.18 s at 60 Hz ≈ 10.8 steps; at step 10 (t = 0.167 s) still pinned.
    steps(player, world, 9, frame({ jumpHeld: true }));
    expect(player.velocity.y).toBe(-PHYSICS.jumpVelocity);
  });

  it('lets gravity take over after jumpHoldMax even if still held', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 13, frame({ jumpHeld: true }));
    expect(player.velocity.y).toBeGreaterThan(-PHYSICS.jumpVelocity);
  });

  it('zeroes vy instantly on release after the minimum hold', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 6, frame({ jumpHeld: true })); // ≈ 0.117 s held
    stepPlayer(player, frame(), world, FIXED_DT); // release
    expect(player.velocity.y).toBe(0);
  });

  it('honors the minimum pin on an instant tap (release before min hold)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    // Released immediately — but vy stays pinned until jumpHoldMin elapses.
    stepPlayer(player, frame(), world, FIXED_DT);
    expect(player.velocity.y).toBe(-PHYSICS.jumpVelocity);
    // After min hold has elapsed the cutoff applies.
    steps(player, world, 5, frame());
    expect(player.velocity.y).toBeGreaterThanOrEqual(0);
  });

  it('full jump rises ≈ 236 px (≈ 5.9 u, the researched full-jump height)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    const peak = riseUntilApex(player, world, true);
    expect(peak).toBeGreaterThan(216);
    expect(peak).toBeLessThan(256);
  });

  it('tap jump rises ≈ 53 px (≈ 1.3 u, the researched tap-jump height)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    const peak = riseUntilApex(player, world, false);
    expect(peak).toBeGreaterThan(43);
    expect(peak).toBeLessThan(63);
  });

  // Decompiled HeroController.JumpReleased() zeroes vy whenever the button is
  // up, vy is upward, and JUMP_STEPS_MIN has passed — it runs every frame from
  // LookForInput(), not only during the 9-step pin. Heights are therefore
  // continuous from the tap minimum to the full ascent (playtest 1, note 6).
  it('zeroes vy on release even after the pin has ended (ballistic ascent)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 13, frame({ jumpHeld: true })); // past 0.18 s: pin over
    expect(player.velocity.y).toBeGreaterThan(-PHYSICS.jumpVelocity); // ballistic
    expect(player.velocity.y).toBeLessThan(0); // but still rising
    stepPlayer(player, frame(), world, FIXED_DT); // release
    expect(player.velocity.y).toBe(0);
  });

  it('gives a continuous range of heights between a late release and a full hold', () => {
    const world = flatWorld();
    const peakFor = (heldSteps: number) => {
      const player = spawnGrounded(world);
      const startY = player.position.y;
      let peak = 0;
      for (let i = 0; i < 240; i++) {
        const held = i < heldSteps;
        stepPlayer(player, frame({ jumpPressed: i === 0, jumpHeld: held }), world, FIXED_DT);
        peak = Math.max(peak, startY - player.position.y);
        if (player.velocity.y >= 0 && i > 2) break;
      }
      return peak;
    };
    const pinEnd = peakFor(11); // released the step the pin ends (≈ 120 px before)
    const mid = peakFor(20); // released ≈ 0.33 s in, mid-ascent
    const full = peakFor(60); // held through the apex
    expect(mid).toBeGreaterThan(pinEnd + 30);
    expect(mid).toBeLessThan(full - 30);
    // No cliff: the biggest gap between neighbouring release times stays small.
    let maxGap = 0;
    let prev = peakFor(5);
    for (let h = 6; h <= 40; h++) {
      const next = peakFor(h);
      maxGap = Math.max(maxGap, next - prev);
      prev = next;
    }
    expect(maxGap).toBeLessThan(16); // one step's worth of rise at most
  });

  it('landing clears the post-pin cut so the next tap jump keeps its full minimum', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    // Full held jump, ride it all the way down.
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    for (let i = 0; i < 240 && !player.grounded; i++) {
      stepPlayer(player, frame({ jumpHeld: true }), world, FIXED_DT);
    }
    expect(player.grounded).toBe(true);
    expect(player.jumpCutArmed).toBe(false);
    // A tap jump right after must still get its 4 pinned steps (≈ 53 px).
    const startY = player.position.y;
    stepPlayer(player, frame({ jumpPressed: true }), world, FIXED_DT);
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      stepPlayer(player, frame(), world, FIXED_DT);
      peak = Math.max(peak, startY - player.position.y);
      if (player.velocity.y >= 0 && i > 2) break;
    }
    expect(peak).toBeGreaterThan(43);
  });

  it('a release does not cut a pogo bounce (the bounce is not a jump)', () => {
    const world = flatWorld();
    world.pogoables = [{ x: -20, y: FLOOR_Y - 120, width: 40, height: 20 }];
    const player = createPlayer(0, FLOOR_Y - 200);
    // Fall onto the orb with a downslash, jump button never touched.
    for (let i = 0; i < 60 && player.totalPogos === 0; i++) {
      stepPlayer(player, frame({ down: true, attackPressed: i % 3 === 0 }), world, FIXED_DT);
    }
    expect(player.totalPogos).toBe(1);
    steps(player, world, 5, frame());
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity); // still pinned, not cut
  });

  it('does not jump midair (no double jump in Kayla’s kit)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 12, frame({ jumpHeld: true }));
    const vyBefore = player.velocity.y;
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.velocity.y).toBeGreaterThan(vyBefore); // gravity kept acting
    expect(player.velocity.y).not.toBe(-PHYSICS.jumpVelocity);
  });

  it('caps fall speed at maxFallSpeed', () => {
    const world: World = { solids: [{ x: -2000, y: 100000, width: 6000, height: 200 }] };
    const player = createPlayer(0, 0);
    steps(player, world, 120, frame()); // 2 s of freefall
    expect(player.velocity.y).toBe(PHYSICS.maxFallSpeed);
  });
});

describe('coyote time and jump buffer', () => {
  /** Floor that ends at x = 300; walking right past it drops you off a ledge. */
  function ledgeWorld(): World {
    return { solids: [{ x: -2000, y: FLOOR_Y, width: 2300, height: 200 }] };
  }

  /** Walk the player off the ledge; returns once airborne. */
  function walkOffLedge(world: World) {
    const player = createPlayer(280, FLOOR_Y);
    stepPlayer(player, frame(), world, FIXED_DT); // settle grounded
    while (player.grounded) stepPlayer(player, frame({ right: true }), world, FIXED_DT);
    return player;
  }

  it('allows a jump shortly after walking off a ledge (coyote time)', () => {
    const world = ledgeWorld();
    const player = walkOffLedge(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.velocity.y).toBe(-PHYSICS.jumpVelocity);
  });

  it('refuses the jump once coyote time has expired', () => {
    const world = ledgeWorld();
    const player = walkOffLedge(world);
    const expiredSteps = Math.ceil(PHYSICS.coyoteTime / FIXED_DT) + 1;
    steps(player, world, expiredSteps, frame());
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.velocity.y).not.toBe(-PHYSICS.jumpVelocity);
  });

  it('does not grant coyote time after a jump (no pin re-trigger midair)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 2, frame({ jumpHeld: true }));
    // Still exactly one pin running — vy is pinned, not re-started.
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 12, frame({ jumpHeld: true }));
    expect(player.velocity.y).toBeGreaterThan(-PHYSICS.jumpVelocity); // pin ended on schedule
  });

  it('buffers a jump pressed just before landing', () => {
    const world = flatWorld();
    const player = createPlayer(0, FLOOR_Y - 1); // lands within the buffer window
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.grounded).toBe(false);
    // Keep holding; within the 0.05 s buffer the landing converts to a jump.
    steps(player, world, 3, frame({ jumpHeld: true }));
    expect(player.velocity.y).toBe(-PHYSICS.jumpVelocity);
  });

  it('drops a buffered jump that is too old by landing time', () => {
    const world = flatWorld();
    const player = createPlayer(0, FLOOR_Y - 200); // long fall (~0.46 s)
    stepPlayer(player, frame({ jumpPressed: true }), world, FIXED_DT);
    // Land, then keep stepping: the stale press must never convert to a jump.
    for (let i = 0; i < 120; i++) {
      stepPlayer(player, frame(), world, FIXED_DT);
      expect(player.velocity.y).not.toBe(-PHYSICS.jumpVelocity);
    }
    expect(player.grounded).toBe(true);
  });

  it('grants no coyote after a jump start (the timer is consumed)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.coyoteTimer).toBe(0);
  });
});

describe('applyPogoBounce', () => {
  /** Airborne, mid-downslash, falling, with a live jump cut armed. */
  function downslashing() {
    const player = createPlayer(0, FLOOR_Y - 200);
    player.nailDir = 'down';
    player.pogoedThisSwing = false;
    player.velocity.y = 300;
    player.jumpCutArmed = true;
    player.airDashAvailable = false;
    return player;
  }

  it('applies the bounce and reports it', () => {
    const player = downslashing();
    expect(applyPogoBounce(player)).toBe(true);
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
    expect(player.pogoPinElapsed).toBe(0);
    expect(player.pogoedThisSwing).toBe(true);
    expect(player.jumpPinElapsed).toBe(-1);
    expect(player.jumpCutArmed).toBe(false);
    expect(player.airDashAvailable).toBe(true);
    expect(player.totalPogos).toBe(1);
  });

  it('bounces at most once per swing', () => {
    const player = downslashing();
    applyPogoBounce(player);
    player.velocity.y = 0;
    expect(applyPogoBounce(player)).toBe(false);
    expect(player.velocity.y).toBe(0);
    expect(player.totalPogos).toBe(1);
  });

  it.each([
    ['grounded', (p: ReturnType<typeof createPlayer>) => void (p.grounded = true)],
    ['dashing', (p: ReturnType<typeof createPlayer>) => void (p.dashTimer = 0.1)],
    ['side slash', (p: ReturnType<typeof createPlayer>) => void (p.nailDir = 'side')],
    ['up slash', (p: ReturnType<typeof createPlayer>) => void (p.nailDir = 'up')],
  ])('refuses without side effects when %s', (_label, arrange) => {
    const player = downslashing();
    arrange(player);
    const before = JSON.stringify(player);
    expect(applyPogoBounce(player)).toBe(false);
    expect(JSON.stringify(player)).toBe(before);
  });
});

describe('respawn', () => {
  it('clears momentum, pins, swings, and buffers but keeps counters', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    player.totalPogos = 7;
    // Get into a messy state: dashing mid-air with a live swing.
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ jumpHeld: true }));
    stepPlayer(player, frame({ dashPressed: true, attackPressed: true }), world, FIXED_DT);
    respawnPlayer(player, { x: 50, y: FLOOR_Y });
    expect(player.position).toEqual({ x: 50, y: FLOOR_Y });
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(player.dashTimer).toBe(0);
    expect(player.jumpPinElapsed).toBe(-1);
    expect(player.pogoPinElapsed).toBe(-1);
    expect(activeNailHitbox(player)).toBeNull();
    expect(player.totalPogos).toBe(7); // scoring survives
    // And he can act again immediately: a jump works on the next steps.
    steps(player, world, 2, frame()); // settle onto the floor
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.velocity.y).toBe(-PHYSICS.jumpVelocity);
  });
});

describe('collision', () => {
  it('stops flush against a wall instead of passing through', () => {
    const world: World = {
      solids: [
        { x: -2000, y: FLOOR_Y, width: 6000, height: 200 },
        { x: 200, y: FLOOR_Y - 400, width: 40, height: 400 }, // wall ahead
      ],
    };
    const player = spawnGrounded(world, 0);
    steps(player, world, 120, frame({ right: true })); // run at the wall for 2 s
    expect(player.position.x).toBeCloseTo(200 - KNIGHT.hurtboxWidth / 2, 5);
  });

  it('cancels the jump pin on a head bump and falls back down', () => {
    const world: World = {
      solids: [
        { x: -2000, y: FLOOR_Y, width: 6000, height: 200 },
        { x: -2000, y: FLOOR_Y - 120, width: 6000, height: 20 }, // low ceiling
      ],
    };
    const player = spawnGrounded(world, 0);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 30, frame({ jumpHeld: true }));
    // Half a second later he must be back on the floor, not glued to the ceiling.
    expect(player.grounded).toBe(true);
    expect(player.position.y).toBe(FLOOR_Y);
  });

  it('falls immediately after a head bump instead of pinning against the ceiling', () => {
    const world: World = {
      solids: [
        { x: -2000, y: FLOOR_Y, width: 6000, height: 200 },
        { x: -2000, y: FLOOR_Y - 120, width: 6000, height: 20 },
      ],
    };
    const player = spawnGrounded(world, 0);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    // Rise of ~53 px to the ceiling ≈ 5 pin steps; by step 8 gravity must own vy.
    steps(player, world, 7, frame({ jumpHeld: true }));
    expect(player.velocity.y).toBeGreaterThan(0);
  });
});

describe('dash', () => {
  it('lands the dash timer on exactly zero, so the streak stops (playtest 3, note 5)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    steps(player, world, dashSteps - 1, frame());
    // toBe, never toBeCloseTo: the bug this pins IS a value too small to see
    // (4.9e-17), and drawKnight gates the streak on `dashTimer > 0`.
    expect(player.dashTimer).toBe(0);
  });

  it('keeps the dash exactly as long as it was, so the snap costs no frame', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    steps(player, world, dashSteps - 2, frame());
    // Step 15 of 15 is still the dash...
    stepPlayer(player, frame(), world, FIXED_DT);
    expect(player.velocity.x).toBe(PHYSICS.dashSpeed);
    // ...and step 16 is not.
    stepPlayer(player, frame(), world, FIXED_DT);
    expect(player.velocity.x).not.toBe(PHYSICS.dashSpeed);
  });

  it('stays grounded through a ground dash (feet never leave the floor)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    for (let i = 0; i < dashSteps - 1; i++) {
      stepPlayer(player, frame(), world, FIXED_DT);
      expect(player.grounded).toBe(true);
      expect(player.position.y).toBe(FLOOR_Y);
    }
  });

  it('gives a side slash, not a downslash, when slashing down mid ground dash', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    stepPlayer(player, frame(), world, FIXED_DT);
    stepPlayer(player, frame({ attackPressed: true, down: true }), world, FIXED_DT);
    expect(player.nailDir).toBe('side'); // he's on the ground — no down box
  });

  it('cancels a jump pin, which stays dead after the dash ends', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ jumpHeld: true })); // mid-pin, rising
    stepPlayer(player, frame({ dashPressed: true, jumpHeld: true }), world, FIXED_DT);
    expect(player.jumpPinElapsed).toBe(-1);
    expect(player.velocity.y).toBe(0); // dash owns vy
    // After the dash: gravity, never a resumed pin.
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    steps(player, world, dashSteps + 2, frame({ jumpHeld: true }));
    expect(player.velocity.y).toBeGreaterThan(0);
  });

  it('moves at dashSpeed in the facing direction for the dash duration', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    const startX = player.position.x;
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(PHYSICS.dashSpeed);
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    steps(player, world, dashSteps - 1, frame());
    // 0.25 s at 800 px/s ≈ 200 px covered.
    expect(player.position.x - startX).toBeGreaterThan(190);
    expect(player.position.x - startX).toBeLessThanOrEqual(205);
  });

  it('dashes left when facing left', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ left: true }), world, FIXED_DT);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(-PHYSICS.dashSpeed);
  });

  it('locks vy to 0 while dashing in the air (no fall during dash)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 12, frame({ jumpHeld: true })); // pin over, midair
    const y = player.position.y;
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    steps(player, world, 8, frame());
    expect(player.velocity.y).toBe(0);
    expect(player.position.y).toBe(y); // held altitude the whole dash
  });

  it('resumes gravity when the dash ends', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 12, frame({ jumpHeld: true }));
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    steps(player, world, dashSteps + 2, frame());
    expect(player.velocity.y).toBeGreaterThan(0); // falling again
  });

  it('ignores movement input while dashing', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    stepPlayer(player, frame({ left: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(PHYSICS.dashSpeed); // still dashing right
  });

  it('enforces the start-to-start cooldown', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    steps(player, world, dashSteps, frame()); // dash over, cooldown still running
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.x).not.toBe(PHYSICS.dashSpeed);
    // Wait out the rest of the 0.6 s cooldown, then it works again.
    const remaining = Math.ceil((PHYSICS.dashCooldown - PHYSICS.dashDuration) / FIXED_DT) + 2;
    steps(player, world, remaining, frame());
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(PHYSICS.dashSpeed);
  });

  it('allows exactly one air dash until landing', () => {
    // Deep world: long fall so both attempts happen airborne.
    const world: World = { solids: [{ x: -2000, y: 5000, width: 6000, height: 200 }] };
    const player = createPlayer(0, 0);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(PHYSICS.dashSpeed); // first air dash fires
    // Ride out dash + full cooldown, still airborne.
    steps(player, world, 40, frame());
    expect(player.grounded).toBe(false);
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.x).not.toBe(PHYSICS.dashSpeed); // spent until landing
  });

  it('restores the air dash on landing', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    // Air dash once...
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ jumpHeld: true }));
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    // ...land, wait out cooldown, and the next dash fires.
    for (let i = 0; i < 120 && !player.grounded; i++) stepPlayer(player, frame(), world, FIXED_DT);
    expect(player.grounded).toBe(true);
    steps(player, world, 40, frame());
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ jumpHeld: true }));
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.x).toBe(PHYSICS.dashSpeed);
  });
});
