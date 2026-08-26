/**
 * Dodge Arena seam tests (M3).
 *
 * Seam: stepArena — the pure arena state machine. The mode's defining rule
 * (PLAN §5): the run ends on the FIRST hit the player takes; score is nail
 * hits landed. Observe mode: the nail does no damage and scores nothing;
 * survival time is the score; the run still ends on a hit.
 */
import { describe, expect, it, vi } from 'vitest';
import { CANVAS, ENEMIES, FIXED_DT, KNIGHT, PHYSICS } from './constants';
import { RESPAWN_DELAY, createArenaState, enemyHurtsBox, stepArena } from './arena';
import { PLAYER_SPAWN_X, arenaWorld, createDodgeArenaSession } from './dodgeArenaSession';
import { OVERLAY_LOCKOUT_SECONDS } from './session';
import { ATTACKS, ENEMY_SIZES, createEnemy, enemyBox } from './enemies';
import type { Enemy } from './enemies';
import { createPlayer } from './player';
import { rosterStages, waveStages } from './stages';
import type { InputFrame } from './types';

/** The session records every stage attempt; capture instead of touching storage. */
const recorded: Record<string, unknown>[] = [];
vi.mock('../storage/recordRun', () => ({
  recordRun: (run: Record<string, unknown>) => {
    recorded.push(run);
  },
}));

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
    const events = stepArena(state, player, [enemy], FIXED_DT);
    expect(events.playerHit).toBe(true);
    expect(state.over).toBe(true);
  });

  it('scores a nail hit and damages the enemy', () => {
    const { state, player, enemy } = makeParts();
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const events = stepArena(state, player, [enemy], FIXED_DT);
    expect(events.nailLanded).toBe(true);
    expect(state.hitsLanded).toBe(1);
    expect(enemy.hp).toBe(ENEMIES.walker.hp - 1);
  });

  it('kills, waits, then asks for a respawn', () => {
    const { state, player, enemy } = makeParts();
    // Two swings kill the walker (hp 2).
    armSwingOver(player, enemy.position.x, enemy.position.y);
    stepArena(state, player, [enemy], FIXED_DT);
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const killed = stepArena(state, player, [enemy], FIXED_DT);
    expect(killed.enemyDied).toBe(true);
    expect(enemy.dead).toBe(true);
    // Dead enemy can't hurt the player while we wait.
    player.position.x = enemy.position.x;
    let respawnRequested = false;
    for (let i = 0; i < 120 && !respawnRequested; i++) {
      const ev = stepArena(state, player, [enemy], FIXED_DT);
      expect(ev.playerHit).toBe(false);
      respawnRequested = ev.respawn.includes(0);
    }
    expect(respawnRequested).toBe(true);
    expect(state.over).toBe(false);
  });

  it('observe mode: flashes but never damages or scores', () => {
    const { state, player, enemy } = makeParts(true);
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const events = stepArena(state, player, [enemy], FIXED_DT);
    expect(events.nailLanded).toBe(false);
    expect(state.hitsLanded).toBe(0);
    expect(enemy.hp).toBe(ENEMIES.walker.hp);
    expect(enemy.hurtFlashTimer).toBeGreaterThan(0); // "a hit would land here"
  });

  it('observe mode: the run still ends on contact', () => {
    const { state, player, enemy } = makeParts(true);
    player.position.x = enemy.position.x;
    const events = stepArena(state, player, [enemy], FIXED_DT);
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
    const events = stepArena(state, player, [duelist], FIXED_DT);
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
    const events = stepArena(state, player, [enemy], FIXED_DT, [shot]);
    expect(events.playerHit).toBe(true);
  });

  it('scores a nail hit at range without any body contact ending the run', () => {
    const { state, player, enemy } = makeParts();
    // 60 px away: inside the 80 px nail reach, outside body-contact range.
    armSwingOver(player, enemy.position.x, enemy.position.y);
    const events = stepArena(state, player, [enemy], FIXED_DT);
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
    const events = stepArena(state, player, [enemy], FIXED_DT, [shot]);
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
    stepArena(state, player, [enemy], FIXED_DT, [shot]);
    expect(shot.dead).toBe(true);
    expect(state.over).toBe(false); // destroyed before it could land
  });

  it('runs the clock only between start and run-over', () => {
    const { state, player, enemy } = makeParts();
    state.started = false;
    stepArena(state, player, [enemy], FIXED_DT);
    expect(state.elapsed).toBe(0);
    state.started = true;
    stepArena(state, player, [enemy], FIXED_DT);
    expect(state.elapsed).toBeCloseTo(FIXED_DT, 10);
    state.over = true;
    stepArena(state, player, [enemy], FIXED_DT);
    expect(state.elapsed).toBeCloseTo(FIXED_DT, 10);
  });
});

/**
 * Playtest 2, note 2: the bounce comes from the SAME nail contact that deals
 * the damage — one contact, both effects — so a killing blow bounces too.
 */
