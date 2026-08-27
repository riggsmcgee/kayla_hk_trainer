/**
 * RIGGS — candidate A, "SAME ROOM AS BILL".
 *
 * The developer, waist-up, for the last screen at #/the-end. He is DRAWN, not
 * photographed, and the one thing his art has to do is look like it came off
 * the same sprite sheet as Bill the man — because the Bills are not from
 * Hollow Knight either, and the joke only lands if the two of them are from
 * the same nowhere.
 *
 * So this candidate spends its extra resolution on FIDELITY OF THE SAME FORMS
 * rather than on new ones. Same single primitive, same two-tone-ramp-per-
 * material shading, same block vocabulary, same warm palette — five of its
 * eight hexes are Bill's own — just at twice the cell size and cropped at the
 * waist. There is no outline, no curve, no gradient and no new idea in it.
 * The test a viewer should apply is exactly one sentence: "he looks like he is
 * from the same sprite sheet as Bill."
 *
 * The two places it does depart from renderBillMan.ts, and why:
 *
 *   1. HE FACES THE CAMERA. Bill is drawn in a three-quarter profile — one
 *      eye, a nose that juts 4 px past the face, a hair mass behind the skull.
 *      Riggs cannot be: a bow tie is a symmetrical, front-on garment, and the
 *      bow tie is THE ONLY THING that is actually known about what he looks
 *      like. Turn him sideways and the one specified feature becomes a lump.
 *      So the face is built front-on out of the same parts (brow bar, ink eye,
 *      shade-cast nose, ink mouth) mirrored about x = 0.
 *   2. NOTHING IS DRAWN BELOW THE WAIST. `origin` is the centre of the waist
 *      cut and the arms simply run off the bottom edge of the frame. That is a
 *      crop, not a hem, so — unlike torso() in renderBillMan.ts — there is no
 *      shade band along the bottom: a shaded bottom edge would read as the
 *      hem of a shirt that ends at his navel.
 *
 * ---------------------------------------------------------------------------
 * THE GRID
 * ---------------------------------------------------------------------------
 * Master cell C = 16 px, twice Bill's. ONE finer tier exists at half a cell
 * (8 px) and it is used only for face features, the shading edges, the collar,
 * the buttons and the tie. NOTHING in this file is ever finer than 8 px.
 *
 * That 16 is not a taste call, it is the arithmetic from playtest 7: Bill is
 * 160 px on an 8 px cell, so his face is about 36 sub-cells. Riggs's head is
 * 160 px, so at an 8 px cell his face would be ~1,700 sub-cells (47x Bill —
 * it stops being pixel art), at 24 px it would be ~190 (5x — the resolution is
 * wasted), and at 16 px it is ~400, about 11x Bill. Only the last one reads as
 * the same medium at a different scale.
 *
 * r(col, row, w, h) is the only primitive.
 *   x spans  col*16 .. (col+w)*16      (a w-cell block at col = -w/2 is
 *                                       centred on x = 0)
 *   y spans  -496 + row*16 .. -496 + (row+h)*16
 *                                      (row 0 = the top of his hair,
 *                                       row 31 = the waist cut)
 *
 * NOTE for anyone porting numbers between the two files: Bill's primitive is
 * `col*8 - 4`, half a cell to the left of this one, and his header's centring
 * rule ("a w-cell block at col -w/2 is centred on x = 0") is off by half a
 * cell against his own formula — every centred call in that file actually uses
 * col = (1 - w)/2. This primitive drops the -C/2 so the rule as written is the
 * rule as implemented. Bill's columns are therefore NOT interchangeable with
 * these; his row 0 is a crown 160 px up, this row 0 is a crown 496 px up.
 *
 * ---------------------------------------------------------------------------
 * PROPORTIONS, worked out before any code was written (px above the waist cut)
 * ---------------------------------------------------------------------------
 *   total drawn height   496       (31 cells) = 75% of the 664 px canvas
 *   crown                496       (row 0)
 *   hairline             464       (row 2)      32 px of hair cap
 *   brow                 440       (row 3.5)
 *   eye line             424       (row 4.5)
 *   ears                 416..384  (rows 5..7)  8 px proud of the skull
 *   nose base            368       (row 8)
 *   mouth                360       (row 8.5)
 *   chin                 336       (row 10)  => the head is 160 px, 10 cells
 *   head width           128       (8 cells), 144 across the ears
 *   neck                 336..304  (rows 10..12), 48 wide (3 cells)
 *   shoulder line        312       (row 11.5), chamfered one cell at 11.5
 *   collar band          312..304  (rows 11.5..12), 128 wide, points to row 13
 *                                  and outboard of the tie at cols +-3..4
 *   BOW TIE              304..272  (rows 12..14), 96 wide x 32 tall
 *   torso width          192       (12 cells)
 *   shoulder width       272       (17 cells: torso 192 + 40 of arm each side)
 *                                  = 2.1 head widths. Bill reads 2.3, so this
 *                                  is a slightly narrower man, not a wider one.
 *   upper arm            312..144  (rows 12.5..22), 40 wide
 *   elbow                144       (row 22) — the forearm steps 8 px inward,
 *                                  which is Bill's idle-forearm idiom exactly
 *   forearm              144..0    (rows 22..31), runs off the bottom edge
 *   placket              272..0    (rows 14..31), a 16 px lit strip between
 *                                  two 8 px shade seams
 *   buttons              216 / 144 / 72   (rows 17.5, 22, 26.5)
 *   waist cut              0       (row 31)
 *
 *   Head-heights: 496 / 160 = 3.1. Waist-up is three heads, which is the
 *   check that says the crop is at the waist and not at the ribs.
 *
 * ---------------------------------------------------------------------------
 * WHY IT READS ON #070912
 * ---------------------------------------------------------------------------
 * Bill's rule is that three of his four big blocks are near-white or bright.
 * Riggs has three big blocks and two of them are the brightest hexes in the
 * project: the shirt #f2f0ea is 19 cells tall and 12 wide — by area it is more
 * than half the drawing — and the face #e8c9a8 is a 128 x 160 slab of it. The
 * third block is his hair, and dark hair sitting on a dark ground is exactly
 * the failure Bill's jeans note describes, so the hair pulls the same trick
 * the jeans did: a NEW lit tone one step up (#8a6242) with Bill's reserved
 * billHair #6b4a32 demoted to the shade tone underneath it.
 *
 * The one place two lit blocks touch is where the near arm meets the torso —
 * white shirt against white shirt, which at a glance is one wide slab with no
 * arm in it. It is fixed the way a sprite artist fixes it: an 8 px shirtShade
 * ARMHOLE SEAM down col 5.5, plus the arm's own shade column beside it, so a
 * 16 px crease separates them. The far arm needs no seam because, like Bill's
 * farArm, it is drawn ENTIRELY in the shade tones and sits behind the body.
 *
 * There are no black outlines anywhere. Form is a two-tone ramp per material:
 * a lit face and a shaded rear column, light coming from +x, which is the same
 * light Bill stands in.
 *
 * THE BOW TIE is the only colour that comes in from outside, because it is the
 * only thing about him the user specified, and it is deliberately NOT
 * punishGold #e8c76a: that hex is taught in so many words by the Reading
 * Enemies lesson as "the punish window" and is the background of every forward
 * button on the site, including the one that will sit under this very drawing
 * — a tie in it would be the picture telling her to hit him. The recommended
 * value is #d6b510, a deep mustard at hue 50 deg: darker (L 45% against gold's
 * 66%) and far more saturated, and sitting in the 46..128 deg band that
 * nothing else in this project occupies. The painter takes it as an argument
 * so a swatch strip can walk the hue without touching the drawing, and derives
 * its own shade tone from it, so the two-tone ramp survives whichever yellow
 * wins.
 *
 * ---------------------------------------------------------------------------
 * MOTION
 * ---------------------------------------------------------------------------
 * NOTHING HERE INTERPOLATES, for the reason the playtest gave: if he moves
 * smoothly while the Bills do not, he stops looking like he is from the same
 * world as them, which is the one thing his art has to do. There is no
 * Math.sin anywhere in this file and there must never be one.
 *
 * Exactly two things move, both on floored clocks, both two-frame:
 *
 *   NOD    1.5 Hz. The head group drops half a cell (8 px) and comes back.
 *          The head SLIDES but the neck STRETCHES (row + n, height - n), the
 *          same trick poseIdle uses on Bill's shirt, so the throat stays
 *          welded to the collar instead of tearing an 8 px hole in it.
 *          The nod goes DOWN, never up, and that is a budget decision as much
 *          as a gesture: the crown already sits at y = -496 of a 500 px
 *          allowance, so an up-beat would push him out of the box.
 *   BLINK  a 6 Hz frame clock, shut on 1 frame in 19. That is one blink every
 *          ~3.2 s, held for 1/6 s, which is what a real blink is. It is still
 *          a two-frame animation on a Math.floor(t * hz) clock — the duty
 *          cycle lives in the modulo, not in an ease. The shut frame is a
 *          wider, lower ink bar, which is the same shape Bill's 'dazed' face
 *          uses for an eye squeezed shut.
 *
 * The shoulders deliberately do NOT breathe. Bill's idle lifts the whole chest
 * because he has to look like he is about to charge; Riggs is a portrait
 * talking to her, and a third moving part at a third rate would read as a
 * loop, not as a man.
 */
