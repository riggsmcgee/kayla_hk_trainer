/**
 * Stage tests (playtest 2, note 1 + the interview's engagement decision).
 *
 * Seam: the pure stage rule. A stage is passed by surviving its full time
 * AND landing its required hits — both, so a Kayla who hides in a corner
 * never clears — and is failed by the first touch. The roster stages and
 * the finale's wave stages are built from engine/roster.ts so the numbers
 * can never disagree with the map and the gates.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import {
  ARENA_MAX_ALIVE,
  FINALE_WAVES,
  FINALE_WAVE_COUNT,
  ROSTER,
  STAGE_SURVIVE_SECONDS,
  rosterEntry,
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
  hitsRequired: 2,
  label: 'Walker',
};

function running() {
  const state = createStageState();
  startStage(state);
  return state;
}

describe('stage definitions', () => {
  it('builds one roster stage per enemy, in teaching order, 60 s each', () => {
    const stages = rosterStages();
    expect(stages.map((s) => s.enemies)).toEqual(ROSTER.map((e) => [e.id]));
    for (const [i, s] of stages.entries()) {
      expect(s.surviveSeconds).toBe(STAGE_SURVIVE_SECONDS);
      expect(s.hitsRequired).toBe(ROSTER[i]!.hitsToPass);
      expect(s.label).toBe(ROSTER[i]!.name);
    }
  });

  it('builds one wave stage per finale wave, labelled by the wave’s own name', () => {
    const stages = waveStages();
    expect(stages.map((s) => s.enemies)).toEqual(FINALE_WAVES.map((w) => [...w.enemies]));
    for (const [i, s] of stages.entries()) {
      const wave = FINALE_WAVES[i]!;
      expect(s.surviveSeconds).toBe(STAGE_SURVIVE_SECONDS);
      expect(s.reinforcements).toEqual(wave.reinforcements);
      expect(s.maxAlive).toBe(ARENA_MAX_ALIVE);
    }
    expect(stages.map((s) => s.label)).toEqual(['The pests', 'The real ones']);
  });

  it('sums hits over the OPENING cast only — the reinforcements are free targets', () => {
    const stages = waveStages();
    // Ratified in playtest 4: four bodies is four things to hit, so asking
    // for 20 and 12 would make the wave EASIER in the way that matters and
    // longer in the way that doesn't.
    expect(stages.map((s) => s.hitsRequired)).toEqual([10, 6]);
    for (const [i, s] of stages.entries()) {
      const opening = FINALE_WAVES[i]!.enemies;
      expect(s.hitsRequired).toBe(opening.reduce((n, id) => n + rosterEntry(id).hitsToPass, 0));
    }
  });

  it('keeps the wave data inside the arena’s invariants', () => {
    expect(FINALE_WAVE_COUNT).toBe(2);
    expect(FINALE_WAVE_COUNT).toBe(FINALE_WAVES.length);
    const seen = new Set<string>();
    for (const wave of FINALE_WAVES) {
      expect(wave.enemies.length + wave.reinforcements.length).toBeLessThanOrEqual(ARENA_MAX_ALIVE);
      const times = wave.reinforcements.map((r) => r.at);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      for (const t of times) expect(t).toBeLessThan(STAGE_SURVIVE_SECONDS);
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

  it('still asks for six hits — they are summed over the opening cast alone', () => {
    const stage = waveStages()[1]!;
    expect(stage.hitsRequired).toBe(6);
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
    hitsRequired: 1,
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

  it('does not clear on time alone — the clock keeps running until the hits are in', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    expect(stepStage(state, SHORT, QUIET, 5)).toBeNull();
    expect(state.status).toBe('running');
    expect(state.elapsed).toBeGreaterThan(SHORT.surviveSeconds);
    expect(stepStage(state, SHORT, HIT, FIXED_DT)).toBe('cleared');
    expect(state.status).toBe('cleared');
    expect(state.hits).toBe(2);
  });

  it('does not clear on hits alone — the time must be survived too', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    expect(stepStage(state, SHORT, HIT, FIXED_DT)).toBeNull();
    expect(state.hits).toBe(2);
    expect(state.status).toBe('running');
    expect(stepStage(state, SHORT, QUIET, 1)).toBe('cleared');
  });

  it('clears on the first step both are satisfied, exactly at the boundary', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, QUIET, SHORT.surviveSeconds - 2 * FIXED_DT - 1e-9);
    expect(state.status).toBe('running');
    expect(stepStage(state, SHORT, QUIET, 1e-9)).toBe('cleared');
  });

  it('a touch on the very step the clock would clear still fails', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, HIT, FIXED_DT);
    expect(stepStage(state, SHORT, TOUCHED, 5)).toBe('failed');
    expect(state.status).toBe('failed');
  });

  it('a cleared stage is frozen: no more hits, no more time, no fail', () => {
    const state = running();
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, HIT, FIXED_DT);
    stepStage(state, SHORT, QUIET, 1);
    const elapsed = state.elapsed;
    expect(stepStage(state, SHORT, TOUCHED, 1)).toBeNull();
    expect(stepStage(state, SHORT, HIT, 1)).toBeNull();
    expect(state.status).toBe('cleared');
    expect(state.hits).toBe(2);
    expect(state.elapsed).toBe(elapsed);
  });

  it('counts several hits landed in one step (a swing through two enemies)', () => {
    const state = running();
    stepStage(state, SHORT, { playerHit: false, nailLanded: true, hits: 2 }, FIXED_DT);
    expect(state.hits).toBe(2);
  });

  it('the real roster stage takes a full minute and 5 hits on the walker', () => {
    const def = rosterStages()[0]!;
    const state = running();
    for (let i = 0; i < def.hitsRequired; i++) stepStage(state, def, HIT, FIXED_DT);
    let cleared = false;
    let steps = 0;
    while (!cleared && steps < 60 * 70) {
      cleared = stepStage(state, def, QUIET, FIXED_DT) === 'cleared';
      steps += 1;
    }
    expect(cleared).toBe(true);
    expect(state.elapsed).toBeGreaterThanOrEqual(STAGE_SURVIVE_SECONDS);
    expect(state.elapsed).toBeLessThan(STAGE_SURVIVE_SECONDS + 2 * FIXED_DT);
  });
});
