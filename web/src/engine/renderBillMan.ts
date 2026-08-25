/**
 * BILL THE MAN — the boss's painting, chosen from the playtest-4 concept
 * portfolio ("Two-Bit Bill", art direction: BIG SOFT PIXELS).
 *
 * Ported verbatim from the concept module: every geometry number, every cell
 * coordinate and every comment below is exactly what was on screen when the
 * user picked it. Only the type annotations and the entry point are new.
 *
 * Why this one won, in the user's own words: "I love the animations of the
 * designs so much, I can honestly look past that." The "that" is the style
 * clash with the rest of the dojo, which is drawn in flat vector ink — a
 * second round of eight house-style Bills carrying this design's exact motion
 * doctrine did not beat it, so the clash is deliberate and ratified. It also
 * has a defence: the boss is the one place in the game the palette is already
 * allowed to break, and "Uncle Bill is from a different game" reads as part
 * of the joke rather than as a mistake.
 *
 * The reason the animation works is stated in the MOTION note below and it is
 * worth not breaking: NOTHING HERE INTERPOLATES. If you ever find yourself
 * adding a Math.sin(t) to smooth something out, you are removing the thing
 * that got this design chosen.
 */
import type { Vec2 } from './types';

type Ctx = CanvasRenderingContext2D;

/** Which face he is wearing. The head is 24 px; the expression is 3 blocks. */
type Expr = 'flat' | 'angry' | 'up' | 'dazed';

/** Where the foam finger points. 'bent' is the folded-over wall impact. */
type FingerDir = 'up' | 'fwd' | 'down' | 'back' | 'bent';

/** The six poses the fight actually asks for. */
export type BillPose = 'idle' | 'lanceTell' | 'lanceDash' | 'stuck' | 'swatTell' | 'swat';

/**
 * "Two-Bit Bill" -- art direction: BIG SOFT PIXELS.
 *
 * Uncle Bill built the way the Undertale-homage dog is built: chunky blocks on
 * a coarse grid, hard edges, zero curves, zero strokes. Every shape in this
 * file is a fillRect. No arc(), no bezier, no stroke(), no outline.
 *
 * ---------------------------------------------------------------------------
 * THE GRID
 * ---------------------------------------------------------------------------
 * Master cell C = 8px. He is 160px tall = 20 cells. Body forms are built from
 * whole cells; ONE finer tier exists at half a cell (4px) and it is used only
 * for face features, the "1" emblem, the belt and the shading edges. Nothing
 * in this file is ever finer than 4px, so he stays a pixel drawing at 1:1.
 *
 * r(col, row, w, h) is the only primitive.
 *   x spans  col*8 - 4  ..  (col+w)*8 - 4     (so a w-cell block at col -w/2
 *                                              is centred on x = 0)
 *   y spans  -160 + row*8 .. -160 + (row+h)*8 (row 0 = top of his head,
 *                                              row 20 = the floor)
 * Feet anchor is (0,0); rows therefore count DOWN from the crown, which is how
 * you actually read a sprite sheet.
 *
 * ---------------------------------------------------------------------------
 * PROPORTIONS, worked out before any code was written (px above the floor)
 * ---------------------------------------------------------------------------
 *   total height        160      (20 cells)
 *   head 3 cells tall    24      crown 160 -> chin 136   => 6.7 heads tall
 *   head width           24      (3 cells) + an 8px hair mass behind = 32
 *   shoulder line       132      (row 3.5)
 *   shoulder width       40      (5 cells) = 1.7 head widths; the arms add two
 *                                more cells of span, so shirt+arms reads 56
 *   waist / belt      80 -> 76   (row 10) = 0.475 of height        [spec 0.47]
 *   crotch               68      (row 11.5) = 0.425 of height
 *   leg length           68      floor -> crotch = 0.425 of height
 *   shoe                  8 tall, 20-24 long = 0.15 of height      [correct]
 *   arm: shoulder 132 -> elbow 88 -> wrist 76 -> fingertip 64      [canonical]
 *   FOAM FINGER        24 wide x 56 tall  (3x3 cell mitt + a 4 cell finger)
 *                      = 35% of his height, and taller than his 52px torso.
 *                      It is deliberately oversize: it is the read.
 *
 * ---------------------------------------------------------------------------
 * WHY IT READS ON #070912
 * ---------------------------------------------------------------------------
 * Three of his four big blocks are near-white or bright: shirt #f2f0ea, skin
 * #e8c9a8, foam #f08a2c. The jeans were lightened one step off the reserved
 * #4a5f8a (which is now the shade tone) because 68px of dark navy standing on
 * a dark navy background is 40% of the character disappearing. The reserved
 * navy billShoe was swapped for an actual brown for the same reason -- the
 * brief says brown shoes, and brown survives the background.
 *
 * There are no black outlines anywhere. That is the "soft" in soft-pixel: form
 * comes from a two-tone ramp per material (lit face + shaded rear column), the
 * way a warm 8-bit sprite is shaded, not from ink.
 *
 * ---------------------------------------------------------------------------
 * MOTION
 * ---------------------------------------------------------------------------
 * Nothing here interpolates. Every moving thing snaps between whole animation
 * frames on a Math.floor(t * hz) clock, and every offset is a multiple of 4px.
 * A pixel character that slides smoothly stops looking like pixels; the snap
 * IS the style. Idle is a true 2-frame loop, the dash is a 2-frame run cycle,
 * and the two tells are 2-frame vibrations -- which read as "winding up" no
 * matter where in the windup you catch them, since `t` is free-running and
 * carries no per-pose progress.
 */

