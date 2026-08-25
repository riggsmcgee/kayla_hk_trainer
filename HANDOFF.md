# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo  **Branch:** `proactive/2026-08-24-2140` (from `playtest-2-response`)
**Window:** 2026-08-24 21:40 → 2026-08-25 01:40 local (240 min, focus: implement `docs/plans/2026-08-24-playtest-3-build.md`)
**Status:** done   **Relaunches:** 0
**Orchestrator model:** opus   **Cost so far:** see `.proactive/sprint.json` runs

## Needs you

1. **Your four files are still uncommitted, deliberately.** `PLAN.md`, `docs/skills-log.md`,
   `docs/feedback/2026-08-22-playtest-3.md` and `docs/plans/` were in the tree when the sprint
   started. The guardrails forbid me committing work you left uncommitted, so I branched underneath
   them and never touched them. Nothing is lost — they are still dirty on this branch, and
   `git checkout playtest-2-response` carries them straight back. Commit them yourself:

   ```
   git add PLAN.md docs/ && git commit -m "Playtest 3: feedback doc, build plan, PLAN.md decisions"
   ```

   Two consequences: I could not do T13's `PLAN.md` sweep (the list of what it needs is below), and
   I could not append this session's rows to `docs/skills-log.md` (also below, ready to paste).

2. **Your laptop slept and it cost about 90 minutes of the four hours.** Exactly what you were
   warned about. I set the AC sleep timeout to never so the rest of the sprint would survive.
   **To put it back:** `powercfg /change standby-timeout-ac 3` — it was 180 seconds.

3. **The plan's breakage register is wrong in one place, and right everywhere else.** §5d says
   widening `EnemyId` cannot break `server/src/routes/runs.ts`, because `as const satisfies readonly
   EnemyId[]` accepts a subset. True of the `satisfies` — but not of
   `ENEMY_IDS.includes(x as EnemyId)`, which narrows to the five-literal tuple and fails to compile.
   Fixed in `d3c07ad`. Worth knowing before the remaining tasks are handed to agents that trust the
   register.

4. **Two of the plan's predicted duelist numbers did not reproduce.** The plan expected a run
   leaving 0.15 s after the bounce, and a run leaving mid-tell at 0.30 s, both to escape the
   anti-air. Neither does, because the column travels forward at `antiAirDashSpeed` while live: she
   nets only 72 px/s on it and needs about 80. What she actually gets is **~0.10 s to run out,
   ~0.20 s to dash out**, then she is committed. I pinned the measured behaviour rather than the
   predicted numbers, and wrote the table into the test. If playtest 4 says it is too harsh, the
   knob is `antiAirDashSpeed`, **not** the column size (that is what fixes note 6).

5. **The warden's skyward column is the one new thing I did not see with my own eyes.** Its geometry
   is asserted exactly in tests and it is drawn from those same constants, and its drawing code is
   structurally identical to the duelist column I *did* verify on screen — but no demo script
   provokes a skyward, so confirming it means playing the warden and hitting his raised shield from
   above. Worth thirty seconds before you put it in front of Kayla.

## Change ledger

| # | Commit | What | How to try it | Risk |
|---|--------|------|---------------|------|
| 1 | `6276b3e` | Sprint opened, baseline recorded | — | none |
| 2 | `d3c07ad` | **P0 seam pass.** `EnemyId` gains `bill`/`dog`; final 11-member `AttackKind`; 11 new `Enemy` fields; `drawEnemy` becomes an exhaustive `switch`; four extractions (`overheadOf`, `fanShots`, `formatClock`, `anyInput`); `FLOOR_Y` exported | `npm test` — behaviour-free by design | low |
| 3 | `3a18843` | **T1** (note 5) the dash streak stops when the dash does | Dash anywhere; the trail ends with it | low |
| 4 | `9ea23fe` | **T2** (note 8) every navigation lands at the top, focus moves into `<main>` | Scroll down, click any nav link | low — verified in browser |
| 5 | `21569c1` | **T5** (note 7) the Colosseum is one flat floor | Dodge Arena: the two ledges are gone | low |
| 6 | `d4e66b0` | **T3** (note 11) Z = forward, X = again, on every overlay | Clear a pogo level: **Z** takes the next level, **X** replays. Fail an arena stage: either key retries | medium |
| 7 | `c32fc9c` | Formatting-only sweep of ten files that predate the current prettier width | — | none |
| 8 | `0579532` | Mid-sprint handoff | — | none |
| 9 | `c7bfa45` | **T4** (notes 13, 14) one gold `Next: {title}` button per page; chapter strip demoted to small print; `ProveIt` deleted | Any lesson page, scroll to the bottom | medium — verified in browser |
| 10 | `e9f0b2b` | **T6 slice 1** (note 6) the duelist's anti-air becomes a tall forward column | Reading Enemies → the second demo; or pogo him in the arena | medium — verified in browser |
| 11 | `3433990` | **T7** (note 4) the warden answers an overhead hit with a skyward column, shield committed up, front bare | Dodge Arena → warden → downslash into his raised shield | medium — see "Needs you" 5 |
| 12 | `f7b3cc7` | Reading Enemies copy no longer claims each enemy has exactly two answers (ratified round 5, resolution 6) | Read the page | low |
| 13 | `9fed80c` | **T6 slice 2** (note 3) the duelist answers distance with a leap; plus a real `drift` wall-probe bug it uncovered | Dodge Arena → duelist → start the stage and stand still | medium — verified in browser |
| 14 | `6c01df3` | Arena stops scoring at the enemy that got her, not at the end of the enemy list | `npm test` | low |

