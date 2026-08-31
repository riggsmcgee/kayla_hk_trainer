/**
 * RIGGS — CANDIDATE B, "The Detail The Scale Buys".
 *
 * The 16 px cell was ratified because it buys roughly eleven times Bill's
 * facial area (Bill's face is ~36 sub-cells; this one is ~400). This candidate
 * is the argument that the area should actually be SPENT: a curly head of hair
 * built clump by clump, three days of growth on the jaw, a hairline with teeth
 * in it, a brow that moves, a mouth with two states, a dress collar with
 * points, a placket with buttons, a pocket, and three tones per material
 * instead of two.
 *
 * The face inside that style was redrawn from a PHOTOGRAPH in playtest 8. What
 * changed: the hair went from a flat cap with a part to a curly mass, the
 * glasses came off, and a stubble beard arrived. What did NOT change is the
 * style around it — the cell, the ramps, the detail level, the stepped motion —
 * because that was ratified and only the likeness was ever in question.
 *
 * The test it has to pass is "he is recognisably a PERSON, not a silhouette
 * with a prop". The test it can FAIL is drifting off the medium — every extra
 * detail is another chance to stop looking like it belongs beside Bill. Two
 * rules keep it honest: nothing is ever finer than 8 px (half a cell), and
 * every detail is a fillRect. There is no arc(), no bezier, no stroke(), no
 * outline and no ellipse in this file, exactly as in renderBillMan.ts.
 *
 * NOTHING HERE INTERPOLATES. Same doctrine, same reason: if he moves smoothly
 * while the Bills do not, he stops looking like he is from the same world as
 * them, which is the one thing his art has to do.
 *
 * ---------------------------------------------------------------------------
 * THE GRID
 * ---------------------------------------------------------------------------
 * Master cell C = 16px. ONE finer tier at half a cell (8px), used for face
 * features, the shading edges, the collar steps, the tie and the buttons.
 * Nothing in this file is ever finer than 8px.
 *
 * r(col, row, w, h) is the only primitive.
 *   x spans  col*16 .. (col+w)*16          (a w-cell block at col -w/2 is
 *                                           centred on x = 0 — this painter
 *                                           does NOT carry renderBillMan's
 *                                           half-cell x bias, whose own header
 *                                           mis-states the centring rule; here
 *                                           the obvious rule is the true one)
 *   y spans  -496 + row*16 .. -496 + (row+h)*16
 *                                          (row 0 = the crown at the top of a
 *                                           breath, row 31 = the waist cut)
 * The anchor is the CENTRE OF THE WAIST CUT, so rows count DOWN from the crown
 * to the bottom edge of the picture and nothing is ever drawn below row 31.
 *
 * He faces the camera. There is no facing argument and no ctx.scale mirror:
 * this is a portrait, not an actor in the arena.
 *
 * ---------------------------------------------------------------------------
 * PROPORTIONS, worked out before any code was written
 * ---------------------------------------------------------------------------
 * All figures are px ABOVE THE WAIST CUT, measured at the top of a breath
 * (the low frame of the breath is the same drawing 8 px lower — see MOTION).
 *
 *   total height        496      (31 cells) = 3.1 head heights, which is what
 *                                waist-up is: head, chest, and a hand's width
 *                                of belly under the ribs
 *   crown               496      (row 0)
 *   hairline            456      (row 2.5)   crown->hairline = 1/4 of the head
 *   brow                416      (row 5)     \
 *   nose base           376      (row 7.5)    > the three equal thirds of a
 *   chin                336      (row 10)    /  face, 40 px each
 *   head                160 tall x 112 wide  (10 x 7 cells) = 0.70 aspect
 *   eye line            408      (row 5.5)   eyes 24 x 8, pupils 8 x 8
 *   eye shadow          400      (row 6)     the crease above and the shadow
 *                                              under, 8 px each, doing what
 *                                              the frame used to do
 *   growth         360 -> 320    (rows 7.5..10) upper lip, jaw, chin
 *   mouth               352      (row 8.5)   48 wide = 0.43 of head width
 *   ear            416 -> 376    (rows 5..7.5) brow to nose base, as ears go
 *   neck           336 -> 288    64 wide = 0.57 of head width. 48 looked like
 *                                a stalk; a neck is thicker than you think
 *   trapezius top       296      (row 12.5)  \  the shoulder line is a
 *   deltoid tip         272      (row 14)    /  4-step staircase, 24 px of
 *                                              slope over 136 px of half-span
 *   shoulder width      272      (17 cells) = 1.70 head heights
 *                                (Bill is 40/24 = 1.67 — the same man, seen
 *                                 closer, is the whole point of this file)
 *   collar band    304 -> 288    (rows 12..13), the points reach down to 248
 *   BOW TIE        288 -> 256    (rows 13..15) 80 wide x 32 tall = 0.71 of a
 *                                head width. It is the one thing that is known
 *                                about him, so it sits dead centre on the
 *                                strongest horizontal in the drawing.
 *   chest          256 -> 112    176 wide (11 cells) = 1.1 head heights
 *   waist block    112 -> 0      160 wide (10 cells), an 8 px step in from the
 *                                chest on each side
 *   sleeve         272 -> 0      48 wide at the upper arm, 40 at the forearm;
 *                                below row 24 an 8 px gap of background opens
 *                                between sleeve and waist, which is what says
 *                                "arm" rather than "wide shirt"
 *   placket        240 -> 0      16 wide, 3 buttons
 *   pocket         192 -> 144    40 x 48, on the lit side
 *   total span          272 px wide  (x -136..136, inside the +/-224 budget)
 *
 * ---------------------------------------------------------------------------
 * WHY IT READS ON #070912
 * ---------------------------------------------------------------------------
 * Two of his three big blocks are near-white or bright and they are the two
 * biggest: the shirt (#f2f0ea, and it is nearly half the drawing) and the face
 * (#e8c9a8). The third, the hair, is a mid warm brown that sits directly on
 * top of the bright face, so the silhouette never has dark meeting dark. The
 * only genuinely dark masses in the picture are the brows, the mouth and the
 * pupils, all small and all surrounded by lit skin. The stubble is deliberately
 * NOT one of them: drawn a step under the skin rather than in the hair tone, it
 * stays a shadow on a face instead of becoming a third dark block.
 *
 * The light comes from the same side as Bill's — screen right — so every
 * material shades its rear (-x) column and lights its top edge and its +x
 * rim. That is what makes two drawings look like they are in one room.
 *
 * There are no black outlines. Form is three tones per material: a highlight,
 * a body tone, and a shade. Bill uses two; the extra tone is the one real
 * licence this candidate takes with his medium, and it is spent on modelling
 * (forehead, cheekbone, nose, shoulder line) rather than on new colours.
 *
 * THE BOW TIE takes its colour from the caller, so a swatch strip can walk it
 * through a dozen yellows without touching this painter. It is NOT given a
 * second tone: a hard-coded shade would be wrong at some of those yellows, and
 * the tie has to survive all of them. Its structure comes from SHAPE instead —
 * two 8 px pinch gaps of shirt between the wings and the knot, and the shadow
 * it casts on the shirt underneath. Whatever colour arrives, the bow reads.
 *
 * ---------------------------------------------------------------------------
 * MOTION
 * ---------------------------------------------------------------------------
 * Nothing interpolates. Every moving thing snaps between whole frames on a
 * Math.floor(t * hz) clock and every offset is exactly 8 px, one fine cell.
 * There is no Math.sin anywhere in this file.
 *
 *   BREATH   1.5 Hz, two frames. Everything from the chest up rides 8 px; the
 *            chest block STRETCHES (row + b, height - b) instead of sliding,
 *            so the waist cut stays welded to the bottom edge of the picture.
 *            Same trick as Bill's idle, and the same reason.
 *   NOD      a 2 Hz clock read mod 6, so the nod is two beats out of every
 *            six (a 3 s cycle) rather than a metronome. The head — and only
 *            the head — drops 8 px, and the neck shortens by the same 8 px
 *            instead of telescoping.
 *   MM-HM    on the SECOND of those two nods, and only then, the brow lifts
 *            8 px. Nod and brow come out of the same floored step, which is
 *            why they land together and read as an acknowledgement.
 *   SPEECH   5 Hz, two frames: the mouth alternates open and shut every 200 ms
 *            while — and only while — the caller says he is speaking. It is a
 *            FOURTH clock rather than a derived value because the thing it
 *            follows lives outside this file: on the last screen it is the
 *            typewriter, and his mouth has to stop when the sentence does.
 *            5 shares no factor with 1.5, 2 or 8, so talking never locks to
 *            the nod and leaves him opening his mouth on every beat.
 *   BLINK    an 8 Hz clock read mod 28: two frames closed (0.25 s) every 3.5 s,
 *            and they are the LAST two of the cycle, so t = 0 has his eyes
 *            open — a gallery that freezes him at t = 0 for reduced motion
 *            must not catch him mid-blink. A 50/50 flip would strobe at this
 *            size; a blink has to be rare to be a blink. The closed lid is
 *            drawn 8 px BELOW where the open eye sits, so it reads as having
 *            come down rather than as the eye changing colour.
 *
 * The four clocks are 1.5 Hz, 2 Hz, 8 Hz and 5 Hz and share no factor that
 * matters, so he never falls into a single visible pulse.
 */
