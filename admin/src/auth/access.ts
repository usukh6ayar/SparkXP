/**
 * Who can see what in the admin panel.
 *
 * Three staff roles may enter the panel:
 *   - super_admin / admin → everything
 *   - moderator           → content only (Words / Lessons / Quizzes / Classes /
 *                           AI Buddy / Leaderboard). No user, org, billing,
 *                           usage, notification or system-settings pages.
 *
 * This is the single source of truth — the Sidebar (which links to show) and the
 * route guard (which paths to allow) both read from here, so they never drift.
 */

/** Roles allowed to log into the admin web at all. */
export const STAFF_ROLES = ['moderator', 'admin', 'super_admin'] as const;

/** Paths a moderator (content writer) may open. Admins get everything. */
export const MODERATOR_PATHS = [
  '/words',
  '/lessons',
  '/quizzes',
  '/classes',
  '/buddy',
  '/leaderboard',
  '/guide',
] as const;

/** Can this role enter the admin panel? */
export function isStaff(role: string | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Can this role open the given panel path? */
export function canAccess(role: string | undefined, path: string): boolean {
  if (role === 'admin' || role === 'super_admin') return true;
  if (role === 'moderator') {
    return (MODERATOR_PATHS as readonly string[]).includes(path);
  }
  return false;
}

/** First path a role is allowed to see — used as the safe landing/redirect. */
export function defaultPath(_role: string | undefined): string {
  return '/words'; // allowed for every staff role
}
