/**
 * The ten keys that open the developer's door, and the one rule for matching
 * them. Pure, so the rule can be tested without a browser; `DevUnlock.tsx` is
 * the thin part that listens. (A separate file and not a helper inside that
 * one because Windows and macOS filesystems cannot tell `devUnlock.ts` from
 * `DevUnlock.tsx`, and TypeScript refuses to compile a program holding both.)
 *
 * It is the Konami code, and that is not only a joke. The sequence had to be
 * one Kayla could not reach by accident on a site where she spends her whole
 * time holding movement keys down, and it had to be a sequence rather than a
 * chord, because every two- and three-key chord worth remembering is already
 * spoken for by a browser on Windows.
 *
 * What makes it safe is not any one key, it is `advance`'s rule that a wrong
 * key drops the run to nothing. Eight of the ten are movement keys in
 * `DEFAULT_BINDINGS`, so she will part-match the front of it constantly and it
 * will collapse constantly. `KeyB` is the wall: it is unbound out of the box,
 * and reaching it needs the eight before it with nothing at all in between. It
 * is worth being honest that Settings would let her rebind an action ONTO B —
 * `settings.helpers.ts` treats it as bindable — which would put all ten keys in
 * play at once. Even then she has to press them in this exact order and follow
 * them with `KeyA`, which is a thing that does not happen while playing.
 *
 * The strings are `KeyboardEvent.code`, like `Bindings` — physical positions,
 * not the letters printed on the keycaps, which is the rule the whole input
 * layer is held to.
 */
export const UNLOCK_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
] as const;

/**
 * How many keys of the sequence stand matched after `code` is pressed.
 *
 * The wrong-key branch is the whole of the logic and it is not a plain reset.
 * A key that does not continue the sequence may still be the FIRST key of a
 * fresh attempt, and on this sequence that case is not hypothetical: it starts
 * with two `ArrowUp`s, so a third press — the overshoot of anyone typing it
 * from memory — has to leave one matched rather than none, or the run can
 * never recover without a deliberate pause the typist has no way to know about.
 */
export function advance(matched: number, code: string): number {
  if (code === UNLOCK_SEQUENCE[matched]) return matched + 1;
  return code === UNLOCK_SEQUENCE[0] ? 1 : 0;
}

/** Whether that many matched keys is the whole sequence. */
export function isComplete(matched: number): boolean {
  return matched >= UNLOCK_SEQUENCE.length;
}
