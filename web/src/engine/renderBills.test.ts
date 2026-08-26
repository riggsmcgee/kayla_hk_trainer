/**
 * The boss art's translation layer, and its legibility.
 *
 * Two halves, because the risk is in two places.
 *
 * The mapping half is pure: `billPose` / `billDogPose` turn the fight's state
 * into a pose name, and the fight's own state machine (T11) is not written
 * yet — so this table is the contract the machine will be built against, and
 * it is the only place the art and the simulation have to agree.
 *
 * The drawing half is the lesson from playtest 3's warden: geometry tests
 * cannot see a pose that draws the wrong picture. A pose that silently falls
 * through to the idle branch would look exactly like a working boss until
 * somebody watched it. The round-one concept audit caught precisely that in
 * another design, so it is worth a test rather than an eyeball.
 */
import { describe, expect, it } from 'vitest';
import { ENEMY_SIZES, createEnemy, type AttackKind, type Enemy } from './enemies';
import { drawBill, drawBillDog, billDogPose, billPose } from './renderBills';

/**
 * A canvas that writes down what it was asked to draw, so a pose is
 * comparable as a string in a plain node test. Same idea as the recorder in
 * `render.test.ts`; kept local so no test scaffolding has to live in `src`
 * where the app bundle could pick it up.
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

function bill(attackKind: AttackKind | null, phase: Enemy['phase']): Enemy {
  const e = createEnemy('bill', 400, 600);
  e.attackKind = attackKind;
  e.phase = phase;
  return e;
}

function dog(attackKind: AttackKind | null, phase: Enemy['phase'], rolling = false): Enemy {
  const e = createEnemy('dog', 400, 600);
  e.attackKind = attackKind;
  e.phase = phase;
  e.roll = rolling;
  return e;
}

describe('billPose', () => {
  it('gives the lance its three beats', () => {
    expect(billPose(bill('lance', 'telegraph'))).toBe('lanceTell');
    expect(billPose(bill('lance', 'active'))).toBe('lanceDash');
    // He ends the dash against the far wall, dazed: her punish window.
    expect(billPose(bill('lance', 'recovery'))).toBe('stuck');
  });

  it('gives the swat two, and recovers on his feet rather than dazed', () => {
    expect(billPose(bill('swat', 'telegraph'))).toBe('swatTell');
    expect(billPose(bill('swat', 'active'))).toBe('swat');
    // Only the lance ends against a wall, so only the lance is ever `stuck`.
    expect(billPose(bill('swat', 'recovery'))).toBe('idle');
  });

  it('falls back to idle rather than blanking', () => {
    expect(billPose(bill(null, 'idle'))).toBe('idle');
    // The state machine is not written yet; a boss that draws nothing for a
    // frame is worse than one in a slightly wrong pose.
    expect(billPose(bill('bones', 'active'))).toBe('idle');
  });
});

describe('billDogPose', () => {
  it('gives bones and roll their two beats each', () => {
    expect(billDogPose(dog('bones', 'telegraph'))).toBe('bonesTell');
    expect(billDogPose(dog('bones', 'active'))).toBe('bones');
    expect(billDogPose(dog('roll', 'telegraph'))).toBe('rollTell');
    expect(billDogPose(dog('roll', 'active'))).toBe('roll');
  });

  it('keeps drawing the ball while it is still bouncing', () => {
    // The roll lasts about five seconds and outlives its own attack phases,
    // so the `roll` flag wins over whatever the phase has moved on to.
    expect(billDogPose(dog(null, 'idle', true))).toBe('roll');
    expect(billDogPose(dog('bones', 'telegraph', true))).toBe('roll');
  });

  it('stands still when nothing is happening', () => {
    expect(billDogPose(dog(null, 'idle'))).toBe('idle');
  });
});

/** Every pose the fight can put each Bill into, as (attackKind, phase, roll). */
const BILL_STATES: [AttackKind | null, Enemy['phase']][] = [
  [null, 'idle'],
  ['lance', 'telegraph'],
  ['lance', 'active'],
  ['lance', 'recovery'],
  ['swat', 'telegraph'],
  ['swat', 'active'],
];

