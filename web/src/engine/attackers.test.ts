/**
 * Attacker state-machine seam tests (M4): duelist, spitter, warden.
 *
 * Seams: stepEnemy (now aware of a target), enemyAttackHitbox,
 * resolveNailHit, and projectile stepping. The teaching contract from
 * PLAN §5: telegraph → active → recovery, with recovery as the punish
 * window; the spitter's shots are nail-destroyable; the warden blocks
 * everything outside post-counter recovery and ripostes when poked.
 */
import { describe, expect, it } from 'vitest';
import { ENEMIES, FIXED_DT } from './constants';
import {
  ATTACKS,
  createEnemy,
  enemyAttackHitbox,
  resolveNailHit,
  stepEnemy,
  stepProjectile,
  type Projectile,
  type Target,
} from './enemies';
import { createPlayer } from './player';
import type { World } from './types';

const FLOOR_Y = 600;

function world(): World {
  return { solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }] };
}

function targetAt(x: number, y: number, grounded = true): Target {
  return { position: { x, y }, grounded };
}

/** Step an enemy n times against a stationary target; collect projectiles. */
function run(e: ReturnType<typeof createEnemy>, w: World, n: number, t: Target): Projectile[] {
  const spawned: Projectile[] = [];
  for (let i = 0; i < n; i++) {
    const shots = stepEnemy(e, w, FIXED_DT, t);
    if (shots) spawned.push(...shots);
  }
  return spawned;
}

describe('duelist', () => {
  it('stays idle when the player keeps distance', () => {
    const w = world();
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    run(duelist, w, 60, targetAt(100, FLOOR_Y));
    expect(duelist.phase).toBe('idle');
  });

  it('telegraphs, lunges, then recovers when approached on the ground', () => {
    const w = world();
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    const close = targetAt(450, FLOOR_Y); // inside the ~190 px trigger
    run(duelist, w, 2, close);
    expect(duelist.phase).toBe('telegraph');
    expect(duelist.attackKind).toBe('lunge');
    // Ride out the telegraph (0.35 s).
    run(duelist, w, Math.ceil(0.35 / FIXED_DT) + 1, close);
    expect(duelist.phase).toBe('active');
    const xAtLungeStart = duelist.position.x;
    // The lunge moves it toward where the player stood.
    run(duelist, w, Math.ceil(0.3 / FIXED_DT) + 1, close);
    expect(duelist.position.x).toBeLessThan(xAtLungeStart - 100);
    expect(duelist.phase).toBe('recovery');
    // Recovery ends back in idle.
    run(duelist, w, Math.ceil(0.7 / FIXED_DT) + 2, targetAt(100, FLOOR_Y));
    expect(duelist.phase).toBe('idle');
  });

  it('ignores a grounded player standing on a platform above (no through-floor lunge)', () => {
    const w: World = {
      solids: [
        { x: -2000, y: FLOOR_Y, width: 6000, height: 200 },
        { x: 500, y: FLOOR_Y - 130, width: 150, height: 20 }, // perch overhead
      ],
    };
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    // Player grounded on the perch: horizontally close, vertically far.
    run(duelist, w, 30, targetAt(560, FLOOR_Y - 130));
    expect(duelist.phase).toBe('idle'); // lunging at a ceiling would be nonsense
  });

  it('answers an airborne approach with the rising swipe instead', () => {
    const w = world();
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    run(duelist, w, 2, targetAt(540, FLOOR_Y - 90, false)); // jumping in
    expect(duelist.phase).toBe('telegraph');
    expect(duelist.attackKind).toBe('antiair');
  });

  it('exposes a damage hitbox only during the active phase', () => {
    const w = world();
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    const close = targetAt(450, FLOOR_Y);
    expect(enemyAttackHitbox(duelist)).toBeNull();
    run(duelist, w, 2, close);
    expect(enemyAttackHitbox(duelist)).toBeNull(); // telegraph: not yet
    run(duelist, w, Math.ceil(0.35 / FIXED_DT) + 1, close);
    expect(duelist.phase).toBe('active');
    expect(enemyAttackHitbox(duelist)).not.toBeNull();
  });

  it('takes nail damage in any phase (punishing recovery is wisdom, not a rule)', () => {
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    const player = createPlayer(550, FLOOR_Y);
    player.swingId = 1;
    expect(resolveNailHit(player, duelist, true)).toBe('hit');
    expect(duelist.hp).toBe(ENEMIES.duelist.hp - 1);
  });
});