describe('pogo on the hit', () => {
  /** Hang the Knight just above the enemy, falling, with a live downslash. */
  function armDownslashOver(player: ReturnType<typeof createPlayer>, enemy: Enemy) {
    const box = enemyBox(enemy);
    player.position.x = enemy.position.x;
    player.position.y = box.y - 10; // feet 10 px above its head: nail reaches, body doesn't
    player.grounded = false;
    player.velocity.y = 300; // falling
    player.nailDir = 'down';
    player.nailTimer = PHYSICS.nailStartup + PHYSICS.nailActiveTime / 2;
    player.pogoedThisSwing = false;
    player.swingId += 1;
  }

  it('bounces on the killing blow, the same step the enemy dies', () => {
    const { state, player, enemy } = makeParts();
    enemy.hp = 1;
    armDownslashOver(player, enemy);
    const events = stepArena(state, player, [enemy], FIXED_DT);
    expect(enemy.hp).toBe(0);
    expect(enemy.dead).toBe(true);
    expect(events.enemyDied).toBe(true);
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
    expect(player.totalPogos).toBe(1);
    expect(player.pogoPinElapsed).toBe(0);
  });

  it('bounces a surviving enemy on the same step as the hit', () => {
    const { state, player, enemy } = makeParts();
    armDownslashOver(player, enemy);
    const events = stepArena(state, player, [enemy], FIXED_DT);
    expect(events.nailLanded).toBe(true);
    expect(enemy.hp).toBe(ENEMIES.walker.hp - 1);
    expect(enemy.dead).toBe(false);
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
    expect(player.totalPogos).toBe(1);
    expect(player.airDashAvailable).toBe(true);
  });

  it('never bounces twice in one swing, even if contact persists', () => {
    const { state, player, enemy } = makeParts();
    armDownslashOver(player, enemy);
    stepArena(state, player, [enemy], FIXED_DT);
    expect(player.totalPogos).toBe(1);
    // Same swing, still overlapping: stepArena doesn't tick the swing clock.
    player.velocity.y = 0;
    stepArena(state, player, [enemy], FIXED_DT);
    expect(player.totalPogos).toBe(1);
    expect(player.velocity.y).toBe(0);
    expect(state.hitsLanded).toBe(1); // and the hit is still one per swing
  });

  it('does not bounce when grounded (the hit still lands)', () => {
    const { state, player, enemy } = makeParts();
    armDownslashOver(player, enemy);
    player.grounded = true;
    player.velocity.y = 0;
    stepArena(state, player, [enemy], FIXED_DT);
    expect(state.hitsLanded).toBe(1);
    expect(player.totalPogos).toBe(0);
    expect(player.velocity.y).toBe(0);
  });

  it('does not bounce mid-dash (the hit still lands)', () => {
    const { state, player, enemy } = makeParts();
    armDownslashOver(player, enemy);
    player.dashTimer = 0.1;
    player.velocity.y = 0;
    stepArena(state, player, [enemy], FIXED_DT);
    expect(state.hitsLanded).toBe(1);
    expect(player.totalPogos).toBe(0);
    expect(player.velocity.y).toBe(0);
    expect(player.pogoPinElapsed).toBe(-1);
  });

  it('bounces off the warden’s raised shield even though the hit is blocked', () => {
    const state = createArenaState(false);
    state.started = true;
    const player = createPlayer(300, FLOOR_Y);
    const warden = createEnemy('warden', 800, FLOOR_Y);
    warden.shieldDir = 'up';
    armDownslashOver(player, warden);
    const events = stepArena(state, player, [warden], FIXED_DT);
    expect(events.nailLanded).toBe(false);
    expect(warden.hp).toBe(ENEMIES.warden.hp);
    expect(warden.blockFlashTimer).toBeGreaterThan(0);
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
    expect(player.totalPogos).toBe(1);
  });

  it('bounces in observe mode too (the feather nail is still a surface)', () => {
    const { state, player, enemy } = makeParts(true);
    armDownslashOver(player, enemy);
    stepArena(state, player, [enemy], FIXED_DT);
    expect(enemy.hp).toBe(ENEMIES.walker.hp);
    expect(state.hitsLanded).toBe(0);
    expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
    expect(player.totalPogos).toBe(1);
  });

  it('a dead enemy is not a bounce surface', () => {
    const { state, player, enemy } = makeParts();
    enemy.hp = 0;
    enemy.dead = true;
    state.respawnTimers[0] = 1;
    armDownslashOver(player, enemy);
    stepArena(state, player, [enemy], FIXED_DT);
    expect(player.totalPogos).toBe(0);
    expect(player.velocity.y).toBe(300); // still just falling
  });
});

/**
 * Several enemies at once (playtest 2: the finale's waves reuse the arena).
 * ANY enemy's body or attack ends the run; the nail resolves against EACH
 * enemy, one hit per swing per enemy; hits and kills count across all of
 * them; every dead enemy respawns on its own timer.
 */
