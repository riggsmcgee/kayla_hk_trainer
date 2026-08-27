/**
 * Eight-bit Riggs, checked at the level a test can actually reach.
 *
 * The lesson this project keeps relearning is that a test cannot judge a
 * drawing — two of three celebration poses passed everything and were visibly
 * broken. So this file does not try. What it CAN prove is everything the
 * ratified medium says must be true of the file regardless of what it depicts,
 * and every one of these has a way of silently going wrong:
 *
 * - a painter that draws nothing at all, which looks like a missing import
 *   rather than a bad drawing;
 * - a coordinate outside the box, which puts him through the HUD or below the
 *   floor on a page nobody has opened yet;
 * - a `Math.sin` that crept into a motion path, which is the single thing the
 *   art direction says would remove what got this medium chosen;
 * - an ignored `tie` parameter, which would make the whole bow-tie shortlist a
 *   page of identical pictures;
 * - a mouth that moves when he is not talking, or does not move when he is,
 *   which is the entire point of the read-off's typewriter.
 *
 * The judging of the likeness happens in a browser, on the gallery page.
 */
import { describe, expect, it } from 'vitest';
import { RIGGS_TIE, paintRiggs } from './index';

/** Where he is anchored for these tests: the centre of the waist cut. */
const ORIGIN = { x: 240, y: 512 };

/** The box the interface promises, measured from the origin. */
const BOX = { halfWidth: 224, height: 500 };

/**
 * The dark gap under the upper lip. It is drawn in the open state and in no
 * other, which makes it the one honest signal for "his mouth is open" that a
 * test can read without judging a picture.
 */
const OPEN_MOUTH_GAP = '#5a3229';

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
 * wrapped round it. Here the painter does its own translate, so a test that
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

/** Draw him at time `t` and hand back everything he did. */
function draw(t = 0.5, speaking = false, tie = RIGGS_TIE): Recorded {
  const rec = recordingCtx();
  paintRiggs(rec.ctx, ORIGIN, t, speaking, tie);
  return rec;
}

/** A stable fingerprint of one frame, for comparing frames with each other. */
function fingerprint(rec: Recorded): string {
  return rec.rects
    .map(
      (r, i) =>
        `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)},${rec.fills[i]}`,
    )
    .join('|');
}

/** Four seconds of frames, at the rate a 60 Hz monitor would ask for them. */
function framesOverFourSeconds(speaking: boolean): Recorded[] {
  const frames: Recorded[] = [];
  for (let i = 0; i < 240; i++) frames.push(draw(i / 60, speaking));
  return frames;
}