const P = {
  skin: '#e8c9a8', //       reserved billSkin
  skinShade: '#c9a17c', //  new: the far arm and the rear of the face
  hair: '#6b4a32', //       reserved billHair
  shirt: '#f2f0ea', //      reserved billShirt
  shirtShade: '#c6c3bd', // new: rear column, hem, and the far sleeve
  jeans: '#6b83b4', //      new lit tone, one step up from the reserved navy
  jeansShade: '#4a5f8a', // reserved billJeans, demoted to the shade tone
  belt: '#3b2a1c', //       new: a dark band separating white shirt from jeans
  buckle: '#c9c6c0', //     new: deliberately NOT gold -- gold means punish window
  shoe: '#7a4f34', //       new brown; replaces the reserved navy billShoe
  shoeShade: '#4d3120', //  new: sole / ground contact
  foam: '#f08a2c', //       reserved foamOrange
  foamLight: '#ffb45e', //  new: top face of the foam
  foamShade: '#c2651a', //  new: rear face of the foam
  foamCuff: '#161018', //   new: black wristband (Oklahoma State is orange + black)
  emblem: '#fdf6e8', //     new: the "1" printed on the mitt
  ink: '#0b0e1a', //        reserved enemyDetail -- eye and mouth only
  daze: '#e8c76a', //       reserved punishGold -- ONLY on 'stuck', the punish window
  motion: '#4d5a80', //     new: speed dashes behind the charge
};

// --- the only drawing primitive -------------------------------------------
const C = 8; // master cell
const HEAD_TOP = -160; // row 0 sits here, 160px above the feet anchor

/** One block on the grid. col/row/w/h are in cells; halves (0.5) are legal. */
function r(ctx: Ctx, col: number, row: number, w: number, h: number): void {
  ctx.fillRect(col * C - C / 2, HEAD_TOP + row * C, w * C, h * C);
}

/** Two-frame animation clock. Returns 0 or 1, deterministic in t. */
function flip(t: number, hz: number): number {
  return Math.floor(t * hz) % 2;
}

// --- head ------------------------------------------------------------------
/**
 * The skull is a 3x3 cell block whose top-rear corner is (hc, hr). Balding is
 * carried entirely by the silhouette: the crown is bare skin, and an 8px mass
 * of brown hair sits BEHIND the skull and crests over its rear third. That
 * asymmetry -- bald dome forward, hair bulge aft -- is what makes a 24px head
 * read as a man in his sixties rather than as a bean.
 *
 * Feature tiers inside the head, in half-cells from hr:
 *   hr+0.0 .. hr+1.0   tall forehead (nothing drawn -- that IS the bald read)
 *   hr+1.0 .. hr+1.5   brow
 *   hr+1.5 .. hr+2.0   eye
 *   hr+2.0 .. hr+2.5   cheek + nose (the nose protrudes 4px past the face)
 *   hr+2.5 .. hr+3.0   jaw
 */
