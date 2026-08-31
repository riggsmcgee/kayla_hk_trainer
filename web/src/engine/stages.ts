/**
 * Stages — the Dodge Arena as a game (playtest 2, note 1 + the interview).
 *
 * A stage is one or more enemies faced at once. It is passed by SURVIVING its
 * time. The first touch fails it; the session restarts the SAME stage, never
 * the whole roster (death = checkpoint).
 *
 * It used to also demand a number of clean hits, and hiding in a corner was
 * the thing that rule existed to forbid. Playtest 10 removed it: the hits are
 * still counted and still shown, but as a score she is chasing rather than a
 * toll she is paying. What that costs is real — a stage CAN now be cleared
 * without swinging once — and it was weighed and accepted, because the site is
 * about dodging and pogoing and the hits were never the part she needed
 * forcing.
 *
 * Pure logic: no session, no rendering. The stage lists are built from
 * engine/roster.ts so the map, the gates and the arena always agree.
 */
import type { EnemyId } from '@dojo/shared';
import {
  ARENA_MAX_ALIVE,
  ARENA_SURVIVE_SECONDS,
  FINALE_WAVES,
  ROSTER,
  WAVE_SURVIVE_SECONDS,
  type WaveJoin,
} from './roster';

export interface StageDef {
  /** Who is in the arena when the stage opens. */
  enemies: readonly EnemyId[];
  /**
   * Who walks in later, ascending by `at`. Undefined for every Colosseum
   * stage — the stage rule never learns reinforcements exist.
   */
  reinforcements?: readonly WaveJoin[];
  /** The most bodies this stage will ever hold. Undefined means "the opening cast". */
  maxAlive?: number;
  /** Seconds that must be survived. The whole pass condition. */
  surviveSeconds: number;
  /** What the HUD calls it: an enemy's name, or a wave's title. */
  label: string;
}

/**
 * How many reinforcements should have arrived by `elapsed` seconds of stage
 * time. Monotone and cursor-friendly: the session keeps a count of who has
 * actually joined and spawns the difference, so a schedule can never
 * double-spawn or skip an arrival, and a checkpoint reload starts over at
 * zero for free.
 *
 * Pure, and the whole TDD seam for the schedule — the session's own job is
 * only "spawn the difference".
 */
export function dueCount(def: StageDef, elapsed: number): number {
  const script = def.reinforcements;
  if (!script) return 0;
  let due = 0;
  for (const join of script) {
    if (elapsed < join.at) break; // ascending, so nothing after this is due either
    due += 1;
  }
  return due;
}

/** One stage per roster entry, in teaching order. */
export function rosterStages(): StageDef[] {
  return ROSTER.map((e) => ({
    // The dummies open with two of themselves; everyone else with one.
    enemies: Array.from({ length: e.count ?? 1 }, () => e.id),
    surviveSeconds: ARENA_SURVIVE_SECONDS,
    label: e.name,
  }));
}

/**
 * One stage per finale wave.
 *
 * A full minute, deliberately not the Colosseum's thirty seconds: the
 * reinforcements arrive at the half-way mark, so a wave shorter than a minute
 * would be a wave that never doubles.
 */
export function waveStages(): StageDef[] {
  return FINALE_WAVES.map((wave) => ({
    enemies: [...wave.enemies],
    reinforcements: wave.reinforcements,
    maxAlive: ARENA_MAX_ALIVE,
    surviveSeconds: WAVE_SURVIVE_SECONDS,
    label: wave.name,
  }));
}

export type StageStatus = 'ready' | 'running' | 'cleared' | 'failed';

export interface StageState {
  status: StageStatus;
  /** Seconds survived so far; frozen once the stage is cleared or failed. */
  elapsed: number;
  /** Clean hits landed so far. */
  hits: number;
}

/** What happened in the arena this step, as the stage rule sees it. */
export interface StageEvents {
  playerHit: boolean;
  nailLanded: boolean;
  /** Hits landed this step when more than one (a swing through two enemies); defaults to 1 if nailLanded. */
  hits?: number;
}

export function createStageState(): StageState {
  return { status: 'ready', elapsed: 0, hits: 0 };
}

/** ready → running. Anything else is left alone. */
export function startStage(state: StageState): void {
  if (state.status === 'ready') state.status = 'running';
}

/**
 * Advance a running stage by one step. Returns the transition that happened
 * this step ('cleared' | 'failed'), or null. A stage that is not running is
 * untouched.
 */
export function stepStage(
  state: StageState,
  def: StageDef,
  events: StageEvents,
  dt: number,
): 'cleared' | 'failed' | null {
  if (state.status !== 'running') return null;
  if (events.playerHit) {
    state.status = 'failed';
    return 'failed';
  }
  state.elapsed += dt;
  // Still counted, and still shown — it is her score. It just no longer has a
  // say in whether the stage is passed.
  if (events.nailLanded) state.hits += Math.max(1, events.hits ?? 1);
  if (state.elapsed >= def.surviveSeconds) {
    state.status = 'cleared';
    return 'cleared';
  }
  return null;
}
