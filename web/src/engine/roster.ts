/**
 * The dojo's progression numbers, in one place — the Dodge Arena roster in
 * teaching order, the stage rule, the course's level count, and the finale's
 * shape. Pages, gates, bests and the map all read from here so they can
 * never disagree (playtest 2, notes 1, 3 and 5).
 */
import type { EnemyId } from '@dojo/shared';

export interface RosterEntry {
  id: EnemyId;
  /** The in-world name Kayla sees. */
  name: string;
  /**
   * How many of it the stage opens with. Absent means one.
   *
   * Only the two dummies come in pairs (playtest 10). They are the enemies
   * whose whole job is to be practised ON, and one of them alone in a
   * thirty-second encounter is a long time watching a single body walk at
   * you. The three attackers stay solo: doubling a duelist is not a livelier
   * version of the same lesson, it is a different and much harder one.
   */
  count?: number;
}

/**
 * Teaching order: two dummies to learn the nail on, then the three attackers.
 *
 * This list used to carry `hitsToPass` — the clean hits each stage demanded
 * before it would let her past. Playtest 10 took the requirement out: hits are
 * a score she is chasing now, not a gate, so a stage is passed by surviving
 * it. In his words: _"if she manages to make it through the entire Gauntlet
 * without getting hit or hitting another enemy a single time, that's fine with
 * me."_
 */
export const ROSTER: readonly RosterEntry[] = [
  { id: 'walker', name: 'Walker', count: 2 },
  { id: 'flier', name: 'Flier', count: 2 },
  { id: 'duelist', name: 'Duelist' },
  { id: 'spitter', name: 'Spitter' },
  { id: 'warden', name: 'Warden' },
];

export function rosterEntry(id: EnemyId): RosterEntry {
  const found = ROSTER.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown enemy: ${id}`);
  return found;
}

/**
 * How long a Colosseum encounter runs.
 *
 * Thirty seconds, since playtest 10: _"The encounters are just too long and
 * boring for what they are, so I think we can just cut each one down to 30
 * seconds as more of just a 'get to know the character' sort of thing."_
 */
export const ARENA_SURVIVE_SECONDS = 30;

/**
 * How long a finale wave runs, and why it is NOT the number above.
 *
 * These were one constant until playtest 10, and splitting them is not a
 * preference — every wave schedules its reinforcements at `at: 30`. A
 * thirty-second wave is a wave whose second half never walks in and whose
 * "Reinforcements." banner never fires. `stages.test.ts` pins the invariant
 * that every arrival lands inside its own stage's clock, so the two can never
 * be quietly re-merged.
 */
export const WAVE_SURVIVE_SECONDS = 60;

/** Bounce Bog levels (1..COURSE_LEVEL_COUNT). Level 1 is the original course. */
export const COURSE_LEVEL_COUNT = 3;

/** The finale's "put it all together" pogo level. */
export const FINALE_LEVEL = 4;

/** One enemy arriving mid-wave: who, and how many seconds in. */
export interface WaveJoin {
  /** Seconds of stage time survived before this one walks in. */
  at: number;
  id: EnemyId;
}

export interface FinaleWave {
  /** What the HUD calls it — "wave 1 of 2 — The pests". */
  name: string;
  /** Who is on screen when the wave opens. */
  enemies: readonly EnemyId[];
  /** Who arrives later. Ascending by `at`; the schedule reads it as a cursor. */
  reinforcements: readonly WaveJoin[];
}

/**
 * The finale's waves (playtest 4, note 3).
 *
 * Two waves, each opening with a pair and doubling to four at thirty seconds.
 * The reinforcements were always the difficulty rather than the workload —
 * they used to arrive without raising the hits the wave demanded, and now that
 * hits demand nothing at all, four bodies is simply four ways to be touched.
 */
export const FINALE_WAVES: readonly FinaleWave[] = [
  {
    name: 'The pests',
    enemies: ['walker', 'flier'],
    reinforcements: [
      { at: 30, id: 'walker' },
      { at: 30, id: 'flier' },
    ],
  },
  {
    name: 'The real ones',
    enemies: ['duelist', 'spitter'],
    /**
     * Playtest 5, note 5: "let's have the reinforcement spread be two
     * spitters, a duelist and a warden". That is the cast at 0:30 — the
     * opening pair plus these two — not four arrivals on top of the pair,
     * which would be six alive against an ARENA_MAX_ALIVE of 4 and would see
     * the runtime silently drop the last two while every test stayed green.
     */
    reinforcements: [
      { at: 30, id: 'spitter' },
      { at: 30, id: 'warden' },
    ],
  },
];

/**
 * Finale arena waves (1..FINALE_WAVE_COUNT). DERIVED, never written down —
 * this constant and FINALE_WAVES drifted apart once already (the count said
 * three while the waves said what they said), and a derived number cannot.
 */
export const FINALE_WAVE_COUNT = FINALE_WAVES.length;

/**
 * The most enemies the arena will ever hold at once. Every wave's opening
 * cast plus its reinforcements must fit inside it — pinned as a data
 * invariant in stages.test.ts, so a wave that outgrows the arena fails a
 * test rather than the frame budget.
 */
export const ARENA_MAX_ALIVE = 4;