import type { Vec2 } from '../types';

type Ctx = CanvasRenderingContext2D;

const P = {
  skinHi: '#f6dcc0', //     new: forehead, cheekbone, the lit side of the nose
  skin: '#e8c9a8', //       reserved billSkin — the same man in the same light
  skinShade: '#c9a17c', //  reserved: the rear column of the face, the far ear
  hairHi: '#8b6647', //     new: the crown, where the light lands first
  hair: '#6a4c37', //       a half-step off reserved billHair, and the brows
  hairShade: '#463125', //  new: rear column and the part
  shirtHi: '#fbfaf6', //    new: shoulder line, collar edge, cuff, placket
  shirt: '#f2f0ea', //      reserved billShirt
  shirtShade: '#c6c3bd', // reserved: rear columns, the far sleeve, the cut
  stubble: '#a98a70', //    new: three days of growth. One step under skinShade
  //                        so it stays a SHADOW ON SKIN — in the hair tone it
  //                        becomes a beard he could take hold of, and a
  //                        different, older man
  eyeWhite: '#f4f2ec', //   reserved dogWhite
  ink: '#0b0e1a', //        reserved enemyDetail — pupils only
  lip: '#8f5b4a', //        new: the mouth line and its two smiling corners
  lipDark: '#5a3229', //    new: the gap when it is open
  button: '#8e8a82', //     new: three of them, deliberately NOT gold
};

