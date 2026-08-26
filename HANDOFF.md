# Proactive sprint handoff

**Project:** kayla-hk-dojo · **Branch:** `proactive/2026-08-26-1054` (from `proactive/2026-08-25-2008`)
**Window:** 2026-08-26, 120 min · **Status:** done · **Relaunches:** 0 · **Orchestrator model:** Opus

**Focus:** implement `docs/feedback/2026-08-26-playtest-5.md` in its ratified priority order, then build the gamepad settings.

**All seven priorities are built.** 608 → 660 tests, green at every commit. Read the contract, not
this file, for _why_ anything is shaped the way it is. This file is what happened.

---

## Needs you

### 1. Two decisions I made that the contract did not authorise. Both are cheap to reverse.

**The end screens do not work the way the contract describes, because that way cannot work.** The
contract ratified "a fresh press, not a longer lockout: a screen may only be dismissed by a key that
goes down after the screen appeared". I built exactly that — and the test that mashes X at
`PHYSICS.nailCadence` for a full second **failed**. A countdown of any length loses to a sustained
mash, because whatever the length, her next press is on the far side of it. What ships instead is
the same rule turned inside out: **every press re-arms the clock, and the screen opens after one
quiet mash-period.** She never presses twice — the presses that re-arm it are ones she was already
throwing at the fight, and the first press she aims at the screen is the one that works. Verified in
Edge, three seconds of mashing, screen still up. If you want the literal rule instead, it is one
function in [session.ts](web/src/engine/session.ts).

**`rollEveryHot` was left alone, and the hot cycle drifted.** The contract named `rollTime` 5→7 and
`rollEvery` 6.5→5 so the cold cycle stays near 12 s. It said nothing about hot, so the hot cycle went
from 9.5 s to **11.5 s** — which loosens hot pressure by exactly the logic the contract used to
tighten the cold one. Cutting `rollEveryHot` 4.5 → 2.5 restores it. That is a taste call and I left
it for you; it is written into PLAN.md §8.

### 2. The controller needs ten seconds of your time, and it might delete the milestone

The gamepad seam is built, tested and verified in a browser — but the acceptance test is a human
holding the board, and playtest 1 ratified M7 as not an autonomous-session task. Three things wait
on you:

- **Put the leverless in keyboard mode and press a button on Settings → Controls.** If it captures, a
  leverless already worked before any of this and the rest collapses to a note.
- **Open Settings → Controller with the pad plugged in and press a button.** The section names the
  pad and says whether your browser fitted it to a standard layout.
- **Check the default button POSITIONS against your Switch layout.** They are positions and not
  letters on purpose (below); if bottom-face-jump / left-face-attack is wrong for her, remap and tell
  me what she reports.

### 3. A test guard I deliberately weakened, with the numbers

`attackers.test.ts`'s naive-dodger guard required **2 of 5** roll variants to be survivable by
backing off and ducking. Playtest 5's lethal uncurl costs Metronome that, so it now requires **1**.
Measured before → after: Metronome survives → caught at 17.1 s; Loper survives → survives; Stutter
12.5 → 13.4 s; Terrier 5.5 → 5.7 s; Hunter 2.4 → 2.4 s. The table is in the test. This is exactly the
kind of "a test was quietly relaxed" move the contract warns about, so it is here rather than only in
a commit message.

### 4. The roll is derived, not played — and it spends nearly all the volley's slack

180 px leaves about **one** nail window to volley in, where Loper's old tall arc gave one and a
third. That was the ratified price of killing the jump-over. It has never been played by a person.
The same is true of the accepted loss of the roll's standing threat.

---

## Change ledger

| #   | Commit    | What                                                                             | How to try it                                                                | Risk       |
| --- | --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| 0   | `b3e2b14` | The previous session's uncommitted skills-log rows                               | `git show b3e2b14`                                                           | low        |
| 1   | `34ce109` | **The uncurl** (priority 1): the dog lands on the floor he touched, lethal 0.5 s | Boss fight past 0:30; watch the roll end. He trots out of the ball           | medium     |
| 2   | `6edc0c5` | Exhaustiveness fix typecheck caught and the suite did not                        | `npm run typecheck`                                                          | low        |
| 3   | `0740137` | **The end screens** (priority 3): all four wait for her to stop mashing          | Die to the boss, mash X — the screen stays. Stop, press X once — it restarts | medium     |
| 4   | `c67caf5` | **Wave 2** (priority 4): two spitters, a duelist, a warden; arrivals stand apart | Finale → waves → wave 2, watch 0:30                                          | low        |
| 5   | `ed332af` | **Gamepad** (priority 7): the seam, plus Settings → Controller                   | Settings page; plug a pad in and press a button                              | low        |
| 6   | `3652bd8` | **The roll's new shape** (priority 2): uniform 180 px, speedX 300, guard fixed   | Boss fight past 0:30. Dev drawer still has all six to compare                | **medium** |
| 7   | `2e201a3` | The juggled ball bounces off the lid instead of leaving the arena                | Rally the ball hard against the boss arena's ceiling                         | low        |
| 8   | `38742ef` | **Bill's anti-air** (priority 5) + the overhead-gate bypass closed               | Jump over him as he winds up the lance — he swats instead                    | **medium** |
| 9   | `fb87ded` | **The picks** (priority 6): stepped bones on the plain ring, and it is default   | Settings → dev drawer → dog look                                             | low        |
| 10  | `643c653` | The three documentation defects, plus PLAN.md §3, M7 and three continuations     | `git show 643c653`                                                           | low        |
| 11  | `bc1b87a` | `docs/skills-log.md` rows 28–30 and six observations                             | Read it                                                                      | low        |

