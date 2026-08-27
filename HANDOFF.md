# Proactive sprint handoff

**Project:** kayla-hk-dojo **Branch:** `proactive/2026-08-27-1426` (from `proactive/2026-08-27-1130`)
**Window:** 2026-08-27, 120 min, no focus given — continuing the plan
**Status:** running **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

## The headline

**The whole playtest-7 contract is built.** All seven priorities: the copy
module, the stop and the summon, the gather and the reverence transform, the
rise and the applause and the confetti and the backflips and the party hats,
the hold-to-hurry escape, `#/the-end`, and the generated copy deck. The last
two landed in the sprint before this one; the rest landed here.

**And the finish line turns out to be reachable.** Every number in the Two Bills
fight was derived against the physics and never played to the end by anything,
so it was possible — right up until this sprint — that a flawless 1:30 was not
achievable at all and the whole ending could never fire. Against Bill it is,
by a strategy a person can execute: stand still, commit to a held jump when the
lance commits. The bot clears 1:30 with ten passes dodged.

**The dojo can be finished.** Before this sprint, pressing forward at the end of
the celebration restarted the fight — there was no way out of the game. Now she
beats the Two Bills, watches the twenty seconds, presses forward, and arrives at
`#/the-end`: four messages from you, then a credits roll with the whole cast.

Proved end to end in a real browser, not just by tests:
`node .proactive/scratch/e2e-finish.mjs` drives the fight → the celebration →
the forward key → the last screen. Zero console errors.

## How I read the focus

You gave no focus, so the plan is the backlog — and the plan's next item was
already in flight when the command arrived. Ten minutes earlier you had picked
**`#/the-end` plus the Riggs portfolio** as the next thing to work on, and an
11-agent workflow was running it. Killing that to start clean would have thrown
away the exact work you asked for, so the sprint took it as task 1.

## Needs you

1. **Two decisions are waiting on your eyes, and the page to make them on is
   published:** <https://claude.ai/code/artifact/87866505-945e-4b3f-932e-e157c53d53c3>
   Three ways to draw you, looping in step, and six candidate yellows for the
   bow tie on the same drawing. Every figure is the shipped painter compiled by
   `scripts/build-riggs-gallery.mjs`, so picking one is picking code that
   already exists — and picking one is deleting the other two.
   - **The drawing.** A "Same Room As Bill" (shirtsleeves, maximum continuity),
     B "The Detail The Scale Buys" (glasses, a real hairline, a three-tone
     ramp), C "The Portrait" (jacketed, squarer, composed).
   - **The tie.** `punishGold #e8c76a` is ratified out. The six are ranked by
     arithmetic rather than taste — WCAG contrast on the arena ground, and
     distance from both punishGold and Bill's foam orange. The useful scale came
     out of the reference pair: punishGold and the foam finger sit **152** apart
     and the game already asks her to tell those two apart, so 152 is the bar.
     **Olive Gold `#a8891c`** leads on both counts (201 / 123) and is the
     placeholder the game currently ships.
   - **The page also asks the near-miss question** the portfolio process keeps
     failing to run — which came second, and what did it nearly have.

2. **The copy deck is published too:**
   <https://claude.ai/code/artifact/c0a18df6-7af9-49c8-a8a0-4d45230b8bd7>
   52 strings, read straight out of `web/src/copy/` rather than transcribed, so
   it cannot miss one or drift. This is the canvas half — the writing that is
   pixels rather than DOM, which is the half you named. Lines that substitute a
   value are shown as the game really draws them, with worked sample keys,
   rather than as `Press {key}`. To change a line, edit the module named under
   its section heading; the deck regenerates from there.

3. **The four messages are drafts, and they are the most personal writing in the
   project.** They live in `web/src/copy/theEnd.ts` precisely so you can rewrite
   them without touching code. Same for the cast list's one-line credits.

4. **A seventh tie colour was worked out and cut rather than shown.** Honey
   `#e3b33d` sits 77 from punishGold — a sibling of the colour that is ruled
   out. Putting it on the page would have been offering a choice already
   answered. Say if you want it back.

