# Playtest 10 — the three items still to build

**2026-08-29.** Written at the end of the sprint that shipped the other four items, so the next
session continues rather than restarts. The ratified contract is
[docs/feedback/2026-08-29-playtest-10.md](../feedback/2026-08-29-playtest-10.md) — nothing here
re-decides any of it.

Each section below is a survey that was actually run against the code as it stands at
`proactive/2026-08-29-1924`. The line numbers were real when written; verify, but trust the shape.
**The traps are the valuable part** — every one of them is a bug that a straightforward
implementation ships.

Build order: **assist mode → the dog's entrance → the dash gaps.** Assist mode touches
`registerHazard`, which the dash gaps also touch; doing them in the other order means merging by
hand. The dash gaps are last because they want to be tuned against a build that is otherwise done.

---

## 1. Assist mode

**What it is.** A Settings control reading `Off · 1 · 2 · 3`, granting that many extra hits. Lives
refill at the start of the smallest retryable unit — each Colosseum enemy, each finale wave, each
Pogo Course level, each Bills fight. In the Pogo Course a life absorbs a hazard touch instead of the
walk back to the lantern; the miss is still counted and still shown. Remaining lives draw as pips.
A run made with assist is tagged, ranked BELOW clean runs in bests, and shows as
`Best: 7 hits (assist)`. A one-time confirm fires the first time she raises it above Off.

**`godMode` is the template.** It is the same shape and already threads everywhere assist needs to
go. Trace it and follow it.

### The four traps

1. **`trimRuns` (`storage/local.ts:67`) must NOT learn about assist.** It drops god-mode clears
   early, and the comment says exactly why: they are excluded *because* `bests.ts` skips them. An
   assisted run IS a best (ranked below clean ones), so evicting it early deletes a live personal
   best. This is the most tempting wrong edit in the feature.
2. **The grace-timer decay is guarded by `if (state.godMode)`** — `course.ts:195` and
   `arena.ts:180`. Assist needs it ticking too, or the `PHYSICS.iFrames` window never expires and
   one life absorbs everything for the rest of the run.
3. **`bossSession.ts:404` `bossInput()` returns `untouched: phantomHits === 0`,** and `stepBoss`
   only awards `'won'` when `untouched`. Reusing `phantomHits` to count assist absorptions turns an
   assisted 1:30 into a fight with no exit and no ending — it returns `'passed'`, never `'won'`.
   Keep a separate counter and do not feed it into `untouched`.
4. **`TheEnd.tsx:58` `LAST_MESSAGE` is computed at MODULE scope.** Filtering the message array for
   an assisted reader without fixing it leaves `finished === false` forever, so the "Back to the
   map" link never appears and the page is a dead end.

### Where things live

- **Settings blob has no whitelist** — `getSettings()` is a raw pass-through, so a new `SettingsV1`
  field round-trips for free. (The field-by-field whitelist is on `readProgress()`, not settings.)
  Update `DEFAULT_SETTINGS` (`local.ts:71`). Worth adding the missing symmetric guard: a
  `Required<SettingsV1>` round-trip test mirroring `local.test.ts:276`.
- Assist state belongs in **settings, not progress** — `clearAllProgress()` keeps settings, which
  gives "the pop-up does not re-fire after Reset Progress" for free.
- **`useRollVariant.ts` is the better hook template than `useGodMode`** — it already clamps a
  numeric setting against a stale or hand-edited blob.
- **The confirm dialog already exists**: `Settings.tsx:68,98,114-127,309-338` (the Reset Progress
  flow), with focus management that moves her along with the panel and never onto the destructive
  button. Copy it. Difference: assist's pop-up is *pre*-action, so hold the pending value while
  confirming. `settings.css:76-105` has the panel styling.
- New Difficulty section goes between Comfort (ends `Settings.tsx:289`) and the ending block.
  Reuse `<fieldset>/<legend>` + radios from the roll-variant picker, but **not** its
  `.roll-variants` class — that CSS is marked dev-only.
- **`beats()` slot:** immediately AFTER the `cleared` check, not above it —
  `if (a.assisted !== b.assisted) return !a.assisted;`. `courseBest` needs the same treatment and
  its polarity is flipped (fastest wins, not longest).
- **No pip helper exists.** `drawCheckpoint` (`render.ts:225-252`) is the closest lit/unlit idiom.
  Draw pips before the god-mode badge so they never collide at `(16, height-18)`.
