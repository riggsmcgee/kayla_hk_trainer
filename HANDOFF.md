# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo **Branch:** `proactive/2026-08-28-1036` (from `proactive/2026-08-28-0939`)
**Window:** 2026-08-28 10:36 to 14:36 local (240 min — "as long as it takes", capped at four hours)
**Status:** done **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

Both asks are done, the handoff's backlog is drained, and an adversarial review of the whole diff
has been run and acted on. Pushed to `origin/proactive/2026-08-28-1036`.

## How I read the ask

> "I want it to be on its own page, and I also want her to be able to change the controls from this
> view. It should say 'Jump' and next it would be 'Remap', and it's not working."

I read **"and it's not working"** as the _situation the button is for_ — she presses Jump, nothing
happens, and the fix is on the row instead of two pages away in Settings. Not as a report that the
checklist is broken; it was driven end to end in a browser last sprint and ticked 7 → 1. **If that
reading is wrong it is a small change, not a rebuild.**

The note, what it forced, and what I decided on your behalf are written up as
[docs/feedback/2026-08-28-playtest-9.md](docs/feedback/2026-08-28-playtest-9.md), marked throughout
as the sprint's reading rather than as anything you ratified — there was no interview.

---

## Needs you

1. **Nothing is red.** 869 tests at baseline, **912 now**; lint, typecheck and build clean at both
   ends. Ten browser passes, zero console errors.
2. **Two calls I made without you, both with their evidence, both cheap to reverse.**
   - **The floor is a PAGE, not a seventh stop on the road.** The map's road is six hand-fitted
     stops — five bezier legs whose ten endpoints are typed-in ±36 offsets from stop centres, five
     strata bands each copying the curve above, six hand-inked glyphs, and a strip sized to fit six
     across a laptop. A seventh is a redraw. The chain runs Setup → floor → Pogo instead.
     **What it costs: the map never points at the floor**, because its sign names the first
     unfinished chapter and the floor is not one. Every route runs through Setup. A chip in the
     answer card would fix that in ten minutes if you want it.
   - **The gate ships, and saves from before it are grandfathered.** This was the decision the last
     two handoffs left you. The reason it was a decision was the risk of un-completing chapter 1
     under Kayla; grandfathering removes the risk, so I took it and made the alternative one line.
     **Proved in a browser, all four populations:** a save from before the gate is open, a save from
     before it holding a HALF-FILLED sheet is open, a save written under the gate with nothing
     proved is locked, and one with all seven is open.
3. **The migration keeps one deliberate blind spot.** It cannot tell a save made before the gate
   from one made after it that never opened the floor. It credits both. That is the promise —
   "nothing already complete becomes incomplete" — and both are already complete.

## Change ledger

| #   | Commit    | What                                                                                  | How to try it                                                            | Risk |
| --- | --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---- |
| 1   | `94276e2` | The canvas keeps its Knight when a binding changes; `inputPaused` for captures        | `npx vitest run --root web src/components/PracticeCanvas.test.tsx`       | med  |
| 2   | `61e5d83` | The practice floor as its own page, Remap on every row, and the grandfathered gate    | `#/lessons/setup` → pick a board → **Next: Try it out** → press Remap    | high |
| 3   | `f04a425` | A round-trip over every `ProgressV1` field, so the reader's whitelist can't drop one  | `npx vitest run --root web src/storage/local.test.ts`                    | low  |
| 4   | `ac9e262` | The three lesson pages' words, and a thesis that can no longer drift from the physics | `#/lessons/pogo` → the gold pull-quote                                   | low  |
| 5   | `cf98796` | The controller diagrams' sixteen printed labels                                       | `#/lessons/setup` → both diagrams                                        | low  |
| 6   | `8e1fc3d` | Settings and the floor share one capture hook                                         | `#/settings` → Change key for Jump → press a key; Escape on the next one | med  |
| 7   | `f336bc8` | Playtest 9 written up; PLAN's controller hole CLOSED and copy extraction DONE         | read `docs/feedback/2026-08-28-playtest-9.md`                            | low  |
| 8   | `4300d3f` | Settings prints how many buttons the pad reports                                      | `#/settings` → plug the leverless in and press a button                  | low  |
| 9   | `77fb9e5` | Nine Remap buttons, nine different accessible names                                   | a screen reader, or `.proactive/scratch/floor-a11y.mjs`                  | low  |
| 10  | `660a2bb` | The floor's guard keeps the chapter strip, like every other gate                      | `#/lessons/setup/floor` with no controller answered                      | low  |
| 11  | `5432473` | **Nine defects the adversarial review found** — see below                             | `#/lessons/setup/floor` → Remap Jump → press the new key                 | high |
| 12  | `6bfebfd` | The pad capture's own tests, and the double-bind writing them found                   | `npx vitest run --root web src/components/useControlCapture.test.tsx`    | med  |

