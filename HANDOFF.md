# Proactive sprint handoff

**Project:** kayla-hk-dojo **Branch:** `proactive/2026-08-27-1130` (from `proactive/2026-08-26-1646`)
**Window:** 2026-08-27, 120 min, focus: tackle the playtest-7 feedback
**Status:** done **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

## How I read the focus

`docs/feedback/2026-08-27-playtest-7.md` ends with a seven-item priority list in dependency order. I
worked it in that order with **one deliberate narrowing on item 1**, and got through items 1
(narrowed), 2, 3, 5, and most of 4.

**Item 1 is the copy-module extraction of ~256 strings across 19 files.** That is more than this
whole window, and it is the one item the contract itself says "blocks nothing technically". Doing it
first would have spent two hours on churn and left the ending — the thing you actually described —
untouched. So I took the half the contract calls load-bearing: **a real copy module, with every
string the ending writes born inside it**, interpolated lines held as functions rather than
templates so a generated deck shows what the game really draws. The full extraction is now a smaller
job, and it stays item 1.

## Needs you

1. **The ending has now been looked at, and three frames are in this conversation.** Ten frames are
   in `.proactive/scratch/shots/`. `agent-browser` hung on cold start for the **third** session
   running, so I drove it with Playwright instead (already a dependency — no install). Two things
   only you can judge: **whether 5.0 s of walk-on is long enough to be frightening** (your own
   "don't rush it" is the reason it is that long), and **whether the tableau reads as lopsided** —
   the five take whichever of nine slots the Knight and the Bills are not standing in, so where she
   happened to be standing at 1:30 decides the picture.

2. **I struck a ratified decision, on sight.** PLAN.md §8 said each of the five celebrates through
   the fields its painter already reads. Every one was reachable exactly as written, and two looked
   wrong: the warden's `skyward` telegraph paints its **landing zone** — a grey slab most of the
   height of the arena, a hazard marker in the middle of a party — and the duelist's anti-air reads
   as a lamp post, not raised arms. The rejected frame is kept at
   `.proactive/scratch/shots/REJECTED-party-poses.png`. What ships is a staggered hop; real party
   states are written back into PLAN.md as needing **new drawing, not new state**. Reverse this if
   you disagree — it is one commit (`9b560e3`).

3. **The published "53.8 px per gap" figure does not reproduce.** The 394 px-of-drawn-ink correction
   is right and is load-bearing in the code (`inkWidth`, never `ENEMY_SIZES`). Its companion figure I
   could not derive from the ink table at any reading I tried, so the layout is computed from the
   real widths and pinned in `ending.test.ts` instead. Worth a look if the tableau ever reads as
   crowded. Recorded in PLAN.md §8 item 7.

4. **Two stray files sit at the repo root and predate this sprint**: `--full-page` (16 KB) and
   `--selector` (48 KB), both dated 2026-08-26, both tracked by git. They look like an
   `agent-browser` invocation whose flags were parsed as filenames. I left them alone — deleting
   someone's committed files unattended is not mine to do. `git rm -- --full-page --selector` if they
   are what they look like.

5. **Still not built, in the contract's order:** the confetti, `#/the-end` with 8-bit Riggs, and the
   rest of the copy extraction. All in PLAN.md §8 with the numbers not to re-derive.

6. **The bow tie's yellow is still unpicked**, deliberately. It belongs with `#/the-end`, which is not
   built, and it is a colour you should see rather than name.

## Change ledger

| #   | Commit    | What                                                                                                                                                              | How to try it                                                        | Risk   |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------ |
| 1   | `70be624` | Open the sprint: the contract, and where I narrowed it                                                                                                            | Read this file's top section                                         | none   |
| 2   | `fcdeb2b` | **The Bills stop instead of kneeling, and the roster walks on.** Six-beat clock, the summons, the walk-on, the reverence transform, her rise, and the copy module | Settings → god mode → `#/play/well` → the Bills → "Watch the ending" | medium |
| 3   | `31db5aa` | **The corner stopped saying she had won.** HUD win text moved off 1:30                                                                                            | Same path; watch the top-right corner for the first 13 s             | low    |
| 4   | `6643093` | **Hold-to-hurry after the first win**, with `clearedBefore` frozen                                                                                                | Beat them once for real, then again — hold Z during the ending       | low    |
| 5   | `9b560e3` | **The crowd hops**, and the ratified party states are reverted with the reason                                                                                    | Same path; watch the five during the applause                        | low    |
| 6   | `888c743` | **Bill the dog does backflips**, three seconds into the applause, and never stops                                                                                 | Same path; watch the dog from ~17 s                                  | low    |
| 7   | `9380621` | PLAN.md continuation, skills log, this report                                                                                                                     | `git show` it                                                        | none   |