function head(ctx: Ctx, hc: number, hr: number, expr: Expr, squashed = false): void {
  const hh = squashed ? 2.5 : 3; // 'stuck' flattens the skull by half a cell

  // hair: the rear mass, plus a crest across the back of the crown
  ctx.fillStyle = P.hair;
  r(ctx, hc - 1, hr + 0.5, 1, hh - 0.5);
  r(ctx, hc, hr + 0.5, 1, 0.5);

  // skull
  ctx.fillStyle = P.skin;
  r(ctx, hc, hr, 3, hh);
  ctx.fillStyle = P.skinShade; // rear of the face turns away from the light
  r(ctx, hc, hr + 1, 0.5, hh - 1);

  // nose, and when he is looking up, a jutting jaw under it
  ctx.fillStyle = P.skin;
  if (expr === 'up') {
    r(ctx, hc + 3, hr + 1, 0.5, 0.5); // nose high = head tipped back
    r(ctx, hc + 3, hr + 2, 0.5, 0.5); // chin jutting forward
  } else {
    r(ctx, hc + 3, hr + 2, 0.5, 0.5);
  }

  // brow -- brown, because it is the same hair he has left
  ctx.fillStyle = P.hair;
  if (expr === 'angry') {
    // two blocks: the front tip drops to eye level and jabs forward
    r(ctx, hc + 0.5, hr + 1, 1, 0.5);
    r(ctx, hc + 1.5, hr + 1.5, 1, 0.5);
  } else if (expr === 'up') {
    r(ctx, hc + 1, hr + 0.5, 1.5, 0.5); // raised onto the forehead
  } else {
    r(ctx, hc + 0.5, hr + 1, 1.5, 0.5);
  }

  ctx.fillStyle = P.ink;
  if (expr === 'angry') {
    r(ctx, hc + 1, hr + 1.5, 0.5, 0.5); // squinting under the jabbing brow
  } else if (expr === 'up') {
    r(ctx, hc + 1.5, hr + 1, 0.5, 0.5); // eye high and forward = looking up
    r(ctx, hc + 1.5, hr + 2, 0.5, 0.5); // open mouth (effort)
  } else if (expr === 'dazed') {
    r(ctx, hc + 1, hr + 1, 1, 0.5); // a horizontal bar = eye squeezed shut
    r(ctx, hc + 1.5, hr + 1.5, 0.5, 0.5); // mouth hanging open
  } else {
    r(ctx, hc + 1.5, hr + 1.5, 0.5, 0.5);
  }
}

// --- the weapon ------------------------------------------------------------
/**
 * The OSU foam finger. (mc, mr) is the top-rear corner of the 3x3 cell mitt
 * (24x24px); the finger adds `len` cells (default 4 = 32px) in direction
 * `dir`, so the whole hand is 24 x 56 -- bigger than his torso is tall.
 *
 * The mitt is always drawn face-on whichever way the finger points: this is a
 * flat 2D style, the printed face always faces the camera, and that keeps the
 * white "1" upright and legible in all six poses.
 *
 * dir: 'up' | 'fwd' | 'down' | 'back' | 'bent'  ('bent' = crumpled by the wall)
 */
