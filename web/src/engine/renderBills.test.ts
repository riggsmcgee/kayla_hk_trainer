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
import { paintBillMan, type BillPose } from './renderBillMan';
import { paintBillDog, type BillDogPose } from './renderBillDog';
import { DEFAULT_DOG_LOOK, DOG_LOOKS, boneAngle, dogLook } from './dogLook';

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

describe('billDogPose', () => {
  it('trots while he is walking in on his card', () => {
    // He carries no attack and no phase during his entrance, so this flag is
    // the only thing standing between the card and a standing dog sliding
    // 280 px across the arena. Checked before every other branch.
    const walkingIn = dog(null, 'idle');
    walkingIn.walkingIn = true;
    expect(billDogPose(walkingIn)).toBe('walkIn');
    expect(billDogPose(dog(null, 'idle'))).toBe('idle');
  });
});

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

  it('trots out of the ball instead of blinking back onto four feet', () => {
    // Playtest 5, note 2. `walkIn` was fully drawn and unreachable — nothing in
    // the fight could ever put him in it, so it is the pose the uncurl gets.
    expect(billDogPose(dog('uncurl', 'active'))).toBe('walkIn');
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
  ['uncurl', 'idle', false],
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
    // the null case — six distinct pictures from seven states. 'uncurl' is
    // the trot, and it went uncovered here for a whole round after playtest
    // 5 made it reachable: this table is literal, so a new pose adds no row
    // and nothing goes red on its own.
    expect(new Set(drawn).size).toBe(6);
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

// ---------------------------------------------------------------------------
// Playtest 4 — the ball and the bones ship as a portfolio too.
// ---------------------------------------------------------------------------
describe('the dog’s hazard looks', () => {
  it('offers four, each named and described', () => {
    expect(DOG_LOOKS).toHaveLength(4);
    expect(new Set(DOG_LOOKS.map((l) => l.name)).size).toBe(4);
    for (const l of DOG_LOOKS) expect(l.feel.length).toBeGreaterThan(20);
  });

  it('defaults to the pick: stepped bones on the plain orb ring', () => {
    // Playtest 5 asked for "Stepped for the bones" — the BONES, not the
    // broken ring the portfolio happened to bundle them with. Every fallback
    // here used to resolve to index 0, so a fresh browser played the SMOOTH
    // bones: the one version the user had just voted against.
    const pick = dogLook(DEFAULT_DOG_LOOK);
    expect(pick.boneSteps).toBe(8);
    expect(pick.ring).toBe('thin');
  });

  it('leaves the three older looks exactly where they were', () => {
    // The picker exists to compare, so a stored index must never come back
    // pointing at a different design.
    expect(DOG_LOOKS.slice(0, 3).map((l) => l.name)).toEqual(['Orb rules', 'Loud', 'Stepped']);
  });

  it('marks the ball in every one of them — none of them can say nothing', () => {
    // The pale "safe on top" cap is struck, so the ball is lethal everywhere.
    // A look that drew no marker at all would leave a rule the simulation
    // enforces and the picture never mentions, which is exactly how the
    // warden's invisible telegraph shipped.
    for (const look of DOG_LOOKS) {
      const { ops, ctx } = recordingCtx();
      drawBillDog(ctx, { x: 400, y: 600 }, dog('roll', 'active', true), 0, look.ring);
      expect(ops.some((op) => op.startsWith('arc(400,'))).toBe(true);
      expect(ops.some((op) => op === 'stroke()')).toBe(true);
    }
  });

  it('draws no ring on a dog who is not a ball, whichever look is chosen', () => {
    for (const look of DOG_LOOKS) {
      const { ops, ctx } = recordingCtx();
      drawBillDog(ctx, { x: 400, y: 600 }, dog('roll', 'active', false), 0, look.ring);
      expect(ops.some((op) => op === 'stroke()')).toBe(false);
    }
  });

  it('snaps a bone’s rotation only when the look asks for it', () => {
    // The finding this portfolio surfaced: the bones as first built rotate
    // CONTINUOUSLY, and PLAN.md §3 ratifies that nothing in either Bill
    // module interpolates. `boneSteps` is the fix, and one of the three
    // looks applies it, so the user can see the difference rather than be
    // told about it.
    const odd = 0.37;
    expect(boneAngle(odd, 0)).toBe(odd);
    for (const steps of [4, 8, 16]) {
      const turn = (Math.PI * 2) / steps;
      const snapped = boneAngle(odd, steps);
      expect(snapped / turn).toBeCloseTo(Math.round(snapped / turn), 10);
      expect(Math.abs(snapped - odd)).toBeLessThanOrEqual(turn / 2 + 1e-9);
    }
    expect(DOG_LOOKS.some((l) => l.boneSteps > 0)).toBe(true);
  });

  it('falls back to the picked look for an index that does not exist', () => {
    expect(dogLook(99)).toBe(DOG_LOOKS[DEFAULT_DOG_LOOK]);
    expect(dogLook(-1)).toBe(DOG_LOOKS[DEFAULT_DOG_LOOK]);
  });
});

/**
 * The three celebration candidates (playtest 6, notes 6 and 7).
 *
 * They are covered here rather than through `billPose`, because nothing in
 * the fight maps to them yet: the sixth BossPhase that drives them is the
 * next piece of work. Without this, three shipped poses would sit in the
 * painter with no test at all — which is exactly how 'uncurl' went a whole
 * round uncovered.
 */
describe('Bill concedes', () => {
  const CANDIDATES: BillPose[] = ['bow', 'applaud', 'kneel'];
  const DOG_CANDIDATES: BillDogPose[] = ['bow', 'applaud', 'lieDown'];

  it('draws three pictures, none of them his idle', () => {
    const shots = [...CANDIDATES, 'idle' as BillPose].map((pose) => {
      const { ops, ctx } = recordingCtx();
      paintBillMan(ctx, { x: 400, y: 600 }, pose, 0, -1);
      expect(ops.length).toBeGreaterThan(0);
      return ops.join('\n');
    });
    // A candidate that quietly fell through to the idle branch would
    // collapse this set, and would look like a considered choice on the page.
    expect(new Set(shots).size).toBe(4);
  });

  it('leaves the canvas state balanced, like every other pose', () => {
    for (const pose of CANDIDATES) {
      const { ops, ctx } = recordingCtx();
      paintBillMan(ctx, { x: 400, y: 600 }, pose, 0, -1);
      expect(ops.filter((o) => o === 'save()').length).toBe(
        ops.filter((o) => o === 'restore()').length,
      );
    }
  });

  it('animates every one of them, in whole frames', () => {
    // The file's motion doctrine: nothing interpolates, everything snaps
    // between whole frames on a floored clock. A held picture reads as a
    // freeze, and a smoothed one stops looking like pixels — so each
    // candidate has to differ somewhere across its own loop.
    for (const pose of CANDIDATES) {
      const frames = [0, 0.34, 0.67, 1.01].map((t) => {
        const { ops, ctx } = recordingCtx();
        paintBillMan(ctx, { x: 400, y: 600 }, pose, t, -1);
        return ops.join('\n');
      });
      expect(new Set(frames).size).toBeGreaterThan(1);
    }
  });

  it('gives the dog three of his own, none of them his idle or his heave', () => {
    // 'bones' is ALREADY a play-bow heave, so the dog's bow is the one pose
    // here at real risk of being a duplicate: it is held rather than thrown,
    // jaw shut, back legs still standing.
    const shots = [...DOG_CANDIDATES, 'idle' as BillDogPose, 'bones' as BillDogPose].map((pose) => {
      const { ops, ctx } = recordingCtx();
      paintBillDog(ctx, { x: 400, y: 600 }, pose, 0, -1);
      expect(ops.length).toBeGreaterThan(0);
      return ops.join('\n');
    });
    expect(new Set(shots).size).toBe(5);
  });

  it('animates the dog too, and leaves his canvas balanced', () => {
    for (const pose of DOG_CANDIDATES) {
      const frames = [0, 0.34, 0.67, 1.01].map((t) => {
        const { ops, ctx } = recordingCtx();
        paintBillDog(ctx, { x: 400, y: 600 }, pose, t, -1);
        expect(ops.filter((o) => o === 'save()').length).toBe(
          ops.filter((o) => o === 'restore()').length,
        );
        return ops.join('\n');
      });
      expect(new Set(frames).size).toBeGreaterThan(1);
    }
  });
});
