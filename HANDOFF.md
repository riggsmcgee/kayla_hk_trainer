# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo **Branch:** `proactive/2026-08-28-1036` (from `proactive/2026-08-28-0939`)
**Window:** 2026-08-28 10:36 to 14:36 local (240 min — "as long as it takes", capped at four hours)
**Status:** running **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

Both asks are done and the handoff's backlog is drained. Pushed to
`origin/proactive/2026-08-28-1036`.

## How I read the ask

> "I want it to be on its own page, and I also want her to be able to change the controls from this
> view. It should say 'Jump' and next it would be 'Remap', and it's not working."

I read **"and it's not working"** as the _situation the button is for_ — she presses Jump, nothing
happens, and the fix is on the row instead of two pages away in Settings. Not as a report that the
checklist is broken; it was driven end to end in a browser last sprint and ticked 7 → 1. **If that
reading is wrong it is a small change, not a rebuild** — say so and the rows can do something else.

The full note, what it forced, and what I decided without you is written up as
[docs/feedback/2026-08-28-playtest-9.md](docs/feedback/2026-08-28-playtest-9.md), marked throughout
as the sprint's reading rather than as anything you ratified — there was no interview.

---

## Needs you

1. **Nothing is red.** 869 tests at baseline, **901 now**; lint, typecheck and build clean at both
   ends. Six browser passes, zero console errors.
2. **Two calls I made without you, both stated with their evidence and both cheap to reverse.**
   - **The floor is a PAGE, not a seventh stop on the road.** The map's road is six hand-fitted
     stops — five bezier legs whose ten endpoints are typed-in ±36 offsets from stop centres, five
     strata bands each copying the curve above, six hand-inked glyphs, and a strip sized to fit six
     across a laptop. A seventh is a redraw. The chain runs Setup → floor → Pogo instead.
     **What it costs: the map never points at the floor**, because its sign names the first
     unfinished chapter and the floor is not one. Every route to it runs through Setup. A chip in
     the answer card would fix that in ten minutes if you want it.
   - **The gate ships, and existing saves are grandfathered.** This was the decision the last two
     handoffs left you. The reason it was a decision was the risk of un-completing chapter 1 under
     Kayla — grandfathering removes the risk, so I took it and made the alternative one line.
     **Proved rather than asserted:** a save with a controller and no sheet (what Kayla has today)
     reaches Greenpath on the map, opens Pogo, and is still open after walking left on the floor.
3. **The migration has one deliberate blind spot, and you should know it exists.** The rule cannot
   tell a save made before the floor existed from one made after it that never opened the floor. It
   credits both. That is the promise — "nothing already complete becomes incomplete" — and both of
   those are already complete. From today, answering the controller seeds an empty sheet and every
   new save is gated for real.

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

Merge everything: `git checkout proactive/2026-08-28-0939 && git merge proactive/2026-08-28-1036`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

## Baseline (before any change)

- `npm test` — **869 passed** (868 web across 44 files, 1 server).
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 417.58 kB, CSS 27.21 kB**. Nothing was broken at baseline.

## Final check (after the last change)

- `npm test` — **901 passed** (900 web across 47 files, 1 server). **+32**, in three new files
  (`PracticeCanvas.test.tsx`, `SetupFloor.test.tsx`, `LessonPogo.test.tsx`) plus new blocks in the
  storage, gamepad, setup-checks and pogo-helper suites.
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 424.20 kB (+6.62), CSS 28.08 kB (+0.87)** — a page, a hook, a copy module.
- **Six browser passes**, dev server on 5199, scripts in `.proactive/scratch/`:
  - `floor-walk.mjs` — the guard with no controller, the forward chain onto the floor, Remap Jump →
    Q updating both the row and the caption under the canvas. `s19-floor.png`.
  - `road-walk.mjs` — **the one that matters.** A blank save; a controller answered but unproven; and
    a grandfathered save, which reaches Greenpath, opens Pogo, and is still open after walking left.
  - `minigame-check.mjs` — all three mini-games still play, driven with real keys and judged on the
    canvas actually changing. `PracticeCanvas` is shared by every one of them.
  - `settings-capture.mjs` — the bench's capture after it stopped owning its listener; a rebind
    lands, Escape cancels without binding.
  - `lesson-walk.mjs`, `setup-lesson-walk.mjs`, `diagram-shot.mjs` — every extracted sentence read
    back, including the four that wrap a `<strong>`, an `<em>` or a `<Link>` mid-sentence.
  - `floor-phone.mjs` — 390 px wide, no horizontal overflow. `s19-floor-phone.png`.
  - Zero console errors on every page.

## Two bugs the work found on its own

- **A rebind used to restart the game.** `PracticeCanvas` hung its session and its input adapters off
  one effect whose dependencies held the bindings, so changing a key tore the session down and built
  a new one. Invisible on Settings, which has no Knight. On a floor where she is standing testing her
  controller it is the Knight vanishing the moment she fixes a button — which is the whole feature,
  backwards. The two have separate lives now.
- **The checklist's old `li span:first-child` rule was centring every label in a 1 ch box**, the
  moment a row grew a second span. A browser showed it; the type checker could not, and 899 tests
  did not.

## Started, sliced, continued in PLAN.md

Nothing was left half-built. PLAN §8 now records the controller hole as **CLOSED** and the copy
extraction as **DONE** (nine modules, 258 named strings — the playtest-8 estimate of "~52 across 23
files" was arithmetic off the canvas count and low by about five times; that is written down rather
than dropped, because it is what sizes item 8).

**The remaining contract is item 8, the one-to-one editor**, and it is now unblocked.

## Tried and reverted

Nothing was reverted. One thing went back the way it came, and it is a rule worth keeping: **the
extraction started to reword.** Setup's offer sentence says "jump", "attack", "dash" in lower case
where `actionLabelCopy` capitalises them, and reusing that table changed your sentence. It has its
own three-word table now, with the reason written above it. **An extraction that rewords is not an
extraction.**

## Ideas not acted on

- **A visible entry point to the floor from the map or the header.** Today Setup is the only route.
  This is the real cost of not making it a stop, and it is a ten-minute change if you want it.
- **The diagrams state their facts twice** — once in the drawn callouts, once in the `aria-label` —
  and nothing keeps the two in agreement. Found while extracting them; not fixed, because which one
  is the source of truth is a design question.
- **The floor's Remap replaces ALL keys for an action**, the way Settings always has. So remapping
  "Walk left" from `←/A` to `A` drops the arrow. Consistent, and worth one look when you play it.

## Environment changes

None. No installs, no upgrades, no config touched. The dev server ran on 5199 and has been shut
down.

## Skills used

`proactive`, `workflow-authoring`, and the Workflow tool twice — a five-lens read-only **survey**
before any code was written, and a six-dimension adversarial **review** of the diff afterwards.
Logged in `docs/skills-log.md` with the verdict that matters: **the survey changed what got built
and the review only found things to fix.** It walked every population through the gate's migration
while I was busy wanting my first design to work, and found that the version I was about to write
would have been revoked by the first frame Kayla moved on the floor. Same token cost, different
leverage. If only one runs, run it first.

## Suggested next session

**Item 8, the one-to-one editor** — the largest single piece in the project and now the whole of the
remaining contract. It wants a real session, not an hour, and it wants you for the first ten minutes
to say what "edit the text" should feel like.

One sentence from you would also settle the two things this sprint decided on your behalf: whether
"it's not working" meant what I took it to mean, and whether the floor should be reachable from the
map.