const DOG_STATES: [AttackKind | null, Enemy['phase'], boolean][] = [
  [null, 'idle', false],
  ['walk' as AttackKind, 'idle', false],
  ['bones', 'telegraph', false],
  ['bones', 'active', false],
  ['roll', 'telegraph', false],
  ['roll', 'active', true],
];

describe('every boss pose draws its own picture', () => {
  it('Bill the man: six states, six different pictures', () => {
    const drawn = BILL_STATES.map(([kind, phase]) => {
      const { ops, ctx } = recordingCtx();
      drawBill(ctx, { x: 400, y: 600 }, bill(kind, phase), 0);
      expect(ops.length).toBeGreaterThan(0);
      return ops.join('\n');
    });
    // A pose that silently fell through to idle would collapse this set.
    expect(new Set(drawn).size).toBe(BILL_STATES.length);
  });

  it('Bill the dog: the standing rig and the ball are all distinct', () => {
    const drawn = DOG_STATES.map(([kind, phase, rolling]) => {
      const { ops, ctx } = recordingCtx();
      drawBillDog(ctx, { x: 400, y: 600 }, dog(kind, phase, rolling), 0);
      expect(ops.length).toBeGreaterThan(0);
      return ops.join('\n');
    });
    // 'walk' is not a real AttackKind for the dog, so it maps to idle like
    // the null case — five distinct pictures from six states.
    expect(new Set(drawn).size).toBe(5);
  });

  it('leaves the canvas state balanced', () => {
    for (const [kind, phase] of BILL_STATES) {
      const { ops, ctx } = recordingCtx();
      drawBill(ctx, { x: 400, y: 600 }, bill(kind, phase), 0);
      const saves = ops.filter((o) => o === 'save()').length;
      const restores = ops.filter((o) => o === 'restore()').length;
      expect(saves).toBe(restores);
    }
  });

  it('animates: the tells are two-frame vibrations, not held pictures', () => {
    // The whole reason this art direction was chosen. If a future edit
    // smooths the motion out with an interpolation, the frames stop
    // differing and this goes red.
    for (const [kind, phase] of [
      ['lance', 'telegraph'],
      ['swat', 'telegraph'],
    ] as [AttackKind, Enemy['phase']][]) {
      const frame = (t: number): string => {
        const { ops, ctx } = recordingCtx();
        drawBill(ctx, { x: 400, y: 600 }, bill(kind, phase), t);
        return ops.join('\n');
      };
      // Sample across the whole windup rather than guessing where a frame
      // boundary falls: the tells run at 14 and 16 Hz, and the assertion is
      // "it has more than one frame", not "it flips at exactly this t".
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) seen.add(frame(i * 0.05));
      expect(seen.size).toBeGreaterThan(1);
    }
  });
});

describe('the rolling ball shows its own rule', () => {
  /** Paint one dog and hand back what the canvas was asked to do. */
  function paintDog(rolling: boolean): string[] {
    const { ops, ctx } = recordingCtx();
    drawBillDog(ctx, { x: 400, y: 600 }, dog('roll', 'active', rolling), 0);
    return ops;
  }

  /** The hazard ring: a full circle stroked around the ball’s silhouette. */
  const RING = `arc(400,${600 - ENEMY_SIZES.dog.height / 2},${ENEMY_SIZES.dog.height / 2 - 3},`;
  const rings = (ops: string[]) => ops.filter((op) => op.startsWith(RING));

  it('rings the whole ball — playtest 4 struck the pogo-safe cap', () => {
    // The cap used to clip a pale band across the top and say "ride here".
    // The ball is lethal everywhere now, so that marker would be a lie that
    // costs her a run. No clip, no band; a ring all the way round instead.
    const ops = paintDog(true);
    expect(rings(ops)).toHaveLength(1);
    expect(ops.some((op) => op === 'clip()')).toBe(false);
  });

  it('does not ring a dog who is standing — the ring is the ROLL’s marker', () => {
    expect(rings(paintDog(false))).toHaveLength(0);
  });

  it('draws the ring ON TOP, so a replacement painting cannot bury it', () => {
    const ops = paintDog(true);
    // Everything the art drew came first; the marker is the last thing said.
    expect(ops.findIndex((op) => op.startsWith(RING))).toBeGreaterThan(0);
    expect(ops[ops.length - 1]).toBe('restore()');
  });
});
