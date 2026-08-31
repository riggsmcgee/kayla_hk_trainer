// @vitest-environment jsdom
/**
 * `#/the-end`, the last screen of the dojo.
 *
 * What is worth pinning here is the SHAPE of the beat, not the drawing: the
 * letter types itself out at talking pace, forward finishes the sentence she is
 * reading rather than skipping it, and when the last one lands there is nothing
 * after it but a way back to the map.
 *
 * The pace is the part with teeth. Playtest 5 deleted a stage-clear card
 * outright for being "the only one that needs no input", and playtest 8 brought
 * automatic text back on ONE condition: that forward always completes the
 * sentence rather than jumping past it. These tests exist to keep that clause,
 * and to keep the reading speed derived from elapsed seconds rather than from
 * frames — a per-frame increment would read at double speed on a 144 Hz screen.
 *
 * The canvas never runs beyond its first frame: the question here is never what
 * was drawn. `paintRiggs` is mocked so the `speaking` flag it is handed can be
 * read directly, because "his mouth moves only while characters are appearing"
 * is a real ratified behaviour and not a decoration.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theEndCopy } from '../copy/theEnd';
import { GAP_SECONDS, sayingMs } from './theEnd.helpers';
import { TheEnd } from './TheEnd';

/** Every `speaking` flag the page has handed the painter, oldest first. */
const spoken: boolean[] = [];

vi.mock('../engine/riggs', () => ({
  paintRiggs: (_ctx: unknown, _origin: unknown, _t: number, speaking = false) => {
    spoken.push(speaking);
  },
}));

/**
 * A hand-wound `requestAnimationFrame`.
 *
 * The page derives everything from the timestamp it is handed, so driving that
 * timestamp is how a test can watch twelve characters a second arrive without
 * waiting a real second for them. Callbacks are drained one generation at a
 * time, which is what a real frame does.
 */
let now = 0;
let pending: FrameRequestCallback[] = [];

function runFrame(atMs: number): void {
  now = atMs;
  const due = pending;
  pending = [];
  act(() => {
    for (const cb of due) cb(atMs);
  });
}

/**
 * Advance the page's clock to `atMs`, one 16 ms frame at a time.
 *
 * The first frame is run at t = 0 because that is when the page stamps the
 * start of the first message — it takes the timestamp it is HANDED rather than
 * one from mount, so a slow first paint does not eat letters she never saw. A
 * test that skipped it would measure from 16 ms and read one character short
 * for ever after.
 */
function runUntil(atMs: number): void {
  if (now === 0) runFrame(0);
  for (let t = now + 16; t <= atMs; t += 16) runFrame(t);
  if (now < atMs) runFrame(atMs);
}

/**
 * The pace comes from `theEnd.helpers`, not from a number typed again here.
 *
 * This file used to divide by a hand-written 12 and hold its own `GAP_MS` of
 * 1200. The day the pace was actually changed, nine of these tests failed with
 * messages about characters, buttons and a mouth, and not one of them said
 * "the speed moved" — they had never been testing the page's pace, only that
 * two copies of a number still agreed.
 */
const GAP_MS = GAP_SECONDS * 1000;

/**
 * Advance to the instant `chars` characters of the current message are due.
 *
 * The extra millisecond is not a fudge, it is the difference between a test
 * that passes and one that passes on this machine. The page floors
 * `elapsed / 1000 * CHARS_PER_SECOND`, and `chars / rate * 1000` does not
 * always multiply back to exactly `chars` in binary floating point — landing a
 * hair short prints one character fewer. A millisecond is a thirtieth of a
 * character, so it cannot reach the next one.
 */
function runToChars(chars: number): void {
  runUntil(sayingMs(chars) + 1);
}

/**
 * A moment when the first message is provably PART said — the state seven of
 * these tests need, and the state a fixed `runUntil(1000)` stopped describing
 * the moment the letter got faster than a second a sentence.
 */
function runToMidFirstMessage(): void {
  runToChars(Math.floor(FIRST.length / 2));
}

beforeEach(() => {
  now = 0;
  pending = [];
  spoken.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending.push(cb);
    return pending.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  // jsdom has no 2D context, and the page (correctly) gives up without one —
  // which would mean the painter never runs and the mouth could never be
  // checked. The fake records nothing; the `paintRiggs` mock above does that.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    save: () => {},
    restore: () => {},
    scale: () => {},
    clearRect: () => {},
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('performance', { now: () => now });
  stubReducedMotion(false);
});