- **The ending letter** needs `runs` in `TheEnd.tsx` (it currently reads nothing but bindings) and a
  predicate in `bests.ts`: has she ever cleared the Bills with `!godMode && !assisted`. Note
  `boss.passed` is set at 1:30 even in god mode, so the `!godMode` term is load-bearing.
- Also lying under assist and NOT covered by the interview: `ending.ts:46` `winLine`
  ("untouched") and `ending.ts:43` `hudNeverTouched` ("and they never touched you"), both drawn on
  the canvas. Same omission treatment as the letter.
- **Tag on availability (`assistLives > 0`), not on spend.** It is the only version stable across a
  `bests.ts` comparison, and it matches "the asterisk disappears the moment she does it clean".

---

## 2. The dog's entrance, re-paced

**What it is.** Today the whole beat is a flat `BOSS.cardSeconds = 2.5` and everything overlaps on
one timer — Bill's shout, the answering WOOF, the dog's walk-in and the name card all at once. It
becomes strictly sequential: shout → WOOF → the dog walks to his mark → *then* the card appears and
holds with no timer → a fresh press resumes the fight. About 6–7 s. Clock paused throughout, as it
already is. Bill the man's own card goes 0.7 s → ~2 s with no input gate.

### The traps

1. **`boss.test.ts:56` `dismissCard` is `while (s.phase === 'card') stepBoss(...)`.** Remove the
   auto-expiry and it never terminates — it hangs `pastTheDog()` and with it the entire heat, 1:30
   and touch blocks. This is the single most dangerous line in the suite.
2. **`boss.bot.test.ts:303-309` sits through the card the same way** and will burn its whole
   iteration budget there, failing all three bot tests. The bot needs hands: give it the resume
   input.
3. **`bossSession.ts:429-440` (`god mode does not earn the ending`)** runs 93 s of held fighting
   straight through the real 0:30 card with `IDLE` input. It will stop dead forever.
4. **Anything held indefinitely must bob off `simTime`, not off card progress.** `drawBarking`'s
   shout bob is driven by `progress`; freeze the progress and the letters freeze mid-bob. The
   ending's `shoutBob(ending.elapsed)` is the pattern.
5. **Put new beat state in a new `beginTheDogBeat()`, called from the `'dog-arrives'` case** — NOT
   in `bringInTheDog()`, which `jumpToTheFinish()` (the god-mode "watch the ending" path) reuses
   while jumping straight to `fighting`. State armed there would be stale and never consumed.
   `restart()` (`bossSession.ts:283-307`) must reset every new field or a second run inherits the
   first's card position.

### The input answer

**Buttons already have edges** (`jumpPressed`/`attackPressed`/`dashPressed`, and keyboard
auto-repeat cannot re-raise them). **Directions have only levels** — there is no `leftPressed`
anywhere in the pipeline, though `input.ts`'s `pressedSinceSample` already *tracks* direction
presses and simply throws them away at `sample()` because `InputFrame` has no field for them. Adding
`dirPressed` at source is a three-line change in `input.ts:163-172` with a mirror in `gamepad.ts`.

**`createOverlayGate` (`session.ts:80-103`) is exactly the released-then-pressed semantics wanted**,
and every existing "press to continue" overlay uses it with **edges only, never `jumpHeld`** — which
is precisely why a held jump cannot dismiss any of them today. `arm()` on entering the card beat
plus `open(dt, fresh) && fresh` solves the held-jump conflict with no new machinery.

`anyInput()` (`input.ts:207-218`) exists, is tested, and has **zero callers** — and it is a pure
level OR, so it is useless for a fresh-press gate as written.

### The one design conflict to settle out loud

