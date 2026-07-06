import { toast } from '../components/Toast';

/**
 * Fire the app-wide "+N XP" floating reward toast (gold, with a success haptic).
 * Call this anywhere the user earns XP — quiz pass, lesson complete, reading
 * finish, daily challenge — so the reward feedback is identical everywhere (DRY).
 * No-ops for zero/negative amounts.
 *
 * Usage:
 *   import { showXpToast } from '../lib/xpToast';
 *   showXpToast(result.xpEarned);
 */
export function showXpToast(amount: number) {
  if (amount > 0) toast.xp(amount);
}
