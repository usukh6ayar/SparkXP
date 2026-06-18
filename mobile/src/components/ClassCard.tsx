import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { t } from '../i18n';
import { colors, spacing, radius, elevation } from '../theme/theme';

/** A class row in the teacher's list: gradient tile, name, school, code, count. */
export function ClassCard({
  name,
  school,
  joinCode,
  studentCount,
  onPress,
}: {
  name: string;
  school?: string | null;
  joinCode: string;
  studentCount?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['#8A5BFF', '#6C3BFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tile}
      >
        <Ionicons name="people" size={24} color={colors.white} />
      </LinearGradient>

      <View style={styles.body}>
        <AppText variant="h3" numberOfLines={1}>{name}</AppText>
        {school ? (
          <AppText variant="caption" numberOfLines={1}>{school}</AppText>
        ) : null}
        <View style={styles.meta}>
          <View style={styles.codePill}>
            <Ionicons name="key" size={11} color={colors.primary} />
            <AppText variant="caption" color={colors.primary} style={styles.codeText}>{joinCode}</AppText>
          </View>
          {studentCount != null ? (
            <View style={styles.countPill}>
              <Ionicons name="person" size={11} color={colors.textSecondary} />
              <AppText variant="caption">{studentCount}</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...(elevation.sm as object),
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  tile: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  codePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
  codeText: { fontWeight: '700', letterSpacing: 1 },
  countPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
});
