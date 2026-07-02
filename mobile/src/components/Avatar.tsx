import { View, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { resolveAvatar } from '../lib/avatar';
import { colors, radius } from '../theme/theme';

/**
 * User avatar: shows the resolved image (uploaded URL or default key), or a
 * colored circle with the name's initial as a fallback. Reused on profile,
 * leaderboard rows, class rosters, etc.
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
  const src = resolveAvatar(avatarUrl);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (src) {
    return <AppImage source={src} width={size * 2} style={[circle, styles.img]} contentFit="cover" />;
  }
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[circle, styles.fallback]}>
      <AppText variant="bodyStrong" color={colors.primary} style={{ fontSize: size * 0.4 }}>
        {initial}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: colors.primarySoft },
  fallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
