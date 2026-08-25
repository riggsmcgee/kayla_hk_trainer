/**
 * Enemy behavior seam tests (M3): the walker and flier dummies.
 *
 * Seam: createEnemy/stepEnemy plus applyNailHit. Expected behavior from the
 * plan and research: walker patrols at 80 px/s and turns at walls and ledge
 * edges; flier drifts around a home point without wandering off; enemies
 * take one nail hit per swing, die at 0 hp.
 */
import { describe, expect, it } from 'vitest';
import type { EnemyId } from '@dojo/shared';
import { CANVAS, ENEMIES, FIXED_DT } from './constants';
import { arenaWorld, spawnX } from './dodgeArenaSession';
import {
  ATTACKS,
  applyNailHit,
  createEnemy,
  enemyAttackHitbox,
  enemyBox,
  stepEnemy,
  stepProjectile,
  type Enemy,
  type Projectile,
  type Target,
} from './enemies';
import { createPlayer, playerHurtbox } from './player';
import type { AABB, World } from './types';

const FLOOR_Y = 600;

/** A floor slab from x = 0 to x = 400 with walls beyond both ends. */
function ledgeWorld(): World {
  return {
    solids: [
      { x: 0, y: FLOOR_Y, width: 400, height: 100 },
      { x: -40, y: 0, width: 40, height: 700 }, // left wall
    ],
  };
}

describe('walker', () => {
  it('patrols at its tuned speed', () => {
    const world = ledgeWorld();
    const walker = createEnemy('walker', 200, FLOOR_Y);
    const x0 = walker.position.x;
    for (let i = 0; i < 60; i++) stepEnemy(walker, world, FIXED_DT);
    expect(Math.abs(walker.position.x - x0)).toBeCloseTo(ENEMIES.walker.speed!, 0);
  });

  it('turns around at a ledge edge instead of walking off', () => {
    const world = ledgeWorld();
    const walker = createEnemy('walker', 350, FLOOR_Y);
    walker.facing = 1; // heading for the edge at x = 400
    for (let i = 0; i < 120; i++) stepEnemy(walker, world, FIXED_DT);
    // Two seconds later he must still be on the slab, now heading back.
    expect(walker.position.x).toBeLessThan(400);
    expect(walker.facing).toBe(-1);
  });

  it('turns around at a wall', () => {
    const world = ledgeWorld();
    const walker = createEnemy('walker', 50, FLOOR_Y);
    walker.facing = -1; // heading for the wall at x = 0
    for (let i = 0; i < 120; i++) stepEnemy(walker, world, FIXED_DT);
    expect(walker.facing).toBe(1);
    expect(walker.position.x).toBeGreaterThan(0);
  });
});

describe('flier', () => {
  it('drifts but stays near its home point', () => {
    const world = ledgeWorld();
    const flier = createEnemy('flier', 200, 300);
    let maxDist = 0;
    let moved = false;
    const x0 = flier.position.x;
    for (let i = 0; i < 600; i++) {
      stepEnemy(flier, world, FIXED_DT);
      const dx = flier.position.x - 200;
      const dy = flier.position.y - 300;
      maxDist = Math.max(maxDist, Math.hypot(dx, dy));
      if (flier.position.x !== x0) moved = true;
    }
    expect(moved).toBe(true);
    expect(maxDist).toBeLessThan(160); // bobbing, not wandering away
  });
});

describe('nail hits', () => {
  it('takes exactly one hit per swing, and dies at zero hp', () => {
    const world = ledgeWorld();
    const walker = createEnemy('walker', 200, FLOOR_Y);
    const player = createPlayer(150, FLOOR_Y);
    player.swingId = 1;

    expect(applyNailHit(player, walker)).toBe(true);
    expect(walker.hp).toBe(ENEMIES.walker.hp - 1);
    // Same swing again: no double dip.
    expect(applyNailHit(player, walker)).toBe(false);
    expect(walker.hp).toBe(ENEMIES.walker.hp - 1);
    // Next swing kills (walker hp is 2).
    player.swingId = 2;
    expect(applyNailHit(player, walker)).toBe(true);
    expect(walker.hp).toBe(0);
    expect(walker.dead).toBe(true);
    // Dead enemies can't be hit.
    player.swingId = 3;
    expect(applyNailHit(player, walker)).toBe(false);
    void world;
  });

  it('flashes briefly when hit', () => {
    const walker = createEnemy('walker', 200, FLOOR_Y);
    const player = createPlayer(150, FLOOR_Y);
    player.swingId = 1;
    applyNailHit(player, walker);
    expect(walker.hurtFlashTimer).toBeGreaterThan(0);
  });
});

