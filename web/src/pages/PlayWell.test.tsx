// @vitest-environment jsdom
/**
 * The Bottom of the Well, tested at the seam nothing else in this suite can
 * reach: React's dependency arrays.
 *
 * Every beat on this page hands the canvas a `createSession` factory. The
 * canvas rebuilds the game whenever that factory changes identity — which is
 * correct when she picks a different wave, and catastrophic when it happens
 * because she just CLEARED something, because a clear is exactly the moment
 * she is still playing. Playtest 6 caught one instance in a browser (the
 * Bills, at 1:30); reading the same file turned up two more on the beats
 * above it. All three are the same defect, so they are pinned together.
 *
 * These tests deliberately never let a frame run: `requestAnimationFrame` is
 * stubbed to a no-op. The question is only ever "how many times was the
 * session BUILT", and a live loop would add noise without adding an answer.
 */
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ProgressV1 } from '@dojo/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { GameSession } from '../engine/session';

/**
 * Hoisted so the `vi.mock` factories below can see them — `vi.mock` is
 * lifted above the imports, so a plain `const` up here would still be in the
 * temporal dead zone when the factory runs.
 */
const spies = vi.hoisted(() => ({
  boss: vi.fn(),
  waves: vi.fn(),
  level: vi.fn(),
}));

/** A session that does nothing: no frame ever runs, so nothing is drawn. */
function stubSession(): GameSession {
  return { step: () => {}, render: () => {} };
}

vi.mock('../engine/bossSession', () => ({
  createBossSession: (config: unknown) => {
    spies.boss(config);
    return stubSession();
  },
}));
vi.mock('../engine/dodgeArenaSession', async (importOriginal) => {
  // bossWorld / FLOOR_Y / PLAYER_SPAWN_X are imported from here by other
  // modules, so only the factory is replaced.
  const actual = await importOriginal<typeof import('../engine/dodgeArenaSession')>();
  return {
    ...actual,
    createDodgeArenaSession: (config: unknown) => {
      spies.waves(config);
      return stubSession();
    },
  };
});
vi.mock('../engine/pogoCourseSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/pogoCourseSession')>();
  return {
    ...actual,
    createPogoCourseSession: (config: unknown) => {
      spies.level(config);
      return stubSession();
    },
  };
});

const { PlayWell } = await import('./PlayWell');

/** Progress with the road walked as far as `overrides` says, and no further. */
function seedProgress(overrides: Partial<ProgressV1>): void {
  const progress: ProgressV1 = {
    version: 1,
    courseLevelsCleared: [1, 2, 3],
    arenaEnemiesCleared: [],
    finaleLevelCleared: false,
    finaleWavesCleared: [],
    finaleBossCleared: false,
    // Skipping the Dodge Arena is what opens the finale's chapter gate; the
    // road never traps her, so a skip counts for unlocking.
    skipped: ['dodge-arena'],
    ...overrides,
  };
  window.localStorage.setItem('kayla-hk-dojo:progress', JSON.stringify({ v: 1, data: progress }));
}

/** The config the first build of a session was handed. */
function firstConfig(spy: Mock): Record<string, unknown> {
  const call = spy.mock.calls[0];
  if (!call) throw new Error('the session was never built at all');
  return call[0] as Record<string, unknown>;
}

function renderWell(): void {
  render(
    <MemoryRouter>
      <PlayWell />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  spies.boss.mockClear();
  spies.waves.mockClear();
  spies.level.mockClear();
  // The canvas is real DOM under jsdom but has no 2D context; PracticeCanvas
  // bails out entirely without one, and would never build a session.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a clear must not rebuild the game that produced it', () => {
  it('keeps the Bills fight alive when she crosses 1:30', () => {
    seedProgress({ finaleLevelCleared: true, finaleWavesCleared: [1, 2, 3] });
    renderWell();
    expect(spies.boss).toHaveBeenCalledTimes(1);

    // What the fight itself calls the instant the clock reaches 1:30.
    const onPassed = firstConfig(spies.boss).onPassed as () => void;
    act(() => onPassed());

    expect(spies.boss).toHaveBeenCalledTimes(1);
  });

  it('still builds the fight with the mark she walked in already holding', () => {
    // The guard against "fixing" the test above by severing the flag: what
    // is frozen must be the value that was TRUE at mount, not a literal.
    seedProgress({
      finaleLevelCleared: true,
      finaleWavesCleared: [1, 2, 3],
      finaleBossCleared: true,
    });
    renderWell();

    expect(firstConfig(spies.boss).cleared).toBe(true);
  });

  it('keeps the wave session alive when she clears a wave', () => {
    seedProgress({ finaleLevelCleared: true });
    renderWell();
    expect(spies.waves).toHaveBeenCalledTimes(1);

    // Wave 1 cleared, reported by index the way the session reports it.
    const onStageCleared = firstConfig(spies.waves).onStageCleared as (i: number) => void;
    act(() => onStageCleared(0));

    expect(spies.waves).toHaveBeenCalledTimes(1);
  });

  it('keeps the level session alive when she clears the level', () => {
    seedProgress({});
    renderWell();
    expect(spies.level).toHaveBeenCalledTimes(1);

    const onClear = firstConfig(spies.level).onClear as () => void;
    act(() => onClear());

    expect(spies.level).toHaveBeenCalledTimes(1);
  });
});