describe('multi-enemy arena', () => {
  function makePair(observe = false) {
    const state = createArenaState(observe);
    state.started = true;
    const player = createPlayer(300, FLOOR_Y);
    const enemies = [createEnemy('walker', 700, FLOOR_Y), createEnemy('walker', 900, FLOOR_Y)];
    return { state, player, enemies };
  }

  /** Two walkers shoulder to shoulder, both inside one side slash. */
  function makeHuddle() {
    const state = createArenaState(false);
    state.started = true;
    const player = createPlayer(300, FLOOR_Y);
    const enemies = [createEnemy('walker', 790, FLOOR_Y), createEnemy('walker', 820, FLOOR_Y)];
    armSwingOver(player, 790, FLOOR_Y); // reach 80 px covers both
    return { state, player, enemies };
  }

  it('ends the run when the SECOND enemy touches the player', () => {
    const { state, player, enemies } = makePair();
    player.position.x = enemies[1]!.position.x;
    const events = stepArena(state, player, enemies, FIXED_DT);
    expect(events.playerHit).toBe(true);
    expect(state.over).toBe(true);
  });

  it('ends the run when the second enemy’s attack catches the player', () => {
    const state = createArenaState(false);
    state.started = true;
    const player = createPlayer(540, FLOOR_Y);
    const walker = createEnemy('walker', 1000, FLOOR_Y);
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    duelist.attackKind = 'lunge';
    duelist.lockedDir = -1;
    duelist.phase = 'active';
    duelist.phaseTimer = 0.3;
    const events = stepArena(state, player, [walker, duelist], FIXED_DT);
    expect(events.playerHit).toBe(true);
  });

  it('nothing happens with no one near: the clock runs, nobody is hurt', () => {
    const { state, player, enemies } = makePair();
    const events = stepArena(state, player, enemies, FIXED_DT);
    expect(events.playerHit).toBe(false);
    expect(events.nailLanded).toBe(false);
    expect(events.respawn).toEqual([]);
    expect(state.elapsed).toBeCloseTo(FIXED_DT, 10);
  });

  it('one swing through two enemies hits both and counts two', () => {
    const { state, player, enemies } = makeHuddle();
    const events = stepArena(state, player, enemies, FIXED_DT);
    expect(events.nailLanded).toBe(true);
    expect(events.hits).toBe(2);
    expect(state.hitsLanded).toBe(2);
    expect(enemies[0]!.hp).toBe(ENEMIES.walker.hp - 1);
    expect(enemies[1]!.hp).toBe(ENEMIES.walker.hp - 1);
  });

  it('still one hit per swing per enemy', () => {
    const { state, player, enemies } = makeHuddle();
    stepArena(state, player, enemies, FIXED_DT);
    const again = stepArena(state, player, enemies, FIXED_DT); // same swing, same overlap
    expect(again.nailLanded).toBe(false);
    expect(again.hits).toBe(0);
    expect(state.hitsLanded).toBe(2);
    armSwingOver(player, 790, FLOOR_Y); // a new swing lands on both again
    expect(stepArena(state, player, enemies, FIXED_DT).hits).toBe(2);
    expect(state.hitsLanded).toBe(4);
  });

  it('a swing that reaches only one of them hits only that one', () => {
    const { state, player, enemies } = makePair();
    armSwingOver(player, enemies[1]!.position.x, FLOOR_Y);
    const events = stepArena(state, player, enemies, FIXED_DT);
    expect(events.hits).toBe(1);
    expect(enemies[0]!.hp).toBe(ENEMIES.walker.hp);
    expect(enemies[1]!.hp).toBe(ENEMIES.walker.hp - 1);
  });

  it('kills count across enemies and each dead enemy respawns on its own clock', () => {
    const { state, player, enemies } = makePair();
    // Kill enemy 0 (hp 2) with two swings.
    armSwingOver(player, enemies[0]!.position.x, FLOOR_Y);
    stepArena(state, player, enemies, FIXED_DT);
    armSwingOver(player, enemies[0]!.position.x, FLOOR_Y);
    const first = stepArena(state, player, enemies, FIXED_DT);
    expect(first.enemyDied).toBe(true);
    expect(enemies[0]!.dead).toBe(true);
    expect(enemies[1]!.dead).toBe(false);
    // Half the respawn delay later, kill enemy 1 too.
    player.position.x = 300;
    const half = Math.round(RESPAWN_DELAY / 2 / FIXED_DT);
    for (let i = 0; i < half; i++) {
      expect(stepArena(state, player, enemies, FIXED_DT).respawn).toEqual([]);
    }
    armSwingOver(player, enemies[1]!.position.x, FLOOR_Y);
    stepArena(state, player, enemies, FIXED_DT);
    armSwingOver(player, enemies[1]!.position.x, FLOOR_Y);
    const second = stepArena(state, player, enemies, FIXED_DT);
    expect(second.enemyDied).toBe(true);
    expect(enemies[1]!.dead).toBe(true);
    expect(state.hitsLanded).toBe(4);
    // Enemy 0's respawn comes first, alone; enemy 1's follows about half a
    // delay later. (Like the session, replace a slot when asked — the arena
    // keeps asking until it is.)
    player.position.x = 300;
    const order: { at: number; slots: number[] }[] = [];
    for (let i = 0; i < 200 && order.length < 2; i++) {
      const ev = stepArena(state, player, enemies, FIXED_DT);
      if (ev.respawn.length) {
        order.push({ at: i, slots: ev.respawn });
        for (const slot of ev.respawn) enemies[slot] = createEnemy('walker', 900, FLOOR_Y);
      }
    }
    expect(order.map((o) => o.slots)).toEqual([[0], [1]]);
    expect(order[1]!.at - order[0]!.at).toBeGreaterThanOrEqual(half - 1);
    expect(enemies.every((e) => !e.dead)).toBe(true);
    expect(state.over).toBe(false);
  });

  it('a dead enemy is harmless while the live one still bites', () => {
    const { state, player, enemies } = makePair();
    enemies[0]!.hp = 0;
    enemies[0]!.dead = true;
    state.respawnTimers[0] = RESPAWN_DELAY;
    player.position.x = enemies[0]!.position.x;
    expect(stepArena(state, player, enemies, FIXED_DT).playerHit).toBe(false);
    player.position.x = enemies[1]!.position.x;
    expect(stepArena(state, player, enemies, FIXED_DT).playerHit).toBe(true);
  });

  it('observe mode: a swing through two enemies flashes both and scores nothing', () => {
    const { state, player, enemies } = makeHuddle();
    state.observe = true;
    const events = stepArena(state, player, enemies, FIXED_DT);
    expect(events.hits).toBe(0);
    expect(state.hitsLanded).toBe(0);
    expect(enemies[0]!.hurtFlashTimer).toBeGreaterThan(0);
    expect(enemies[1]!.hurtFlashTimer).toBeGreaterThan(0);
    expect(enemies[0]!.hp).toBe(ENEMIES.walker.hp);
  });

  describe('pogo per enemy', () => {
    function armDownslashOver(player: ReturnType<typeof createPlayer>, enemy: Enemy) {
      const box = enemyBox(enemy);
      player.position.x = enemy.position.x;
      player.position.y = box.y - 10;
      player.grounded = false;
      player.velocity.y = 300;
      player.nailDir = 'down';
      player.nailTimer = PHYSICS.nailStartup + PHYSICS.nailActiveTime / 2;
      player.pogoedThisSwing = false;
      player.swingId += 1;
    }

    it('bounces off whichever enemy the downslash lands on', () => {
      const { state, player, enemies } = makePair();
      armDownslashOver(player, enemies[1]!);
      stepArena(state, player, enemies, FIXED_DT);
      expect(player.totalPogos).toBe(1);
      expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
      expect(enemies[1]!.hp).toBe(ENEMIES.walker.hp - 1);
      expect(enemies[0]!.hp).toBe(ENEMIES.walker.hp);
    });

    it('bounces on a killing blow to the second enemy', () => {
      const { state, player, enemies } = makePair();
      enemies[1]!.hp = 1;
      armDownslashOver(player, enemies[1]!);
      const events = stepArena(state, player, enemies, FIXED_DT);
      expect(events.enemyDied).toBe(true);
      expect(enemies[1]!.dead).toBe(true);
      expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
      expect(player.totalPogos).toBe(1);
    });

    it('a downslash over two bodies at once: two hits, one bounce', () => {
      const state = createArenaState(false);
      state.started = true;
      const player = createPlayer(300, FLOOR_Y);
      const enemies = [createEnemy('walker', 790, FLOOR_Y), createEnemy('walker', 810, FLOOR_Y)];
      armDownslashOver(player, enemies[0]!);
      player.position.x = 800;
      const events = stepArena(state, player, enemies, FIXED_DT);
      expect(events.hits).toBe(2);
      expect(player.totalPogos).toBe(1);
      expect(player.velocity.y).toBe(-PHYSICS.pogoVelocity);
    });

    it('a dead enemy is no bounce surface, but its live neighbour is', () => {
      const { state, player, enemies } = makePair();
      enemies[0]!.hp = 0;
      enemies[0]!.dead = true;
      state.respawnTimers[0] = RESPAWN_DELAY;
      armDownslashOver(player, enemies[0]!);
      stepArena(state, player, enemies, FIXED_DT);
      expect(player.totalPogos).toBe(0);
      armDownslashOver(player, enemies[1]!);
      stepArena(state, player, enemies, FIXED_DT);
      expect(player.totalPogos).toBe(1);
    });
  });
});