describe('the drawing', () => {
  it('draws a figure rather than nothing', () => {
    // A painter that silently draws nothing looks like a missing import, and
    // the page would show an empty box that reads as a build problem.
    expect(draw().rects.length).toBeGreaterThan(20);
  });

  it('uses fillRect and nothing else — no curves, no strokes, no outlines', () => {
    // The medium's hardest rule, and the one an editor is most likely to
    // break reaching for a rounded shape.
    const banned = draw().ops.filter((op) =>
      /^(arc|arcTo|ellipse|bezierCurveTo|quadraticCurveTo|stroke|strokeRect|strokeStyle=|lineTo|moveTo|beginPath|closePath|fill)$/.test(
        op,
      ),
    );
    expect(banned).toEqual([]);
  });

  it('stays inside the box it promised, and never draws below the waist', () => {
    // Worked from the extremes rather than assumed: the page places him
    // against a HUD above and a page edge below. The speaking frame is checked
    // too, because the open mouth draws rows the shut one does not.
    for (const speaking of [false, true]) {
      for (const rect of draw(0.5, speaking).rects) {
        const left = Math.min(rect.x, rect.x + rect.w);
        const right = Math.max(rect.x, rect.x + rect.w);
        const top = Math.min(rect.y, rect.y + rect.h);
        const bottom = Math.max(rect.y, rect.y + rect.h);
        expect(left).toBeGreaterThanOrEqual(ORIGIN.x - BOX.halfWidth);
        expect(right).toBeLessThanOrEqual(ORIGIN.x + BOX.halfWidth);
        expect(top).toBeGreaterThanOrEqual(ORIGIN.y - BOX.height);
        expect(bottom).toBeLessThanOrEqual(ORIGIN.y);
      }
    }
  });

  it('snaps between whole frames instead of interpolating', () => {
    // The art direction's one non-negotiable: "if you ever find yourself
    // adding a Math.sin(t) to smooth something out, you are removing the
    // thing that got this design chosen." A smoothly-animated painter
    // produces a different picture for every t; a stepped one repeats.
    const samples = new Set(framesOverFourSeconds(false).map(fingerprint));
    // Four seconds of a two-frame blink and a two-frame nod cannot be 240
    // distinct pictures unless something is sweeping.
    expect(samples.size).toBeLessThan(24);
    // ...and it must not be ONE picture either, or nothing animates at all.
    expect(samples.size).toBeGreaterThan(1);
  });

  it('wears the tie colour it is handed, and only there', () => {
    // The bow-tie shortlist depends on this parameter being live. A painter
    // that hard-coded a yellow would render six identical swatches.
    const brass = draw(0.5, false, '#c8901f');
    const violet = draw(0.5, false, '#7d3cff');
    expect(brass.fills).toContain('#c8901f');
    expect(violet.fills).toContain('#7d3cff');
    // Geometry is identical; only the colour moved.
    expect(brass.rects.length).toBe(violet.rects.length);
    // The tie is an accent, not the character: it may not be most of him.
    const tieRects = violet.fills.filter((f) => f === '#7d3cff').length;
    expect(tieRects).toBeLessThan(violet.rects.length / 4);
  });

  it('leaves the canvas transform as it found it', () => {
    // He is drawn inside a page that draws other things. An unbalanced save
    // would corrupt whatever is painted next, and only on that page.
    const rec = draw();
    const saves = rec.ops.filter((o) => o === 'save').length;
    const restores = rec.ops.filter((o) => o === 'restore').length;
    expect(saves).toBe(restores);
    expect(saves).toBeGreaterThan(0);
  });

  it('never ships the punish-window gold as the default tie', () => {
    // Ratified out in so many words. The Reading Enemies lesson teaches this
    // exact hex as "the punish window" and it is every forward button on the
    // site, so a tie in it is the picture telling her to hit him.
    expect(RIGGS_TIE.toLowerCase()).not.toBe('#e8c76a');
  });
});

describe('the mouth, which the typewriter owns', () => {
  it('stays shut through a whole idle cycle when nothing is being said', () => {
    // The failure this catches is the OLD behaviour surviving the rewiring:
    // the mouth used to open on the second nod of every three-second cycle,
    // which would now read as him talking through the silences between
    // messages. Four seconds covers more than one full nod cycle.
    const frames = framesOverFourSeconds(false);
    for (const frame of frames) expect(frame.fills).not.toContain(OPEN_MOUTH_GAP);
    // He is still alive, though — a face that froze would read as a crash.
    expect(new Set(frames.map(fingerprint)).size).toBeGreaterThan(1);
  });

  it('opens and shuts on its own clock while a sentence is appearing', () => {
    // Both states reached inside one second: a mouth held open for the length
    // of a message is a gape, not speech.
    const open: boolean[] = [];
    for (let i = 0; i < 60; i++) open.push(draw(i / 60, true).fills.includes(OPEN_MOUTH_GAP));
    expect(open).toContain(true);
    expect(open).toContain(false);
  });

  it('moves nothing but the mouth when he starts speaking', () => {
    // A `speaking` flag that also nudged the brow or the breath would make the
    // typewriter responsible for his whole performance. Comparing the same
    // instant with the flag off and on, only the mouth's own rects may differ.
    // t = 0.1 s is inside the first OPEN half of the 5 Hz speech clock, so
    // the two frames genuinely differ; at 0.2 s his mouth is shut in both.
    const shut = draw(0.1, false).rects;
    const talking = draw(0.1, true).rects;
    const same = (a: (typeof shut)[number], b: (typeof shut)[number]): boolean =>
      a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
    const changed = talking.filter((rect) => !shut.some((s) => same(s, rect)));
    // The open mouth is three blocks: the upper lip, the dark gap under it,
    // and the lit chin below that.
    expect(changed).toHaveLength(3);
  });

  it('is shut by default, so a caller that never asks gets a still face', () => {
    const rec = recordingCtx();
    paintRiggs(rec.ctx, ORIGIN, 0.2);
    expect(rec.fills).not.toContain(OPEN_MOUTH_GAP);
  });
});
