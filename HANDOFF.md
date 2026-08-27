# Proactive sprint handoff

**Project:** kayla-hk-dojo **Branch:** `proactive/2026-08-26-1646` (from `proactive/2026-08-26-1419`)
**Window:** 2026-08-26, 120 min, focus: build the ending in the website
**Status:** done **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

## How I read the focus

Your pick answered the one thing the last sprint was blocked on:

> "let's do the knee immediately after the fight, and then, as other characters come on to
> celebrate, we'll have the applause one play"

That is candidate **C (The Knee)** for beat 2 of the ratified sequence and **B (The Applause)** for
beat 3 — and it is a better answer than the question. The portfolio was built so that "choosing one
is deleting the other two"; you kept two and gave them different jobs. The knee means _they lost_,
the applause means _everyone is cheering_. Both are live in the game now.

So this sprint built **priority 5 of the playtest-6 contract**: the boss win phase, and the first
beat of the ending that sits on it.

## Needs you

1. **Nobody has looked at the ending yet, and that is the one thing I would check first.**
   `agent-browser` hung on its cold start for over three minutes — the same thing it did last
   session — and the clock ran out before it answered. Every claim below is proved by tests, and
   **tests cannot judge a pose**: that is the exact lesson from last sprint, where two of three
   celebration poses passed every test and were visibly broken. To look at it:
   Settings → god mode on → `#/play/well` → the Bills → **"Watch the ending"** in the dev line under
   the canvas. It jumps to one step short of 1:30 untouched. Watch for the two things a test
   genuinely cannot see: **whether the man's knee and the dog's lie-down read as a pair at game
   scale**, and **whether 0.34 is the right wash** — light enough to see them, dark enough for the
   text.

2. **The ending is one beat of four, and the other three are sliced into PLAN.md, not half-built.**
   What ships is: 1:30 ends the fight, the Bills concede, then they applaud under a "YOU DID IT"
   screen she advances herself. What does not: the rest of the cast coming on, the confetti, and
   8-bit Riggs's monologue. Each is written up in `PLAN.md` §8 with the numbers not to re-derive —
   including that the cast is **394 px of drawn ink, not 320**, and that `stepProjectile` has **no
   gravity**, so confetti needs its own step.

3. **The near-miss question is still open, and it is now cheap to answer.** You picked the Knee and
   the Applause, which makes **The Bow** the near-miss — the first time this project has had a clean
   answer to "which came second". The page is still up:
   <https://claude.ai/code/artifact/5abb4d4f-96c2-42e9-8a56-8433ca62d443>. What did the Bow nearly
   have, and what do the Knee and the Applause share that it does not? That step is how "the Bills
   must not be smoothed" stopped being a preference and became a constraint the code enforces.

4. **One consequence of the pick worth knowing about.** 1:30 is now pass/fail, so the boss no longer
   has a "best time" at all — the fight stops the moment she reaches it. That is exactly what the
   contract ratified ("an invisible score that runs past the ending is worse than an ending"), and
   `bestLine.ts` never had a boss line to lose. But if you wanted a time to chase after the ending,
   this is the sprint that closed that door, and reopening it is a design conversation.

5. **Still only you can close these** (unchanged): whether the new 180 px roll feels right,
   `rollEveryHot`'s 9.5 s → 11.5 s drift, and what your pads report against your Switch layout.

## Change ledger

| #   | Commit    | What                                                                                                              | How to try it                                                  | Risk   |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| 1   | `4454754` | Sprint opened; the pick recorded before anything was built.                                                       | —                                                              | low    |
| 2   | `66a89ac` | **The boss can be won.** 1:30 untouched ends the fight, both Bills go to a knee, then applaud under a win screen. | God mode → `#/play/well` → the Bills → **"Watch the ending"**. | medium |
| 3   | (this)    | PLAN.md: the struck 1:30 line, the pick, and the remaining three slices. The Session 13 skills log.               | `PLAN.md` §5 Mode 3 and §8; `docs/skills-log.md`.              | low    |

Merge everything: `git checkout proactive/2026-08-26-1419 && git merge proactive/2026-08-26-1646`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## What ledger row 2 actually changed

Worth reading before the diff, because three of the four pieces are invisible from the outside.

- **A sixth `BossPhase`, `'won'`.** `'over'` was the only terminal phase and it is reachable only by
  being touched — so **on a perfect run the last frame of the entire dojo was a loss screen reading
  "Got you."** `stepBoss` already returned early for every non-`fighting` phase, so the new one
  stopped the clock with no new freeze machinery.
- **`stepBoss` gained `untouched`, and it has to be told rather than inferred.** God mode routes hits
  through `wouldHaveHit`, and a god-mode run took 29 hits and still reached 1:30 in the browser. In
  god mode 1:30 is still just a marker and the fight runs on exactly as it always did.