The "Sudden" entrance variant deliberately lands the WOOF **before** the shout ("the dog was already
coming"), and `entrance.test.ts:221` pins that one of the three variants inverts them. A strictly
sequential shout-then-woof makes that variant's whole design impossible. Playtest 10 is the newer
ruling and it is explicit, so the inversion goes — but strike it deliberately, and rewrite that test
rather than letting it fail. Same for `entrance.test.ts:43` and `:140`, which pin the entrance at
2–3 s: that band is a playtest-4 quote that playtest 10 overrides ("at least double").

`copy/fight.ts` needs one new key for the dismiss prompt. It must contain neither "skip" nor "hurry"
(`bossSession.test.ts` asserts the card copy matches neither) and must be a function if it names a
control. **`billLine`, `dogLine` and `billShout` are the user's own hand-written words — frozen.**

---

## 3. The pogo dash gaps

**What it is.** Level 2 gets a gap that cannot be crossed without pogo-then-dash; level 3 a wider
one over a moving target; level 4 (the Gauntlet's) the same over a **red** moving target. A
checkpoint immediately before each. `Mover` gains a `hazard?: boolean` flag rather than a fourth
list appearing. **Level 1 is frozen and pinned by a snapshot — do not touch it.**

### The measured numbers, and the one that actually binds

Driven against the real `stepPlayer` and the real `PHYSICS`, not derived by algebra (the 60 Hz
discretisation of `jumpHoldMax` and the `maxFallSpeed` cap both break the closed form):

| route | max crossable pit width |
| --- | --- |
| jump only | 374.7 px |
| jump + one pogo | 579.4 px |
| **jump + one air dash, NO pogo** | **635.5 px** |
| jump + pogo + air dash | 840.3 px |

**635.5 is the binding number, not 579.4.** A gap sized merely "wider than a pogo arc" is beatable
with a bare air dash and no pogo whatsoever — which is not what was asked for. Every gap must sit
in **(635.5, 840.3)**.

Two further findings worth keeping: orb height barely matters once she is at terminal velocity
(486, 510 and 530 all give identical reach), so a ±60 px vertical drifter costs nothing; and a red
orb costs nothing either, because the optimal bounce happens on a fast descent when she is already
past it horizontally — red only tightens the timing, it does not shrink the gap.

### Validated geometry

All simulated end-to-end on real `buildCourse` output, with the spike strip in place. No-dash routes
fail; pogo+dash crosses; the red one stays body-safe.

```
L2  pit { from: 3780, to: 4480 }  700 px   orb   { cx: 4080, top: 486 }   checkpointAt(3700)  goal 4740  width 4960
L3  pit { from: 4260, to: 5020 }  760 px   mover (4590, vertical, amp 60, period 2.5)  checkpointAt(4180)  goal 5280  width 5500
L4  pit { from: 4060, to: 4780 }  720 px   RED mover (4370, vertical, amp 60, period 2.5, hazard: true)  checkpointAt(3980)  goal 5040  width 5260
```

Vertical drifters, deliberately: their x is fixed, so they are reachable at every phase. A horizontal
drifter needs a phase sweep first — at its far-left extreme the effective orb x drops by 60, and it
must stay ≥ 240 px past the near ledge edge.

### The traps

1. **`runAimingBot` (`course.test.ts:415-544`) never dashes** — `dashPressed: false` is hard-coded
   at line 508 — and `Level %i completability` asserts every shipped level is beatable at four idle
   offsets. That is **12 currently-green tests that go red** unless the bot learns to dash. Rule:
   after a bounce, if the next ledge is out of pogo-only range and no orb lies before it, dash on
   the first step after the pogo pin ends. Measured optimal timings were 22–30 ticks after the swing
   press, and "the step the pin ends" sits squarely in that band. Gate it on "ledge out of pogo
   range" so level 1 is untouched.
2. **Spikes are pogoable, so an ideal spike-chaining bot crosses any width** (1400 px in 6 bounces).
   Spike-pogoability is ratified (PLAN §5) and must not be removed. The repo already has the
   convention: `course.test.ts` asserts `spikeBounces === 0`. State the claim as "impossible without
   a dash **or a spike-pogo chain**", exactly as every existing level's orb-spanning claim is stated.
3. **`stepCourse` must capture `moverT` BEFORE the `elapsed += dt`** on `course.ts:197`. The session
   reads `moverTime = courseState.elapsed` before calling it, so a hazard box computed after the
   increment burns one frame ahead of both the box the nail could hit and the box she saw drawn.
4. `course.test.ts:338-355` asserts `l2.movers` is empty and `l3.hazardOrbs` is empty. Level 2's gap
   must therefore use a static orb (which is what was asked for) and level 4's red drifter must be
   `Mover.hazard` and not a `hazardOrbs` entry — a second, independent reason the ratified flag
   design is the right one.
5. New movers must stay inside the tuned envelope `course.test.ts:357-366` pins: period ∈ [2,4],
   amplitude ∈ [60,140]. The three above do.

### Still open, for him and not for us

The level-2 gap is **the first hard block on the road** — a linear walkway with no alternate route.
The checkpoint makes failing it cheap and the level-skip is still the escape hatch, but whether that
is the right place for the first wall is his call, and it is recorded as open in the feedback doc.

Also worth knowing: the level intro line vanishes on her first input, so a gap at the far end of a
level is never read alongside its intro. PLAN §5 ratified per-level intro demos (T9, still unbuilt)
and that is the natural home for teaching this.
