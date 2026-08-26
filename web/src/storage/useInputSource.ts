/**
 * React's view of `engine/inputSource.ts` — which hand she is using — so page
 * and caption copy re-renders when she picks up the other board.
 *
 * It lives beside the other `use*` hooks rather than in `engine/` because the
 * engine stays importable in plain node with no React in it; the signal
 * itself is over there, and this is only the subscription.
 */
import { useSyncExternalStore } from 'react';
import { lastInputSource, subscribeInputSource, type InputSource } from '../engine/inputSource';

/** The last source that did something. Re-renders when that changes. */
export function useInputSource(): InputSource {
  return useSyncExternalStore(subscribeInputSource, lastInputSource, lastInputSource);
}
