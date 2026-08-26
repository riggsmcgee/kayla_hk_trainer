/**
 * BILL THE DOG — chosen alongside the man from the playtest-4 concept
 * portfolio ("Chunky Pixel Bill", art direction: dog-pixel).
 *
 * Ported verbatim from the concept module; only the type annotations and the
 * entry point are new. The pair was chosen together and should stay together:
 * the man and the dog share one grid and one motion doctrine, which is what
 * makes them read as two halves of one joke rather than two characters from
 * different games.
 *
 * As with the man: NOTHING HERE INTERPOLATES, and that is the point.
 */
import type { Vec2 } from './types';

type Ctx = CanvasRenderingContext2D;

/** A pixel cell: [x, y, w, h], already snapped to the 4 px grid. */
type Rect = [number, number, number, number];

/** What the painters accept: any list of cells, literal or accumulated. */
type Cells = readonly (readonly number[])[];

type Leg = [number, number];

/** The four poses that share the standing rig. */
type DogPose =
  | 'idle'
  | 'walkIn'
  | 'bonesTell'
  | 'bones'
  // The three celebration candidates. Exactly one survives the portfolio.
  | 'bow'
  | 'applaud'
  | 'lieDown';

/** Every pose the fight asks for, including the two that leave the rig. */
export type BillDogPose = DogPose | 'rollTell' | 'roll';

/** The standing rig: what each pose moves, relative to a neutral stand. */
interface Rig {
  lift: number;
  headDX: number;
  headDY: number;
  earDX: number;
  earDY: number;
  snoutUp: number;
  mouth: number;
  chestUp: number;
  rumpDY: number;
  tailF: number;
  tailShift: number;
  brow: boolean;
  wideEye: boolean;
  blink: boolean;
  legs: [Leg, Leg, Leg, Leg];
}

/**
 * BILL THE DOG - art direction "dog-pixel".
 *
 * A chunky pixel dog. Everything is axis-aligned rectangles snapped to a 4 px
 * cell, so the whole animal is built out of big visible pixels - the coarse,
 * readable look of an old handheld game. It is an HOMAGE to the little white
 * pixel dog the family jokes about, not a copy of it: our own proportions, our
 * own head shape, our own perky ear, one dark dojo-style eye dot instead of
 * two, and an orange collar that ties him to Uncle Bill's OSU foam finger.
 *
 * ---------------------------------------------------------------------------
 * PROPORTIONS, worked out on paper before any drawing (px, CELL = 4)
 * ---------------------------------------------------------------------------
 * Box: 64 wide x 58 tall, feet-anchored at (0, 0), head/front toward +x.
 * That is 16 cells x 14.5 cells. The standing dog is built exactly 56 tall
 * (14 cells) and the leftover 2 px is the idle breathing lift, so at the top
 * of a breath he measures 58 and never one pixel more.
 *
 *   floor .................  y =   0
 *   leg height ............  16  = 0.28 of height  (short legs, small dog)
 *   belly line ............  y = -16
 *   barrel ................  16 tall x 32 long, y -32..-16
 *   shoulder row ..........  y = -36  (inset 1 cell each end = rounded back)
 *   head bottom (jaw) .....  y = -28  (overlaps the barrel = solid neck)
 *   head top ..............  y = -48
 *   ear tip ...............  y = -56
 *
 *   So the stack is legs 16 / body 20 / head 20 / ear 8 = 0.28 / 0.36 / 0.36
 *   of the height, with the head and ear sharing the top third.
 *
 * Why a head that big: a real dog's head is about 0.28 of its height. This is
 * a small SMUG dog at 58 px on a near-black background and the head carries
 * every scrap of his character, so it goes chibi, the way pixel art always
 * does. Read it against the torso instead: head 24 x 20 against a body 20 tall
 * and 44 long - head and body the same height, body twice as long. That is the
 * corgi/terrier ratio, which is what "small smug dog" wants.
 *
 *   head block ............  24 wide x 20 tall, x 0..24
 *   muzzle ................  8 x 8, juts 2 cells clear of the skull to x = 32
 *   nose ..................  1 ink cell at the top-front of the muzzle
 *   eye ...................  1 ink cell, 2 cells behind the muzzle
 *   brow ..................  2 px ink lid over the eye - the whole smug read
 *   ear ...................  12 wide, 12 tall, perky, leaning back, and it is
 *                            the ONLY thing above y = -48, so it is a clean
 *                            spike on the outline
 *   tail ..................  8 wide, 16 tall, held UP (a smug dog's tail is up)
 *   legs ..................  8 wide, near/far pairs 4 px apart, far pair grey
 *   collar ................  16 x 8 orange band plus a 4 x 4 tag
 *
 * ROLL BALL: a hand-tuned 12-cell pixel circle (48 x 48), centre (0, -24),
 * half-widths in cells [2,4,5,5,6,6,6,6,5,5,4,2]. Deliberately smaller than
 * the standing dog, because the paws, ear, tail and collar orbit OUTSIDE the
 * rim at r = 26: the union measures about 60 x 54 and the appendages keep
 * breaking the circle as they go round. A plain circle reads as an orb; paws
 * poking out of one read as a rolled-up dog.
 *
 * SILHOUETTE-FIRST CHECK (squint at 58 px on #070912): a long white loaf on
 * four stubs, a square head at the front with a jutting muzzle and one ear
 * spike, one tail spike up at the back. Every pose changes that outline, not
 * just the shading - see the note on each pose branch.
 *
 * TECHNIQUE: the dark outline is free. Pass 1 paints every silhouette rect
 * grown 2 px in ink; pass 2 paints the same rects in white on top. Overlapping
 * cells cancel, so only the union boundary keeps its ink - no internal seams,
 * no per-cell edge maths. Anything that needs its own outline on top of the
 * body (the tucked head in rollTell, a paw poking off the ball) simply gets
 * the same two passes again, later.
 *
 * COLOURS: dogWhite and foamOrange come straight from the project palette.
 * dogShade and dogInk are new. dogInk is deliberately a hair lighter than the
 * canvas background so the outline reads as a rim instead of a hole. Bones use
 * pokeGreen as their rim, because this trainer's colour language already means
 * green = you can destroy this with the nail.
 *
 * COST: about 55 fillRect calls a frame in the heaviest pose. No paths, no
 * gradients, no shadows, no per-frame allocation beyond a few small arrays.
 */

