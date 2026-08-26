/**
 * The gallery's entry point. It imports the SHIPPED painter and does nothing
 * else — no copied geometry, no ported constants. If a pose changes in
 * `renderBillMan.ts`, rebuilding the gallery is the only step needed for the
 * page to change with it.
 *
 * `renderBillMan.ts` is portable by construction: one type-only import, and
 * six canvas members between all its poses (fillRect, fillStyle, save,
 * restore, scale, translate). Nothing here reaches into the engine further
 * than that.
 */
import { paintBillMan, type BillPose } from '../web/src/engine/renderBillMan';

/** One candidate: the pose to draw, and what to call it on the page. */
interface Candidate {
  pose: BillPose;
  /** The letter is how he refers back to one — "I pick B" — not a running order. */
  letter: string;
  title: string;
  /** What this one is arguing for — the thing the user is actually choosing between. */
  claim: string;
  /**
   * The one frame that represents the loop, for readers who have asked their
   * system for reduced motion. Three canvases looping is exactly the kind of
   * ambient movement that setting exists to turn off.
   */
  stillAt: number;
}

const CANDIDATES: readonly Candidate[] = [
  {
    pose: 'bow',
    letter: 'A',
    stillAt: 0.7, // the deeper of the two settle frames
    title: 'The Bow',
    claim:
      'He breaks at the waist and sweeps the foam finger along the floor. The silhouette is an L on its side — the opposite of every fighting pose he has, all of which are tall or wide. Reads as ceremony.',
  },
  {
    pose: 'applaud',
    letter: 'B',
    stillAt: 0.1, // hands together, which is the frame that reads as a clap
    title: 'The Applause',
    claim:
      'He stays standing and claps, the mitt meeting his bare hand at 5 Hz. The only one of the three where he is still looking at her the whole time. Reads as delight rather than deference.',
  },
  {
    pose: 'kneel',
    letter: 'C',
    stillAt: 0,
    title: 'The Knee',
    claim:
      'Down on the back knee, foam finger held straight up to her, face turned up because she is the one standing now. Loses a quarter of his height. Reads as handing over the belt.',
  },
];

/** Canvas size per card. He is 160 px tall and the finger can clear his crown. */
const CARD = { width: 260, height: 300 };
/** Where his feet sit inside a card, leaving room above for a raised finger. */
const FEET = { x: 120, y: 268 };

/** The arena's own ground and floor, so the cards look like the game. */
const BACKDROP = '#070912';
const FLOOR = '#161b2e';

function buildCard(candidate: Candidate): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'card';

  const canvas = document.createElement('canvas');
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  canvas.setAttribute('aria-label', `${candidate.title}, animating`);
  figure.append(canvas);

  const caption = document.createElement('figcaption');
  const h2 = document.createElement('h2');
  const letter = document.createElement('span');
  letter.className = 'letter';
  letter.textContent = candidate.letter;
  h2.append(letter, document.createTextNode(candidate.title));
  const p = document.createElement('p');
  p.textContent = candidate.claim;
  caption.append(h2, p);
  figure.append(caption);

  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, candidate);
  return figure;
}

/** One frame of a card: the backdrop, the floor line, and Bill on it. */
function paintCard(ctx: CanvasRenderingContext2D, pose: BillPose, t: number): void {
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  // The floor he is standing on, so a pose that loses height is visibly
  // losing it rather than just sitting lower in the card.
  ctx.fillStyle = FLOOR;
  ctx.fillRect(0, FEET.y, CARD.width, CARD.height - FEET.y);
  paintBillMan(ctx, FEET, pose, t, -1);
}

/**
 * Drive one card. Every candidate reads the same wall clock, so the three
 * play in step and a difference on screen is a difference in the pose rather
 * than a difference in where their loops happen to be.
 */
function draw(ctx: CanvasRenderingContext2D, candidate: Candidate): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    paintCard(ctx, candidate.pose, candidate.stillAt);
    return;
  }
  const frame = (nowMs: number): void => {
    paintCard(ctx, candidate.pose, nowMs / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const gallery = document.querySelector('#gallery');
if (gallery) for (const candidate of CANDIDATES) gallery.append(buildCard(candidate));