/**
 * The session as a staged game (playtest 2, note 1), driven headlessly —
 * step() only, no canvas. Fail → record → Z restarts the SAME stage; clear
 * → record → onStageCleared → banner → next stage; last clear → onAllCleared.
 * Wave runs carry the wave number; observe mode never clears or reports.
 */
describe('the frame the run ends on', () => {
  /**
   * A Knight mid-swing, with one enemy touching her from behind (outside the
   * nail's reach) and another in front of her, inside it.
   *
   * stepArena already refuses whole frames once state.over is set, so the
   * only window left is WITHIN one frame: the toucher comes first in the
   * list and ends the run, and the enemy after it used to keep scoring.
   */
  function fatalFrameParts() {
    const state = createArenaState(false);
    state.started = true;
    const player = createPlayer(300, FLOOR_Y);
    armSwingOver(player, 400, FLOOR_Y); // player lands at 340, nail forward
    const behind = createEnemy('walker', 310, FLOOR_Y); // touching, out of reach
    const inFront = createEnemy('walker', 400, FLOOR_Y); // inside the nail
    return { state, player, behind, inFront };
  }

  it('is set up so the toucher is out of the nail and the other is in it', () => {
    // Guard the fixture itself: if the geometry drifts, the test below would
    // silently stop testing anything.
    const { state, player, behind, inFront } = fatalFrameParts();
    expect(stepArena(state, player, [behind], FIXED_DT).hits).toBe(0);
    const fresh = createArenaState(false);
    fresh.started = true;
    expect(stepArena(fresh, player, [inFront], FIXED_DT).hits).toBe(1);
  });

  it('stops scoring at the enemy that got her, not at the end of the list', () => {
    const { state, player, behind, inFront } = fatalFrameParts();
    const events = stepArena(state, player, [behind, inFront], FIXED_DT);
    expect(events.playerHit).toBe(true);
    expect(state.over).toBe(true);
    // The enemy after the fatal touch scores nothing on a dead frame.
    expect(events.hits).toBe(0);
    expect(state.hitsLanded).toBe(0);
    expect(inFront.hp).toBe(ENEMIES.walker.hp);
  });
});

