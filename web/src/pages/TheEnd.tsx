/**
 * `#/the-end` — the last screen of the dojo.
 *
 * Reached by pressing forward on the celebration after beating the Two Bills,
 * and from Settings once she has done it at least once.
 *
 * It is a PAGE and not a canvas beat, and the deciding fact is typographic:
 * every string the game draws on a canvas is `system-ui`, so an 8-bit Riggs
 * speaking in the HUD font would read as a placeholder (playtest 6 flagged
 * exactly that). The Bills already break the palette on purpose — "Uncle Bill
 * is from a different game" — so handing off out of the arena reads as
 * ARRIVING SOMEWHERE rather than as a seam.
 *
 * So: he is drawn on a canvas by the shipped painter, and everything he says
 * is real DOM text in the site's own face.
 *
 * Playtest 8 made the text arrive on its own, at talking pace, with his mouth
 * moving while it does — and deleted the credits that used to follow it. The
 * letter is now the whole thing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { theEndCopy } from '../copy/theEnd';
import { paintRiggs } from '../engine/riggs';
import { billsWinWasAssisted } from '../storage/bests';
import { useOverlayLabels } from '../storage/useOverlayLabels';
import { useProgress } from '../storage/useChapterProgress';
import '../styles/the-end.css';

/**
 * The canvas he is drawn into. He is ~496 px tall and ~448 wide anchored at
 * the centre of his waist cut, so this is his box plus a cell of air.
 */
const STAGE = { width: 480, height: 528 };
const ORIGIN = { x: 240, y: 512 };

/**
 * Talking pace, ratified in playtest 8.
 *
 * Conversational speech sits near 12 characters a second and comfortable adult
 * reading is 12–16, so one number serves both: it reads as fast as he would
 * say it. The messages average about 150 characters, which is twelve seconds
 * each — the arithmetic to check against if the letter ever gets longer.
 */
const CHARS_PER_SECOND = 12;

/** The silence between one message finishing and the next starting. */
const GAP_SECONDS = 1.2;

/**
 * The single frame he is frozen on under `prefers-reduced-motion`.
 *
 * Not zero: the blink is the LAST two frames of its cycle, so t = 0 would be
 * safe, but 0.5 s is mid-breath and mid-nod-gap, which is the most neutral
 * pose he has.
 */
const STILL_T = 0.5;

/**
 * How many messages there are, so nothing has to count them twice.
 *
 * Safe as a module constant only because the assisted letter is the same
 * length as the clean one. If that ever stops being true this has to move
 * inside the component, or an assisted reader never reaches "finished" and the
 * way back to the map never appears.
 */
const LAST_MESSAGE = theEndCopy.messages.length - 1;

/** What the page shows: which message, and how much of it has arrived. */
interface ReadOffView {
  index: number;
  /** The characters that have arrived so far — the whole message if reduced. */
  text: string;
  /** True once he has finished saying this one, typed out or waited through. */
  said: boolean;
}

/**
 * The read-off's clock, and everything the animation frame mutates.
 *
 * It lives in a ref rather than in state because a frame that changes nothing
 * visible must not re-render the page: at 12 characters a second, 59 of every
 * 60 frames change nothing.
 */
interface ReadOffClock {
  index: number;
  /**
   * When the current message started being said, in `performance.now()` ms,
   * or null before the first frame has handed one over. It is null and not 0
   * because 0 is a legal timestamp, and a sentinel a real clock can produce is
   * a sentinel that eventually lies.
   */
  begunAt: number | null;
  /** When it finished, or null while it is still being said. */
  finishedAt: number | null;
  /** Set by the forward key: show the rest of this sentence at once. */
  forced: boolean;
  /**
   * Whether he has finished the current message. Written by the frame and read
   * by the forward key, so "has he finished?" is answered in exactly one place
   * — two answers to that question is how forward ends up completing a
   * sentence that had already completed.
   */
  said: boolean;
}

