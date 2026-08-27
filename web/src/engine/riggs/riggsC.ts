/**
 * RIGGS — candidate C, "THE PORTRAIT".
 *
 * A sibling to web/src/engine/renderBillMan.ts, written in the same medium at a
 * different scale. Read that file's header first; this one only states where it
 * departs, and why.
 *
 * THE DIRECTION
 * ---------------------------------------------------------------------------
 * The other two candidates draw a man. This one draws a PICTURE OF a man: a
 * title-card bust, composed rather than posed. Everything follows from that.
 *
 *   Squarer shoulders. The body is one 272 x 296 near-square slab of jacket
 *   with two 16 px vertical slots of ground cut out of it, so the outline is a
 *   block rather than a person-shape. A block is what reads from across a room.
 *
 *   Deliberate negative space. He is 272 px wide inside a 448 px box, so 88 px
 *   of untouched ground sits on each side. That margin is drawn on purpose: a
 *   bust that fills its frame reads as a sprite that got too big, and a bust
 *   with air around it reads as a portrait.
 *
 *   Fewer, bigger blocks. About 40 fillRects for the whole figure, against ~55
 *   for one of Bill's poses at a fifth of the area. At 16 px cells the tempting
 *   thing is to spend the extra resolution on detail; spending it on SIZE is
 *   the only thing that keeps him in Bill's medium instead of beside it.
 *
 *   Symmetric geometry, asymmetric light. Every block is centred on x = 0 or
 *   mirrored across it — the silhouette is exactly balanced left to right — and
 *   the only thing that breaks the symmetry is the shade column on the right of
 *   each material. Form comes from the light; composition comes from the axis.
 *
 *   The bow tie is the keystone, not a costume note. It sits dead on the centre
 *   axis at the apex of the white shirt wedge, it is the only saturated colour
 *   in the drawing, it is the ONE object treated perfectly symmetrically (its
 *   shade runs along the bottom of both wings, not down one side), and it is
 *   the one thing that never moves — the head nods around it. Put a thumb over
 *   it and the picture loses its centre.
 *
 * ---------------------------------------------------------------------------
 * THE GRID
 * ---------------------------------------------------------------------------
 * Master cell C = 16 px. ONE finer tier at half a cell (8 px), used for the
 * face features, the ears, the shade columns and every animation offset.
 * Nothing in this file is ever finer than 8 px.
 *
 * r(col, row, w, h) is the only primitive.
 *   x spans  col*16 .. (col+w)*16          (so a w-cell block at col = -w/2 is
 *                                           centred on x = 0; for w = 5 that is
 *                                           col -2.5, a legal half-cell)
 *   y spans  -496 + row*16 .. -496 + (row+h)*16
 *                                          (row 0 = the top of his hair,
 *                                           row 31 = the waist cut)
 *
 * NOTE, because it will otherwise bite the next person: this primitive
 * deliberately drops renderBillMan's `- C/2` x-shift. There, x = col*8 - 4, so
 * a centred block actually sits at col = (1 - w)/2 while that file's header
 * states the rule as col = -w/2 — the header is half a cell wrong, and every
 * real call in it quietly obeys the other formula. This drawing has to be
 * exactly symmetric about its own axis, so the axis was made free: here
 * col = -w/2 really is centred, and every mirrored pair below can be read off
 * by sign alone.
 *
 * Origin is the CENTRE OF THE WAIST CUT — the bottom edge of the figure. He is
 * drawn entirely upward from it; nothing lands below y = 0.
 *
 * ---------------------------------------------------------------------------
 * PROPORTIONS, worked out before any code (px ABOVE THE WAIST, and cell rows)
 * ---------------------------------------------------------------------------
 *                                 row        px above waist    width
 *   crown / top of hair           0          496               112  (7 cells)
 *   hairline                      3          448               ---
 *   brow                          4.5        424               16 each, gap 32
 *   eye line                      5.5        408               16 each, gap 32
 *   ear (top .. bottom)           5 .. 6.5   416 .. 392        8 each, jutting
 *   nose (top .. bottom)          6.5 .. 8   392 .. 368        16
 *   jaw begins (face narrows)     8.5        360               80   (5 cells)
 *   mouth                         8.5        360               32
 *   CHIN                          10         336               ---
 *   neck (chin .. shoulder)       10 .. 12.5 336 .. 296        48   (3 cells)
 *   collar top (stands proud)     12         304               128  (8 cells)
 *   SHOULDER LINE                 12.5       296               240  (15 cells)
 *   shoulder caps drop 8 px       13         288               272  (17 cells)
 *   bow tie (top .. bottom)       13.5..16.5 280 .. 232        80 x 48
 *   shoulder yoke bottom          16.5       232               272
 *   sleeves + torso begin         16.5       232               48|16|144|16|48
 *   shirt wedge, upper            13.5 .. 19 280 .. 192        112  (7 cells)
 *   shirt wedge, middle           19 .. 25   192 .. 96         80   (5 cells)
 *   shirt wedge, lower            25 .. 31   96 .. 0           48   (3 cells)
 *   WAIST CUT                     31         0                 272 outer
 *
 *   total drawn height   496 = 31 cells
 *   head 160 tall (10 cells)  =>  496 / 160 = 3.1 heads, which is what
 *                                 "waist-up" measures on a real person
 *   head 112 wide including ears; face 96 x 112, so the face is 0.86 as wide as
 *                                 it is tall — squarer than life, which is what
 *                                 a pixel head wants
 *   shoulders 272 = 1.7 head-heights = 2.4 head-widths. Life is nearer 2.0
 *                                 head-widths; the extra 0.4 is the whole
 *                                 "squarer shoulders" brief, and it is why the
 *                                 outline reads as a block at a glance.
 *   sleeve 48 wide, slot 16 wide, torso 144 wide. Those 16 px slots are the
 *                                 only place the ground comes INSIDE the
 *                                 figure, and they are what stop a 272 px slab
 *                                 reading as a wall.
 *   bow tie 80 x 48 = 0.29 of the shoulder span; life is nearer 0.24. Oversize
 *                                 on purpose: it is the one thing about him
 *                                 that was specified, so it is the one thing
 *                                 the drawing is allowed to exaggerate. The
 *                                 upper wedge is 112 wide so that 16 px of
 *                                 shirt shows past each tip — a tie whose tips
 *                                 touch the lapels reads as part of the jacket.
 *
 *   Bounding box: x in [-136, 136], y in [-496, 0]. The brief allows +/-224 and
 *   -500; the 88 px of unused width on each side IS the composition.
 *
 * ---------------------------------------------------------------------------
 * WHY IT READS ON #070912
 * ---------------------------------------------------------------------------
 * Bill's rule was "three of four big blocks near-white or bright". The four big
 * blocks here are jacket 272 x 296 (#7d97a6, L 57%), face + neck 96 x 200
 * (#ecd0b0, L 81%), shirt wedge ~64 x 280 (#f4f1e8, L 94%) and hair 112 x 48
 * (#8a5a3c, L 39%). Three are bright and the fourth is still eight times the
 * luminance of the ground, so nothing dissolves into it.
 *
 * The jacket is the load-bearing decision. A dark suit is the obvious portrait
 * costume and it is exactly the mistake the jeans note in renderBillMan warns
 * about: 296 px of near-black on near-black is most of the character gone. So
 * the jacket is a mid slate-teal — bright enough to hold the slab, desaturated
 * enough that the tie stays the only colour in the picture, and cool enough
 * that a warm yellow on it is the strongest pairing available. It is also not
 * Bill's palette: he is white shirt, blue jeans, orange foam. Same medium, two
 * different men.
 *
 * The tie's yellow is NOT chosen here — it is passed in, so a swatch strip can
 * try a dozen without touching the drawing. It must not be punishGold #e8c76a:
 * that colour is taught in so many words as the punish window and is the fill
 * of every forward button on the site, one of which will be on screen beneath
 * this picture. `tieShade` is a fixed deep warm brown rather than a derived
 * tone, so any warm yellow handed in gets a ramp without the painter having to
 * do colour arithmetic.
 *
 * There are no black outlines anywhere. Form is a two-tone ramp per material: a
 * lit face and a shade column on the RIGHT edge — the light is up and to the
 * left, and the right side of every form turns away from it.
 *
 * ---------------------------------------------------------------------------
 * MOTION
 * ---------------------------------------------------------------------------
 * Nothing here interpolates. There is no Math.sin anywhere in this file, and
 * every offset is exactly 8 px — one half-cell, the finest tier that exists.
 *
 *   BLINK   two frames, open and shut, scheduled by Math.floor(t * 6) % 19.
 *           The ring is a SCHEDULE, not an easing: it decides which of the two
 *           frames is showing, and nothing between them exists. A plain 50/50
 *           flip() would have him blinking half of his life, which reads as
 *           asleep, so the duty cycle is 1 slot in 19 — 0.17 s shut roughly
 *           every 3.2 s. The shut frame is a wider, lower lid bar: the block
 *           changes size AND row on one step, the way poseSwat's trail does.
 *
 *   NOD     two frames, up and down, scheduled by Math.floor(t * 5) % 17, down
 *           on slots 3 and 4 — 0.4 s of nod roughly every 3.4 s. The two rings
 *           have different periods (3.17 s and 3.40 s), so they drift apart
 *           instead of locking into one tic.
 *
 *           The nod moves the HEAD GROUP ONLY (hair, face, jaw, ears, features)
 *           and the neck STRETCHES to follow — row + nod, height - nod — the
 *           same trick poseIdle's torso uses, so the collar never unwelds from
 *           the chin. The body does not move at all. In a bust the shoulders
 *           are the frame and the head is the picture, and a frame that
 *           breathes is a frame that has come loose.
 *
 *   THE TIE NEVER MOVES. It is the fixed point the nod is measured against.
 *           Giving it its own tick was tried on paper and rejected: two
 *           independent 8 px motions at this size read as noise, and the whole
 *           test for this candidate is "composed, not posed".
 */
