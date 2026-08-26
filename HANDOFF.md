# Proactive sprint handoff

**Project:** kayla-hk-dojo **Branch:** `proactive/2026-08-26-1419` (from `proactive/2026-08-26-1054`)
**Window:** 2026-08-26 14:19 → 16:19 local (120 min, focus: implement the playtest-6 feedback)
**Status:** done **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

## How I read the focus

`docs/feedback/2026-08-26-playtest-6.md` is the contract, and its own "Priority
for the next session" is dependency order, not preference order. I worked that
list top-down. Nothing under "Ratified decisions" was re-opened.

**Six of the seven priority items landed.** The one left is priority 7, the
scoring change (note 4) — see "Needs you".

## Needs you

1. **Look at the three celebrations and pick one.**
   <https://claude.ai/code/artifact/5abb4d4f-96c2-42e9-8a56-8433ca62d443>
   Both Bills, three candidates, all looping in step. This is the only thing in
   the sprint that is blocked on your taste, and the boss win phase and the
   whole ending sequence sit behind it. **The page asks the near-miss question
   in three parts while it is still open** — which one, which came second and
   what it nearly had, and what those two share that the third does not. That
   step has now failed to run twice because the near-misses could not be
   recalled afterwards.

2. **One line in the contract is genuinely ambiguous and I made a call.**
   Note 5 ratifies "**Strike the SKIP, not the fast-forward**", but its own
   next sentence says removing the skip alone still leaves her a 1.0 s card,
   and your verbatim note asks for "unskippable **and unfast-forwardable**". I
   removed both, so the dog's card now runs its full 2.5 s no matter what she
   holds. If you meant the other reading, restoring the hurry is one line in
   `bossSession.ts`'s card branch.

3. **The scoring change (note 4) is not done, and it is the one item I would
   not start with 40 minutes left.** Deleting `hitsRequired` is a TypeScript
   compile break across 15 uses, observe mode's only mechanism _is_
   `hitsRequired: Infinity` so it needs its own switch first, and `bests.ts`
   currently ranks a cleared 5-hit run above an uncleared 40-hit one — which is
   exactly backwards once hits are the score. It is independent of everything
   else, so it loses nothing by waiting for a session that can do it in one
   piece.

4. **One premise in the contract looks wrong, and I did not act on it.**
   Note 4's ratified fix is "Rename 'Skip this challenge', **and stop the skip
   writing a permanent mark**" — on the stated grounds that "skipping brands the
   map with a dashed-unfinished ring forever". I could not confirm the second
   half. `chapterState` asks `chapterDone` **before** it asks
   `chapterSkipped`, so a skipped stop she later goes back and clears draws a
   full ring, not a dashed one; the dashed ring is only ever the current answer.
   Same for the level and wave chips, which have no skipped class at all. I have
   pinned that behaviour with a test rather than changing anything, so the next
   session does not fix a non-bug. **The rename half is untouched** — it is real
   and ratified, but the exact word is the most-read copy on the site and it
   seemed better handed to you than picked at the end of a sprint.

5. **Still only you can close these** (unchanged from the interview): whether
   the new 180 px roll feels right, `rollEveryHot`'s 9.5 s → 11.5 s drift, and
   what your pads report against your Switch layout — ten seconds on
   Settings → Controller.

6. **The gamepad copy is proven by test, not by hand.** I have no pad here, so
   `controlsCaption(..., 'gamepad')` and the overlay prompts are covered by
   unit and component tests but nobody has _seen_ them. Plug the pad in, press
   anything, and the caption under the canvas should switch from "jump with Z
   or Space" to "jump with the bottom button" without the run restarting.

## Change ledger

| #   | Commit    | What                                                                                                                      | How to try it                                                                                            | Risk   |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| 1   | `819c0ea` | **The 1:30 remount, plus two more of the same bug.** Also adds the project's first React test harness.                    | Survive 1:30 against the Bills on a fresh browser profile — the fight now keeps going and records a run. | medium |
| 2   | `6b2c01b` | **The dashing section** (note 2), in LessonPogo, every figure derived from `PHYSICS` rather than typed into the prose.    | `#/lessons/pogo` → "Hit, then leave".                                                                    | low    |
| 3   | `cda951e` | **The dog's entrance is unskippable** (note 5), with the two unshipped defects it exposed.                                | Reach 0:30 against the Bills and watch him trot in. God mode makes this reachable.                       | medium |
| 4   | `4e9dd61` | **The celebration portfolio** — three poses for Bill the man, an esbuild generator kept in git, published as an Artifact. | The URL in "Needs you", or `node scripts/build-bill-gallery.mjs`.                                        | low    |
| 5   | `b7f0701` | **`useBindings`/`useGamepadBindings` become a shared store.** The contract's largest unbudgeted item.                     | Rebind on Settings; every mounted consumer now sees it.                                                  | medium |
| 6   | `5ec43d1` | **The input-source signal, and the canvas caption** (note 1, first half).                                                 | Play with a pad — the caption under the canvas names buttons, not keys.                                  | low    |
| 7   | `ef88183` | **The map signs tell the truth**: `arenaLine` was reporting how far she had _wandered_; the Bills had no line at all.     | The map's next-stop sign after any Colosseum or Bills run.                                               | low    |
| 8   | `ddd0dae` | **Bill the dog joins the portfolio**, so all three candidates show the pair.                                              | Same URL, republished.                                                                                   | low    |
| 9   | `c8d0c5e` | **The overlay prompts are asked at draw time** (note 1, second half) — "Press the left button to face them again".        | Pick the pad up mid-fight: the prompt renames and the run does **not** restart.                          | medium |
| 10  | `ed92bc7` | The Session 12 skills log.                                                                                                | `docs/skills-log.md`.                                                                                    | low    |