// --- the only drawing primitive -------------------------------------------
const C = 16; // master cell
const CROWN = -496; // row 0 sits here, 496px above the waist cut

/** One block on the grid. col/row/w/h are in cells; halves (8px) are legal. */
function r(ctx: Ctx, col: number, row: number, w: number, h: number): void {
  ctx.fillRect(col * C, CROWN + row * C, w * C, h * C);
}

/** Floored animation clock. Deterministic in t, and it never interpolates. */
function step(t: number, hz: number): number {
  return Math.floor(t * hz);
}

// --- the head --------------------------------------------------------------
/**
 * The whole head group, hung from `hr` — row 0 is the crown, row 10 the chin.
 * It is one function because the nod moves all of it at once, beard included;
 * anything that lags behind the skull by a frame stops being a face.
 *
 * Feature tiers, in half-cells from hr (the classic thirds of a face):
 *   hr+0.0 .. hr+2.5   hair: three crown clumps, a ragged mass, a hairline
 *                      with teeth in it. No part — a parting is the one thing
 *                      curly hair does not have
 *   hr+2.5 .. hr+4.0   forehead — the tallest unbroken plane, so it takes
 *                      the highlight and does most of the modelling
 *   hr+4.0 .. hr+5.0   brow (lifts 8px on the nod). It stops 8px short of the
 *                      temple hair on each side: same tone, and where they
 *                      touch they fuse into one band across the whole face
 *   hr+4.5 .. hr+6.5   sideburns, in front of the ears, handed on to the jaw
 *   hr+5.0 .. hr+6.5   eyes: crease, eye, shadow — one 8px tier each
 *   hr+6.0 .. hr+7.5   nose, with both long edges drawn now that no frame does
 *   hr+6.5 .. hr+10.0  growth: jaw, jaw corner, chin
 *   hr+7.5 .. hr+8.0   the upper lip's growth
 *   hr+8.0 .. hr+9.0   mouth, its two ends lifted a tier above the line
 *   hr+8.5 .. hr+10.0  jaw stepping in three times to a 64px chin, which is
 *                      exactly the neck's width: narrower leaves a hole
 */