5. **The workflow was stopped early, deliberately.** Its three painters landed
   and are committed; its remaining phases were a tie shortlist I had already
   built with real arithmetic, a page I built myself, and verify passes I ran
   directly. It had been running ~90 minutes and would not have finished inside
   the window. Nothing was lost.

6. **The dog is the open question now, and there is a lead.** An exploration
   harness that added him at 0:30 killed FOUR different strategies — stand and
   jump, hop the ball, hold the middle, back away — all within **2.7 seconds**
   of his arrival, and every one by **body contact** rather than by an attack.
   Four strategies dying at an identical time is structural, not tactical. The
   caveat that keeps it a lead: the harness dropped a fully active dog 200 px
   from a wall, while the real session walks him in during a card with the
   clock paused. Walking him in the way `bringInTheDog` does is the next step,
   and it is written into PLAN.md M6.7 with the numbers.

7. **Still not built:** the short page and component strings (the lesson PROSE is
   ratified to stay in its pages), and the live deck that saves its own edits.
   Everything else in the contract shipped.

## Change ledger

| #   | Commit    | What                                                                                          | How to try it                                       | Risk |
| --- | --------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---- |
| 1   | `e6278e8` | Correct the skills log: `agent-browser` is slow, not broken                                   | `git show e6278e8`                                  | none |
| 2   | `ebf5313` | Open the sprint                                                                               | this file                                           | none |
| 3   | `38e9a53` | PLAN.md said T10 (the two reinforced waves) was still to build; it shipped a while ago        | `git show 38e9a53`                                  | none |
| 4   | `1da91cf` | The baseline nobody had run: every route, in a browser, console open                          | `node .proactive/scratch/route-walk.mjs`            | none |
| 5   | `709a70f` | **Two buttons on Settings both said "Reset to defaults"** — now named for what they reset     | `#/settings`, tab to either reset                   | low  |
| 6   | `89300b5` | **Three ways to draw 8-bit Riggs**, plus the gallery that compiles them                       | `node scripts/build-riggs-gallery.mjs`              | low  |
| 7   | `85132ca` | The portfolio page states what each candidate argues, and the six yellows                     | open the artifact above                             | none |
| 8   | `cc0fa70` | **Forward, out of the fight for good** — the celebration stops breaking `jump = forward`      | the dev drawer's "Watch the ending", then press Z   | med  |
| 9   | `ca5f076` | Candidate B's last polish                                                                     | the artifact                                        | none |
| 10  | `7cced8d` | **`#/the-end`: the dojo can be finished** — Riggs, four messages, the credits, Settings entry | `#/the-end`, or finish the fight                    | med  |
| 11  | `436da35` | **Confetti**: the spitter fires straight up on a ~2 s cycle and it comes down as paper        | the celebration, from ~14 s                         | low  |
| 12  | `396b4d5` | **The fight's 17 canvas strings move into `copy/fight.ts`** — zero behaviour change           | `git show 396b4d5`                                  | low  |
| 13  | `222444d` | **The copy deck**, generated from the modules rather than transcribed                         | `node scripts/build-copy-deck.mjs`, or the artifact | none |
| 14  | `05804ba` | **Party hats** on all five, drawn over the bodies rather than through their painters          | the celebration, from ~14 s                         | low  |
| 15  | `572c6de` | **1:30 untouched is reachable** — the survival bot now runs the read to the finish line       | `npx vitest run src/engine/boss.bot.test.ts`        | none |

Merge everything: `git checkout proactive/2026-08-27-1130 && git merge proactive/2026-08-27-1426`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)

**The browser pass the last two sprints both skipped.** Every route loaded cold
in headless Chromium with the console open, full progress and god mode seeded.
Driven by Playwright rather than `agent-browser`, for the reason now corrected in
the skills log: it is not broken, it is unusably slow to cold-start.

