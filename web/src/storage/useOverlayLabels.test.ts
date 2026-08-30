/**
 * The overlay labels — what every in-canvas "press this to continue" prompt
 * calls the two controls it talks about.
 *
 * Two properties, and the second one is the one with teeth: the words are the
 * ACTIONS and not her bindings (playtest 10), and the pair of functions has a
 * stable identity across calls, because they are dependencies of a session
 * factory and a fresh identity rebuilds the game under a live run.
 */
import { describe, expect, it } from 'vitest';
import { controlNameCopy } from '../copy/controls';
import { useOverlayLabels } from './useOverlayLabels';

describe('the overlay labels', () => {
  it('name the action, not the key or the pad position', () => {
    // On a leverless board "the bottom button" points at nothing — the face
    // buttons are not in a diamond — so the prompt says what she DOES.
    const { jumpKey, attackKey } = useOverlayLabels();
    expect(jumpKey()).toBe('Jump');
    expect(attackKey()).toBe('Attack');
  });

  it('says the same thing whichever board she is holding', () => {
    // There is no input-source parameter left to vary, and that IS the test:
    // the labels cannot disagree between keyboard and pad because they no
    // longer ask which one she used.
    expect(useOverlayLabels().jumpKey()).toBe(useOverlayLabels().jumpKey());
    expect(controlNameCopy.jump).toBe('Jump');
    expect(controlNameCopy.attack).toBe('Attack');
  });

  it('hands back one identity forever, so a render cannot rebuild a live run', () => {
    // Every play page passes these straight into a session factory's dep
    // array. A new object here would restart her run on every render.
    const first = useOverlayLabels();
    const second = useOverlayLabels();
    expect(second).toBe(first);
    expect(second.jumpKey).toBe(first.jumpKey);
    expect(second.attackKey).toBe(first.attackKey);
  });
});
