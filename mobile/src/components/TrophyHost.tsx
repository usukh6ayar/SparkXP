import { AchievementModal } from './AchievementModal';
import { useUnseenTrophies } from '../lib/useUnseenTrophies';

/**
 * Mounts the trophy unlock celebration once, app-wide.
 *
 * Lives beside `<ToastHost />` in `app/_layout.tsx` for the same reason: the
 * celebration has to appear over whatever screen the user finished on, and a
 * pushed screen is a sibling in the router stack, not a child of the tabs.
 * Screens fire it with `checkTrophies()`.
 */
export function TrophyHost() {
  const { achievement, dismiss } = useUnseenTrophies();
  return (
    <AchievementModal visible={Boolean(achievement)} achievement={achievement} onClose={dismiss} />
  );
}