/** Pixel cell. Every edge in this file is a multiple of CELL. */
const CELL = 4;

const WHITE = '#f4f2ec';
const SHADE = '#c3c7d6';
const INK = '#141a2b';
const ORANGE = '#f08a2c';
const BONE = '#efe9d8';
const POKE = '#9fd8a8';

/**
 * Paint a list of [x, y, w, h] cells, grown by `g` px on every side.
 * INK at g = 2 first, then the fill colour at g = 0, gives a 2 px outline
 * around the UNION of the list and no seams inside it.
 */
function paint(ctx: Ctx, rects: Cells, color: string, g: number): void {
  ctx.fillStyle = color;
  paintInto(ctx, rects, g);
}

/** paint() with the fillStyle already set - saves re-assigning it four times. */
function paintInto(ctx: Ctx, rects: Cells, g: number): void {
  for (const c of rects) {
    const x = c[0] ?? 0;
    const y = c[1] ?? 0;
    const w = c[2] ?? 0;
    const h = c[3] ?? 0;
    ctx.fillRect(x - g, y - g, w + g + g, h + g + g);
  }
}

/** Snap a value to the pixel grid so nothing ever renders a soft edge. */
function snap(v: number): number {
  return Math.round(v / CELL) * CELL;
}

/* ========================================================================== *
 * STANDING POSES: idle, walkIn, bonesTell, bones.
 * All four share one rig; only the numbers differ.
 * ========================================================================== */

/** 4-frame gait. dx = how far the pair reaches, lift = foot off the floor. */
/** Modulo lookup into a fixed table. The index is always in range. */
function pick(table: readonly number[], i: number): number {
  return table[((i % table.length) + table.length) % table.length] ?? 0;
}

const WALK_DX = [4, 0, -4, 0];
const WALK_LIFT = [0, 4, 0, 0];

/**
 * The rig IS the difference between the standing poses.
 *   lift     whole trunk + head up/down; legs stay planted on the floor
 *   headDX/Y head group relative to the trunk
 *   snoutUp  muzzle raised on the face (the "heaving up to spit" tilt)
 *   mouth    height of the ink gap between muzzle and jaw (0 = shut)
 *   chestUp  shoulder line raised (puffed chest)
 *   rumpDY   rear end lowered (+) or raised (-)
 *   tailF    0 = tail at the very back of the box, 1 = swept forward over the
 *            rump. Two whole-cell positions, never a rotation - that is how
 *            pixel art wags, and the pop between them reads at a glance.
 *   legs     [nearFront, farFront, nearBack, farBack], each [dx, lift]
 */
