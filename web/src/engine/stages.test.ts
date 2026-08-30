/**
 * Stage tests (playtest 2, note 1 + the interview's engagement decision).
 *
 * Seam: the pure stage rule. A stage is passed by SURVIVING its full time and
 * is failed by the first touch. Hits are counted and kept as her score, and
 * since playtest 10 they have no say in whether she passes. The roster stages
 * and the finale's wave stages are built from engine/roster.ts so the numbers
 * can never disagree with the map and the gates.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import {
  ARENA_MAX_ALIVE,
  ARENA_SURVIVE_SECONDS,
  FINALE_WAVES,
  FINALE_WAVE_COUNT,
  ROSTER,
  WAVE_SURVIVE_SECONDS,
} from './roster';
import {
  createStageState,
  dueCount,
  rosterStages,
  startStage,
  stepStage,
  waveStages,
} from './stages';
import type { StageDef } from './stages';

const QUIET = { playerHit: false, nailLanded: false };
const HIT = { playerHit: false, nailLanded: true };
const TOUCHED = { playerHit: true, nailLanded: false };

const SHORT: StageDef = {
  enemies: ['walker'],
  surviveSeconds: 1,
  label: 'Walker',
};

function running() {
  const state = createStageState();
  startStage(state);
  return state;
}

describe('stage definitions', () => {
  it('builds one roster stage per enemy, in teaching order, 30 s each', () => {
    const stages = rosterStages();
    for (const [i, s] of stages.entries()) {
      expect(s.surviveSeconds).toBe(ARENA_SURVIVE_SECONDS);
      expect(s.label).toBe(ROSTER[i]!.name);
    }
  });

  it('opens the two dummy stages with a PAIR, and leaves the attackers solo', () => {
    // Playtest 10. The dummies are the enemies whose whole job is to be
    // practised on, and one of them alone for thirty seconds is a long time
    // watching a single body walk at you. Doubling an attacker would be a
    // different lesson, not a livelier version of the same one.
    const stages = rosterStages();
    expect(stages[0]!.enemies).toEqual(['walker', 'walker']);
    expect(stages[1]!.enemies).toEqual(['flier', 'flier']);
    expect(stages[2]!.enemies).toEqual(['duelist']);
    expect(stages[3]!.enemies).toEqual(['spitter']);
    expect(stages[4]!.enemies).toEqual(['warden']);
  });

  it('builds one wave stage per finale wave, labelled by the wave’s own name', () => {
    const stages = waveStages();
    expect(stages.map((s) => s.enemies)).toEqual(FINALE_WAVES.map((w) => [...w.enemies]));
    for (const [i, s] of stages.entries()) {
      const wave = FINALE_WAVES[i]!;
      expect(s.surviveSeconds).toBe(WAVE_SURVIVE_SECONDS);
      expect(s.reinforcements).toEqual(wave.reinforcements);
      expect(s.maxAlive).toBe(ARENA_MAX_ALIVE);
    }
    expect(stages.map((s) => s.label)).toEqual(['The pests', 'The real ones']);
  });

  it('keeps the Colosseum and the waves on SEPARATE clocks', () => {
    // These were one constant until playtest 10, and re-merging them would
    // silently break the waves: their reinforcements arrive at 0:30, so a
    // thirty-second wave never doubles and never fires its banner.
    expect(ARENA_SURVIVE_SECONDS).toBe(30);
    expect(WAVE_SURVIVE_SECONDS).toBe(60);
    for (const s of rosterStages()) expect(s.surviveSeconds).toBe(ARENA_SURVIVE_SECONDS);
    for (const s of waveStages()) expect(s.surviveSeconds).toBe(WAVE_SURVIVE_SECONDS);
  });

  it('keeps the wave data inside the arena’s invariants', () => {
    expect(FINALE_WAVE_COUNT).toBe(2);
    expect(FINALE_WAVE_COUNT).toBe(FINALE_WAVES.length);
    const seen = new Set<string>();
    for (const wave of FINALE_WAVES) {
      expect(wave.enemies.length + wave.reinforcements.length).toBeLessThanOrEqual(ARENA_MAX_ALIVE);
      const times = wave.reinforcements.map((r) => r.at);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      for (const t of times) expect(t).toBeLessThan(WAVE_SURVIVE_SECONDS);
      for (const id of [...wave.enemies, ...wave.reinforcements.map((r) => r.id)]) seen.add(id);
    }
    // Ratified: every enemy on the roster still appears somewhere in the finale.
    expect([...seen].sort()).toEqual(ROSTER.map((e) => e.id).sort());
  });
});

describe('wave 2, "The real ones" (playtest 5, note 5)', () => {
  const wave = FINALE_WAVES[1]!;

  it('stands at two spitters, a duelist and a warden once everyone is in', () => {
    // The note names the cast, not the arrivals: "let's have the
    // reinforcement spread be two spitters, a duelist and a warden".
    const cast = [...wave.enemies, ...wave.reinforcements.map((r) => r.id)].sort();
    expect(cast).toEqual(['duelist', 'spitter', 'spitter', 'warden']);
  });

  it('fills the arena exactly, so nothing is silently dropped', () => {
    // The rejected reading — four arrivals ON TOP of the opening pair — is
    // six alive against a cap of four, and joinDue() CONSUMES over the cap:
    // the duelist and the warden would have vanished with every test green.
    expect(wave.enemies.length + wave.reinforcements.length).toBe(ARENA_MAX_ALIVE);
  });
});

describe('dueCount — the reinforcement schedule', () => {
  const scripted: StageDef = {
    enemies: ['walker'],
    reinforcements: [
      { at: 30, id: 'walker' },
      { at: 30, id: 'flier' },
      { at: 45, id: 'warden' },
    ],
    surviveSeconds: 60,
    label: 'scripted',
  };

  it('counts nobody before the first arrival and everybody after the last', () => {
    expect(dueCount(scripted, 0)).toBe(0);
    expect(dueCount(scripted, 29.99)).toBe(0);
    expect(dueCount(scripted, 30)).toBe(2);
    expect(dueCount(scripted, 44.99)).toBe(2);
    expect(dueCount(scripted, 45)).toBe(3);
    expect(dueCount(scripted, 600)).toBe(3);
  });

  it('is monotone across the whole stage', () => {
    let last = 0;
    for (let t = 0; t <= 60; t += FIXED_DT) {
      const due = dueCount(scripted, t);
      expect(due).toBeGreaterThanOrEqual(last);
      last = due;
    }
  });

  it('is zero forever for a stage with no script — the Colosseum never grows', () => {
    for (const stage of rosterStages()) {
      expect(stage.reinforcements).toBeUndefined();
      expect(stage.maxAlive).toBeUndefined();
      for (let t = 0; t <= 70; t += 5) expect(dueCount(stage, t)).toBe(0);
    }
  });

  it('lands both of a real wave’s arrivals on the same beat', () => {
    const wave = waveStages()[0]!;
    expect(dueCount(wave, 29.9)).toBe(0);
    expect(dueCount(wave, 30.1)).toBe(2);
  });
});

describe('stage definitions are freshly built', () => {
  it('hands out fresh arrays each call', () => {
    expect(rosterStages()).not.toBe(rosterStages());
    expect(waveStages()).not.toBe(waveStages());
  });
});

describe('stage rule', () => {
  it('starts ready, with nothing counted', () => {
    const state = createStageState();
    expect(state).toEqual({ status: 'ready', elapsed: 0, hits: 0 });
  });

  it('does not run the clock or count hits until started', () => {
    const state = createStageState();
    expect(stepStage(state, SHORT, HIT, FIXED_DT)).toBeNull();
    expect(state.elapsed).toBe(0);
    expect(state.hits).toBe(0);
    expect(state.status).toBe('ready');
  });

  it('startStage moves ready → running and nothing else', () => {
    const state = createStageState();
    startStage(state);
    expect(state.status).toBe('running');
    state.elapsed = 0.5;
    startStage(state); // a second start is a no-op
    expect(state.elapsed).toBe(0.5);
  });

  it('runs the clock and counts hits while running', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, QUIET, FIXED_DT);
    expect(state.hits).toBe(1);
    expect(state.elapsed).toBeCloseTo(2 * FIXED_DT, 10);
    expect(state.status).toBe('running');
  });

  it('fails on a player hit, freezing the clock', () => {
    const state = running();
    stepStage(state, SHORT, QUIET, 0.25);
    expect(stepStage(state, SHORT, TOUCHED, FIXED_DT)).toBe('failed');
    expect(state.status).toBe('failed');
    expect(state.elapsed).toBeCloseTo(0.25, 10);
    expect(stepStage(state, SHORT, HIT, FIXED_DT)).toBeNull();
    expect(state.hits).toBe(0);
    expect(state.elapsed).toBeCloseTo(0.25, 10);
  });

  it('clears on time alone, with the nail never swung once', () => {
    // The rule playtest 10 replaced said the opposite: the clock kept running
    // until the hits were in. His reasoning for the change — "if she manages
    // to make it through the entire Gauntlet without getting hit or hitting
    // another enemy a single time, that's fine with me."
    const state = running();
    expect(stepStage(state, SHORT, QUIET, SHORT.surviveSeconds)).toBe('cleared');
    expect(state.status).toBe('cleared');
    expect(state.hits).toBe(0);
  });

  it('clears on the first step past the clock, exactly at the boundary', () => {
    const state = running();
    stepStage(state, SHORT, QUIET, SHORT.surviveSeconds - 1e-9);
    expect(state.status).toBe('running');
    expect(stepStage(state, SHORT, QUIET, 1e-9)).toBe('cleared');
  });

  it('keeps counting hits as a score, which is all they are now', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, HIT, FIXED_DT);
    expect(state.hits).toBe(2);
    expect(state.status).toBe('running');
  });

  it('a touch on the very step the clock would clear still fails', () => {
    const state = running();
    expect(stepStage(state, SHORT, TOUCHED, 5)).toBe('failed');
    expect(state.status).toBe('failed');
  });

  it('a cleared stage is frozen: no more hits, no more time, no fail', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, QUIET, 1);
    const elapsed = state.elapsed;
    expect(stepStage(state, SHORT, TOUCHED, 1)).toBeNull();
    expect(stepStage(state, SHORT, HIT, 1)).toBeNull();
    expect(state.status).toBe('cleared');
    expect(state.hits).toBe(1);
    expect(state.elapsed).toBe(elapsed);
  });

  it('counts several hits landed in one step (a swing through two enemies)', () => {
    const state = running();
    stepStage(state, SHORT, { playerHit: false, nailLanded: true, hits: 2 }, FIXED_DT);
    expect(state.hits).toBe(2);
  });

  it('the real walker stage takes thirty seconds and nothing else', () => {
    const def = rosterStages()[0]!;
    const state = running();
    let cleared = false;
    let steps = 0;
    while (!cleared && steps < 60 * 40) {
      cleared = stepStage(state, def, QUIET, FIXED_DT) === 'cleared';
      steps += 1;
    }
    expect(cleared).toBe(true);
    expect(state.hits).toBe(0);
    expect(state.elapsed).toBeGreaterThanOrEqual(ARENA_SURVIVE_SECONDS);
    expect(state.elapsed).toBeLessThan(ARENA_SURVIVE_SECONDS + 2 * FIXED_DT);
  });
});