/**
 * Drive the letter: type each message out, pause, move to the next.
 *
 * The character count is derived from ELAPSED SECONDS rather than incremented
 * once per frame. That is the whole reason this is not four lines: a per-frame
 * increment reads at twice the speed on a 144 Hz monitor as on a 60 Hz one,
 * which is the same bug the ending's rise had (`cda951e`).
 *
 * `typed` is false under `prefers-reduced-motion`, where every message is shown
 * WHOLE. The clock still runs underneath it — he is still saying the sentence
 * for as long as it would take — because the mouth moves in both modes.
 *
 * The returned `speaking` ref is deliberately not state: it changes twice per
 * message and only the canvas reads it, so putting it in state would re-render
 * the letter for the benefit of a drawing.
 */
function useReadOff(
  messages: readonly string[],
  typed: boolean,
): {
  view: ReadOffView;
  speaking: React.RefObject<boolean>;
  forward: () => void;
} {
  const [view, setView] = useState<ReadOffView>(() => ({
    index: 0,
    text: typed ? '' : (messages[0] ?? ''),
    said: false,
  }));
  const speaking = useRef(true);
  const clock = useRef<ReadOffClock>({
    index: 0,
    begunAt: null,
    finishedAt: null,
    forced: false,
    said: false,
  });

  useEffect(() => {
    let raf = 0;

    const frame = (nowMs: number): void => {
      const c = clock.current;
      // The first frame is the start of the first message; taking the stamp
      // here rather than at mount means a slow first paint does not eat
      // letters she never saw.
      if (c.begunAt === null) c.begunAt = nowMs;

      let message = messages[c.index] ?? '';
      let spoken = c.forced
        ? message.length
        : Math.min(message.length, Math.floor(((nowMs - c.begunAt) / 1000) * CHARS_PER_SECOND));
      let said = spoken === message.length;

      if (said && c.finishedAt === null) c.finishedAt = nowMs;

      // Automatic, but never a trap: the gap runs itself, and forward below
      // can end any part of it early.
      if (
        said &&
        c.index < messages.length - 1 &&
        nowMs - (c.finishedAt ?? nowMs) >= GAP_SECONDS * 1000
      ) {
        c.index += 1;
        c.begunAt = nowMs;
        c.finishedAt = null;
        c.forced = false;
        message = messages[c.index] ?? '';
        spoken = 0;
        said = message.length === 0;
      }

      c.said = said;
      speaking.current = !said;

      const next: ReadOffView = {
        index: c.index,
        text: typed ? message.slice(0, spoken) : message,
        said,
      };
      // At 12 characters a second, 59 of every 60 frames change nothing. Only
      // the ones that do are allowed to re-render the page.
      setView((prev) =>
        prev.index === next.index && prev.text === next.text && prev.said === next.said
          ? prev
          : next,
      );

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [messages, typed]);

  /**
   * Forward: finish the sentence she is reading, or move on if it is finished.
   *
   * This clause is what stops automatic text repeating the wave auto-advance
   * failure playtest 5 deleted outright. A reader who looks away for five
   * seconds never loses a sentence, and an impatient one never has to wait —
   * the key means "I am ready", not "skip".
   *
   * Under reduced motion the sentence is already whole, so there is nothing to
   * finish and forward simply moves on.
   */
  const forward = useCallback(() => {
    const c = clock.current;
    if (typed && !c.said) {
      c.forced = true;
      return;
    }
    if (c.index < messages.length - 1) {
      c.index += 1;
      c.begunAt = performance.now();
      c.finishedAt = null;
      c.forced = false;
      c.said = false;
    }
  }, [messages, typed]);

  return { view, speaking, forward };
}

/**
 * Draw Riggs into a canvas, stepped, until unmounted.
 *
 * `devicePixelRatio` is applied to the backing store and undone with a scale,
 * the same way the practice canvas does it, so he is crisp on a retina display
 * without any of his geometry learning about the ratio.
 *
 * On `prefers-reduced-motion` he is frozen on one frame — he is a blinking,
 * nodding portrait in the corner of a page she is reading, exactly the ambient
 * movement that setting exists to stop — but his MOUTH still moves, because
 * playtest 8 ratified that in both modes: the point of the animation is that
 * he is saying the words she is reading, and that is content, not decoration.
 * So the loop still runs; it just repaints only when the mouth changes.
 */
function useRiggsCanvas(
  speaking: React.RefObject<boolean>,
): React.RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = STAGE.width * ratio;
    canvas.height = STAGE.height * ratio;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const paint = (seconds: number, talking: boolean): void => {
      ctx.save();
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, STAGE.width, STAGE.height);
      paintRiggs(ctx, ORIGIN, seconds, talking);
      ctx.restore();
    };

    let raf = 0;
    let paintedMouth: boolean | null = null;
    const frame = (nowMs: number): void => {
      const talking = speaking.current;
      // Frozen, he is one of two pictures; repainting the other 58 frames a
      // second would be work with nothing to show for it.
      if (!still || talking !== paintedMouth) {
        paint(still ? STILL_T : nowMs / 1000, talking);
        paintedMouth = talking;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [speaking]);

  return ref;
}

export function TheEnd() {
  const { jumpKey } = useOverlayLabels();
  // Read once: a page that switched typing modes half way through a sentence
  // would be a stranger bug than either mode is a behaviour.
  const [typed] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /**
   * Which letter she gets. Read from her runs at render, so the full version
   * is restored the moment she has a clean win — the two lines about never
   * being touched become true retroactively, and the letter should say them.
   */
  const { runs } = useProgress();
  const messages = useMemo(
    () => (billsWinWasAssisted(runs) ? theEndCopy.messagesAssisted : theEndCopy.messages),
    [runs],
  );
  const { view, speaking, forward } = useReadOff(messages, typed);
  const canvasRef = useRiggsCanvas(speaking);

  /** Nothing follows the letter, so the last sentence finishing is the end. */
  const finished = view.index === LAST_MESSAGE && view.said;
  /** Forward's job right now: finish the sentence, or move to the next one. */
  const finishing = typed && !view.said;

  /**
   * The forward key advances the page, and ONLY the forward key.
   *
   * `jump = forward, attack = again` is ratified on every overlay, and there is
   * no "again" here — so attack does nothing rather than doing something
   * arbitrary. The key is read from the same bindings the game uses, so a
   * remap follows her here.
   */
  useEffect(() => {
    if (finished) return;
    const onKey = (event: KeyboardEvent): void => {
      // Space scrolls by default and is a legal jump binding; a page that
      // jumped AND advanced on the same press would lose its own text.
      if (event.code === 'Space' || event.key === ' ') event.preventDefault();
      if (event.key.toLowerCase() === 'z' || event.code === 'Space' || event.key === 'Enter') {
        forward();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, finished]);

  const wholeMessage = messages[view.index] ?? '';

  return (
    <div className="the-end">
      <div className="the-end-stage">
        <canvas
          ref={canvasRef}
          className="riggs-canvas"
          role="img"
          aria-label="An eight-bit drawing of Riggs, waist-up, wearing a bow tie"
          style={{ width: STAGE.width, height: STAGE.height }}
        />
      </div>

      <div className="the-end-say">
        <p className="eyebrow">{theEndCopy.title}</p>

        {/* The typed text is hidden from screen readers and the whole message
            is announced beside it. A live region on the typing text would
            announce it one character at a time, which is unusable — the
            reading experience has to be the same, not the same markup. */}
        <p className="the-end-message" aria-hidden="true">
          {view.text}
        </p>
        <p className="sr-only" aria-live="polite">
          {wholeMessage}
        </p>

        {!finished && (
          <>
            <div className="the-end-advance">
              <button type="button" className="button" onClick={forward}>
                {finishing ? theEndCopy.finishButton : theEndCopy.advanceButton}
              </button>
              <span className="fine-print">
                {finishing ? theEndCopy.finish(jumpKey()) : theEndCopy.advance(jumpKey())}
              </span>
            </div>
            <p className="fine-print the-end-progress">
              {view.index + 1} of {messages.length}
            </p>
          </>
        )}

        {/* Playtest 8 deleted the credits rather than expanding them, so this
            is all that follows the last sentence: a quiet way back, and no
            gold button competing with the thing he actually wrote. */}
        {finished && (
          <p className="the-end-back">
            <Link className="chip" to="/">
              {theEndCopy.backToMap}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