function foamHand(ctx: Ctx, mc: number, mr: number, dir: FingerDir, len = 0): void {
  const L = len || 4;

  // mitt
  ctx.fillStyle = P.foam;
  r(ctx, mc, mr, 3, 3);

  // the finger
  if (dir === 'up') r(ctx, mc + 1, mr - L, 1.5, L);
  else if (dir === 'down') r(ctx, mc + 1, mr + 3, 1.5, L);
  else if (dir === 'fwd') r(ctx, mc + 3, mr + 0.5, L, 1.5);
  else if (dir === 'back') r(ctx, mc - L, mr + 0.5, L, 1.5);
  else {
    // 'bent': the finger folded over on impact, an L flopping forward
    r(ctx, mc + 1, mr - 2, 1.5, 2);
    r(ctx, mc + 2.5, mr - 2, 2, 1.5);
  }

  // thumb nub -- always kept clear of the finger so the hand stays legible
  if (dir === 'fwd') r(ctx, mc + 0.5, mr - 1, 1.5, 1);
  else if (dir === 'back') r(ctx, mc + 1, mr - 1, 1.5, 1);
  else if (dir === 'down') r(ctx, mc - 1, mr + 1, 1, 1.5);
  else r(ctx, mc - 1, mr + 0.5, 1, 1.5);

  // two-tone ramp: rear column in shade, top edge catching the light
  ctx.fillStyle = P.foamShade;
  r(ctx, mc, mr, 0.5, 3);
  ctx.fillStyle = P.foamLight;
  r(ctx, mc + 0.5, mr, 2.5, 0.5);

  // black wristband, opposite the finger, where the arm plugs in
  ctx.fillStyle = P.foamCuff;
  if (dir === 'fwd') r(ctx, mc - 0.5, mr + 0.5, 0.5, 2);
  else if (dir === 'back') r(ctx, mc + 3, mr + 0.5, 0.5, 2);
  else if (dir === 'down') r(ctx, mc + 0.5, mr - 0.5, 2, 0.5);
  else r(ctx, mc + 0.5, mr + 3, 2, 0.5);

  // the "1": three blocks -- stem, base serif, top flag
  ctx.fillStyle = P.emblem;
  r(ctx, mc + 1.5, mr + 0.5, 0.5, 2);
  r(ctx, mc + 1, mr + 2, 1.5, 0.5);
  r(ctx, mc + 1, mr + 0.5, 0.5, 0.5);
}

// --- reusable body parts ---------------------------------------------------
/**
 * Shirt block with its rear column and hem in shade. Sleeves are drawn by each
 * pose, because where the arms go IS the pose.
 */
function torso(ctx: Ctx, col: number, row: number, w: number, h: number): void {
  ctx.fillStyle = P.shirt;
  r(ctx, col, row, w, h);
  ctx.fillStyle = P.shirtShade;
  r(ctx, col, row, 0.5, h); // rear column
  r(ctx, col, row + h - 0.5, w, 0.5); // hem
}

/** Waist: dark band plus a small pale buckle toward the front. */
function belt(ctx: Ctx, col: number, row: number, w: number): void {
  ctx.fillStyle = P.belt;
  r(ctx, col, row, w, 0.5);
  ctx.fillStyle = P.buckle;
  r(ctx, col + w - 2, row, 0.5, 0.5);
}

/** A jeans segment with its rear edge in shade. */
function jeans(ctx: Ctx, col: number, row: number, w: number, h: number): void {
  ctx.fillStyle = P.jeans;
  r(ctx, col, row, w, h);
  ctx.fillStyle = P.jeansShade;
  r(ctx, col, row, 0.5, h);
}

/** A shoe: brown block with a darker sole. */
function shoe(ctx: Ctx, col: number, row: number, w: number): void {
  ctx.fillStyle = P.shoe;
  r(ctx, col, row, w, 1);
  ctx.fillStyle = P.shoeShade;
  r(ctx, col, row + 0.5, w, 0.5);
}

/**
 * The far arm -- always in the shade tones so it sits behind the body. Three
 * blocks: short sleeve (16px, which is what makes it a T-shirt), forearm, hand.
 */
function farArm(
  ctx: Ctx,
  sc: number,
  sr: number,
  fc: number,
  fr: number,
  hc: number,
  hr: number,
): void {
  ctx.fillStyle = P.shirtShade;
  r(ctx, sc, sr, 1, 2);
  ctx.fillStyle = P.skinShade;
  r(ctx, fc, fr, 1, 3);
  r(ctx, hc, hr, 1.5, 1.5);
}

// --- poses -----------------------------------------------------------------

/**
 * IDLE -- a tall narrow column with the foam finger held up beside his head,
 * its tip level with his crown. True 2-frame breathing at 2.5fps: on the up
 * frame the shoulders, head, arms and foam hand all rise exactly 4px and the
 * shirt STRETCHES from the top (chest expanding) instead of sliding, so the
 * hem stays welded to the belt.
 */
