/**
 * Legibility contract for the enemy painter (playtest 3, note 4 follow-up).
 *
 * The warden's skyward column shipped with its hitbox asserted to the pixel
 * and its drawing derived from those same constants — and was still wrong,
 * because `drawWarden` painted the 0.5 s telegraph in the *identical* place
 * the idle shield-up pose sits. Every geometry test was green; the attack was
 * invisible until the column arrived. The user's report: "he just blocks
 * upward, and suddenly there's a massive hitbox".
 *
 * Geometry tests cannot see that. These can. `recordingCtx` stands in for a
 * canvas and records the drawing calls instead of rasterising them, so a pose
 * is comparable as a string in a plain node test — no jsdom, no canvas
 * package, nothing added to the toolchain.
 *
 * The contract, for every attacker and every attack it owns:
 *   1. the telegraph must not draw the same picture as the idle it interrupts;
 *   2. the tell for the biggest, slowest attack in the game must *move*.
 */
import { describe, expect, it } from 'vitest';
import type { EnemyId } from '@dojo/shared';
import { ENEMIES } from './constants';
import { ATTACKS, createEnemy, type AttackKind, type Enemy } from './enemies';
import { drawEnemy } from './render';

const FLOOR_Y = 600;

/**
 * A canvas that writes down what it was asked to draw. Method calls are
 * recorded with their arguments; property assignments (fillStyle, globalAlpha,
 * lineWidth …) are recorded too, because a pose can differ by colour alone.
 * Numbers are rounded to 0.01 px so floating-point noise never decides a test.
 */
function recordingCtx(): { ops: string[]; ctx: CanvasRenderingContext2D } {
  const ops: string[] = [];
  const show = (v: unknown): string =>
    typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v);
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get(target, prop) {
      const key = String(prop);
      if (key in target) return target[key];
      const fn = (...args: unknown[]): void => {
        ops.push(`${key}(${args.map(show).join(',')})`);
      };
      target[key] = fn;
      return fn;
    },
    set(target, prop, value) {
      const key = String(prop);
      ops.push(`${key}=${show(value)}`);
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ops, ctx };
}

/** Paint one enemy in one state and return the drawing calls it made. */
function paint(id: EnemyId, mutate: (e: Enemy) => void, timeS = 0): string[] {
  const { ops, ctx } = recordingCtx();
  const enemy = createEnemy(id, 400, FLOOR_Y);
  enemy.facing = 1;
  enemy.lockedDir = 1;
  // Isolate the pose: the hurt and block flashes are generic feedback that
  // fire on every enemy, so leaving them on would mask a missing tell.
  enemy.hurtFlashTimer = 0;
  enemy.blockFlashTimer = 0;
  mutate(enemy);
  drawEnemy(ctx, { x: enemy.position.x, y: enemy.position.y }, enemy, timeS, 0);
  return ops;
}

/** Every attack in the game, with the tell length and the idle it interrupts. */
const ATTACK_CASES: {
  id: EnemyId;
  kind: AttackKind;
  tell: number;
  /** The warden's idle depends on where the shield is pointing when it starts. */
  shieldDir?: 'front' | 'up';
}[] = [
  { id: 'duelist', kind: 'lunge', tell: ENEMIES.duelist.telegraph ?? 0.35 },
  { id: 'duelist', kind: 'antiair', tell: ENEMIES.duelist.telegraph ?? 0.35 },
  { id: 'duelist', kind: 'leap', tell: ENEMIES.duelist.telegraph ?? 0.35 },
  { id: 'spitter', kind: 'volley', tell: ENEMIES.spitter.telegraph ?? 0.5 },
  { id: 'warden', kind: 'riposte', tell: ENEMIES.warden.telegraph ?? 0.4, shieldDir: 'front' },
  { id: 'warden', kind: 'bash', tell: ENEMIES.warden.telegraph ?? 0.4, shieldDir: 'front' },
  { id: 'warden', kind: 'skyward', tell: ATTACKS.warden.skywardTell, shieldDir: 'up' },
];

function idlePose(c: (typeof ATTACK_CASES)[number]): string[] {
  return paint(c.id, (e) => {
    e.phase = 'idle';
    e.attackKind = null;
    e.phaseTimer = 0;
    if (c.shieldDir) e.shieldDir = c.shieldDir;
  });
}

function tellPose(c: (typeof ATTACK_CASES)[number], elapsed: number): string[] {
  return paint(c.id, (e) => {
    e.phase = 'telegraph';
    e.attackKind = c.kind;
    // phaseTimer counts DOWN, so `elapsed` seconds in means this much left.
    e.phaseTimer = Math.max(1e-6, c.tell - elapsed);
    if (c.shieldDir) e.shieldDir = c.shieldDir;
  });
}

describe('every telegraph is visibly different from the idle it interrupts', () => {
  for (const c of ATTACK_CASES) {
    it(`${c.id} · ${c.kind}`, () => {
      const idle = idlePose(c);
      // Both ends of the window: a tell that only appears on its last frame
      // is not a tell she can react to.
      expect(tellPose(c, 0).join('\n')).not.toBe(idle.join('\n'));
      expect(tellPose(c, c.tell * 0.98).join('\n')).not.toBe(idle.join('\n'));
    });
  }
});

describe("the warden's skyward tell", () => {
  const c = ATTACK_CASES.find((x) => x.kind === 'skyward')!;

  it('moves through its own window instead of holding one frame', () => {
    // The longest tell in the game (0.5 s) against the biggest hitbox in the
    // game. A static pose wastes it: she gets "something is coming" but not
    // "how long have I got". The other tells are 0.35-0.4 s, where a held
    // pose is fine; this one has room to animate and needs to.
    const start = tellPose(c, 0).join('\n');
    const middle = tellPose(c, c.tell * 0.5).join('\n');
    const end = tellPose(c, c.tell * 0.98).join('\n');
    expect(start).not.toBe(middle);
    expect(middle).not.toBe(end);
  });

  it('does not look like the warden merely holding his shield overhead', () => {
    // The exact bug. `shieldDir` is already 'up' when the skyward starts —
    // she has just downslashed into the raised shield — so "shield is up" is
    // the state she was ALREADY looking at. The tell has to add something.
    const shieldUpIdle = paint('warden', (e) => {
      e.phase = 'idle';
      e.attackKind = null;
      e.shieldDir = 'up';
      e.phaseTimer = 0;
    }).join('\n');
    for (const elapsed of [0, 0.125, 0.25, 0.375, 0.49]) {
      expect(tellPose(c, elapsed).join('\n')).not.toBe(shieldUpIdle);
    }
  });
});
