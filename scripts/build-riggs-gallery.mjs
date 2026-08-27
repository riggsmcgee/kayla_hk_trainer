/**
 * Build the 8-bit Riggs portfolio as one self-contained HTML page.
 *
 * The same rule that makes `build-bill-gallery.mjs` trustworthy applies here
 * and is the whole reason this file exists rather than a hand-drawn mockup:
 * the page is COMPILED FROM THE SHIPPED `.ts`, with the repo's own esbuild.
 * Session 8's gallery was a fork with nothing keeping it in sync; this one
 * imports `web/src/engine/riggs/*` directly, so choosing a candidate here is
 * choosing a painter the game already contains.
 *
 * Two things it does that the Bill gallery did not need:
 *
 * 1. **It discovers the candidates.** Three agents wrote three files in
 *    parallel and any one of them could have failed. Globbing rather than
 *    hard-coding means a missing candidate costs one card, not the page.
 * 2. **It asks two questions at once.** The drawing and the bow tie's yellow
 *    are separate decisions with separate shortlists, and the tie is passed
 *    into the painters as a parameter precisely so this page can vary it
 *    without touching any of them.
 *
 * Usage:  node scripts/build-riggs-gallery.mjs [outfile]
 * Default outfile: .proactive/scratch/riggs-gallery.html
 */
import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const riggsDir = resolve(repoRoot, 'web/src/engine/riggs');
const outFile = resolve(repoRoot, process.argv[2] ?? '.proactive/scratch/riggs-gallery.html');

/**
 * The bow-tie shortlist, as data rather than as code, so the colours can be
 * replaced without touching the page. `punishGold #e8c76a` is ratified OUT and
 * must never appear here: the Reading Enemies lesson teaches that exact hex as
 * "the punish window", and a tie in it is the picture telling her to hit him.
 */
const TIE_FILE = resolve(here, 'riggs-tie-candidates.json');

/** Used only if the shortlist file is missing, so the page always builds. */
const FALLBACK_TIES = [
  { hex: '#c8901f', name: 'Brass', why: 'placeholder' },
  { hex: '#b8860b', name: 'Old Gold', why: 'placeholder' },
  { hex: '#d4a017', name: 'Mustard', why: 'placeholder' },
];

async function loadTies() {
  try {
    const parsed = JSON.parse(await readFile(TIE_FILE, 'utf8'));
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : FALLBACK_TIES;
  } catch {
    return FALLBACK_TIES;
  }
}

/**
 * Find every candidate painter on disk.
 *
 * The contract each one honours: a file `riggs<X>.ts` exporting
 * `paintRiggs<X>(ctx, origin, t, tie)`. The letter is how the user refers back
 * to one — "I pick B" — not a running order.
 */
async function discoverCandidates() {
  let entries;
  try {
    entries = await readdir(riggsDir);
  } catch {
    throw new Error(
      `No candidates: ${riggsDir} does not exist yet. The painters are written before the gallery.`,
    );
  }
  const found = entries
    .filter((f) => /^riggs[A-Z]\.ts$/.test(f))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
  if (found.length === 0) throw new Error(`No riggs<X>.ts candidates found in ${riggsDir}`);
  return found.map((module) => ({ module, letter: module.replace('riggs', '') }));
}

/**
 * The entry point, generated rather than committed.
 *
 * Committing it would mean a file that has to be edited every time a candidate
 * is added or cut, and the whole point of discovery is that nobody has to
 * remember. esbuild takes it on stdin with a `resolveDir`, so the relative
 * imports resolve exactly as a committed file's would.
 */