- **`record()` moved out of the `'over'` branch.** Once 1:30 ends the fight, `'over'` is unreachable
  after it — so a win that did not record would leave no `PracticeRun` at all. That is the second
  half of the bug fixed in `819c0ea`, and it would have shipped again.
- **`Enemy.celebrating` is a channel the simulation never writes.** Driving a real attack phase to
  get the applause pose would arm a real hitbox. Nothing in the `'won'` branch reaches `stepArena`,
  `stepEnemy` or `stepProjectile` at all, so the tableau is harmless **by construction** rather than
  by anyone remembering to disarm it — which is what keeps this from reopening the immunity window
  playtest 4 and playtest 5 both struck.
- **The knee cannot be hurried and the cheer never times out.** The ending's gate is not armed until
  the cheer starts — the same reasoning that made the dog's card unskippable — and she advances the
  cheer herself.
- **The dev-drawer "Watch the ending" button** exists because god mode cannot reach the ending by
  design. It reuses `bringInTheDog` and the real thresholds rather than hand-placing a tableau, it
  rides the god-mode flag on the run it records, and it does **not** mark the stop cleared.

## Baseline (before any change)

Green at 16:48 — **706 web tests + 1 server**, clean tree, bundle 393.22 kB. Nothing was red.

## Final check (after the last change)

- `npm run test` — **728 tests passed** (35 files) + 1 server. Was 706.
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle 393.22 → **395.67 kB** (gzip 124.23). 2.4 kB for the phase, the ending clock and the win
  screen.
- **The `untouched` gate was mutation-checked.** Forcing it to `true` turns the god-mode integration
  test red, so the lock that keeps god mode out of the ending is load-bearing rather than
  decorative.
- **Not done: any end-to-end browser pass.** See "Needs you" 1. Nothing that was green at baseline
  is red now, but the visual claim is untested by eye.

## Started, sliced, continued in PLAN.md

The ending is four beats; **one shipped**. The other three are in `PLAN.md` §8 under the win-phase
entry, each independently shippable and in dependency order:

1. **The cast gathers** — real `Enemy` objects created at the win and walked to marks around where
   she stood, then held in celebratory states with `stepEnemy` never called on them. The states are
   already ratified (spitter fires upward, warden waves the shield, the duelist's anti-air already
   reads as applause, walker and flier in party hats). The trap to avoid is the one playtest 5 and
   playtest 6 were both burned by: **`ENEMY_SIZES` is the collision box, not the ink.**
2. **Confetti**, from the spitter's shots bursting at the top. Note `stepProjectile` applies **no
   gravity** — deliberately, because a spitter shot must fly true — so confetti needs its own step,
   and it must honour `reduceFlashing`.
3. **8-bit Riggs and the monologue**, in text boxes she advances. Blocked on nothing except the fact
   that **there is still no pixel font anywhere**, so he will speak in the HUD face and read as a
   placeholder.

Also unstarted, unchanged: the sandbox (note 3) and the scoring change (note 4).

## Tried and reverted

Nothing was reverted deliberately. One accident worth recording: I undid a mutation test with
`git checkout <file>`, which reverted the **file** rather than the **mutation**, and that file held
the whole win phase. About six minutes to redo from context, and it is in the skills log as a
lesson — mutation-test on a committed file, or undo the mutation the same way you made it.

## Ideas not acted on

- **The `'won'` phase leaves the Knight frozen where she stood** (she falls and lands if she wins
  mid-air, then holds). That is right for a cutscene, but once the cast arrives it may want her to
  turn and face them. Left until there is something for her to face.
- **`FEEDBACK.courseClear.trauma` fires at the win** — the shake the rest of the game already uses
  for a clear. It has never been felt at this scale, next to a screen that then holds still.
- **The other single-value hooks still have the per-component shape** (`useComfortSettings`,
  `useGodMode`, `useRollVariant`, `useEntranceVariant`, `useDogLook`) — unchanged from last sprint,
  and `useGodMode` is now read by one more consumer.

## Environment changes

- Nothing installed. A dev server may still be listening on **5179** (`npx vite --port 5179` from
  `web/`); yours on 5174 and last sprint's on 5178 were not touched.
- `agent-browser` was started and left a session named `kayla-ending` that never loaded a page.

## Skills used

`proactive` (the sprint), `agent-browser` (attempted, failed on cold start), and `tdd` as a standing
rule. All three logged with observations in `docs/skills-log.md`, Session 13.

## Suggested next session

**Look at the ending first** — thirty seconds with the dev button, and it either confirms the knee
or sends the pose back. Then the cast is a good unattended sprint: it is fully specified, every
state it drives already exists, and it is the beat that makes the screen look like a celebration
rather than two Bills kneeling in an empty arena.
