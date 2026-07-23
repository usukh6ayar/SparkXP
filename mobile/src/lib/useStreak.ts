import { useAuth } from '../auth/AuthContext';
import { useSWR } from '../api/useSWR';
import { getGamification } from '../api/gamification';

/**
 * The user's real daily streak from `GET /gamification`. Stale-while-revalidate
 * + request dedup (client.ts) mean many TopBars across screens share one cached
 * value and a single background refetch on focus — not one call per screen.
 */
export function useStreak(): number {
  const { token } = useAuth();
  const { data } = useSWR('/gamification', () => getGamification(token!), {
    enabled: !!token,
  });
  return data?.currentStreak ?? 0;
}