describe('arena session (staged game)', () => {
  const IDLE: InputFrame = {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
    up: false,
    down: false,
    dashPressed: false,
  };
  const COMFORT = { reduceShake: false, reduceFlashing: false };
  const press = (partial: Partial<InputFrame>): InputFrame => ({ ...IDLE, ...partial });
  /** Stages that clear by standing still for a moment (no hits needed). */
  const quick = (n: number) =>
    rosterStages()
      .slice(0, n)
      .map((d) => ({ ...d, surviveSeconds: 0.5, hitsRequired: 0 }));

  it('fails on a touch, records the stage run, restarts the same stage on Z', () => {
    recorded.length = 0;
    const cleared: number[] = [];
    const s = createDodgeArenaSession({
      stages: rosterStages(),
      startIndex: 1,
      comfort: COMFORT,
      onStageCleared: (i) => cleared.push(i),
    });
    for (let i = 0; i < 120; i++) s.step(IDLE, FIXED_DT); // nothing moves before input
    expect(recorded).toHaveLength(0);
    let steps = 0;
    while (recorded.length === 0 && steps < 60 * 30) {
      s.step(press({ right: true }), FIXED_DT); // walk into the flier's path
      steps += 1;
    }
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ mode: 'dodge', enemyId: 'flier', cleared: false });
    expect(recorded[0]!.wave).toBeUndefined();
    expect(recorded[0]!.observeMode).toBeUndefined();
    expect(cleared).toEqual([]);
    for (let i = 0; i < 10; i++) s.step(IDLE, FIXED_DT); // the hit-stop freeze
    s.step(press({ jumpPressed: true }), FIXED_DT); // Z: the flier again, not the walker
    steps = 0;
    while (recorded.length === 1 && steps < 60 * 30) {
      s.step(press({ right: true }), FIXED_DT);
      steps += 1;
    }
    expect(recorded[1]).toMatchObject({ enemyId: 'flier', cleared: false });
  });

  it('clears, banners, advances, and reports all-cleared after the last stage', () => {
    recorded.length = 0;
    const cleared: number[] = [];
    let all = 0;
    const s = createDodgeArenaSession({
      stages: quick(2),
      comfort: COMFORT,
      onStageCleared: (i) => cleared.push(i),
      onAllCleared: () => {
        all += 1;
      },
    });
    s.step(press({ attackPressed: true }), FIXED_DT); // any input starts the stage
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    expect(cleared).toEqual([0]);
    expect(all).toBe(0);
    expect(recorded[0]).toMatchObject({ enemyId: 'walker', cleared: true });
    // The banner holds; Z skips it; the next stage waits for input again.
    s.step(press({ jumpPressed: true }), FIXED_DT);
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    expect(cleared).toEqual([0]);
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    expect(cleared).toEqual([0, 1]);
    expect(all).toBe(1);
    expect(recorded[1]).toMatchObject({ enemyId: 'flier', cleared: true });
  });

  it('the banner advances on its own after two seconds', () => {
    recorded.length = 0;
    const cleared: number[] = [];
    const s = createDodgeArenaSession({ stages: quick(2), comfort: COMFORT });
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60 * 3; i++) s.step(IDLE, FIXED_DT); // 0.5 s clear + 2 s banner
    s.step(press({ attackPressed: true }), FIXED_DT); // starts stage 2
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    expect(recorded.map((r) => r.enemyId)).toEqual(['walker', 'flier']);
    expect(cleared).toEqual([]); // no callback wired: free play records, never marks
  });

  it('waves: two enemies, runs tagged with the wave number', () => {
    recorded.length = 0;
    const s = createDodgeArenaSession({
      stages: waveStages(),
      startIndex: 1,
      comfort: COMFORT,
    });
    s.step(press({ attackPressed: true }), FIXED_DT);
    let steps = 0;
    while (recorded.length === 0 && steps < 60 * 60) {
      s.step(IDLE, FIXED_DT); // stand still: the hunters come to her
      steps += 1;
    }
    expect(recorded[0]).toMatchObject({ enemyId: 'duelist', wave: 2, cleared: false });
  });

  /** Walk into the enemy until the stage fails; returns the session. */
  function failOnce() {
    recorded.length = 0;
    const started: number[] = [];
    const failed: number[] = [];
    const s = createDodgeArenaSession({
      stages: rosterStages(),
      startIndex: 1,
      comfort: COMFORT,
      onStageStarted: (i) => started.push(i),
      onStageFailed: (i) => failed.push(i),
    });
    let steps = 0;
    while (recorded.length === 0 && steps < 60 * 30) {
      s.step(press({ right: true }), FIXED_DT);
      steps += 1;
    }
    expect(recorded).toHaveLength(1);
    return { s, started, failed };
  }

  /** What the HUD says, captured from a stub context. */
  function hudText(s: ReturnType<typeof createDodgeArenaSession>): string {
    const lines: string[] = [];
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, prop) =>
        prop === 'fillText'
          ? (text: string) => {
              lines.push(text);
            }
          : () => undefined,
      set: () => true,
    });
    s.render(ctx, 1);
    return lines.join(' | ');
  }

  it('an X pressed inside the death hit-stop does not restart the stage', () => {
    const { s } = failOnce();
    expect(hudText(s)).toContain('Got you.');
    // FEEDBACK.playerHit.hitStop = 0.15 s = 9 frozen steps; press on the 2nd.
    for (let i = 0; i < 9; i++) s.step(press({ attackPressed: i === 1 }), FIXED_DT);
    s.step(IDLE, FIXED_DT);
    expect(hudText(s)).toContain('Got you.');
    // A fresh press after the freeze restarts it.
    s.step(press({ attackPressed: true }), FIXED_DT);
    expect(hudText(s)).not.toContain('Got you.');
  });

  it('retries a failed stage on either key — there is no forward from a fail', () => {
    for (const key of ['attackPressed', 'jumpPressed'] as const) {
      const { s } = failOnce();
      for (let i = 0; i < 12; i++) s.step(IDLE, FIXED_DT); // out of the hit-stop
      s.step(press({ [key]: true }), FIXED_DT);
      expect(hudText(s)).not.toContain('Got you.');
    }
  });

  it('the fail screen names the again key, and never a dead forward key', () => {
    const { s } = failOnce();
    const copy = hudText(s);
    expect(copy).toContain('Press X to face');
    expect(copy).not.toContain('Press Z');
  });

  it('tells the page every time a stage starts, and every time one is failed', () => {
    const { s, started, failed } = failOnce();
    expect(started).toEqual([1]); // once at construction
    expect(failed).toEqual([1]);
    for (let i = 0; i < 10; i++) s.step(IDLE, FIXED_DT);
    s.step(press({ jumpPressed: true }), FIXED_DT);
    expect(started).toEqual([1, 1]); // the same stage again
  });

  it('X replays from the top after the last clear, and says so on stage 0', () => {
    const started: number[] = [];
    const s = createDodgeArenaSession({
      stages: quick(2),
      startIndex: 1,
      comfort: COMFORT,
      onStageStarted: (i) => started.push(i),
    });
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    expect(started).toEqual([1]);
    s.step(press({ attackPressed: true }), FIXED_DT);
    expect(started).toEqual([1, 0]);
  });

  it('Z off the all-cleared screen goes forward once, and does not replay', () => {
    const started: number[] = [];
    let forward = 0;
    const s = createDodgeArenaSession({
      stages: quick(2),
      startIndex: 1,
      comfort: COMFORT,
      onNext: () => {
        forward += 1;
      },
      nextLabel: 'Reading Enemies',
      onStageStarted: (i) => started.push(i),
    });
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    s.step(press({ jumpPressed: true }), FIXED_DT);
    expect(forward).toBe(1);
    expect(started).toEqual([1]); // forward, not a replay
  });

  it('with nowhere forward, Z is inert on the all-cleared screen and the copy offers X only', () => {
    const s = createDodgeArenaSession({ stages: quick(2), startIndex: 1, comfort: COMFORT });
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    const copy = hudText(s);
    expect(copy).toContain('X to run it again');
    expect(copy).not.toContain('Press Z');
    s.step(press({ jumpPressed: true }), FIXED_DT);
    expect(hudText(s)).toContain('cleared, Kayla!'); // still there
  });

  it('names her own keys on every overlay, not a hard-coded Z and X', () => {
    const s = createDodgeArenaSession({
      stages: quick(2),
      startIndex: 1,
      comfort: COMFORT,
      jumpKey: 'Space',
      attackKey: 'J',
      onNext: () => {},
      nextLabel: 'the waves',
    });
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    const copy = hudText(s);
    expect(copy).toContain('Press Space for the waves');
    expect(copy).toContain('J to run it again');
  });

  it('an X pressed the instant the last stage clears does not skip the screen', () => {
    // The clear screens have no hit-stop (FEEDBACK.courseClear.hitStop is 0),
    // so OVERLAY_LOCKOUT_SECONDS is the only thing between her and a screen
    // she never read.
    const started: number[] = [];
    const s = createDodgeArenaSession({
      stages: quick(2),
      startIndex: 1,
      comfort: COMFORT,
      onStageStarted: (i) => started.push(i),
    });
    // Run it until the screen is up, then hold X from the very first frame of
    // it — the state she is actually in, mid-mash, when it appears.
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60 * 30 && !hudText(s).includes('cleared, Kayla!'); i++) {
      s.step(IDLE, FIXED_DT);
    }
    expect(started).toEqual([1]);

    const lockoutSteps = Math.ceil(OVERLAY_LOCKOUT_SECONDS / FIXED_DT);
    for (let i = 0; i < lockoutSteps - 1; i++) {
      s.step(press({ attackPressed: true }), FIXED_DT);
    }
    expect(started).toEqual([1]); // held down the whole way, still reading it

    s.step(press({ attackPressed: true }), FIXED_DT);
    expect(started).toEqual([1, 0]); // and it answers the moment it is allowed to
  });

  it('observe mode never fails into the progression either', () => {
    recorded.length = 0;
    const failed: number[] = [];
    const s = createDodgeArenaSession({
      stages: rosterStages(),
      comfort: COMFORT,
      observe: true,
      onStageFailed: (i) => failed.push(i),
    });
    let steps = 0;
    while (recorded.length === 0 && steps < 60 * 30) {
      s.step(press({ right: true }), FIXED_DT);
      steps += 1;
    }
    expect(recorded).toHaveLength(1);
    expect(failed).toEqual([]);
  });

  it('the Knight spawns on open floor — a full jump from the spawn hits nothing', () => {
    const apex = 240; // the full-jump apex is ~233 px; a little slack
    const column = {
      x: PLAYER_SPAWN_X - KNIGHT.hurtboxWidth / 2,
      y: FLOOR_Y - apex,
      width: KNIGHT.hurtboxWidth,
      height: apex,
    };
    const overhead = arenaWorld().solids.filter(
      (b) =>
        b.y + b.height <= FLOOR_Y &&
        b.x < column.x + column.width &&
        b.x + b.width > column.x &&
        b.y < column.y + column.height &&
        b.y + b.height > column.y,
    );
    expect(overhead).toEqual([]);
    // And the enemies still spawn on the far side from her.
    expect(PLAYER_SPAWN_X).toBeLessThan(CANVAS.width / 2);
  });

  it('observe mode never clears and never reports', () => {
    recorded.length = 0;
    const cleared: number[] = [];
    const s = createDodgeArenaSession({
      stages: quick(1),
      comfort: COMFORT,
      observe: true,
      onStageCleared: (i) => cleared.push(i),
    });
    s.step(press({ attackPressed: true }), FIXED_DT);
    for (let i = 0; i < 60; i++) s.step(IDLE, FIXED_DT);
    expect(cleared).toEqual([]);
    expect(recorded).toHaveLength(0);
  });
  it('the Bills are moving furniture: the nail bounces, nothing else happens', () => {
    const state = createArenaState(false);
    state.started = true;
    const player = createPlayer(300, FLOOR_Y);
    const bill = createEnemy('bill', 800, FLOOR_Y);

    // A hundred distinct swings, so the per-swing dedupe cannot be what
    // hides the damage.
    for (let i = 0; i < 100; i++) {
      armSwingOver(player, bill.position.x, bill.position.y);
      const events = stepArena(state, player, [bill], FIXED_DT);
      expect(events.nailLanded).toBe(false);
      expect(events.hits).toBe(0);
      expect(events.enemyDied).toBe(false);
    }
    expect(bill.hp).toBe(ENEMIES.bill.hp);
    expect(bill.dead).toBe(false);
    expect(state.hitsLanded).toBe(0);
  });

  it('a downslash onto a Bill still bounces her, and still costs him nothing', () => {
    const state = createArenaState(false);
    state.started = true;
    const player = createPlayer(300, FLOOR_Y);
    const dog = createEnemy('dog', 800, FLOOR_Y);

    // Straight down onto the dog, in the air, mid-swing.
    player.position.x = dog.position.x;
    player.position.y = dog.position.y - ENEMY_SIZES.dog.height - 20;
    player.grounded = false;
    player.nailDir = 'down';
    player.nailTimer = PHYSICS.nailStartup + PHYSICS.nailActiveTime / 2;
    player.swingId += 1;
    player.pogoedThisSwing = false; // a fresh swing has not bounced yet

    const events = stepArena(state, player, [dog], FIXED_DT);
    expect(player.totalPogos).toBe(1);
    expect(events.nailLanded).toBe(false);
    expect(state.hitsLanded).toBe(0);
    expect(dog.hp).toBe(ENEMIES.dog.hp);
  });

  it('the rolling dog is safe on top and lethal on the sides', () => {
    const dog = createEnemy('dog', 800, FLOOR_Y);
    // Not rolling: the hurt box is the whole body, like everyone else.
    expect(enemyHurtsBox(dog)).toEqual(enemyBox(dog));

    dog.attackKind = 'roll';
    dog.roll = true;
    const body = enemyBox(dog);
    const hurts = enemyHurtsBox(dog);
    expect(hurts.y).toBe(body.y + ATTACKS.dog.rollSafeCap);
    expect(hurts.height).toBe(body.height - ATTACKS.dog.rollSafeCap);
    expect(hurts.x).toBe(body.x);
    expect(hurts.width).toBe(body.width);
  });

  it('every other enemy hurts with its whole body', () => {
    for (const id of ['walker', 'flier', 'spitter', 'duelist', 'warden', 'bill'] as const) {
      const e = createEnemy(id, 500, FLOOR_Y);
      expect(enemyHurtsBox(e)).toEqual(enemyBox(e));
    }
  });

  it('riding the top cap of the rolling ball is survivable; 30 px lower is not', () => {
    const roller = () => {
      const d = createEnemy('dog', 800, FLOOR_Y);
      d.attackKind = 'roll';
      d.roll = true;
      return d;
    };
    const top = enemyBox(roller()).y;

    const perched = createArenaState(false);
    perched.started = true;
    // Her feet just inside the cap, so her hurtbox bottom is above the
    // lethal band — riding the ball, which is what the cap is for.
    const safe = createPlayer(800, top + ATTACKS.dog.rollSafeCap - 1);
    expect(stepArena(perched, safe, [roller()], FIXED_DT).playerHit).toBe(false);

    const sunk = createArenaState(false);
    sunk.started = true;
    const caught = createPlayer(800, top + ATTACKS.dog.rollSafeCap + 30);
    expect(stepArena(sunk, caught, [roller()], FIXED_DT).playerHit).toBe(true);
  });
});