function poseIdle(ctx: Ctx, t: number): void {
  const b = flip(t, 2.5) ? -0.5 : 0;

  farArm(ctx, -3, 3.5 + b, -3.5, 5.5 + b, -4, 10.5 + b); // hand hangs to mid-thigh

  jeans(ctx, -2, 11.5, 2, 7.5); // rear leg
  shoe(ctx, -2, 19, 2.5);
  jeans(ctx, -2, 10.5, 5, 1); // hips
  jeans(ctx, 1, 11.5, 2, 7.5); // front leg, with an 8px gap between the legs
  shoe(ctx, 1, 19, 3);

  torso(ctx, -2, 3.5 + b, 5, 6.5 - b);
  ctx.fillStyle = P.shirtShade;
  r(ctx, -0.5, 3.5 + b, 1.5, 0.5); // collar
  belt(ctx, -2, 10, 5);

  ctx.fillStyle = P.skin;
  r(ctx, -0.5, 3 + b, 1, 0.5); // neck
  head(ctx, -0.5, 0 + b, 'flat');

  // near arm: sleeve, upper arm down his side, forearm stepping up and forward
  ctx.fillStyle = P.shirt;
  r(ctx, 2.5, 3.5 + b, 1, 2);
  ctx.fillStyle = P.skin;
  r(ctx, 2.5, 5.5 + b, 1, 3.5);
  r(ctx, 3, 7.5 + b, 1, 1.5);
  r(ctx, 3.5, 6 + b, 1, 2);
  foamHand(ctx, 4, 3.5 + b, 'up');
}

/**
 * lanceTell -- 0.6s of coil. The silhouette flips from idle's tall-and-narrow
 * to SHORT AND WIDE: he drops 16px into an 88px split stance, the torso is
 * built as two blocks with the upper one kicked 4px aft (a pixel lean-back),
 * and the whole foam hand has swung from in front of his face to a long orange
 * bar behind his hips. Nothing about this reads as idle at a glance. The 14Hz
 * 4px horizontal judder is phase-independent, so it looks like a windup
 * wherever in the 0.6s you happen to catch it.
 */
function poseLanceTell(ctx: Ctx, t: number): void {
  farArm(ctx, -3, 6, -3.5, 8, -4, 10.5);

  // wide split stance, both feet planted, rear leg driving back
  jeans(ctx, -3, 13.5, 2, 2);
  jeans(ctx, -4.5, 15.5, 2, 2.5);
  jeans(ctx, -5, 17.5, 1.5, 1.5);
  shoe(ctx, -5.5, 19, 3);
  jeans(ctx, -2, 12.5, 5, 1); // hips
  jeans(ctx, 1, 13.5, 2, 2);
  jeans(ctx, 2, 15.5, 2, 2.5);
  jeans(ctx, 2.5, 17.5, 1.5, 1.5);
  shoe(ctx, 2.5, 19, 3);

  torso(ctx, -2, 9, 5, 3); // lower torso
  torso(ctx, -2.5, 5.5, 5, 3.5); // upper torso, kicked 4px aft = leaning back
  belt(ctx, -2, 12, 5);

  ctx.fillStyle = P.skin;
  r(ctx, -1, 5, 1, 0.5); // neck
  head(ctx, -1.5, 2, 'angry');

  // the near arm hauls the foam hand back past his own hip
  ctx.fillStyle = P.shirt;
  r(ctx, 1.5, 5.5, 1.5, 2);
  ctx.fillStyle = P.skin;
  r(ctx, 0, 7, 1.5, 1.5);
  r(ctx, -2, 7.5, 2, 1.5);
  r(ctx, -3.5, 7, 1.5, 1.5);
  foamHand(ctx, -6.5, 6, 'back', 3.5);

  // two coil sparks between the mitt and his back, flickering with the judder
  ctx.fillStyle = P.foamLight;
  const s = flip(t, 14);
  r(ctx, -3, s ? 4.5 : 5, 0.5, 0.5);
  r(ctx, -4.5, s ? 5 : 4.5, 0.5, 0.5);
}

