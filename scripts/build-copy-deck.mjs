/**
 * Build the copy deck: every named string in the project, on one page.
 *
 * Playtest 7, note 2 — "I want an easy way to go through and click the site and
 * easily adjust and change small bits of text here and there... Whenever I say
 * 'all the writing,' I mean all of it, not just the static writing."
 *
 * The ratified rule, and the whole reason this is a script rather than a
 * document: **the deck is GENERATED from the modules, not transcribed.** A
 * transcription silently misses a string the day someone adds one, and drifts
 * from the game the day someone edits one. This reads `web/src/copy/*.ts` every
 * time it runs, so it cannot.
 *
 * Two things it does that a naive dump would not:
 *
 * 1. **Interpolated strings are CALLED, not printed.** Nine of the project's 42
 *    canvas strings substitute a value in, and the copy modules hold those as
 *    functions for exactly this reason. Showing `Press {key}` would be showing
 *    something the game never draws, so each function is invoked with worked
 *    sample arguments and the real result is shown.
 * 2. **Each entry carries its own doc comment**, which is where the modules
 *    already record what makes the string appear and why it is worded that way.
 *    That is the "where it appears, what makes it appear" the contract asked
 *    for, and it is already written — it just had to be surfaced.
 *
 * Usage:  node scripts/build-copy-deck.mjs [outfile]
 * Default outfile: .proactive/scratch/copy-deck.html
 */
import { build } from 'esbuild';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const copyDir = resolve(repoRoot, 'web/src/copy');
const outFile = resolve(repoRoot, process.argv[2] ?? '.proactive/scratch/copy-deck.html');
const tmpBundle = resolve(repoRoot, '.proactive/scratch/copy-bundle.mjs');

/** What each module is called on the page, and what it covers. */
const SECTIONS = {
  fight: {
    title: 'The Two Bills',
    blurb:
      'Everything the boss fight draws on the canvas — the clock, the cards, the shouts, the fail screen. Seventeen of the project’s forty-two canvas strings live here.',
  },
  ending: {
    title: 'The ending',
    blurb:
      'The twenty seconds after 1:30: the summons, the silence, the celebration, and the prompt that lets her leave.',
  },
  theEnd: {
    title: 'The last screen',
    blurb:
      'Everything on #/the-end — the four messages, the cast list, and the way back to the map. The most personal writing in the project, and the most likely to be rewritten.',
  },
};

/**
 * Worked sample arguments, by how many the function takes.
 *
 * Deliberately the REAL default labels rather than `{a}` `{b}`: the point is to
 * show a sentence the game could actually draw, so a reader can judge the
 * rhythm of it rather than decode a template.
 */
const SAMPLES = ['Z', 'X', 'what’s next', '1:30'];

/**
 * Pull each exported entry's own doc comment out of the source.
 *
 * A regex over the source rather than a TypeScript AST, because the shape here
 * is fixed and known — one `const <name>Copy = { ... } as const` per file, one
 * entry per key — and a parser dependency for that would be a lot of machinery
 * to learn nothing extra.
 */
function docComments(source) {
  const docs = {};
  // The body must not itself contain `*/`. A lazy `[\s\S]*?` looks right and is
  // not: when the trailing `name:` does not follow, it BACKTRACKS past the
  // closing marker and swallows everything up to the next comment — which put
  // the whole file header inside the first entry's description.
  const pattern = /\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*\n\s*([A-Za-z][A-Za-z0-9_]*)\s*:/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const body = match[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())
      .join('\n')
      .trim()
      // The comments are written for someone reading the source; the deck is
      // read as prose, so the emphasis and code marks come off.
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
    docs[match[2]] = body;
  }
  return docs;
}