import type { Vec2 } from '../types';

type Ctx = CanvasRenderingContext2D;

const P = {
  skin: '#e8c9a8', //       reserved billSkin -- the same man, the same sheet
  skinShade: '#c9a17c', //  Bill's own shade tone, unchanged
  hair: '#8a6242', //       new lit tone, one step up from the reserved brown
  hairShade: '#6b4a32', //  reserved billHair, demoted to the shade tone
  shirt: '#f2f0ea', //      reserved billShirt
  shirtShade: '#c6c3bd', // Bill's shirtShade: rear columns, collar, seams
  button: '#c9c6c0', //     Bill's buckle grey -- deliberately NOT gold
  ink: '#0b0e1a', //        reserved enemyDetail -- eyes and mouth only
};

// --- the only drawing primitive -------------------------------------------
const C = 16; // master cell; the fine tier is C/2 = 8 px and nothing is finer
const CROWN = -496; // row 0 sits here, 496 px above the waist cut

/** One block on the grid. col/row/w/h are in cells; halves (0.5) are legal. */
function r(ctx: Ctx, col: number, row: number, w: number, h: number): void {
  ctx.fillRect(col * C, CROWN + row * C, w * C, h * C);
}

/** Two-frame animation clock. Returns 0 or 1, deterministic in t. */
function flip(t: number, hz: number): number {
  return Math.floor(t * hz) % 2;
}