/**
 * lanceDash -- the widest, lowest silhouette in the set: 144px wide against
 * idle's 92. The torso is three stacked blocks, each kicked one cell forward
 * going up, which is how you lean a figure ~15 degrees without rotating it
 * (and rotation would destroy the grid). The lance runs level at chest height
 * and reaches 92px past his centre. Two-frame run cycle at 12fps, with the
 * whole upper body dropping 4px on the passing frame.
 */
function poseLanceDash(ctx: Ctx, t: number): void {
  const s = flip(t, 12);
  const d = s ? 0.5 : 0; // the down-beat of the run

  // speed dashes, drawn first so that he charges out of them
  ctx.fillStyle = P.motion;
  r(ctx, s ? -8.5 : -8, 5, 3, 0.5);
  r(ctx, s ? -11 : -11.5, 7, 4, 0.5);
  r(ctx, s ? -7 : -7.5, 9, 2.5, 0.5);

  // far arm pumping back
  ctx.fillStyle = P.shirtShade;
  r(ctx, -1, 7 + d, 1.5, 1.5);
  ctx.fillStyle = P.skinShade;
  r(ctx, -2.5, 8 + d, 1.5, 1.5);
  r(ctx, -3.5, 9 + d, 1.5, 1);

  if (s === 0) {
    // stride frame: front foot planted, rear leg trailing high behind him
    jeans(ctx, -2.5, 13, 2.5, 2);
    jeans(ctx, -4.5, 14.5, 2.5, 2);
    shoe(ctx, -6, 16, 3);
    jeans(ctx, -2, 12.5 + d, 5, 1);
    jeans(ctx, 1, 13, 2.5, 2);
    jeans(ctx, 2, 15, 2, 3);
    jeans(ctx, 2, 18, 1.5, 1);
    shoe(ctx, 2, 19, 3);
  } else {
    // passing frame: legs gathered, rear foot swinging through just off the floor
    jeans(ctx, -2, 13.5, 2.5, 2);
    jeans(ctx, -2.5, 15.5, 2, 2);
    shoe(ctx, -3, 17.5, 3);
    jeans(ctx, -2, 12.5 + d, 5, 1);
    jeans(ctx, 0.5, 13.5, 2.5, 2);
    jeans(ctx, 1, 15.5, 2, 3.5);
    shoe(ctx, 1, 19, 3);
  }

  // three-block forward lean
  torso(ctx, -2, 9.5 + d, 5, 2.5);
  torso(ctx, -1, 7 + d, 5, 2.5);
  torso(ctx, 0, 4.5 + d, 5, 2.5);
  belt(ctx, -2, 12 + d, 5);

  ctx.fillStyle = P.skin;
  r(ctx, 1, 4 + d, 1, 0.5); // neck
  head(ctx, 1, 1.5 + d, 'angry');

  // the lance: shoulder, straight arm, mitt, 32px of levelled foam finger
  ctx.fillStyle = P.shirt;
  r(ctx, 3.5, 5 + d, 1.5, 1.5);
  ctx.fillStyle = P.skin;
  r(ctx, 4.5, 5.5 + d, 1.5, 1.5);
  foamHand(ctx, 5.5, 4.5 + d, 'fwd');
}

/**
 * stuck -- the punish window. Squash and stretch done in whole cells: the
 * torso goes one cell WIDER and one cell SHORTER, the skull is flattened to
 * 2.5 cells, both arms fly up and out, the foam finger is folded over at the
 * knuckle, and the feet pull in pigeon-toed underneath him. A wide top on a
 * narrow base is what "compressed" looks like. Three gold pixels (punishGold,
 * used nowhere else in this file) step around his head at 8fps: the game's
 * colour language says gold means "hit me now", and here it doubles as the
 * oldest joke in animation -- seeing stars.
 */