function standRig(pose: DogPose, t: number): Rig {
  const rig: Rig = {
    lift: 0,
    headDX: 0,
    headDY: 0,
    earDX: 0,
    earDY: 0,
    snoutUp: 0,
    mouth: 0,
    chestUp: 0,
    rumpDY: 0,
    tailF: 0,
    tailShift: 0,
    brow: true,
    wideEye: false,
    blink: false,
    legs: [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  };

  if (pose === 'walkIn') {
    // Trotting in. Diagonal pairs alternate: near-front and far-back swing
    // together, then the other diagonal. 8 frames a second, deliberately
    // chunky to match the pixel grid.
    const f = Math.floor(t * 8) % 4;
    const g = (f + 2) % 4;
    rig.legs = [
      [pick(WALK_DX, f), pick(WALK_LIFT, f)], // near front
      [pick(WALK_DX, g), pick(WALK_LIFT, g)], // far front
      [pick(WALK_DX, g), pick(WALK_LIFT, g)], // near back, diagonal to the near front
      [pick(WALK_DX, f), pick(WALK_LIFT, f)], // far back
    ];
    // Body dips on the contact frames and rides high while a pair passes.
    // The dip goes DOWN, never up: the standing dog already reaches the top
    // of the 58 px box.
    const passing = f === 1 || f === 3;
    rig.lift = passing ? 0 : 4;
    rig.headDX = 4; // nose leads the trot
    rig.headDY = passing ? 2 : 0; // head stays level while the body bounces
    rig.earDY = passing ? -4 : 0; // ear flaps a beat behind the body
    rig.earDX = passing ? -4 : 2;
    rig.tailF = Math.floor(t * 14) % 2; // happy fast wag
    return rig;
  }

  if (pose === 'bonesTell') {
    // Winding up: the weight shifts BACK. Rump drops, chest puffs, head pulls
    // back and the muzzle tilts up at the sky - the shape a dog makes right
    // before it heaves something out. Nothing in that outline resembles idle.
    rig.headDX = -4;
    rig.snoutUp = 4;
    rig.mouth = 4;
    rig.chestUp = 4;
    rig.rumpDY = 4;
    rig.brow = false; // eyes wide, not smug: he is concentrating
    rig.wideEye = true;
    rig.earDX = -4; // ear pinned back
    rig.tailF = 0;
    // Rigid tail with a 2 px shiver at 10 Hz: "charging", not "wagging".
    rig.tailShift = Math.floor(t * 20) % 2 === 0 ? 2 : -2;
    rig.legs = [
      [4, 0], // near front braced forward
      [-4, 0], // far front braced back -> a wide splay
      [4, 0], // back legs gathered under the dropped rump
      [4, 0],
    ];
    return rig;
  }

  if (pose === 'bones') {
    // The release: a play-bow heave. Rump snaps UP, head drops level, jaw
    // wide open, front legs planted apart. Exactly inverted from the tell.
    rig.headDY = 4;
    rig.mouth = 8;
    rig.rumpDY = -4;
    rig.earDX = -2;
    rig.legs = [
      [4, 0],
      [-4, 0],
      [-4, 0],
      [-4, 0],
    ];
    return rig;
  }

  // --- the celebration candidates (playtest 6, notes 6 and 7) --------------
  // Three ways for the dog to concede, paired with Bill the man's three in
  // the Artifact gallery. They are cheap because this rig is a parameter
  // block: a new pose is a branch here, not new geometry.

  if (pose === 'bow') {
    // A HELD play bow, and it has to stay distinct from 'bones', which is
    // already a play-bow heave. The heave is a jaw wide open and a rump
    // snapping up; this is deeper, quieter and going nowhere: elbows on the
    // floor, mouth shut, ear forward, soft eyes, tail going hard.
    rig.rumpDY = -8; // rump higher than the heave's -4
    rig.headDY = 8; // head lower than the heave's 4
    rig.earDX = 4; // ear forward, not pinned
    rig.brow = false; // soft, not smug
    rig.tailF = Math.floor(t * 14) % 2; // the fast happy wag from walkIn
    rig.legs = [
      [8, 8], // front legs stretched forward with the elbows down
      [8, 8],
      [-4, 0], // back legs still standing, which is what makes it a BOW
      [-4, 0],
    ];
    // Settles a whole pixel deeper on a slow flip so a held pose still breathes.
    rig.lift = Math.floor(t * 1.5) % 2 ? 2 : 0;
    return rig;
  }

  if (pose === 'applaud') {
    // Sitting up on his haunches with both front paws off the floor, patting
    // them together on the same 5 Hz beat Bill the man claps on. The pat is
    // the two front legs closing the gap between them, which at this scale
    // is the only way a dog can be seen to applaud.
    const clap = Math.floor(t * 5) % 2;
    rig.rumpDY = 8; // sitting down on it
    rig.chestUp = 8; // and up through the chest, which is what sitting looks like
    rig.headDY = -4;
    rig.snoutUp = 4; // nose up at her
    rig.mouth = clap ? 4 : 0; // a small pant on the beat
    rig.wideEye = true;
    rig.brow = false;
    rig.tailShift = 2; // he is sitting on most of it
    rig.legs = [
      [clap ? 8 : 12, 12], // near front paw, in and out
      [clap ? 8 : 4, 12], // far front paw, meeting it
      [-4, 0], // back legs folded under the sitting rump
      [-4, 0],
    ];
    return rig;
  }

  if (pose === 'lieDown') {
    // All the way down, head between the paws, looking up at her — the dog's
    // version of Bill's knee. Everything drops: the body sits on the floor,
    // so every leg is lifted almost out of sight and only the paws show.
    rig.rumpDY = 8;
    rig.headDY = 8;
    rig.headDX = 4; // chin out in front
    rig.earDX = -4; // ear back: this is deference, not alertness
    rig.brow = false;
    rig.tailF = Math.floor(t * 7) % 2; // a slower wag than the bow's
    rig.legs = [
      [8, 12], // paws forward, legs folded away under him
      [6, 12],
      [-4, 12],
      [-4, 12],
    ];
    return rig;
  }

  // idle - standing, smug, tail going.
  // Two-step breathing (0 or -2 px) keeps the lift on whole pixels, and the
  // top of the breath measures exactly the 58 px the box allows.
  rig.lift = Math.sin(t * 2) > 0 ? -2 : 0;
  rig.earDX = Math.sin(t * 2 - 1.1) > 0 ? -2 : 0; // ear sways a beat late
  rig.tailF = Math.floor(t * 9) % 2; // 4.5 wags a second
  rig.blink = t % 3.4 < 0.13;
  return rig;
}

/** One leg: an 8-wide column, plus a paw that juts one cell forward. */
function pushLeg(out: Rect[], x: number, spec: Leg): void {
  const dx = spec[0];
  const lift = spec[1];
  // Legs are drawn 24 tall but only the bottom 16 is ever visible - the top
  // 8 px hides inside the barrel, so a body lift can never open a seam.
  out.push([x + dx, -24, 8, 24 - lift]);
  out.push([x + dx, -4 - lift, 12, 4]);
}

function drawStanding(ctx: Ctx, pose: DogPose, t: number): void {
  const rig = standRig(pose, t);
  const L = rig.lift;
  const hx = rig.headDX;
  const hy = rig.headDY + L;
  const su = rig.snoutUp;

  // --- trunk: everything that rides the breathing lift ---------------------
  const trunk = [
    [-20, -36 - rig.chestUp + L, 24, 4 + rig.chestUp], // shoulder row, inset = rounded back
    [-24, -32 + L, 32, 16], // barrel
    [-28, -32 + rig.rumpDY + L, 16, 20], // haunch / rear mass
    [4, -32 + L, 12, 16], // chest, carrying the head
  ];

  // Tail: two whole-cell wag positions.
  const tsx = rig.tailShift;
  if (rig.tailF === 0) {
    trunk.push([-32 + tsx, -40 + rig.rumpDY + L, 8, 8]);
    trunk.push([-32 + tsx, -48 + rig.rumpDY + L, 8, 8]);
  } else {
    trunk.push([-28, -40 + rig.rumpDY + L, 8, 8]);
    trunk.push([-24, -48 + rig.rumpDY + L, 8, 8]);
  }

  // --- head group ----------------------------------------------------------
  trunk.push([4 + hx, -48 + hy, 16, 4]); // skull cap, inset = rounded skull
  trunk.push([hx, -44 + hy, 24, 16]); // head block
  trunk.push([24 + hx, -44 - su + hy, 8, 8]); // muzzle
  trunk.push([24 + hx, -36 - su + rig.mouth + hy, 8, 4]); // lower jaw, dropped by `mouth`

  // Perky ear. It is the only thing in the whole dog above y = -48, so it is
  // a clean spike on the outline - which is exactly why it is white and part
  // of the trunk union rather than a grey panel stuck on the face.
  const ex = hx + rig.earDX;
  const ey = hy + rig.earDY;
  trunk.push([ex, -52 + ey, 12, 8]); // ear base, reaches down to the skull
  trunk.push([ex, -56 + ey, 8, 4]); // tip, leaning back

  // --- legs ----------------------------------------------------------------
  const near: Rect[] = [];
  const far: Rect[] = [];
  pushLeg(near, 8, rig.legs[0]);
  pushLeg(far, 4, rig.legs[1]);
  pushLeg(near, -20, rig.legs[2]);
  pushLeg(far, -24, rig.legs[3]);

  // Pass 1: one ink outline around the union of everything.
  ctx.fillStyle = INK;
  paintInto(ctx, far, 2);
  paintInto(ctx, near, 2);
  paintInto(ctx, trunk, 2);

  // Pass 2: fills. Far legs first, so the near pair reads in front of them.
  paint(ctx, far, SHADE, 0);
  paint(ctx, near, WHITE, 0);
  paint(ctx, trunk, WHITE, 0);

  // Grey: underbelly, rear curve, and the fold inside the ear. One cell of
  // shade in each spot is all the form this scale can carry.
  paint(
    ctx,
    [
      [-20, -20 + L, 24, 4], // underbelly
      [-28, -20 + rig.rumpDY + L, 8, 8], // back of the haunch
      [ex + 4, -52 + ey, 4, 8], // inside the ear
    ],
    SHADE,
    0,
  );

  // 2 px ink columns splitting each near leg from the far one behind it.
  paint(
    ctx,
    [
      [8 + rig.legs[0][0], -16, 2, 16 - rig.legs[0][1]],
      [-20 + rig.legs[2][0], -16, 2, 16 - rig.legs[2][1]],
    ],
    INK,
    0,
  );

  // --- collar: the one warm colour, and the visual link to Uncle Bill -------
  // It sits on the neck, so it stays with the body when the head moves.
  paint(
    ctx,
    [
      [0, -28 + L, 16, 8],
      [8, -20 + L, 4, 4], // tag
    ],
    ORANGE,
    0,
  );

  // --- face ----------------------------------------------------------------
  const face: Rect[] = [];
  if (rig.blink) {
    face.push([16 + hx, -40 + hy, 4, 2]); // shut eye: a 2 px line
  } else if (rig.wideEye) {
    face.push([16 + hx, -44 + hy, 4, 8]); // tall eye = alarmed / concentrating
  } else {
    face.push([16 + hx, -42 + hy, 4, 4]);
  }
  if (rig.brow && !rig.blink) {
    // The smug lid. 2 px tall, juts forward over the eye. Delete this one
    // rectangle and he stops being smug - it is doing all the work.
    face.push([16 + hx, -44 + hy, 8, 2]);
  }
  face.push([28 + hx, -44 - su + hy, 4, 4]); // nose
  if (rig.mouth > 0) face.push([24 + hx, -36 - su + hy, 8, rig.mouth]); // open mouth
  paint(ctx, face, INK, 0);

  // --- attack effects. These deliberately reach outside the 64 x 58 box, the
  // same way the spitter's shots do; the body silhouette stays inside it.
  if (pose === 'bonesTell') drawTellSparks(ctx, 34 + hx, -40 - su + hy, t);
  if (pose === 'bones') drawBones(ctx, 34 + hx, -32 + hy, t);
}

/**
 * Three bone chips spiralling into the open mouth while he winds up. Driven
 * off a 0.5 s loop of the free-running clock, so the tell looks alive from
 * whatever t the fight hands us.
 */
function drawTellSparks(ctx: Ctx, mx: number, my: number, t: number): void {
  const u = (t * 2) % 1;
  const cells: Rect[] = [];
  for (let i = 0; i < 3; i++) {
    const a = -2.4 + i * 0.8 + u * 1.5;
    const r = 20 - u * 14;
    cells.push([snap(mx + Math.cos(a) * r), snap(my + Math.sin(a) * r), 4, 4]);
  }
  paint(ctx, cells, POKE, 2);
  paint(ctx, cells, BONE, 0);
}

/**
 * The 3-bone spread leaving his mouth. Bones stay axis-aligned - a rotated
 * bone would break the pixel grid, and a flat bone is the funnier read anyway.
 * They fan apart vertically as they travel. The rim is pokeGreen because in
 * this trainer green already means "you can destroy this with the nail".
 */
function drawBones(ctx: Ctx, mx: number, my: number, t: number): void {
  const u = (t * 1.6) % 1;
  const d = 4 + 24 * u;
  const spread = 16 + 14 * u;
  for (let i = -1; i <= 1; i++) {
    const bx = snap(mx + d);
    const by = snap(my + i * spread);
    const cells = [
      [bx, by - 2, 16, 4], // shaft
      [bx - 4, by - 6, 4, 4],
      [bx - 4, by + 2, 4, 4], // rear knobs
      [bx + 16, by - 6, 4, 4],
      [bx + 16, by + 2, 4, 4], // front knobs
    ];
    paint(ctx, cells, POKE, 2);
    paint(ctx, cells, BONE, 0);
  }
}

/* ========================================================================== *
 * ROLL TELL: curling up. A transitional lump - no longer a dog shape, not yet
 * a ball, with the head visibly tucked in at the front and the tail curled
 * over the top. Two squash frames alternate at 3.5 Hz (tall-and-narrow, then
 * short-and-wide) with a 2 px shake on top, so he visibly revs before he goes.
 * ========================================================================== */

// Stacked rows, bottom first: [x, y, w, h].
const TELL_A: Rect[] = [
  [-12, -4, 24, 4],
  [-20, -12, 40, 8],
  [-20, -24, 40, 12],
  [-20, -36, 40, 12],
  [-16, -44, 32, 8],
  [-8, -48, 16, 4],
];
const TELL_B: Rect[] = [
  [-16, -4, 32, 4],
  [-24, -12, 48, 8],
  [-24, -24, 48, 12],
  [-20, -32, 40, 8],
  [-16, -36, 32, 4],
  [-8, -40, 16, 4],
];

function drawRollTell(ctx: Ctx, t: number): void {
  const b = Math.floor(t * 7) % 2 === 1;
  const shake = Math.floor(t * 16) % 2 === 0 ? 2 : -2;

  const lump: Rect[] = [];
  const rows = b ? TELL_B : TELL_A;
  for (const [x, y, w, h] of rows) {
    lump.push([x + shake, y, w, h]);
  }
  lump.push(b ? [-16 + shake, -44, 12, 4] : [-20 + shake, -52, 12, 4]); // tail curled on top
  lump.push(b ? [20 + shake, -8, 8, 8] : [20 + shake, -8, 8, 8]); // one paw still out

  // The tucked head keeps its own outline, drawn on top of the lump, so it
  // stays legible instead of melting into the body.
  const head = b ? [[12 + shake, -24, 20, 16]] : [[12 + shake, -28, 20, 16]];
  const ear = b ? [[8 + shake, -32, 12, 8]] : [[8 + shake, -36, 12, 8]];

  ctx.fillStyle = INK;
  paintInto(ctx, lump, 2);
  paintInto(ctx, ear, 2);
  paint(ctx, lump, WHITE, 0);

  // Shaded underside so the lump reads as round rather than as a box.
  paint(ctx, [[-12 + shake, -8, 24, 4]], SHADE, 0);

  paint(ctx, ear, INK, 2);
  paint(ctx, ear, SHADE, 0);
  paint(ctx, head, INK, 2);
  paint(ctx, head, WHITE, 0);

  // Face and collar, squeezed into the tuck.
  paint(
    ctx,
    [
      b ? [20 + shake, -20, 4, 4] : [20 + shake, -24, 4, 4], // eye
      b ? [28 + shake, -16, 4, 4] : [28 + shake, -20, 4, 4], // nose
    ],
    INK,
    0,
  );
  paint(ctx, [b ? [12 + shake, -12, 12, 4] : [12 + shake, -16, 12, 4]], ORANGE, 0);

  // A cell of grit kicked up behind him while he revs.
  paint(ctx, [b ? [-32, -4, 8, 4] : [-28, -8, 8, 4]], SHADE, 0);
}

/* ========================================================================== *
 * ROLL: the ball.
 *
 * The trick that makes this satisfying instead of "a white circle": the rim
 * never rotates - a rotating pixel circle boils and looks broken - but every
 * feature ON him orbits, snapped back to the 4 px grid each frame. The paws
 * sit OUTSIDE the rim, so the outline keeps getting broken by little bumps
 * travelling round it. That is what says "a dog rolled up" rather than "an
 * orb". The underside keeps a fixed grey contact shadow, which is what makes
 * the eye read the tumble as rolling instead of spinning in place.
 * ========================================================================== */

/** Half-width in CELLS of each row of a 12-cell pixel circle, bottom row first. */
const BALL = [2, 4, 5, 5, 6, 6, 6, 6, 5, 5, 4, 2];
const BALL_CY = -24;

/** Place a w x h cell with its centre at angle `a`, radius `r`, grid-snapped. */
function orbit(a: number, r: number, w: number, h: number): Rect {
  return [snap(Math.cos(a) * r - w / 2), snap(BALL_CY + Math.sin(a) * r - h / 2), w, h];
}

function drawRoll(ctx: Ctx, t: number): void {
  // Clockwise in canvas coords (y down) = rolling toward +x. The facing flip
  // handles the other direction for free, because the context is mirrored.
  const a = t * 8;

  const rows: Rect[] = [];
  for (let r = 0; r < BALL.length; r++) {
    const hw = pick(BALL, r) * CELL;
    rows.push([-hw, -(r + 1) * CELL, hw * 2, CELL]);
  }

  paint(ctx, rows, INK, 2);
  paint(ctx, rows, WHITE, 0);

  // Fixed underside shading - does NOT rotate. Ground contact, so the tumble
  // above it reads as travel.
  paint(
    ctx,
    [
      [-8, -4, 16, 4],
      [-20, -8, 40, 4],
      [-24, -12, 20, 4],
    ],
    SHADE,
    0,
  );

  // Four paws on the rim, 90 degrees apart, poking 6 px past it, plus the tail
  // tuft between two of them. Any nub that would punch through the floor is
  // dropped instead of drawn - which happens to look exactly like a paw
  // meeting the ground.
  const nubs: Rect[] = [];
  for (let i = 0; i < 4; i++) {
    const p = orbit(a + i * (Math.PI / 2), 26, 8, 8);
    if (p[1] + p[3] <= -4) nubs.push(p);
  }
  const tail = orbit(a + 3.9, 26, 8, 8);
  if (tail[1] + tail[3] <= -4) nubs.push(tail);
  paint(ctx, nubs, INK, 2);
  paint(ctx, nubs, WHITE, 0);

  // Ear, tumbling with him.
  const ear = [orbit(a + 2.3, 22, 12, 8)];
  paint(ctx, ear, INK, 2);
  paint(ctx, ear, SHADE, 0);

  // Collar: three cells strung along a short arc so it reads as a band.
  paint(
    ctx,
    [orbit(a + 2.9, 18, 8, 4), orbit(a + 3.3, 18, 8, 4), orbit(a + 3.7, 18, 8, 4)],
    ORANGE,
    0,
  );

  // Face. Eye and muzzle orbit together so it stays a face the whole way
  // round - the muzzle is the wider cell, the eye the square one behind it.
  paint(ctx, [orbit(a + 0.3, 18, 8, 4), orbit(a + 0.95, 13, 4, 4)], INK, 0);
}

/* ========================================================================== */

/**
 * Paint Bill the dog, feet-anchored at `feet`.
 *
 * `t` is a free-running clock in seconds; like the man, every tell is a
 * two-frame vibration rather than a progress bar.
 */
export function paintBillDog(
  ctx: Ctx,
  feet: Vec2,
  pose: BillDogPose,
  t: number,
  facing: number,
): void {
  ctx.save();
  // Integer translate keeps every cell edge on a device pixel; the mirror
  // handles facing, so all the geometry above is written facing +x.
  ctx.translate(Math.round(feet.x), Math.round(feet.y));
  ctx.scale(facing < 0 ? -1 : 1, 1);

  if (pose === 'roll') drawRoll(ctx, t);
  else if (pose === 'rollTell') drawRollTell(ctx, t);
  else drawStanding(ctx, pose, t);

  ctx.restore();
}