describe('enemyBox', () => {
  it('anchors the box at the feet center like the player', () => {
    const walker = createEnemy('walker', 200, FLOOR_Y);
    const box = enemyBox(walker);
    expect(box.y + box.height).toBe(FLOOR_Y);
    expect(box.x + box.width / 2).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Playtest 2 — "every enemy hunts her": no corner of the arena is safe.
// ---------------------------------------------------------------------------

function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The arena she actually plays in — the session's own geometry, not a mirror. */
function flatArena(): World {
  return arenaWorld();
}

/**
 * The Colosseum's old two-ledge geometry, kept by hand.
 *
 * Playtest 3 note 7 deleted these ledges from the game, but the behaviour
 * they provoke — the walker's edge turn, the flier's sidestep around a
 * platform — is still in the enemies and still has to work the day someone
 * builds a stage with a platform in it. Same coordinates as the shipped
 * ledges were, so the tests below read as they always did: solids[3] is the
 * left ledge, solids[4] the right.
 */
function platformArena(): World {
  const w = arenaWorld();
  w.solids.push(
    { x: 190, y: FLOOR_Y - 130, width: 140, height: 18 },
    { x: 838, y: FLOOR_Y - 130, width: 140, height: 18 },
  );
  return w;
}

const ROSTER: EnemyId[] = ['walker', 'flier', 'duelist', 'spitter', 'warden'];
const AIRBORNE = new Set<EnemyId>(['flier', 'spitter']);
/** Hugging the left wall, dead centre, hugging the right wall (the hurtbox is 18 px wide). */
const GROUND_SPOTS: Array<[number, number]> = [
  [30, FLOOR_Y],
  [CANVAS.width / 2, FLOOR_Y],
  [CANVAS.width - 30, FLOOR_Y],
];
/** Spawn where the session would: the far side of the arena at the enemy's normal height. */
function spawnFarFrom(id: EnemyId, playerX: number): Enemy {
  return createEnemy(id, spawnX(0, playerX), AIRBORNE.has(id) ? 430 : FLOOR_Y);
}

interface Hunt {
  /** Steps until something of the enemy's touched the Knight, or -1. */
  hitAt: number;
  /** Closest horizontal approach over the run. */
  minAdx: number;
  /** Steps on which the enemy's body sat inside world geometry. */
  stuckSteps: number;
}

/** Ten simulated seconds of one enemy hunting a Knight who never moves. */
function hunt(id: EnemyId, spot: [number, number], world: World, seconds = 10): Hunt {
  const player = createPlayer(spot[0], spot[1]);
  player.grounded = true;
  const target: Target = { position: player.position, grounded: true };
  const hurt = playerHurtbox(player);
  const e = spawnFarFrom(id, spot[0]);
  let shots: Projectile[] = [];
  let hitAt = -1;
  let minAdx = Number.POSITIVE_INFINITY;
  let stuckSteps = 0;
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    const spawned = stepEnemy(e, world, FIXED_DT, target);
    if (spawned) shots.push(...spawned);
    for (const s of shots) stepProjectile(s, world, FIXED_DT);
    const body = enemyBox(e);
    if (world.solids.some((s) => overlaps(body, s))) stuckSteps++;
    minAdx = Math.min(minAdx, Math.abs(e.position.x - player.position.x));
    const attack = enemyAttackHitbox(e);
    const shotHit = shots.some(
      (s) =>
        !s.dead &&
        overlaps(hurt, {
          x: s.position.x - s.radius,
          y: s.position.y - s.radius,
          width: s.radius * 2,
          height: s.radius * 2,
        }),
    );
    if (hitAt < 0 && (overlaps(body, hurt) || (attack && overlaps(attack, hurt)) || shotHit)) {
      hitAt = i;
    }
    shots = shots.filter((s) => !s.dead);
  }
  return { hitAt, minAdx, stuckSteps };
}

describe('hunting — no safe corner (playtest 2)', () => {
  // One arena now, so one pass: the Colosseum and the finale play on the
  // same flat floor (playtest 3, note 7).
  describe.each(ROSTER)('%s', (id) => {
    it.each(GROUND_SPOTS)('reaches a Knight standing still at (%i, %i) within 10 s', (x, y) => {
      const h = hunt(id, [x, y], flatArena());
      expect(h.stuckSteps).toBe(0);
      expect(h.hitAt).toBeGreaterThanOrEqual(0);
    });

    // And on a platform stage, should one ever exist: the fliers reach her;
    // the ground enemies can't climb, so they pace directly beneath her.
    it.each(GROUND_SPOTS)('hunts from a platform world at (%i, %i) too', (x, y) => {
      const h = hunt(id, [x, y], platformArena());
      expect(h.stuckSteps).toBe(0);
      expect(h.hitAt).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('the arena floor (playtest 3, note 7)', () => {
  it('is flat: a floor and two walls, and nothing to stand on', () => {
    // Stated as a property, not as a deletion, so the ledges cannot come back
    // by accident.
    expect(arenaWorld().solids).toHaveLength(3);
  });
});

describe('walker hunting', () => {
  it('turns toward the Knight and walks at her', () => {
    const world = ledgeWorld();
    const walker = createEnemy('walker', 100, FLOOR_Y);
    walker.facing = -1; // looking away
    const t: Target = { position: { x: 350, y: FLOOR_Y }, grounded: true };
    const x0 = walker.position.x;
    for (let i = 0; i < 60; i++) stepEnemy(walker, world, FIXED_DT, t);
    expect(walker.facing).toBe(1);
    expect(walker.position.x - x0).toBeCloseTo(ATTACKS.walker.chaseSpeed, 0);
  });

  it('will not walk off a ledge edge chasing a Knight beyond it', () => {
    const world = ledgeWorld(); // slab ends at x = 400
    const walker = createEnemy('walker', 300, FLOOR_Y);
    const t: Target = { position: { x: 700, y: FLOOR_Y }, grounded: true };
    for (let i = 0; i < 300; i++) {
      stepEnemy(walker, world, FIXED_DT, t);
      expect(walker.position.x).toBeLessThan(400);
      expect(walker.position.x).toBeGreaterThan(0);
    }
  });

  it('paces beneath a Knight standing on a platform above it', () => {
    const world = platformArena();
    const walker = createEnemy('walker', 700, FLOOR_Y);
    const t: Target = { position: { x: 260, y: FLOOR_Y - 130 }, grounded: true };
    for (let i = 0; i < 600; i++) stepEnemy(walker, world, FIXED_DT, t);
    expect(Math.abs(walker.position.x - 260)).toBeLessThan(40);
    expect(walker.position.y).toBe(FLOOR_Y); // never climbed, never sank
  });
});

describe('flier hunting', () => {
  it('drifts its home toward the Knight at the hunt speed, still bobbing deterministically', () => {
    const world = flatArena();
    const a = createEnemy('flier', 900, 430);
    const b = createEnemy('flier', 900, 430);
    const t: Target = { position: { x: 100, y: FLOOR_Y }, grounded: true };
    for (let i = 0; i < 60; i++) {
      stepEnemy(a, world, FIXED_DT, t);
      stepEnemy(b, world, FIXED_DT, t);
    }
    expect(Math.hypot(a.home.x - 900, a.home.y - 430)).toBeCloseTo(ATTACKS.flier.huntSpeed, 0);
    expect(a.home.x).toBeLessThan(900);
    expect(a.position).toEqual(b.position); // no RNG
  });

  it('never sinks into the floor while diving at a grounded Knight', () => {
    const world = flatArena();
    const flier = createEnemy('flier', 300, 430);
    const t: Target = { position: { x: 320, y: FLOOR_Y }, grounded: true };
    for (let i = 0; i < 900; i++) {
      stepEnemy(flier, world, FIXED_DT, t);
      expect(flier.position.y).toBeLessThanOrEqual(FLOOR_Y);
    }
  });

  it('a bob grazing the floor makes it wait, not wander off sideways', () => {
    // The sidestep is for ledges: the floor's edges are out of reach.
    const world = flatArena();
    const flier = createEnemy('flier', 640, 430);
    const t: Target = { position: { x: 640, y: FLOOR_Y }, grounded: true };
    for (let i = 0; i < 1200; i++) {
      stepEnemy(flier, world, FIXED_DT, t);
      expect(Math.abs(flier.position.x - 640)).toBeLessThanOrEqual(ATTACKS.flier.bobX + 1);
    }
  });

  it('is blocked by a ledge, not pinned: from above it, it still reaches a Knight beneath', () => {
    const world = platformArena();
    const flier = createEnemy('flier', 908, 430); // over the right ledge
    const player = createPlayer(908, FLOOR_Y); // standing right under it
    const t: Target = { position: player.position, grounded: true };
    let hit = false;
    for (let i = 0; i < 600 && !hit; i++) {
      stepEnemy(flier, world, FIXED_DT, t);
      expect(overlaps(enemyBox(flier), world.solids[4]!)).toBe(false);
      hit = overlaps(enemyBox(flier), playerHurtbox(player));
    }
    expect(hit).toBe(true);
  });

  it('goes around a ledge instead of waiting underneath a Knight standing on it', () => {
    const world = platformArena();
    const flier = createEnemy('flier', 260, FLOOR_Y - 10); // directly beneath the left ledge
    const player = createPlayer(260, FLOOR_Y - 130);
    const t: Target = { position: player.position, grounded: true };
    let hit = false;
    for (let i = 0; i < 600 && !hit; i++) {
      stepEnemy(flier, world, FIXED_DT, t);
      hit = overlaps(enemyBox(flier), playerHurtbox(player));
    }
    expect(hit).toBe(true);
  });
});