import type { Vec2 } from '../types';

type Ctx = CanvasRenderingContext2D;

const P = {
  hair: '#8a5a3c', //        warmer and lighter than Bill's #6b4a32: at 112x48 on
  //                         near-black, his crown has to stay part of the outline
  hairShade: '#5d3a25', //   right side of the cap, and both brows
  skin: '#ecd0b0', //        a half-step off billSkin — same medium, another man
  skinShade: '#c49b76', //   right of the face, under the jaw, the nose, the far ear
  shirt: '#f4f1e8', //       the brightest thing in the picture, and the narrowest
  shirtShade: '#c8c4b8', //  right column of the collar and of each wedge block
  jacket: '#7d97a6', //      mid slate-teal: see WHY IT READS. Never a dark suit.
  jacketShade: '#50697a', // right of the yoke, the torso and both sleeves
  ink: '#171526', //         eyes and mouth only — never an outline
  tieShade: '#4a3a10', //    fixed deep warm brown: ramps ANY yellow handed in
};

// --- the only drawing primitive -------------------------------------------
const C = 16; // master cell
const CROWN = -496; // row 0 sits here, 496 px above the waist cut

/** One block on the grid. col/row/w/h are in cells; halves (8 px) are legal. */
function r(ctx: Ctx, col: number, row: number, w: number, h: number): void {
  ctx.fillRect(col * C, CROWN + row * C, w * C, h * C);
}

