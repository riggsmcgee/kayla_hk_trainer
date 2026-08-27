/**
 * The Riggs portfolio, checked at the level a test can actually reach.
 *
 * The lesson this project keeps relearning is that a test cannot judge a
 * drawing — two of three celebration poses passed everything and were visibly
 * broken. So this file does not try. What it CAN prove is everything the
 * ratified medium says must be true of the file regardless of what it depicts,
 * and every one of these has a way of silently going wrong:
 *
 * - a candidate that draws nothing at all, which looks like a missing painter
 *   rather than a bad one;
 * - a coordinate outside the box, which puts him through the HUD or below the
 *   floor on a page nobody has opened yet;
 * - a `Math.sin` that crept into a motion path, which is the single thing the
 *   art direction says would remove what got this medium chosen;
 * - an ignored `tie` parameter, which would make the whole bow-tie shortlist a
 *   page of identical pictures;
 * - three candidates that are secretly the same drawing, which wastes the
 *   user's only real choice.
 *
 * The judging of which one is best happens in a browser, on the gallery page.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RIGGS_VARIANT,
  RIGGS_CANDIDATES,
  RIGGS_TIE,
  paintRiggs,
  riggsCandidate,
} from './index';

/** Where every candidate is anchored for these tests: the centre of the waist cut. */
const ORIGIN = { x: 240, y: 512 };

/** The box the interface promises, measured from the origin. */
const BOX = { halfWidth: 224, height: 500 };

interface Recorded {
  ops: string[];
  rects: { x: number; y: number; w: number; h: number }[];
  fills: string[];
  ctx: CanvasRenderingContext2D;
}

/**
 * A canvas that writes down what it was asked to do, and applies the transform
 * stack itself so a rect's REAL position is known.
 *
 * The transform matters: `drawReverent` in the ending taught us that a painter
 * can be perfectly in-bounds and still land somewhere else once a translate is
 * wrapped round it. Here the painters do their own translate, so a test that
 * ignored it would be checking the wrong numbers.
 */
