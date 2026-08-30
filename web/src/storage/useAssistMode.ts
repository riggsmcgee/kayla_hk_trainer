/**
 * React glue for assist mode — how many extra hits she has given herself, and
 * whether she has been warned about it once.
 *
 * Deliberately NOT part of `ComfortSettings`, and for the opposite reason
 * `useGodMode` is not: comfort is an accessibility promise the game keeps, god
 * mode is a cheat the developer flips, and this is a third thing again — a
 * choice she makes about her own difficulty, which the site is allowed to have
 * an opinion about (see `assistWarning` in `copy/settings.ts`).
 *
 * Stored in the same versioned SettingsV1 blob as the rest, so it survives a
 * reload and — because `clearAllProgress()` keeps settings — survives a reset
 * of the map too. That is what makes the one-time warning stay one-time.
 */
import { useCallback, useState } from 'react';
import { createLocalStore } from './local';

const store = createLocalStore();

/** The most lives she can give herself. Playtest 10: "up to 3 lives". */
export const MAX_ASSIST_LIVES = 3;

/**
 * Clamp anything a stale or hand-edited settings blob might hold to a whole
 * number of lives in range. Anything unreadable reads as off, which is the
 * safe direction: the failure mode of a bad value should never be a silently
 * easier game.
 */
export function clampLives(value: unknown): number {
  const n = typeof value === 'number' ? Math.floor(value) : 0;
  return n >= 0 && n <= MAX_ASSIST_LIVES ? n : 0;
}

export interface AssistMode {
  /** Lives per attempt, 0-3. Zero is off. */
  lives: number;
  /** Has she already seen the one-time "are you sure?" panel? */
  confirmed: boolean;
  /** Set the lives; pass `confirm` to record that she has now been warned. */
  setLives: (next: number, confirm?: boolean) => void;
}

export function useAssistMode(): AssistMode {
  const [lives, setLivesState] = useState<number>(() =>
    clampLives(store.getSettings().assistLives),
  );
  const [confirmed, setConfirmed] = useState<boolean>(
    () => store.getSettings().assistConfirmed === true,
  );

  const setLives = useCallback((next: number, confirm = false) => {
    const safe = clampLives(next);
    setLivesState(safe);
    const current = store.getSettings();
    const nowConfirmed = confirm || current.assistConfirmed === true;
    if (confirm) setConfirmed(true);
    store.saveSettings({ ...current, assistLives: safe, assistConfirmed: nowConfirmed });
  }, []);

  return { lives, confirmed, setLives };
}