/** Answer `prefers-reduced-motion` the way a machine with the setting would. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderTheEnd() {
  return render(
    <MemoryRouter>
      <TheEnd />
    </MemoryRouter>,
  );
}

/** Press the site's forward key, the way she would. */
function pressForward(): void {
  act(() => {
    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ' });
  });
}

/** What is on the page right now, as one string. */
function shown(): string {
  return screen.getByText((_, el) => el?.className === 'the-end-message').textContent ?? '';
}

const FIRST = theEndCopy.messages[0]!;
const SECOND = theEndCopy.messages[1]!;
const LAST = theEndCopy.messages[theEndCopy.messages.length - 1]!;

describe('the letter, arriving at talking pace', () => {
  it('starts empty rather than showing the first message whole', () => {
    renderTheEnd();
    runFrame(16);
    expect(shown().length).toBeLessThan(FIRST.length);
  });

  it('reads out its characters off the clock, at the ratified pace', () => {
    // Derived from the pace, not from running the page: the instant the
    // twelfth character is due is the instant twelve of them are showing.
    renderTheEnd();
    runToChars(12);
    expect(shown()).toBe(FIRST.slice(0, 12));
  });

  it('reads at the same speed on a 144 Hz monitor as on a 60 Hz one', () => {
    // The bug this exists for is a per-frame increment, which would be more
    // than twice as far along here. Same instant, 2.4× the frames.
    renderTheEnd();
    runFrame(0);
    const at = sayingMs(12) + 1;
    for (let t = 7; t < at; t += 7) runFrame(t);
    runFrame(at); // land on the same instant the 60 Hz test measured at
    expect(shown()).toBe(FIRST.slice(0, 12));
  });

  it('finishes the first message and pauses before starting the second', () => {
    renderTheEnd();
    runToChars(FIRST.length);
    expect(shown()).toBe(FIRST);
    // Still the first one a beat later: the gap is real, not a rounding error.
    runUntil(sayingMs(FIRST.length) + GAP_MS - 100);
    expect(shown()).toBe(FIRST);
  });

  it('moves itself on once the gap has passed', () => {
    renderTheEnd();
    runUntil(sayingMs(FIRST.length) + GAP_MS + 100);
    expect(shown()).toBe(SECOND.slice(0, shown().length));
    expect(shown().length).toBeLessThan(SECOND.length);
    expect(screen.getByText(`2 of ${theEndCopy.messages.length}`)).toBeDefined();
  });

  it('stops on the last message instead of running off the end', () => {
    renderTheEnd();
    // Generous: every message said, every gap waited, and then some.
    runUntil(120_000);
    expect(shown()).toBe(LAST);
  });
});

describe('forward, which finishes rather than skips', () => {
  it('completes the sentence she is reading instead of jumping past it', () => {
    // The whole clause playtest 8 attached to letting text arrive on its own.
    // Playtest 5 deleted a card outright for needing no input; this is what
    // makes automatic text different from that.
    renderTheEnd();
    runToMidFirstMessage();
    expect(shown().length).toBeLessThan(FIRST.length);
    pressForward();
    runFrame(now + 16);
    expect(shown()).toBe(FIRST);
  });

  it('moves to the next one only on a second press', () => {
    renderTheEnd();
    runToMidFirstMessage();
    pressForward();
    runFrame(now + 16);
    expect(shown()).toBe(FIRST);
    pressForward();
    runFrame(now + 16);
    expect(shown()).toBe(SECOND.slice(0, shown().length));
    expect(shown().length).toBeLessThan(FIRST.length);
  });

  it('says which of the two jobs it is about to do', () => {
    // A button labelled "Next" that does not go next is worse than no button.
    renderTheEnd();
    runToMidFirstMessage();
    expect(screen.getByRole('button', { name: theEndCopy.finishButton })).toBeDefined();
    pressForward();
    runFrame(now + 16);
    expect(screen.getByRole('button', { name: theEndCopy.advanceButton })).toBeDefined();
  });

  it('works from the on-screen button too, for a mouse', () => {
    renderTheEnd();
    runToMidFirstMessage();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: theEndCopy.finishButton }));
    });
    runFrame(now + 16);
    expect(shown()).toBe(FIRST);
  });

  it('never strands her: no press is needed to reach the end', () => {
    // The other half of the same clause. She can read it without touching
    // anything, and she can hurry it without losing a sentence.
    renderTheEnd();
    runUntil(120_000);
    expect(screen.getByRole('link', { name: theEndCopy.backToMap })).toBeDefined();
  });
});