function poseStuck(ctx: Ctx, t: number): void {
  // legs buckled inward, feet close together under a wide body
  jeans(ctx, -2, 13, 2, 2);
  jeans(ctx, -1.5, 15, 1.5, 4);
  shoe(ctx, -2.5, 19, 2.5);
  jeans(ctx, -2.5, 12, 6, 1); // hips, wide to match the squashed torso
  jeans(ctx, 1, 13, 2, 2);
  jeans(ctx, 1, 15, 1.5, 4);
  shoe(ctx, 0.5, 19, 2.5);

  torso(ctx, -2.5, 6, 6, 5.5); // 48 wide x 44 tall: +1 cell wide, -1 cell tall
  belt(ctx, -2.5, 11.5, 6);

  // far arm flung up and back
  ctx.fillStyle = P.shirtShade;
  r(ctx, -3.5, 6.5, 1, 1.5);
  ctx.fillStyle = P.skinShade;
  r(ctx, -4.5, 5, 1, 2);
  r(ctx, -5, 4, 1.5, 1);

  ctx.fillStyle = P.skin;
  r(ctx, 0, 5.5, 1, 0.5); // neck
  head(ctx, 0, 3, 'dazed', true);

  // near arm up, foam finger crumpled forward against the wall
  ctx.fillStyle = P.shirt;
  r(ctx, 2.5, 6.5, 1.5, 1.5);
  ctx.fillStyle = P.skin;
  r(ctx, 3.5, 5, 1.5, 2);
  foamHand(ctx, 4.5, 2, 'bent');

  // three of five ring slots lit, rotating: he is seeing stars
  const k = Math.floor(t * 8) % 5;
  const ring: [number, number][] = [
    [-2.5, 2.5],
    [-1.5, 1],
    [0.5, 0.5],
    [2.5, 1],
    [3.5, 2.5],
  ];
  ctx.fillStyle = P.daze;
  for (let i = 0; i < 3; i++) {
    const [px, py] = ring[(k + i * 2) % 5] ?? [0, 0];
    const sz = i === 1 ? 1 : 0.5;
    r(ctx, px, py, sz, sz);
  }
}

/**
 * swatTell -- 0.4s of coil, and it must NOT be confusable with lanceTell. It
 * differs on every axis: the stance is narrow and squatting instead of split
 * and wide (56px of foot span, knees pushed out), the foam hand is DOWN by his
 * back heel instead of level behind his hips, the judder is vertical instead
 * of horizontal, and he is looking straight up -- brow on the forehead, eye
 * high, chin jutting. Three orange sparks stack above his crown, pointing at
 * the piece of air he is about to swat.
 */
function poseSwatTell(ctx: Ctx, t: number): void {
  const v = flip(t, 16) ? -0.5 : 0; // 4px vertical tremor, upper body only

  farArm(ctx, -3, 6.5 + v, -3.5, 8.5 + v, -4, 11.5 + v);

  // deep squat, knees pushed out, feet no wider apart than idle
  jeans(ctx, -3, 13.5, 2.5, 2);
  jeans(ctx, -2.5, 15.5, 2, 3.5);
  shoe(ctx, -3, 19, 3);
  jeans(ctx, -2, 12.5, 5, 1);
  jeans(ctx, 1, 13.5, 2.5, 2);
  jeans(ctx, 1, 15.5, 2, 3.5);
  shoe(ctx, 1, 19, 3);

  torso(ctx, -2, 6 + v, 5, 6 - v); // compressed: half a cell shorter than idle
  belt(ctx, -2, 12, 5);

  ctx.fillStyle = P.skin;
  r(ctx, -0.5, 5.5 + v, 1, 0.5); // neck
  head(ctx, -1, 2.5 + v, 'up');

  // the near arm winds all the way down and behind
  ctx.fillStyle = P.shirt;
  r(ctx, 2, 6.5 + v, 1.5, 2);
  ctx.fillStyle = P.skin;
  r(ctx, 1.5, 8.5 + v, 1.5, 2);
  r(ctx, 0, 10.5, 1.5, 1.5);
  r(ctx, -1.5, 11.5, 1.5, 1.5);
  foamHand(ctx, -5, 12.5, 'down', 3);

  // "it is coming up HERE": a chevron of sparks above his head
  ctx.fillStyle = P.foamLight;
  const s = flip(t, 16);
  r(ctx, 0.5, (s ? 1 : 1.5) + v, 0.5, 0.5);
  r(ctx, -0.5, (s ? 0 : 0.5) + v, 0.5, 0.5);
  r(ctx, 1.5, (s ? 0 : 0.5) + v, 0.5, 0.5);
}

