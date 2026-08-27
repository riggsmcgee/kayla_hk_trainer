# Proactive sprint handoff

**Project:** kayla-hk-dojo **Branch:** `proactive/2026-08-27-1426` (from `proactive/2026-08-27-1130`)
**Window:** 2026-08-27, 120 min, no focus given — continuing the plan
**Status:** running **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

## How I read the focus

You gave no focus, so the plan is the backlog — and the plan's next item was
already in flight when you typed the command. Ten minutes earlier you picked
**`#/the-end` plus the Riggs portfolio** as the next thing to work on, and an
11-agent workflow was already running it: three independent Riggs candidates, a
bow-tie colour shortlist, the `#/the-end` page, and three adversarial reviews.

Killing that to start clean would have thrown away the exact work you asked
for. So the sprint takes it as task 1: it finishes, I look at it in a browser,
and I integrate it. Then the plan continues from PLAN.md §8.

## Needs you

(nothing yet)

## Change ledger

| #   | Commit    | What                                                                                      | How to try it                                             | Risk |
| --- | --------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---- |
| 1   | `e6278e8` | Correct the skills log: `agent-browser` is slow, not broken                               | `git show e6278e8`                                        | none |
| 2   | `ebf5313` | Open the sprint                                                                           | this file                                                 | none |
| 3   | `38e9a53` | PLAN.md said T10 (the two reinforced waves) was still to build; it shipped a while ago    | `git show 38e9a53`                                        | none |
| 4   | `1da91cf` | The baseline nobody had run: every route, in a browser, console open                      | `node .proactive/scratch/route-walk.mjs`                  | none |
| 5   | `709a70f` | **Two buttons on Settings both said "Reset to defaults"** — now named for what they reset | `#/settings`, tab to either reset; or the new render test | low  |

Merge everything: `git checkout proactive/2026-08-27-1130 && git merge proactive/2026-08-27-1426`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)

**The browser pass the last two sprints both skipped.** Every route loaded cold
in headless Chromium with the console open, full progress and god mode seeded,
screenshots in `.proactive/scratch/routes/`. Driven by Playwright rather than
`agent-browser`, for the reason now corrected in the skills log: it is not
broken, it is unusably slow to cold-start.

**Result: clean.** Ten routes — home, three lessons, three mini-games, Settings,
`#/the-end`, and a deliberate nonsense route. **Zero console errors, zero page
errors, zero failed requests, and no horizontal overflow on any page.** Titles
and headings all render. That is a better result than I expected and it is
worth having on the record.

Two things it turned up, and one thing it cleared:

1. **CLEARED — the seven "Change" buttons on Settings are properly labelled.**
   Their visible text is all "Change", which looked like a screen-reader trap,
   but the accessible names are "Change button for Jump", "…for Attack" and so
   on. I checked before claiming it. The a11y work in M6.5 holds up.
2. **REAL — two buttons on Settings share one accessible name.** "Reset to
   defaults" appears twice (`Settings.tsx:210` for the keyboard bindings,
   `:286` for the controller). Tabbing the page, or listing its buttons, gives
   no way to tell them apart. The file already has the right convention for
   this — the Change buttons name their action — so the fix is to follow it.
   Queued as this sprint's next task.
3. **NOTED, not acted on — an unknown route silently renders home.**
   `#/nonsense-route` returns the map with no explanation. That is ordinary
   catch-all behaviour and arguably correct, but the site ships to Pages with a
   HashRouter, so a stale bookmark lands her somewhere confusing and silent.
   A proposal, not a bug; see "Ideas not acted on".

**The suite was deliberately not run at baseline.** Eleven workflow agents were
running `tsc` and `vitest` on this machine, and last sprint's only red was a
653-second timeout caused by exactly that contention. Last known green, at the
tip of the previous sprint: **754 tests in `web` (35 files), 1 in `server`**,
lint and typecheck clean. The full suite runs on an idle machine before
anything is integrated, and again at the final check.

## Final check (after the last change)

(not yet)

## Started, sliced, continued in PLAN.md

(nothing yet)

## Tried and reverted

(nothing yet)

## Ideas not acted on

(nothing yet)

## Environment changes

(none yet)

## Skills used

(none yet — logged in `docs/skills-log.md` at the end)

## Suggested next session

(not yet)
