/**
 * The game's mount point. React renders this canvas exactly once and never
 * touches it again — the fixed-timestep loop (engine/loop.ts) owns the
 * pixels. The session factory prop keeps this component generic across
 * practice modes; sessions own all game state and drawing.
 *
 * Keys come from the stored bindings (Settings page), read once on mount;
 * the caption under the canvas is generated from the same table.
 *
 * The canvas takes keyboard focus on mount: the keyboard adapter leaves a
 * focused button or link its own keys, so after a level chip is clicked the
 * game (remounted per pick) must own the keyboard again.
 */
import { useEffect, useRef } from 'react';
import { CANVAS } from '../engine/constants';
import { attachKeyboard, createKeyboardInput } from '../engine/input';
import { createGameLoop } from '../engine/loop';
import type { GameSession } from '../engine/session';
import { controlsCaption } from '../storage/keyNames';
import { useBindings } from '../storage/useBindings';

interface PracticeCanvasProps {
  /** Accessible name for the canvas. */
  label: string;
  /** Builds the session on mount; a new mount gets a fresh session. */
  createSession: () => GameSession;
}

export function PracticeCanvas({ label, createSession }: PracticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bindings] = useBindings();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const session = createSession();
    const keyboard = createKeyboardInput(bindings);
    const detachKeyboard = attachKeyboard(keyboard);
    canvas.focus({ preventScroll: true });

    const loop = createGameLoop({
      simulate: (dt) => session.step(keyboard.sample(), dt),
      render: (alpha) => session.render(ctx, alpha),
    });
    loop.start();

    return () => {
      loop.stop();
      detachKeyboard();
    };
  }, [createSession, bindings]);

  return (
    <figure className="practice-canvas-frame">
      <canvas
        ref={canvasRef}
        width={CANVAS.width}
        height={CANVAS.height}
        aria-label={label}
        tabIndex={-1}
      >
        {label} — this mini-game needs a browser with canvas support.
      </canvas>
      <figcaption className="canvas-note">{controlsCaption(bindings)}</figcaption>
    </figure>
  );
}
