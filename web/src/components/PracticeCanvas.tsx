/**
 * The game's mount point. React renders this canvas exactly once and never
 * touches it again — the fixed-timestep loop (engine/loop.ts) owns the
 * pixels. The session factory prop keeps this component generic across
 * practice modes; sessions own all game state and drawing.
 *
 * The canvas takes keyboard focus on mount: the keyboard adapter leaves a
 * focused button or link its own keys, so after a level chip is clicked the
 * game (remounted per pick) must own the keyboard again.
 *
 * THE SESSION AND THE INPUT ADAPTERS HAVE SEPARATE LIVES, and that separation
 * is load-bearing rather than tidy. Both used to hang off one effect whose
 * deps included the bindings, so changing a key rebuilt the session too — the
 * Knight vanished and respawned. That was invisible while every remap happened
 * on Settings, where there is no Knight. The sandbox puts the remap controls
 * on the same screen as a live one, and "I pressed Remap and the game
 * restarted" is exactly the failure `useBindings` was made a shared store to
 * avoid. So: the session is built once per `createSession`, and rebinding
 * swaps only the adapter under it.
 */
import { useEffect, useRef } from 'react';
import { CANVAS } from '../engine/constants';
import { NO_INPUT, attachKeyboard, createKeyboardInput, type KeyboardInput } from '../engine/input';
import { createGamepadInput, mergeInput, readGamepads, type GamepadInput } from '../engine/gamepad';
import { noteInputSource } from '../engine/inputSource';
import { useInputSource } from '../storage/useInputSource';
import { useGamepadBindings } from '../storage/useGamepadBindings';
import { createGameLoop } from '../engine/loop';
import type { GameSession } from '../engine/session';
import { controlsCaption } from '../storage/keyNames';
import { useBindings } from '../storage/useBindings';

interface PracticeCanvasProps {
  /** Accessible name for the canvas. */
  label: string;
  /**
   * The canvas element, for a page that has to give it the keyboard back.
   *
   * The adapter ignores keys pressed while a button or link has focus, so a page
   * with controls beside the game — the practice floor's Remap buttons — leaves
   * the Knight deaf until focus comes back here.
   */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Builds the session on mount; a new mount gets a fresh session. */
  createSession: () => GameSession;
  /**
   * Stop reading her input without stopping the world.
   *
   * True while the page is capturing a key or a button for a rebind: the loop
   * keeps stepping (so the Knight still settles onto the floor rather than
   * freezing mid-air), but the frame it is handed is empty, so the key she is
   * assigning cannot also be played. The pad is why this exists at all — the
   * keyboard adapter already ignores keys pressed while a button has focus,
   * and nothing anywhere ignores a gamepad.
   */
  inputPaused?: boolean;
}

export function PracticeCanvas({
  label,
  createSession,
  inputPaused = false,
  canvasRef: exposed,
}: PracticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bindings] = useBindings();
  const [padBindings] = useGamepadBindings();
  const source = useInputSource();

  // The loop reads these through refs so that changing a binding — or pausing
  // — never re-runs the effect that owns the session.
  const keyboardRef = useRef<KeyboardInput | null>(null);
  const gamepadRef = useRef<GamepadInput | null>(null);
  const pausedRef = useRef(inputPaused);
  pausedRef.current = inputPaused;

  // The keyboard adapter: rebuilt whenever her key bindings change, because the
  // code→action table is baked in at construction.
  useEffect(() => {
    const keyboard = createKeyboardInput(bindings);
    const detach = attachKeyboard(keyboard);
    keyboardRef.current = keyboard;
    return () => {
      detach();
      keyboardRef.current = null;
    };
  }, [bindings]);

  // The pad adapter, same rule. Polled rather than evented, so it needs no
  // listener of its own — the loop asks it for a frame.
  useEffect(() => {
    const gamepad = createGamepadInput(padBindings);
    // Primed with one discarded poll, and this line is load-bearing. A press
    // edge is the difference against the previous poll, and a fresh adapter has
    // no previous poll — so a button still HELD when the bindings changed would
    // read as newly pressed. On the practice floor that is her finger still on
    // the button she just assigned, and the Knight would jump the instant she
    // finished telling it what jump means.
    gamepad.sample(readGamepads());
    gamepadRef.current = gamepad;
  }, [padBindings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const session = createSession();
    canvas.focus({ preventScroll: true });

    const loop = createGameLoop({
      simulate: (dt) => {
        // Sampled even while paused, and then thrown away. `sample()` clears
        // the press edges, so draining them here is what stops the jump she
        // pressed during a capture from firing the instant the capture ends.
        const fromKeys = keyboardRef.current?.sample() ?? NO_INPUT;
        const fromPad = gamepadRef.current?.sample(readGamepads()) ?? NO_INPUT;
        if (pausedRef.current) {
          session.step(NO_INPUT, dt);
          return;
        }
        // The last point in the whole pipeline where the two frames are still
        // told apart: mergeInput ORs them and the session cannot ask. Recorded
        // here so the copy on screen can name the button she just pressed.
        noteInputSource(fromKeys, fromPad);
        session.step(mergeInput(fromKeys, fromPad), dt);
      },
      render: (alpha) => session.render(ctx, alpha),
    });
    loop.start();

    return () => loop.stop();
  }, [createSession]);

  return (
    <figure className="practice-canvas-frame">
      <canvas
        ref={(el) => {
          canvasRef.current = el;
          if (exposed) exposed.current = el;
        }}
        width={CANVAS.width}
        height={CANVAS.height}
        aria-label={label}
        tabIndex={-1}
      >
        {label} — this mini-game needs a browser with canvas support.
      </canvas>
      <figcaption className="canvas-note">
        {controlsCaption(bindings, padBindings, source)}
      </figcaption>
    </figure>
  );
}