Merge everything: `git checkout playtest-2-response && git merge proactive/2026-08-24-2140`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)

Clean everywhere. `npm test` **385 passed** (384 web across 20 files + 1 server), `npm run typecheck`
clean, `npm run lint` clean, `npm run build` succeeded (340.96 kB js / 25.45 kB css). Nothing was
broken before I started, so anything red now would be mine.

## Final check (after the last change)

- `npm test` — **430 passed** (429 web across 23 files + 1 server). No skipped, no `.only`.
- `npm run typecheck` — clean.
- `npm run lint` — clean, zero warnings.
- `npm run build` — succeeds (346.94 kB js / 25.33 kB css).
- Browser pass (Chrome via agent-browser against a dev server on 5199), screenshots in the
  scratchpad: home, a lesson page top and bottom, the gated mini-game page, the anti-air demo
  frame, and the duelist mid-leap in the arena. Verified there specifically:
  - navigating from a page scrolled to 628 px lands at `scrollY 0` with focus on `MAIN#main`;
  - exactly **one** `.next-button` per page, reading `Next: Pogo`, gold (`rgb(232,199,106)` —
    the CSS-move risk the plan flagged, resolved);
  - `.stop-title` computes to **15.3 px**, so playtest 2's ~15 px floor is held;
  - zero orphaned `.prove-it` / `.chapter-next` elements anywhere;
  - a **gated** page renders **no** forward button (the ChapterGate invariant);
  - the anti-air column draws standing on the duelist's shoulders with the Knight inside it and
    his body visible below — note 6, made visible;
  - the duelist reaches perch height mid-leap on a flat, ledgeless floor.

Nothing that was green at baseline is red now.

## Started, sliced, continued in PLAN.md

The plan's ratified order is **fixes → duelist → warden → flat Colosseum → course → waves → the
Bills**. The five fixes are done, the duelist has all three of his attacks, and the warden has his
third. What remains, in the plan's own order:

- **T6 slice 3 — reactive fencing.** The duelist's *attacks* are complete; his *idle movement* is
  still the old march-and-stalk. Slice 3 is the five-way footwork table driven by `lastTargetX`
  (advance when she retreats, give ground when she advances, hold when she is airborne), plus
  deleting `approachSpeed`. The `Enemy` fields it needs (`lastTargetX`, `retreatTimer`) already
  exist from P0 and are initialised; nothing is half-wired. Note that the plan's "airborne-hold
  rule" is what keeps `demo.test.ts`'s `duelistAntiAirDemo` green — the plan calls that the
  highest-risk assertion in the session, and it is still green today, so check it first if it goes
  red.
- **T8 course hazards, T9 intro demos, T10 waves, T11/T12 the Bills, T13 docs** — untouched. None
  of the plan's file-ownership assumptions were invalidated by what I landed, with the one
  exception in "Needs you" item 3. One line of T10 *is* done: the `arena.ts` `state.over` guard
  (`6c01df3`), so skip that bullet when T10 is picked up.

**T13's doc sweep, which I could not write** (`PLAN.md` is one of your uncommitted files):
`PLAN.md:196` still reads "Level 4, then the three waves. (The boss, once it exists — §8.)";
`PLAN.md:231` still says the boss is "Not yet built"; `PLAN.md:194` still shows "Prove it →" — that
button no longer exists, it is `Next: {title}` now. Also stale: `shared/src/types.ts`'s wave doc
comments saying "1–3", `storage/local.ts:127`, `storage/bests.ts:83`, and
`dodgeArenaSession.ts`'s `ArenaKind` comment claiming the HUD reads "wave 2 of 3".

**`docs/skills-log.md` rows for this session**, in the file's format, for you to paste:

| — | `proactive` | `/proactive 4 hours` — unattended sprint against the playtest-3 build plan | Drained the plan in its ratified order onto a sprint branch; 13 commits, 385 → 430 tests | ✅ | The clock discipline is the value: it forced honest slicing (T6 shipped as two independently-shippable slices rather than one unfinished one) and forced a stop for verification rather than piling on more unverified work. The handoff-as-you-go rule paid for itself when the laptop slept. |
| — | `agent-browser` | Verifying four user-visible changes that have no test seam (`vite.config.ts` pins `environment: 'node'` and collects only `src/**/*.test.ts`, so `.tsx` is never tested) | Computed-style and DOM assertions rather than eyeballing screenshots; canvas pixel-sampling to catch a 0.25 s attack window deterministically | ✅ | Reading `getComputedStyle` back beat screenshots for the things that mattered (the gold, the 15.3 px floor). For the canvas, sampling `getImageData` for a wide contiguous run and then returning `toDataURL` at that exact frame is far more reliable than screenshotting on a timer. |