/** Read every copy module, bundle it, and pair each value with its comment. */
async function collect() {
  const files = (await readdir(copyDir)).filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
  if (files.length === 0) throw new Error(`No copy modules in ${copyDir}`);

  const imports = files
    // Relative, because esbuild resolves stdin against ; a file://
    // URL is not a module specifier it can follow.
    .map((f) => `export * from './${f.replace(/.ts$/, '')}';`)
    .join('\n');

  await mkdir(dirname(tmpBundle), { recursive: true });
  const bundled = await build({
    stdin: { contents: imports, resolveDir: copyDir, sourcefile: 'deck.ts', loader: 'ts' },
    bundle: true,
    format: 'esm',
    target: 'es2022',
    platform: 'neutral',
    write: false,
  });
  await writeFile(tmpBundle, bundled.outputFiles[0].text, 'utf8');
  const module = await import(pathToFileURL(tmpBundle).href);
  await rm(tmpBundle, { force: true });

  const sections = [];
  for (const file of files.sort()) {
    const stem = file.replace(/\.ts$/, '');
    const exportName = `${stem}Copy`;
    const values = module[exportName];
    if (!values) continue;
    const docs = docComments(await readFile(resolve(copyDir, file), 'utf8'));

    const entries = [];
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'function') {
        const args = SAMPLES.slice(0, Math.max(1, value.length));
        entries.push({
          key,
          kind: 'function',
          text: String(value(...args)),
          args,
          doc: docs[key] ?? '',
        });
      } else if (Array.isArray(value)) {
        entries.push({
          key,
          kind: 'list',
          items: value.map((v) =>
            typeof v === 'object' ? Object.values(v).join(' — ') : String(v),
          ),
          doc: docs[key] ?? '',
        });
      } else {
        entries.push({ key, kind: 'string', text: String(value), doc: docs[key] ?? '' });
      }
    }
    sections.push({ stem, file, entries, ...(SECTIONS[stem] ?? { title: stem, blurb: '' }) });
  }
  return sections;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderEntry(entry) {
  const doc = entry.doc ? `<p class="why">${esc(entry.doc)}</p>` : '';
  if (entry.kind === 'list') {
    const items = entry.items.map((i) => `<li>${esc(i)}</li>`).join('');
    return `<article class="entry">
      <h3><code>${esc(entry.key)}</code> <span class="tag">${entry.items.length} lines</span></h3>
      ${doc}
      <ol class="lines">${items}</ol>
    </article>`;
  }
  if (entry.kind === 'function') {
    return `<article class="entry">
      <h3><code>${esc(entry.key)}</code> <span class="tag">substitutes ${entry.args.length}</span></h3>
      ${doc}
      <p class="text">${esc(entry.text)}</p>
      <p class="worked">shown with ${entry.args.map((a) => `<code>${esc(a)}</code>`).join(', ')} — the real values follow her key bindings</p>
    </article>`;
  }
  return `<article class="entry">
    <h3><code>${esc(entry.key)}</code></h3>
    ${doc}
    <p class="text">${esc(entry.text)}</p>
  </article>`;
}

