# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo **Branch:** `proactive/2026-08-28-0939` (from `proactive/2026-08-28-0835`)
**Window:** 2026-08-28 09:39 to 10:39 local (60 min, playtest-8 contract item 5)
**Status:** done **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

No focus was given, so the work order came off the last sprint's own note. Item 7's gate is a
**decision**, item 2 needs you **in the room**; item 5 needs nobody and item 8 waits on it. So this
hour was item 5: **the site's words, out of the JSX and into `web/src/copy/`.**

---

## Needs you

1. **Nothing is red.** 860 tests at baseline, **868 now**; lint, typecheck and build clean at both
   ends. Every screen that changed was also read back in a real browser.
2. **The gate decision is still open and still yours** — unchanged from the last handoff, and I did
   not touch it. Setup's completion is `progress.controller !== undefined`
   (`storage/progress.ts:111`); requiring the seven sandbox ticks would un-complete chapter 1 for
   every save that already exists, Kayla's included. Grandfather or not. The skip playtest 8
   promised ships in the same slice.
3. **The "~52 strings" figure in the playtest-8 contract was low by about three times.** It was
   arithmetic off the canvas count rather than a recount, and the last handoff flagged it as an
   estimate. The real number extracted this hour is **138**, and item 5 is still not finished — see
   "Started, sliced". This matters for sizing item 8 more than for anything else.
4. **I deleted `--full-page` and `--selector` from the repo root** (commit `04fdaf1`). They are two
   PNGs from a screenshot command whose flags were parsed as filenames, committed by accident in
   `66d5bff` and `4e9dd61` on 26 Aug. The last handoff left them as "not mine to remove"; I judged
   agent-made junk on a sprint branch to be mine. **That commit also carries real work**, so restore
   the two files from `66d5bff` rather than reverting the whole commit if you disagree.

## Change ledger

| #   | Commit    | What                                                                                       | How to try it                                             | Risk |
| --- | --------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ---- |
| 1   | `4142b2a` | `copy/nav.ts`: the road's chrome — gate panel, chapter strip, forward button, level chips  | `#/play/pogo` → press a locked level chip                 | low  |
| 2   | `53f32bf` | `copy/play.ts`: both mini-game pages; the fine print became one component instead of three | `#/play/dodge` → read the foot of the page                | low  |
| 3   | `32e80c2` | `copy/home.ts`: the front page; the map and the strip now share one state vocabulary       | `#/` → hero, sign, legend, signature                      | low  |
| 4   | `9882221` | `copy/settings.ts`: the whole bench, including the two sentences that wrap markup          | `#/settings` → the controller note, "Reset my progress"   | med  |
| 5   | `04fdaf1` | The site header and footer, the finale's three beats, and the two stray PNGs deleted       | `#/play/well` → skip in, read the beats and the gate      | low  |
| 6   | `b9c31d8` | `copy/setup.ts`: the controller diagrams' accessible descriptions                          | `#/lessons/setup` → inspect either diagram's `aria-label` | low  |

Merge everything: `git checkout proactive/2026-08-28-0835 && git merge proactive/2026-08-28-0939`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)

- `npm test` — **860 passed** (859 web across 42 files, 1 server).
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 414.75 kB, CSS 27.21 kB**. Nothing was broken at baseline.

## Final check (after the last change)

- `npm test` — **868 passed** (867 web across 44 files, 1 server). +8, in two new files
  (`components/roadChrome.test.tsx`, `pages/Home.test.tsx`).
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 417.58 kB (+2.83), CSS 27.21 kB (unchanged)** — eight modules of named strings and no
  new styles.
- **Browser pass**, dev server on 5199, four scripts in `.proactive/scratch/`:
  - `copy-walk2.mjs` — Home, the gate panel, the Bounce Bog including a locked level chip, the
    Colosseum. Screenshots `s18-home.png`, `s18-pogo.png`, `s18-arena.png`.
  - `well-check.mjs` — skipped into the Bottom of the Well; the beats, the fine print and the
    end-of-road sentence. `s18-well.png`.
  - `settings-walk.mjs` — both markup-wrapping sentences, a live key capture, and reset-my-progress
    all the way through the confirm to the announcement. `s18-settings.png`.
  - `shell-check.mjs` — the header and footer.
  - Zero console errors on every page.

