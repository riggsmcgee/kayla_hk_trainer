/**
 * Stages — the Dodge Arena as a game (playtest 2, note 1 + the interview).
 *
 * A stage is one (or, in the finale's waves, two) enemies faced at once. It
 * is passed by surviving its time AND landing its hits — both, so there is
 * no clearing it by hiding in a corner ("hit them more than they hit you").
 * If the hits lag, the clock simply keeps running until they're in. The
 * first touch fails the stage; the session restarts the SAME stage, never
 * the whole roster (death = checkpoint).
 *
 * Pure logic: no session, no rendering. The stage lists are built from
 * engine/roster.ts so the map, the gates and the arena always agree.
 */
import type { EnemyId } from '@dojo/shared';
import {
  ARENA_MAX_ALIVE,
  FINALE_WAVES,
  ROSTER,
  STAGE_SURVIVE_SECONDS,
  rosterEntry,
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
  /** Seconds that must be survived. */
  surviveSeconds: number;
  /** Clean nail hits that must land (across every enemy in the stage). */
  hitsRequired: number;
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
    enemies: [e.id],
    surviveSeconds: STAGE_SURVIVE_SECONDS,
    hitsRequired: e.hitsToPass,
    label: e.name,
  }));
}

/**
 * One stage per finale wave.
 *
 * The hits required are summed over the OPENING cast only — ratified in
 * playtest 4: the reinforcements are the difficulty, and asking for twenty
 * hits instead of ten would have been asking for the opposite of what the
 * extra bodies give you.
 */
export function waveStages(): StageDef[] {
  return FINALE_WAVES.map((wave) => ({
    enemies: [...wave.enemies],
    reinforcements: wave.reinforcements,
    maxAlive: ARENA_MAX_ALIVE,
    surviveSeconds: STAGE_SURVIVE_SECONDS,
    hitsRequired: wave.enemies.reduce((sum, id) => sum + rosterEntry(id).hitsToPass, 0),
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
  if (events.nailLanded) state.hits += Math.max(1, events.hits ?? 1);
  if (state.elapsed >= def.surviveSeconds && state.hits >= def.hitsRequired) {
    state.status = 'cleared';
    return 'cleared';
  }
  return null;
}
