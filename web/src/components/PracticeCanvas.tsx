/**
 * The game's mount point. React renders this canvas exactly once and never
 * touches it again — the fixed-timestep loop (engine/loop.ts) owns the
 * pixels. The session factory prop keeps this component generic across
 * practice modes; sessions own all game state and drawing.
 */
import { useEffect, useRef } from 'react';
import { CANVAS } from '../engine/constants';
import { attachKeyboard, createKeyboardInput } from '../engine/input';
import { createGameLoop } from '../engine/loop';
import type { GameSession } from '../engine/session';

interface PracticeCanvasProps {
  /** Accessible name for the canvas. */
  label: string;
  /** Builds the session on mount; a new mount gets a fresh session. */
  createSession: () => GameSession;
}

export function PracticeCanvas({ label, createSession }: PracticeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const session = createSession();
    const keyboard = createKeyboardInput();
    const detachKeyboard = attachKeyboard(keyboard);

    const loop = createGameLoop({
      simulate: (dt) => session.step(keyboard.sample(), dt),
      render: (alpha) => session.render(ctx, alpha),
    });
    loop.start();

    return () => {
      loop.stop();
      detachKeyboard();
    };
  }, [createSession]);

  return (
    <figure className="practice-canvas-frame">
      <canvas ref={canvasRef} width={CANVAS.width} height={CANVAS.height} aria-label={label}>
        {label} — this practice area needs a browser with canvas support.
      </canvas>
      <figcaption className="canvas-note">
        Move with ← → or A/D · jump with Z or Space (hold for height, tap for a hop) · slash
        with X or J (hold ↓ in the air to pogo) · dash with C, K, or Shift.
      </figcaption>
    </figure>
  );
}
