# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo  **Branch:** `proactive/2026-08-25-1527` (from `proactive/2026-08-24-2140`)
**Window:** 2026-08-25 15:27 to 17:27 local (120 min, focus: **get the Bills fully implemented**)
**Status:** running   **Relaunches:** 0
**Orchestrator model:** Opus  **Cost so far:** see `.proactive/sprint.json` runs

## How I read the focus

"Get the Bills fully implemented" = **T11 + T12** of
[docs/plans/2026-08-24-playtest-3-build.md](docs/plans/2026-08-24-playtest-3-build.md) — the boss
engine core and its session/storage/page wiring. The art already shipped last session in
`renderBillMan.ts` / `renderBillDog.ts` and was already wired into `drawEnemy`, so this sprint is
the fight itself: the clock, the two state machines, invulnerability, the session, the run record,
and the beat-3 page. **All six slices landed.** The Bills are playable end to end.

**One deviation from the plan, deliberate:** the plan lists T11 as depending on **T10** (waves cut
to two, with reinforcements). T10 is not built and is not the focus, so the Bills sit on top of the
*current* three-wave world. Nothing in the boss reads the wave count — `beatLocked(3)` mirrors
`beatLocked(2)` over whatever `finaleWavesCleared` holds — so T10 can land later without touching
boss code.

## Needs you

1. **The finale now requires the Bills.** `finaleCleared()` gained `&& finaleBossCleared`, which
   moves the Knight on the road, `chapterDone('finale')` and PlayWell's "You walked the whole
   road" panel. This is the plan's own resolved reading (§6: *"The finale **does** require the boss
   to be done (1:30 is explicit in the decisions)"*), but it is the one behaviour change in this
   sprint that reaches beyond the boss itself. Revert `web/src/storage/progress.ts`'s `finaleCleared`
   if you disagree — the assertions that flip are in `progress.test.ts`.
2. **Nobody has played this yet.** Every number in the fight is derived, not felt — that was true
   in the plan (§6 risk 20) and it is still true. The first playtest is a tuning pass, and the only
   knobs are `ATTACKS.bill.lanceSpeed` and `lanceHeight`. **Never `PHYSICS`.**
3. **A rule the tests forced, which is a design decision you should see:** while she is over Bill's
   head he **never lances**. Without it he walks out from under her mid-charge and the shake-off
   can never fire, which silently cancels the ratified "first bounce is free". See
   `stepBill`'s idle branch in `enemies.ts`.
4. **Bill breaks the palette** (white shirt, blue jeans, orange foam finger on `#070912`) — plan
   §6 risk 23 asked for a screenshot check, which this sprint has not done yet.

## Change ledger
| # | Commit | What | How to try it | Risk |
|---|--------|------|---------------|------|
| 1 | `ccb1890` | Opened the handoff, baseline recorded green | — | low |
| 2 | `0b34ef1` | `engine/boss.ts`: the fight clock, three latched thresholds, the card as a phase where `elapsed` does not move | `npx vitest run src/engine/boss.test.ts --root web` | low |
| 3 | `aa0aa52` | The Bills are furniture (invulnerability rides the existing `'blocked'`); `enemyHurtsBox` gives the rolling dog a pogo-safe top | `npx vitest run src/engine/arena.test.ts --root web` | low |
| 4 | `f3a3262` | `stepBill`: the arena-crossing lance that stops at the wall, and the shake-off swat | `npx vitest run src/engine/attackers.test.ts --root web -t "Bill the man"` | medium |
| 5 | `a84dfde` | `stepDog`: the spitter's fan and the level-2 red orb, as a bouncing ball | `... -t "Bill the dog"` | medium |
| 6 | `22dd0b4` | `createBossSession` + storage (`PracticeRun.boss`, `ProgressV1.finaleBossCleared`, `bossBest`) | `npx vitest run src/engine/bossSession.test.ts --root web` | medium |
| 7 | `ce54b28` | PlayWell beat 3 is a real fight; `beatDone(3)`/`beatLocked(3)`/`bossBestLine` | `npm run dev`, open the well, third beat | medium |

Merge everything: `git checkout proactive/2026-08-24-2140 && git merge proactive/2026-08-25-1527`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)
All green, nothing was broken going in.

- `npm test` — **450 passed** (449 web across 25 files, 1 server). No skips, no `.only`.
- `npm run typecheck` — clean across all three workspaces.
- `npm run lint` — clean.
- `npm run build` — succeeds; `dist/assets/index-*.js` 357.55 kB (112.63 kB gzip).

## Final check (after the last change)
(not yet run)

## Started, sliced, continued in PLAN.md
(to be written at finalize)

## Tried and reverted
(nothing)

## Ideas not acted on
(to be written at finalize)

## Environment changes
(nothing — no installs, no upgrades, no global tools)

## Skills used
| Skill | For what | Verdict |
|---|---|---|
| `proactive` | this sprint | (pending) |

## Suggested next session
(not yet written)