/**
 * A material block: filled in its lit tone, then overpainted with a shade
 * column on its RIGHT edge. `sw` is that column's width in cells — 0.5 for a
 * small form, 1 for the two widest ones, where an 8 px turn would vanish.
 */
function panel(
  ctx: Ctx,
  col: number,
  row: number,
  w: number,
  h: number,
  lit: string,
  shade: string,
  sw = 0.5,
): void {
  ctx.fillStyle = lit;
  r(ctx, col, row, w, h);
  ctx.fillStyle = shade;
  r(ctx, col + w - sw, row, sw, h);
}

// --- the head group --------------------------------------------------------
/**
 * Head, neck and face, all of it displaced down by `nod` cells (0 or 0.5).
 *
 * The neck is the joint: it takes the nod on its TOP edge and gives the same
 * amount back out of its height, so its bottom stays welded to the shoulder
 * line and the collar below never sees the movement. That is the whole reason a
 * stepped nod does not tear the drawing open.
 *
 * Feature tiers, in cells below the hairline at row 3:
 *   3.0 .. 4.5   forehead (nothing drawn)
 *   4.5 .. 5.0   brow
 *   5.5 .. 6.0   eye        (on the shut frame, 6.0 .. 6.5, and half a cell wider)
 *   6.5 .. 8.0   nose, the only shaded form on the front plane
 *   8.5 .. 10.0  jaw, half a cell narrower each side = the chin
 *   8.5 .. 9.0   mouth, sitting on that jaw
 */