Merge everything: `git checkout proactive/2026-08-25-2008 && git merge proactive/2026-08-26-1054`
Drop one: `git revert <hash>` on this branch first, then merge.

## Baseline (before any change)

- `npm test` — **608 web + 1 server, green**, 29 web test files.
- `npm run typecheck`, `npm run lint`, `npm run build` — all clean.
- Nothing red at baseline.

## Final check (after the last change)

- `npm test` — **660 web + 1 server, green**, 30 web test files. **+52 tests.**
- `npm run typecheck`, `npm run lint`, `npm run build` — all clean.
- **End-to-end in Edge** against the dev server: Settings renders the new Controller section with no
  console errors; the pogo mini-game still runs with the merged keyboard+gamepad input; the boss
  fight runs, and the fail screen survived three seconds of X mashed at `nailCadence` and then
  answered the first deliberate press. Screenshots in `.proactive/scratch/`.
- Nothing that was green at baseline is red.

## What each priority cost, against the contract

| #   | Contract priority       | Built                                                        |
| --- | ----------------------- | ------------------------------------------------------------ |
| 1   | The uncurl              | ✅ lands on next floor contact, 0.5 s lethal `walkIn` pose   |
| 2   | The roll's new shape    | ✅ uniform 180 px, `speedX` 300, `rollApexMax` struck        |
| 3   | The end screens         | ✅ all four, and the wave auto-advance deleted outright      |
| 4   | Wave 2's reinforcements | ✅ spitter + warden, and simultaneous arrivals stand apart   |
| 5   | Bill's anti-air         | ✅ plus the second-pass overhead-gate bypass closed          |
| 6   | The picks and defaults  | ✅ fourth look combination; defaults now resolve to the pick |
| 7   | The controller seam     | ✅ built — but the loop needs you, see "Needs you" 2         |

## Started, sliced, continued in PLAN.md

Nothing was left half-built. Three items are written into PLAN.md §8 as continuations because they
are decisions or need hardware, not because they ran out of clock:

- **The controller loop, closed by a person** — what her leverless actually reports.
- **The roll's second look, once it has been played** — the volley's remaining slack, and whether the
  dog now reads as harmless.
- **`rollEveryHot`** — see "Needs you" 1.

Also corrected in PLAN.md: the last portfolio step (measure what the winners share with the
near-misses) is recorded as **not-run** for playtest 5 rather than skipped — you could not recall the
near-misses. Worth asking again with the pages in front of you.

## Tried and reverted

**The first anti-air, which shipped the complaint it was built to fix.** Reading "she is airborne in
front of him" literally meant a hop anywhere in the arena aborted Bill's dash. `boss.bot.test.ts`
went from **0 of 210** fixed-cadence jumpers surviving thirty seconds to **112** — jumping had become
dramatically _more_ free. Narrowed to a vault over _him_ (`overheadHalfWidth`), it is back to 0 of
210, and the bot that reads the tell still survives every pass. Both bots are in the suite. This
never reached a commit; it is here because the failure mode is worth knowing about.

## Ideas not acted on

- **`STAGE_CLEAR_BANNER_SECONDS` is gone**, deleted with the auto-advance it existed for. If you ever
  want a minimum time on that banner it would come back as a floor rather than a timer.
- **The Gamepad API has no reliable "pad connected" event**, so Settings polls six times a second and
  the game polls every frame. If the Controller section ever feels sluggish that constant is
  `PAD_POLL_MS`.

## Environment changes

- `npm i -D playwright-core --no-save` — installed to drive Edge for the end-to-end pass, **not
  saved** to `package.json`. Nothing in the repo depends on it. `npm ci` would remove it.
- No other installs, upgrades or global tools.
- A Vite dev server was run on **5183** (from `web/`, not the repo root — the root has no
  `index.html`). Your own 5174 was untouched.

## Skills used

`proactive` (this sprint), plus `run` and `tdd` as standing rules. Rows 28–30 and six observations
are in [docs/skills-log.md](docs/skills-log.md). The two worth reading:

- **The end-screen design came from a failing test, not from the contract.** See "Needs you" 1.
- **The volley guard test was wrong twice, in the same direction** — the band 48 px too high AND the
  crossing doubled — which is how it scored an arc at 0.468 s that really yields 0.124 s. Two errors
  compounding the same way is what lets a wrong test survive review: each alone looks like a rounding
  argument.

## Suggested next session

1. **Play it.** Every number this sprint changed is derived. The roll's 180 px apex, the volley's
   remaining one nail window, and Bill's anti-air have never been in a person's hands, and the boss's
   first real tuning pass is still owed (PLAN.md §8).
2. **Ten seconds on the controller** — the three checks in "Needs you" 2. One of them might delete a
   milestone.
3. Then sit down with it rather than running `/proactive` again: what is left in the contract is
   taste, and taste is the thing an unattended sprint cannot supply.
