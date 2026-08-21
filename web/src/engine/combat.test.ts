/**
 * Nail combat + pogo seam tests (M2).
 *
 * Seam: stepPlayer + activeNailHitbox — swing cadence, directional hitboxes,
 * and the pinned pogo bounce. Expected values from the research doc:
 * cadence 0.41 s start-to-start, startup ≈ 0.05 s, side reach 80 px,
 * down hitbox 108 px wide × 70 px deep, pogo pin 480 px/s for 0.25 s
 * (≈ 120 px rise), pogo refreshes the air dash.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT, PHYSICS } from './constants';
import { activeNailHitbox, createPlayer, stepPlayer } from './player';
import type { InputFrame, World } from './types';

const FLOOR_Y = 600;

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

function spawnGrounded(world: World, x = 0) {
  const player = createPlayer(x, FLOOR_Y);
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

describe('nail swing', () => {
  it('has no live hitbox during startup, then a side hitbox in the facing direction', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    expect(activeNailHitbox(player)).toBeNull(); // ~0.017 s elapsed < 0.05 startup
    steps(player, world, 3, frame());
    const box = activeNailHitbox(player);
    expect(box).not.toBeNull();
    // Facing right: the box extends forward from the center, 80 px reach.
    expect(box!.x).toBeGreaterThanOrEqual(player.position.x - 1);
    expect(box!.width).toBe(PHYSICS.nailReachSide);
  });

  it('goes dead again after the active window closes', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    const totalActive = PHYSICS.nailStartup + PHYSICS.nailActiveTime;
    steps(player, world, Math.ceil(totalActive / FIXED_DT) + 1, frame());
    expect(activeNailHitbox(player)).toBeNull();
  });

  it('enforces the 0.41 s start-to-start cadence', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    // 0.2 s later: press again — must NOT restart the swing.
    steps(player, world, 12, frame());
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    // If a new swing had started, the hitbox would be dead (startup). Instead
    // the old swing is long over and no new one begins until cadence expires.
    steps(player, world, 3, frame());
    expect(activeNailHitbox(player)).toBeNull();
    // After the cadence fully expires, a press swings again.
    steps(player, world, 12, frame());
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    steps(player, world, 3, frame());
    expect(activeNailHitbox(player)).not.toBeNull();
  });

  it('buffers an attack pressed slightly too early', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    // Press again ~0.06 s before the cadence gate opens (0.41 s): buffered.
    const gateSteps = Math.ceil(PHYSICS.nailCadence / FIXED_DT); // 25
    steps(player, world, gateSteps - 4, frame());
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    // Walk forward past the gate: the buffered press must fire the swing.
    steps(player, world, 3 + 3, frame());
    expect(activeNailHitbox(player)).not.toBeNull();
  });

  it('slashes upward when up is held', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ attackPressed: true, up: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ up: true }));
    const box = activeNailHitbox(player);
    expect(box).not.toBeNull();
    // Entirely above the head (head is at feet.y − 48).
    expect(box!.y + box!.height).toBeLessThanOrEqual(player.position.y - 40);
  });

  it('cannot downslash while grounded (side slash instead)', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ attackPressed: true, down: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ down: true }));
    const box = activeNailHitbox(player);
    expect(box).not.toBeNull();
    expect(box!.width).toBe(PHYSICS.nailReachSide); // side geometry, not the 108 px down box
  });

  it('downslashes below the feet while airborne', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    stepPlayer(player, frame({ jumpPressed: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 5, frame({ jumpHeld: true }));
    stepPlayer(player, frame({ attackPressed: true, down: true, jumpHeld: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ down: true, jumpHeld: true }));
    const box = activeNailHitbox(player);
    expect(box).not.toBeNull();
    expect(box!.width).toBe(108); // the generous down-slash width
    expect(box!.y).toBeGreaterThanOrEqual(player.position.y - 1); // below the feet
  });

  it('keeps the hitbox on the side the swing started on', () => {
    const world = flatWorld();
    const player = spawnGrounded(world);
    steps(player, world, 2, frame({ right: true })); // face right
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    steps(player, world, 3, frame({ left: true })); // turn around mid-swing
    const box = activeNailHitbox(player);
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(player.position.x - 1); // still the right side
  });
});

describe('pogo', () => {
  /** Player standing on a ledge with a pogoable orb below and to the right. */
  function pogoWorld(): World {
    return {
      solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }],
      pogoables: [{ x: -60, y: FLOOR_Y - 90, width: 120, height: 40 }],
    };
  }

  /** Jump straight up over the orb, then downslash into it on the way down. */
  function pogoOffOrb(world: World) {
    const player = createPlayer(0, FLOOR_Y - 130); // falling from above the orb
    stepPlayer(player, frame({ attackPressed: true, down: true }), world, FIXED_DT);
    // Step until the bounce fires (hitbox goes live at 0.05 s and the orb is
    // ~0–40 px below the feet, inside the 70 px reach).
    for (let i = 0; i < 8; i++) {
      stepPlayer(player, frame({ down: true }), world, FIXED_DT);
      if (player.velocity.y === -PHYSICS.pogoVelocity) break;
    }
    return player;
  }

  it('bounces at pogoVelocity when an airborne downslash connects', () => {
    const player = pogoOffOrb(pogoWorld());
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
  });

  it('pins the bounce for pogoTime, then cuts vy to 0', () => {
    const world = pogoWorld();
    const player = pogoOffOrb(world);
    // Mid-pin: still exactly pogoVelocity.
    steps(player, world, 8, frame());
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
    // Past 0.25 s: the crisp cutoff has fired and gravity owns vy.
    steps(player, world, 8, frame());
    expect(player.velocity.y).toBeGreaterThanOrEqual(0);
  });

  it('rises ≈ 120 px (~half a jump) from a full bounce', () => {
    const world = pogoWorld();
    const player = pogoOffOrb(world);
    const startY = player.position.y;
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      stepPlayer(player, frame(), world, FIXED_DT);
      peak = Math.max(peak, startY - player.position.y);
    }
    expect(peak).toBeGreaterThan(105);
    expect(peak).toBeLessThan(135);
  });

  it('refreshes the air dash', () => {
    const world = pogoWorld();
    // Start 200 px left of the orb: the air dash carries the player onto it.
    const player = createPlayer(-200, FLOOR_Y - 130);
    // Burn the air dash on the way down.
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    steps(player, world, 16, frame()); // dash over, falling again
    expect(player.airDashAvailable).toBe(false);
    // Pogo the orb.
    stepPlayer(player, frame({ attackPressed: true, down: true }), world, FIXED_DT);
    for (let i = 0; i < 10; i++) {
      stepPlayer(player, frame({ down: true }), world, FIXED_DT);
      if (player.velocity.y === -PHYSICS.pogoVelocity) break;
    }
    expect(player.airDashAvailable).toBe(true);
  });

  it('does not bounce off a side slash', () => {
    const world: World = {
      solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }],
      // Orb directly in front at body height.
      pogoables: [{ x: 30, y: FLOOR_Y - 170, width: 40, height: 40 }],
    };
    const player = createPlayer(0, FLOOR_Y - 130); // airborne beside the orb
    stepPlayer(player, frame({ attackPressed: true }), world, FIXED_DT);
    let bounced = false;
    for (let i = 0; i < 8; i++) {
      stepPlayer(player, frame(), world, FIXED_DT);
      if (player.velocity.y === -PHYSICS.pogoVelocity) bounced = true;
    }
    expect(bounced).toBe(false);
  });

  it('cannot trigger at all during a dash (no queued ghost bounce)', () => {
    // Air-dash straight across an orb with a live downslash the whole way:
    // the dash owns the vertical axis, so no bounce may fire or queue.
    const world: World = {
      solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }],
      pogoables: [{ x: 40, y: FLOOR_Y - 150, width: 120, height: 30 }],
    };
    const player = createPlayer(-80, FLOOR_Y - 140); // airborne, orb ahead
    stepPlayer(player, frame({ dashPressed: true, attackPressed: true, down: true }), world, FIXED_DT);
    const dashSteps = Math.round(PHYSICS.dashDuration / FIXED_DT);
    for (let i = 0; i < dashSteps + 3; i++) {
      stepPlayer(player, frame({ down: true }), world, FIXED_DT);
      expect(player.velocity.y).not.toBe(-PHYSICS.pogoVelocity); // never bounces
    }
    expect(player.totalPogos).toBe(0);
    expect(player.pogoPinElapsed).toBe(-1);
    expect(player.velocity.y).toBeGreaterThan(0); // falling normally post-dash
  });

  it('is interrupted early by a dash, with no ghost bounce afterward', () => {
    const world = pogoWorld();
    const player = pogoOffOrb(world);
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity); // mid-pin
    // Dash immediately: the dash owns vy and the pin is canceled for good.
    stepPlayer(player, frame({ dashPressed: true }), world, FIXED_DT);
    expect(player.velocity.y).toBe(0);
    expect(player.pogoPinElapsed).toBe(-1);
    // Ride out the dash; afterward gravity acts — the pin must NOT resume.
    steps(player, world, Math.round(PHYSICS.dashDuration / FIXED_DT) + 2, frame());
    expect(player.velocity.y).toBeGreaterThan(0);
  });

  it('counts each bounce once (no re-trigger while the hitbox stays overlapped)', () => {
    const world = pogoWorld();
    const player = pogoOffOrb(world);
    const count = player.totalPogos;
    expect(count).toBe(1);
    // Ride the same swing's active window a few more steps over the orb.
    steps(player, world, 4, frame({ down: true }));
    expect(player.totalPogos).toBe(count);
  });
});
