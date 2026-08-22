/**
 * Player simulation (M1): run/jump/dash movement per the decompiled
 * Hollow Knight constants in constants.ts. Pure logic — no canvas, no DOM.
 *
 * Coordinate conventions:
 * - y grows downward (canvas space); gravity is +y, jumps are −y.
 * - `position` is the player's FEET CENTER; the hurtbox hangs above it
 *   (x − w/2, y − h, w, h). Feet-anchored positions keep ground snapping
 *   and sprite drawing trivial.
 */

import { KNIGHT, PHYSICS } from './constants';
import type { AABB, InputFrame, PlayerState, World } from './types';

/**
 * Slack for timer comparisons whose thresholds are an exact number of steps
 * (e.g. 0.25 s = 15 steps): accumulated float error must not add or drop a
 * simulation step.
 */
const TIME_EPS = 1e-9;

/** Full simulation state for the Knight. PlayerState plus M1 timers. */
export interface Player extends PlayerState {
  /**
   * Seconds vy has been pinned to −jumpVelocity so far; −1 when not in the
   * pinned phase. HK re-applies jump velocity every step while ascending
   * rather than applying a one-shot impulse — this is what "pinned" means.
   */
  jumpPinElapsed: number;
  /**
   * The pin has ended but this jump's ascent continues ballistically; a
   * release while still rising cuts vy to 0. HK's JumpReleased() runs every
   * frame the button is up (after JUMP_STEPS_MIN), not only during the pin —
   * this is what makes heights continuous from a tap to a full jump.
   */
  jumpCutArmed: boolean;
  /** Seconds of post-ledge grace remaining in which a jump is still allowed. */
  coyoteTimer: number;
  /** Seconds remaining in which a recent jump press still counts on landing. */
  jumpBufferTimer: number;
  /** Seconds of dash remaining; 0 when not dashing. */
  dashTimer: number;
  /** Seconds until the next dash may start (start-to-start cooldown). */
  dashCooldownTimer: number;
  /** Seconds remaining in which a recent dash press still counts. */
  dashBufferTimer: number;
  /** Direction the current/last dash travels. */
  dashDir: 1 | -1;
  /** One air dash per airtime; restored on landing and on every pogo. */
  airDashAvailable: boolean;
  /** Seconds since the current swing started; ≥ nailSwingTime when idle. */
  nailTimer: number;
  /** Seconds until the next swing may start (0.41 s start-to-start cadence). */
  nailCooldownTimer: number;
  /** Seconds remaining in which a recent attack press still counts. */
  attackBufferTimer: number;
  /** Direction of the current/last swing, fixed at swing start. */
  nailDir: 'side' | 'up' | 'down';
  /** Facing captured at swing start — turning mid-swing doesn't move the arc. */
  nailFacing: 1 | -1;
  /** A downslash bounces at most once per swing. */
  pogoedThisSwing: boolean;
  /** Like jumpPinElapsed, for the pogo's pinned 0.25 s rise; −1 when inactive. */
  pogoPinElapsed: number;
  /** Lifetime bounce count — practice modes read this for scoring. */
  totalPogos: number;
  /** Increments at every swing start; consumers dedupe hits per swing. */
  swingId: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    position: { x, y },
    velocity: { x: 0, y: 0 },
    facing: 1,
    grounded: false,
    jumpPinElapsed: -1,
    jumpCutArmed: false,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashBufferTimer: 0,
    dashDir: 1,
    airDashAvailable: true,
    nailTimer: Number.POSITIVE_INFINITY,
    nailCooldownTimer: 0,
    attackBufferTimer: 0,
    nailDir: 'side',
    nailFacing: 1,
    pogoedThisSwing: true,
    pogoPinElapsed: -1,
    totalPogos: 0,
    swingId: 0,
  };
}

/**
 * The live slash hitbox, or null outside the active window. Geometry is the
 * decompiled collider bboxes converted to px: side 80 × 64 forward from the
 * center, up 96 wide × 80 above the head, down 108 wide × 70 below the feet.
 */
export function activeNailHitbox(p: Player): AABB | null {
  const t = p.nailTimer;
  // TIME_EPS keeps the window an exact 9 steps: 0.05–0.20 s are integral in
  // steps, and accumulated float error must not add a frame at the boundary.
  if (
    t < PHYSICS.nailStartup - TIME_EPS ||
    t >= PHYSICS.nailStartup + PHYSICS.nailActiveTime - TIME_EPS
  ) {
    return null;
  }
  const { x, y } = p.position;
  switch (p.nailDir) {
    case 'side':
      return {
        x: p.nailFacing === 1 ? x : x - PHYSICS.nailReachSide,
        y: y - 56,
        width: PHYSICS.nailReachSide,
        height: 64,
      };
    case 'up':
      return {
        x: x - 48,
        y: y - KNIGHT.spriteHeight - PHYSICS.nailReachUp,
        width: 96,
        height: PHYSICS.nailReachUp,
      };
    case 'down':
      return { x: x - 54, y, width: 108, height: PHYSICS.nailReachDown };
  }
}