function recordingCtx(): Recorded {
  const ops: string[] = [];
  const rects: Recorded['rects'] = [];
  const fills: string[] = [];
  let m = { a: 1, d: 1, e: 0, f: 0 };
  const stack: (typeof m)[] = [];
  let fillStyle = '';

  const target: Record<string, unknown> = {
    save: () => {
      ops.push('save');
      stack.push({ ...m });
    },
    restore: () => {
      ops.push('restore');
      const popped = stack.pop();
      if (popped) m = popped;
    },
    translate: (x: number, y: number) => {
      ops.push('translate');
      m = { ...m, e: m.e + m.a * x, f: m.f + m.d * y };
    },
    scale: (x: number, y: number) => {
      ops.push('scale');
      m = { ...m, a: m.a * x, d: m.d * y };
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      ops.push('fillRect');
      rects.push({ x: m.e + m.a * x, y: m.f + m.d * y, w: m.a * w, h: m.d * h });
      fills.push(fillStyle);
    },
  };

  const ctx = new Proxy(target, {
    get: (t, prop) => {
      const key = String(prop);
      if (key in t) return t[key];
      // Anything the painter reaches for that is not in the list above gets
      // recorded by NAME, which is how the "fillRect only" rule is enforced.
      return (...args: unknown[]) => {
        ops.push(key);
        void args;
      };
    },
    set: (t, prop, value) => {
      const key = String(prop);
      if (key === 'fillStyle') fillStyle = String(value);
      ops.push(`${key}=`);
      t[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;

  return { ops, rects, fills, ctx };
}

/** Draw one candidate at time `t` and hand back everything it did. */
function draw(index: number, t = 0.5, tie = RIGGS_TIE): Recorded {
  const rec = recordingCtx();
  const candidate = RIGGS_CANDIDATES[index];
  if (!candidate) throw new Error(`No candidate at ${index}`);
  candidate.paint(rec.ctx, ORIGIN, t, tie);
  return rec;
}

/** A stable fingerprint of one frame, for comparing frames and candidates. */
function fingerprint(rec: Recorded): string {
  return rec.rects
    .map(
      (r, i) =>
        `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)},${rec.fills[i]}`,
    )
    .join('|');
}

describe.each(RIGGS_CANDIDATES.map((c, i) => [c.letter, i] as const))(
  'candidate %s',
  (letter, index) => {
    it('draws a figure rather than nothing', () => {
      // A painter that silently draws nothing looks like a missing import, and
      // the gallery would show an empty card that reads as a build problem.
      const rec = draw(index);
      expect(rec.rects.length).toBeGreaterThan(20);
    });

    it('uses fillRect and nothing else — no curves, no strokes, no outlines', () => {
      // The medium's hardest rule, and the one an editor is most likely to
      // break reaching for a rounded shape.
      const rec = draw(index);
      const banned = rec.ops.filter((op) =>
        /^(arc|arcTo|ellipse|bezierCurveTo|quadraticCurveTo|stroke|strokeRect|strokeStyle=|lineTo|moveTo|beginPath|closePath|fill)$/.test(
          op,
        ),
      );
      expect(banned).toEqual([]);
    });

    it('stays inside the box it promised, and never draws below the waist', () => {
      // Worked from the extremes rather than assumed: the page places him
      // against a HUD above and a page edge below.
      const rec = draw(index);
      for (const r of rec.rects) {
        const left = Math.min(r.x, r.x + r.w);
        const right = Math.max(r.x, r.x + r.w);
        const top = Math.min(r.y, r.y + r.h);
        const bottom = Math.max(r.y, r.y + r.h);
        expect(left).toBeGreaterThanOrEqual(ORIGIN.x - BOX.halfWidth);
        expect(right).toBeLessThanOrEqual(ORIGIN.x + BOX.halfWidth);
        expect(top).toBeGreaterThanOrEqual(ORIGIN.y - BOX.height);
        expect(bottom).toBeLessThanOrEqual(ORIGIN.y);
      }
    });

    it('snaps between whole frames instead of interpolating', () => {
      // The art direction's one non-negotiable: "if you ever find yourself
      // adding a Math.sin(t) to smooth something out, you are removing the
      // thing that got this design chosen." A smoothly-animated painter
      // produces a different picture for every t; a stepped one repeats.
      const samples = new Set<string>();
      for (let i = 0; i < 240; i++) samples.add(fingerprint(draw(index, i / 240)));
      // Four seconds of a two-frame blink and a two-frame nod cannot be 240
      // distinct pictures unless something is sweeping.
      expect(samples.size).toBeLessThan(24);
      // ...and it must not be ONE picture either, or nothing animates at all.
      expect(samples.size).toBeGreaterThan(1);
    });

    it('wears the tie colour it is handed, and only there', () => {
      // The whole bow-tie shortlist depends on this parameter being live. A
      // painter that hard-coded a yellow would render six identical swatches.
      const brass = draw(index, 0.5, '#c8901f');
      const violet = draw(index, 0.5, '#7d3cff');
      expect(brass.fills).toContain('#c8901f');
      expect(violet.fills).toContain('#7d3cff');
      // Geometry is identical; only the colour moved.
      expect(brass.rects.length).toBe(violet.rects.length);
      // The tie is an accent, not the character: it may not be most of him.
      const tieRects = violet.fills.filter((f) => f === '#7d3cff').length;
      expect(tieRects).toBeLessThan(violet.rects.length / 4);
    });

    it('leaves the canvas transform as it found it', () => {
      // It draws inside a page that draws other things. An unbalanced save
      // would corrupt whatever is painted next, and only on that page.
      const rec = draw(index);
      const saves = rec.ops.filter((o) => o === 'save').length;
      const restores = rec.ops.filter((o) => o === 'restore').length;
      expect(saves).toBe(restores);
      expect(saves).toBeGreaterThan(0);
    });

    it(`is named for the direction it argues (${letter})`, () => {
      expect(riggsCandidate(index).letter).toBe(letter);
      expect(riggsCandidate(index).name.length).toBeGreaterThan(3);
    });
  },
);

describe('the portfolio as a whole', () => {
  it('offers three genuinely different drawings', () => {
    // The entire value of a portfolio is that the choice is informative. Three
    // near-identical candidates waste the round.
    const prints = RIGGS_CANDIDATES.map((_, i) => fingerprint(draw(i)));
    expect(new Set(prints).size).toBe(RIGGS_CANDIDATES.length);
  });

  it('routes paintRiggs to the candidate it was asked for', () => {
    for (const [i] of RIGGS_CANDIDATES.entries()) {
      const direct = recordingCtx();
      RIGGS_CANDIDATES[i]!.paint(direct.ctx, ORIGIN, 0.5, RIGGS_TIE);
      const viaSeam = recordingCtx();
      paintRiggs(viaSeam.ctx, ORIGIN, 0.5, i, RIGGS_TIE);
      expect(fingerprint(viaSeam)).toBe(fingerprint(direct));
    }
  });

  it('falls back to the default rather than blanking on a stale variant', () => {
    // Same stance as every other picker in this project: a number from an old
    // settings blob must not produce an empty screen.
    const expected = fingerprint(draw(DEFAULT_RIGGS_VARIANT));
    for (const bad of [-1, 99, 3]) {
      const rec = recordingCtx();
      paintRiggs(rec.ctx, ORIGIN, 0.5, bad, RIGGS_TIE);
      expect(fingerprint(rec)).toBe(expected);
    }
  });

  it('never ships the punish-window gold as the default tie', () => {
    // Ratified out in so many words. The Reading Enemies lesson teaches this
    // exact hex as "the punish window" and it is every forward button on the
    // site, so a tie in it is the picture telling her to hit him.
    expect(RIGGS_TIE.toLowerCase()).not.toBe('#e8c76a');
  });
});