## What the extraction is, in one paragraph

`web/src/copy/` had three modules and 38 named strings — every word the boss fight and the last
screen DRAW, which is the half that is pixels. It now has **eight modules and 176**, because the
other half is the DOM: `nav.ts` (31), `play.ts` (29), `home.ts` (17), `settings.ts` (45), `setup.ts`
(2). Two rules throughout, both inherited from the canvas modules: everything is exported and named,
and **anything with a value substituted into it is a function**, never a template with a
placeholder, so the editor shows what the page really renders.

## Started, sliced, continued in PLAN.md

**Item 5 is mostly done, not done.** PLAN §8 item 6 is rewritten with the real figures and the
remainder, in order:

- **The three lesson pages' short strings.** Left deliberately: the lesson PROSE is ratified to stay
  in its pages and be shown read-only, and deciding where a heading stops and a paragraph begins is
  a taste call, not a mechanical one. It is the one part of item 5 I would not do unattended.
- **The sixteen labels printed ON the controller diagrams.** Single words like Jump and Attack that
  partly duplicate `actionLabelCopy` in `copy/settings.ts` — whether they share that table or keep
  their own is a decision, not a rename.
- **Then item 8**, which depends on both.

## Three things the extraction settled

- **A sentence with a `<Link>` or an `<em>` in the middle is the one shape this can silently
  break.** JSX drops a line holding only whitespace, so the space before an inline element has to
  travel INSIDE the string. Every such sentence is now lead/element/tail fragments. The editor must
  never offer one as a single box, or the anchor can be edited away.
- **A test that derives its expectation from the same copy constant cannot see a missing space.**
  Both assertions are needed — one against the copy, which pins the join, and one against the prose,
  which pins the words. I confirmed the spacing assertion bites by deleting the space it guards and
  watching the suite go red, then restoring it.
- **HTML entities do not survive contact with a text box.** The site title's `&apos;` and the
  signature's `&amp;` are real characters now. Invisible in a browser; wrong in an editor.

## Tried and reverted

Nothing was reverted. One judgement call went the same way twice and is worth knowing: **the dev
drawers' strings are deliberately NOT extracted** — the arena's enemy picker and observe toggle, and
Settings' variant pickers. PLAN §7's standing note removes those drawers in the final build, so
naming them in the module that feeds the editor would put words in front of you that you are meant
never to see, and would make deleting them a two-file job.

## Ideas not acted on

- **A round-trip test over every `ProgressV1` field.** Still the open hazard the last sprint found:
  `readProgress` rebuilds progress field by field, so the next field added to `ProgressV1` will be
  written and silently dropped on read, exactly as `setupChecks` was. Two tests hold today's fields;
  nothing holds tomorrow's. Small, and it closes a bug class.
- **A store reset seam for tests**, so page-level persistence is testable. Carried over.
- **A Settings diagnostic printing connected pads' `id` and button count.** Carried over; still the
  cheapest way to de-risk the controller preset without you and Kayla in the same room.
- **`chapters.ts` was left alone on purpose.** Its place/title/line/done strings are already named,
  and it is the one list the map, the strip, the gates and the routes all read. The editor should
  show them from there rather than a copy being split off.

## Environment changes

None. No installs, no upgrades, no config touched. The dev server ran on 5199 and has been shut
down.

## Skills used

Only `proactive`. `tdd` was followed by hand — a pure extraction has no red step, though the
deliberate red on the spacing assertion is the part of that discipline which paid. `webapp-testing`
was again not invoked; the previous sprints' `playwright-core` scripts already know this app's
quirks (a HashRouter needs a real reload, the dev server wants `--strictPort` from inside `web/`).
Logged in `docs/skills-log.md`, with a note that three sprints in a row makes that a pattern.

## Suggested next session

**Sit down with it for ten minutes first**, then it can run unattended again. The two things that
need you are small: **decide the gate's migration** (grandfather or not — a few lines either way,
and the skip ships with it), and **say where a lesson's headings stop and its prose begins** so the
last three files of item 5 can be finished mechanically. After that item 5 closes, and **item 8, the
one-to-one editor, is the whole of the remaining contract** — the largest single piece in the
project, so it wants a real session rather than an hour.
