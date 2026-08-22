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
import { FINALE_WAVES, ROSTER, STAGE_SURVIVE_SECONDS, rosterEntry } from './roster';

export interface StageDef {
  /** Who is in the arena, spawned together. */
  enemies: readonly EnemyId[];
  /** Seconds that must be survived. */
  surviveSeconds: number;
  /** Clean nail hits that must land (across every enemy in the stage). */
  hitsRequired: number;
  /** What the HUD calls it: an enemy's name, or "walker + flier". */
  label: string;
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

/** One stage per finale wave; the hits required are the pair's summed. */
export function waveStages(): StageDef[] {
  return FINALE_WAVES.map((pair) => ({
    enemies: [...pair],
    surviveSeconds: STAGE_SURVIVE_SECONDS,
    hitsRequired: pair.reduce((sum, id) => sum + rosterEntry(id).hitsToPass, 0),
    label: pair.join(' + '),
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
