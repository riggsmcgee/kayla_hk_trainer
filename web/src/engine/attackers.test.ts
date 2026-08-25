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
import { CANVAS, ENEMIES, FIXED_DT, KNIGHT, PHYSICS } from './constants';
import {
  ATTACKS,
  ENEMY_SIZES,
  createEnemy,
  enemyAttackHitbox,
  enemyBox,
  resolveNailHit,
  stepEnemy,
  stepProjectile,
  type Enemy,
  type Projectile,
  type Target,
} from './enemies';
import { createPlayer } from './player';
import { arenaWorld } from './dodgeArenaSession';
import type { World } from './types';

const FLOOR_Y = 600;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

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
  it('holds for gapDwell against a distant Knight, then answers with the leap', () => {
    const w = world();
    const duelist = createEnemy('duelist', 600, FLOOR_Y);
    const far = targetAt(100, FLOOR_Y);
    // Just short of the dwell: still marching, no attack committed.
    run(duelist, w, Math.floor((ATTACKS.duelist.gapDwell / FIXED_DT) as number) - 2, far);
    expect(duelist.phase).toBe('idle');
    expect(duelist.attackKind).toBeNull();
    // Past it: standing off is its own provocation now.
    run(duelist, w, 4, far);
    expect(duelist.attackKind).toBe('leap');
    expect(duelist.phase).toBe('telegraph');
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

  describe('the leap (playtest 3, note 3 — the answer to keeping your distance)', () => {
    const A = ATTACKS.duelist;

    /** Provoke a leap and step until `stop` says to stop. */
    function leapUntil(
      stop: (d: ReturnType<typeof createEnemy>, i: number) => boolean,
      t: Target = targetAt(100, FLOOR_Y),
      w: World = world(),
      startX = 600,
    ) {
      const duelist = createEnemy('duelist', startX, FLOOR_Y);
      for (let i = 0; i < 60 * 10; i++) {
        stepEnemy(duelist, w, FIXED_DT, t);
        if (stop(duelist, i)) break;
      }
      return duelist;
    }

    it('is not provoked by a Knight who walks straight in', () => {
      const w = world();
      const duelist = createEnemy('duelist', 600, FLOOR_Y);
      // She closes from 900 px out, arriving well inside gapRange.
      for (let i = 0; i < 60 * 2; i++) {
        const x = Math.min(560, 100 + i * 6);
        stepEnemy(duelist, w, FIXED_DT, targetAt(x, FLOOR_Y));
      }
      expect(duelist.attackKind).not.toBe('leap');
    });

    it('rises to a perch, hangs there, then dives', () => {
      const seen: string[] = [];
      leapUntil((d) => {
        const stage = d.leapStage;
        if (stage && seen[seen.length - 1] !== stage) seen.push(stage);
        return d.phase === 'recovery' && seen.includes('dive');
      });
      expect(seen).toEqual(['rise', 'hang', 'dive']);
    });

    it('gets up to roughly the perch height before it hangs', () => {
      const d = leapUntil((e) => e.leapStage === 'hang');
      const risen = FLOOR_Y - d.position.y;
      expect(risen).toBeGreaterThan(A.perchHeight * 0.9);
      expect(risen).toBeLessThanOrEqual(A.perchHeight + 1);
    });

    it('shows no hitbox while it is rising or hanging — she may even pogo him', () => {
      const w = world();
      const t = targetAt(100, FLOOR_Y);
      const duelist = createEnemy('duelist', 600, FLOOR_Y);
      let sawAir = false;
      for (let i = 0; i < 60 * 4; i++) {
        stepEnemy(duelist, w, FIXED_DT, t);
        if (duelist.leapStage === 'rise' || duelist.leapStage === 'hang') {
          sawAir = true;
          expect(enemyAttackHitbox(duelist)).toBeNull();
        }
        if (duelist.leapStage === 'dive') break;
      }
      expect(sawAir).toBe(true);
    });

    it('shows a hitbox once it is diving', () => {
      const d = leapUntil((e) => e.leapStage === 'dive');
      expect(enemyAttackHitbox(d)).not.toBeNull();
    });

    it('commits its aim at the END of the hang, so moving during the rise does not shake it', () => {
      // She stands at 100 through the rise and the hang, then bolts right the
      // instant the dive starts. The dive must still go where she WAS.
      const w = world();
      const duelist = createEnemy('duelist', 600, FLOOR_Y);
      let target = targetAt(100, FLOOR_Y);
      let aimAtDive: { x: number; y: number } | null = null;
      for (let i = 0; i < 60 * 6; i++) {
        stepEnemy(duelist, w, FIXED_DT, target);
        if (duelist.leapStage === 'dive' && !aimAtDive) {
          aimAtDive = { ...duelist.leapAim };
          target = targetAt(1100, FLOOR_Y); // too late
        }
        // Stop at the landing: after that he is hunting again, and where he
        // walks next says nothing about where the dive went.
        if (aimAtDive && duelist.phase === 'recovery') break;
      }
      expect(aimAtDive).not.toBeNull();
      expect(aimAtDive!.x).toBeLessThan(0); // still committed leftward
      expect(duelist.position.x).toBeLessThan(600);
    });

    it('lands back on the floor it left, and recovers there', () => {
      const d = leapUntil((e) => e.phase === 'recovery' && e.attackKind === 'leap');
      expect(d.position.y).toBe(FLOOR_Y);
      expect(enemyAttackHitbox(d)).toBeNull(); // recovery is the punish window
    });

    it('never leaps into geometry, from anywhere along the arena floor', () => {
      // The rise and the dive set position directly and bypass drift's wall
      // probe, so the perch clamp and the dive abort are the only things
      // keeping him out of the walls.
      const w = arenaWorld();
      for (const startX of [40, 200, 584, 900, 1120]) {
        for (const herX of [30, 300, 584, 900, 1138]) {
          const t = targetAt(herX, FLOOR_Y);
          const duelist = createEnemy('duelist', startX, FLOOR_Y);
          for (let i = 0; i < 60 * 6; i++) {
            stepEnemy(duelist, w, FIXED_DT, t);
            const b = enemyBox(duelist);
            const stuck = w.solids.some(
              (s) =>
                b.x < s.x + s.width &&
                b.x + b.width > s.x &&
                b.y < s.y + s.height &&
                b.y + b.height > s.y,
            );
            expect(stuck).toBe(false);
          }
        }
      }
    });
  });

  describe('the anti-air column (playtest 3, note 6)', () => {
    /**
     * The pogo chain she actually flies, measured off the shipped physics:
     * a downslash contact at ~120 px above his feet, an apex of ~240, and a
     * bounce every 0.600 s. Driving the real profile is the point — a target
     * parked at one height would prove nothing about a chain.
     */
    const CHAIN = { contact: 120, apex: 240, period: 0.6 };

    /** Her feet at time t while chaining pogos straight down onto him. */
    function chainFeetY(t: number): number {
      const phase = (t % CHAIN.period) / CHAIN.period;
      // Up on the first half, down on the second — a triangle is close enough
      // to the real arc for a containment test, and it is honest about its
      // endpoints, which is what the box has to cover.
      const k = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      return FLOOR_Y - (CHAIN.contact + (CHAIN.apex - CHAIN.contact) * k);
    }

    /**
     * Run a duelist against a Knight who follows `feetAt`/`xAt`, and report
     * the first second at which the live swipe overlaps her hurtbox.
     */
    function caughtAt(
      xAt: (t: number) => number,
      feetAt: (t: number) => number,
      seconds = 3,
    ): number {
      const w = world();
      const duelist = createEnemy('duelist', 600, FLOOR_Y);
      duelist.cooldownTimer = 0;
      const steps = Math.round(seconds / FIXED_DT);
      for (let i = 0; i < steps; i++) {
        const t = i * FIXED_DT;
        const target: Target = {
          position: { x: xAt(t), y: feetAt(t) },
          grounded: false,
        };
        stepEnemy(duelist, w, FIXED_DT, target);
        const box = enemyAttackHitbox(duelist);
        if (!box) continue;
        // Her hurtbox: 18 wide, 47 tall, hanging above her feet.
        const hurt = { x: target.position.x - 9, y: target.position.y - 47, width: 18, height: 47 };
        const hit =
          box.x < hurt.x + hurt.width &&
          box.x + box.width > hurt.x &&
          box.y < hurt.y + hurt.height &&
          box.y + box.height > hurt.y;
        if (hit) return t;
      }
      return -1;
    }

    it('draws the box its own constants describe, so the picture cannot drift', () => {
      const A = ATTACKS.duelist;
      const duelist = createEnemy('duelist', 600, FLOOR_Y);
      duelist.attackKind = 'antiair';
      duelist.phase = 'active';
      duelist.lockedDir = 1;
      const box = enemyAttackHitbox(duelist)!;
      expect(box.width).toBe(A.antiAirWidth);
      expect(box.y).toBe(FLOOR_Y - A.antiAirTop);
      // It stands on his shoulders, not on the floor: a Knight on the ground
      // beside him is never inside it.
      expect(box.y + box.height).toBe(FLOOR_Y - ENEMY_SIZES.duelist.height);
      expect(box.x + box.width / 2).toBe(600 + A.antiAirForward);
    });

    it('reaches the top of a straight-down pogo chain within three quarters of a second', () => {
      // The whole of note 6 in one assertion: chaining pogos on his head used
      // to be free forever, because the old box topped out 12 px below the
      // bottom of her bounce.
      const t = caughtAt(() => 600, chainFeetY);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(0.75);
    });

    /**
     * The escape window, measured against the shipped physics rather than
     * assumed. Leaving `leaveAt` seconds after the bounce that provoked him:
     *
     *   leave   running (332)   dashing (800)
     *   0.00    escapes         escapes
     *   0.10    escapes         escapes
     *   0.15    CAUGHT          escapes
     *   0.20    CAUGHT          escapes
     *   0.30    CAUGHT          CAUGHT
     *
     * So: about a tenth of a second to run, about two tenths to dash, and
     * after that she is committed. That is the shape "one hit, then get out"
     * has to have — the way back in is to bait the column and punish its
     * recovery, which is the ratified reading of note 3.
     *
     * The column travels forward at antiAirDashSpeed (260) while it is live,
     * which is why a LATE run does not save her: she only nets 72 px/s on it,
     * and she needs ~80.
     */
    it('never catches her if she leaves the moment she bounces', () => {
      expect(caughtAt((s) => 600 + s * PHYSICS.runSpeed, chainFeetY)).toBe(-1);
    });

    it('still lets her out on a run a tenth of a second late', () => {
      const leaveAt = 0.1;
      const away = (s: number) => (s < leaveAt ? 600 : 600 + (s - leaveAt) * PHYSICS.runSpeed);
      expect(caughtAt(away, chainFeetY)).toBe(-1);
    });

    it('still lets her out on a dash twice that late, which is what the dash is for', () => {
      const leaveAt = 0.2;
      const away = (s: number) => (s < leaveAt ? 600 : 600 + (s - leaveAt) * PHYSICS.dashSpeed);
      expect(caughtAt(away, chainFeetY)).toBe(-1);
    });

    it('catches her if she commits too late — the tell is the whole warning', () => {
      // 0.05 s before the swipe lands, nothing saves her. Deliberate: the
      // 0.35 s telegraph IS the fairness contract, and reacting to its last
      // three frames is not reacting.
      const leaveAt = 0.3;
      const away = (s: number) => (s < leaveAt ? 600 : 600 + (s - leaveAt) * PHYSICS.dashSpeed);
      expect(caughtAt(away, chainFeetY)).toBeGreaterThanOrEqual(0);
    });

    it('catches her if she stays for the second bounce', () => {
      // One bounce is 0.600 s; going back for a second one means still being
      // over him when the column lands.
      const t = caughtAt(() => 600, chainFeetY, 2);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(CHAIN.period * 2);
    });

    it('carries the swipe forward at antiAirDashSpeed and no faster', () => {
      const w = world();
      const duelist = createEnemy('duelist', 600, FLOOR_Y);
      duelist.cooldownTimer = 0;
      const above: Target = { position: { x: 610, y: FLOOR_Y - 150 }, grounded: false };
      // Into the telegraph, then through the whole active window.
      let steps = 0;
      while (duelist.phase !== 'active' && steps < 120) {
        stepEnemy(duelist, w, FIXED_DT, above);
        steps++;
      }
      const startX = duelist.position.x;
      const activeSteps = Math.round(ATTACKS.duelist.antiAirActive / FIXED_DT);
      for (let i = 0; i < activeSteps; i++) stepEnemy(duelist, w, FIXED_DT, above);
      const travelled = Math.abs(duelist.position.x - startX);
      const expected = ATTACKS.duelist.antiAirDashSpeed * ATTACKS.duelist.antiAirActive;
      expect(travelled).toBeGreaterThan(expected * 0.85);
      expect(travelled).toBeLessThanOrEqual(expected + 1);
    });
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

  // Playtest 2: it hunts — marches in from anywhere, stalks once near, and
  // keeps closing while its cooldown runs, so backing off buys time, not safety.
  describe('hunting', () => {
    it('marches in from across the whole arena, then stalks the last stretch', () => {
      const A = ATTACKS.duelist;
      expect(A.marchSpeed).toBeGreaterThan(A.approachSpeed);
      const w = world();
      const duelist = createEnemy('duelist', 1000, FLOOR_Y);
      const t = targetAt(100, FLOOR_Y); // 900 px away
      // Measured over less than gapDwell, because past that the march is
      // interrupted by the leap — which is the point of the leap.
      const marchSteps = Math.floor(A.gapDwell / FIXED_DT) - 2;
      let x0 = duelist.position.x;
      run(duelist, w, marchSteps, t);
      expect((x0 - duelist.position.x) / (marchSteps * FIXED_DT)).toBeCloseTo(A.marchSpeed, 0);
      expect(duelist.phase).toBe('idle');

      // Inside stalkRange the dwell clock never starts, so the stalk is
      // still measurable over a full second.
      duelist.position.x = 100 + A.stalkRange - 10;
      duelist.awayTimer = 0;
      x0 = duelist.position.x;
      run(duelist, w, 60, t);
      expect(x0 - duelist.position.x).toBeCloseTo(A.approachSpeed, 0);
    });

    it('keeps closing while on cooldown, down to a stand-off inside the trigger range', () => {
      const w = world();
      const duelist = createEnemy('duelist', 600, FLOOR_Y);
      duelist.cooldownTimer = 5; // just attacked; cannot be provoked yet
      const t = targetAt(450, FLOOR_Y); // inside the trigger range
      run(duelist, w, 60, t);
      expect(duelist.phase).toBe('idle');
      expect(duelist.position.x).toBeLessThan(600 - 30); // it came closer anyway
      run(duelist, w, 240, t);
      // ...but stops short of walking into her.
      expect(duelist.position.x - 450).toBeCloseTo(ATTACKS.duelist.standOff, 0);
      expect(duelist.phase).toBe('idle');
    });
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

  // Playtest 2: it hunts — a tighter preferred range, an altitude that
  // follows her height band, and a back-off slower than the close-in.
  describe('hunting', () => {
    it('closes to its preferred range from across the arena (it holds still to spit)', () => {
      const w = world();
      const spitter = createEnemy('spitter', 1000, 430);
      const t = targetAt(100, FLOOR_Y);
      run(spitter, w, Math.ceil(20 / FIXED_DT), t);
      const A = ATTACKS.spitter;
      expect(A.preferredRange).toBeLessThanOrEqual(240);
      expect(Math.abs(spitter.position.x - 100)).toBeLessThanOrEqual(
        A.preferredRange + A.rangeSlack,
      );
    });

    it('backs off slower than it closes in, so the net motion is inward', () => {
      const A = ATTACKS.spitter;
      expect(A.backOffSpeed).toBeLessThan(A.strafeSpeed);
      const w = world();
      const far = createEnemy('spitter', 900, 430); // outside the band: closes in
      const crowded = createEnemy('spitter', 500, 430); // inside it: backs off
      const t = targetAt(480, FLOOR_Y);
      run(far, w, 30, t);
      run(crowded, w, 30, t);
      expect(900 - far.position.x).toBeCloseTo(A.strafeSpeed / 2, 0);
      expect(crowded.position.x - 500).toBeCloseTo(A.backOffSpeed / 2, 0);
    });

    it('comes down to her height band so a slash can reach it', () => {
      const w = world();
      const spitter = createEnemy('spitter', 700, 300); // well above nail reach
      const t = targetAt(400, FLOOR_Y);
      run(spitter, w, 600, t);
      // A side slash spans feet-56 .. feet+8; an upslash reaches 128 px above the feet.
      const box = enemyBox(spitter);
      expect(box.y + box.height).toBeGreaterThan(FLOOR_Y - 128);
      expect(box.y).toBeLessThan(FLOOR_Y + 8);
      expect(box.y + box.height).toBeLessThanOrEqual(FLOOR_Y); // still airborne, never in the floor
    });

    it('rises with her when she stands on a platform', () => {
      const w: World = {
        solids: [
          { x: -2000, y: FLOOR_Y, width: 6000, height: 200 },
          { x: 190, y: FLOOR_Y - 130, width: 140, height: 18 },
        ],
      };
      const spitter = createEnemy('spitter', 700, FLOOR_Y - 44);
      run(spitter, w, 600, targetAt(260, FLOOR_Y - 130, true));
      expect(spitter.position.y).toBeLessThan(FLOOR_Y - 130);
    });

    it('caught right under her ledge, it gets round it and up — never stuck in it', () => {
      const ledge = { x: 190, y: FLOOR_Y - 130, width: 140, height: 18 };
      const w: World = { solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }, ledge] };
      const spitter = createEnemy('spitter', 260, FLOOR_Y - 10);
      const t = targetAt(260, FLOOR_Y - 130, true);
      for (let i = 0; i < 600; i++) {
        stepEnemy(spitter, w, FIXED_DT, t);
        const box = enemyBox(spitter);
        const inLedge =
          box.x < ledge.x + ledge.width &&
          box.x + box.width > ledge.x &&
          box.y < ledge.y + ledge.height &&
          box.y + box.height > ledge.y;
        expect(inLedge).toBe(false);
      }
      expect(spitter.position.y).toBeLessThan(FLOOR_Y - 130);
    });
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
      // Deliberate reversal (playtest 3, note 4): an overhead block draws the
      // SKYWARD column now, not the forward riposte she was never in front of.
      expect(warden.attackKind).toBe('skyward');

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

    it('commits the shield UPWARD on a skyward, leaving the front bare from the tell on', () => {
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
      expect(warden.attackKind).toBe('skyward');
      // The shield stays up, which is exactly what opens the front.
      expect(warden.shieldDir).toBe('up');

      // A second downslash into that raised shield still rings off it, and
      // does NOT restart the attack — being overhead is simply the wrong
      // place to be once he has committed (ratified).
      above.swingId = 2;
      expect(resolveNailHit(above, warden, true)).toBe('blocked');
      expect(warden.phase).toBe('telegraph');

      // The front, meanwhile, is open from the telegraph onward.
      const front = createPlayer(540, FLOOR_Y);
      front.swingId = 3;
      front.nailFacing = 1;
      front.nailDir = 'side';
      expect(resolveNailHit(front, warden, true)).toBe('hit');
    });

    it('a front block still draws the plain forward riposte', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      run(warden, w, 5, targetAt(540, FLOOR_Y));
      expect(warden.shieldDir).toBe('front');
      const front = createPlayer(540, FLOOR_Y);
      front.swingId = 1;
      front.nailDir = 'side';
      front.nailFacing = 1;
      expect(resolveNailHit(front, warden, true)).toBe('blocked');
      expect(warden.attackKind).toBe('riposte');
      expect(warden.shieldDir).toBe('front');
    });

    it('stands its column on his head, so the ground in front of him stays safe', () => {
      const A = ATTACKS.warden;
      const warden = createEnemy('warden', 600, FLOOR_Y);
      warden.attackKind = 'skyward';
      warden.phase = 'active';
      warden.lockedDir = 1;
      const box = enemyAttackHitbox(warden)!;
      expect(box.y).toBe(FLOOR_Y - A.skywardTop);
      expect(box.y + box.height).toBe(FLOOR_Y - ENEMY_SIZES.warden.height);
      expect(box.width).toBe(A.skywardWidth);
      // It leans BEHIND his facing — that is where she was when she blocked.
      expect(box.x + box.width / 2).toBe(600 - A.skywardBack);

      // A Knight standing on the ground in front of him is never inside it,
      // even while it is live. That is what makes the loop work.
      const grounded = { x: 640 - 9, y: FLOOR_Y - 47, width: 18, height: 47 };
      expect(boxesOverlap(box, grounded)).toBe(false);
    });

    it('catches a Knight still hanging where she blocked', () => {
      const warden = createEnemy('warden', 600, FLOOR_Y);
      warden.attackKind = 'skyward';
      warden.phase = 'active';
      warden.lockedDir = 1;
      const box = enemyAttackHitbox(warden)!;
      // Feet 90 px up, which is where the overhead block happens.
      const hovering = { x: 600 - 9, y: FLOOR_Y - 90 - 47, width: 18, height: 47 };
      expect(boxesOverlap(box, hovering)).toBe(true);
    });

    it('does not lunge while the column is up — the front must stay reachable', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      warden.attackKind = 'skyward';
      warden.lockedDir = 1;
      warden.phase = 'active';
      warden.phaseTimer = ATTACKS.warden.skywardActive;
      const startX = warden.position.x;
      const steps = Math.round(ATTACKS.warden.skywardActive / FIXED_DT);
      for (let i = 0; i < steps; i++) {
        stepEnemy(warden, w, FIXED_DT, targetAt(600, FLOOR_Y - 90, false));
      }
      expect(warden.position.x).toBe(startX);
    });

    it('keeps the shield up through the whole skyward recovery', () => {
      const w = world();
      const warden = createEnemy('warden', 600, FLOOR_Y);
      warden.attackKind = 'skyward';
      warden.shieldDir = 'up';
      warden.lockedDir = 1;
      warden.phase = 'recovery';
      warden.phaseTimer = ATTACKS.warden.skywardRecovery;
      // She is on the ground in front of him now — which normally re-aims the
      // shield down within reaimDownDelay.
      const steps = Math.round(ATTACKS.warden.skywardRecovery / FIXED_DT) - 2;
      for (let i = 0; i < steps; i++) stepEnemy(warden, w, FIXED_DT, targetAt(540, FLOOR_Y));
      expect(warden.shieldDir).toBe('up');
      // And it comes down once he is idle again.
      for (let i = 0; i < 4; i++) stepEnemy(warden, w, FIXED_DT, targetAt(540, FLOOR_Y));
      expect(warden.phase).toBe('idle');
      expect(warden.shieldDir).toBe('front');
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

  // Playtest 2: it hunts — marches across the arena, then slows to its
  // deliberate stalk once it is close enough to square up.
  describe('hunting', () => {
    it('marches in from across the whole arena, then stalks the last stretch', () => {
      const A = ATTACKS.warden;
      expect(A.marchSpeed).toBeGreaterThan(A.approachSpeed);
      const w = world();
      const warden = createEnemy('warden', 1100, FLOOR_Y);
      const t = targetAt(100, FLOOR_Y); // 1000 px away
      let x0 = warden.position.x;
      run(warden, w, 60, t);
      expect(x0 - warden.position.x).toBeCloseTo(A.marchSpeed, 0);
      // Bring it to the stalk zone and measure a second there.
      warden.position.x = 100 + A.stalkRange - 10;
      x0 = warden.position.x;
      run(warden, w, 60, t);
      expect(x0 - warden.position.x).toBeCloseTo(A.approachSpeed, 0);
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

/**
 * Bill the man. The fight is a survival clock, so every assertion here is
 * about REACH — what the pass covers, what it cannot, and what a bounce buys.
 */
describe('Bill the man', () => {
  /** Her hurtbox, feet-anchored like everything else in this engine. */
  function knightBox(x: number, feetY: number): Box {
    return {
      x: x - KNIGHT.hurtboxWidth / 2,
      y: feetY - KNIGHT.hurtboxHeight,
      width: KNIGHT.hurtboxWidth,
      height: KNIGHT.hurtboxHeight,
    };
  }

  /** Does anything of his — body or foam finger — touch her right now? */
  function touching(bill: Enemy, box: Box): boolean {
    const attack = enemyAttackHitbox(bill);
    return boxesOverlap(box, enemyBox(bill)) || (attack !== null && boxesOverlap(box, attack));
  }

  /**
   * Run one whole lance: wait for it to be committed, then step until he is
   * stuck against the wall. Reports whether she was ever touched on the way.
   */
  function lancePass(bill: Enemy, w: World, t: Target, knight: Box): boolean {
    let hit = false;
    for (let i = 0; i < 60 * 12; i++) {
      stepEnemy(bill, w, FIXED_DT, t);
      if (touching(bill, knight)) hit = true;
      if (bill.attackKind === 'lance' && bill.phase === 'recovery') return hit;
    }
    throw new Error('the lance never finished');
  }

  it('marches at her and stops a body length short', () => {
    const w = arenaWorld();
    const bill = createEnemy('bill', 900, FLOOR_Y);
    // Held in his cooldown so the march is the only thing being measured.
    bill.cooldownTimer = 10;
    run(bill, w, 60 * 8, targetAt(200, FLOOR_Y));
    const gap = bill.position.x - 200;
    expect(gap).toBeLessThanOrEqual(ATTACKS.bill.standOff);
    expect(gap).toBeGreaterThan(ATTACKS.bill.standOff - ATTACKS.bill.marchSpeed * FIXED_DT);
    expect(bill.facing).toBe(-1);
  });

  it('crosses the arena and is stopped by the wall, not by a timer', () => {
    const w = arenaWorld();
    const bill = createEnemy('bill', 900, FLOOR_Y);
    const leftWall = w.solids[1]!;
    lancePass(bill, w, targetAt(100, FLOOR_Y), knightBox(100, FLOOR_Y));
    // Flush against the left wall's inner face, not short of it.
    expect(bill.position.x).toBe(leftWall.x + leftWall.width + ENEMY_SIZES.bill.width / 2);
    expect(bill.phaseTimer).toBeCloseTo(ATTACKS.bill.lanceStuck, 5);
  });

  it('leaves no safe ground — every corner of the floor is inside the pass', () => {
    for (const x of [30, 584, 1138]) {
      const w = arenaWorld();
      const bill = createEnemy('bill', 900, FLOOR_Y);
      const t = targetAt(x, FLOOR_Y);
      expect(lancePass(bill, w, t, knightBox(x, FLOOR_Y))).toBe(true);
    }
  });

  it('misses a Knight who is above his head for the whole pass', () => {
    // 370 is the window the tuning was derived for: her down-nail reaches his
    // head at 440 and his body cannot reach her. Being airborne is the answer.
    const w = arenaWorld();
    const bill = createEnemy('bill', 900, FLOOR_Y);
    const t = targetAt(584, 370, false);
    expect(lancePass(bill, w, t, knightBox(584, 370))).toBe(false);
  });

  it('gives her the first head bounce free, then shakes her off', () => {
    const w = arenaWorld();
    const bill = createEnemy('bill', 600, FLOOR_Y);
    bill.cooldownTimer = 0;
    const overhead = targetAt(600, 370, false);

    // A downslash just landed on his head.
    const player = createPlayer(600, 370);
    player.nailDir = 'down';
    player.swingId += 1;
    expect(resolveNailHit(player, bill, true)).toBe('blocked');
    expect(bill.sinceBounce).toBe(0);

    // The half second she was promised.
    run(bill, w, Math.floor(ATTACKS.bill.swatAfterBounce / FIXED_DT) - 1, overhead);
    expect(bill.attackKind).not.toBe('swat');

    // And then the arm comes up — with its full tell still ahead of it.
    for (let i = 0; i < 5 && bill.attackKind !== 'swat'; i++)
      stepEnemy(bill, w, FIXED_DT, overhead);
    expect(bill.attackKind).toBe('swat');
    expect(bill.phase).toBe('telegraph');
    expect(bill.phaseTimer).toBe(ATTACKS.bill.swatTelegraph);
  });

  it('does not swat at a Knight who left, even inside the window', () => {
    const w = arenaWorld();
    const bill = createEnemy('bill', 600, FLOOR_Y);
    bill.cooldownTimer = 0;
    bill.sinceBounce = 0;
    // 100 px out is past overheadHalfWidth (90) — she got clear in time.
    run(
      bill,
      w,
      Math.floor(ATTACKS.bill.swatAfterBounce / FIXED_DT) + 5,
      targetAt(700, 370, false),
    );
    expect(bill.attackKind).not.toBe('swat');
  });

  it('swats a column that stands on his shoulders, out of reach of the floor', () => {
    const w = arenaWorld();
    const bill = createEnemy('bill', 600, FLOOR_Y);
    bill.cooldownTimer = 0;
    bill.sinceBounce = ATTACKS.bill.swatAfterBounce;
    const overhead = targetAt(600, 370, false);
    run(bill, w, Math.ceil(ATTACKS.bill.swatTelegraph / FIXED_DT) + 2, overhead);
    expect(bill.phase).toBe('active');

    const box = enemyAttackHitbox(bill);
    expect(box).not.toBeNull();
    // Bottom at his head (600 - 160), top 150 higher: y 290 on this floor.
    expect(box!.y).toBe(FLOOR_Y - ENEMY_SIZES.bill.height - ATTACKS.bill.swatHeight);
    expect(box!.y + box!.height).toBe(FLOOR_Y - ENEMY_SIZES.bill.height);
    // A Knight standing at his feet is not in it — only being above him is.
    expect(boxesOverlap(box!, knightBox(600, FLOOR_Y))).toBe(false);
  });

  it('past 1:00 he comes straight back for a second pass, faster', () => {
    const w = arenaWorld();
    const bill = createEnemy('bill', 900, FLOOR_Y);
    bill.hot = true;
    const t = targetAt(100, FLOOR_Y);

    lancePass(bill, w, t, knightBox(100, FLOOR_Y));
    expect(bill.lancePasses).toBe(1);
    const firstEnd = bill.position.x;

    // The stuck second, then he turns around rather than standing down.
    run(bill, w, Math.ceil(ATTACKS.bill.lanceStuck / FIXED_DT), t);
    expect(bill.attackKind).toBe('lance');
    expect(bill.phase).toBe('telegraph');
    // The tell is the fairness contract: heat never shortens it.
    expect(bill.phaseTimer).toBeCloseTo(ENEMIES.bill.telegraph!, 2);
    expect(bill.lockedDir).toBe(1);

    lancePass(bill, w, t, knightBox(100, FLOOR_Y));
    expect(bill.position.x).toBeGreaterThan(firstEnd);
    expect(bill.lancePasses).toBe(0);
  });

  it('charges a quarter faster while hot', () => {
    const w = { solids: [{ x: -2000, y: FLOOR_Y, width: 6000, height: 200 }] };
    const distance = (hot: boolean): number => {
      const bill = createEnemy('bill', 600, FLOOR_Y);
      bill.hot = hot;
      const t = targetAt(2000, FLOOR_Y);
      // Into the charge, then exactly one second of it.
      for (let i = 0; i < 60 * 30 && bill.phase !== 'active'; i++) stepEnemy(bill, w, FIXED_DT, t);
      const from = bill.position.x;
      run(bill, w, 60, t);
      return bill.position.x - from;
    };
    expect(distance(true) / distance(false)).toBeCloseTo(
      ATTACKS.bill.lanceSpeedHot / ATTACKS.bill.lanceSpeed,
      2,
    );
  });
});

/**
 * Bill the dog. Nothing here is new vocabulary — the bones are the spitter's
 * fan and the ball is course level 2's red orb — so the assertions are about
 * SAMENESS: same fan shape, same pogo-safe rule, same arcs every time.
 */
describe('Bill the dog', () => {
  /** Step him into his roll and hand back the world he is rolling in. */
  function rolling(hot = false): { dog: Enemy; w: World; t: Target } {
    const w = arenaWorld();
    const dog = createEnemy('dog', 584, FLOOR_Y);
    dog.hot = hot;
    dog.rollTimer = 0; // his roll is due
    const t = targetAt(200, FLOOR_Y);
    for (let i = 0; i < 60 * 5 && !dog.roll; i++) stepEnemy(dog, w, FIXED_DT, t);
    expect(dog.roll).toBe(true);
    return { dog, w, t };
  }

  it('spits the spitter fan: three shots, aimed at her chest, pokeable', () => {
    const w = arenaWorld();
    const dog = createEnemy('dog', 584, FLOOR_Y);
    const t = targetAt(900, FLOOR_Y);
    const shots = run(dog, w, 60 * 5, t);
    expect(shots).toHaveLength(ATTACKS.dog.shots);

    // Same fan geometry the lesson taught: evenly spread about the aim line.
    const angles = shots.map((sh) => Math.atan2(sh.velocity.y, sh.velocity.x));
    const spread = Math.max(...angles) - Math.min(...angles);
    expect(spread).toBeCloseTo((ATTACKS.dog.spreadDeg * Math.PI) / 180, 5);
    for (const sh of shots) {
      expect(Math.hypot(sh.velocity.x, sh.velocity.y)).toBeCloseTo(ATTACKS.dog.projSpeed, 5);
    }

    // And the nail still nullifies them — stepArena owns that, but the shape
    // it needs (a live projectile with a radius) is what is asserted here.
    expect(shots.every((sh) => !sh.dead && sh.radius > 0)).toBe(true);
  });

  it('bounces in even arcs — every hop reaches the same height', () => {
    const { dog, w, t } = rolling();
    const apexes: number[] = [];
    let arcTop = dog.position.y;
    let rising = true;
    for (let i = 0; i < 60 * 5 && dog.roll; i++) {
      const before = dog.position.y;
      stepEnemy(dog, w, FIXED_DT, t);
      if (dog.position.y < before) {
        rising = true;
        arcTop = Math.min(arcTop, dog.position.y);
      } else if (rising) {
        apexes.push(arcTop);
        rising = false;
        arcTop = dog.position.y;
      }
    }
    // 620 up against 1500 down is a 128 px apex; six arcs fit in the 5 s roll.
    expect(apexes.length).toBeGreaterThanOrEqual(5);
    const analytic = ATTACKS.dog.rollLaunch ** 2 / (2 * ATTACKS.dog.rollGravity);
    for (const apex of apexes) {
      expect(apex).toBeCloseTo(apexes[0]!, 6); // no decay, ever
      expect(FLOOR_Y - apex).toBeGreaterThan(analytic - 10);
      expect(FLOOR_Y - apex).toBeLessThanOrEqual(analytic);
    }
  });

  it('never leaves the arena, and comes off both walls', () => {
    const { dog, w, t } = rolling();
    const half = ENEMY_SIZES.dog.width / 2;
    const directions = new Set<number>();
    for (let i = 0; i < 60 * 5 && dog.roll; i++) {
      stepEnemy(dog, w, FIXED_DT, t);
      directions.add(Math.sign(dog.velocity.x));
      expect(dog.position.x).toBeGreaterThanOrEqual(half);
      expect(dog.position.x).toBeLessThanOrEqual(CANVAS.width - half);
    }
    expect(directions).toEqual(new Set([1, -1]));
  });

  it('uncurls back onto the floor when the roll runs out', () => {
    const { dog, w, t } = rolling();
    for (let i = 0; i < 60 * 8 && dog.roll; i++) stepEnemy(dog, w, FIXED_DT, t);
    expect(dog.roll).toBe(false);
    expect(dog.position.y).toBe(FLOOR_Y);
    expect(dog.attackKind).toBeNull();
    expect(dog.velocity.y).toBe(0);
  });

  it('carries the ball a quarter further per second while hot', () => {
    const travelled = (hot: boolean): number => {
      const { dog, w, t } = rolling(hot);
      const from = dog.position.x;
      // Half a second, well inside the first arc, so no wall is involved.
      run(dog, w, 30, t);
      return Math.abs(dog.position.x - from);
    };
    expect(travelled(true) / travelled(false)).toBeCloseTo(
      ATTACKS.dog.rollSpeedXHot / ATTACKS.dog.rollSpeedX,
      2,
    );
  });

  it('is deterministic — two dogs given the same seconds stay identical', () => {
    const a = rolling();
    const b = rolling();
    run(a.dog, a.w, 60 * 4, a.t);
    run(b.dog, b.w, 60 * 4, b.t);
    expect(a.dog.position).toEqual(b.dog.position);
    expect(a.dog.velocity).toEqual(b.dog.velocity);
  });
});
