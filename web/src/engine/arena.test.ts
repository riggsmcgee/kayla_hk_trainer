/**
 * Dodge Arena seam tests (M3).
 *
 * Seam: stepArena — the pure arena state machine. The mode's defining rule
 * (PLAN §5): the run ends on the FIRST hit the player takes; score is nail
 * hits landed. Observe mode: the nail does no damage and scores nothing;
 * survival time is the score; the run still ends on a hit.
 */
import { describe, expect, it } from 'vitest';
import { ENEMIES, FIXED_DT, PHYSICS } from './constants';
import { createArenaState, stepArena } from './arena';
import { createEnemy } from './enemies';
import { createPlayer } from './player';

const FLOOR_Y = 600;

function makeParts(observe = false) {
  const state = createArenaState(observe);
  state.started = true;
  const player = createPlayer(300, FLOOR_Y);
  const enemy = createEnemy('walker', 800, FLOOR_Y);
  return { state, player, enemy };
}

/** Force the player's current swing to be live and overlapping the enemy. */
function armSwingOver(player: ReturnType<typeof createPlayer>, x: number, y: number) {
  player.position.x = x - 60; // enemy within the 80 px side reach
  player.position.y = y;
  player.facing = 1;
  player.nailFacing = 1;
  player.nailDir = 'side';
  player.nailTimer = PHYSICS.nailStartup + PHYSICS.nailActiveTime / 2; // mid active window
  player.swingId += 1;
}

describe('dodge arena', () => {
  it('ends the run the moment the player touches the enemy', () => {
    const { state, player, enemy } = makeParts();
    player.position.x = enemy.position.x; // standing inside the walker
    const events = stepArena(state, player, enemy, FIXED_DT);
    expect(events.playerHit).toBe(true);
    expect(state.over).toBe(true);
  });

  it('scores a nail hit and damages the enemy', () => {
    const { state, player, enemy } = makeParts();
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const events = stepArena(state, player, enemy, FIXED_DT);
    expect(events.nailLanded).toBe(true);
    expect(state.hitsLanded).toBe(1);
    expect(enemy.hp).toBe(ENEMIES.walker.hp - 1);
  });

  it('kills, waits, then asks for a respawn', () => {
    const { state, player, enemy } = makeParts();
    // Two swings kill the walker (hp 2).
    armSwingOver(player, enemy.position.x, enemy.position.y);
    stepArena(state, player, enemy, FIXED_DT);
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const killed = stepArena(state, player, enemy, FIXED_DT);
    expect(killed.enemyDied).toBe(true);
    expect(enemy.dead).toBe(true);
    // Dead enemy can't hurt the player while we wait.
    player.position.x = enemy.position.x;
    let respawnRequested = false;
    for (let i = 0; i < 120 && !respawnRequested; i++) {
      const ev = stepArena(state, player, enemy, FIXED_DT);
      expect(ev.playerHit).toBe(false);
      respawnRequested = ev.respawnEnemy;
    }
    expect(respawnRequested).toBe(true);
    expect(state.over).toBe(false);
  });

  it('observe mode: flashes but never damages or scores', () => {
    const { state, player, enemy } = makeParts(true);
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const events = stepArena(state, player, enemy, FIXED_DT);
    expect(events.nailLanded).toBe(false);
    expect(state.hitsLanded).toBe(0);
    expect(enemy.hp).toBe(ENEMIES.walker.hp);
    expect(enemy.hurtFlashTimer).toBeGreaterThan(0); // "a hit would land here"
  });

  it('observe mode: the run still ends on contact', () => {
    const { state, player, enemy } = makeParts(true);
    player.position.x = enemy.position.x;
    const events = stepArena(state, player, enemy, FIXED_DT);
    expect(events.playerHit).toBe(true);
    expect(state.over).toBe(true);
  });

  it('ends the run when an enemy attack hitbox catches the player', () => {
    const state = createArenaState(false);
    state.started = true;
    const player = createPlayer(540, FLOOR_Y);
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    duelist.attackKind = 'lunge';
    duelist.lockedDir = -1;
    duelist.phase = 'active';
    duelist.phaseTimer = 0.3;
    const events = stepArena(state, player, duelist, FIXED_DT);
    expect(events.playerHit).toBe(true);
    expect(state.over).toBe(true);
  });

  it('ends the run on projectile contact', () => {
    const { state, player, enemy } = makeParts();
    const shot = {
      position: { x: player.position.x, y: player.position.y - 20 },
      velocity: { x: -340, y: 0 },
      radius: 7,
      dead: false,
    };
    const events = stepArena(state, player, enemy, FIXED_DT, [shot]);
    expect(events.playerHit).toBe(true);
  });

  it('scores a nail hit at range without any body contact ending the run', () => {
    const { state, player, enemy } = makeParts();
    // 60 px away: inside the 80 px nail reach, outside body-contact range.
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const events = stepArena(state, player, enemy, FIXED_DT);
    expect(events.nailLanded).toBe(true);
    expect(events.playerHit).toBe(false);
    expect(state.over).toBe(false);
  });

  it('a shot destroyed the same step it reaches the body does NOT end the run', () => {
    const { state, player, enemy } = makeParts();
    // Live slash with the shot overlapping the player's own hurtbox too.
    player.nailDir = 'side';
    player.nailFacing = 1;
    player.nailTimer = PHYSICS.nailStartup + PHYSICS.nailActiveTime / 2;
    player.swingId += 1;
    const shot = {
      position: { x: player.position.x + 6, y: player.position.y - 24 },
      velocity: { x: -340, y: 0 },
      radius: 7,
      dead: false,
    };
    const events = stepArena(state, player, enemy, FIXED_DT, [shot]);
    expect(shot.dead).toBe(true);
    expect(events.playerHit).toBe(false); // the nail saved you — by design
    expect(state.over).toBe(false);
  });

  it('lets the nail destroy a projectile', () => {
    const { state, player, enemy } = makeParts();
    // A live side slash with a shot inside its reach.
    player.nailDir = 'side';
    player.nailFacing = 1;
    player.nailTimer = PHYSICS.nailStartup + PHYSICS.nailActiveTime / 2;
    player.swingId += 1;
    const shot = {
      position: { x: player.position.x + 50, y: player.position.y - 30 },
      velocity: { x: -340, y: 0 },
      radius: 7,
      dead: false,
    };
    stepArena(state, player, enemy, FIXED_DT, [shot]);
    expect(shot.dead).toBe(true);
    expect(state.over).toBe(false); // destroyed before it could land
  });

  it('runs the clock only between start and run-over', () => {
    const { state, player, enemy } = makeParts();
    state.started = false;
    stepArena(state, player, enemy, FIXED_DT);
    expect(state.elapsed).toBe(0);
    state.started = true;
    stepArena(state, player, enemy, FIXED_DT);
    expect(state.elapsed).toBeCloseTo(FIXED_DT, 10);
    state.over = true;
    stepArena(state, player, enemy, FIXED_DT);
    expect(state.elapsed).toBeCloseTo(FIXED_DT, 10);
  });
});