/**
 * Reset motion state and move the player to a respawn point. Counters
 * (totalPogos) survive; momentum, pins, swings, and buffers do not.
 */
export function respawnPlayer(p: Player, feet: { x: number; y: number }): void {
  p.position.x = feet.x;
  p.position.y = feet.y;
  p.velocity.x = 0;
  p.velocity.y = 0;
  p.grounded = false;
  p.jumpPinElapsed = -1;
  p.jumpCutArmed = false;
  p.coyoteTimer = 0;
  p.jumpBufferTimer = 0;
  p.dashTimer = 0;
  p.dashBufferTimer = 0;
  p.nailTimer = Number.POSITIVE_INFINITY;
  p.attackBufferTimer = 0;
  p.pogoedThisSwing = true;
  p.pogoPinElapsed = -1;
}

/** Hurtbox for a feet-center position. */
export function playerHurtbox(p: Player): AABB {
  return {
    x: p.position.x - KNIGHT.hurtboxWidth / 2,
    y: p.position.y - KNIGHT.hurtboxHeight,
    width: KNIGHT.hurtboxWidth,
    height: KNIGHT.hurtboxHeight,
  };
}

function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Advance the player by one fixed step. Velocity is SET, never ramped —
 * instant accel/decel with full air control is the core of the HK feel.
 */
export function stepPlayer(p: Player, input: InputFrame, world: World, dt: number): void {
  const wasDashing = p.dashTimer > TIME_EPS;

  // --- horizontal intent (a dash owns the horizontal axis) ---
  if (!wasDashing) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.velocity.x = dir * PHYSICS.runSpeed;
    if (dir !== 0) p.facing = dir as 1 | -1;
  }

  // --- dash start (press or fresh buffer; ground dash, or the one air dash) ---
  if (input.dashPressed) p.dashBufferTimer = PHYSICS.dashBuffer;
  const wantsDash = input.dashPressed || p.dashBufferTimer > 0;
  if (wantsDash && !wasDashing && p.dashCooldownTimer <= 0 && (p.grounded || p.airDashAvailable)) {
    p.dashTimer = PHYSICS.dashDuration;
    p.dashCooldownTimer = PHYSICS.dashCooldown;
    p.dashBufferTimer = 0;
    p.dashDir = p.facing;
    if (!p.grounded) p.airDashAvailable = false;
    p.jumpPinElapsed = -1; // dashing cancels the jump pin, like HK
    p.jumpCutArmed = false;
    p.pogoPinElapsed = -1; // ...and interrupts a pogo bounce early
  }
  const dashing = p.dashTimer > TIME_EPS;

  // --- nail swing start (press or fresh buffer, gated by cadence) ---
  if (input.attackPressed) p.attackBufferTimer = PHYSICS.attackBuffer;
  if (p.attackBufferTimer > 0 && p.nailCooldownTimer <= 0) {
    p.nailTimer = 0;
    p.nailCooldownTimer = PHYSICS.nailCadence;
    p.attackBufferTimer = 0;
    p.nailFacing = p.facing;
    p.nailDir = input.down && !p.grounded ? 'down' : input.up ? 'up' : 'side';
    p.pogoedThisSwing = false;
    p.swingId += 1;
  }

  // --- jump start (press or a still-fresh buffered press; ground or coyote) ---
  if (input.jumpPressed) p.jumpBufferTimer = PHYSICS.jumpBuffer;
  const wantsJump = input.jumpPressed || p.jumpBufferTimer > 0;
  const canJump = p.grounded || p.coyoteTimer > 0;
  if (wantsJump && canJump && p.jumpPinElapsed < 0 && !dashing) {
    p.jumpPinElapsed = 0;
    p.jumpBufferTimer = 0;
    p.coyoteTimer = 0;
  }

  // --- vertical: dash locks vy, else pogo pin, else jump pin, else gravity ---
  if (dashing) {
    p.velocity.x = p.dashDir * PHYSICS.dashSpeed;
    p.velocity.y = 0;
    p.dashTimer = Math.max(0, p.dashTimer - dt);
  } else if (p.pogoPinElapsed >= 0) {
    // Pinned pogo rise: not hold-dependent — always the full 0.25 s unless
    // a dash or head bump interrupts it. The epsilon keeps the 15-step pin
    // exact despite accumulated float error (0.25 is integral in steps).
    if (p.pogoPinElapsed >= PHYSICS.pogoTime - TIME_EPS) {
      p.velocity.y = 0; // the same crisp cutoff as the jump
      p.pogoPinElapsed = -1;
    } else {
      p.velocity.y = -PHYSICS.pogoVelocity;
      p.pogoPinElapsed += dt;
    }
  } else {
    let pinnedThisStep = false;
    if (p.jumpPinElapsed >= 0) {
      // Live check, not a latch: HK calls JumpReleased() every frame the
      // button is simply up, so a release-and-repress before the minimum
      // hold does not cut (decompiled HeroController, verified Session 5).
      const pastMin = p.jumpPinElapsed >= PHYSICS.jumpHoldMin;
      const pastMax = p.jumpPinElapsed >= PHYSICS.jumpHoldMax;
      if (!input.jumpHeld && pastMin) {
        // Crisp cutoff: vy → 0 the moment release is honored.
        p.velocity.y = 0;
        p.jumpPinElapsed = -1;
        pinnedThisStep = true; // gravity waits one step, like HK's JumpReleased
      } else if (pastMax) {
        p.jumpPinElapsed = -1; // ballistic from here; gravity acts below
        p.jumpCutArmed = true; // ...but a release still cuts the rise
      } else {
        p.velocity.y = -PHYSICS.jumpVelocity;
        p.jumpPinElapsed += dt;
        pinnedThisStep = true;
      }
    }
    if (p.jumpCutArmed && !input.jumpHeld && p.velocity.y < 0) {
      // Post-pin release: the same crisp cutoff, any time during the rise.
      p.velocity.y = 0;
      p.jumpCutArmed = false;
      pinnedThisStep = true;
    } else if (p.jumpCutArmed && p.velocity.y >= 0) {
      p.jumpCutArmed = false; // apex passed: nothing left to cut
    }
    if (!pinnedThisStep) {
      p.velocity.y = Math.min(p.velocity.y + PHYSICS.gravity * dt, PHYSICS.maxFallSpeed);
    }
  }

  // --- integrate & collide, axis-separated ---
  moveX(p, world, p.velocity.x * dt);
  moveY(p, world, p.velocity.y * dt);

  // --- pogo: an airborne downslash connecting with a pogoable bounces once.
  // Never during a dash: the dash owns the vertical axis, and HK's dash and
  // bounce are mutually exclusive — without this gate a mid-dash contact
  // would queue a "ghost bounce" that detonates when the dash ends. ---
  if (!dashing && !p.pogoedThisSwing && p.nailDir === 'down' && !p.grounded && world.pogoables) {
    const nail = activeNailHitbox(p);
    if (nail) {
      for (const target of world.pogoables) {
        if (!overlaps(nail, target)) continue;
        p.pogoedThisSwing = true;
        p.pogoPinElapsed = 0;
        p.velocity.y = -PHYSICS.pogoVelocity;
        p.jumpPinElapsed = -1;
        p.jumpCutArmed = false; // a bounce is not a jump: release can't cut it
        p.airDashAvailable = true; // every pogo refreshes the dash, like HK
        p.totalPogos += 1;
        break;
      }
    }
  }

  // --- swing/cooldown clocks ---
  if (Number.isFinite(p.nailTimer)) p.nailTimer += dt;
  p.nailCooldownTimer = Math.max(0, p.nailCooldownTimer - dt);
  p.attackBufferTimer = Math.max(0, p.attackBufferTimer - dt);

  // --- post-move timers ---
  if (p.grounded) {
    p.coyoteTimer = PHYSICS.coyoteTime;
    p.airDashAvailable = true;
  } else {
    p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
  }
  p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
  p.dashBufferTimer = Math.max(0, p.dashBufferTimer - dt);
  p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dt);
}

