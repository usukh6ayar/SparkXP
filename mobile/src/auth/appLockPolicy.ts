import type { AppStateStatus } from 'react-native';

/**
 * Decides whether returning to the foreground should re-lock the app.
 *
 * Pure and dependency-free so it can be unit-tested without React Native —
 * the AppState listener in AuthContext is otherwise impossible to exercise.
 *
 * The distinction that matters is `inactive` vs `background`:
 *
 * - `background` — the user actually left. Home screen, another app, screen off.
 * - `inactive`   — a transient system overlay stole focus while the app stayed
 *                  on screen: Control Center, the notification shade, the app
 *                  switcher peek, an incoming-call banner, a permission dialog,
 *                  a screenshot, or the Face ID sheet itself.
 *
 * Only the first means "the session was left unattended", so only the first
 * should re-lock.
 *
 * Comparing the previous state to the next one is NOT enough to tell them
 * apart: iOS returns from the home screen as `background → inactive → active`,
 * so the state immediately before `active` is `inactive` in both cases. The
 * policy therefore remembers whether `background` was seen at any point since
 * the app was last active.
 */
export function createAppLockPolicy() {
  let sawBackground = false;

  return {
    /**
     * Feed every AppState change here, in order.
     * Returns true exactly once per real foreground return.
     */
    next(state: AppStateStatus): boolean {
      if (state === 'background') {
        sawBackground = true;
        return false;
      }
      if (state === 'active') {
        const relock = sawBackground;
        sawBackground = false;
        return relock;
      }
      // 'inactive' (and any future/unknown state): transient, never re-locks.
      return false;
    },
  };
}
