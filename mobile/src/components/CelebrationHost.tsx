import { AchievementModal } from './AchievementModal';
import { useCelebrations } from '../lib/useCelebrations';

/**
 * Mounts the celebration modal (trophy unlocks + daily streak) once, app-wide.
 *
 * Lives beside `<ToastHost />` in `app/_layout.tsx` for the same reason: the
 * celebration has to appear over whatever screen the user finished on, and a
 * pushed screen is a sibling in the router stack, not a child of the tabs.
 * Screens fire it with `checkCelebrations()`.
 */
export function CelebrationHost() {
  const { achievement, dismiss } = useCelebrations();
  return (
    <AchievementModal visible={Boolean(achievement)} achievement={achievement} onClose={dismiss} />
  );
}
