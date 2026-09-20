import { useEffect, useSyncExternalStore } from 'react';

/**
 * How many mounted screens are currently covering the status bar with dark
 * artwork. A count, not a boolean, so two such screens overlapping (a sheet
 * over the buddy stage) cannot have the first one to unmount clear it.
 */
let depth = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Declare that this screen fills the status-bar area with dark artwork, so the
 * clock and battery must stay white whatever the app theme is.
 *
 * The app has exactly ONE `<StatusBar>` (app/_layout.tsx) and screens are not
 * allowed to set the bar themselves: `setStatusBarStyle` leaks to whatever
 * comes next, and expo-status-bar's component calls it under the hood. So a
 * screen registers here instead and the single bar reads the answer — which
 * means leaving the screen restores the themed style automatically, because the
 * effect's cleanup is what lowers the count.
 */
export function useStatusBarOnArt() {
  useEffect(() => {
    depth += 1;
    listeners.forEach((l) => l());
    return () => {
      depth -= 1;
      listeners.forEach((l) => l());
    };
  }, []);
}

/** 'light' while any on-artwork screen is mounted, else null (use the theme). */
export function useStatusBarArtOverride(): 'light' | null {
  return useSyncExternalStore(
    subscribe,
    () => (depth > 0 ? 'light' : null),
    () => null,
  );
}