const NOD_HZ = 1.5;

// A blink is two frames with a duty cycle, so its clock counts frames and
// takes a modulo rather than flipping: 6 frames a second, shut on 1 in 19.
const BLINK_HZ = 6;
const BLINK_EVERY = 19;
const BLINK_PHASE = 5; // so he is not caught mid-blink at t = 0

/** True on the one frame in nineteen where his eyes are shut. */
function blinking(t: number): boolean {
  const f = Math.floor(t * BLINK_HZ) + BLINK_PHASE;
  return ((f % BLINK_EVERY) + BLINK_EVERY) % BLINK_EVERY === 0;
}

/**
 * The bow tie's shade tone, derived from whatever yellow was passed in so the
 * two-tone ramp holds for every swatch in a strip. Anything that is not a
 * #rrggbb string comes back untouched, which costs the ramp and nothing else.
 */
function darken(hex: string, k: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return hex;
  const rr = Math.round(((n >> 16) & 255) * k);
  const gg = Math.round(((n >> 8) & 255) * k);
  const bb = Math.round((n & 255) * k);
  return '#' + ((1 << 24) | (rr << 16) | (gg << 8) | bb).toString(16).slice(1);
}

// --- the body, back to front ------------------------------------------------

/**
 * The far arm -- drawn first and entirely in the shade tones, so it sits
 * behind the body without needing a seam. Two blocks: upper arm, then a
 * forearm stepping half a cell inward at the elbow, which is the only thing
 * at this resolution that says "elbow" without bending anything.
 */
function farArm(ctx: Ctx): void {
  ctx.fillStyle = P.shirtShade;
  r(ctx, -8.5, 12.5, 2.5, 9.5); // upper arm
  r(ctx, -8, 22, 2.5, 9); // forearm, running off the bottom edge
}