/**
 * swat -- the tallest silhouette by a mile: 236px against his standing 160,
 * because the arm plus the whole 56px foam hand are stacked above his crown.
 * Stretch is done as narrow-and-tall (torso 32px wide instead of 40), he is up
 * on the ball of his rear foot with the heel lifted 4px, and the swing path is
 * four blocks of orange stepping from his back hip up over his head -- a
 * discrete pixel trail, not a smeared arc.
 */
function poseSwat(ctx: Ctx, t: number): void {
  const s = flip(t, 14);

  // the swing trail, drawn behind him, brightening toward the top
  ctx.fillStyle = P.foamShade;
  r(ctx, -4.5, s ? 12.5 : 13, 1, 1);
  r(ctx, -5, s ? 8.5 : 9, 1, 1);
  ctx.fillStyle = P.foam;
  r(ctx, -3.5, s ? 4.5 : 5, s ? 1 : 0.5, s ? 1 : 0.5);
  r(ctx, -1, s ? 1 : 1.5, s ? 1 : 0.5, s ? 1 : 0.5);

  // far arm swung down and back as a counterweight
  ctx.fillStyle = P.shirtShade;
  r(ctx, -2.5, 3.5, 1, 2);
  ctx.fillStyle = P.skinShade;
  r(ctx, -3.5, 5.5, 1, 2.5);
  r(ctx, -4, 8, 1.5, 1.5);

  jeans(ctx, -2, 11.5, 2, 7.5); // rear leg
  ctx.fillStyle = P.shoe;
  r(ctx, -2, 18.5, 1, 0.5); // heel lifted clear of the floor...
  shoe(ctx, -1, 19, 2); // ...so only the ball of the foot is down
  jeans(ctx, -1.5, 10, 4, 1.5); // hips, narrow to match the stretched torso
  jeans(ctx, 1, 11.5, 2, 7.5);
  shoe(ctx, 1, 19, 3);

  torso(ctx, -1.5, 3, 4, 6.5); // 32 wide: stretched tall by being narrow
  belt(ctx, -1.5, 9.5, 4);

  ctx.fillStyle = P.skin;
  r(ctx, -0.5, 2.5, 1, 0.5); // neck
  head(ctx, -1, -0.5, 'up');

  // the arm goes dead vertical and the foam finger towers 76px over his head
  ctx.fillStyle = P.shirt;
  r(ctx, 1.5, 3, 1.5, 2);
  ctx.fillStyle = P.skin;
  r(ctx, 2, 0.5, 1.5, 3);
  r(ctx, 2, -2.5, 1.5, 3);
  foamHand(ctx, 1.5, -5.5, 'up');
}

/**
 * Paint Bill the man, feet-anchored at `feet`, in one of his six poses.
 *
 * `t` is a free-running clock in seconds, not per-pose progress: every tell
 * is a two-frame vibration, so it reads as "winding up" wherever in the
 * window you catch it, and no phase timer has to be threaded in here.
 *
 * State discipline: one save/restore around the whole body, no strokes at
 * all, and globalAlpha / lineWidth / shadowBlur are never touched.
 */
export function paintBillMan(
  ctx: Ctx,
  feet: Vec2,
  pose: BillPose,
  t: number,
  facing: number,
): void {
  ctx.save();
  // Snap to whole device pixels: a pixel drawing sitting on a half pixel is a
  // blurry pixel drawing, and every internal offset is already a multiple of 4.
  ctx.translate(Math.round(feet.x), Math.round(feet.y));
  ctx.scale(facing < 0 ? -1 : 1, 1);

  // lanceTell judders horizontally; that shake belongs to the whole body, so
  // it rides on the transform instead of on every single block.
  if (pose === 'lanceTell') ctx.translate(flip(t, 14) ? -4 : 0, 0);

  if (pose === 'lanceTell') poseLanceTell(ctx, t);
  else if (pose === 'lanceDash') poseLanceDash(ctx, t);
  else if (pose === 'stuck') poseStuck(ctx, t);
  else if (pose === 'swatTell') poseSwatTell(ctx, t);
  else if (pose === 'swat') poseSwat(ctx, t);
  else poseIdle(ctx, t);

  ctx.restore();
}
