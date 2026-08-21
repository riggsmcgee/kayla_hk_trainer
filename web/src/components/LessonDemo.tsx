/**
 * A small, non-interactive demo canvas for lesson pages: slow-motion
 * scripted replays on the real engine. Unlike PracticeCanvas it captures NO
 * keyboard input — lesson pages must scroll and read like normal pages.
 */
import { useEffect, useRef } from 'react';
import { createDemoSession } from '../engine/demo';
import type { DemoScript } from '../engine/demo';
import { createGameLoop } from '../engine/loop';

interface LessonDemoProps {
  script: DemoScript;
  /** Accessible description of what the demo shows. */
  label: string;
}

export function LessonDemo({ script, label }: LessonDemoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const session = createDemoSession(script);
    const loop = createGameLoop({
      simulate: (dt) =>
        session.step(
          {
            left: false,
            right: false,
            up: false,
            down: false,
            jumpHeld: false,
            jumpPressed: false,
            attackPressed: false,
            dashPressed: false,
          },
          dt,
        ),
      render: (alpha) => session.render(ctx, alpha),
    });
    loop.start();
    return () => loop.stop();
  }, [script]);

  return (
    <figure className="lesson-demo-frame">
      <canvas
        ref={canvasRef}
        width={script.view.width}
        height={script.view.height}
        aria-label={label}
        role="img"
      >
        {label}
      </canvas>
    </figure>
  );
}
