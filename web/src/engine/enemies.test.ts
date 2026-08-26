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
import { CANVAS, ENEMIES, FIXED_DT, KNIGHT, PHYSICS } from './constants';
import { arenaWorld, bossWorld, spawnX } from './dodgeArenaSession';
import {
  ATTACKS,
  ENEMY_SIZES,
  ROLL_VARIANTS,
  applyNailHit,
  createEnemy,
  enemyAttackHitbox,
  enemyBox,
  rollVariant,
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

// ---------------------------------------------------------------------------
// Playtest 4, note 1 — the dog THROWS his bones.
//
// "I thought that he would actually shoot the bones, and they would sort of
// spin around and go around the map and actually bounce them."
//
// This deliberately breaks "nothing new is taught at the end of the road",
// ratified with the reasoning: bouncing is the one thing this entire dojo
// has taught her, so a bone that arcs and rebounds is MORE the dojo's
// language, not less.
// ---------------------------------------------------------------------------
describe('thrown bones', () => {
  const flat = () => arenaWorld();

  function bone(vx: number, vy: number, x = 600, y = 400): Projectile {
    return {
      position: { x, y },
      velocity: { x: vx, y: vy },
      radius: 7,
      dead: false,
      bounces: ATTACKS.dog.boneBounces,
      spin: ATTACKS.dog.boneSpin,
      angle: 0,
    };
  }

  /** Fly it until it dies or the clock runs out; report what happened. */
  function fly(p: Projectile, world: World, seconds = 12) {
    let turns = 0;
    let lastVx = p.velocity.x;
    let lastVy = p.velocity.y;
    const steps = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < steps && !p.dead; i++) {
      stepProjectile(p, world, FIXED_DT);
      if (
        Math.sign(p.velocity.x) !== Math.sign(lastVx) ||
        Math.sign(p.velocity.y) !== Math.sign(lastVy)
      ) {
        turns += 1;
      }
      lastVx = p.velocity.x;
      lastVy = p.velocity.y;
    }
    return { turns, dead: p.dead };
  }

  it('rebounds off a wall instead of dying on it', () => {
    const b = bone(ATTACKS.dog.projSpeed, 0);
    stepProjectile(b, flat(), FIXED_DT);
    expect(b.dead).toBe(false);
    const before = b.bounces;
    for (let i = 0; i < Math.round(4 / FIXED_DT) && b.velocity.x > 0; i++) {
      stepProjectile(b, flat(), FIXED_DT);
    }
    expect(b.velocity.x).toBeLessThan(0);
    expect(b.bounces).toBe(before! - 1);
    expect(b.dead).toBe(false);
  });

  it('spends its budget on ANY surface, then the next one stops it', () => {
    // Ping-ponging between the boss's floor and its lid — the world bones
    // actually live in. Floor, ceiling, floor, dead: three turns, and the
    // fourth surface is the one that stops it. The budget is the readable
    // limit on how long the arena stays full of them.
    const b = bone(0, 400, 600, 400);
    const { turns, dead } = fly(b, bossWorld());
    expect(turns).toBe(ATTACKS.dog.boneBounces);
    expect(dead).toBe(true);
  });

  it('bounces off a boss-only ceiling that the shared arena does not have', () => {
    const b = bone(0, -400, 600, 300);
    // In the shared world it leaves the top of the screen and is gone.
    const escaped = { ...b, position: { ...b.position }, velocity: { ...b.velocity } };
    fly(escaped, arenaWorld(), 6);
    expect(escaped.position.y).toBeLessThan(0);

    // Under the boss's lid it comes back down.
    const lidded = { ...b, position: { ...b.position }, velocity: { ...b.velocity } };
    for (let i = 0; i < Math.round(6 / FIXED_DT) && lidded.velocity.y < 0; i++) {
      stepProjectile(lidded, bossWorld(), FIXED_DT);
    }
    expect(lidded.velocity.y).toBeGreaterThan(0);
  });

  it('leaves the shared arena at exactly three solids — the spitter is untouched', () => {
    // enemies.test.ts has pinned this since the ledges came out. The boss's
    // ceiling would also have changed the spitter, whose shots die off the
    // top of the screen today.
    expect(arenaWorld().solids).toHaveLength(3);
    expect(bossWorld().solids).toHaveLength(4);
  });

  it('leaves a spitter shot flying straight and dying on the first solid', () => {
    const shot: Projectile = {
      position: { x: 600, y: 400 },
      velocity: { x: 0, y: 400 },
      radius: 7,
      dead: false,
    };
    const { turns, dead } = fly(shot, flat());
    expect(turns).toBe(0);
    expect(dead).toBe(true);
  });

  it('tumbles, and reverses its tumble when it turns', () => {
    const b = bone(ATTACKS.dog.projSpeed, 0);
    stepProjectile(b, flat(), FIXED_DT);
    expect(b.angle).toBeCloseTo(ATTACKS.dog.boneSpin * FIXED_DT, 10);
    const spinBefore = b.spin;
    for (let i = 0; i < Math.round(4 / FIXED_DT) && b.velocity.x > 0; i++) {
      stepProjectile(b, flat(), FIXED_DT);
    }
    expect(b.spin).toBe(-spinBefore!);
  });

  it('throws three of them, still pokeable, spinning both ways', () => {
    const dog = createEnemy('dog', 600, FLOOR_Y);
    const target: Target = { position: { x: 300, y: FLOOR_Y }, grounded: true };
    let thrown: Projectile[] = [];
    for (let i = 0; i < Math.round(12 / FIXED_DT) && thrown.length === 0; i++) {
      const shots = stepEnemy(dog, flat(), FIXED_DT, target);
      // The roll fires nothing; only the bones return projectiles.
      if (shots) thrown = shots;
    }
    expect(thrown).toHaveLength(ATTACKS.dog.shots);
    for (const b of thrown) {
      expect(b.bounces).toBe(ATTACKS.dog.boneBounces);
      // Same radius as the spitter's: the nail kills it exactly as before,
      // which is the link that makes a projectile fair.
      expect(b.radius).toBe(7);
    }
    expect(new Set(thrown.map((b) => Math.sign(b.spin!))).size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Playtest 4, note 2 — five roll behaviours for the user to choose between.
//
// "I just need to try out five different examples and then go off that."
//
// The choice is a taste call. What is NOT a taste call is that every one of
// them must leave both answers alive: a phase she can run under, and a
// volley window her nail can actually hit. These tests are the guard rails
// the picking happens inside, so a variant that gets tuned into a corner
// fails here rather than in her hands.
// ---------------------------------------------------------------------------
describe('the five roll behaviours', () => {
  const A = ATTACKS.dog;
  const apexOf = (launch: number) => (launch * launch) / (2 * A.rollGravity);

  it('offers five of them, each with a name and a feel', () => {
    expect(ROLL_VARIANTS).toHaveLength(5);
    expect(new Set(ROLL_VARIANTS.map((v) => v.name)).size).toBe(5);
    for (const v of ROLL_VARIANTS) expect(v.feel.length).toBeGreaterThan(20);
  });

  it('never towers: a tall arc deletes the volley AND widens the tunnel', () => {
    for (const v of ROLL_VARIANTS) {
      for (const launch of v.launches) {
        expect(apexOf(launch)).toBeLessThanOrEqual(A.rollApexMax);
      }
    }
  });

  it('alternates — every variant keeps a phase she can run under', () => {
    for (const v of ROLL_VARIANTS) {
      expect(v.launches.length).toBeGreaterThan(1);
      const headroom = v.launches.map((l) => apexOf(l) - KNIGHT.spriteHeight);
      // At least one phase clears her head with room to walk through...
      expect(Math.max(...headroom)).toBeGreaterThan(KNIGHT.spriteHeight / 4);
      // ...and at least one does not, or it would not be alternating at all.
      expect(Math.min(...headroom)).toBeLessThan(0);
    }
  });

  it('keeps at least one phase the volley can live on', () => {
    // The ball is volleyable while any part of it is inside the band 48–128
    // px above her head, and the window is how long it spends there against
    // a nail that is live for PHYSICS.nailActiveTime.
    //
    // NOT every phase: a low skitter only grazes the bottom of the band and
    // is gone in 0.12 s, which is right — you do not volley a skitter, you
    // jump it. What every variant must keep is ONE phase she can rally on,
    // because the volley must never be locked out of a whole behaviour.
    const bandLow = KNIGHT.spriteHeight + 48;
    const bandHigh = KNIGHT.spriteHeight + 48 + PHYSICS.nailReachUp;
    const windowOf = (launch: number) => {
      const apex = apexOf(launch);
      const enter = Math.max(0, bandLow - ENEMY_SIZES.dog.height);
      if (apex < enter) return 0; // never reaches her nail at all
      const speedAt = (h: number) => Math.sqrt(Math.max(0, 2 * A.rollGravity * (apex - h)));
      return (2 * (speedAt(enter) - speedAt(Math.min(apex, bandHigh)))) / A.rollGravity;
    };
    for (const v of ROLL_VARIANTS) {
      const best = Math.max(...v.launches.map(windowOf));
      expect(best).toBeGreaterThanOrEqual(PHYSICS.nailActiveTime);
    }
  });

  it('actually cycles its pattern, one launch per floor bounce', () => {
    for (const [index, v] of ROLL_VARIANTS.entries()) {
      const dog = createEnemy('dog', 600, FLOOR_Y);
      dog.rollVariantIndex = index;
      dog.attackKind = 'roll';
      dog.phase = 'telegraph';
      dog.phaseTimer = 0;
      dog.lockedDir = -1;
      dog.leapGroundY = FLOOR_Y;
      const target: Target = { position: { x: 200, y: FLOOR_Y }, grounded: true };

      stepEnemy(dog, arenaWorld(), FIXED_DT, target); // telegraph → the launch
      const seen: number[] = [-dog.velocity.y];
      let bounces = dog.rollBounces;
      for (let i = 0; i < Math.round(A.rollTime / FIXED_DT) && dog.roll; i++) {
        stepEnemy(dog, arenaWorld(), FIXED_DT, target);
        if (dog.rollBounces !== bounces) {
          bounces = dog.rollBounces;
          seen.push(-dog.velocity.y);
        }
      }
      // It got through at least one full cycle and used every launch in it.
      expect(seen.length).toBeGreaterThan(v.launches.length);
      expect(new Set(seen.map(Math.round))).toEqual(new Set(v.launches.map(Math.round)));
    }
  });

  it('falls back to the first variant for an index that does not exist', () => {
    expect(rollVariant(99)).toBe(ROLL_VARIANTS[0]);
    expect(rollVariant(-1)).toBe(ROLL_VARIANTS[0]);
  });
});
