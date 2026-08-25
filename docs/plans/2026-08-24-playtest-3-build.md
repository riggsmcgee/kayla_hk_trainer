# Session 7 build plan — playtest 3 response

Merged from five read-only scouting reports, 2026-08-24. Every anchor below was re-verified
against `77866e0`. The contract is
[`docs/feedback/2026-08-22-playtest-3.md` § Ratified decisions](../feedback/2026-08-22-playtest-3.md#ratified-decisions-four-rounds-of-grilling-2026-08-22--24);
where a scout proposed something the user has not decided, it is in §6, not in the plan.

---

## 1. Orientation

This session answers the user's fourteen annotated playtest-3 notes and the four-round interview
that settled them. It is the largest session yet: five small chrome/engine fixes, two enemy
rewrites, a level-geometry pass with four new intro demos, a wave restructure, and the first boss —
**The Two Bills** — which is a survival clock, not a kill. The ratified priority order is
**fixes → duelist → warden → flat Colosseum → course → waves → the Bills**
([§ Priority for the next session](../feedback/2026-08-22-playtest-3.md#priority-for-the-next-session)),
and the plan keeps it: the Bills are last because they reuse the duelist's and warden's new
machinery and because Bill's painting arrives mid-session. One deviation, and it is sequencing
only, not re-prioritising: **the flat Colosseum (T5) lands inside phase 1**, because it is a
20-line deletion that removes the two ledges the duelist's leap and the warden's column would
otherwise be tuned against. Nothing ships earlier or later than the user ordered; only the diff
order changes. Everything before the Bills is playable on its own, so a session that runs out of
time still produces a coherent playtest-4 build.

---

## 2. Work breakdown

TDD = engine or pure logic, tests written first (the project's standing rule). UI = no test seam
exists (`web/vite.config.ts:13` pins `environment: 'node'` and `include: ['src/**/*.test.ts']`;
`.tsx` is never collected and jsdom is not installed) — verified in the browser instead.

| # | Task | Decision it implements | Files it OWNS | Depends on | Kind |
|---|---|---|---|---|---|
| **P0** | **Seam pass** — widen the unions, add the struct fields, land the three extractions and two exports, convert `drawEnemy` to a `switch`. No behaviour. | Enabling work for [duelist](../feedback/2026-08-22-playtest-3.md#the-duelist-notes-3-and-6--three-attacks-one-per-thing-she-can-do), [warden](../feedback/2026-08-22-playtest-3.md#the-warden-note-4), [the Bills](../feedback/2026-08-22-playtest-3.md#the-boss--the-two-bills-note-1) | `engine/input.ts`, `engine/clock.ts` (new), `engine/renderBills.ts` (new, stubs), `engine/constants.ts`, `shared/src/types.ts` (`EnemyId` only), `render.ts:15-45` + `:246-331` | — | TDD (thin) |
| **T1** | Dash trail snaps to 0 | [Fixes (note 5)](../feedback/2026-08-22-playtest-3.md#fixes-note-5) | `engine/player.ts`, `engine/player.test.ts` | — | TDD |
| **T2** | Scroll to top on every route change | [Controls and chrome (note 8)](../feedback/2026-08-22-playtest-3.md#controls-and-chrome-notes-8-11-13-14) | `components/ScrollToTop.tsx` (new), `App.tsx`, `styles.css` (`.site-main:focus` only) | — | UI |
| **T5** | Flat Colosseum — delete both ledges | [The Colosseum (note 7)](../feedback/2026-08-22-playtest-3.md#the-colosseum-note-7) | `dodgeArenaSession.ts:56-113`, `engine/enemies.test.ts` (ledge cases) | P0 | TDD |
| **T3** | Z = forward / X = again on every overlay | [Controls and chrome (note 11)](../feedback/2026-08-22-playtest-3.md#controls-and-chrome-notes-8-11-13-14) | `engine/session.ts`, `storage/keyNames.ts`, overlay branches in `pogoCourseSession.ts` + `dodgeArenaSession.ts`, `engine/pogoCourseSession.test.ts` (new), the `createSession` option objects in `PlayPogo.tsx` / `PlayDodge.tsx` / `PlayWell.tsx` | T5 | TDD |
| **T4** | The "Next: {title}" button system + demoted chapter strip | [Controls and chrome (notes 13, 14)](../feedback/2026-08-22-playtest-3.md#controls-and-chrome-notes-8-11-13-14) | `components/NextButton.tsx` + `ChapterNext.tsx` (new), `ProveIt.tsx` (delete), `ChapterNav.tsx`, `ChapterGate.tsx`, `styles/next.css` (new), `styles.css:635-719`, `styles/gates.css:62-86,130-142`, `Home.tsx`, the three lesson pages, `playPogo.helpers.ts`, all page JSX outside the `createSession` calls | T3 (contract only) | UI |
| **T6** | Duelist: bigger anti-air, the leap, reactive fencing | [The duelist (notes 3, 6)](../feedback/2026-08-22-playtest-3.md#the-duelist-notes-3-and-6--three-attacks-one-per-thing-she-can-do) | `enemies.ts` (duelist regions), `render.ts:345-439`, `demo.ts:91-126` (duelist cases), `attackers.test.ts` (duelist), `demo.test.ts` | P0, T5 | TDD |
| **T7** | Warden: the skyward column on a blocked overhead hit | [The warden (note 4)](../feedback/2026-08-22-playtest-3.md#the-warden-note-4) | `enemies.ts` (`resolveNailHit`, `shieldCovers`, warden regions), `render.ts:482-543`, `attackers.test.ts` (warden) | P0, T6 (same file, serialized) | TDD |
| **T8** | Course hazards: direction-aware spikes, L3 red orbs, L4 wall + ceiling | [The Pogo Course (notes 9, 10)](../feedback/2026-08-22-playtest-3.md#the-pogo-course-notes-9-10-12) | `engine/course.ts`, `render.ts:63-87`, `pogoCourseSession.ts:211`, `engine/course.test.ts`, `engine/render.test.ts` (new) | P0 | TDD |
| **T9** | Per-level intro demos | [The Pogo Course (note 12)](../feedback/2026-08-22-playtest-3.md#the-pogo-course-notes-9-10-12) | `engine/introGate.ts` + `engine/courseIntro.ts` (new), `demo.ts:53-62,256,330`, `pogoCourseSession.ts` step/render prologue | P0, T3, T8 | TDD |
| **T10** | Waves cut to two, with reinforcements | [The gauntlet's waves (note 2)](../feedback/2026-08-22-playtest-3.md#the-gauntlets-waves-note-2--cut-to-two-with-reinforcements) | `engine/roster.ts`, `engine/stages.ts`, reinforcement code in `dodgeArenaSession.ts`, `arena.ts:125` guard, `chapters.ts:65`, `playWell.helpers.ts:84-88`, `stages.test.ts` | T3, T5, T6, T7 | TDD |
| **T11** | The Bills — engine core (`boss.ts` + the two enemies) | [The boss (note 1)](../feedback/2026-08-22-playtest-3.md#the-boss--the-two-bills-note-1) | `engine/boss.ts` (new), `enemies.ts` (bill/dog regions), `arena.ts:160`, `attackers.test.ts` (bills), `engine/boss.test.ts` (new) | P0, T7, T10 | TDD |
| **T12** | The Bills — session, storage, page, art | [The boss (note 1)](../feedback/2026-08-22-playtest-3.md#the-boss--the-two-bills-note-1) | `engine/bossSession.ts` (new), `engine/renderBills.ts` (paint), `shared/src/types.ts` (boss fields), `storage/local.ts` + `bests.ts` + `progress.ts` + `useChapterProgress.ts`, `playWell.helpers.ts` (beat 3), `PlayWell.tsx:248-262,344-356` | T11, T4, T10 | TDD + UI |
| **T13** | Doc sweep | project rule | `PLAN.md:196,231`, `docs/skills-log.md` | everything | — |

**Lanes.** P0 lands alone and first. Then four lanes run in parallel:

```
P0 ──┬── Lane A (DOM)      T2 ──────────────────► T4 ─────────────────────────────► 
     ├── Lane B (sessions) T1 ─► T5 ─► T3 ───────┘
     ├── Lane C (enemies)  T6 ─► T7 ─────────────────────► T11 ──► T12
     ├── Lane D (course)   T8 ─► T9
     └── Lane E (arena)                    T10 (after T3, T5, T7) ──┘
```

Lane C is strictly serial: `enemies.ts` is one file and T6/T7/T11 all rewrite parts of it. Lane B
is serial for the same reason on `dodgeArenaSession.ts`. Lanes A and D never touch a file another
lane owns after P0, so they are genuinely concurrent.

---

## 3. File-ownership map

One task owns one file, except where a split is written out below. **A task never edits outside its
named region, never reformats a neighbour, and never "tidies" an import another task added.**

### 3a. Uncontested

| File | Owner |
|---|---|
| `web/src/engine/player.ts`, `player.test.ts` | T1 |
| `web/src/components/ScrollToTop.tsx` (new), `App.tsx` | T2 |
| `web/src/engine/session.ts`, `web/src/storage/keyNames.ts` (+ its test) | T3 |
| `web/src/components/NextButton.tsx`, `ChapterNext.tsx` (new), `ProveIt.tsx` (delete), `ChapterNav.tsx`, `ChapterGate.tsx`, `styles/next.css` (new), `Home.tsx`, `LessonSetup.tsx`, `LessonPogo.tsx`, `LessonReadingEnemies.tsx`, `pages/playPogo.helpers.ts` | T4 |
| `web/src/engine/course.ts`, `course.test.ts`, `render.test.ts` (new) | T8 |
| `web/src/engine/introGate.ts`, `courseIntro.ts` (+ their tests, new) | T9 |
| `web/src/engine/roster.ts`, `stages.ts`, `stages.test.ts`, `web/src/chapters.ts`, `chapters.test.ts` | T10 |
| `web/src/engine/boss.ts`, `boss.test.ts` (new) | T11 |
| `web/src/engine/bossSession.ts` (new), `storage/local.ts`, `bests.ts`, `useChapterProgress.ts` (+ their tests) | T12 |
| `web/src/engine/clock.ts` (new), `engine/input.ts` | P0 |

### 3b. Contested — the three the scouts predicted, plus five they did not

**`web/src/engine/enemies.ts` — four tasks want it. SERIALIZE. No exceptions.**

This is the single most dangerous file in the session: 800 lines, and P0/T6/T7/T11 all want the
same four structural points — `AttackKind` (`:28`), the `Enemy` interface (`:143-171`) and
`createEnemy` (`:182-205`), the `enemyAttackHitbox` switch (`:697-733`), and `resolveNailHit`
(`:757-785`). Two agents editing it concurrently will conflict on every one of those.

The fix is to **hoist every structural edit into P0**, so the three feature tasks only ever fill in
a case body:

- P0 widens `AttackKind` to its **final** union in one edit —
  `'lunge' | 'antiair' | 'leap' | 'volley' | 'riposte' | 'bash' | 'skyward' | 'lance' | 'swat' | 'bones' | 'roll'`
  — and gives `enemyAttackHitbox` (`:697`, exhaustive, no `default`, so TS2366 otherwise) a
  `case 'leap': case 'skyward': case 'lance': case 'swat': case 'bones': case 'roll': return null;`
  stub. T6 replaces the `leap` case, T7 the `skyward` case, T11 the `lance`/`swat` cases; nobody
  else touches the switch. *Every feature task's first hitbox test must assert its case returns
  non-null, so a forgotten stub cannot ship silently.*
- P0 adds **all** new `Enemy` fields in one edit and initialises them in `createEnemy`:
  T6's `leapStage / leapFrom / leapTo / leapAim / leapGroundY / awayTimer / retreatTimer /
  lastTargetX` and T11's `hot / sinceBounce / roll`. Grep confirms no test builds an `Enemy`
  object literal — everything goes through `createEnemy` — so this is inert.
- P0 widens `EnemyId` (`shared/src/types.ts:27`) with `| 'bill' | 'dog'` and fills the two
  `Record<EnemyId, …>` maps that go incomplete: `ENEMIES` (`constants.ts:156`) and `ENEMY_SIZES`
  (`enemies.ts:174`). `ROSTER` (`roster.ts:21-27`) stays five entries; `rosterEntry()` (`:30`)
  keeps throwing on `'bill'` — that is a correct safety net, do not loosen it.
- P0 lands the two **extractions** before anyone needs them, so no one races for them:
  `overhead(e, t)` (`:574-580`, hard-codes `ENEMY_SIZES.warden`) becomes
  `overheadOf(e, t, halfWidth)` with the warden calling it at a byte-identical 80 px / 0.8×height;
  and the spitter's fan (`:534-555`) becomes `fanShots(mouth, aimAt, count, spreadDeg, speed,
  radius?)`. Both are pure refactors and must leave `attackers.test.ts:151-167` and `:342-478`
  green **before** P0 is handed off.
- `resolveNailHit` (`:757-785`) is the one place T7 and T11 write adjacent lines: T11's
  invulnerability branch goes immediately after the per-swing dedupe (`:758-759`) and **before**
  T7's warden branch (`:761`). P0 leaves a one-line comment marking the insertion point. T7 lands
  first (priority 3), T11 second (priority 7), so T11 rebases onto T7's split — never the reverse.

**`web/src/engine/dodgeArenaSession.ts` — four tasks. SERIALIZE, by region.**

| Region | Owner | Note |
|---|---|---|
| `:44` `FLOOR_Y`, `:137-142` `formatClock` | **P0** | Export `FLOOR_Y`; lift `formatClock(seconds) → "m:ss"` into new `engine/clock.ts` and import it back. T12 then needs zero edits here. Do **not** confuse it with `pages/bestLine.ts:16` `formatClock(ms) → "m:ss.t"`. |
| `:56-57` `ArenaWorldKind`, `:71` `world:`, `:100-113` `arenaWorld` | **T5** | Delete all three. |
| `:92-96` config (`jumpKey`), `:243-259` + `:425-469` overlay branches | **T3** | Config becomes `extends OverlayControls`; T5's `world` deletion must land first or the two fight over the same interface block. |
| `:162-193` `loadStage`, `:310-315` respawn loop, the new `joinDue()` after `:317-342` | **T10** | |

**`web/src/engine/render.ts` — five tasks. SPLIT by function; the functions are far apart.**

| Lines | Function | Owner |
|---|---|---|
| `:15-45` | `COLORS` | **P0** — adds *every* new key in one edit (`billSkin`, `billHair`, `billShirt`, `billJeans`, `billShoe`, `foamOrange`, `dogWhite`). No other task appends here. |
| `:63-87` | `drawSpikes` | **T8** |
| `:246-331` | `drawEnemy` | **P0** — converts the if-chain to `switch (enemy.id)` with **no `default`**, and delegates `bill`/`dog` to `renderBills.ts` stubs. This is the highest-value P0 edit: today the chain ends in `else { drawWarden(...) }` (`:310-316`), so a new id renders as a 160 px warden **and still compiles**. |
| `:345-439` | `drawDuelist` | **T6** |
| `:482-543` | `drawWarden` | **T7** |
| `:595` | `drawKnight`'s `player.dashTimer > 0` gate | **nobody** — T1 fixes the engine and leaves this line alone, so it stands as the regression assertion. |

**`web/src/engine/pogoCourseSession.ts` — three tasks. Sequence T3 → T8 → T9.**
T3 owns the `courseState.finished` branch (`:138-142`); T8 owns the one `drawSpikes` call
(`:211`); T9 owns the new intro prologue, which must be inserted **above** `simTime += dt`
(`:126`) and therefore above T3's branch. T9 goes last so it can see T3's final overlay shape.

**`web/src/engine/arena.ts` — two tasks, adjacent lines in one `forEach` (`:155-165`).**
T10 adds `if (state.over) return;` at the top of the callback; T11 swaps `enemyBox(enemy)` →
`enemyHurtsBox(enemy)` in the damage check at `:160`. T10 first, T11 rebases. Two one-line edits;
do not let either agent touch the pogo-bounce comment block at `:147-154` — it encodes the
playtest-2 fix.

**`web/src/pages/PlayWell.tsx` — five tasks. SPLIT by component.**
The file is already partitioned into components, so ownership is clean if it is stated:
`LevelBeat` (`:74-121`) and `WavesBeat` (`:123-~245`) JSX → **T4**; their `createSession` option
objects (`:84-97` incl. `world: 'flat'` at `:172`) → **T3**, with T5 deleting the `world` line
first; `BottomBeat` (`:254-262`) and the beat-3 gate (`:344-356`) → **T12**; `BeatProps`
(`:64-72`) → **T4** (it adds `attackKey`); `WAVES` (`:45`) derives from `FINALE_WAVE_COUNT` and
needs **no** edit for T10.

**`web/src/pages/PlayPogo.tsx` / `PlayDodge.tsx` — two tasks.**
T3 owns the `createSession` option object only (`PlayPogo.tsx:53-67`, `PlayDodge.tsx:95-114`) —
that is where `hasNextLevel` dies and `onNext`/`nextLabel` are born. T4 owns all JSX
(`PlayPogo.tsx:100-110`, `PlayDodge.tsx:161-168`), including deleting the duplicate "Next stop →"
links those two panels render.

**`web/src/chapters.ts:65` `FINALE_DONE` — two tasks wanted it; give it to ONE.**
Both the waves slice (3 waves → 2) and the boss slice (mention the Bills) rewrite this line.
**T10 owns it and writes the final string in one edit**, so T12 never opens the file:

```ts
const FINALE_DONE = `Clear the level, ${countWord(FINALE_WAVE_COUNT)} waves and the thing at the bottom`;
```

`chapters.test.ts:48` currently asserts `.toContain(\`all ${countWord(FINALE_WAVE_COUNT)} waves\`)`
— T10 retargets it to `.toContain(\`${countWord(FINALE_WAVE_COUNT)} waves\`)`, keeping the
count-derived guard that stops the copy drifting. The spoiler guard at `chapters.test.ts:56` is on
`finale.line`, not `.done`, so "the thing at the bottom" is safe — and it is the same phrase the
beat chip already uses, so nothing is revealed.

**`web/src/pages/playWell.helpers.ts` — two tasks, different functions.**
T10 owns `waveName` (`:84-88`); T12 owns `beatDone`/`beatLocked` (`:37-57`) and the new
`bossBestLine`. `BEATS` (`:23-27`) is not edited by anyone — `BEATS[2].name` stays
**'The thing at the bottom'** (ratified: the chip keeps the mystery).

**`web/src/shared/src/types.ts` — three tasks, three disjoint regions.**
P0 owns `EnemyId` (`:27`); T10 owns the wave doc comments (`:60`, `:90`, both say "1–3");
T12 owns `PracticeRun.boss` (near `:63`) and `ProgressV1.finaleBossCleared` (near `:90`).

**`anyInput` — two tasks wanted to extract it. P0 does it.**
The predicate at `dodgeArenaSession.ts:262-264` is wanted by T9 (intro skip) and T12 (boss card
skip). P0 exports `anyInput(f: InputFrame): boolean` from `engine/input.ts`. Note it is
deliberately **broader** than `pogoCourseSession.ts:146-151`'s start-the-clock check, which
excludes `up`/`down`/`jumpHeld` so holding DOWN cannot start a run — do not unify those two.

**`bobPhase` — a collision the scouts missed.**
The waves slice seeds `bobPhase` per slot to stop identical twins fusing, on the stated grounds
that it is "read only by the flier (`enemies.ts:380-387`) and the spitter (`:506-509`)". T6 breaks
that assumption: it reuses `bobPhase` to drive the duelist's footwork sway. The interaction is
benign — per-slot seeding also de-syncs two duelists' footwork, which is *wanted* — but T10 must
not assert "seeding is inert for the duelist", and T6 must comment that `bobPhase` is now shared
by three enemies. T6 lands first; T10 reads it before writing the twin-separation test.

---

## 4. Per-task detail

### P0 — the seam pass

No behaviour. The suite must be green at the end of it, with the same test count.

1. `shared/src/types.ts:27` — `EnemyId` gains `| 'bill' | 'dog'`. Document that `EnemyId` is
   "everything the enemy sim can be" while `ROSTER` is "the five the Colosseum teaches".
2. `engine/constants.ts:137-146` — `EnemyTuning` gains `readonly invulnerable?: boolean`;
   `ENEMIES` (`:156-167`) gains
   `bill: { hp: 1, damage: 1, speed: 90, telegraph: 0.6, invulnerable: true }` and
   `dog: { hp: 1, damage: 1, speed: 120, telegraph: 0.45, invulnerable: true }`.
3. `engine/enemies.ts:174-180` — `ENEMY_SIZES` gains `bill: { width: 68, height: 160 }` (ratified
   160 tall) and `dog: { width: 64, height: 58 }` ("slightly larger than the Knight", whose sprite
   is 48 and hurtbox 18×47, `constants.ts:46-50`).
4. `engine/enemies.ts:28` — the final `AttackKind` union; `:697` gains the six stub cases;
   `:669-694` `stepEnemy`'s `switch` gains `case 'bill'` / `case 'dog'` that return `null` and do
   nothing.
5. `engine/enemies.ts:143-205` — all eleven new `Enemy` fields + their `createEnemy` defaults.
6. Extractions: `overheadOf(e, t, halfWidth)` from `:574-580`; `fanShots(...)` from `:534-555`;
   `anyInput(f)` into `engine/input.ts`.
7. `engine/clock.ts` (new) — `formatClock(seconds): string` lifted verbatim from
   `dodgeArenaSession.ts:137-142`; the session imports it. Output stays exactly `m:ss` —
   `arena.test.ts:660-672`'s `hudText` proxy reads the rendered strings.
8. `dodgeArenaSession.ts:44` — `export const FLOOR_Y = 600;`
9. `render.ts:246-331` — the `switch (enemy.id)` conversion with no `default`;
   `render.ts:15-45` — all seven new `COLORS` keys; `engine/renderBills.ts` (new) — `drawBill` and
   `drawBillDog` as correctly-proportioned grey boxes (68×160 and 64×58, feet-anchored).

**Tests first:** `overheadOf` reproduces `overhead` exactly for the warden (re-run
`attackers.test.ts:342-478` unchanged); `fanShots` reproduces the spitter's fan exactly (re-run
`attackers.test.ts:151-167` and `arena.test.ts:119-159` unchanged); `anyInput` is true for each of
the eight action fields and false for an all-false frame; `formatClock` round-trips `0 → "0:00"`,
`90 → "1:30"`.

---

### T1 — the dash trail (note 5)

**Cause, confirmed.** `player.ts:219` `const dashing = p.dashTimer > TIME_EPS;` (`TIME_EPS = 1e-9`,
`:20`), and `:247` `p.dashTimer = Math.max(0, p.dashTimer - dt);` sits **inside** the `if (dashing)`
branch. 15 steps of `1/60` from `PHYSICS.dashDuration = 0.25` (`constants.ts:86`) leave
`4.85722573273506e-17` — not `> TIME_EPS`, so the branch never runs again and the value is pinned
until the next dash. `render.ts:595` gates the streak on `player.dashTimer > 0`, which that value
satisfies forever. The arena never rebuilds the player mid-stage, hence "until the next dash".

`dashTimer` is the only timer shaped this way — `jumpBufferTimer`, `dashBufferTimer`,
`dashCooldownTimer`, `coyoteTimer`, `nailCooldownTimer`, `attackBufferTimer` are all decremented
unconditionally at `:311-325`, and `jumpPinElapsed`/`pogoPinElapsed` are set to `-1` at their
cutoffs. One site, one fix.

```ts
  if (dashing) {
    p.velocity.x = p.dashDir * PHYSICS.dashSpeed;
    p.velocity.y = 0;
    // Snap at the epsilon. 15 steps of 1/60 from 0.25 leave 4.9e-17, which is
    // NOT > TIME_EPS: without the snap this branch never runs again and
    // drawKnight's `dashTimer > 0` streak follows her forever (playtest 3, note 5).
    const left = p.dashTimer - dt;
    p.dashTimer = left <= TIME_EPS ? 0 : left;
  }
```

**Tests first** (`player.test.ts`, in the existing `describe('dash')` at `:461`):
1. after `dashDuration / FIXED_DT` = 15 steps, `expect(player.dashTimer).toBe(0)` — `toBe`, never
   `toBeCloseTo`, or `4.9e-17` passes and the test is worthless.
2. the dash still lasts exactly 15 steps: `velocity.x === PHYSICS.dashSpeed` on step 15 and not on
   step 16, so the snap cannot silently shorten the dash by a frame.

Leave `render.ts:595` at `> 0`.

---

### T2 — scroll to top (note 8)

`App.tsx:16` is `<HashRouter>` + `<Routes>` — a **declarative** router. `<ScrollRestoration />`
will **throw** here: in the installed react-router 8.3.0, `useScrollRestoration` opens with
`useDataRouterContext(...)`, which is an `invariant`. Do not reach for it, and do not migrate to
`createHashRouter` for this.

```tsx
export const MAIN_ID = 'main';

export function ScrollToTop() {
  const { pathname } = useLocation();   // pathname, not `location`: `key` changes on replace,
                                        // and App.tsx:43-46 has three <Navigate replace> redirects
  const firstRender = useRef(true);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);              // the page scrolls on window: .shell is
                                        // min-height:100vh; display:flex (styles.css:68-71),
                                        // with no overflow container. Never behavior:'smooth'.
    if (firstRender.current) { firstRender.current = false; return; }
    document.getElementById(MAIN_ID)?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
```

Mount inside `<HashRouter>`, above `<div className="shell">` (`App.tsx:16-17`); layout effects
commit in tree order. `<main className="site-main">` (`App.tsx:31`) gains `id={MAIN_ID}` and
`tabIndex={-1}`, plus `.site-main:focus { outline: none; }` next to the `:focus-visible` rule at
`styles.css:63-66`. Focus moves on a *navigation* only — a fresh deep-link or reload should leave
focus at document start.

**Do not "fix"** `PracticeCanvas.tsx:41`, which steals focus back to the canvas in a passive
`useEffect` after this layout effect. That is session 6's deliberate behaviour
(`components/focus.ts:1-6`) and it is why the keyboard works on a mini-game page.

No test seam. Browser-verify.

---

### T5 — the flat Colosseum (note 7)

`dodgeArenaSession.ts:100-113` — delete the `if (kind === 'colosseum')` block and its two ledges
(`{ x: 190, y: FLOOR_Y - 130, width: 140, height: 18 }` and the same at `x: 838`). Then `kind` is
unused, and `@typescript-eslint/no-unused-vars` is `'error'` with **no** `argsIgnorePattern`
configured (`eslint.config.js:26`), so `_kind` is flagged too. Therefore:

- `arenaWorld()` takes no parameter;
- delete `ArenaWorldKind` (`:56-57`) and `ArenaSessionConfig.world` (`:71`) and the
  `arenaWorld(config.world)` call (`:154`);
- **keep `PLAYER_SPAWN_X = 450`** (`:52`) — `spawnX` (`:126-130`) still depends on it being left
  of `CANVAS.width / 2 = 584`;
- fix the stale comments at `:8-9`, `:45-51` ("clear of both ledges…") and `:99`.

**Do not delete the ledge-avoidance AI** — `stepWalker`'s `footingAhead` edge turn
(`enemies.ts:263-279`), `SIDESTEP_REACH = 160` (`:284-288`) and `flyToward`'s sidestep
(`:308-356`) go dead in production but stay covered by the hand-built worlds in
`attackers.test.ts:226-255`. Leave a comment saying they are kept for future geometry.

**Tests first:**
1. Rehome the three ledge-behaviour tests onto a locally built platform world (`enemies.test.ts`
   already has `ledgeWorld()` at `:31-39`): `:269-277` (walker paces beneath), `:315-327` (flier
   blocked-not-pinned), `:329-341` (flier goes around).
2. `expect(arenaWorld().solids).toHaveLength(3)` — one line that makes note 7 a permanent property
   rather than a deletion.
3. Keep `arena.test.ts:729-751` (the session-6 spawn-column regression, apex 240) and drop only its
   `for (const kind of ['colosseum','flat'])` loop.

---

### T3 — Z = forward, X = again (note 11)

**Preserve the raw-press rule.** Both sessions read `rawInput`, not the merged frame, in their
overlay branches — `pogoCourseSession.ts:138-142` and `dodgeArenaSession.ts:243-259`, each with a
comment saying why, locked by `arena.test.ts:673-683`. `edgeCarry.merge(rawInput)` runs *before*
those branches and already drains both the jump and the attack carry (`juice.ts:108-119`), so
reading `rawInput.attackPressed` in the same place inherits the protection unchanged. Keep the
comment; extend it to name both keys.

```ts
// engine/session.ts
export interface OverlayControls {
  jumpKey?: string;      // default 'Z'
  attackKey?: string;    // default 'X'
  onNext?: () => void;   // Z on a clear screen; absent = Z inert, copy offers X only
  nextLabel?: string;    // "level 2", "the waves", "Reading Enemies"
}
/** Seconds an overlay ignores BOTH keys after it appears — see §6, open question 3. */
export const OVERLAY_LOCKOUT_SECONDS = 0.35;

// storage/keyNames.ts (jumpKeyName at :108-111 keeps working, now via the shared helper)
export function actionKeyName(bindings: Bindings, action: Action, fallback: string): string;
export function attackKeyName(bindings: Bindings): string;  // 'X'
```

Copy changes (current → new):

| Where | Now | After |
|---|---|---|
| `pogoCourseSession.ts:274-280` | `Press ${jumpKey} to run it again — or take the next level, just below.` | `Press ${jumpKey} for ${nextLabel} · ${attackKey} to run it again.` |
| `dodgeArenaSession.ts:425-429` | `Press ${jumpKey} to run it again from the top — or take the next stop, just below.` | `Press ${jumpKey} for ${nextLabel} · ${attackKey} to run it again from the top.` |
| `dodgeArenaSession.ts:443-447` | names no key | append ` Press ${jumpKey} to go now.` |
| `dodgeArenaSession.ts:465-469` | `Press ${jumpKey} to face ${foe()} again.` | `Press ${attackKey} to face ${foe()} again.` |

Note the **semantics flip** on the all-cleared screen: today Z replays from the top; after this, X
replays and Z goes forward. `hasNextLevel` (`pogoCourseSession.ts:53-57`, read at `:89` and `:275`)
is deleted — `onNext`/`nextLabel` replace it.

Forward targets, wired by T3 into the option objects and consumed by T4's JSX:

| Page | Overlay | `onNext` | `nextLabel` |
|---|---|---|---|
| `PlayPogo.tsx` | level clear, level < 3 | `() => selectLevel(level + 1)` | `level N+1` |
| `PlayPogo.tsx` | level 3 clear | `() => navigate(next.route)` (`:29`) | `next.title` |
| `PlayWell.tsx` `LevelBeat` | level clear | `onWaves` (already a prop, `:81`) | `the waves` |
| `PlayDodge.tsx` | all cleared | `() => navigate(next.route)` (`:58`) | `next.title` |
| `PlayWell.tsx` `WavesBeat` | all waves cleared | `() => selectBeat(3)` | `the bottom` |

**Tests first.** `createPogoCourseSession` has **no test file today** — create
`engine/pogoCourseSession.test.ts`, copying the two seams from `arena.test.ts`: the
`vi.mock('../storage/recordRun', …)` at `:20-25` and the `fillText`-capturing `hudText` proxy at
`:658-670`. **Promote that proxy into a shared test helper** rather than copy-pasting it a third
time.

1. the clear overlay names both keys and the `nextLabel`;
2. X on the clear screen resets the run; Z calls `onNext` exactly once and does **not** reset;
   with no `onNext`, Z is inert and the copy offers X only;
3. **the lockout**: an X pressed the instant the goal is touched does not skip the clear screen.
   This is the highest-value new test in the task — `FEEDBACK.courseClear.hitStop` is `0`
   (`juice.ts:137`) and `course.ts:169-170` sets `finished` on the same step the goal is touched,
   so nothing else protects it and she arrives mid pogo-mash;
4. rewrite `arena.test.ts:673-683` as the X version, keeping the 9-frozen-step arithmetic
   (`FEEDBACK.playerHit.hitStop = 0.15`, `juice.ts:135`);
5. every overlay names the right key with a **remapped** pair (`jumpKey: 'Space'`,
   `attackKey: 'J'`), so the copy is proven to follow her bindings rather than a hard-coded 'Z'.

---

### T4 — the button system and the demoted strip (notes 13, 14)

**The collapse is free, and provable.** `CHAPTERS` order is `setup, pogo, pogo-course,
reading-enemies, dodge-arena, finale` (`chapters.ts:67-124`), and
`chapterById('pogo').provesAt === 'pogo-course' === nextChapter('pogo').id`; likewise for
`reading-enemies`. So one component driven by `nextChapter(current)` covers both the lesson's
"Prove it →" and the strip's "Next stop →". **Add the assertion** to `chapters.test.ts` (beside the
`provesAt` tests at `:35-43`) so a future reordering cannot silently split them again:

```ts
for (const c of CHAPTERS) if (c.provesAt) expect(c.provesAt).toBe(nextChapter(c.id)?.id);
```

Two components: a dumb `NextButton` (link-or-click, `Next: {title}`, optional small `where` text)
and a thin `ChapterNext` that resolves the chapter and owns the end-of-road copy currently at
`ChapterNav.tsx:75-82`.

**CSS.** `.prove-it` and friends (`styles/gates.css:62-86`) are *already* the gold pill +
small-text-beneath the user is describing:
`.prove-it .button { font-size: 1.05rem; padding: .7rem 1.8rem; background: var(--gold) }`.
Move them to a **new `styles/next.css`**, renamed `.next-button` / `.next-button-where`, imported
by `NextButton.tsx`. This move is mandatory, not cosmetic: **`Home.tsx` imports no stylesheet**,
so rules left in `gates.css` (loaded only via `ChapterGate`) would render Home's new gold button
blue. Add `.next-button button.button { border: 0; cursor: pointer; line-height: 1.6 }` — `.button`
(`styles.css:264-287`) was written for `<a>` and `NextButton` also renders a real `<button>`
(the same reset already exists at `levels.css:99-104` and `settings.css:83-86`).

**Do not touch the import order in `main.tsx:3-8`** — line 7 imports `./styles.css` before line 8
imports `./App` precisely so per-feature sheets land later and win at equal specificity. The file
documents it.

Delete: `ProveIt.tsx`, `.chapter-next` (`styles.css:707-719`), `.chapter-next-title`
(`gates.css:130-132`), the `.chapter-next` block and `showNext` prop from `ChapterNav.tsx:19-21,29,
68-82`, and the duplicate forward links at `PlayPogo.tsx:104-110` and `PlayDodge.tsx:161-168`.

Keep the plain blue `.button` (it is the secondary style now that gold is forward) on
`ChapterGate.tsx:60-62` "Back to {place}" — ratified — on `Home.tsx:50-52` "Back down the well",
`PlayWell.tsx:365-367` "Back to the map", and `LevelPicker.tsx:107-109`.

**The strip.** Structurally it is *already* last on every page that renders it (`LessonPogo.tsx:69`,
`LessonReadingEnemies.tsx:108`, `LessonSetup.tsx:171`, `PlayPogo.tsx:118`, `PlayDodge.tsx:216`,
`PlayWell.tsx:375`); Home and Settings never render it. So the work is: take the loud thing out of
it (above), and make it small — `.chapter-nav` (`styles.css:635-639`), `.chapter-strip`
(`:641-648`), `.stop-place` `.92rem` (`:680-684`), `.stop-title` `.95rem` (`:686-688`), the lantern
`<svg width="12" height="18">` (`ChapterNav.tsx:51`). Shrink the place, the lantern and the gaps;
**hold `.stop-title` at `.85rem` (~15 px)** — see §6, open question 13.

**`ChapterGate` invariant:** a gated page renders the strip (`ChapterGate.tsx:70`) but must **not**
render `ChapterNext` — a forward button there would point her past the page she is locked out of.
Move the existing comment at `:68-69` onto the new arrangement so nobody re-adds it.

---

### T6 — the duelist (notes 3, 6)

**Ground truth, measured against the shipped physics — do not re-derive.**
`ENEMY_SIZES.duelist = { width: 34, height: 52 }` (`:178`). Today's anti-air box (`:709-715`) is
`x: e.x - 34, width: 68`, `y: e.y - 104, height: 52` — it spans **52–104 px above his feet**, and
her hurtbox is 18×47 hanging above her feet, so she is inside it only with her feet 5–104 px up.
A straight-down pogo chain keeps her feet in **[116, 242]** (contact 121.9 → 120.0 → 118.1, apex
~240, period **0.600 s**). The box tops out at 104: **12 px of pure geometry** is why note 6
happens. The cycle (0.35 + 0.25 + 0.55 + 0.6 = **1.75 s**) is the second half of the problem.

**Anti-air → a tall forward column**, expressed as `ATTACKS` constants so `render.ts` draws exactly
the box: `antiAirTop: 210`, `antiAirWidth: 120`, `antiAirForward: 20`, plus
`antiAirDashSpeed: 260` drifting along `lockedDir` during the active phase (the `drift` call at
`:455-462` currently only fires for `'lunge'`). 210 because she is caught anywhere in the chain
band once `boxTop ≥ 195`; ±60 wide because the only escape must be horizontal, and 0.35 s of tell
buys 116 px at run speed (332) or 233 on a dash — a plain run clears with 56 px to spare, standing
still or bouncing again does not. Keep `antiAirActive 0.25` / `antiAirRecovery 0.55` /
`cooldown 0.6`: the punish window is unchanged. He stays grounded in simulation; the rise is
drawing only (`render.ts:353-360` already lifts him 34 px — take it to ~46).

Simulated against the state machine: chaining forever → **caught at 0.433 s**; one bounce then run
or dash → never caught; leaving mid-tell → never caught; going for the second bounce → caught.
That is "one hit, then get out" made literal.

**The gap-closer (`'leap'`)** — four beats in one attack, so it needs a sub-stage:
`telegraph` (0.35) → `active` with `leapStage: 'rise' | 'hang' | 'dive'` → `recovery` (0.9).
`gapRange 260`, `gapDwell 0.8`, `retreatDwell 0.5`, `leapRise 0.4`, `leapHang 0.2`,
`perchOffset 210`, `perchHeight 200`, `diveSpeed 900`, `leapMaxDx 460`, dive box 60×70 lead 20.
Aim is captured **at the end of the hang** (`leapAim = normalize(target - e.position)`, `aim.y`
floored at 0.15). The hitbox is `null` during rise and hang — he is not attacking, and she may even
pogo him at the perch. Against a static Knight 838 px away the dive catches her at **t = 2.08 s**
with ~0.95 s of visible warning: the longest reach on screen, as ratified.

**Mandatory geometry safety:** rise and dive set position directly and bypass `drift`'s wall probe.
Clamp the perch with the module-private `insideSolid(world, bodyAt('duelist', x, y))`
(`:224-246`), nudging toward his start until free, and end the dive into `recovery` early if the
next step would be inside a solid. Without this, `enemies.test.ts`'s `stuckSteps === 0` fails — or
worse, he lands inside a wall in play. (T5 lands first, so the Colosseum ledges are already gone;
the flat arena still has walls and the well is unchanged.)

**Reactive fencing** must be judged on **her** movement, not on `adx` — `adx` shrinks because *he*
closes, and an `adx`-based away-timer never fires against a static Knight. Hence `lastTargetX`:

| she is | he does | px/s |
|---|---|---|
| beyond `stalkRange` (300) | marches | `marchSpeed` **130** (was 100) |
| **airborne** | holds his ground | **0** |
| retreating | advances | `fenceAdvance` **170** |
| advancing | gives ground | `fenceGive` **120** |
| still | closes | `fenceHold` **80** (was `approachSpeed` 45) |

plus a deterministic sway `sin(bobPhase · 0.7 · 2π) · 40` px/s, never closer than `standOff` (100).
Delete `approachSpeed`.

**The airborne-hold rule is load-bearing.** Simulating the shipped demo scripts under the full new
machine keeps `duelistLungeDemo → kinds ['lunge']` and
`duelistAntiAirDemo → kinds ['antiair'], clip at t ≈ 1.53` green **only** because he does not
backpedal from a jump-in. Treat that as a strong hint, not a guarantee — the simulation had no wall
probe.

**Tests first:**
1. **Write the missing `duelistLungeDemo` guard in `demo.test.ts` FIRST and confirm it is green on
   the current tree** — `kinds === ['lunge']`, ghost never swallowed (`|enemyX - ghostX| > 24`).
   That demo has no test today and is the only silent-breakage surface in the task.
2. anti-air geometry pinned against `ATTACKS` so the drawing cannot drift from the box.
3. **the note-6 regression**: drive a `Target` through the measured chain profile (contact 120 →
   apex 240, period 0.600) above a duelist with `cooldownTimer 0`; the swipe overlaps her within
   0.75 s (expect ~0.43).
4. its three mirrors: leaving at run speed from the first bounce is never caught; leaving at
   t = 0.30 mid-tell is never caught; staying for the second bounce **is** caught.
5. the swipe drifts at `antiAirDashSpeed` and no faster.
6. leap triggers: standing still 400 px away provokes after `gapDwell`; walking away at 150 px
   provokes after `retreatDwell`; walking **in** never does.
7. leap choreography: perch height within `leapRise`; hang holds; **move the target during the hang
   and prove the dive still goes where she was**; lands with feet exactly on `leapGroundY`;
   `recovery` exposes no hitbox.
8. `enemyAttackHitbox` is null during rise/hang, non-null during dive.
9. the leap never enters geometry, from several x positions.
10. the five-way fencing table, measured over 60 steps with ±40 px/s tolerance for the sway.

---

### T7 — the warden's skyward column (note 4)

The provocation seam is already there. `resolveNailHit`'s block branch (`:761-774`) calls
`shieldCovers` (`:788-796`), which computes `hitFrom = player.nailDir === 'down' ? 'up' : 'front'`.
Hoist `hitFrom` out, pass it in, and split:

- `front` → **unchanged riposte**, `shieldDir = 'front'`;
- `up` → `attackKind = 'skyward'`, `lockedDir = sign(player.x - e.x)`, **`shieldDir = 'up'`
  (committed upward, front bare)**, `lingerTimer = 0`, `setPhase('telegraph', skywardTell)`.

`skywardTell 0.5`, `skywardActive 0.3`, `skywardRecovery 1.0`, `skywardTop 250`,
`skywardWidth 170`, `skywardBack 45`. The column's **bottom sits at his head** (his size is 40×56,
`:179`), so a Knight standing in front of him on the ground is never inside it — that is what makes
step 3 of her loop work even during the active phase. No drift during the active phase (branch
`:648`): a `bashSpeed`-style lunge would ruin the "front is open" promise. Suppress the shield
re-aim during skyward recovery (`:597`) so the shield stays visibly up until he is idle again.

The loop, timed against real physics (she blocks at feet ≈ 120-126 above his feet and is bounced by
the same contact, `arena.ts:147-155`, test at `arena.test.ts:271`): tell 0–0.5 s while she must
cross 45–125 px sideways (0.5 s buys 166 running / 283 dashing); column live 0.5–0.8 s, and falling
straight down does **not** save her — she is still at h = 187 at 0.5 s and only clears the column's
56 px floor at 0.695 s; she lands at 0.76; recovery 0.8–1.8 s open from every side; she strikes the
front at ~1.3; shield re-aims at ~1.98.

Two deliberate consequences to state out loud: a downslash into the raised shield **during** the
skyward tell is still blocked and, being outside `idle`, does not restart the attack — overhead is
simply the wrong place to be (see §6, open question 10); and a Knight who blocked from behind his
facing is still inside the column, because `lockedDir` locks to her side at the block.

`drawWarden` (`:482-543`): `const bash = enemy.attackKind === 'bash'` (`:487`) is now three-way,
and the recovery sag at `:514-524` measures against `bashRecovery`/`riposteRecovery` — add a
`recoveryTotal(kind)` helper or skyward sags at the wrong rate.

**Tests first:** a blocked **downslash** provokes `'skyward'` and commits `shieldDir` to `'up'`
(this *rewrites* `attackers.test.ts:342-369` and `:404-423`); a blocked **front** slash still
provokes `'riposte'` with `shieldDir 'front'`; the column's bottom is at his head so a grounded
Knight in front is never inside it; a Knight hovering where she blocked **is** inside it at the
start of the active window; a front slash lands throughout the tell and the recovery; the shield
does not re-aim during skyward recovery; and extend `arena.test.ts:271` to assert
`attackKind === 'skyward'` — one contact, one bounce, one provocation.

---

### T8 — course hazards (notes 9, 10)

**The one mechanism that answers "pogoable or not".** `stepPlayer` (`player.ts:302-309`) bounces off
anything in `world.pogoables`, full stop — there is no per-box flag. Pogoability is list membership,
decided by `pogoablesAt` (`pogoCourseSession.ts:70-80`). Therefore: **do not add a `dir` field to
`CourseDef.spikes`.** Add a *second* list, `spikeWalls: SpikeWall[]`, fed to `stepCourse`'s hazard
check and never to `pogoablesAt`. That keeps `spikes: AABB[]` byte-identical (so the frozen Level-1
snapshot at `course.test.ts:262-322` passes verbatim — its own comment says "the fix is to put
Level 1 back, not to update the JSON"), keeps floor spikes pogoable as ratified, and makes an
up-facing **wall cap** non-pogoable too, which a direction field would have got wrong.

```ts
export type SpikeDir = 'up' | 'down' | 'left' | 'right';
export const SPIKE_DIRS: readonly SpikeDir[] = ['up', 'down', 'left', 'right'];
export interface SpikeWall { box: AABB; dir: SpikeDir }
```

`stepCourse` (`:144-190`) gains a third hazard loop after `spikes` and `hazardOrbs` (`:174-187`),
identical shape. `LevelSpec` (`:216-227`) gains `walls?: WallSpec[]` and `ceilings?: CeilingSpec[]`,
expanded in `buildCourse` (`:233-270`) **after** the two bounding walls at `:254-255` — a wall is a
solid core on `PIT_FLOOR_Y` (656) plus three `SpikeWall` boxes (left face, right face, up cap); a
ceiling is a down-facing teeth band at `tipY` plus a 200 px solid slab above it.

**Two collision traps with existing test predicates**, both avoidable by construction and both to be
asserted: `course.test.ts:344`/`:370` identify pits as `s.y > COURSE_FLOOR_Y && s.height === 200`,
and `:422` identifies walkways as `s.y === COURSE_FLOOR_Y`. **Never author a 56 px wall** (its core
would land on `y === 600` and be read as a walkway, truncating the bot's `floorAhead`).

`drawSpikes` (`render.ts:63-87`) generalises to slice along the *long* axis with a defaulted third
parameter. `dir: 'up'` must be **pixel-identical** to today (`tooth = 16`,
`teeth = max(1, floor(width / 16))`, triangle `(x0, y+h) → (x0+w/2, y) → (x0+w, y+h)`, tip
`(cx-2.5, y+7) / (cx, y) / (cx+2.5, y+7)`). There is exactly one call site
(`pogoCourseSession.ts:211`), so the default is safe.

**Level 3 (note 9):** keep pits A–C pure drift — they are the teaching ramp. Put three reds in the
x-gaps the mover orbits do not sweep: pit D `{ cx: 3160, top: 500 }`; pit E `{ cx: 3700, top: 486 }`
and `{ cx: 3860, top: 500 }`. Tune against the bot, never by eye.

**Level 4 (note 10):** do **not** retrofit pits A–D — they are bot-proven at their current spacing.
**Extend** the level with two new pits, which also reads correctly (hostility arrives late).

Derived physics, verified by simulation of `PHYSICS`: pogo rise is exactly **120 px**; a full held
jump apex rise is **233 px**; a down-nail catches an orb of top `T` when feet ∈ `(T−70, T+28)`;
post-bounce **head** apex = `bounceFeetY − 167`; horizontal travel during the 0.25 s pin is 83 px.

*Pit E — the wall.* launch red `cx 4120, top 486` · wall `cx 4220`, cap top **y 440** · landing red
`cx 4340, top 500` · pit `4060–4420`. All four swing timings clear it (lowest feet over the wall
338 / 366 / 396 / **426** — the latest by only 14 px, and that 14 px *is* the challenge); a full
jump from the ledge puts her at ~467 and clips. **Sensitivity: the wall must sit 90–110 px
downstream of its launch orb** — at +140 the survivable height drops to 148, at +180 to 66. Do not
nudge either without re-running the sim.

*Pit F — the ceiling.* Safe ⇔ `bounceFeetY − 167 > tipY`. **Tips at y = 330, blue orbs at top 540**
(~180 px apart, three of them): legal swing band feet ∈ (497, 568) ≈ 71 px ≈ 6 steps, and a full
jump from the ledge puts her head at 320 and clips — by design. Orbs must be **blue**: a low bounce
puts her body beside the orb, which is exactly what red punishes, and mixing them here would
contradict level 2's lesson.

Bookkeeping: width 4300 → ~5000, goal → ~4780, and **two new lanterns** — `course.test.ts:371`
requires `checkpoints.length >= pits.length - 1`, so 6 pits need ≥ 5, and `:376` forbids a lantern
over a pit.

**The bot must be taught the ceiling, and that is the point.** `runAimingBot`
(`course.test.ts:415-544`) swings at the top of the nail window, so its post-bounce head apex is
`T − 237` ≈ **303** for orbs at top 540 — above a 330 tip line. Give it `ceilingTipAbove(course, x)`
plus two rules: jump lower (`releaseY = max(target.y − 140, ceil + 47 + 20)`) and swing later (gate
the attack on `feetAtSwing.y > ceil + 167 + 12`). A bot that must delay its swing to survive **is**
the proof that the ceiling teaches "bounce low" — write that in the comment. Run the suite once with
the bot change and **no** level changes to prove it is a no-op where there is no ceiling.

`spikeWalls` must **never** be added to the bot's `world.pogoables` (`:437`) or `spikeBounces`
(`:527`, asserted `0` at `:613`) stops meaning what its comment says and the wall proof goes vacuous.

**Tests first:** the `drawSpikes` pixel-parity test against the **current** function (must pass
before anything is touched — nothing in the repo pixel-tests the renderer, and this is the riskiest
silent change in the task); a spike wall is a hazard but never a pogo target (mirror of the
hazard-orb pair test at `:141-189`); floor spikes stay pogoable; `POGO_COURSE_1.spikeWalls` is `[]`,
added to the frozen block at `:314-317` **before** `buildCourse` is touched; walls and ceilings
never masquerade as terrain; levels 1–3 have no `spikeWalls` at all and level 4 has both a `'down'`
and a side; no lantern, spawn or checkpoint respawn stands under a ceiling or inside a wall; and
`course.test.ts:350` rewritten to `l3.hazardOrbs.length > 0` **and** `< l2.hazardOrbs.length` so
the teaching hierarchy stays honest.

---

### T9 — the intro demos (note 12)

**Shape: a demo phase inside `createPogoCourseSession`, not a page-level canvas swap.** A swap
would remount the canvas (flicker, lost focus — playtest 2's review already fixed a focus bug here)
and force the page to own an input listener that `LessonDemo.tsx:20-45` deliberately does not have.
`createDemoSession` (`demo.ts:212-338`) already does everything else: it accumulates
`dt * timeScale`, steps at `FIXED_DT`, re-runs `setup()` at `cycle`, draws world/player/ghost/phase
bar, and renders `caption(actors, t)`.

Two new modules: `engine/introGate.ts` (the pure state machine) and `engine/courseIntro.ts` (one
`DemoScript` per level, plus `courseIntroFor(level)` clamped like
`createPogoCourseSession`'s level clamp at `:87`).

Session prologue, **above `simTime += dt` (`:126`)** and therefore above T3's overlay branch:

```ts
if (gate.active()) {
  gate.step(rawInput, dt);
  if (gate.active()) introSession.step(IDLE, dt);
  return;                      // the skipping press is CONSUMED, never merged, never carried
}
```

`render()` delegates to `introSession.render(ctx, alpha)` plus a dim skip hint, then returns.

**The skip must arm on quiet, not fire on frame 1.** A new `createKeyboardInput` starts with `held`
empty, so a still-held Z from the previous clear screen is not seen at mount — but OS **auto-repeat**
fires a fresh `keydown` ~0.3–0.5 s later (`input.ts:139-145` dedupes only via its own `downCodes`,
empty in the new instance) and would kill the demo mid-sentence. Same class of bug as playtest 2's
"reflex Z inside the death hit-stop". Hence `INTRO_ARM_SECONDS = 0.4` and an armed-on-quiet flag.

**Where the flag lives: a closure variable at session construction.** Verified: a clear does **not**
rebuild the session — `PlayPogo.tsx:53-67`'s `createSession` deps are
`[level, comfort, hasNextLevel, jumpKey, refresh]`, and `comfort` (`useState`), `bindings`
(`useState`) and `refresh` (`useCallback([])`) are all stable across a `refresh()`;
`PracticeCanvas.tsx:53`'s effect deps are `[createSession, bindings]`. A retry therefore never
re-enters the intro, and a new level gets a new session (keyed `PlayPogo.tsx:92`) and a new intro.
**This stability is load-bearing — leave a comment saying so**, or a clear replays the intro.

Give the scripts `view: { width: CANVAS.width (1168), height: CANVAS.height (664), floorY:
COURSE_FLOOR_Y (600) }`: `createDemoSession.render` calls `clearCanvas(ctx, view.width,
view.height)` (`:216`), so a 640×360 view would clear only the top-left corner of the game canvas.
Scale the caption font by `view.width / 640` (`demo.ts:330-331`) — a no-op for the five existing
lesson demos.

The four scripts, in course coordinates, reusing `pogoRhythmDemo`'s proven mash pattern
(`demo.ts:711-719`: `down: airborne`, `attackPressed: airborne && stepCount % 3 === 0`) rather than
hand-timed presses:

| L | scene | beats |
|---|---|---|
| 1 | pit 320–700, floor spikes @632, two blue orbs `cx 420 / 580 @ top 486` | "Run at the gap." → "Jump." → "Hold DOWN and slash." → "The bounce lifts you. Again." |
| 2 | lantern @240, blue @420, **red @580** | beat 1: suppress the attack until `feet > 500` → body across the red → flash + respawn, *"Red burns. Back to the lantern."*; beat 2: attack once `feet > 410` → bounce, *"Swing early, while it is still below you."* |
| 3 | blue @420, **mover** `cx 580, {horizontal, amplitude 60, period 3}` — `drawMovers` already draws the dotted path (`render.ts:140-167`) | "These drift." → "Watch the dotted path." → "Meet it where it is going." |
| 4 | red @400 · **wall cx 500, cap top 440** · red @620 · **ceiling 720–1080, tips @330** with blue @800/@940 @ top 540 | "Floor spikes still bounce you." → "These do not — get OVER it." → "Low ceiling. Bounce low." |

`DemoActors` (`:53-62`) gains **render-only** fields — `hazardOrbs`, `movers`, `spikes`,
`spikeWalls`, `checkpoint`, `flash` — drawn beside `if (actors.orbs)` (`:256`). Movers and level 2's
respawn stay the **script's** job in `drive(actors, t)` (which runs immediately before `stepPlayer`
at `:228-232`), so the shared runner's diff stays render-only.

**Tests first:** `introGate.test.ts` (pure, no canvas, first): disabled is never active; auto-ends
at exactly `durationSeconds`; **arm-on-quiet** — 60 steps of `{jumpHeld:true}`, then a quiet step,
then a press: still active through all 60, ends on the press; input on *every* step never skips
early; `end()` is permanent. Then `courseIntro.test.ts` with a `runPlayerCycle(script)` harness
mirroring `demo.ts:228-232`: L1 lands ≥ 2 pogos and never touches the floor spikes; L2 respawns
**exactly once**, on the red, and beat 2 bounces the same red with no respawn; L3's bouncing nail
box really overlaps `moverBox(m, t)`; L4 clears the wall and stays under the ceiling. Plus script
hygiene for all four (non-empty caption every step, no newline, 5–12 real seconds, full-canvas
view, one entry per level). Then three session tests: the intro freezes the run; the skipping input
is consumed (the player does not move on that step, but does on the next); a retry never replays.

---

### T10 — waves cut to two, with reinforcements (note 2)

| Wave | Opens with | +0:30 | +0:45 | hits | time |
|---|---|---|---|---|---|
| 1 "The pests" | walker + flier | walker | flier | **10** | 60 s |
| 2 "The real ones" | duelist + spitter | **warden** | duelist | **6** | 60 s |

Hits and the 60 s do not grow — ratified, the extra bodies *are* the difficulty. The arena is
**1168 px** wide (`constants.ts:40-43`), not 1200.

`roster.ts:44-52` becomes a structured wave (`{ name, enemies, reinforcements }`) with
`FINALE_WAVE_COUNT = FINALE_WAVES.length` **derived**, so it can never drift again, plus
`ARENA_MAX_ALIVE = 4`. `stages.ts:17-26` `StageDef` gains optional `reinforcements` and `maxAlive`
— `rosterStages()` (`:29-36`) leaves both undefined, so the Colosseum is byte-identical — plus one
pure scheduling function, which is the TDD seam:

```ts
export function dueCount(def: StageDef, elapsed: number): number;   // monotone, cursor-friendly
```

`waveStages()` (`:39-46`) sums `hitsRequired` over the **opening cast only** and sets
`label: w.name`, which feeds `stageTitle()` (`dodgeArenaSession.ts:222-227`) → *"wave 1 of 2 — The
pests"* for free. `stepStage` (`:80-98`) is untouched: the stage rule does not know about
reinforcements.

**Spawn placement — do not extend `spawnX`.** `spawnX` (`:126-130`) walks inward from the far side
170 px a step; measured on a 1168 px canvas, a player at `PLAYER_SPAWN_X = 450` gives slots
`868, 698, 528, **358**` — slot 3 is **92 px** from her — and a player at 584 gives
`300, 470, **640**, 810` — slot 2 is **56 px** away. The respawn path already passes the *live*
player x (`:313`), so this is a latent defect the moment a third slot exists. Leave `spawnX` alone
(`enemies.test.ts:162` spawns with it) and add:

```ts
export const WALL_INSET = 110;                    // flier bobs ±80 (ATTACKS.flier.bobX) + 16 half-width
export function joinX(awayFromX: number): number; // the farther wall; guaranteed clearance (1168-220)/2 = 474 px
```

**The respawn bug is the single most important line in this task.** `dodgeArenaSession.ts:311`
`const id = def.enemies[slot];` — `def.enemies` holds only the opening cast, so a reinforcement that
dies hits `continue` and **never comes back**. Read the id from the dead `Enemy` in the slot
instead, and place with `joinX`. This also changes Colosseum respawn distance from 300 px in to
110 px in for every enemy — intentional, same read ("walks back in from the edge"), and it deletes
the slot-index landmine.

Drive the schedule from **`stage.elapsed`**, not `simTime` (`:170`): `stage.elapsed` only runs
between "any input" (`:261-269`) and clear/fail, which is exactly the survived time the decision
means, and `loop.ts:58-62` steps in exact `FIXED_DT`, so a monotone `>=` cursor lands the arrivals
on step 1801 and 2701 every run. Insert `if (stage.status === 'running') joinDue();`
**immediately after** the `stepStage` block (`:317-342`): `stage.elapsed` only advances inside
`stepStage`, a newcomer must not be stepped or collided-with on its arrival frame, and a stage that
cleared or failed this step must not gain an enemy. `prevEnemyFeet` (`:166`) must be `push`ed in
step; `arena.respawnTimers` is sparse and reads `?? 0`, so it needs nothing.

**De-syncing identical twins is required, not polish.** Enemies never see each other —
`stepEnemy(e, world, dt, target)` takes the player only (`:669-674`) — and every machine is
deterministic, so two fliers hunting the same Knight converge on the same home point at the same
speed with the same `bobPhase` and become one body. Wave 1 puts two fliers and two walkers on
screen every run. Minimum fix, no RNG: seed `bobPhase` per slot (`SLOT_PHASE_STAGGER = 1.7`), with
slot 0 at 0 so single-enemy stages and every lesson demo stay bit-identical. **This does not help
the walkers or the second duelist** — their motion has no phase term. See §6, open question 15.

Also: `arena.ts:125` gains `if (state.over) return;` at the top of the `forEach`. Once
`state.over = true` (`:161`) the loop keeps going today and later enemies still resolve nail hits
into `state.hitsLanded`; contained now, but with four enemies it is three extra chances to mutate
state on a dead frame.

Optional and recommended: `juice.addTrauma(FEEDBACK.enemyDeath.trauma)` (0.3, `juice.ts:133`) on a
join plus a ~1.2 s centred "Reinforcements." line, so the arrival is *felt*.

**Tests first:** `dueCount` (0 at 29.99, 1 at exactly 30 and 44.99, 2 at 45 and 60, always 0 with no
script, monotone); `waveStages()` shape and labels; hits do **not** grow (10 / 6, explicitly not
20 / 12); the cap as a **data** invariant (`enemies.length + reinforcements.length <=
ARENA_MAX_ALIVE`, every script sorted ascending, `FINALE_WAVE_COUNT === 2`, and the union of all
wave ids covers all five ROSTER ids — ratified: "every enemy in the roster still appears");
`joinX` sweeps every integer 0..1168 with `|joinX(p) - p| >= 474`; a body placed at `joinX` is never
inside geometry (reuse the `hunt` helpers at `enemies.test.ts:133-210`); the schedule lands (2 alive
at 29.9, 3 at 30.1, 4 at 45.1); determinism across two identically-driven sessions; **a
reinforcement that dies respawns**; a checkpoint reload is back to 2 alive with the cursor reset; a
cleared or failed stage gains nobody; the cap consumes rather than defers; **twin separation** (two
fliers > 30 px apart at some point in every 2 s window over 20 s — this is the test that will fail
first); and the Colosseum untouched (`reinforcements === undefined`, count 1 for 70 s).

Pick the enemy-count test seam **before** writing those: an `@internal enemyCount()` on the session
widens a shared interface the course session also implements, while the `hudText` proxy has zero
API cost but is uglier. Decide once (§6, open question 16).

---

### T11 — the Bills, engine core (note 1)

**Verdict: a new session factory, not a mode on `createDodgeArenaSession`; a new pure module for
the clock, not `stepStage`.**

`stepStage` (`stages.ts:80-98`) cannot hold this fight. `hitsRequired: 0` already works
(`arena.test.ts:543`), so "no hits" is expressible; what is not is *"passed at 1:30 and keeps
running"* — `status = 'cleared'` freezes `elapsed` (`:86` early-returns on anything but
`'running'`) and the session then banners, advances and fires `onAllCleared`
(`dodgeArenaSession.ts:329-342`). There is no status for "passed but still alive", no vocabulary
for a paused clock, and none for timed escalations. Bending it means touching a module pinned by 16
tests plus every arena session test, for a fight that shares none of its rules. Likewise
`createDodgeArenaSession` is a `stages[]` driver end to end; a `kind: 'boss'` would fork ~10
branches. Reuse the *pieces* instead — `arenaWorld()`, `createJuice`/`createEdgeCarry`/`FEEDBACK`,
`createPlayer`/`stepPlayer`, `stepArena` + `createArenaState(false)`, the draw helpers,
`recordRun` — all already exported or exported by P0.

**`engine/boss.ts` — pure, TDD target #1.**

```ts
export type BossPhase = 'ready' | 'fighting' | 'card' | 'over';
export const BOSS = { targetSeconds: 90, dogAt: 30, heatAt: 60, cardSeconds: 2.5 } as const;
export interface BossState {
  phase: BossPhase;
  elapsed: number;        // FIGHT time — the score. Frozen during a card and after the touch.
  card: 'bill' | 'dog' | null;
  cardTimer: number;
  dogIn: boolean; hot: boolean; passed: boolean;   // latches, so each transition fires exactly once
}
export function stepBoss(s: BossState, ev: { playerHit: boolean }, dt: number):
  'dog-arrives' | 'heat' | 'passed' | 'over' | null;
```

`ready` is inert until `startBoss`. `fighting` runs `elapsed`, fails on the touch, and crosses the
three thresholds — crossing 90 sets `passed` and **stays `fighting`**, as ratified. `card` ticks
`cardTimer` only; **`elapsed` does not move**, so the interruption never costs her. `over` is frozen.

**The 0:30 card: model it as a phase, not as `juice.hitStop(2.5)`.** The render loop already gives
the "keeps drawing" half for free — `createGameLoop` (`loop.ts:50-69`) calls `render(alpha)` every
rAF regardless of `step()`. `hitStop` is wrong for four reasons: (1) the frozen branch calls
`edgeCarry.absorb(rawInput)` (`dodgeArenaSession.ts:236-239`) and the next live frame `merge()`s
it, so her "any key to skip" would replay as a jump or slash on the fight's first frame — verbatim
the bug playtest 2 fixed (`arena.test.ts:673`); (2) `frozen()` has no cancel and `hitStop` is
`Math.max`, so it can be lengthened but never shortened — no early skip; (3) a real pogo hit-stop
landing during the card would be silently swallowed by the same `Math.max`; (4) `juice` is the
comfort layer that `reduceShake`/`reduceFlashing` govern, and a 2.5 s narrative beat is not a feel
effect. The session's card branch `return`s before `edgeCarry.merge`, so the press is consumed and
nothing accumulates.

The 0:00 card needs no timer machinery: the beat opens on a `ready` overlay reading **BILL THE
MAN**, exactly like the arena's ready line (`dodgeArenaSession.ts:383-394`), and the clock starts on
her first input.

**Invulnerability — one branch, and `arena.ts` needs almost nothing.** Passing `lethal: false` is
the *wrong* seam: `stepArena:138` gates on `result === 'hit' && !state.observe`, so a Bill contact
would still count `events.nailLanded`, `events.hits += 1`, `state.hitsLanded += 1` and fire
`FEEDBACK.nailHit` — a hit counter in a fight that has no hit counter. Return the existing
`'blocked'` instead, immediately after the per-swing dedupe (`:758-759`) and before the warden
branch:

```ts
if (ENEMIES[e.id].invulnerable) {
  e.blockFlashTimer = 0.18;
  if (player.nailDir === 'down') e.sinceBounce = 0;   // arms the shake-off clock
  return 'blocked';
}
```

`'blocked'` already means "the nail hit something that does not take damage"; `NailHitResult`
(`:744`) gains no member, so no exhaustive switch breaks; and `stepArena:136-155` already does
exactly the right thing — no hit counted, no juice, and `applyPogoBounce(player)` still runs
unconditionally at `:154`. *"Her nail bounces off them and nothing else happens"* falls out free.

**The one `arena.ts` change** is `enemyHurtsBox`. The rolling dog is pogoable on top and damaging on
the sides — deliberately the red-orb vocabulary level 2 taught. Add `enemyHurtsBox(e)`, returning
`enemyBox(e)` for everyone and, for `e.id === 'dog' && e.attackKind === 'roll'`, the box shrunk by
`rollSafeCap` at the top; swap the single damage-check call at `:160`. The **bounce** check at
`:136` keeps using `enemyBox`, so the nail bounces off the whole ball while only the lower band
kills.

**Tuning, computed against the shipped physics — not guessed.** Full jump apex **233.3 px**
(airtime 1.033 s); pogo rise exactly 120 px; Bill's head-top y = 440. The feet window where the
down-nail reaches his head and his body does **not** touch her is **(370, 440)** — 0.433 s per full
jump, crossed twice. Lance band top at feet−130 means a full jump spends 0.667 s of 1.033 s safe.
After a head bounce she is back above the head-top for 0.600 s, so the 0.5 s shake-off trigger sits
inside it and the second pogo (nail cadence 0.41 s) lands at ~0.55 s — the swat catches exactly the
"second bounce" case, and the first bounce is free by construction because the clock only starts
*at* a bounce.

`ATTACKS.bill`: `marchSpeed 90`, `standOff 90`, `lanceEvery 2.6` (hot 1.7), `lanceSpeed 760`
(hot 950), `lanceStuck 1.0`, `lanceReach 90`, `lanceHeight 130`, `swatAfterBounce 0.5`,
`swatTelegraph 0.4`, `swatActive 0.3`, `swatRecovery 0.8`, `swatWidth 140`, `swatHeight 150`,
`overheadHalfWidth 90`, `cooldown 0.8` (hot 0.5).
`ATTACKS.dog`: `huntSpeed 110`, `bonesEvery 3.0` (hot 2.0), `shots 3`, `spreadDeg 35`,
`projSpeed 300`, `rollEvery 6.5` (hot 4.5), `rollTelegraph 0.45`, `rollTime 5.0`,
`rollSpeedX 260` (hot 325), `rollLaunch 620`, `rollGravity 1500` (⇒ apex 128, 0.83 s and 215 px per
arc, ~6 arcs in 5 s), `rollSafeCap 26`.

`stepBill` reuses `AttackPhase` + `setPhase` (`:395-398`): idle marches and faces; the shake-off
fires on `sinceBounce >= swatAfterBounce && overheadOf(e, t, 90) && cooldownTimer <= 0`; the lance
locks direction, telegraphs 0.6 s, crosses at `lanceSpeed` clamped to the wall (reaching the clamp,
not a timer, ends the pass), sits `lanceStuck` at the wall, and when `hot` runs a second pass.
`stepDog` alternates bones and roll off two independent deterministic timers — **no RNG**, the
demos and every test depend on it — with the fan built by P0's shared `fanShots` so pokeability is
free (`stepArena:109-113` already destroys any projectile the nail touches). The roll re-launches
to a constant `rollLaunch` at each floor bounce and reflects off walls via `solidAt` (`:217`).

**Tests first** (the ten highest-value, in order): the clock (`ready` inert, `fighting` advances by
exactly dt); **the card pauses the clock** (2.5 s of steps, `elapsed` unchanged to 10 dp); `skipCard`
resumes on the *next* step, not the same one; each threshold latches exactly once even when one dt
jumps it; **`passed` does not end the fight**; a touch on the same step as a threshold still returns
`'over'` and freezes `elapsed`; **invulnerability** — 100 swings across 100 distinct `swingId`s on
each Bill return `'blocked'`, `hp` never moves, `dead` stays false; **the nail still bounces** —
`totalPogos` incremented while `events.nailLanded === false`, `events.hits === 0`,
`state.hitsLanded === 0`, `events.enemyDied === false` (the whole "moving furniture" contract in one
test); `enemyHurtsBox` is identity for all five roster ids and a non-rolling dog; a Knight whose
hurtbox sits only in the rolling ball's top cap does not die, and 30 px lower does.

Then the fight: the lance stops **hard at the wall** (assert the clamp, not a timer expiry); **no
safe ground** — a Knight standing still at x = 30, 584 and 1138 is touched within one cycle (the
boss version of the hunting property at `enemies.test.ts:149-153`); **altitude is safe** — the same
run with her feet held at y = 460 never touches her, which proves `lanceHeight` and that the answer
is "be airborne"; the shake-off's free first bounce, its 0.4 s tell and its column reaching y = 290;
drifting 100 px sideways inside the 0.5 s never provokes it; `hot` produces two passes back to back
at ~25 % higher speed; bones are the spitter's shape and pokeable; the roll never leaves the arena,
reflects off both walls, re-launches to the same apex, and two dogs stay bit-identical.

Finally the **integration test**, modelled on `course.test.ts:383-620`: a scripted bot on the
shipped physics survives one full lance cycle by jumping at the tell and downslashing at the apex,
and survives 0:00–0:35 including the dog's arrival. **If the bot cannot do it, tune `ATTACKS.bill` —
never `PHYSICS`.**

---

### T12 — the Bills, session, storage, page, art

`createBossSession(config)` returns a plain `GameSession`. Config: `comfort`, `jumpKey`,
`attackKey`, `cleared` (drops the "/ 1:30" target once she has done it), `onPassed` (fires live at
the crossing), `onFailed`. Step order: card branch → `ready` starts on any input → `fighting` runs
`stepPlayer`, both `stepEnemy`s (the dog only once `dogIn`), projectiles, `stepArena`, then
`stepBoss`. On `'dog-arrives'` spawn the dog off-screen on the far side and walk it in over the
card; on `'heat'` set `bill.hot = dog.hot = true`; on `'passed'` fire `onPassed`; on `'over'` play
`FEEDBACK.playerHit`, flash, and record. Restart reads the **raw** press, same reason as
`dodgeArenaSession.ts:243-245`. HUD: `formatClock(boss.elapsed)` big, `/ 1:30` only while not
cleared, **no hits line**.

```ts
recordRun({ mode: 'dodge', boss: true, cleared: boss.passed, hitsLanded: 0,
            durationMs: Math.round(boss.elapsed * 1000), startedAt });
```

No `enemyId`, no `wave` — that keeps `arenaBest` (`bests.ts:77-80`, filters `r.enemyId === id`) and
`waveBest` (`:84-85`, filters `r.wave === n`) from ever picking it up, and keeps the DEV server
mirror valid (`server/src/routes/runs.ts:10-16`'s `satisfies readonly EnemyId[]` accepts a subset,
so the widened union does **not** break it — leave it at five).

Storage: `ProgressV1.finaleBossCleared: boolean` and `PracticeRun.boss?: boolean`;
`local.ts` `DEFAULT_PROGRESS` (`:70-77`), `freshProgress()` (`:79-88`), `readProgress()` (`:190-209`,
`stored.finaleBossCleared === true` — old blobs read false, **no migration**), and
`markFinaleBossCleared()` beside `markFinaleLevelCleared` (`:243`). `bossBest(runs)` =
`stageBest(runs.filter(r => r.mode === 'dodge' && r.boss === true))` — `stageBest`'s ordering
(`:52-74`) already prefers a cleared run and otherwise takes the **longest** survival, which is
exactly "best time".

**A real bug if untouched:** `useChapterProgress.ts:49` reads
`visited.add(run.wave !== undefined ? 'finale' : 'dodge-arena')`, so a boss run would light the
**Dodge Arena** stop. Must become `run.wave !== undefined || run.boss === true`.

Page: replace `BottomBeat()` (`PlayWell.tsx:248-262`, the `.well-quiet` placeholder) with a real
`BossBeat` — `<p className="level-best">{bossBestLine(runs)}</p>` plus a `PracticeCanvas` labelled
"The thing at the bottom", `onPassed` → `markFinaleBossCleared(); refresh();`. `beatDone(3, p)`
(`playWell.helpers.ts:44`, currently `return false`) follows `finaleBossCleared`; `beatLocked(3, p)`
mirrors `beatLocked(2)` (`:53-57`) on the waves; add `bossSkipKey()` → `'finale:boss'` beside
`finaleLevelSkipKey()` (`progress.ts:49-51`). The beat-3 gate wires through the existing block at
`PlayWell.tsx:344-356`, which currently hard-codes "Clear the level first." and now needs a per-beat
rule string.

**Art.** `renderBills.ts` keeps every state read (`phase`, `attackKind`, `phaseTimer`, `facing`,
`lockedDir`, `hot`) inside `drawBill`/`drawBillDog`, so the painting swaps in without touching the
state machine — the ratified requirement. Feet-anchored on a 68×160 box: shoes `y−12…y`, jeans
`y−80…y−12`, shirt `y−134…y−80`, head circle r = 17 at `y−150`, balding dome + brown crescent, arms
as 4 px strokes, and the **orange foam finger** as a rounded wedge ~46×22 on the facing hand —
raised at idle, levelled during the lance telegraph, and a forward spear drawn **exactly where the
lance hitbox is** during `active` (the site's rule: hitboxes equal visuals, `enemies.ts:5-6`).
Design the telegraph and the finger as **separable layers** from the start: if the painting is a
single static image they must be drawn on top of it.

The dog is a 64×58 white rounded body with floppy ears; while rolling, a circle r = 29 with a
rotating ear stub plus a faint pale cap over `rollSafeCap` px — **the pogo-safe top must be
visible**, exactly as the red orb's dark ring makes its rule visible (`render.ts:123-132`).

**Suppress the gold recovery rim** (`render.ts:318-329`) for both Bills: gold means *punish window*
in this site's colour language (`COLORS.punishGold`, used verbatim in the lesson copy) and the Bills
cannot be punished. Draw the lance's stuck window as a wobble or dust instead.

**Tests first:** the card in the session (the canvas keeps rendering, the HUD clock text is
unchanged across 2.5 s, and a jump pressed during the card skips it **without** the Knight jumping
on the next simulated frame — the direct analogue of `arena.test.ts:673`); the run record shape
(die at ~40 s → `{ boss: true, cleared: false, hitsLanded: 0, enemyId: undefined, wave: undefined }`
with `durationMs` matching `elapsed`; survive past 90 then die → `cleared: true` and exactly one
`onPassed`); **the Bills never die and never respawn** over 100 s of swinging; `bossBest` prefers a
cleared run, otherwise the longest survival, and `arenaBest`/`waveBest` never return a boss run;
`finaleBossCleared` round-trips, defaults false on an old blob, and the marker is idempotent;
`beatDone(3)`/`beatLocked(3)`/`nextBeat` follow the new rules.

---

## 5. Breakage register

Everything the changes invalidate, and the intended resolution. **"Rewrite" never means "delete".**

### 5a. Compile-forced (these are the seams doing their job)

| What | Where | Resolution |
|---|---|---|
| `ENEMIES: Record<EnemyId, EnemyTuning>` and `ENEMY_SIZES: Record<EnemyId, …>` go incomplete | `constants.ts:156`, `enemies.ts:174` | P0 fills both. Intended. |
| `stepEnemy`'s exhaustive `switch (e.id)` | `enemies.ts:678-693` | P0 adds inert `bill`/`dog` cases. Intended. |
| `enemyAttackHitbox`'s exhaustive `switch` (no `default`, so TS2366) | `enemies.ts:697-733` | P0 adds six stub cases returning `null`; T6/T7/T11 fill their own. **Do not add a `default`.** |
| `world:` passed to a config that no longer has it | `arena.test.ts:551,583,609,643,698,715,757`, `PlayDodge.tsx:95,105`, `PlayWell.tsx:172` | T5 deletes the field and all call sites. |
| `arenaWorld(kind)` called with an argument | `arena.test.ts:738`, `enemies.test.ts:138-145` | T5. |
| `hasNextLevel` removed | `pogoCourseSession.ts:53-57,89,275`, `PlayPogo.tsx:52,58,66` | T3 (five sites, incl. a `useCallback` dep list). |
| `showNext` prop removed | `ChapterNav.tsx:19-21,29`, its only caller `ChapterGate.tsx:70` | T4. |
| `ProveIt` deleted | imported by `LessonPogo.tsx:5`, `LessonReadingEnemies.tsx:5` | T4 replaces both with `ChapterNext`; `styles/gates.css:62-86` is orphaned at the same moment and moves to `next.css`. |
| `ProgressV1` gains a **required** `finaleBossCleared` | fixtures at `storage/progress.test.ts:21-30`, `pages/playWell.helpers.test.ts:16-26`, and the full-shape `toEqual` literals at `storage/local.test.ts:148-155,176-184` | T12 adds the field to all four. |

### 5b. Silent — compiles, but wrong

| What | Where | Resolution |
|---|---|---|
| **`drawEnemy`'s if-chain ends in `else { drawWarden(...) }`** — a new id renders as a 160 px warden and still compiles | `render.ts:310-316` | P0 converts to `switch (enemy.id)` with no `default`, **in the same edit that widens `EnemyId`**. |
| A boss run marks the **Dodge Arena** stop visited | `useChapterProgress.ts:49` | T12: `run.wave !== undefined \|\| run.boss === true`. |
| A reinforcement that dies never respawns | `dodgeArenaSession.ts:311` | T10 reads the id from the slot's dead `Enemy`. |
| A respawn lands 92 px (player at 450) or 56 px (player at 584) from her once slots ≥ 2 exist | `dodgeArenaSession.ts:313` | T10's `joinX` — guaranteed ≥ 474 px. |
| `attackTimeline` is non-exhaustive over the new kinds (`default: null`), so a stray `leap`/`skyward`/`lance` flattens the phase bar while the captions keep talking | `demo.ts:91-126` | T6 and T7 add their cases; the kinds-guard demo tests stay. |
| Warden recovery sag measured against the wrong total for `skyward` | `render.ts:487,516` | T7's `recoveryTotal(kind)` helper. |
| `LEDGE_SPOTS` cases still **pass** after the ledges go (the target is force-grounded and floats) — meaningless coverage, which is worse than a failure | `enemies.test.ts:155-158,234-244`, and by the same logic `:269-277`, `:329-341` | T5 deletes the spots and the `it.each`, and rehomes the three behavioural tests onto a local platform world. |
| `GROUND_SPOTS` × colosseum and × flat become byte-identical duplicates | `enemies.test.ts:210-232` | T5 collapses them. |

### 5c. Assertions that flip (rewrite, do not delete)

| Test | Now | After |
|---|---|---|
| `course.test.ts:350` `expect(l3!.hazardOrbs).toHaveLength(0)` | 0 reds in L3 | **HARD FAIL** → `> 0` **and** `< l2.hazardOrbs.length`; retitle the `it` at `:338`. |
| `course.test.ts:371` `checkpoints.length >= pits.length - 1` | 4 pits / 3 lanterns | 6 pits ⇒ **≥ 5 lanterns**, both on walkway (`:376` forbids a lantern over a pit). |
| `stages.test.ts:41` `FINALE_WAVES.map((w) => [...w])` | ids spread | waves are objects ⇒ `[...w.enemies]`. |
| `stages.test.ts:43-47` | reduces over `FINALE_WAVES[i]` | `pair.enemies.reduce(...)`. |
| `stages.test.ts:49-50` labels `'walker + flier'` / `'spitter + warden'` | joins | `'The pests'` / `'The real ones'`; **`stages[2]!.label` THROWS** on `undefined` — a hard failure, not an assertion failure. |
| `playWell.helpers.test.ts:62` `nextBeat({level, [1,2]})` → 2 | 3 waves | → **3** (fully cleared). |
| `playWell.helpers.test.ts:82` `beatDone(2, [1,2])` → false | | → **true**. |
| `playWell.helpers.test.ts:116` `firstUnclearedWave([1,2])` → 2 | | → **0**. |
| `playWell.helpers.test.ts:137-139` `waveName(1..3)` | roster joins | `'The pests'` / `'The real ones'`; drop the wave-3 case. |
| `playWell.helpers.test.ts:86` "the thing at the bottom is never done" | true | Rewrite as the boss's done rule (T12). |
| `playWell.helpers.test.ts:104` "…is never locked — there is nothing to play" | true | Rewrite as the boss's locked rule (T12). |
| `progress.test.ts:74` `chapterDone('finale', {level, [1,2]})` → false | | → **true**. |
| `progress.test.ts:156-157` `waveLocked(3, …)` | still passes (generic over any integer) but guards nothing | Retarget to wave 2. |
| `chapters.test.ts:48` `.toContain('all {n} waves')` | | → `.toContain('{n} waves')` with T10's new copy. |
| `attackers.test.ts:47` "stays idle when the player keeps distance" | 60 steps at 500 px | 0.2 s past `gapDwell` ⇒ he leaps. Rewrite as "holds for `gapDwell`, then answers distance with the leap". |
| `attackers.test.ts:117-132` duelist hunting/march | asserts `approachSpeed` at `:131`, which is deleted | Rewrite as the fencing table + "the leap is what closes a long gap". |
| `attackers.test.ts:134-146` | `:144` asserts resting distance is exactly `standOff` | Footwork makes it a band: `>= standOff` and `<= standOff + ~12`. |
| `attackers.test.ts:342-369` "re-aims overhead…" | `:359` a downslash block provokes `'riposte'` | **Deliberate reversal**: `'skyward'`. |
| `attackers.test.ts:404-423` "commits the shield forward…" | premise inverted by the decision; its last assertion (a downslash during the telegraph lands) is now false | Rewrite as "commits the shield **upward**, leaving the front open from the telegraph on". |
| `attackers.test.ts:54-72` "telegraphs, lunges, then recovers" | tail runs 0.73 s at 300+ px — 0.07 s inside `gapDwell` | Passes today's math but is one tweak from flaking: add `expect(attackKind).toBeNull()` or shorten the tail. |
| `arena.test.ts:545,568 / 685-692 / 694-709 / 673-683` | drive fail / all-cleared overlays with `jumpPressed` | All flip to `attackPressed`; their titles say "on Z" and need rewording. |
| `arena.test.ts:589,599,610-611` | `press({attackPressed:true})` as generic "any input starts the stage" | Now meaningful if an overlay is up. `:610-611` is safe by 30 steps of margin (0.5 s clear + 2 s banner = 150 steps vs 180 idled) — **do not shorten those loops.** |
| `enemies.test.ts:323` `overlaps(enemyBox(flier), world.solids[4]!)` | `solids[4]` is the right ledge | `arenaWorld()` has 3 solids ⇒ `overlaps(box, undefined)` **throws a TypeError**. Rehome to a local platform world. |
| `enemies.test.ts:212-244` duelist hunting property | `stuckSteps === 0` | At risk from the leap bypassing `drift`'s wall probe. **Retune (perch clamp, dive abort) — never relax the test.** |
| `demo.test.ts:54-74` `duelistAntiAirDemo` (`kinds === ['antiair']`, `clipped === true`) | | Highest-risk assertion in the session. Green only because of the airborne-hold rule. If red: check that rule first, then re-script (move the jump to t = 0.5-0.6, shorten `cycle` to ~2.6) — **never to hide a regression.** |

### 5d. Safe, and must stay safe

- `demo.ts:501-575` `wardenRiposteDemo` (+ `demo.test.ts:76-87`) — its provocations are
  `nailDir: 'side'` (`:534`) into a front shield, so they still produce `'riposte'`. The
  `resolveNailHit` refactor must not drop that explicit `nailDir`.
- `demo.ts:582-678` `wardenShieldDemo` (+ `demo.test.ts:89-102`) — asserts **zero** blocks (it hits
  the bare front while the shield is up), so `skyward` never fires there. If a refactor ever makes
  an overhead hit happen in it, the captions would lie: treat a non-zero block count as a **real
  regression**, not a test to update.
- `attackers.test.ts:226-255` — builds its ledge worlds by hand, untouched by T5, and is the reason
  to keep the ledge-avoidance AI alive.
- `demo.ts:348-352` `demoWorld()` — the lesson demos never touch `arenaWorld`, so no demo
  choreography breaks on T5.
- **No snapshot tests exist anywhere in `web/src`** except the hand-written frozen Level-1 object
  (`course.test.ts:262-322`), which T8's approach preserves verbatim. Add
  `expect(POGO_COURSE_1.spikeWalls).toEqual([])` to `:314-317`.
- `server/src/routes/runs.ts:10-16` — `ENEMY_IDS … as const satisfies readonly EnemyId[]` accepts a
  subset, so widening the union does **not** break it. Leave it at five; boss runs never set
  `enemyId`. Its `validatePracticeRun` (`:100-146`) drops unknown fields, so a DEV-mirrored boss run
  loses `boss`/`cleared` — already true of `level`/`wave` today; the server is disposable and
  localStorage is the source of truth.

### 5e. Stored shapes — the wave-count migration, explicitly

**No `PROGRESS_VERSION` bump, no pruning, no migration code. Traced end to end.**

The stored blob is `{"v":1,"data":{…,"finaleWavesCleared":[1,2,3],…}}`. `readProgress`
(`local.ts:190-209`) is a field-filler, not a validator — it copies the array verbatim, so `[1,2,3]`
survives. Everything downstream forward-scans `1..count` and ignores extras
(`progress.ts:72-75` `allCleared`).

| Stored | Before | After (`FINALE_WAVE_COUNT = 2`) | Verdict |
|---|---|---|---|
| `[1,2,3]` + level | finale done | `allCleared([1,2,3], 2)` → true, still **done** | preserved |
| `[1,2]` + level | not done (3 missing) | **done** | **flips unfinished → done — see below** |
| `[1]` | wave 2 open | wave 2 open (`waveLocked(2) = !includes(1)`) | unchanged |
| `[2]` only | `firstUnclearedWave` → 0 | → 0 | unchanged |
| `skipped: ['finale:wave:3']` | key read | dead key, never read again | harmless |
| old runs with `wave: 3` | shown by `finaleLine` | `bestLine.ts:49` loops 2→1 and never asks for 3 | silently stops showing |

Row 2 is a **deliberate decision, not an accident**: a Kayla who cleared old waves 1 and 2 is
credited with the new waves 1 and 2 — the same pairs, but she never faced them *with
reinforcements*. It matches the project's standing "nothing ever traps her" stance and it lights up
her map. Recommended, and **pinned by a test** (§6, open question 5).

Three reasons not to bump the version: the read path is already tolerant by construction;
`local.ts` deliberately imports only `bests.ts` + shared types, and pruning `finaleWavesCleared`
would create a storage→engine dependency the module has avoided; and the
`// TODO: when version 2 of any schema exists, migrate here` branch (`:156-158`) **discards** the
blob on a mismatch — bumping would wipe her whole road, not migrate it. **Add a comment at
`progress.ts:72` saying the forward `1..count` scan is load-bearing for count changes**, or a future
"tidy" to a length check silently un-completes every existing player's finale.

Other stored shapes: `finaleBossCleared` absent on an old blob reads `false` (T12, no migration);
old runs have no `boss` field and read as non-boss; nothing in `ProgressV1`/`PracticeRun` records
arena geometry, level counts or button labels, so T5, T3 and T4 touch no stored shape at all.
`SettingsV1.inputBindings` is unchanged by T3 — only the *display* of the key names is new.

### 5f. Documentation

PLAN.md was **already updated** for most ratified decisions (rows at `:54-58`, the roster table at
`:179`/`:181`, Modes 2 and 3 at `:145`/`:154-169`, and the M6.7 entry at `:223` which already names
this plan file). What is left: `PLAN.md:196` still reads "Level 4, then the three waves. (The boss,
once it exists — §8.)"; `PLAN.md:231` still says the boss is "Not yet built"; `PLAN.md:194` still
shows "Prove it →". T13 sweeps those three, plus the doc-comment drift at `shared/src/types.ts:60`
and `:90` ("1–3"), `storage/local.ts:127`, `storage/bests.ts:83`, and
`dodgeArenaSession.ts:60-64` (whose `ArenaKind` comment says the HUD reads "wave 2 of 3"). Also log
every skill invocation in `docs/skills-log.md` — the project's standing rule.

---

## 6. Risks and open questions

### RESOLVED 2026-08-24 — round 5 with the user (these override anything in §4)

| # | Question | Ratified answer |
|---|---|---|
| 1 | Z on a fail overlay | **Both keys retry.** No forward exists from a fail; the copy names X only so no key is dead. |
| 2 | X on the 2 s stage-clear banner | **X does nothing there.** Z advances, the banner expires on its own. Avoids the double `onStageCleared(i)` / second `recordRun`. X is "again" on every other overlay. |
| 3 | Level 4 bests after the level grows | **Reset level-4 bests**, silently, no copy. |
| 4 | Can she pogo the duelist at all | **No free bounce.** Any approach from above is punished — the swipe must cover the pogo apex. The way in is to **bait**: fake the jump so he commits to the anti-air and forward-slash into its recovery, or draw the forward dash and pogo him while he is stuck. Deliberate exception to the "one hit, then get out" rule the Bills and warden follow. **T6 must not tune a free first bounce in, and any test asserting one is wrong.** |
| 5 | Warden's head during the skyward telegraph | **Stays covered.** A downslash rings off the shield and does not interrupt the attack. |
| 6 | Reading Enemies copy | **Do not document the third attack** — discovery in play. But **cut the line claiming he has two answers** (`LessonReadingEnemies.tsx:57-70`); the page must not assert something false. |
| 7 | Wave 2 survivability | **Build the headless dodge-only floor test** — the arena's equivalent of the course completability bot. |

Also resolved from the ratified text, no user input needed:

- The finale **does** require the boss to be done (1:30 is explicit in the decisions).
- **Bill's head needs no pogo-safe cap.** The 70 px down-nail out-reaches his body exactly as the duelist's does today, so a slashing Knight bounces before contact; falling onto him without slashing is a touch, and that is the intended lesson.
- Telegraph durations **do not** scale with the 1:00 heat — the tell is the fairness contract.
- The generous wave-count migration (old waves 1–2 credited as new 1–2) stands; it matches "nothing ever traps her".
- `OVERLAY_LOCKOUT_SECONDS ≈ 0.35` is approved as an implementation guard (X is far more exposed than Z was: `courseClear.hitStop` is 0 and the goal sets `finished` on the same step, so she arrives mid pogo-mash).


Only things the user has **not** decided. Nothing here contradicts a ratified line.

**Dropped because they conflict with the ratified decisions:** a scout proposed limiting Z to
in-page moves so the canvas never triggers a route change — dropped, ratified says Z advances to the
*next chapter*. A scout justified leaving `LessonReadingEnemies` copy alone by citing a ratified "no
new demos" rule — no such line exists in the feedback doc, so it is question 11 below instead.

**Needs a decision before the copy is written (T3/T4):**

1. **Z on a fail screen.** Ratified says "Z = forward… includes arena stage clears **and fails**",
   but there is no forward from a stage you just failed — advancing would skip a gated stage. The
   plan assumes **Z is inert on fails and the copy names X only**. Z has restarted the stage for two
   playtests, so a dead Z will read as broken for at least one run.
2. **X on the 2 s stage-clear banner.** Adding replay there creates a path where
   `onStageCleared(i)` fires twice for one index and a second `recordRun` lands. The plan leaves X
   off that banner (Z skips forward, the banner auto-advances) — but it is one of the three
   overlays note 11 names.
3. **`OVERLAY_LOCKOUT_SECONDS = 0.35`.** A new mechanism, not ratified. X is far more exposed than
   Z was: she dies mid-swing, and the pogo course has *no* hit-stop on a clear
   (`FEEDBACK.courseClear.hitStop = 0`) while `finished` is set on the same step the goal is
   touched — she arrives mid pogo-mash. Recommended, cheap, testable; confirm before building.

**Design consequences the user should own:**

4. **Does the map's finale require the boss?** T12 assumes `finaleCleared()` (`progress.ts:88-92`)
   gains `&& finaleBossCleared`, which moves `chapterDone('finale')`, `mapProgress.reached`, the
   Knight's position on the road and PlayWell's `.well-done` panel. Ratified says beat 3 is done at
   1:30 and that the finale is "level 4 → wave 1 → wave 2 → the Bills", which implies yes — but it
   is not stated, and it changes whether the road can be walked without ever meeting them.
5. **The generous wave migration** (§5e row 2): old `[1,2]` becomes "done" without ever facing
   reinforcements. Recommended, but it is a decision.
6. **Level 4 gets longer** (width 4300 → ~5000). Existing level-4 personal bests become
   incomparable — her old best will look unbeatable. Leave it, or note it in the copy?
7. **The intro replays on every fresh mount**, which is the plain reading of "when a level is
   freshly opened". Consequence: level 4 is reached through `PlayWell`'s `LevelBeat`, which has no
   React key and unmounts when she switches beats, so its intro replays every time she returns to
   beat 1. If "once ever" was meant, that is a new `ProgressV1` field and a stored-shape change —
   cheap, but a decision, not a default. Related: `PlayPogo.tsx:38-41` `selectLevel(n)` with
   `n === level` is a React bail-out, so there is currently **no way to re-watch a demo**; a "watch
   again" affordance needs a nonce like `PlayWell.tsx:132`'s `pickCount`.
8. **Landing on Bill's head is a touch.** His body box always kills; there is no pogo-safe cap. The
   ratified text says "hovering over his head" provokes the swat, which reads as if being above him
   is survivable. The plan recommends no cap — she has full air control, 43 px to clear and 0.6 s to
   do it, and it is the same one-touch rule as the whole dojo — but `enemyHurtsBox` makes the
   alternative a one-line change. This is the single place the reading could be wrong.
9. **The duelist's first pogo is free only during his recovery/cooldown** (1.15 s of guaranteed
   safety, enough for exactly one 0.6 s bounce plus 0.55 s to leave). "One hit, then get out" is
   ratified for Bill explicitly; for the duelist it is inferred. If she reports "I can never pogo
   him at all", the knob is `cooldown` (0.6) or gating the swipe behind a bounce — **not** the
   column size.
10. **Is the warden's head blocked during the skyward tell?** The plan keeps the shield up (a
    downslash rings off it and does not restart the attack), preserving "the shield covers one side
    at a time". The alternative — the head opens because the shield is busy swinging — is equally
    defensible and would reward a bold second overhead hit.
11. **`LessonReadingEnemies.tsx:57-70`** still says the duelist has two answers ("Your approach
    picks its attack"). With three attacks the copy is incomplete. Update it, or leave the third for
    discovery in play?
12. **Do telegraphs scale with heat at 1:00?** The plan keeps them fixed (0.6 / 0.4 / 0.45) — the
    tell is the fairness contract, and heat is speed and gaps only. Ratified says "speed up ~25 % and
    leave less gap", which is silent on tells.
13. **The demoted strip vs the fine-print floor.** Playtest 2 note 7 set "nothing around the edges
    below ~15 px" (`styles.css:44-49`). "Smaller" and that floor cannot both be maximised. The plan
    shrinks the place, the lantern and the gaps and **holds `.stop-title` at ~15 px** — say so out
    loud rather than quietly breaking the older rule. Also re-check `gates.css:135-142`'s 3×2 grid:
    at the smaller size a single row may now fit.
14. **Reinforcements are tied to `stage.elapsed`**, which only runs after her first input — so a
    Kayla who reads the instructions for 20 s loses no reinforcement time. Clearly right, sometimes
    surprising; cheap to explain in the HUD.

**Technical unknowns to resolve by simulation, not by eye:**

15. **Identical twins fuse.** Phase-staggering `bobPhase` fixes the fliers (the Lissajous is the
    only thing it feeds) but does nothing for two walkers (`chaseSpeed 100`, `turnSlack 12`) or two
    duelists (`standOff 100`), whose motion has no phase term. If the twin-separation test fails for
    them, the next levers are a per-slot tuning offset (`standOff + slot*30`, `turnSlack + slot*8`)
    or a cheap O(n²) separation nudge (n ≤ 4, six pairs a frame is free). Decide by simulation.
    Related: two fliers converge on the *same home point*, so staggering only puts them at different
    points on one orbit — a `flankOffset` per slot is the fallback, but that is a new field on a
    shared type.
16. **The enemy-count test seam.** An `@internal enemyCount()` widens `GameSession`, which the
    course session also implements; the `hudText` proxy has zero API cost but is uglier. Pick one
    before writing T10's tests, not during.
17. **No proof either wave is survivable.** The Pogo Course has a bot; the arena does not. T10 ships
    a difficulty change with no floor test, and wave 2 (6 hits, duelist + spitter + warden +
    duelist, 60 s) may be genuinely unbeatable in the last 15 s. Consider a headless "a bot that
    only dodges survives 60 s" test, or accept it as a playtest-4 question and say so.
18. **The wall in level 4 is bot-trivial.** The bot always swings at the top of the nail window, so
    it launches high and clears with ~100 px of headroom; the human failure mode is a *late* swing,
    which the bot never makes. The proof is one-sided — put that in the test comment.
19. **The ceiling's legal band is ~71 px ≈ 6 steps** — the tightest input window anywhere in the
    dojo. Attack buffer (0.1 s) and nail startup (0.05 s) make it forgiving on paper. Be ready to
    raise the tips or drop the orbs. Entry is the fiddly part: a full held jump from the ledge
    clips by design, so it demands a tapped jump or a carried bounce — pin the entry with its own
    bot assertion, not just "the level finishes".
20. **Every boss number is derived, none is played.** The head-pogo window is 0.433 s per jump and
    his body is under her nail for 0.232 s at `lanceSpeed 760`. Budget a tuning pass with
    `lanceSpeed` and `lanceHeight` as the only knobs. **Never touch `PHYSICS`** — gravity is the one
    estimated value in it, and changing it silently reprices the ceiling section too.
21. **0:30–1:00 may be the hardest stretch of the boss**, harder than 1:00+: a 160 px charger plus a
    bouncing ball plus three bones on a flat arena. Ratified forbids extra adds, which helps. If it
    is too much, stagger the dog's first roll (a longer initial `rollEvery`) rather than weakening
    either attack.
22. **Best-time eviction.** `trimRuns` (`local.ts:52-58`) drops the oldest **uncleared** runs first
    at 500. Boss deaths will be many and short, so a long-but-uncleared personal best (say 1:22) can
    be evicted by a grind of 5 s deaths before she ever reaches 1:30. Same class as the pogo-bests
    bug playtest 2 fixed. Flag it; do not over-engineer — once she clears 1:30 that run is
    `cleared: true` and protected.
23. **Bill breaks the palette.** White shirt, blue jeans and an orange foam finger on a `#070912`
    canvas where every enemy is `#8892b8`. Probably right for a boss, but it is the first time the
    palette is broken — screenshot check before the tuning pass. And the painting arrives mid-session
    (2026-08-24): if it is a single static image, the lance telegraph and the foam-finger spear must
    be drawn on top of it, so design them as separable layers from the first commit.
24. **Nothing pixel-tests the renderer.** The `drawSpikes` rewrite is the riskiest silent change in
    T8; the parity test is the only thing standing between it and a changed Level-1 look.
25. **StrictMode double-invokes** `ScrollToTop`'s layout effect in dev. Scrolling to 0 twice and
    focusing `<main>` twice are both idempotent, but the `firstRender` ref means the "first" branch
    fires once across two runs — verify the focus-on-navigation behaviour in a **dev** build, not
    just a preview build.

---

## 7. Definition of done

**Gates — all must pass, from the repo root:**

- `npm run typecheck` clean (`tsc --noEmit` across both workspaces).
- `npm run lint` clean. Note `@typescript-eslint/no-unused-vars` is `'error'` with no
  `argsIgnorePattern` — `_kind` will not silence it (T5).
- `npm test` green, with **no skipped and no `.only` tests**. The baseline is the 385 recorded at
  `PLAN.md:222`; the count must go **up**, and every test listed in §5c must exist in rewritten form
  rather than having been deleted.
- `npm run build` succeeds (`tsc --noEmit && vite build`).
- `npx prettier --write .` before committing, not `--check` — `core.autocrlf` breaks `--check` on
  this machine.
- No new `console.*`, no `TODO` without an owner, and every new engine module has a test file.

**Specific must-pass assertions** (the ones that prove the decisions, not just the code):

- `player.dashTimer` is exactly `0` after 15 steps (`toBe`, never `toBeCloseTo`).
- `arenaWorld().solids` has length 3.
- A straight-down pogo chain over the duelist is caught within 0.75 s; leaving after one bounce
  never is.
- A blocked overhead hit on the warden produces `'skyward'`; a blocked front hit still produces
  `'riposte'`.
- `POGO_COURSE_1`'s frozen snapshot passes **verbatim**, and `spikeWalls` is `[]` for levels 1–3.
- The aiming bot finishes all four levels at all four idle offsets, `misses <= 12`,
  `spikeBounces === 0`.
- `dueCount` is 0 at 29.99 and 1 at exactly 30; the wave schedule lands 2 → 3 → 4 alive.
- `finaleCleared({ finaleWavesCleared: [1,2,3] })` is still true (the legacy tripwire).
- 100 nail swings on each Bill return `'blocked'` with `hp` unmoved and `totalPogos` incremented.
- The boss card leaves `elapsed` unchanged to 10 decimal places and its skip press does not reach
  the fight's first frame.

**Browser pass** (scratchpad Playwright + Edge, as session 6 did; the user's own Vite runs on 5174,
and `npm` eats `--port`, so start it the way the project's run notes say). Screenshot each:

1. Navigate every route from every other route — each lands at the **top**; on a mini-game page
   focus ends on the canvas, elsewhere on `<main>`.
2. Every chapter page ends with **one** gold "Next: {title}" button, with the place small beneath,
   and the chapter strip small at the very bottom. A gated page shows **no** forward button.
3. Clear a pogo level: **Z** goes to the next level, **X** replays; mash X across the goal line and
   confirm the clear screen survives.
4. Fail an arena stage: **X** retries. Clear the roster: **Z** goes to the next chapter.
5. Dash, and watch the streak **stop**.
6. Look at the Colosseum: no ledges.
7. Pogo the duelist twice and get hit by the swipe. Provoke the leap by standing off. Hit the
   warden's shield from above and run the full loop: shield → away → drift back → land the front hit.
8. Play pogo levels 1–4 fresh: each intro plays once, any key skips it, a retry never replays it.
   Clear the level-4 wall and the ceiling section.
9. Play both waves: the 0:30 and 0:45 arrivals are visible, come from the far wall, and four bodies
   read as four (not two fused pairs).
10. Play the Bills: screenshots at 0:29, 0:31 (the card), 1:01 (heat) and 1:31 (passed).

**What a playtest-4 build must let her do, end to end:** open the site, land at the top of every
page she navigates to, follow one loud gold button from stop to stop, clear four pogo levels each
of which shows her what it wants before she plays it — including a wall she must get over and a
ceiling she must stay under — beat five hunting enemies on a flat floor where the duelist answers
each of her three approaches differently and the warden punishes an overhead hit with a column she
can dodge and then punish, survive two reinforced waves that go from two bodies to four, and then
walk into the bottom of the well, meet **Bill the man**, meet **Bill the dog** at 0:30, feel the
heat at 1:00, and chase 1:30 — pressing **Z** to go on and **X** to go again, every time, everywhere.