Merge everything: `git checkout proactive/2026-08-26-1646 && git merge proactive/2026-08-27-1130`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## What actually changed in the game

The sequence runs the ratified table, and `ENDING_PROMPT_SECONDS` is **derived** from the beat
lengths rather than written down, so 19.5 s cannot drift away from the beats that sum to it.

| at         | what                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| **1:30.0** | Clock stops. Both Bills **stop** — foam finger up (`swatTell`), "ALL RIGHT—". No win text. |
| **+1.2**   | "EVERYBODY!" as the roster walks in from both walls. Otherwise total silence.              |
| **+6.2**   | They arrive and nothing happens.                                                           |
| **+7.7**   | Everyone kneels, the Bills included. The first frame that admits she has won.              |
| **+11.2**  | She rises and drifts to the horizontal centre, while they stay down.                       |
| **+13.8**  | Everyone stands and applauds.                                                              |
| **+19.5**  | The prompt fades in, in her own live key label. Held as long as she likes.                 |

Three things worth knowing about how it is built:

- **`theyConcede()` moved off the win event**, which is the correction the whole round turned on.
- **Kneeling is a transform, not five painters.** `drawReverent` sinks and tips a body about its own
  feet, signed by facing so the cast bows _inward_ toward her rather than east in unison.
  `drawEnemy` never learns the fight ended.
- **Her rise writes `player.position`, never the draw call**, so it cannot jitter off 60 Hz.

## Baseline (before any change)

- `npm test` — **green**: 728 tests in `web` (35 files), 1 in `server`.
- Working tree clean at the branch point.

## Final check (after the last change)

- `npm test` — **green: 754 in `web` (35 files), 1 in `server`.** +26 tests.
- `npm run typecheck` — clean. `npm run lint` — clean. `prettier --write` run over every file touched.
- **End-to-end**: the ending driven in headless Chromium through the dev seam, ten frames captured at
  the ratified beats. This is the pass that found ledger item 3 and killed the party states.
- One flake seen and explained: `storage/local.test.ts`'s eviction test took **653 seconds** and timed
  out — while a headless Chromium was capturing screenshots on the same machine. It passes in 75 ms
  on an idle box. Not a regression; do not chase it.

## Started, sliced, continued in PLAN.md

PLAN.md §8's "what is left of the ending" is rewritten as seven items: the cast gather struck as
BUILT, then the party states (with the rejection recorded), the backflip (now also BUILT), the
confetti, `#/the-end`, the rest of the copy extraction, and the cast-mark arithmetic.

## Tried and reverted

**The five's ratified party states.** Built exactly as PLAN.md §8 specified — a `partyPose()`
returning the `attackKind`/`phase` each painter already reads — typechecked, tested, and reverted
after one look in a browser. See "Needs you" item 2. The code is in the history of `9b560e3` if you
want it back; the rejected frame is kept.

## Ideas not acted on

- **The tableau is decided by where she happens to be standing at 1:30.** Nine fixed slots, five given
  to the roster. It is robust and it never overlaps anybody, but it means the ending's composition is
  different every time. A fixed composition — the five always in the same five places, the Knight
  walked to a mark during the kneel — would be a stronger picture and a bigger change. Your call.
- **`web/src/copy/` wants a sibling per area** (`fight.ts`, `lessons.ts`, `overlays.ts`) rather than
  one file with 256 keys. A deck generator can walk the directory.

## Environment changes

**None.** No installs, no upgrades, no global tools. Playwright was already a dependency
(`playwright-core` 1.62.1, Chromium 1234 already downloaded); the dev server ran on **5199** to stay
clear of your own Vite on 5174.

## Skills used

Logged in `docs/skills-log.md` as Session 14 (rows 41–43) with the observations. Short version:
`proactive` ✅, `agent-browser` ❌ (third cold-start hang — it is no longer worth trying first on this
machine), Playwright ✅ (found the defect every test passed).

## Suggested next session

Sit down with it rather than running `/proactive` again — **watch the twenty seconds** and answer the
two questions in "Needs you" item 1, because everything left in the ending is drawing and drawing
wants your eye. Then the confetti is the next slice, and the one caveat is already known:
`stepProjectile` has no gravity, so it needs its own step and it must honour `reduceFlashing`.