**Result: clean.** Ten routes — home, three lessons, three mini-games, Settings,
`#/the-end`, and a deliberate nonsense route. **Zero console errors, zero page
errors, zero failed requests, and no horizontal overflow on any page.**

It cleared two suspicions and found one real defect:

1. **CLEARED — the seven "Change" buttons on Settings are properly labelled.**
   Their visible text is all "Change", which looked like a screen-reader trap;
   the accessible names are "Change key for Jump", "…for Attack" and so on. The
   a11y work in M6.5 holds up.
2. **REAL — two buttons shared one accessible name.** "Reset to defaults" was
   both the keyboard reset and the controller reset. Fixed in `709a70f`, and
   proved by mutation: pointing both labels at the keyboard turns two of the
   three new tests red.
3. **CLEARED — an unknown route rendering home is deliberate.** `App.tsx` has an
   explicit `path="*"` redirect. Not an omission.

The suite was not run at baseline because eleven workflow agents were running
`tsc` and `vitest` on this machine, and last sprint's only red was a 653-second
timeout from exactly that contention. Last known green at the branch point:
**754 tests in `web`, 1 in `server`.**

## Final check (after the last change)

- `npm test` — **green: 819 in `web` (39 files), 1 in `server`.** +65 on the
  branch point.
- `npm run build` — clean, 414.88 kB / 130.51 kB gzipped.
- `npm run typecheck` — clean. `npm run lint` — clean. Prettier run on every file
  touched.
- **End to end, twice.** The ten-route walk again, and the new `e2e-finish.mjs`:
  the fight → the twenty-second celebration → the forward key → `#/the-end`,
  with the first message on screen and no console errors. Re-run after the
  confetti and the hats landed.
- Screenshots in `.proactive/scratch/` — `routes/`, `the-end/`, `e2e/`,
  `gallery-candidates.png`, `gallery-ties.png`.

## Started, sliced, continued in PLAN.md

PLAN.md §8's remaining-ending list is maintained: `#/the-end` and the dog's
backflip are struck as BUILT, the rejected party states keep their write-up, and
the confetti and the copy extraction stay open with their numbers.

## Tried and reverted

Nothing reverted this sprint. The workflow's tie-shortlist and page phases were
**superseded rather than reverted** — see "Needs you" item 4.

## Ideas not acted on

- **The lesson pages use about a third of a wide viewport.** Long-form reading
  wants a narrow measure, so this is a taste call rather than a bug — but the
  demo canvases inherit that measure and end up ~370 px wide, and those are
  things she is meant to WATCH at half speed with hitboxes drawn in. Worth a look
  at whether the demos should break out of the text column.
- **`web/src/copy/` wants a sibling per area** (`fight.ts`, `lessons.ts`,
  `overlays.ts`) rather than one file with 250 keys. A deck generator can walk
  the directory. Two modules exist now; the shape is set.
- **The ending's tableau composes differently every run**, because the five take
  whichever of nine slots the Knight and the Bills are not standing in. Robust,
  never overlaps — but a fixed composition would be a stronger picture.

## Environment changes

**None.** No installs, no upgrades, no global tools. Playwright was already a
dependency; the dev server ran on **5199** to stay clear of your own Vite on 5174.

## Skills used

Logged in `docs/skills-log.md`. `proactive`, `artifact-design` (before publishing
the portfolio), and Playwright throughout. The 11-agent workflow delivered the
three painters and was stopped after that.

## Suggested next session

**Open both artifacts.** The portfolio needs two answers — which drawing, which
yellow — and each is one line in `engine/riggs/index.ts` once you have picked.
The deck needs a read-through: it is the first time all the canvas writing has
been in one place, and the four messages on `#/the-end` are drafts.

The contract is otherwise finished, so the next session is a **playtest**, not
a build. The biggest untested assumption in the project is still whether 1:30
untouched is actually reachable — every number in that fight was derived and
none of it has been played by a person. If it is not reachable, none of what
shipped this sprint ever fires for her.