function head(ctx: Ctx, hr: number, blink: boolean, browUp: boolean, mouthOpen: boolean): void {
  // The skull KEEPS its full 112px width at the cheekbones. Narrowing it to 96
  // was tried and rendered: at this cell size a narrow skull does not read as a
  // narrow face, it reads as a skull, because the width is what holds the
  // features apart. The narrowness comes from the JAW instead — three 16px
  // steps below the mouth, ending exactly as wide as the 64px neck under it, so
  // the taper is visible and the silhouette still has no holes in it.
  ctx.fillStyle = P.skin;
  r(ctx, -3.5, hr + 1, 7, 7.5);
  r(ctx, -3, hr + 8.5, 6, 0.5);
  r(ctx, -2.5, hr + 9, 5, 0.5);
  r(ctx, -2, hr + 9.5, 4, 0.5);

  // the rear column of the face, and the hollow under the far cheekbone
  ctx.fillStyle = P.skinShade;
  r(ctx, -3.5, hr + 3, 0.5, 5.5);
  r(ctx, -3, hr + 7, 0.5, 1.5);
  r(ctx, -3, hr + 8.5, 0.5, 0.5);

  // modelling: the band of forehead the hairline leaves, then the near
  // cheekbone as a lit plane with its own hollow directly under it — a single
  // flat highlight bar gives a face no structure to be recognised by
  ctx.fillStyle = P.skinHi;
  r(ctx, -0.5, hr + 3.5, 2.5, 0.5);
  r(ctx, 1, hr + 6.5, 1.5, 0.5);
  ctx.fillStyle = P.skinShade;
  r(ctx, 1.5, hr + 7, 1, 0.5);

  // ears: brow to nose base, the near one lit, the far one wholly in shade
  ctx.fillStyle = P.skin;
  r(ctx, 3.5, hr + 5, 0.5, 2.5);
  ctx.fillStyle = P.skinShade;
  r(ctx, 3.5, hr + 5.5, 0.5, 1);
  r(ctx, -4, hr + 5, 0.5, 2.5);

  // ---- the hair, which is most of the likeness ----------------------------
  // It cannot be bought with height — row 0 is the ceiling, 496px above the
  // origin against a 500px limit — so the volume is bought with WIDTH: 136px
  // across the temples over a 112px skull. The outline is built one 8px tier
  // at a time and no two tiers end in the same place, which is what stops a
  // curly head from setting into a dome. The crown is three separate clumps
  // with two notches of background bitten out between them, because the only
  // edge that can be irregular at the very top is the top edge itself.
  ctx.fillStyle = P.hair;
  r(ctx, -3, hr, 1.5, 0.5); // crown, clump 1
  r(ctx, -1, hr, 2, 0.5); //   clump 2, the widest of the three
  r(ctx, 1.5, hr, 1, 0.5); //  clump 3, the narrowest
  r(ctx, -3.5, hr + 0.5, 6.5, 0.5); // the mass swelling out under the crown,
  r(ctx, -4.5, hr + 1, 8, 0.5); //    each tier stepping past the last on one
  r(ctx, -4, hr + 1.5, 8.5, 0.5); //  side and back in on the other
  r(ctx, -4.5, hr + 2, 8.5, 0.5);
  // the hairline: high, with the temples left bare either side of the lobe
  r(ctx, -4.5, hr + 2.5, 1.5, 0.5);
  r(ctx, 3, hr + 2.5, 1.5, 0.5);
  r(ctx, -1.5, hr + 2.5, 0.5, 0.5); // two teeth hanging below the band,
  r(ctx, 0, hr + 2.5, 1, 0.5); //      unequal and off-centre: a curl does not
  //                                   know where the middle of a face is
  r(ctx, -4, hr + 3, 1, 0.5); // the sides tapering down past the temples
  r(ctx, 3, hr + 3, 1, 0.5);
  r(ctx, -3.5, hr + 3.5, 0.5, 0.5);
  r(ctx, 3, hr + 3.5, 0.5, 0.5);
  // Rows 4 and 4.5 stop at cols -3 and 3 and go no further in. That is not
  // tidiness: the brow is the same brown as the hair, and where the two touch
  // they fuse into one unbroken band across the whole upper face, which is
  // what made an earlier attempt glower. There is 8px of skin between them.
  r(ctx, -3.5, hr + 4, 0.5, 0.5);
  r(ctx, 3, hr + 4, 0.5, 0.5);
  r(ctx, -3.5, hr + 4.5, 0.5, 2); // sideburns, in front of the ears, down to
  r(ctx, 3, hr + 4.5, 0.5, 2); //   the middle of them, where the jaw's own
  //                                growth picks them up

  // the shade does two jobs: the rear column, which follows the ragged left
  // edge tier by tier, and the SEPARATIONS — short stepped strokes running
  // down inside the mass from the notches in the crown. Without those the
  // whole thing is one brown shape with a bumpy edge instead of clumps.
  ctx.fillStyle = P.hairShade;
  r(ctx, -3, hr, 0.5, 0.5);
  r(ctx, -3.5, hr + 0.5, 0.5, 0.5);
  r(ctx, -4.5, hr + 1, 0.5, 0.5);
  r(ctx, -4, hr + 1.5, 0.5, 0.5);
  r(ctx, -4.5, hr + 2, 0.5, 1);
  r(ctx, -4, hr + 3, 0.5, 0.5);
  r(ctx, -3.5, hr + 3.5, 0.5, 1);
  r(ctx, -3.5, hr + 4.5, 0.5, 2);
  r(ctx, -1.5, hr + 0.5, 0.5, 1); // the first notch carried down into the
  r(ctx, 1, hr + 0.5, 0.5, 0.5); //  mass; the second steps sideways as it
  r(ctx, 1.5, hr + 1, 0.5, 0.5); //  goes, so it is a curl and not a parting
  r(ctx, -2.5, hr + 1.5, 0.5, 1);
  r(ctx, 2.5, hr + 1.5, 0.5, 0.5);
  r(ctx, 0, hr + 2, 0.5, 0.5);
  r(ctx, 3, hr + 2.5, 0.5, 0.5);

  // and the light, landing on the top-right corner of clump after clump. Each
  // one is a single 8px square: a highlight any longer joins its neighbours
  // up and paints a helmet stripe across the whole crown.
  ctx.fillStyle = P.hairHi;
  r(ctx, -2, hr, 0.5, 0.5);
  r(ctx, 0, hr, 1, 0.5);
  r(ctx, 2, hr, 0.5, 0.5);
  r(ctx, 2.5, hr + 0.5, 0.5, 0.5);
  r(ctx, -1, hr + 1, 0.5, 0.5); // three of them are interior, well away from
  r(ctx, 3, hr + 1, 0.5, 0.5); //  the edge, which is what says the mass has
  r(ctx, 0.5, hr + 1.5, 0.5, 0.5); // curls in the middle of it and is not
  r(ctx, 4, hr + 1.5, 0.5, 0.5); //  just a rim with texture round the outside
  r(ctx, 2, hr + 2, 0.5, 0.5);
  r(ctx, 3.5, hr + 2, 0.5, 0.5);
  r(ctx, 4, hr + 2.5, 0.5, 0.5);
  r(ctx, 3.5, hr + 3, 0.5, 0.5);

  // brow — thick, near-straight, sat one tier above the eye. It is the one
  // feature that moves on its own, still by exactly one 8px tier.
  const br = browUp ? 4 : 4.5;
  ctx.fillStyle = P.hair;
  r(ctx, -2.5, hr + br, 2, 0.5);
  r(ctx, 0.5, hr + br, 2, 0.5);

  // the eyes, with no frame around them any more. What the glasses were really
  // doing was giving the eye an edge, so the edge is drawn instead: one 8px
  // crease above and one 8px shadow below, with SKIN either side. Boxing each
  // eye in a full square of shade was tried and it turns them into two holes.
  ctx.fillStyle = P.skinShade;
  r(ctx, -2.5, hr + 5, 1.5, 0.5);
  r(ctx, 1, hr + 5, 1.5, 0.5);
  r(ctx, -2.5, hr + 6, 1.5, 0.5); // the shadow under the eye that he has
  r(ctx, 1, hr + 6, 1.5, 0.5);

  if (blink) {
    // the lid comes DOWN: drawn 8px below where the open eye sits, and in hair
    // rather than skin, because a lash line is the only thing at this size
    // that reads as an eye SHUT rather than as an eye missing. It must never
    // be LIGHTER than the shadow it replaces or the blink reads as a flicker.
    ctx.fillStyle = P.hair;
    r(ctx, -2.5, hr + 6, 1.5, 0.5);
    r(ctx, 1, hr + 6, 1.5, 0.5);
  } else {
    ctx.fillStyle = P.eyeWhite;
    r(ctx, -2.5, hr + 5.5, 1.5, 0.5);
    r(ctx, 1, hr + 5.5, 1.5, 0.5);
    ctx.fillStyle = P.ink;
    r(ctx, -2, hr + 5.5, 0.5, 0.5); // pupils centred in each eye: he is
    r(ctx, 1.5, hr + 5.5, 0.5, 0.5); // looking straight down the lens at her
  }

  // nose: a 16px bridge threaded down between the eyes, widening to a 24px
  // ball. Both of its long edges are drawn now — shade on the rear, highlight
  // on the lit one — because the inner frame bars used to do that job.
  ctx.fillStyle = P.skin;
  r(ctx, -0.5, hr + 6, 1, 1);
  r(ctx, -0.5, hr + 7, 1.5, 0.5);
  ctx.fillStyle = P.skinShade;
  r(ctx, -1, hr + 6, 0.5, 1.5);
  ctx.fillStyle = P.skinHi;
  r(ctx, 0, hr + 6, 0.5, 1.5);

  // THE BEARD, and every rect of it is drawn HERE, before the mouth block and
  // outside its branches, so switching mouth states still costs exactly three
  // rects and his stubble does not strobe on and off while he talks.
  //
  // All of it is P.stubble and none of it is P.hair. That one choice is the
  // whole difference between a man who has not shaved for three days and a man
  // with a mustache: drawn in hair colour the upper lip becomes the darkest
  // mass on the face and ages him ten years. It runs continuously — sideburn,
  // jaw, jaw corner, chin — because a beard with gaps in it is a chinstrap.
  ctx.fillStyle = P.stubble;
  r(ctx, -1.5, hr + 7.5, 3, 0.5); // the upper lip
  r(ctx, -3.5, hr + 6.5, 0.5, 2); // the far jaw, taking over from the
  r(ctx, -3, hr + 7.5, 0.5, 1); //    sideburn, and stepping IN as it drops:
  r(ctx, 3, hr + 6.5, 0.5, 2); //     a straight inner edge reads as a
  r(ctx, 2.5, hr + 7.5, 0.5, 1); //   sideburn continued, not as growth
  r(ctx, -3, hr + 8.5, 1.5, 0.5); // along the jawline, following the taper in.
  r(ctx, 1.5, hr + 8.5, 1.5, 0.5); // It stops 24px out from centre and the mouth
  //                                  line starts at 16px, so 8px of plain skin
  //                                  always separates growth from lip.
  r(ctx, -2.5, hr + 9, 1, 0.5);
  r(ctx, 1.5, hr + 9, 1, 0.5);
  r(ctx, -2, hr + 9.5, 1, 0.5); // the chin, either side of its lit point
  r(ctx, 1, hr + 9.5, 1, 0.5);

  // mouth: a 32px line with both ENDS lifted a tier above it. Each end overlaps
  // the line's last column, so the lift meets it along an EDGE — a block set one
  // tier up and one column out touches only at a vertex, and at 8px that reads
  // as a detached speck beside a flat line rather than as a smile. Both ends are
  // outside the branch, so opening his mouth never wipes the smile off his face
  // and switching states still costs exactly three rects.
  //
  // The line is 32px where the stubble on either side stops at 24px out, which
  // leaves 8px of plain skin between them. Without that gap the mouth and the
  // jaw growth join into one dark band straight across the face — the same
  // smear, arriving by a different route.
  ctx.fillStyle = P.lip;
  r(ctx, -1.5, hr + 8, 1, 0.5);
  r(ctx, 0.5, hr + 8, 1, 0.5);
  if (mouthOpen) {
    r(ctx, -0.5, hr + 8, 1, 0.5); // the two ends joined into a full upper lip
    ctx.fillStyle = P.lipDark;
    r(ctx, -1, hr + 8.5, 2, 1);
    ctx.fillStyle = P.skinHi;
    r(ctx, -1, hr + 9.5, 2, 0.5);
  } else {
    r(ctx, -1, hr + 8.5, 2, 0.5);
    ctx.fillStyle = P.skinHi;
    r(ctx, -1, hr + 9, 2, 0.5); // the lower lip catching the light
  }
}

