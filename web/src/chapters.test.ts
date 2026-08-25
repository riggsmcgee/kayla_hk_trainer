import { describe, expect, it } from 'vitest';
import {
  CHAPTERS,
  chapterById,
  chapterIndex,
  countWord,
  countWordCap,
  nextChapter,
  prevChapter,
} from './chapters';
import { COURSE_LEVEL_COUNT, FINALE_WAVE_COUNT, ROSTER } from './engine/roster';

describe('chapters', () => {
  it('is one road of six stops: learn, prove, learn, prove, then the well', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      'setup',
      'pogo',
      'pogo-course',
      'reading-enemies',
      'dodge-arena',
      'finale',
    ]);
    expect(nextChapter('setup')?.id).toBe('pogo');
    expect(prevChapter('setup')).toBeNull();
    expect(nextChapter('dodge-arena')?.id).toBe('finale');
    expect(nextChapter('finale')).toBeNull();
  });

  it('numbers chapters from 1 for the eyebrows', () => {
    expect(chapterIndex('setup')).toBe(1);
    expect(chapterIndex('pogo-course')).toBe(3);
    expect(chapterIndex('finale')).toBe(6);
  });

  it('each lesson that needs proving points at the mini-game that proves it', () => {
    expect(chapterById('pogo').provesAt).toBe('pogo-course');
    expect(chapterById('reading-enemies').provesAt).toBe('dodge-arena');
    expect(chapterById('setup').provesAt).toBeUndefined();
    // A lesson and its proof say the same thing about what "done" means.
    expect(chapterById('pogo').done).toBe(chapterById('pogo-course').done);
    expect(chapterById('reading-enemies').done).toBe(chapterById('dodge-arena').done);
    for (const c of CHAPTERS) expect(c.done.length).toBeGreaterThan(0);
  });

  it('the "done" copy counts what roster.ts counts, so the two can never drift', () => {
    expect(chapterById('pogo-course').done).toContain(
      `all ${countWord(COURSE_LEVEL_COUNT)} levels`,
    );
    expect(chapterById('dodge-arena').done).toContain(`all ${countWord(ROSTER.length)} enemies`);
    expect(chapterById('finale').done).toContain(`all ${countWord(FINALE_WAVE_COUNT)} waves`);
    expect(countWord(3)).toBe('three');
    expect(countWord(12)).toBe('12');
    expect(countWordCap(3)).toBe('Three');
    expect(countWordCap(12)).toBe('12');
  });

  it('the finale is named by the map, not the real game, and spoils nothing', () => {
    const finale = chapterById('finale');
    expect(finale.kind).toBe('mini-game');
    expect(finale.route).toBe('/play/well');
    expect(finale.place).toBe('The Bottom of the Well');
    expect(finale.line).not.toMatch(/boss|radiance|hollow knight|abyss|basin/i);
  });
});
