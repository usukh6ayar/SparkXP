import { StyleSheet } from 'react-native';
import { AppImage } from './AppImage';
import { resolveAvatar, defaultAvatarFor } from '../lib/avatar';
import { colors } from '../theme/theme';

/**
 * User avatar: shows the resolved image (uploaded URL or default key). When a
 * user hasn't set a photo, falls back to a bundled default avatar image (picked
 * deterministically from the name so it stays stable), never a bare initial —
 * so every list/roster/progress row shows a real face. Reused on profile,
 * leaderboard rows, class rosters, student progress, etc.
 */
export function Avatar({
  avatarUrl,
  name,
  size = 48,
}: {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
}) {
  const src = resolveAvatar(avatarUrl) ?? defaultAvatarFor(name);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return <AppImage source={src} width={size * 2} style={[circle, styles.img]} contentFit="cover" />;
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.primarySoft },
});
