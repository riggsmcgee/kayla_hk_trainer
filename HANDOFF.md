# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo  **Branch:** `proactive/2026-08-25-1527` (from `proactive/2026-08-24-2140`)
**Window:** 2026-08-25 15:27 to 17:27 local (120 min, focus: **get the Bills fully implemented**)
**Status:** done   **Relaunches:** 0
**Orchestrator model:** Opus  **Cost so far:** see `.proactive/sprint.json` runs

## What this was

"Get the Bills fully implemented" = **T11 + T12** of
[docs/plans/2026-08-24-playtest-3-build.md](docs/plans/2026-08-24-playtest-3-build.md) — the boss
engine core and its session/storage/page wiring. The art shipped last session and was already
wired into `drawEnemy`, so this sprint was the fight itself.

**It is done.** The Two Bills are playable end to end: open the well, walk to the third beat, meet
Bill the man, meet Bill the dog at 0:30, feel the heat at 1:00, chase 1:30. 450 → **516 tests**,
green throughout, typecheck and lint clean, build succeeds.

Screenshots of the real fight are in `.proactive/scratch/boss/` (not committed — that directory is
git-excluded). `09-the-dog-card.png` and `10-two-bills.png` are the ones worth a look.

## Needs you

1. **Nobody has played this.** Every number is derived against the shipped physics, exactly as the
   plan warned (§6 risk 20). The first playtest is a tuning pass and the only knobs are
   `ATTACKS.bill.lanceSpeed` and `lanceHeight` — **never `PHYSICS`**, whose gravity is the one
   estimated value in the engine and which prices the pogo course's ceiling section too. Two
   specific things to watch:
   - **A standing Knight is caught at about 0:02.** She does get the full 0.6 s tell, but it is a
     fast first meeting. `ATTACKS.bill.marchSpeed` or the opening beat (`OPENING_BEAT.bill`, 1.2 s
     in `enemies.ts`) are the gentler knobs if it reads as ambush rather than boss.
   - **Clearing the lance needs a HELD jump, not a tap.** Releasing at `jumpHoldMax` fires HK's
     jump cutoff and the hop tops out near 133 px — under Bill's 160 px head. This is fair and
     arguably good (it asks for commitment), but it is stricter than "be airborne" sounds, and it
     is the first place to look if she reports the lance as unfair.

2. **The finale now requires the Bills.** `finaleCleared()` gained `&& finaleBossCleared`, which
   moves the Knight on the road, `chapterDone('finale')` and PlayWell's "You walked the whole road"
   panel. This is the plan's own resolved reading (§6: *"The finale **does** require the boss to be
   done"*), but it is the one behaviour change here that reaches beyond the boss. Revert
   `finaleCleared` in `web/src/storage/progress.ts` if you disagree; the flipped assertions are in
   `progress.test.ts`.

3. **Two rules the build settled that you should see, because they are design, not code.**
   - **While she is over Bill's head he never lances.** A test forced this: the lance answers a
     ground approach, and starting one under her carries him out from beneath her so the shake-off
     can never fire — silently cancelling the ratified "first bounce is free". `stepBill`'s idle
     branch in `enemies.ts`.
   - **A mashed pogo chain is ended by his BODY, not by the swat.** The 0.41 s nail cadence
     desyncs from the ~0.6 s bounce and she drops onto his head, which is a touch because he has
     no pogo-safe cap (ratified, §6 point 8). The shake-off is the backstop for *hovering*. If you
     wanted the column to be the thing that punishes a chain, that is a tuning change, not a bug.

4. **One user-visible thing I have not watched: the 1:00 heat and the 1:30 crossing.** I drove the
   real session past 0:30 in a browser (see the screenshots), but the scripted survivor only reads
   Bill, so it dies once the dog is in. Those two moments are proved on the clock
   (`boss.test.ts`) and in a headless liveness run of the full ninety seconds
   (`boss.bot.test.ts`), but no one has *looked* at them. Given this project's own hard-won rule,
   flagging rather than claiming.

## Change ledger
| # | Commit | What | How to try it | Risk |
|---|--------|------|---------------|------|
| 1 | `ccb1890` | Opened the handoff; baseline recorded green | — | low |
| 2 | `0b34ef1` | `engine/boss.ts` — the fight clock, three latched thresholds, the card as a phase where `elapsed` does not move | `npx vitest run src/engine/boss.test.ts --root web` | low |
| 3 | `aa0aa52` | The Bills are furniture (invulnerability rides the existing `'blocked'`); `enemyHurtsBox` gives the rolling dog a pogo-safe top | `npx vitest run src/engine/arena.test.ts --root web` | low |
| 4 | `f3a3262` | `stepBill` — the arena-crossing lance that stops at the wall, and the shake-off swat | `... src/engine/attackers.test.ts -t "Bill the man"` | medium |
| 5 | `a84dfde` | `stepDog` — the spitter's fan and level 2's red orb, as a bouncing ball | `... -t "Bill the dog"` | medium |
| 6 | `22dd0b4` | `createBossSession` + storage (`PracticeRun.boss`, `ProgressV1.finaleBossCleared`, `bossBest`) | `npx vitest run src/engine/bossSession.test.ts --root web` | medium |
| 7 | `ce54b28` | PlayWell's third beat is a real fight; `beatDone(3)`/`beatLocked(3)`/`bossBestLine` | `npm run dev`, open the well, third beat | medium |
| 8 | `e4c50e3` | Handoff checkpoint | — | low |
| 9 | `90d9d6b` | The survival bot: standing loses, running loses, jumping at the tell wins | `npx vitest run src/engine/boss.bot.test.ts --root web` | low |
| 10 | `d801a07` | Doc sweep + the Bills added to `render.test.ts`'s telegraph contract | `npx vitest run src/engine/render.test.ts --root web` | low |
| 11 | `ccf1aa0` | The rolling ball's pogo-safe cap is drawn, from the same constant the hitbox uses | see `.proactive/scratch/boss/07-dog-poses.png` | low |
| 12 | `3c482f4` | A liveness pass over the whole 90 s: the dog arrives, both attacks fire, the heat lands, nobody leaves the arena | `... src/engine/boss.bot.test.ts` | low |
| 13 | `d650748` | 210 fixed-cadence Knights, none survives — the lance must be read, not timed | `... -t "rhythm"` | low |
| 14 | `a1238f2` | **The Bills never wear the gold punish rim** — found by watching, not by a test | `... src/engine/render.test.ts -t "punish rim"` | low |

