// @vitest-environment jsdom
/**
 * The one claim the dev lock makes, tested as a claim about the GAME and not
 * about a drawer: with the door shut, the site is the site Kayla gets.
 *
 * Hiding the drawer was never the hard part. The hard part is that god mode and
 * the three variant pickers are persisted, and persisted means a browser that
 * was left mid-experiment carries the experiment into the build that gets sent.
 * So each of these seeds a settings blob that is as wrong as it could be — god
 * mode on, every picker on a variant that was never ratified — and asserts that
 * a shut door reports the shipped values anyway.
 *
 * `reloadStores()` before each case is not a formality. The caches these hooks
 * read through are module-level, so they outlive the `localStorage.clear()`
 * that jsdom tests run between cases: without the reload a test that opens the
 * door leaves it open for every test after it in this file, and the failure
 * lands in the direction that hides the bug.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SettingsV1 } from '@dojo/shared';
import { DEFAULT_ROLL_VARIANT } from '../engine/enemies';
import { DEFAULT_DOG_LOOK } from '../engine/dogLook';
import { reloadStores } from './reload';
import { setDevMode, useDevMode } from './useDevMode';
import { useGodMode } from './useGodMode';
import { useRollVariant } from './useRollVariant';
import { useEntranceVariant } from './useEntranceVariant';
import { useDogLook } from './useDogLook';

/** The worst blob a developer's own browser could be carrying. */
function seedMidExperiment(): void {
  const settings: SettingsV1 = {
    version: 1,
    reduceShake: false,
    reduceFlashing: false,
    godMode: true,
    rollVariant: 0,
    entranceVariant: 2,
    dogLook: 0,
  };
  window.localStorage.setItem('kayla-hk-dojo:settings', JSON.stringify({ v: 1, data: settings }));
  reloadStores();
}

/** Everything the fight is built from, on one screen, as text. */
function Fight() {
  const [godMode] = useGodMode();
  const [roll] = useRollVariant();
  const [entrance] = useEntranceVariant();
  const [look] = useDogLook();
  return <p data-testid="fight">{`${godMode ? 'god' : 'mortal'} ${roll} ${entrance} ${look}`}</p>;
}

/** Stands in for the Settings page: it renders the drawer only when unlocked. */
function Bench() {
  const devMode = useDevMode();
  return devMode ? <p data-testid="drawer">Dev tools</p> : null;
}

beforeEach(() => {
  window.localStorage.clear();
  reloadStores();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  reloadStores();
});

describe('a browser that has never been unlocked', () => {
  it('has no drawer', () => {
    render(<Bench />);
    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  it('plays the shipped fight even with an experiment saved in it', () => {
    seedMidExperiment();
    render(<Fight />);
    expect(screen.getByTestId('fight').textContent).toBe(
      `mortal ${DEFAULT_ROLL_VARIANT} 0 ${DEFAULT_DOG_LOOK}`,
    );
  });

  it('writes nothing to the settings blob to say so', () => {
    // Absent, not `false`. A blob that has never been unlocked stays pristine.
    render(<Bench />);
    expect(window.localStorage.getItem('kayla-hk-dojo:settings') ?? '').not.toContain('devMode');
  });
});

describe('opening the door', () => {
  it('reaches a component already on screen, not just the next one to mount', () => {
    // The sequence is typed on whatever page is open, so the drawer has to
    // appear under it. Per-component state with a lazy read could not do this,
    // and this is the test that says so.
    render(<Bench />);
    expect(screen.queryByTestId('drawer')).toBeNull();
    act(() => setDevMode(true));
    expect(screen.getByTestId('drawer')).toBeDefined();
  });

  it('hands back the experiment that was waiting in the blob', () => {
    seedMidExperiment();
    render(<Fight />);
    act(() => setDevMode(true));
    expect(screen.getByTestId('fight').textContent).toBe('god 0 2 0');
  });

  it('survives a reload, because ten keys a refresh is no way to test', () => {
    act(() => setDevMode(true));
    cleanup();
    reloadStores(); // the next visit, reading the same localStorage
    render(<Bench />);
    expect(screen.getByTestId('drawer')).toBeDefined();
  });
});

describe('shutting it again', () => {
  it('turns the cheat off rather than merely hiding its switch', () => {
    seedMidExperiment();
    render(<Fight />);
    act(() => setDevMode(true));
    expect(screen.getByTestId('fight').textContent).toBe('god 0 2 0');

    act(() => setDevMode(false));

    expect(screen.getByTestId('fight').textContent).toBe(
      `mortal ${DEFAULT_ROLL_VARIANT} 0 ${DEFAULT_DOG_LOOK}`,
    );
  });

  it('keeps the pick in the blob, waiting for the next unlock', () => {
    seedMidExperiment();
    render(<Fight />);
    act(() => setDevMode(true));
    act(() => setDevMode(false));
    act(() => setDevMode(true));
    expect(screen.getByTestId('fight').textContent).toBe('god 0 2 0');
  });

  it('leaves no devMode field behind', () => {
    act(() => setDevMode(true));
    act(() => setDevMode(false));
    expect(window.localStorage.getItem('kayla-hk-dojo:settings') ?? '').not.toContain('devMode');
  });
});
