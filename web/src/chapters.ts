/**
 * The dojo's chapters, in road order — the ONE list the map, the chapter
 * strip, the gates and the routes all draw from, so they can never disagree.
 *
 * The road is learn → prove → practice → next (playtest 2, note 5): a lesson
 * teaches one thing, then points at the mini-game that proves it ("Prove it
 * →"), and the lesson only counts as done when that mini-game is cleared.
 * Clearing unlocks the next stop; every gate is skippable, so nothing ever
 * traps her. Setup comes first because one answer — which controller —
 * decides how she practices everything after it. The finale sits at the
 * bottom of the road, where the map's own metaphor has pointed all along.
 * Each stop borrows a Hallownest place name as a riff — it's her dojo, not a
 * walkthrough.
 *
 * What "done" means for each stop, and what is locked, lives in
 * storage/progress.ts (which imports this file — never the other way round).
 * The counts in the copy come from engine/roster.ts, the one home of the
 * progression numbers.
 */
import { COURSE_LEVEL_COUNT, FINALE_WAVE_COUNT, ROSTER } from './engine/roster';

export type ChapterId =
  'setup' | 'pogo' | 'pogo-course' | 'reading-enemies' | 'dodge-arena' | 'finale';

export type ChapterKind = 'lesson' | 'mini-game';

export interface Chapter {
  id: ChapterId;
  kind: ChapterKind;
  /** Where it sits on the map — a Hallownest riff. */
  place: string;
  /** The chapter's real name. */
  title: string;
  route: string;
  /** One line, to Kayla. The only copy the map shows. */
  line: string;
  /**
   * For a lesson: the mini-game that proves it. The lesson is done exactly
   * when that mini-game is done, and its page ends with "Prove it →".
   */
  provesAt?: ChapterId;
  /** What finishing means, in one short sentence — shown on the map sign and on gates. */
  done: string;
}

/** Small counts as words, so the copy reads "all three levels", not "all 3 levels". */
const COUNT_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/** countWord for the start of a sentence: "Three levels, …". */
export function countWordCap(n: number): string {
  const word = countWord(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const COURSE_DONE = `Clear all ${countWord(COURSE_LEVEL_COUNT)} levels of the Pogo Course`;
const ARENA_DONE = `Clear all ${countWord(ROSTER.length)} enemies in the Dodge Arena`;
/*
 * The third clause is what it takes and NOT who it is: `finaleCleared` requires
 * `finaleBossCleared`, so the sign cannot stop at the waves — but this line
 * prints on the map's next-stop sign and on every gate panel, which are
 * surfaces she reads long before she goes down the well.
 *
 * Playtest 10: _"It should be a total surprise whenever she gets to him. It's
 * just like this thing, this boss that's coming, but there is no implication at
 * all that it's Bill."_ So the sentence promises something waiting without
 * naming it. The one other surface that names the Bills is the finale's
 * "Best:" line, and that one is safe on its own: `bossBest` is null until she
 * has a run against them, so it cannot render before she has met them.
 */
const FINALE_DONE = `Clear the level, all ${countWord(FINALE_WAVE_COUNT)} waves, and whatever’s waiting at the bottom`;

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'setup',
    kind: 'lesson',
    place: 'Dirtmouth',
    title: 'Your Setup',
    route: '/lessons/setup',
    line: 'Sit on the bench, pick one controller, keep it.',
    // Two things since playtest 9: the question, and the floor that proves the
    // answer. The sign and every gate panel print this line, so it has to name
    // both or the map promises less than the chapter asks.
    done: 'Pick a controller, then prove it on the floor',
  },
  {
    id: 'pogo',
    kind: 'lesson',
    place: 'The Crossroads',
    title: 'Pogo',
    route: '/lessons/pogo',
    line: 'The downslash bounce — your biggest unlock.',
    provesAt: 'pogo-course',
    done: COURSE_DONE,
  },
  {
    id: 'pogo-course',
    kind: 'mini-game',
    place: 'The Bounce Bog',
    title: 'Pogo Course',
    route: '/play/pogo',
    line: 'Bounce your way across the spikes.',
    done: COURSE_DONE,
  },
  {
    id: 'reading-enemies',
    kind: 'lesson',
    place: 'Greenpath',
    title: 'Reading Enemies',
    route: '/lessons/reading-enemies',
    line: 'Watch first. Dodge everything. Then take it apart.',
    provesAt: 'dodge-arena',
    done: ARENA_DONE,
  },
  {
    id: 'dodge-arena',
    kind: 'mini-game',
    place: 'Kbug’s Colosseum',
    title: 'Dodge Arena',
    route: '/play/dodge',
    line: 'Five enemies, in order. Survive, and hit back.',
    done: ARENA_DONE,
  },
  {
    id: 'finale',
    kind: 'mini-game',
    place: 'The Bottom of the Well',
    title: 'The Gauntlet',
    route: '/play/well',
    line: 'One long pogo, then the whole roster in waves.',
    done: FINALE_DONE,
  },
];

/**
 * The practice floor, which is a PAGE and deliberately not a stop.
 *
 * It belongs to chapter 1 — it proves the controller that chapter asks her to
 * pick — and it sits between Setup and Pogo in the forward chain. It is not in
 * CHAPTERS because the road is six hand-fitted stops: five bezier legs whose
 * endpoints are typed-in offsets from stop centres, five chained strata bands,
 * six hand-inked glyphs and a strip that fits six across a laptop. A seventh
 * stop is a redraw and a ratified decision, not a list append.
 *
 * Named here rather than written out at each of its three call sites because
 * this is the file anyone looks in for a route.
 */
export const SETUP_FLOOR_ROUTE = '/lessons/setup/floor';

export function chapterById(id: ChapterId): Chapter {
  const found = CHAPTERS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown chapter: ${id}`);
  return found;
}

/** 1-based position on the road, for "Chapter N" eyebrows. */
export function chapterIndex(id: ChapterId): number {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  if (i < 0) throw new Error(`Unknown chapter: ${id}`);
  return i + 1;
}

/** The chapter after this one in road order, or null at the end. */
export function nextChapter(id: ChapterId): Chapter | null {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1]! : null;
}

export function prevChapter(id: ChapterId): Chapter | null {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  return i > 0 ? CHAPTERS[i - 1]! : null;
}