function page(sections) {
  const total = sections.reduce(
    (n, s) => n + s.entries.reduce((m, e) => m + (e.kind === 'list' ? e.items.length : 1), 0),
    0,
  );
  const body = sections
    .map(
      (s) => `<section class="module">
        <header class="module-head">
          <h2>${esc(s.title)}</h2>
          <p class="blurb">${esc(s.blurb)}</p>
          <p class="src"><code>web/src/copy/${esc(s.file)}</code></p>
        </header>
        <div class="entries">${s.entries.map(renderEntry).join('')}</div>
      </section>`,
    )
    .join('');

  return `<title>The Copy Deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap">
<style>
  /* The dojo's own palette, so the deck looks like the thing it describes. */
  :root {
    --bg: #f6f4ef;
    --panel: #fffefb;
    --ink: #14171f;
    --dim: #575d6d;
    --line: #dbd7cc;
    --accent: #9a7415;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --bg: #0b0e1a;
      --panel: #121728;
      --ink: #e9e4d5;
      --dim: #9a97a8;
      --line: #232a40;
      --accent: #e8c76a;
    }
  }
  :root[data-theme='dark'] {
    --bg: #0b0e1a;
    --panel: #121728;
    --ink: #e9e4d5;
    --dim: #9a97a8;
    --line: #232a40;
    --accent: #e8c76a;
  }

  body {
    margin: 0;
    padding: 2.5rem 1.25rem 5rem;
    background: var(--bg);
    color: var(--ink);
    font: 16px/1.65 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .wrap { max-width: 54rem; margin: 0 auto; display: grid; gap: 2.5rem; }

  h1 {
    font-family: 'Cinzel', Georgia, 'Times New Roman', serif;
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    text-wrap: balance;
    margin: 0 0 0.5rem;
  }
  h2 {
    font-family: 'Cinzel', Georgia, 'Times New Roman', serif;
    font-size: 1.3rem;
    margin: 0;
    text-wrap: balance;
  }
  .lede { color: var(--dim); margin: 0; max-width: 62ch; }
  .count { color: var(--accent); font-weight: 600; }

  .module { display: grid; gap: 1.1rem; }
  .module-head { display: grid; gap: 0.35rem; border-bottom: 1px solid var(--line); padding-bottom: 0.8rem; }
  .blurb { margin: 0; color: var(--dim); max-width: 62ch; }
  .src { margin: 0; font-size: 0.82rem; color: var(--dim); }

  .entries { display: grid; gap: 0.9rem; }
  .entry {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 1rem 1.1rem;
    display: grid;
    gap: 0.5rem;
  }
  .entry h3 { margin: 0; font-size: 0.9rem; font-weight: 600; display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap; }
  .tag { color: var(--accent); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .text {
    margin: 0;
    font-size: 1.05rem;
    /* The words are the subject; everything else on the card is scaffolding. */
    border-left: 3px solid var(--accent);
    padding-left: 0.9rem;
  }
  .why { margin: 0; color: var(--dim); font-size: 0.88rem; white-space: pre-wrap; }
  .worked { margin: 0; color: var(--dim); font-size: 0.8rem; }
  .lines { margin: 0; padding-left: 1.3rem; display: grid; gap: 0.5rem; }
  .lines li { padding-left: 0.2rem; }
  code { font-family: ui-monospace, 'Courier New', monospace; font-size: 0.85em; }

  footer { border-top: 1px solid var(--line); padding-top: 1.1rem; color: var(--dim); font-size: 0.85rem; max-width: 62ch; }
</style>
<div class="wrap">
  <header>
    <h1>The copy deck</h1>
    <p class="lede">
      <span class="count">${total} strings</span> — every word the dojo has a NAME for, read straight
      out of <code>web/src/copy/</code> rather than transcribed, so it cannot miss one or drift from
      what the game draws. Lines that substitute a value are shown as the game really draws them,
      with worked sample keys, rather than as <code>Press {key}</code>.
    </p>
    <p class="lede">
      This is the canvas half — the writing that is pixels rather than DOM, and the half you named:
      &ldquo;you passed&rdquo;, &ldquo;you failed&rdquo;, the cards. The page and lesson copy has not
      been extracted yet; when it is, it appears here without this file changing.
    </p>
  </header>
  ${body}
  <footer>
    Built by <code>node scripts/build-copy-deck.mjs</code>. To change a line, edit it in the module
    named under each section heading — the deck regenerates from there.
  </footer>
</div>
`;
}

const sections = await collect();
const html = page(sections);
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, html, 'utf8');
const count = sections.reduce(
  (n, s) => n + s.entries.reduce((m, e) => m + (e.kind === 'list' ? e.items.length : 1), 0),
  0,
);
console.log(
  `Wrote ${outFile} — ${sections.length} module(s), ${count} strings, ${(html.length / 1024).toFixed(1)} KB`,
);
