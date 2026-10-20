import type { Repository } from 'typeorm';
import type { Plan } from '../entities/plan.entity';
import type { User } from '../entities/user.entity';

/**
 * The `plans` row whose limits apply to everyone without an active plan
 * (Free Basic, client doc 09). Admin-editable like any plan, but
 * `is_active = false` and price 0, so it is never offered for sale.
 */
export const FREE_PLAN_SLUG = 'free';

type PlanHolder<P> = { plan: P | null; planExpiresAt: Date | null };

/**
 * The plan whose limits are in force: the user's own plan while it is active,
 * otherwise the Free plan.
 *
 * Until 2026-10-20 a user with no plan got Essential's voice caps and an
 * unlimited AI dictionary — a paid tier's allowance for 0₮. `free` = null
 * (no Free row) means no caps, so a missing row never locks anyone out.
 */
export function planInForce<P>(
  user: PlanHolder<P>,
  free: P | null,
  now = Date.now(),
): P | null {
  if (!user.plan) return free;
  const active = !user.planExpiresAt || user.planExpiresAt.getTime() > now;
  return active ? user.plan : free;
}

/** `planInForce` that only reads the Free row when the user actually needs it. */
export async function resolvePlan(
  user: Pick<User, 'plan' | 'planExpiresAt'>,
  plans: Repository<Plan>,
): Promise<Plan | null> {
  const own = planInForce(user, null);
  if (own) return own;
  return plans.findOne({ where: { slug: FREE_PLAN_SLUG } });
}
