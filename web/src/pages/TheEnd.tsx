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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { theEndCopy } from '../copy/theEnd';
import { MAIN_ID } from '../components/focus';
import { paintRiggs } from '../engine/riggs';
import { useOverlayLabels } from '../storage/useOverlayLabels';
import '../styles/the-end.css';

/**
 * The canvas he is drawn into. He is ~496 px tall and ~448 wide anchored at
 * the centre of his waist cut, so this is his box plus a cell of air.
 */
const STAGE = { width: 480, height: 528 };
const ORIGIN = { x: 240, y: 512 };

/** How many messages there are, so nothing has to count them twice. */
const LAST_MESSAGE = theEndCopy.messages.length - 1;

/**
 * Draw Riggs into a canvas, stepped, until unmounted.
 *
 * `devicePixelRatio` is applied to the backing store and undone with a scale,
 * the same way the practice canvas does it, so he is crisp on a retina display
 * without any of his geometry learning about the ratio.
 *
 * On `prefers-reduced-motion` he is painted ONCE and the loop never starts. He
 * is a blinking, nodding portrait in the corner of a page she is reading —
 * exactly the ambient movement that setting exists to stop.
 */
function useRiggsCanvas(): React.RefObject<HTMLCanvasElement | null> {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = STAGE.width * ratio;
    canvas.height = STAGE.height * ratio;

    const paint = (seconds: number): void => {
      ctx.save();
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, STAGE.width, STAGE.height);
      paintRiggs(ctx, ORIGIN, seconds);
      ctx.restore();
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(0.5);
      return;
    }

    let raf = 0;
    const frame = (nowMs: number): void => {
      paint(nowMs / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return ref;
}

export function TheEnd() {
  const { jumpKey } = useOverlayLabels();
  const canvasRef = useRiggsCanvas();
  /** Which message is showing; `messages.length` means the credits are rolling. */
  const [step, setStep] = useState(0);
  const rolling = step > LAST_MESSAGE;

  const advance = useCallback(() => {
    setStep((n) => Math.min(n + 1, theEndCopy.messages.length));
  }, []);

  /**
   * The forward key advances the page, and ONLY the forward key.
   *
   * `jump = forward, attack = again` is ratified on every overlay, and there is
   * no "again" here — so attack does nothing rather than doing something
   * arbitrary. The key is read from the same bindings the game uses, so a
   * remap follows her here.
   */
  useEffect(() => {
    if (rolling) return;
    const onKey = (event: KeyboardEvent): void => {
      // Space scrolls by default and is a legal jump binding; a page that
      // jumped AND advanced on the same press would lose its own text.
      if (event.code === 'Space' || event.key === ' ') event.preventDefault();
      if (event.key.toLowerCase() === 'z' || event.code === 'Space' || event.key === 'Enter') {
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, rolling]);

  const message = theEndCopy.messages[Math.min(step, LAST_MESSAGE)] ?? '';
  const onLast = step === LAST_MESSAGE;

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
        {/* The letter is from him; the credits are not, so the byline goes
            when the roll starts. */}
        {!rolling && <p className="eyebrow">{theEndCopy.title}</p>}

        {!rolling && (
          <>
            {/* aria-live so a screen reader hears each message as it arrives;
                without it, advancing is silent and the page looks broken. */}
            <p className="the-end-message" aria-live="polite">
              {message}
            </p>
            <div className="the-end-advance">
              <button type="button" className="button" onClick={advance}>
                {onLast ? theEndCopy.advanceButtonLast : theEndCopy.advanceButton}
              </button>
              <span className="fine-print">
                {onLast ? theEndCopy.advanceLast(jumpKey()) : theEndCopy.advance(jumpKey())}
              </span>
            </div>
            <p className="fine-print the-end-progress">
              {step + 1} of {theEndCopy.messages.length}
            </p>
          </>
        )}

        {rolling && (
          <section className="the-end-credits" aria-labelledby={`${MAIN_ID}-credits`}>
            <h1 id={`${MAIN_ID}-credits`}>{theEndCopy.creditsHeading}</h1>
            <h2>{theEndCopy.castHeading}</h2>
            <ul className="cast-list">
              {theEndCopy.cast.map((credit) => (
                <li key={credit.name}>
                  <strong>{credit.name}</strong>
                  <span>{credit.role}</span>
                </li>
              ))}
            </ul>
            <p className="built-line">
              <strong>{theEndCopy.builtHeading}</strong>
              <br />
              {theEndCopy.builtLine}
            </p>
            <Link className="button" to="/">
              {theEndCopy.backToMap}
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
