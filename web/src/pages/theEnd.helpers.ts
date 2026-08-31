/**
 * The pace of the letter on `#/the-end` — the two numbers that decide how long
 * the last screen of the dojo takes.
 *
 * They live in their own module for one reason, and it is a scar. They used to
 * sit in `TheEnd.tsx` while `TheEnd.test.tsx` carried its OWN copy of both —
 * a `saying()` helper that divided by twelve and a `GAP_MS` of 1200 — so the
 * suite was not testing the page's pace, it was testing that two hand-kept
 * numbers still agreed. The first time the pace was actually changed, nine
 * tests failed with messages about characters, buttons and a mouth, and not
 * one of them said "the speed moved". Imported from both places, that class of
 * failure cannot happen again.
 */

/**
 * Talking pace, ratified in playtest 8 and raised by hand afterwards.
 *
 * Playtest 8 set it at 12, from conversational speech sitting near 12
 * characters a second and comfortable adult reading at 12–16: one number that
 * reads as fast as he would say it. Sitting through the finished letter is what
 * changed it. He is not reading it aloud to her, he is talking, and text that
 * arrives at exactly speaking speed feels slower than speech because she is
 * finished with each word before the next one lands.
 *
 * The arithmetic to check against if the letter ever grows: at this rate a
 * 150-character message takes about four and a half seconds, and the six of
 * them together with their gaps run a little over half a minute.
 */
export const CHARS_PER_SECOND = 34;

/** The silence between one message finishing and the next starting. */
export const GAP_SECONDS = 1.8;

/** How long a message of `chars` characters takes to arrive, in milliseconds. */
export function sayingMs(chars: number): number {
  return (chars / CHARS_PER_SECOND) * 1000;
}