function entrySource(candidates, ties) {
  const imports = candidates
    .map((c) => `import { paintRiggs${c.letter} } from '../web/src/engine/riggs/${c.module}';`)
    .join('\n');
  const table = candidates
    .map((c) => `  { letter: '${c.letter}', paint: paintRiggs${c.letter} },`)
    .join('\n');

  return `${imports}

const CANDIDATES = [
${table}
];

const TIES = ${JSON.stringify(ties)};

/** The arena's own ground and floor, so the cards look like the game. */
const BACKDROP = '#070912';

/**
 * He is ~496 px tall and ~448 wide, anchored at the centre of his waist cut.
 * The card gives him a cell of margin on every side.
 */
const CARD = { width: 480, height: 528 };
const ORIGIN = { x: 240, y: 512 };

/** The swatch cards are the same drawing at half scale — small, but honest. */
const CHIP = { width: 240, height: 264 };
const CHIP_ORIGIN = { x: 120, y: 256 };

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function paintInto(ctx, paint, origin, size, t, tie, scale) {
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.save();
  if (scale !== 1) {
    ctx.scale(scale, scale);
    paint(ctx, { x: origin.x / scale, y: origin.y / scale }, t, tie);
  } else {
    paint(ctx, origin, t, tie);
  }
  ctx.restore();
}

/**
 * Drive one canvas. Every card reads the same wall clock, so the candidates
 * play in step and a difference on screen is a difference in the DRAWING
 * rather than a difference in where its loop happens to be.
 */
function drive(ctx, paint, origin, size, tie, scale) {
  if (reduced) {
    paintInto(ctx, paint, origin, size, 0.5, tie, scale);
    return;
  }
  const frame = (nowMs) => {
    paintInto(ctx, paint, origin, size, nowMs / 1000, tie, scale);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function canvasEl(size, label) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  return canvas;
}

/** The default tie for the three big cards: the first of the shortlist. */
const DEFAULT_TIE = TIES[0] ? TIES[0].hex : '#c8901f';

const gallery = document.querySelector('#gallery');
for (const c of CANDIDATES) {
  const figure = document.createElement('figure');
  figure.className = 'card';
  const canvas = canvasEl(CARD, 'Riggs, candidate ' + c.letter + ', animating');
  figure.append(canvas);
  const caption = document.createElement('figcaption');
  const h2 = document.createElement('h2');
  const letter = document.createElement('span');
  letter.className = 'letter';
  letter.textContent = c.letter;
  h2.append(letter, document.createTextNode('Candidate ' + c.letter));
  caption.append(h2);
  figure.append(caption);
  gallery.append(figure);
  const ctx = canvas.getContext('2d');
  if (ctx) drive(ctx, c.paint, ORIGIN, CARD, DEFAULT_TIE, 1);
}

/**
 * The tie row. One candidate, drawn once per colour, plus a solid chip of the
 * colour itself — the drawing tells you how it sits against him, the chip
 * tells you what the colour actually is.
 */
const first = CANDIDATES[0];
const ties = document.querySelector('#ties');
if (first && ties) {
  for (const tie of TIES) {
    const figure = document.createElement('figure');
    figure.className = 'swatch';
    const canvas = canvasEl(CHIP, 'Riggs wearing the ' + tie.name + ' bow tie');
    figure.append(canvas);
    const caption = document.createElement('figcaption');
    const swatchRow = document.createElement('div');
    swatchRow.className = 'chip-row';
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = tie.hex;
    const name = document.createElement('strong');
    name.textContent = tie.name;
    const hex = document.createElement('code');
    hex.textContent = tie.hex;
    swatchRow.append(chip, name, hex);
    const why = document.createElement('p');
    why.textContent = tie.why || '';
    caption.append(swatchRow, why);
    figure.append(caption);
    ties.append(figure);
    const ctx = canvas.getContext('2d');
    if (ctx) drive(ctx, first.paint, CHIP_ORIGIN, CHIP, tie.hex, 0.5);
  }
}
`;
}