// --- the shirt -------------------------------------------------------------
/**
 * One step of the shoulder staircase: body tone, a lit top edge, a shaded rear
 * column. Called four times with narrowing widths, which is how a shoulder
 * gets a slope without a single diagonal edge existing anywhere.
 */
function yokeStep(ctx: Ctx, col: number, row: number, w: number, h: number): void {
  ctx.fillStyle = P.shirt;
  r(ctx, col, row, w, h);
  ctx.fillStyle = P.shirtHi;
  r(ctx, col + 0.5, row, w - 0.5, 0.5);
  ctx.fillStyle = P.shirtShade;
  r(ctx, col, row, 0.5, h);
}

/**
 * Paint Riggs, waist-anchored at `origin` — which is the CENTRE OF HIS WAIST
 * CUT, the bottom edge of the picture. He is drawn upward from there and
 * nothing is ever drawn below it.
 *
 * `t` is a free-running clock in seconds; every animation is a floored step of
 * it, so he can be dropped into any frame at any phase and still look alive.
 * `tie` is the bow tie's colour, passed in so a swatch strip can vary it. It
 * is used for the tie and for nothing else in this file.
 *
 * State discipline: one save/restore around the whole figure, no strokes at
 * all, and globalAlpha / lineWidth / shadowBlur are never touched.
 */
