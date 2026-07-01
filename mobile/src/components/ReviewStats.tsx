import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Button } from './Button';
import { t } from '../i18n';
import { colors, spacing, radius } from '../theme/theme';

interface Props {
  known: number;
  review: number;
  xpEarned: number;
  streak: number;
  onContinue: () => void;
}

/** Summary shown after every card in the deck has been swiped. */
export function ReviewStats({ known, review, xpEarned, streak, onContinue }: Props) {
  const graded = known + review;
  const accuracy = graded > 0 ? Math.round((known / graded) * 100) : 0;

  const tiles = [
    { icon: 'checkmark-done', color: colors.success, value: `${accuracy}%`, label: t('accuracy') },
    { icon: 'sparkles', color: colors.success, value: known, label: t('knownLabel') },
    { icon: 'refresh', color: colors.streak, value: review, label: t('reviewLabel') },
    { icon: 'flash', color: colors.xp, value: `+${xpEarned}`, label: t('xpEarned') },
  ] as const;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={colors.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.trophy}>
          <Ionicons name="trophy" size={40} color={colors.white} />
        </View>
        <AppText variant="h1" center color={colors.white} style={styles.title}>
          {t('reviewComplete')}
        </AppText>
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={16} color={colors.streak} />
          <AppText variant="label" color={colors.white}>{streak} {t('streak')}</AppText>
        </View>
      </LinearGradient>

      <View style={styles.grid}>
        {tiles.map((s) => (
          <View key={s.label} style={styles.tile}>
            <View style={[styles.tileIcon, { backgroundColor: `${s.color}22` }]}>
              <Ionicons name={s.icon} size={20} color={s.color} />
            </View>
            <AppText variant="h2">{s.value}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>{s.label}</AppText>
          </View>
        ))}
      </View>

      <Button label={t('continue')} iconRight="arrow-forward" onPress={onContinue} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg },
  hero: {
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  trophy: {
    width: 80, height: 80, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { marginTop: spacing.xs },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(15,10,40,0.35)',
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexGrow: 1, flexBasis: '45%', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  btn: { marginTop: spacing.sm },
});
