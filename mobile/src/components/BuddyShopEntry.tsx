import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { PressableScale } from './PressableScale';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, tints, type AppColors } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { t } from '../i18n';

/** Row on the buddy picker that opens the background shop. */
export function BuddyShopEntry() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  return (
    <PressableScale
      style={styles.row}
      onPress={() => { haptics.tap(); router.push('/buddy-shop'); }}
      accessibilityRole="button"
      accessibilityLabel={t('buddyShopTitle')}
    >
      <View style={[styles.icon, { backgroundColor: tints.pink.bg }]}>
        <Ionicons name="color-palette" size={20} color={tints.pink.fg} />
      </View>
      <AppText variant="bodyStrong" color={c.text} style={{ flex: 1 }}>{t('buddyShopTitle')}</AppText>
      <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
    </PressableScale>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  });