Merge everything: `git checkout proactive/2026-08-24-2140 && git merge proactive/2026-08-25-1527`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)
All green.

- `npm test` — **450 passed** (449 web across 25 files, 1 server). No skips, no `.only`.
- `npm run typecheck` — clean across all three workspaces.
- `npm run lint` — clean.
- `npm run build` — succeeds; `index-*.js` 357.55 kB (112.63 kB gzip).

## Final check (after the last change)
All green; nothing that was green at baseline is red now.

- `npm test` — **516 passed** (515 web across 28 files, 1 server). No skips, no `.only`, no `.todo`.
- `npm run typecheck` — clean across all three workspaces.
- `npm run lint` — clean.
- `npm run build` — succeeds; `index-*.js` 367.84 kB (115.49 kB gzip), +10.3 kB for the boss.
- **End-to-end, in a browser** (Edge via Playwright, dev server on 5180): the well's third beat
  gated, unlocked, and played; the BILL THE MAN card; the lance windup and the charge; the fail
  screen and its restart; the best-time line reading a recorded run back; and the real session
  driven past 0:30 to watch the dog's card and both Bills fighting together. No console errors
  except the expected CORS noise from the optional practice server, which was not running.
- `git status` clean; nothing outside `.proactive/scratch/` was left behind.

## Started, sliced, continued in PLAN.md
T11 + T12 were sliced into seven independently shippable commits (clock → invulnerability → Bill →
dog → session+storage → page → bot), each with the suite green. Nothing was left half-wired.

What the boss still owes is written into **PLAN.md §8**:
- **The first tuning pass**, with the two watch-items from "Needs you" above.
- **Extending the survival bot through the dog**, so `bossSession.test.ts` can assert the 0:30 card
  and the 1:00 heat end to end instead of only at the clock level.

Untouched and still outstanding from the playtest-3 plan, unchanged by this sprint: **T6 slice 3**
(the duelist's reactive fencing), **T8/T9** (course hazards and intro demos), **T10** (two
reinforced waves).

## Tried and reverted
Nothing was reverted. Two things were retargeted rather than forced:
- Three `bossSession.test.ts` tests originally written for the 0:30 card were rewritten to cover
  what a Knight standing still can reach, because no bot survived to 0:30 at that point. The card
  is covered at the clock level, and later by the liveness run and the browser pass.
- The bot's "the swat catches a chain" assertion became "his body catches a chain", because that
  is what actually happens and it is the ratified behaviour. Recorded rather than tuned around.

## Ideas not acted on
- **The lance's opening is fast** (~0:02 against a standing Knight). Not tuned: tuning without
  playing is exactly what the plan forbids. Mirrored into PLAN.md §8.
- **The 1:00 heat has no announcement**, by ratified design ("no announcement, no new character").
  The HUD does gain a quiet line — *"they have your number now"* — which is one word more than
  ratified. Delete it if it breaks the intended silence; it is one `fillText` in `bossSession.ts`.
- **`trimRuns` can evict a long-but-uncleared best** (plan §6 risk 22). Still true for boss runs
  and still not worth over-engineering: once she clears 1:30 that run is `cleared: true` and
  protected. Not acted on, as the plan recommended.

## Environment changes
- Installed `playwright` (npm) into the **scratchpad only**
  (`…/40e362a0-…/scratchpad/node_modules`), not into the project. Nothing was added to any
  `package.json`. No browser was downloaded — the scripts drive the system's Microsoft Edge via
  `channel: 'msedge'`.
- A Vite dev server was run on **port 5180** (not 5174 — that is yours) and stopped.
- Nothing else: no global tools, no dependency upgrades, no config changes.

## Skills used
| Skill | For what | Verdict |
|---|---|---|
| `proactive` | the sprint itself | ✅ — the "decompose, do not abandon" rule is what fit a ~1,000-line, two-task plan item into two hours as seven green commits |

Also logged in `docs/skills-log.md` (Session 9), with the five observations worth keeping —
chiefly that a test written before play found a hole in the *ratified spec*, and that watching the
fight in a browser found the gold-rim bug that fourteen commits of tests did not.

## Suggested next session
1. **Play the Bills** for ten minutes and tune from there. Everything else in this sprint is
   proved; this is the only thing that cannot be.
2. Then pick up the playtest-3 plan where it stands: **T10** (the two reinforced waves) is the
   biggest remaining gap and the one the boss was built alongside rather than on top of.
3. `/proactive` is a reasonable way to run T8/T9 (the course hazards and intro demos) — they are
   well specified in the plan and need no taste calls. T10 wants you nearer, because it changes
   difficulty.