async function bundleScript(candidates, ties) {
  const result = await build({
    stdin: {
      contents: entrySource(candidates, ties),
      resolveDir: here,
      sourcefile: 'riggs-gallery-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
    write: false,
    // Readable rather than minified: the point of the page is that the user
    // (and the next agent) can check it really is the shipped painter.
    minify: false,
  });
  const [output] = result.outputFiles;
  if (!output) throw new Error('esbuild produced no output');
  return output.text;
}

/**
 * The page. Deliberately dependency-free and inline apart from the one font,
 * so it survives being opened from a file:// path or published as an Artifact.
 * The palette is the arena's own, exactly as the Bill gallery's is, so the two
 * portfolios look like the same object.
 */
function page(script, candidates, ties) {
  return `<title>Eight-Bit Riggs</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap"
>
<style>
  :root {
    --bg: #f6f4ef;
    --panel: #fffefb;
    --ink: #14171f;
    --dim: #575d6d;
    --line: #dbd7cc;
    --accent: #b45c0c;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --bg: #0a0d16;
      --panel: #111624;
      --ink: #e9e4d5;
      --dim: #949bb0;
      --line: #232a3c;
      --accent: #f08a2c;
    }
  }
  :root[data-theme='dark'] {
    --bg: #0a0d16;
    --panel: #111624;
    --ink: #e9e4d5;
    --dim: #949bb0;
    --line: #232a3c;
    --accent: #f08a2c;
  }

  body {
    margin: 0;
    padding: 2.5rem 1.25rem 4rem;
    background: var(--bg);
    color: var(--ink);
    font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .wrap { max-width: 68rem; margin: 0 auto; display: grid; gap: 2.25rem; }

  /*
    One display face, and it is the subject's own: Riggs is drawn on a 16 px
    grid, so the page's name is set in pixels too. It appears on the headings
    and the letters and nowhere near running text.
  */
  h1 {
    font-family: 'Silkscreen', ui-monospace, 'Courier New', monospace;
    font-size: clamp(1.35rem, 4vw, 2rem);
    font-weight: 700;
    line-height: 1.25;
    text-wrap: balance;
    margin: 0 0 0.6rem;
  }
  h2.section {
    font-family: 'Silkscreen', ui-monospace, 'Courier New', monospace;
    font-size: 1.05rem;
    margin: 0 0 0.35rem;
  }
  .lede { color: var(--dim); max-width: 64ch; margin: 0; }

  #gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: 1.25rem;
    align-items: start;
  }
  #ties {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .card, .swatch {
    margin: 0;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
  }
  .card canvas, .swatch canvas {
    display: block;
    width: 100%;
    height: auto;
    /* He is a pixel drawing; letting the browser smooth him is the one thing
       that would misrepresent what is being reviewed. */
    image-rendering: pixelated;
  }
  .card figcaption { padding: 0.9rem 1.1rem 1.1rem; display: grid; gap: 0.45rem; }
  .swatch figcaption { padding: 0.7rem 0.8rem 0.9rem; display: grid; gap: 0.4rem; }
  .card h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }
  .letter {
    font-family: 'Silkscreen', ui-monospace, 'Courier New', monospace;
    color: var(--accent);
    font-size: 0.95rem;
  }
  .card p, .swatch p { margin: 0; color: var(--dim); font-size: 0.88rem; }
  .chip-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .chip {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 3px;
    border: 1px solid var(--line);
    flex: none;
  }
  .swatch strong { font-size: 0.9rem; }

  .ask { border-left: 3px solid var(--accent); padding-left: 1.1rem; max-width: 64ch; }
  .ask h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  .ask p { margin: 0 0 0.5rem; color: var(--dim); }
  .ask ol { margin: 0.6rem 0 0; padding-left: 1.2rem; color: var(--dim); }
  .ask li { margin-bottom: 0.3rem; }

  footer {
    border-top: 1px solid var(--line);
    padding-top: 1.1rem;
    color: var(--dim);
    font-size: 0.85rem;
    max-width: 64ch;
  }
  code { font-family: ui-monospace, 'Courier New', monospace; font-size: 0.85em; }
</style>
<div class="wrap">
  <header>
    <h1>Eight-bit Riggs</h1>
    <p class="lede">
      The last screen of the dojo. Kayla has just beaten the Two Bills, the cast has knelt and
      applauded, and she presses forward one more time &mdash; and you are there to tell her what she
      did. ${candidates.length} ways to draw you, looping in step, every one of them drawn by a
      painter the game itself would use. Below them, the bow tie&rsquo;s yellow, which is a colour to
      see rather than to name.
    </p>
  </header>

  <section>
    <h2 class="section">The drawing</h2>
    <div id="gallery"></div>
  </section>

  <section>
    <h2 class="section">The bow tie</h2>
    <p class="lede">
      Same drawing, ${ties.length} yellows. <code>punishGold #e8c76a</code> is deliberately not among
      them: the Reading Enemies lesson teaches that exact hex as &ldquo;the punish window&rdquo; and
      it is every forward button on the site, so a tie in it is the picture telling her to hit you.
    </p>
    <div id="ties"></div>
  </section>

  <div class="ask">
    <h2>While this page is still open</h2>
    <p>
      The last step of this project&rsquo;s portfolio process &mdash; measuring what the winner shares
      with the ones that nearly won &mdash; has now failed to run three times, every time because the
      near-misses could not be recalled after the fact. So, in this order:
    </p>
    <ol>
      <li>Which drawing is it?</li>
      <li>Which came second, and what did it nearly have?</li>
      <li>What do those two share that the third does not?</li>
      <li>Which yellow &mdash; and is it doing the job the foam finger does for Bill?</li>
    </ol>
  </div>

  <footer>
    Built by <code>node scripts/build-riggs-gallery.mjs</code> from
    <code>web/src/engine/riggs/*.ts</code>. Nothing on this page is a mockup: every figure is the
    shipped painter, compiled with the repo&rsquo;s own esbuild, so picking one is picking code that
    already exists.
  </footer>
</div>
<script>
${script}
</script>
`;
}

const candidates = await discoverCandidates();
const ties = await loadTies();
const script = await bundleScript(candidates, ties);
const html = page(script, candidates, ties);
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, html, 'utf8');
console.log(
  `Wrote ${outFile} — ${candidates.length} candidate(s) [${candidates
    .map((c) => c.letter)
    .join(', ')}], ${ties.length} tie colour(s), ${(html.length / 1024).toFixed(1)} KB`,
);
