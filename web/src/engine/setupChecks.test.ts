/**
 * The Setup sandbox's checklist.
 *
 * The thing worth pinning is not that seven strings exist — it is that each
 * item ticks for the input it names and for no other, because this is the one
 * screen on the site whose entire job is telling her the truth about her own
 * controller. A checklist that ticked "slash down" for a sideways swing would
 * be worse than no checklist: she would carry a wrong belief into the pogo
 * course and blame herself for it.
 *
 * The expected values come from PLAN §5's player kit and from playtest 8's
 * ratified seven, not from running the code.
 */
import { describe, expect, it } from 'vitest';
import type { SetupCheck } from '@dojo/shared';
import {
  SETUP_CHECKS,
  SETUP_CHECK_LABELS,
  earnedSetupChecks,
  setupChecksComplete,
} from './setupChecks';
import type { InputFrame } from './types';

/** Nothing held, nothing pressed. Every test starts from here and adds one thing. */
function idle(over: Partial<InputFrame> = {}): InputFrame {
  return {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
    up: false,
    down: false,
    dashPressed: false,
    ...over,
  };
}

/** What one step earns from an empty sheet. */
function earns(input: InputFrame, grounded: boolean, swinging = false): readonly SetupCheck[] {
  return earnedSetupChecks(new Set(), input, { grounded, swinging });
}

describe('the seven items', () => {
  it('covers the whole player kit and nothing beyond it', () => {
    // PLAN §5: jump + dash + a nail with three directions. No double jump, no
    // shade cloak, no spells — so an eighth item would be teaching her
    // something the dojo deliberately does not have.
    expect([...SETUP_CHECKS].sort()).toEqual(
      ['dash', 'jump', 'left', 'right', 'slashDown', 'slashSide', 'slashUp'].sort(),
    );
  });

  it('gives every item something to read', () => {
    for (const check of SETUP_CHECKS) {
      expect(SETUP_CHECK_LABELS[check].length).toBeGreaterThan(3);
    }
  });

  it('says out loud that the downslash needs the air', () => {
    // She cannot do this one standing still, and a label that did not say so
    // would leave her pressing down on the floor wondering why nothing ticks.
    expect(SETUP_CHECK_LABELS.slashDown).toMatch(/air/i);
  });
});

describe('what ticks what', () => {
  it('ticks a direction for holding it', () => {
    expect(earns(idle({ left: true }), true)).toEqual(['left']);
    expect(earns(idle({ right: true }), true)).toEqual(['right']);
  });

  it('wants a jump off the ground, not a button held in mid-air', () => {
    // A jump press while she is falling proves nothing about the button she
    // would actually jump with, and would tick the box on a controller that
    // never left the floor.
    expect(earns(idle({ jumpPressed: true }), true)).toEqual(['jump']);
    expect(earns(idle({ jumpPressed: true }), false)).toEqual([]);
  });

  it('ticks the dash on the press', () => {
    expect(earns(idle({ dashPressed: true }), true)).toEqual(['dash']);
  });

  it('ticks nothing for a nail direction unless a swing actually starts', () => {
    // Holding up is aiming, not swinging. The nail has a cadence, and a swing
    // she pressed for during the cooldown never happened.
    expect(earns(idle({ up: true, attackPressed: true }), true, false)).toEqual([]);
  });

  it('reads the swing direction the way the Knight does', () => {
    expect(earns(idle({ attackPressed: true }), true, true)).toEqual(['slashSide']);
    expect(earns(idle({ attackPressed: true, up: true }), true, true)).toEqual(['slashUp']);
    expect(earns(idle({ attackPressed: true, down: true }), false, true)).toEqual(['slashDown']);
  });

  it('is a SIDE swing when she presses down on the ground', () => {
    // The rule the whole sandbox turns on. Down only means down in the air, so
    // a grounded down-press swings sideways — and the checklist must agree,
    // or it would tick the pogo item for something that is not a pogo input.
    expect(earns(idle({ attackPressed: true, down: true }), true, true)).toEqual(['slashSide']);
  });

  it('prefers down over up when she is holding both in the air', () => {
    // Same precedence as the Knight's own rule, tested because a checklist
    // that disagreed here would tick the wrong box for a real input.
    expect(earns(idle({ attackPressed: true, down: true, up: true }), false, true)).toEqual([
      'slashDown',
    ]);
  });
});

describe('as a sheet that fills up', () => {
  it('reports only what is newly earned, so a tick can be reacted to once', () => {
    const done = new Set<SetupCheck>(['left']);
    expect(
      earnedSetupChecks(done, idle({ left: true, right: true }), {
        grounded: true,
        swinging: false,
      }),
    ).toEqual(['right']);
  });

  it('can earn several at once, because she can hold several at once', () => {
    // The leverless is sold to her on exactly this — "jump, attack, dash and
    // down can all be held at once" — so the sheet must not serialise them.
    const earned = earns(idle({ right: true, jumpPressed: true, dashPressed: true }), true);
    expect([...earned].sort()).toEqual(['dash', 'jump', 'right']);
  });

  it('is not complete until every item is ticked', () => {
    const almost = new Set<SetupCheck>(SETUP_CHECKS.filter((c) => c !== 'slashDown'));
    expect(setupChecksComplete(almost)).toBe(false);
    expect(setupChecksComplete(new Set(SETUP_CHECKS))).toBe(true);
  });

  it('is not complete on an empty sheet, which is where every save starts', () => {
    expect(setupChecksComplete(new Set())).toBe(false);
  });
});