describe('spitter', () => {
  it('winds up and spits a 3-shot fan toward the player', () => {
    const w = world();
    const spitter = createEnemy('spitter', 700, 440);
    const t = targetAt(200, FLOOR_Y);
    // Let the volley cooldown elapse, the telegraph run, and the shots fly.
    const shots = run(spitter, w, Math.ceil(3.5 / FIXED_DT), t);
    expect(shots.length).toBe(3);
    // Every shot travels leftish toward the player, at the tuned speed.
    for (const s of shots) {
      expect(s.velocity.x).toBeLessThan(0);
      expect(Math.hypot(s.velocity.x, s.velocity.y)).toBeCloseTo(340, 0);
    }
    // The fan is spread: the three vertical velocities all differ.
    const vys = shots.map((s) => Math.round(s.velocity.y));
    expect(new Set(vys).size).toBe(3);
  });

  it('recovers after spitting — the window to close in and punish', () => {
    const w = world();
    const spitter = createEnemy('spitter', 700, 440);
    const t = targetAt(200, FLOOR_Y);
    let sawRecovery = false;
    for (let i = 0; i < Math.ceil(4 / FIXED_DT); i++) {
      stepEnemy(spitter, w, FIXED_DT, t);
      if (spitter.phase === 'recovery') sawRecovery = true;
    }
    expect(sawRecovery).toBe(true);
  });

  it('backs away when the player crowds it', () => {
    const w = world();
    const spitter = createEnemy('spitter', 500, 440);
    const crowding = targetAt(480, FLOOR_Y);
    const x0 = spitter.position.x;
    run(spitter, w, 30, crowding);
    expect(spitter.position.x).toBeGreaterThan(x0); // fled right, away from the player
  });
});

describe('projectiles', () => {
  it('flies straight and dies on world contact', () => {
    const w = world();
    const p: Projectile = {
      position: { x: 300, y: 500 },
      velocity: { x: 0, y: 340 },
      radius: 7,
      dead: false,
    };
    for (let i = 0; i < 60 && !p.dead; i++) stepProjectile(p, w, FIXED_DT);
    expect(p.dead).toBe(true); // hit the floor
    expect(p.position.y).toBeGreaterThan(560);
  });
});

