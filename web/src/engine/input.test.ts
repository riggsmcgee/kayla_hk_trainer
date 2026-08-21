/**
 * Input core seam tests (M1).
 *
 * Seam: createKeyboardInput() — a pure key-state machine fed KeyboardEvent
 * codes by a thin DOM adapter. sample() is called exactly once per simulation
 * step and is where press edges are consumed.
 */
import { describe, expect, it } from 'vitest';
import { createKeyboardInput } from './input';

describe('keyboard input sampling', () => {
  it('reports held directions', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('ArrowRight');
    expect(kb.sample().right).toBe(true);
    kb.handleKeyUp('ArrowRight');
    expect(kb.sample().right).toBe(false);
  });

  it('supports WASD as well as arrows', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyA');
    kb.handleKeyDown('KeyW');
    kb.handleKeyDown('KeyS');
    const f = kb.sample();
    expect(f.left).toBe(true);
    expect(f.up).toBe(true);
    expect(f.down).toBe(true);
  });

  it('reports a jump press edge exactly once, held until keyup', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyZ');
    const first = kb.sample();
    expect(first.jumpPressed).toBe(true);
    expect(first.jumpHeld).toBe(true);
    const second = kb.sample();
    expect(second.jumpPressed).toBe(false);
    expect(second.jumpHeld).toBe(true);
    kb.handleKeyUp('KeyZ');
    expect(kb.sample().jumpHeld).toBe(false);
  });

  it('registers a press edge even if the key was released before the sample', () => {
    // A full tap between two samples must still count as a press.
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyZ');
    kb.handleKeyUp('KeyZ');
    const f = kb.sample();
    expect(f.jumpPressed).toBe(true);
    expect(f.jumpHeld).toBe(false);
  });

  it('ignores OS auto-repeat keydowns (no re-trigger without a keyup)', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyX');
    kb.sample();
    kb.handleKeyDown('KeyX'); // auto-repeat while held
    expect(kb.sample().attackPressed).toBe(false);
  });

  it('maps attack and dash edges on their alternate keys too', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('KeyJ');
    kb.handleKeyDown('KeyK');
    const f = kb.sample();
    expect(f.attackPressed).toBe(true);
    expect(f.dashPressed).toBe(true);
  });

  it('treats Space as jump', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('Space');
    expect(kb.sample().jumpPressed).toBe(true);
  });

  it('clears all state on blur (no stuck keys after alt-tab)', () => {
    const kb = createKeyboardInput();
    kb.handleKeyDown('ArrowRight');
    kb.handleKeyDown('KeyZ');
    kb.sample();
    kb.handleBlur();
    const f = kb.sample();
    expect(f.right).toBe(false);
    expect(f.jumpHeld).toBe(false);
  });
});