function headGroup(ctx: Ctx, nod: number, shut: boolean): void {
  // Neck first, so the jaw above overlaps it. The COLLAR is not drawn here and
  // not in body() either: it is painted after this whole group, because a
  // nodding neck drawn over a static collar slides across it, and the one thing
  // the joint must never do is show its own seam.
  panel(ctx, -1.5, 10 + nod, 3, 2.5 - nod, P.skin, P.skinShade);
  ctx.fillStyle = P.skinShade;
  r(ctx, -1.5, 10 + nod, 3, 0.5); // the shadow the chin throws down the throat

  // ears: 8 px each, jutting clear of the 96 px face. The right one is drawn
  // entirely in shade — it is the side turned away, as Bill's far arm is.
  ctx.fillStyle = P.skin;
  r(ctx, -3.5, 5 + nod, 0.5, 1.5);
  ctx.fillStyle = P.skinShade;
  r(ctx, 3, 5 + nod, 0.5, 1.5);

  // hair: one 112 x 48 cap, drawn before the face so the hairline is a hard
  // horizontal at row 3. Balding is Bill's read, not his: a full square block
  // of hair is what gives this crown a straight edge to be a portrait with.
  panel(ctx, -3.5, 0 + nod, 7, 3, P.hair, P.hairShade);

  // face, then the jaw half a cell narrower on each side
  panel(ctx, -3, 3 + nod, 6, 5.5, P.skin, P.skinShade);
  panel(ctx, -2.5, 8.5 + nod, 5, 1.5, P.skin, P.skinShade);

  // brows, in the hair's shade tone
  ctx.fillStyle = P.hairShade;
  r(ctx, -2, 4.5 + nod, 1, 0.5);
  r(ctx, 1, 4.5 + nod, 1, 0.5);

  // eyes: two frames and nothing between them. Open is a 16 px block on the eye
  // line; shut is a 24 px bar half a cell lower — a lid coming down.
  ctx.fillStyle = P.ink;
  if (shut) {
    r(ctx, -2.5, 6 + nod, 1.5, 0.5);
    r(ctx, 1, 6 + nod, 1.5, 0.5);
  } else {
    r(ctx, -2, 5.5 + nod, 1, 0.5);
    r(ctx, 1, 5.5 + nod, 1, 0.5);
  }

  // nose: 16 x 24 of shade on the centre axis. It is the only thing on the
  // front of the face that is not symmetrical about its own edges, and it is
  // what stops the face reading as a flat card.
  ctx.fillStyle = P.skinShade;
  r(ctx, -0.5, 6.5 + nod, 1, 1.5);

  ctx.fillStyle = P.ink;
  r(ctx, -1, 8.5 + nod, 2, 0.5); // mouth
}

// --- the body --------------------------------------------------------------
/**
 * The frame: a 272 x 296 jacket slab with two 16 px slots of ground cut out of
 * it, then the white shirt wedge tapering 112 -> 80 -> 48 down the centre axis.
 *
 * Nothing in here animates. Draw order is depth, as in renderBillMan: the yoke
 * and its two dropped shoulder caps go down first, then the sleeves and torso
 * are laid below them as three separate blocks with the ground left showing
 * between them, and the wedge goes over the top of all of it.
 *
 * The wedge's two edges ARE the lapels — a lapel drawn in the jacket's own
 * colour is an invisible lapel, so the shape carries it instead of a third tone.
 */
function body(ctx: Ctx): void {
  // Shoulder yoke — the one block that makes the silhouette square. The outer
  // cell at each end is split off and dropped 8 px, which is the ENTIRE slope
  // of his shoulders: enough that the top edge is not one 272 px ruled line
  // (which reads as cardboard, not as a man), and small enough that the block
  // still reads as a block. The far cap is drawn wholly in shade rather than
  // panelled, so it just extends the yoke's own shade column outward instead of
  // opening a seam beside it.
  panel(ctx, -7.5, 12.5, 15, 4, P.jacket, P.jacketShade, 1);
  ctx.fillStyle = P.jacket;
  r(ctx, -8.5, 13, 1, 3.5);
  ctx.fillStyle = P.jacketShade;
  r(ctx, 7.5, 13, 1, 3.5);

  // sleeves and torso, with 16 px of ground left between each pair
  panel(ctx, -8.5, 16.5, 3, 14.5, P.jacket, P.jacketShade);
  panel(ctx, -4.5, 16.5, 9, 14.5, P.jacket, P.jacketShade);
  panel(ctx, 5.5, 16.5, 3, 14.5, P.jacket, P.jacketShade, 1);

  // the shirt wedge, three blocks, each one cell narrower than the last
  panel(ctx, -3.5, 13.5, 7, 5.5, P.shirt, P.shirtShade);
  panel(ctx, -2.5, 19, 5, 6, P.shirt, P.shirtShade);
  panel(ctx, -1.5, 25, 3, 6, P.shirt, P.shirtShade);
}

