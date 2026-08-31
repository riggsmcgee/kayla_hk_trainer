/**
 * Stage/fight clock formatting, shared by every session that shows a timer.
 *
 * Lifted out of the arena session so the boss fight reads the same clock
 * without importing an arena. Not to be confused with `pages/bestLine.ts`'s
 * `formatClock(ms)`, which renders a personal best to a tenth ("1:30.4").
 */

/** m:ss — whole seconds, the way a stage clock reads. */
export function formatClock(seconds: number): string {
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole - m * 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
