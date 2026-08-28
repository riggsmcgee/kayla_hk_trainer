# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo **Branch:** `proactive/2026-08-28-0835` (from `riggs/photo-round`)
**Window:** 2026-08-28 08:35 to 09:35 local (60 min, contract items 6 and 7)
**Status:** done **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

Focus as given: the controller preset and the four-button capture offer in Setup (item 6), and the
sandbox with its checklist gate (item 7). **Item 6 is done. Item 7 is done except its gate**, which
is deliberately not built — see "Needs you", item 2.

---

## Needs you

1. **Nothing is red.** 820 tests at baseline, **860 now**; lint, typecheck and build clean at both
   ends. The browser pass is clean too.
2. **The gate is the one thing I stopped short of, and it needs a decision, not an hour.** Setup's
   completion is still `progress.controller !== undefined` (`storage/progress.ts:111`). Making it
   require the seven ticks would **un-complete chapter 1 for every save that already exists** —
   Kayla's included — and the map, the chapter strip and every downstream gate read that. That is a
   migration question: either existing saves are grandfathered (treat a controller answered before
   today as complete) or she is asked to do seven things she has already proved by playing. The
   skip that playtest 8 promised alongside the gate has nothing to skip until the gate exists, so
   the two ship together. **Your call on the grandfathering; the code is a few lines either way.**
3. **The preset is a guess, on purpose, and it is worth one minute with the board.** Her leverless
   enumerates as a gamepad — that is settled — but **which index each button reports on is not**,
   and no preset can settle it. Open Setup, pick Leverless, and see whether the sentence under the
   answer matches the buttons she actually presses. If it does not, the four-button capture in
   Settings is one screen away and fixes it in about ten seconds. That mismatch is expected, not a
   bug.
4. **Two files at the repo root, `--full-page` and `--selector`**, are still stray output from a
   mis-parsed screenshot command dated 26 Aug. They predate all of this. Junk, safe to delete; I
   left them because they are not mine to remove.

## Change ledger

| #   | Commit    | What                                                                                                               | How to try it                                                              | Risk |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---- |
| 1   | `3fc01e2` | Picking a controller applies a layout that fits it, and offers the capture. Settings' reset follows her controller | `#/lessons/setup` → pick Leverless → read the line under the answer        | med  |
| 2   | `4e30f21` | The checklist's rules and storage, and `nailDirection` extracted from `stepPlayer`                                 | `npx vitest run --root web src/engine/setupChecks`                         | low  |
| 3   | `6c911ed` | The sandbox itself: a bare floor, the Knight, the seven ticks, and the persistence bug they exposed                | `#/lessons/setup` → pick a board → play on the floor, then reload the page | med  |

Merge everything: `git checkout riggs/photo-round && git merge proactive/2026-08-28-0835`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)

- `npm test` — **820 passed** (819 web across 39 files, 1 server).
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 411.43 kB, CSS 26.84 kB**. Nothing was broken at baseline.

## Final check (after the last change)

- `npm test` — **860 passed** (859 web across 42 files, 1 server). +40, in three new files
  (`setupChecks`, `setupSandboxSession`, `LessonSetup`) plus the gamepad and storage suites.
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 414.75 kB (+3.3), CSS 27.21 kB (+0.37)** — a canvas session, a checklist and a
  stylesheet.
- **Browser pass**, dev server on 5199, two scripts in `.proactive/scratch/`:
  - `setup-check.mjs` — picked Leverless, read the line back (`jump bottom button, attack right
button, dash right shoulder`), pressed change, picked Joy-Con, read it again (`attack left
button`). Zero console errors.
  - `sandbox-check.mjs` — drove the canvas with the real keys, watched the counter fall 7 → 1, then
    **reloaded**. Screenshot in `.proactive/scratch/sandbox.png`.

## Started, sliced, continued in PLAN.md

**Item 7's gate**, and only that. Written into PLAN §8 with the migration question spelled out. The
sandbox ships without it: she can use the floor and fill the sheet today, and nothing gates on it,
which is a strictly smaller change than gating and then having to un-gate.

## Tried and reverted

- **A page-level test for "the sheet is still there when she comes back" was written, failed, and
  was dropped** — with a note in the test file saying why. The progress store is a module singleton
  that caches across tests in a file, so seeding it (by localStorage or through its own API) is not
  visible to a component rendered afterwards; a test written around that would be testing the
  harness. **It was replaced by two tests at the storage seam, which is where the bug actually
  was.** Making it testable at the page level means giving the store a reset seam — a real, small
  improvement, and a candidate for a tidying pass.
- **I created `web/src/styles/lessons.css` by accident** — an append to a file I assumed existed —
  then briefly believed it was pre-existing dead code and said so in a comment. It was mine. It is
  deleted; the rules live in `styles/setup.css`, imported by the page like every other feature
  sheet. Worth knowing because the wrong version of that sentence nearly went into a commit.

## The bug the browser found and the tests did not

The sheet filled up on screen and was back at zero the moment the page reloaded.

`readProgress` rebuilds progress **field by field** rather than spreading the stored blob, which is
what keeps a hand-edited or older save from injecting junk into `ProgressV1`. The cost is that a new
field nobody adds to the READER is written on every change and silently dropped on every read. Every
unit test passed throughout; only reloading a real browser showed it.

Two storage tests hold it now — one reloads, one reads a save written before the sandbox existed —
but **the general hazard is still live**: the next field added to `ProgressV1` will do this again.
A test that round-trips every declared field would close it for good. Proposed, not built.

## Ideas not acted on

- **A store reset seam for tests.** See "Tried and reverted". It would make page-level persistence
  testable and is a handful of lines.
- **A round-trip test over every `ProgressV1` field**, so the reader's whitelist can never silently
  drop a new one again.
- **A Settings diagnostic printing connected pads' `id` and button count.** Still the cheapest way
  to de-risk the preset without you and Kayla being in the same room — she could read it out. Still
  a feature nobody asked for, so still a proposal.

## Environment changes

None. No installs, no upgrades, no config touched. The dev server ran on 5199 as the traps file
instructs and has been shut down.

## Skills used

Only `proactive`. `tdd` was again followed by hand rather than invoked — the checklist's expected
values are derived from PLAN §5's kit and the leverless diagram's own accessible description, not
from running the code. Logged in `docs/skills-log.md`.

## Suggested next session

**Decide the gate's migration** (grandfather existing saves, or not) and it is a short sprint to
finish item 7 — gate plus skip, together.

After that the queue is unchanged and needs nobody: **item 5, the ~52 remaining strings**, which is
mechanical and is what item 8 depends on.