export function paintRiggsB(
  ctx: Ctx,
  origin: Vec2,
  t: number,
  tie: string,
  speaking = false,
): void {
  ctx.save();
  // Snap to whole device pixels: a pixel drawing sitting on a half pixel is a
  // blurry pixel drawing, and every internal offset is already a multiple of 8.
  ctx.translate(Math.round(origin.x), Math.round(origin.y));

  // --- the three clocks. Every one of them floors; none of them eases. ---
  const b = step(t, 1.5) % 2 ? 0 : 0.5; // breath: 0 = top of the breath
  const beat = step(t, 2) % 6; // a 3 s cycle, so the nod is not a metronome
  const n = beat === 2 || beat === 5 ? 0.5 : 0; // the head drops 8 px
  const browUp = beat === 5; // ...and on the second one, the brow goes with it
  // The mouth is the one thing here driven from outside: it flaps while a
  // sentence is appearing beside him and is shut the rest of the time.
  const mouthOpen = speaking && step(t, 5) % 2 === 0;
  const blink = step(t, 8) % 28 >= 26; // two frames closed every 3.5 s
  const u = b + n; // the head carries both offsets

  // Back to front, because draw order IS depth: there is no z-buffer here.

  // far arm — wholly in the shade tones, so it sits behind the body. The
  // upper arm absorbs the breath by stretching; the forearm never moves.
  ctx.fillStyle = P.shirtShade;
  r(ctx, -8.5, 14 + b, 3, 10 - b);
  r(ctx, -8, 24, 2.5, 7);
  ctx.fillStyle = P.shirt; // two folds, lit: a flat grey slab is not cloth
  r(ctx, -7.5, 20.5, 1.5, 0.5);
  r(ctx, -7, 26.5, 1.5, 0.5);

  // torso: chest, then an 8px step in on each side at the waist
  ctx.fillStyle = P.shirt;
  r(ctx, -5.5, 15 + b, 11, 9 - b);
  r(ctx, -5, 24, 10, 7);
  ctx.fillStyle = P.shirtHi;
  r(ctx, 3.5, 15 + b, 1.5, 3.5 - b); // the chest plane that faces the light
  ctx.fillStyle = P.shirtShade;
  r(ctx, -5.5, 15 + b, 0.5, 9 - b); // rear column
  r(ctx, -5, 24, 0.5, 7);
  r(ctx, -5, 30.5, 10, 0.5); // the cut darkens rather than glowing at the edge

  // near arm: lit outer rim, a crease where it meets the body, two folds
  ctx.fillStyle = P.shirt;
  r(ctx, 5.5, 14 + b, 3, 10 - b);
  r(ctx, 5.5, 24, 2.5, 7);
  ctx.fillStyle = P.shirtHi;
  r(ctx, 8, 14 + b, 0.5, 10 - b);
  r(ctx, 7.5, 24, 0.5, 7);
  ctx.fillStyle = P.shirtShade;
  r(ctx, 5.5, 14 + b, 0.5, 10 - b);
  r(ctx, 5.5, 24, 0.5, 7);
  r(ctx, 6, 20.5, 1.5, 0.5); // elbow fold
  r(ctx, 6, 26.5, 1.5, 0.5); // forearm fold
  r(ctx, 5.5, 30.5, 2.5, 0.5); // the cut, again

  // neck. 64 px wide — 0.57 of the head, because a 48 px neck under a 112 px
  // head is a stalk. It SHORTENS by exactly the nod rather than telescoping.
  ctx.fillStyle = P.skin;
  r(ctx, -2, 10 + u, 4, 3 - n);
  ctx.fillStyle = P.skinShade;
  r(ctx, -2, 10 + u, 4, 0.5); // the jaw's own shadow, thrown down the neck
  r(ctx, -2, 10 + u, 0.5, 3 - n); // rear column

  // the shoulder line: four steps, widest first so each rim stays visible
  yokeStep(ctx, -8.5, 14 + b, 17, 1);
  yokeStep(ctx, -7.5, 13.5 + b, 15, 0.5);
  yokeStep(ctx, -6, 13 + b, 12, 0.5);
  yokeStep(ctx, -4, 12.5 + b, 8, 0.5);

  // collar: a band round the neck and two points stepping down and inward
  ctx.fillStyle = P.shirt;
  r(ctx, -3, 12 + b, 6, 1);
  r(ctx, -3.5, 13 + b, 3, 1.5); // far point
  r(ctx, -3, 14.5 + b, 1.5, 1);
  r(ctx, 0.5, 13 + b, 3, 1.5); // near point
  r(ctx, 1.5, 14.5 + b, 1.5, 1);
  ctx.fillStyle = P.shirtHi;
  r(ctx, -3, 12 + b, 6, 0.5); // the band's lit top edge
  r(ctx, 3, 13 + b, 0.5, 1.5); // the near point's lit outer edge
  ctx.fillStyle = P.shirtShade;
  r(ctx, -3, 12 + b, 0.5, 1); // rear column
  r(ctx, -3.5, 13 + b, 0.5, 1.5);
  r(ctx, -3, 15.5 + b, 1.5, 0.5); // under each point, so a white collar on a
  r(ctx, 1.5, 15.5 + b, 1.5, 0.5); // white shirt still has an edge
  r(ctx, -1, 13 + b, 2, 2); // the V between the points, in shadow, which is
  // also what the tie's pinch gaps show through. It is exactly the tie's own
  // height: any grey left showing above the bow reads as a hole in his chest.

  // THE BOW TIE, worn hard up under the collar band. One colour, no ramp: the
  // caller owns the hue and a hard-coded shade would betray it at some
  // yellows. Structure instead — two wings 32px tall, a 16px knot, and an 8px
  // pinch gap of collar shadow on each side of it.
  ctx.fillStyle = tie;
  r(ctx, -2.5, 13 + b, 1, 2); // far wing, outer
  r(ctx, -1.5, 13.5 + b, 0.5, 1); // far wing, pinched toward the knot
  r(ctx, -0.5, 13.5 + b, 1, 1); // knot
  r(ctx, 1, 13.5 + b, 0.5, 1); // near wing, pinched
  r(ctx, 1.5, 13 + b, 1, 2); // near wing, outer
  ctx.fillStyle = P.shirtShade;
  r(ctx, -2.5, 15 + b, 5, 0.5); // the shadow it throws on the shirt

  // placket: a lit 8px strip and an 8px seam beside it, which is a raised
  // band of cloth and not a stripe. It stretches with the breath from the top.
  ctx.fillStyle = P.shirtHi;
  r(ctx, 0, 16 + b, 0.5, 15 - b);
  ctx.fillStyle = P.shirtShade;
  r(ctx, -0.5, 16 + b, 0.5, 15 - b);
  ctx.fillStyle = P.button;
  r(ctx, 0, 20.5, 0.5, 0.5);
  r(ctx, 0, 24.5, 0.5, 0.5);
  r(ctx, 0, 28.5, 0.5, 0.5);

  // pocket, on the lit side: three seam edges and a hemmed top
  ctx.fillStyle = P.shirtShade;
  r(ctx, 2, 19, 0.5, 3);
  r(ctx, 4, 19, 0.5, 3);
  r(ctx, 2, 21.5, 2.5, 0.5);
  ctx.fillStyle = P.shirtHi;
  r(ctx, 2, 19, 2.5, 0.5);

  head(ctx, u, blink, browUp, mouthOpen);

  ctx.restore();
}
