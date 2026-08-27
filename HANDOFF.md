# Proactive sprint handoff

**Project:** Kayla's Hollow Knight Dojo **Branch:** `proactive/2026-08-27-1759` (from `proactive/2026-08-27-1426`)
**Window:** 2026-08-27 17:59 to 19:59 local (120 min, "complete the handoff from last session")
**Status:** done **Relaunches:** 0
**Orchestrator model:** Opus **Cost so far:** see `.proactive/sprint.json` runs

The contract was `docs/feedback/2026-08-27-playtest-8.md`. Nothing in it was re-decided.
Its items **1 (the photo) and 2 (the longer read-off)** need you in the room and were not
attempted. Items **3 and 4 are done**, and item **1's ratified half — B wins, A and C are
deleted — was done too**, because it turned out never to have shipped and item 4 depended on it.

---

## Needs you

1. **The photo, and then one redraw of B's face.** This is still item 1 and still needs you.
   `DEFAULT_RIGGS_VARIANT` was **still pointing at candidate A** when this sprint opened — the
   pick was ratified in the contract but never landed in code, so the last screen has been
   drawing the wrong man. It draws B now. The likeness round-trip is untouched: send the
   photograph, one revised face goes into `riggsB.ts`, and `node scripts/build-riggs-gallery.mjs`
   shows it back to you as a picture.
2. **The bow tie is still an unpicked placeholder** (`RIGGS_TIE = '#a8891c'`). The gallery page
   now asks only this and the likeness, since the drawing question is answered. One line to
   answer.
3. **The longer read-off, spoken aloud.** Item 2, unstarted. The typewriter that will carry it is
   built and running, so the only thing missing is the words. The arithmetic to hold you to:
   **12 characters a second**, so every 150 characters you add is another twelve seconds of her
   sitting still. The four that exist run about **63 seconds** end to end.
4. **The leverless, with the board in hand.** PLAN M7 has called this "ten seconds to find out"
   for four sessions now and it is still the thing blocking item 6. What I could establish from
   the code without hardware is below under _Ideas not acted on_; it does not substitute for
   plugging it in.
5. **Nothing is red.** 820 tests, lint, typecheck and build were green at baseline and are green
   now. Two files at the repo root, `--full-page` and `--selector`, are stray output from a
   mis-parsed screenshot command dated 26 Aug. They predate this sprint and I left them alone
   rather than deleting files you might have meant to keep; they are junk and safe to remove.

## Change ledger

| #   | Commit    | What                                                                                             | How to try it                                                      | Risk |
| --- | --------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ---- |
| 1   | `317e8c5` | Candidate B becomes the only Riggs; A and C deleted; the painter's mouth takes a `speaking` flag | `node scripts/build-riggs-gallery.mjs` then open the HTML it names | low  |
| 2   | `88ac90e` | The credits are deleted, and the letter types itself out at talking pace with his mouth moving   | `#/the-end` — watch it, then press Z mid-sentence                  | med  |

Merge everything: `git checkout proactive/2026-08-27-1426 && git merge proactive/2026-08-27-1759`
Drop one: `git revert <hash>` on the sprint branch first, then merge.

**Why two commits and not three.** Deleting the credits (note 2) and typing the letter out
(note 3) are one screen and one set of tests; an intermediate `TheEnd.tsx` with the credits gone
and no typewriter is a version nobody would ship and whose tests I would have written twice. If
you want the credits back, the revert of `88ac90e` brings the old advance-one-at-a-time page with
them — it does not leave you the typewriter.

## Baseline (before any change)

- `npm test` — **820 passed** (819 web across 39 files, 1 server). 38.5 s.
- `npm run lint` — clean. `npm run typecheck` — clean. `npm run build` — clean.
- Bundle: **JS 414.88 kB, CSS 27.42 kB**.
- Nothing was broken at baseline. The jsdom `getContext()` warnings in the test output are noise
  and predate this sprint.

## Final check (after the last change)

- `npm test` — **820 passed** (819 web, 1 server). The same count as baseline, which is a
  coincidence worth spelling out rather than glossing: the two rewritten files held **37 tests
  before and 37 after**. The credits roll took 6 with it and the three-candidate portfolio took
  14 (7 shared tests run three times, collapsed to one painter); the typewriter, the forward
  clause, the mouth and the reduced-motion path put 20 back.