Merge everything: `git checkout proactive/2026-08-28-0939 && git merge proactive/2026-08-28-1036`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## What the adversarial review changed, and why it is the part worth reading

Forty-five agents over six dimensions, every finding handed to a second agent told to refute it.
Eighteen of twenty-eight survived; nine were real defects and **three of those broke the feature**.

- **After a Remap, the key she had just bound did nothing.** `attachKeyboard` ignores keys pressed
  while a button has focus — deliberately, so Space toggles a checkbox rather than jumping — and
  focus was still on the Remap button she pressed. The feature failed at the last inch, silently.
  Now the capture hands the canvas its focus back, and a browser confirms the whole sequence:
  **Remap Jump → press Q → the Knight jumps and the box ticks.**
- **Rebinding a PAD button fired a phantom press of the action she just bound**, because a press
  edge is the difference against the previous poll and a fresh adapter has no previous poll. The new
  adapter is primed with one discarded poll.
- **A save holding a HALF-FILLED sheet lost a chapter it had already finished.** The sandbox shipped
  a session before the gate did, so a save can hold two of seven from a build where filling the
  sheet proved nothing. I had designed the migration around an absent key and written "nothing
  already complete becomes incomplete" into three documents; this is the one door that rule leaves
  open. `setupGated` decides it now.

Six smaller ones, all fixed: the floor's gold forward button pointed into the lock it had just
created; the capture prompt was never announced; the skip dropped focus to the document; ticking the
seventh check left the strip below saying Setup was unfinished; "Skipped" and "that is all seven"
could be on screen together; and — mine, and the one that stings — **the extraction respelled an
accessible name "color" → "colour"**, which is exactly the reword this sprint's own rule forbids.

**The lesson is not "reviews find bugs", it is _which_ bugs.** All three of the serious ones are
invisible to a type checker and invisible to a suite that agrees with itself: the focus bug survived
because nine tests all queried by a name they had already decided was right, and the migration bug
because the tests covered absent, empty and full sheets and never a partial one. A test written by
whoever wrote the code inherits its blind spot.

## Baseline (before any change)

- `npm test` — **869 passed** (868 web across 44 files, 1 server).
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 417.58 kB, CSS 27.21 kB**. Nothing was broken at baseline.

## Final check (after the last change)

- `npm test` — **912 passed** (911 web across 48 files, 1 server). **+43**, in four new files
  (`PracticeCanvas.test.tsx`, `SetupFloor.test.tsx`, `LessonPogo.test.tsx`,
  `useControlCapture.test.tsx`) plus new blocks in the storage, gamepad, setup-checks and
  pogo-helper suites.
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 424.85 kB (+7.27), CSS 28.20 kB (+0.99)** — a page, a hook, a copy module.
- **Ten browser passes**, dev server on 5199, scripts in `.proactive/scratch/`:
  - `focus-check.mjs` — **the one that proves the feature**: Remap Jump, press Q, the Knight jumps
    and the box ticks; focus is on the canvas afterwards; one row's prompt opens, not three.
  - `road-walk2.mjs` — the gate's four populations. Only the one that should be is locked.
  - `collision-check.mjs` — binding Jump to Attack's key: Jump takes X, Slash sideways keeps J, and
    nothing is left dead.
  - `minigame-check.mjs` — all three mini-games still play, judged on the canvas actually changing
    under real keys. `PracticeCanvas` is shared by every one of them.
  - `floor-a11y.mjs` — every button's real accessible name; no duplicates.
  - `settings-capture.mjs`, `floor-walk.mjs`, `lesson-walk.mjs`, `setup-lesson-walk.mjs`,
    `diagram-shot.mjs` — every extracted sentence read back, including the ones that wrap a
    `<strong>`, an `<em>` or a `<Link>` mid-sentence.
  - `floor-phone.mjs` — 390 px wide, no horizontal overflow. `s19-floor-phone.png`.
  - Zero console errors on every page.

