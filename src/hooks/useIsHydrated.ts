'use client';
import { useSyncExternalStore } from 'react';

// Never fires: whether the app has hydrated changes exactly once, and React
// re-reads the snapshot on its own when it switches off the server one.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` while server-rendering and through the hydration render, `true`
 * afterwards. The guard components use before reading client-only state —
 * here, the cookie-backed auth store, which the server cannot see and which
 * would otherwise make the two renders disagree.
 *
 * Replaces the `useState(false)` + `useEffect(() => setMounted(true), [])`
 * idiom this codebase used in two places (F9.7). That form is what
 * `react-hooks/set-state-in-effect` flags: it renders once with the wrong
 * answer, commits, then sets state and renders again, so every consumer pays
 * a second render pass to learn something React already knew. Reading it
 * through `useSyncExternalStore` asks the question directly instead — React
 * uses `getServerSnapshot` for SSR *and* for hydration, then moves to the
 * client snapshot, which is the same two-phase behaviour without the effect.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