The branch is pushed to `origin`. There is no PR: `gh` is not installed on
this machine, and the skill treats the report as the deliverable rather than
the PR.

Merge everything: `git checkout proactive/2026-08-26-1054 && git merge proactive/2026-08-26-1419`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)

Everything green at 14:20 — 660 web tests + 1 server, lint, typecheck and build
all clean, bundle 387.59 kB (gzip 121.85 kB).

Nothing was red. The known live bug (the 1:30 remount) was invisible to the
suite **by construction**: it lives in a React dependency array, and all 660
tests ran in plain node against pure functions. That is the reason it shipped,
and it is why ledger row 1 also adds the harness.

## Final check (after the last change)

Green at 15:57:

- `npm run test` — **706 tests passed** (34 files) + 1 server. Was 660.
- `npm run lint` — clean. `npm run typecheck` — clean. `npm run build` — clean.
- Bundle 387.59 → **393.22 kB** (gzip 121.85 → 123.49). The 5.6 kB is six new
  celebration poses across the two Bill painters plus the input-source modules.
- **End-to-end**, real browser against the dev server: all eight routes load,
  the gates behave on a fresh profile, the dashing section renders with live
  numbers, the canvas caption reads correctly, **zero console errors anywhere**.
- Three of the fixes were re-verified by planting the mutation back and watching
  the test go red: the dog's walk pose, his interpolation, and the shared store.

Nothing that was green at baseline is red now.

## Started, sliced, continued in PLAN.md

- **The ending (notes 6 and 7)** — the portfolio shipped; the win phase and the
  ending sequence are the next slice and are blocked on your pick. The new sixth
  `BossPhase`, the damage-off rule and the confetti-from-the-spitters plan are
  all still as ratified.
- **The sandbox (note 3)** — not started. Its stated prerequisite (the shared
  store) is now done, and so is note 1's copy decision, which was the other one.
  One thing the store changes for it, noted in `b7f0701`: a rebind is now a real
  dependency change in `PracticeCanvas`'s effect, so the sandbox will have to
  handle the rebuild — the shipped precedent is `PlayPogo`'s keyed canvas.
- **The scoring change (note 4)** — not started; see "Needs you".
- PLAN.md carries the portfolio entry with its URL, and its "1:30 marks the stop
  done" line is **not** yet struck, because the ending that replaces it is not
  built. Strike it in the same commit as the win phase, not before.

## Tried and reverted

Nothing was reverted. Two of the three celebration poses were wrong on their
first render — the bow put the foam mitt exactly where the bowed head was, and
the kneel's shin floated clear of its own thigh — and were reworked before the
commit rather than shipped and fixed. The before/after screenshots are in the
sprint scratch (`gallery1.png` → `gallery5.png`).

## Ideas not acted on

- **The other single-value hooks still have the old per-component shape**:
  `useComfortSettings`, `useGodMode`, `useRollVariant`, `useEntranceVariant`,
  `useDogLook`. Each has the same defect the bindings had. None of them is on a
  screen with a canvas today, so I left them rather than sweeping them up — but
  a Comfort toggle beside a live canvas would hit it immediately.
- **`docs/plans/2026-08-24-playtest-3-build.md` still describes the dog's card
  skip.** I did not edit it: it is a dated record of what was built that day,
  and rewriting history to match the present seemed worse than the mismatch.
  Same call for the playtest-3 feedback doc's "Z = forward, X = again" — PLAN.md
  is restated, the historical round is not.
- **There is still no pixel font anywhere**, so an 8-bit Riggs speaking in the
  HUD font will read as a placeholder. The gallery page uses Silkscreen for its
  own title, which is at least evidence of what that would look like.

## Environment changes

- `npm i -D -w web jsdom @testing-library/react @testing-library/dom` — the
  project had no way to test a React component. Ledger row 1.
- `web/vite.config.ts`: vitest `include` widened to `src/**/*.test.{ts,tsx}`.
  The 660 engine tests stay on the faster node environment; component tests opt
  into jsdom per file with a `// @vitest-environment jsdom` docblock.
- `eslint.config.js`: `scripts/**` now lints with node globals, and
  `scripts/*-entry.ts` with browser globals (it is compiled for the browser).
- `agent-browser` downloaded its Chromium on first use.
- A dev server may still be listening on **5178** — `npx vite --port 5178` from
  `web/`. Yours on 5174 was not touched.

## Skills used

`proactive` (the sprint), `artifact-design` (before the gallery page),
`agent-browser` (every visual check and the route walk), and `tdd` as a standing
rule. All four logged with observations in `docs/skills-log.md`, Session 12.

## Suggested next session

Sit down with it rather than running `/proactive` again — the next item is your
pick from the portfolio, and everything after it (the win phase, the ending, 8-bit
Riggs, the monologue boxes) is downstream of that one decision. Once it is
picked, the ending is a good unattended sprint: it is fully specified, the two
prerequisites are cleared, and the pose vocabulary now exists on both Bills.

If you would rather have code than a decision waiting, note 4's scoring change is
the one item that is independent of everything above and needs a whole session
to itself.