/**
 * The shirt. One chamfer cell at the shoulder line does the whole job of a
 * sloped shoulder; below it the body is a single 12-cell column, because a
 * tapered waist at 16 px is two steps of noise rather than a shape.
 *
 * No hem. The bottom edge is the frame, not a garment.
 */
function torso(ctx: Ctx): void {
  ctx.fillStyle = P.shirt;
  r(ctx, -5, 11.5, 10, 0.5); // shoulder chamfer
  r(ctx, -6, 12, 12, 19); // body, down to the waist cut

  ctx.fillStyle = P.shirtShade;
  r(ctx, -6, 12, 0.5, 19); // rear column
  r(ctx, -5, 11.5, 0.5, 0.5); // ...and its chamfer cell
  r(ctx, 5.5, 12.5, 0.5, 18.5); // armhole seam: white arm against white shirt

  // Placket: two 8 px seams with a 16 px lit strip between them.
  r(ctx, -1, 14, 0.5, 17);
  r(ctx, 0.5, 14, 0.5, 17);

  ctx.fillStyle = P.button;
  r(ctx, -0.5, 17.5, 1, 0.5);
  r(ctx, -0.5, 22, 1, 0.5);
  r(ctx, -0.5, 26.5, 1, 0.5);
}

/**
 * The head. `hr` is the row of the crown, so the nod is applied by the caller
 * and every feature below rides it for free.
 *
 * Feature tiers inside the head, in half-cells from hr -- the same ladder
 * renderBillMan.ts uses, at twice the resolution:
 *   hr+0.0 .. hr+2.0   hair cap
 *   hr+2.0 .. hr+3.5   forehead
 *   hr+3.5 .. hr+4.0   brows
 *   hr+4.5 .. hr+5.0   eyes
 *   hr+5.5 .. hr+8.0   nose, carried entirely by the shadow it casts
 *   hr+8.0 .. hr+9.0   mouth
 *   hr+9.5 .. hr+10.0  jaw, the underside of the chin
 */
function head(ctx: Ctx, hr: number, blink: boolean): void {
  ctx.fillStyle = P.skin;
  r(ctx, -4, hr + 1.5, 8, 8.5); // the face slab
  r(ctx, 4, hr + 5, 0.5, 2); // near ear

  ctx.fillStyle = P.skinShade;
  r(ctx, -4, hr + 2, 0.5, 8); // rear column, from the hairline down
  r(ctx, -4.5, hr + 5, 0.5, 2); // far ear, wholly in shade
  r(ctx, -0.5, hr + 5.5, 0.5, 2); // the shadow the nose casts...
  r(ctx, -0.5, hr + 7.5, 1, 0.5); // ...and the base of it
  r(ctx, -4, hr + 9.5, 8, 0.5); // jaw

  // Hair: a cap plus two temples. Lit tone first, shade over the rear.
  ctx.fillStyle = P.hair;
  r(ctx, -4, hr, 8, 2);
  r(ctx, 3.5, hr + 2, 0.5, 2); // near temple
  ctx.fillStyle = P.hairShade;
  r(ctx, -4, hr, 0.5, 2); // rear column
  r(ctx, -4, hr + 2, 0.5, 2); // far temple
  r(ctx, 1.5, hr, 0.5, 1.5); // the part

  // Brows, in the same brown, exactly as Bill's are.
  r(ctx, -3, hr + 3.5, 1.5, 0.5);
  r(ctx, 1.5, hr + 3.5, 1.5, 0.5);

  ctx.fillStyle = P.ink;
  if (blink) {
    // Shut: wider and one tier lower -- Bill's 'dazed' eye, both sides.
    r(ctx, -3, hr + 5, 1.5, 0.5);
    r(ctx, 1.5, hr + 5, 1.5, 0.5);
  } else {
    r(ctx, -2.5, hr + 4.5, 1, 0.5);
    r(ctx, 1.5, hr + 4.5, 1, 0.5);
  }

  // Mouth: a bar with both corners stepped one tier up. Three blocks is the
  // cheapest smile that is unambiguously a smile.
  r(ctx, -1, hr + 8.5, 2, 0.5);
  r(ctx, -1.5, hr + 8, 0.5, 0.5);
  r(ctx, 1, hr + 8, 0.5, 0.5);
}

/**
 * Neck and head as one group. The head slides down by `n` on the nod; the
 * neck stretches from the top to meet it, so the throat never tears open.
 */