/**
 * DEV TOOL: remove in the final build.
 *
 * God mode's contract, and the whole reason it is expressed as a SECOND event
 * rather than by suppressing the first: everything downstream of stepArena —
 * stepStage, stepBoss, the sessions' fail branches — reads `playerHit` and
 * takes it to mean "the run is over". If god mode made that flag lie, every
 * one of them would have to learn about god mode. Instead `playerHit` keeps
 * its meaning and `wouldHaveHit` carries the news, which only the display
 * reads.
 */
describe('god mode', () => {
  function godParts() {
    const state = createArenaState(false, true);
    state.started = true;
    const player = createPlayer(300, FLOOR_Y);
    const enemy = createEnemy('walker', 800, FLOOR_Y);
    return { state, player, enemy };
  }

  it('reports the touch without ending the run', () => {
    const { state, player, enemy } = godParts();
    player.position.x = enemy.position.x; // standing inside the walker

    const events = stepArena(state, player, [enemy], FIXED_DT);
    expect(events.wouldHaveHit).toBe(true);
    // The flag every downstream consumer reads keeps its old meaning.
    expect(events.playerHit).toBe(false);
    expect(state.over).toBe(false);
  });

  it('counts one touch per grace window, not one per frame', () => {
    const { state, player, enemy } = godParts();
    player.position.x = enemy.position.x;

    let reported = 0;
    // One second standing inside it — inside the 1.3 s window. Without a
    // debounce this would be sixty hits and the counter would read as broken
    // rather than as information.
    for (let i = 0; i < 60; i++) {
      if (stepArena(state, player, [enemy], FIXED_DT).wouldHaveHit) reported += 1;
    }
    expect(reported).toBe(1);
  });

  it('counts again once the grace window has passed', () => {
    const { state, player, enemy } = godParts();
    player.position.x = enemy.position.x;
    let reported = 0;
    // Three seconds is two full 1.3 s windows and a bit.
    for (let i = 0; i < 180; i++) {
      if (stepArena(state, player, [enemy], FIXED_DT).wouldHaveHit) reported += 1;
    }
    expect(reported).toBe(3);
  });

  it('leaves the run going for a projectile too', () => {
    const { state, player } = godParts();
    const shot = {
      position: { x: player.position.x, y: player.position.y - 20 },
      velocity: { x: 0, y: 0 },
      radius: 7,
      dead: false,
    };
    const events = stepArena(state, player, [], FIXED_DT, [shot]);
    expect(events.wouldHaveHit).toBe(true);
    expect(events.playerHit).toBe(false);
    expect(state.over).toBe(false);
    // The shot is still consumed. God mode changes what a hit COSTS, never
    // what the simulation does — otherwise testing would not be testing.
    expect(shot.dead).toBe(true);
  });

  it('is off unless asked for, and the run ends as it always did', () => {
    const state = createArenaState(false);
    state.started = true;
    expect(state.godMode).toBe(false);
    const player = createPlayer(300, FLOOR_Y);
    const enemy = createEnemy('walker', 300, FLOOR_Y);
    const events = stepArena(state, player, [enemy], FIXED_DT);
    expect(events.playerHit).toBe(true);
    expect(events.wouldHaveHit).toBe(false);
    expect(state.over).toBe(true);
  });
});