- `npm run lint`, `npm run typecheck`, `npm run build` — all clean.
- Bundle: **JS 410.84 kB (−4.04), CSS 26.84 kB (−0.58)**. Two painters and a credits roll.
- **Browser pass** (Playwright, dev server on 5199, `.proactive/scratch/the-end-watch.mjs`):
  loaded `#/the-end`, watched it type, pressed forward mid-sentence, watched it finish by itself.
  30 characters at two seconds; forward took that to the full 81 rather than jumping to message 2;
  a second press moved on; it reached the last message unattended; the back-to-map chip appeared
  and the advance controls went. **Zero console errors, warnings or failed requests.** Screenshots
  in `.proactive/scratch/the-end/`.

## Started, sliced, continued in PLAN.md

Nothing was sliced. What was not started, and why, is in PLAN §8 — items 5 (the ~52 remaining
strings), 6 (the controller preset), 7 (the sandbox) and 8 (the one-to-one editor) are each
larger than the time that was left, and 6 is blocked behind the leverless question anyway.
The contract said "this is more than one session" and it was right.

## Tried and reverted

Nothing. Two things were changed mid-task rather than reverted, both worth knowing:

- **A latent bug the tests found.** The read-off's clock used `0` for "this message has not
  started yet". Zero is a legal `requestAnimationFrame` timestamp, so a page that got one would
  restamp its start every frame and never advance a character. It only surfaced because a test
  handed it a 0 — in a real browser the first timestamp is never 0 and it would have sat there
  for years. The sentinel is `null` now.
- **The `aria-live` region.** The old page announced each message on a live region. Left as it
  was, a screen reader would have read the typewriter one character at a time — "K", "Ka",
  "Kay". The typed text is `aria-hidden` now and the whole message is announced beside it.

## Ideas not acted on

**The controller hole, as far as code can answer it.** Mirrored into PLAN.md under M7.

- `progress.controller` is written once and read in exactly two places, and the contract has
  both. The one that matters for the gate is `storage/progress.ts:111`, where Setup's completion
  is `progress.controller !== undefined` — so picking a controller both configures nothing _and_
  is the entire proof that the chapter is done.
- `DEFAULT_GAMEPAD_BINDINGS` (`engine/gamepad.ts:72`) binds `jump → faceDown` and
  `attack → faceLeft`. On a pad those are different fingers, so **the clash the leverless
  diagram warns about is a claim about the leverless's physical layout, not about these
  bindings**. That matters for the ten-second check: if her board reports as a **keyboard**, this
  whole table is never consulted and the fix belongs in the keyboard bindings, which is a
  different file and a smaller job. If it reports as a **gamepad**, this is the table the preset
  rewrites.
- Nothing anywhere calls `navigator.getGamepads()` outside `PracticeCanvas`, so **there is no
  place on the site that would tell you what her board reports as.** A one-screen diagnostic in
  Settings that prints connected pads' `id` strings would turn "ten seconds with the board" into
  ten seconds she can do herself and report back. I did not build it — it is a feature nobody
  asked for and the ladder says those are your call — but it is the cheapest way to unblock item 6
  without you being in the same room as her.

**The message box's floor.** `.the-end-message` keeps `min-height: 7.5rem` so the button does not
walk up the page sixty times a second while he is typing. On the _last_ message, where nothing
more will ever arrive, that leaves a visible gap between his last sentence and the back link. It
is deliberate rather than broken, and it is the kind of thing you are fast at judging from a
picture: `.proactive/scratch/the-end/4-finished.png`.

## Environment changes

None. No installs, no upgrades, no global tools, no config touched. The dev server was run on
5199 as the traps file instructs and has been shut down.

## Skills used

Only `proactive` itself. `tdd` was suggested by the last handoff for item 4 and its discipline
was followed by hand — the typewriter's tests derive their expected values from the ratified
12 characters a second rather than from running the page, and the 144 Hz test exists because the
spec named that failure. Invoking the skill would have added a process without changing the
tests. Logged in `docs/skills-log.md`.

## Suggested next session

Sit down with it rather than running `/proactive` again — **the top three things all need you**:
the photograph, the read-off spoken aloud, and the leverless plugged in. Those three unblock
items 1, 2 and 6 in one sitting, and item 6 collapses to almost nothing if the board reports as a
keyboard.

Then the next unattended sprint has a clean run at **item 5, the ~52 remaining strings**, which
is mechanical, load-bearing under item 8, and needs nobody.
