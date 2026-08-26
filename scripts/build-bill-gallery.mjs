/**
 * Build the Bills' celebration portfolio as one self-contained HTML page.
 *
 * Why this exists (playtest 6, note 6): reviewing ONE candidate celebration
 * inside the running game costs 95.3 s of flawless play — 2.8 s of Bill's
 * entrance, 2.5 s of the dog's card, and 90 s of not being touched — and only
 * one variant can be active at a time, so two candidates can never be seen
 * side by side at any price. On this page all three loop simultaneously at
 * zero seconds of play.
 *
 * The rule that makes it trustworthy: the page is COMPILED FROM THE SHIPPED
 * `.ts`, with the repo's own esbuild. Session 8's gallery was a fork with
 * nothing keeping it in sync and its sources were never committed; this
 * script is committed and it imports `web/src/engine/renderBillMan.ts`
 * directly, so the page cannot drift from the game.
 *
 * Usage:  node scripts/build-bill-gallery.mjs [outfile]
 * Default outfile: .proactive/scratch/bill-gallery.html
 */
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const entry = resolve(here, 'bill-gallery-entry.ts');
const outFile = resolve(repoRoot, process.argv[2] ?? '.proactive/scratch/bill-gallery.html');

/** Bundle the entry and its one engine import down to a single IIFE. */
async function bundleScript() {
  const result = await build({
    entryPoints: [entry],
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
 * The page. Deliberately dependency-free and inline: it has to survive being
 * opened from a file:// path, mailed, or published as an Artifact.
 */
function page(script) {
  return `<title>Bill Concedes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap"
>
<style>
  /*
    The palette is the arena's own: #070912 ground, #161b2e floor, and the
    foam finger's #f08a2c as the single accent. The neutrals are pulled a few
    degrees toward that navy rather than being grey, so the page and the
    cards look like the same object.

    Light is defined on bare :root, dark twice over — once for a system
    preference that has stamped nothing, once for an explicit choice.
  */
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
  .wrap { max-width: 60rem; margin: 0 auto; display: grid; gap: 2rem; }

  /*
    One display face, and it is the subject's own: Bill is drawn on an 8 px
    grid, so the page's name is set in pixels too. It appears exactly twice —
    the title and the three letters — and nowhere near running text.
  */
  h1 {
    font-family: 'Silkscreen', ui-monospace, 'Courier New', monospace;
    font-size: clamp(1.35rem, 4vw, 2rem);
    font-weight: 700;
    line-height: 1.25;
    text-wrap: balance;
    margin: 0 0 0.6rem;
  }
  .lede { color: var(--dim); max-width: 62ch; margin: 0; }

  #gallery {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1.25rem;
    align-items: start;
  }
  .card {
    margin: 0;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    overflow: hidden;
  }
  .card canvas {
    display: block;
    width: 100%;
    height: auto;
    /* He is a pixel drawing; letting the browser smooth him is the one thing
       that would misrepresent what is being reviewed. */
    image-rendering: pixelated;
  }
  .card figcaption { padding: 1rem 1.1rem 1.2rem; display: grid; gap: 0.45rem; }
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
  .card p { margin: 0; color: var(--dim); font-size: 0.92rem; }

  .ask { border-left: 3px solid var(--accent); padding-left: 1.1rem; max-width: 62ch; }
  .ask h2 { font-size: 1rem; margin: 0 0 0.5rem; }
  .ask p { margin: 0; color: var(--dim); }
  .ask ol { margin: 0.6rem 0 0; padding-left: 1.2rem; color: var(--dim); }
  .ask li { margin-bottom: 0.3rem; }

  footer {
    border-top: 1px solid var(--line);
    padding-top: 1.1rem;
    color: var(--dim);
    font-size: 0.85rem;
    max-width: 62ch;
  }
  code { font-family: ui-monospace, 'Courier New', monospace; font-size: 0.85em; }
</style>
<div class="wrap">
  <header>
    <h1>Bill concedes</h1>
    <p class="lede">
      Kayla has just survived 1:30 without being touched, so the fight is over rather than paused.
      This is the beat where Bill the man stops being a wall — three ways he could do it, looping in
      step. Every one of them is drawn by the painter the game itself uses, not a copy of it.
    </p>
  </header>

  <div id="gallery"></div>

  <div class="ask">
    <h2>While this page is still open</h2>
    <p>
      The last step of this project's portfolio process — measuring what the winner shares with the
      ones that nearly won — has now failed to run twice, both times because the near-misses could
      not be recalled after the fact. So, in this order:
    </p>
    <ol>
      <li>Which one is it?</li>
      <li>Which one came second, and what did it nearly have?</li>
      <li>What do those two share that the third one does not?</li>
    </ol>
  </div>

  <footer>
    Built by <code>node scripts/build-bill-gallery.mjs</code> from
    <code>web/src/engine/renderBillMan.ts</code>. Bill the dog's three are not drawn yet — they are
    the next slice, written up in PLAN.md. Rebuild and republish whenever a pose changes.
  </footer>
</div>
<script>${script}</script>
`;
}

const script = await bundleScript();
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, page(script), 'utf8');
console.log(
  `bill gallery → ${outFile} (${(script.length / 1024).toFixed(1)} kB of bundled painter)`,
);
