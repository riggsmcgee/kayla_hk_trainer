# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo **Branch:** `proactive/2026-08-28-1036` (from `proactive/2026-08-28-0939`)
**Window:** 2026-08-28 10:36 to 14:36 local (240 min — "as long as it takes", capped at four hours)
**Status:** running **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

## How I read the ask

> "I want it to be on its own page, and I also want her to be able to change the controls from this
> view. It should say 'Jump' and next it would be 'Remap', and it's not working. She has the ability
> to remap it pretty easily."

I read **"and it's not working"** as the _situation the button is for_ — she presses Jump, nothing
happens, and the fix is right there on the row instead of two pages away in Settings. Not as a
report that the checklist is broken; it was driven end to end in a browser last sprint and ticked
7 → 1. If that reading is wrong, say so and it is a small change, not a rebuild.

Two calls I made without you, both stated here and both cheap to reverse:

- **The sandbox is its own PAGE, not a seventh stop on the road.** The map's road is six
  hand-authored SVG curves and "six stops" is written into the copy; a seventh stop is a design
  conversation. It sits between Setup and Pogo in the forward chain instead.
- **The gate is built, and existing saves are GRANDFATHERED.** See "Needs you".

---

## Needs you

_(filling in as the sprint runs)_

## Change ledger

_(nothing yet)_

## Baseline (before any change)

- `npm test` — **869 passed** (868 web across 44 files, 1 server). _(The last handoff said "868
  total, 867 web"; the web figure is 868 and the total is 869. Corrected here rather than carried.)_
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 417.58 kB, CSS 27.21 kB**. Nothing was broken at baseline.

## Final check (after the last change)

_(nothing yet)_

## Started, sliced, continued in PLAN.md

_(nothing yet)_

## Tried and reverted

_(nothing yet)_

## Ideas not acted on

_(nothing yet)_

## Environment changes

_(nothing yet)_

## Skills used

_(nothing yet)_

## Suggested next session

_(nothing yet)_