function neckAndHead(ctx: Ctx, n: number, blink: boolean): void {
  ctx.fillStyle = P.skin;
  r(ctx, -1.5, 10 + n, 3, 2 - n);
  ctx.fillStyle = P.skinShade;
  r(ctx, -1.5, 10 + n, 0.5, 2 - n); // rear column
  head(ctx, n, blink);
}

/**
 * Collar: a band across the throat and two points.
 *
 * The points sit OUTBOARD of the tie, at cols +-3..4. They were originally
 * drawn at +-2..3, which is exactly where the tie's wings land — the tie is
 * painted afterwards and swallowed them whole, so the collar silently did not
 * exist. Anything drawn under the tie has to clear +-3.
 */
function collar(ctx: Ctx): void {
  ctx.fillStyle = P.shirtShade;
  r(ctx, -4, 11.5, 8, 0.5); // band
  r(ctx, -4, 12, 1, 1); // far point
  r(ctx, 3, 12, 1, 1); // near point
}

/**
 * THE BOW TIE -- five blocks in an hourglass: two tall wings, two short
 * pinches, and a knot as tall as the wings.
 *
 * Only the wings take a shade column. Shading all five gave a 96 px tie four
 * 8 px stripes in it, which read as corduroy rather than as silk; the knot and
 * the pinches are separated from each other by their PROFILE instead — the
 * wings and knot are 32 px tall, the pinches 16 — which is how a bow tie is
 * drawn at any resolution. The knot then takes an 8 px underside so it still
 * sits proud of the band rather than melting into it.
 */
function bowTie(ctx: Ctx, tie: string, shade: string): void {
  ctx.fillStyle = tie;
  r(ctx, -3, 12, 1, 2); // far wing
  r(ctx, -2, 12.5, 1.5, 1); // far pinch
  r(ctx, -0.5, 12, 1, 2); // knot
  r(ctx, 0.5, 12.5, 1.5, 1); // near pinch
  r(ctx, 2, 12, 1, 2); // near wing

  ctx.fillStyle = shade;
  r(ctx, -3, 12, 0.5, 2); // far wing's rear column
  r(ctx, 2, 12, 0.5, 2); // near wing's rear column
  r(ctx, -0.5, 13.5, 1, 0.5); // the knot's underside
}

/** The near arm, in the lit tones, drawn last so it sits in front. */
function nearArm(ctx: Ctx): void {
  ctx.fillStyle = P.shirt;
  r(ctx, 6, 12.5, 2.5, 9.5); // upper arm
  r(ctx, 5.5, 22, 2.5, 9); // forearm, stepped in at the elbow
  ctx.fillStyle = P.shirtShade;
  r(ctx, 6, 12.5, 0.5, 9.5); // rear columns; with the armhole seam beside
  r(ctx, 5.5, 22, 0.5, 9); // them that is a 16 px crease down his side
}

/**
 * Riggs, candidate A: maximum continuity with Bill the man -- same shading,
 * same block vocabulary, same palette family, twice the cell size.
 *
 * `origin` is the CENTRE OF HIS WAIST CUT and he is drawn upward from it:
 * nothing lands below origin.y, and the ink fits x in [-136, +136] and y in
 * [-496, 0] of that point. `t` is free-running seconds. `tie` is the bow tie's
 * fill and is used for the bow tie and nothing else.
 *
 * State discipline, as in renderBillMan.ts: one save/restore around the whole
 * figure, no strokes at all, and globalAlpha / lineWidth / shadowBlur are
 * never touched.
 */
export function paintRiggsA(ctx: Ctx, origin: Vec2, t: number, tie: string): void {
  ctx.save();
  // Snap to whole device pixels: a pixel drawing sitting on a half pixel is a
  // blurry pixel drawing, and every internal offset is already a multiple of 8.
  ctx.translate(Math.round(origin.x), Math.round(origin.y));

  const n = flip(t, NOD_HZ) ? 0.5 : 0; // the nod, 8 px, down only
  const blink = blinking(t);

  farArm(ctx);
  torso(ctx);
  neckAndHead(ctx, n, blink);
  collar(ctx);
  bowTie(ctx, tie, darken(tie, 0.68));
  nearArm(ctx);

  ctx.restore();
}