function moveX(p: Player, world: World, dx: number): void {
  p.position.x += dx;
  const box = playerHurtbox(p);
  for (const solid of world.solids) {
    if (!overlaps(box, solid)) continue;
    if (dx > 0) {
      p.position.x = solid.x - KNIGHT.hurtboxWidth / 2;
    } else if (dx < 0) {
      p.position.x = solid.x + solid.width + KNIGHT.hurtboxWidth / 2;
    }
    p.velocity.x = 0;
  }
}

function moveY(p: Player, world: World, dy: number): void {
  if (dy === 0) {
    // No vertical motion (vy is locked during a dash): sweep-and-snap would
    // wrongly clear grounded, so keep it via a support probe — feet flush
    // on a solid's surface with horizontal overlap means still standing.
    p.grounded = world.solids.some(
      (s) =>
        Math.abs(p.position.y - s.y) < 0.5 &&
        p.position.x + KNIGHT.hurtboxWidth / 2 > s.x &&
        p.position.x - KNIGHT.hurtboxWidth / 2 < s.x + s.width,
    );
    return;
  }
  p.position.y += dy;
  p.grounded = false;
  const box = playerHurtbox(p);
  for (const solid of world.solids) {
    if (!overlaps(box, solid)) continue;
    if (dy > 0) {
      // Landed: snap feet to the surface. Landing is a hard reset of the
      // post-pin cut, like a head bump — never trust the apex clear alone.
      p.position.y = solid.y;
      p.velocity.y = 0;
      p.grounded = true;
      p.jumpCutArmed = false;
    } else if (dy < 0) {
      // Head bump: snap below the ceiling and cancel the jump pin so gravity
      // takes over immediately — no hovering pressed against the ceiling.
      p.position.y = solid.y + solid.height + KNIGHT.hurtboxHeight;
      p.velocity.y = 0;
      p.jumpPinElapsed = -1;
      p.jumpCutArmed = false;
      p.pogoPinElapsed = -1;
    }
  }
}