describe('warden', () => {
  it('blocks a nail hit outside recovery and answers with a riposte', () => {
    const warden = createEnemy('warden', 600, FLOOR_Y);
    const player = createPlayer(550, FLOOR_Y);
    player.swingId = 1;
    expect(resolveNailHit(player, warden, true)).toBe('blocked');
    expect(warden.hp).toBe(ENEMIES.warden.hp); // untouched
    expect(warden.phase).toBe('telegraph');
    expect(warden.attackKind).toBe('riposte');
  });

  it('runs the riposte to recovery, where it is finally vulnerable', () => {
    const w = world();
    const warden = createEnemy('warden', 600, FLOOR_Y);
    const player = createPlayer(550, FLOOR_Y);
    const t = targetAt(550, FLOOR_Y);
    player.swingId = 1;
    resolveNailHit(player, warden, true); // provoke
    run(warden, w, Math.ceil(0.4 / FIXED_DT) + 1, t);
    expect(warden.phase).toBe('active');
    expect(enemyAttackHitbox(warden)).not.toBeNull();
    run(warden, w, Math.ceil(0.35 / FIXED_DT) + 1, t);
    expect(warden.phase).toBe('recovery');
    // NOW a hit lands.
    player.swingId = 2;
    expect(resolveNailHit(player, warden, true)).toBe('hit');
    expect(warden.hp).toBe(ENEMIES.warden.hp - 1);
  });

  it('a poke during telegraph or active blocks without restarting the riposte', () => {
    const w = world();
    const warden = createEnemy('warden', 600, FLOOR_Y);
    const player = createPlayer(550, FLOOR_Y);
    const t = targetAt(550, FLOOR_Y);
    player.swingId = 1;
    resolveNailHit(player, warden, true); // provoke
    run(warden, w, 6, t); // partway into the telegraph
    const timerBefore = warden.phaseTimer;
    player.swingId = 2;
    expect(resolveNailHit(player, warden, true)).toBe('blocked');
    expect(warden.phase).toBe('telegraph');
    expect(warden.phaseTimer).toBe(timerBefore); // no restart — it stays on schedule
    expect(warden.hp).toBe(ENEMIES.warden.hp);
  });

  // Playtest 1, note 5: the shield covers ONE direction at a time and the
  // warden attacks first if you linger — "no threat unless you make a threat"
  // is not how the game works. Precedent: the Colosseum's Shielded Fool.
  describe('positional shield', () => {
    it('holds the shield in front by default: a frontal slash is blocked, a downslash from above lands', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      run(warden, w, 5, targetAt(540, FLOOR_Y));
      expect(warden.shieldDir).toBe('front');
      const front = createPlayer(540, FLOOR_Y);
      front.swingId = 1;
      front.nailDir = 'side';
      front.nailFacing = 1;
      expect(resolveNailHit(front, warden, true)).toBe('blocked');

      const above = createPlayer(600, FLOOR_Y - 90);
      above.swingId = 2;
      above.nailDir = 'down';
      // Resolve immediately — the shield hasn't had time to re-aim upward.
      expect(resolveNailHit(above, warden, true)).toBe('hit');
      expect(warden.hp).toBe(ENEMIES.warden.hp - 1);
    });

    it('re-aims overhead once the Knight hangs above it — then the front is open', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      run(warden, w, 3, targetAt(600, FLOOR_Y - 90, false));
      expect(warden.shieldDir).toBe('front'); // not instantly
      run(
        warden,
        w,
        Math.ceil(ATTACKS.warden.reaimDelay / FIXED_DT) + 1,
        targetAt(600, FLOOR_Y - 90, false),
      );
      expect(warden.shieldDir).toBe('up');

      const above = createPlayer(600, FLOOR_Y - 90);
      above.swingId = 1;
      above.nailDir = 'down';
      expect(resolveNailHit(above, warden, true)).toBe('blocked');
      expect(warden.attackKind).toBe('riposte'); // a block still provokes

      // Drop in front and slash before it re-aims: the open side.
      warden.phase = 'idle';
      warden.attackKind = null;
      const front = createPlayer(540, FLOOR_Y);
      front.swingId = 2;
      front.nailDir = 'side';
      front.nailFacing = 1;
      expect(resolveNailHit(front, warden, true)).toBe('hit');
    });

    it('a slash from behind lands regardless of the shield', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      run(warden, w, 5, targetAt(540, FLOOR_Y)); // faces left toward the player
      expect(warden.facing).toBe(-1);
      const behind = createPlayer(660, FLOOR_Y);
      behind.swingId = 1;
      behind.nailDir = 'side';
      behind.nailFacing = -1;
      expect(resolveNailHit(behind, warden, true)).toBe('hit');
    });

    it('re-aims back to the front across brief dips overhead — the front cannot be kept bare forever', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      // Hang overhead until the shield goes up.
      run(
        warden,
        w,
        Math.ceil(ATTACKS.warden.reaimDelay / FIXED_DT) + 2,
        targetAt(600, FLOOR_Y - 90, false),
      );
      expect(warden.shieldDir).toBe('up');
      // Then hop: mostly grounded in front, with short dips back overhead that
      // must not reset the re-aim clock to zero each time.
      for (let i = 0; i < 60; i++) {
        const overheadFrame = i % 6 === 5;
        const t = overheadFrame ? targetAt(600, FLOOR_Y - 90, false) : targetAt(540, FLOOR_Y);
        stepEnemy(warden, w, FIXED_DT, t);
      }
      expect(warden.shieldDir).toBe('front');
    });

    it('commits the shield forward when a riposte starts, even one provoked from above', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      run(
        warden,
        w,
        Math.ceil(ATTACKS.warden.reaimDelay / FIXED_DT) + 2,
        targetAt(600, FLOOR_Y - 90, false),
      );
      expect(warden.shieldDir).toBe('up');
      const above = createPlayer(600, FLOOR_Y - 90);
      above.swingId = 1;
      above.nailDir = 'down';
      expect(resolveNailHit(above, warden, true)).toBe('blocked');
      expect(warden.attackKind).toBe('riposte');
      expect(warden.shieldDir).toBe('front');
      // A downslash during the telegraph now lands: the shield is busy.
      above.swingId = 2;
      expect(resolveNailHit(above, warden, true)).toBe('hit');
    });
  });

  describe('proactive bash', () => {
    it('bashes a Knight who lingers in front: telegraph, a live hitbox, then an open recovery', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      const t = targetAt(540, FLOOR_Y);
      const A = ATTACKS.warden;
      run(warden, w, Math.ceil(A.bashLinger / FIXED_DT) + 2, t);
      expect(warden.phase).toBe('telegraph');
      expect(warden.attackKind).toBe('bash');
      expect(enemyAttackHitbox(warden)).toBeNull(); // the tell is safe
      run(warden, w, Math.ceil((ENEMIES.warden.telegraph ?? 0.4) / FIXED_DT) + 1, t);
      expect(warden.phase).toBe('active');
      const box = enemyAttackHitbox(warden);
      expect(box).not.toBeNull();
      expect(box!.x + box!.width / 2).toBeLessThan(warden.position.x); // toward the Knight
      run(warden, w, Math.ceil(A.bashActive / FIXED_DT) + 1, t);
      expect(warden.phase).toBe('recovery');
      // Recovery is open from any side, shield or no shield.
      const front = createPlayer(540, FLOOR_Y);
      front.swingId = 1;
      front.nailDir = 'side';
      front.nailFacing = 1;
      expect(resolveNailHit(front, warden, true)).toBe('hit');
    });

    it('bashes a Knight who keeps hopping in place in front of it (airborne time counts)', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      const A = ATTACKS.warden;
      // A hop every 0.6 s: 0.45 s airborne up to 150 px, 0.15 s on the ground.
      const n = Math.ceil((A.bashLinger + 0.6) / FIXED_DT);
      for (let i = 0; i < n; i++) {
        const t = (i * FIXED_DT) % 0.6;
        const air = t < 0.45;
        const y = air ? FLOOR_Y - 150 * Math.sin((Math.PI * t) / 0.45) : FLOOR_Y;
        stepEnemy(warden, w, FIXED_DT, targetAt(540, y, !air));
        if (warden.attackKind === 'bash') break;
      }
      expect(warden.attackKind).toBe('bash');
    });

    it('does not bash a Knight who keeps their distance', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      run(warden, w, Math.ceil(3 / FIXED_DT), targetAt(100, FLOOR_Y));
      expect(warden.phase).toBe('idle');
      expect(warden.attackKind).toBeNull();
    });
  });

  it('a feather hit (observe mode) still provokes but never damages', () => {
    const warden = createEnemy('warden', 600, FLOOR_Y);
    const player = createPlayer(550, FLOOR_Y);
    player.swingId = 1;
    expect(resolveNailHit(player, warden, false)).toBe('blocked');
    run(warden, world(), Math.ceil(0.8 / FIXED_DT), targetAt(550, FLOOR_Y));
    expect(warden.phase).toBe('recovery');
    player.swingId = 2;
    expect(resolveNailHit(player, warden, false)).toBe('hit'); // "would have landed"
    expect(warden.hp).toBe(ENEMIES.warden.hp); // but no damage in observe
  });
});