## Tried and reverted

- **The first T3 commit swept ten unrelated files into itself** because I ran `prettier --write`
  across the whole tree. Reset, recommitted T3 with only its own ten files, and put the reflow in
  `c32fc9c` alone. Proof it was formatting-only: the suite stayed at 406 with those files rolled
  back.
- **Two dead ends writing the arena guard's test.** The first version asserted the whole-frame
  case, which `stepArena`'s existing early `if (state.over) return events;` already covers — it
  passed with the fix reverted, so it proved nothing. The second had a wrong premise (it assumed
  the hit landed by the enemy that kills her should *not* count; it should). The version that
  shipped puts a toucher behind her and a second enemy inside the nail, and is red without the fix.
  I checked each of T1's, T6's and this one's tests against a reverted fix before committing;
  that is how all three were caught.
- **`OVERLAY_LOCKOUT_SECONDS` on the fail screen**, briefly. Removed: `FEEDBACK.playerHit.hitStop`
  is 0.15 s and the frozen branch already swallows a reflex press there, so a lockout would have
  been a second guard over the same hole — and it broke the playtest-2 regression test that encodes
  the first one. The lockout is on the clear screens only, where the hit-stop is genuinely zero.

## Ideas not acted on

- **`tickDown` should probably replace the other hand-rolled countdowns.** T1 and T3 were the same
  bug twice: a float residue left by subtracting `1/60` repeatedly, so a `> 0` test runs one step
  long. `engine/session.ts` now has a tested `tickDown` for it, but `hitFlash`, `landSquash`,
  `respawnFlash`, `checkpointToast` and the enemy flash timers all still use
  `Math.max(0, t - dt)`. Those are cosmetic timers where a stray frame does not matter, which is
  why I left them — but if a third timing bug turns up, that is where to look first.
- **The `drift` wall-probe bug was latent for three playtests** and only surfaced because the leap
  moved the duelist near a wall. It probed a single point 21 px ahead of a 34 px body. Fixed in
  `9fed80c`. Worth asking whether any other single-point probe in the engine has the same shape —
  `stepWalker`'s `footingAhead` is the obvious candidate.
- **The repo has genuinely mixed line endings** (CRLF in `enemies.ts`, LF in `constants.ts`), which
  is why `prettier --check` cannot be used and why the definition of done says `--write`. A
  `.gitattributes` with `* text=auto eol=lf` would settle it permanently, but it rewrites every
  file once — your call, not mine.
- **The finale is now easier than it reads.** Nothing I did touched wave counts, but T5 removed the
  two ledges the arena had, which were cover. Worth a glance during playtest 4 before T10 changes
  the waves again.

## Environment changes

- **Windows AC sleep timeout changed from 180 s to never** (`powercfg /change standby-timeout-ac 0`).
  **Undo with `powercfg /change standby-timeout-ac 3`.** See "Needs you" item 2.
- **Installed `agent-browser` globally** (`npm i -g agent-browser`, v0.35.0) and its Chrome for
  Testing build (152.0.7977.54, ~193 MB, in `C:\Users\thoma\.agent-browser\browsers\`). Used for
  the browser pass. Remove with `npm rm -g agent-browser` and delete that folder.
- No project dependencies added, removed or upgraded. No config files touched.
- Scratch scripts were written **outside** the repo, in the session scratchpad, rather than in
  `.proactive/scratch/` — eslint lints everything under the repo root, and `.cjs` helpers there
  turned `npm run lint` red.

## Skills used

- **`proactive`** — this sprint. Verdict: ✅, and the parts that earned their keep were the clock
  and the write-the-handoff-as-you-go rule, not the process scaffolding.
- **`agent-browser`** — the browser pass. Verdict: ✅. See the skills-log rows above.

Both are logged above for `docs/skills-log.md`, which I could not edit.

## Suggested next session

Sit down with it rather than running `/proactive` again — the next three tasks all want a human
eye. Play the duelist and the warden for five minutes first: the duelist now has three attacks and
a leap that crosses the arena, and the warden's skyward column has never been seen on screen. Both
are tuned against derived numbers, and the plan itself budgets a tuning pass. **`antiAirDashSpeed`,
`gapDwell` and `skywardTop` are the knobs; `PHYSICS` is not.**

Then T6 slice 3 (reactive fencing) to finish the duelist, and **T10 whole or not at all** — cutting
three waves to two without the reinforcements makes the finale strictly easier, which is not what
was ratified. T8/T9 (the course) is the biggest remaining chunk and the most self-contained, so it
is the better candidate if you want to hand something to parallel agents.