// --- the collar and the bow tie --------------------------------------------
/**
 * Drawn last, over the finished neck, so the joint never shows.
 *
 * COLLAR: one 128 x 24 block standing half a cell proud of the shoulder line,
 * eight cells wide against the neck's three. It is the widest piece of white in
 * the drawing and it is what the eye follows down from the chin to the tie.
 *
 * BOW TIE: 80 x 48 on the centre axis, and only FOUR blocks —
 *   body  5 cells x 2, rows 14 .. 16     the solid middle band
 *   tip   1 cell  x 3, rows 13.5 .. 16.5 at each end, standing 8 px proud
 *   knot  1 cell  x 3, rows 13.5 .. 16.5 on the axis
 * so the outline is a solid bar with four 16 x 8 notches bitten out of it, top
 * and bottom, either side of the knot. That notch is the entire bow: tall at
 * the tips, tall at the knot, pinched between. An earlier version made the knot
 * the SHORTEST piece and left a hole of shirt showing under it — it read as a
 * rendering bug rather than as a tie, which is what proofing a drawing catches.
 *
 * The shade is the bottom half-cell of each block — NOT a right-hand column
 * like every other material in this file. That is deliberate: the tie is the
 * only perfectly symmetrical object in the picture and is not allowed to lose
 * that to the lighting, and a bow's planes really do fold outward from the
 * centre in both directions.
 */
function collarAndTie(ctx: Ctx, color: string): void {
  panel(ctx, -4, 12, 8, 1.5, P.shirt, P.shirtShade);

  // [col, row, height] for the three full-height uprights: tip, knot, tip.
  const uprights: readonly (readonly [number, number, number])[] = [
    [-2.5, 13.5, 3],
    [-0.5, 13.5, 3],
    [1.5, 13.5, 3],
  ];
  ctx.fillStyle = color;
  r(ctx, -2.5, 14, 5, 2); // the solid band the notches are bitten out of
  for (const u of uprights) r(ctx, u[0], u[1], 1, u[2]);
  ctx.fillStyle = P.tieShade;
  r(ctx, -2.5, 15.5, 5, 0.5);
  for (const u of uprights) r(ctx, u[0], u[1] + u[2] - 0.5, 1, 0.5);
}

/**
 * Paint Riggs, candidate C — a title-card bust, waist-anchored at `origin`.
 *
 * `origin` is the centre of the waist cut; he is drawn upward from it, and
 * nothing lands below y = origin.y. `t` is a free-running clock in seconds:
 * both animations read it through Math.floor, so any instant of it is a whole
 * frame of the drawing. `tie` is the bow tie's colour, passed in so a swatch
 * strip can vary it without touching the painter — it is used for the tie and
 * for nothing else.
 *
 * State discipline, inherited from renderBillMan: one save/restore around the
 * whole figure, no strokes at all, and globalAlpha / lineWidth / shadowBlur are
 * never touched.
 */
export function paintRiggsC(ctx: Ctx, origin: Vec2, t: number, tie: string): void {
  ctx.save();
  // Snap to whole device pixels: a pixel drawing sitting on a half pixel is a
  // blurry pixel drawing, and every internal offset is already a multiple of 8.
  ctx.translate(Math.round(origin.x), Math.round(origin.y));

  // The two schedules. Neither is an easing — each one picks one of two frames.
  const shut = Math.floor(t * 6) % 19 === 0;
  const beat = Math.floor(t * 5) % 17;
  const nod = beat === 3 || beat === 4 ? 0.5 : 0;

  // Draw order is depth. The collar comes after the neck so the nod's joint is
  // always hidden underneath it.
  body(ctx);
  headGroup(ctx, nod, shut);
  collarAndTie(ctx, tie);

  ctx.restore();
}