describe('his mouth', () => {
  it('moves while characters are appearing', () => {
    renderTheEnd();
    runToMidFirstMessage();
    expect(spoken).toContain(true);
  });

  it('shuts when the sentence does, and stays shut through the gap', () => {
    renderTheEnd();
    runUntil(sayingMs(FIRST.length) + 100);
    spoken.length = 0;
    // The rest of the gap, with nothing being said.
    runUntil(sayingMs(FIRST.length) + GAP_MS - 100);
    expect(spoken.length).toBeGreaterThan(0);
    expect(spoken).not.toContain(true);
  });

  it('shuts the moment forward completes a sentence early', () => {
    // He has finished the sentence. His mouth should not still be moving
    // because the clock says he had more to say.
    renderTheEnd();
    runToMidFirstMessage();
    pressForward();
    runFrame(now + 16);
    spoken.length = 0;
    runFrame(now + 16);
    expect(spoken).not.toContain(true);
  });

  it('is shut for good once the last sentence lands', () => {
    renderTheEnd();
    runUntil(120_000);
    spoken.length = 0;
    runUntil(121_000);
    expect(spoken).not.toContain(true);
  });
});

describe('under prefers-reduced-motion', () => {
  it('shows each message whole instead of typing it', () => {
    stubReducedMotion(true);
    renderTheEnd();
    runFrame(16);
    expect(shown()).toBe(FIRST);
  });

  it('still moves his mouth for as long as the message would take to say', () => {
    // Ratified in both modes: the mouth is what says the words are HIS. The
    // typing is the decoration; the talking is not.
    stubReducedMotion(true);
    renderTheEnd();
    runToMidFirstMessage();
    expect(spoken).toContain(true);
  });

  it('still moves itself on, at the same pace', () => {
    stubReducedMotion(true);
    renderTheEnd();
    runUntil(sayingMs(FIRST.length) + GAP_MS + 100);
    expect(shown()).toBe(SECOND);
  });

  it('lets forward move straight on, because there is nothing to finish', () => {
    // In typed mode the first press completes the sentence. Here the sentence
    // is already whole, so a press that did nothing would read as a dead key.
    stubReducedMotion(true);
    renderTheEnd();
    runToMidFirstMessage();
    pressForward();
    runFrame(now + 16);
    expect(shown()).toBe(SECOND);
  });
});

describe('what follows the letter', () => {
  it('offers the way back once the last sentence has landed', () => {
    renderTheEnd();
    runUntil(120_000);
    const back = screen.getByRole('link', { name: theEndCopy.backToMap });
    expect(back.getAttribute('href')).toBe('/');
  });

  it('does not offer it while he is still talking', () => {
    // It is the end of the letter, not an exit sign over it.
    renderTheEnd();
    runToMidFirstMessage();
    expect(screen.queryByRole('link', { name: theEndCopy.backToMap })).toBeNull();
  });

  it('rolls no credits, because playtest 8 deleted them', () => {
    // Asserting the ABSENCE, which is the lesson from 745 tests passing while
    // the HUD announced the win thirteen seconds early. The cast list, the
    // headings and the roll are gone; pressing forward at the end must not
    // find them again.
    renderTheEnd();
    runUntil(120_000);
    pressForward();
    runFrame(now + 16);
    expect(screen.queryByText(/the cast/i)).toBeNull();
    expect(screen.queryByText('Bill the Man')).toBeNull();
    expect(screen.queryByText(/bottom of the well/i)).toBeNull();
    expect(shown()).toBe(LAST);
  });

  it('leaves his last sentence on the screen with nothing over it', () => {
    renderTheEnd();
    runUntil(120_000);
    expect(shown()).toBe(LAST);
    expect(screen.queryByRole('button', { name: theEndCopy.advanceButton })).toBeNull();
    expect(screen.queryByRole('button', { name: theEndCopy.finishButton })).toBeNull();
  });
});

describe('what it does not assume', () => {
  it('reads without having beaten anything, so a direct link is never broken', () => {
    // She can reach `#/the-end` from Settings, from a bookmark, or by typing
    // it. None of those carry any progress with them.
    renderTheEnd();
    runUntil(2000);
    expect(shown().length).toBeGreaterThan(0);
  });

  it('draws Riggs with a label, for anyone who cannot see him', () => {
    renderTheEnd();
    expect(screen.getByRole('img', { name: /riggs/i })).toBeDefined();
  });

  it('announces each message whole rather than one character at a time', () => {
    // A live region on the typing text would say "K", "Ka", "Kay"... The
    // reading experience has to be the same for her; the markup does not.
    renderTheEnd();
    runToMidFirstMessage();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe(FIRST);
    expect(screen.getByText((_, el) => el?.className === 'the-end-message')).toHaveProperty(
      'ariaHidden',
      'true',
    );
  });
});