## Three bugs the work found on its own, before the review

- **A rebind used to restart the game.** `PracticeCanvas` hung its session and its input adapters off
  one effect whose dependencies held the bindings. Invisible on Settings, which has no Knight; on a
  floor where she is testing her controller it is the Knight vanishing the moment she fixes a button.
- **The checklist's old `li span:first-child` rule was centring every label in a 1 ch box** the
  moment a row grew a second span. A browser showed it; 899 tests did not.
- **Writing the pad capture's missing test found a double-bind.** Clearing the capture state does not
  tear the effect down synchronously, so two polls in one frame bound twice and the second won.

## Started, sliced, continued in PLAN.md

Nothing was left half-built. PLAN §8 records the controller hole as **CLOSED** and the copy
extraction as **DONE** (nine modules, 258 named strings — the playtest-8 estimate of "~52 across 23
files" was arithmetic off the canvas count and low by about five times, which is written down rather
than dropped because it is what sizes item 8).

**The remaining contract is item 8, the one-to-one editor**, and it is now unblocked.

## Tried and reverted

Nothing was reverted. One thing went back the way it came, and it is the rule worth keeping: **the
extraction started to reword.** Setup's offer sentence says "jump", "attack", "dash" in lower case
where `actionLabelCopy` capitalises them, and reusing that table changed your sentence — so it has
its own three-word table with the reason above it. The review then caught me breaking the same rule
a second time, on an accessible name. **An extraction that rewords is not an extraction.**

## Ideas not acted on

- **A visible entry point to the floor from the map or the header.** Setup is the only route today.
  That is the real cost of not making it a stop, and it is a ten-minute change if you want it.
- **`styles.css`'s `.map { aspect-ratio: 600 / 900 }`** is overridden by `nav.map { 600 / 1080 }` in
  `map-states.css` and its value is never used, so a reader of the base sheet learns the wrong
  height. Predates this sprint; the map is hand-tuned art, so I left it.
- **The diagrams state their facts twice** — once in the drawn callouts, once in the `aria-label` —
  and nothing keeps them in agreement. Which one is the source of truth is a design question.
- **The floor's Remap replaces ALL keys for an action**, the way Settings always has, so remapping
  "Walk left" from `←/A` to `A` drops the arrow. Consistent, and worth one look when you play it.

## Environment changes

None. No installs, no upgrades, no config touched. The dev server ran on 5199 and has been shut
down.

## Skills used

`proactive`, `workflow-authoring`, and the Workflow tool twice — a five-lens read-only **survey**
before any code was written, and a six-dimension adversarial **review** of the diff afterwards.
Logged in `docs/skills-log.md`. The verdict that matters: **the survey changed what got built, and
the review changed whether it worked.** The survey walked every population through the gate's
migration while I was busy wanting my first design to be right, and killed it. The review found that
the feature failed at the last inch on a focus rule three files away. Neither was a thing more tests
by the same author would have caught.

## Suggested next session

**Item 8, the one-to-one editor** — the largest single piece in the project and now the whole of the
remaining contract. It wants a real session, and it wants you for the first ten minutes to say what
"edit the text" should feel like.

One sentence from you would also settle the two things this sprint decided on your behalf: whether
"it's not working" meant what I took it to mean, and whether the floor should be reachable from the
map.
