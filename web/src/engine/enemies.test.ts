/**
 * Enemy behavior seam tests (M3): the walker and flier dummies.
 *
 * Seam: createEnemy/stepEnemy plus applyNailHit. Expected behavior from the
 * plan and research: walker patrols at 80 px/s and turns at walls and ledge
 * edges; flier drifts around a home point without wandering off; enemies
 * take one nail hit per swing, die at 0 hp.
 */
import { describe, expect, it } from 'vitest';
import { ENEMIES, FIXED_DT } from './constants';
import { applyNailHit, createEnemy, enemyBox, stepEnemy } from './enemies';
import { createPlayer } from './player';
import type { World } from './types';

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
