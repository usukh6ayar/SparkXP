import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getExercises } from '../../src/api/quizzes';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { PressableScale } from '../../src/components/PressableScale';
import { Skeleton } from '../../src/components/Skeleton';
import { IELTS_MODULES } from '../../src/constants/ielts';
import { t, tf } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../../src/theme/theme';

/**
 * IELTS hub — the entry to the exam-prep vertical (Plan 3a).
 * Listening/Reading open the normal quiz runner (auto-scored → band 0–9);
 * Writing/Speaking are self-study practice and are marked "coming soon" until
 * that screen lands (IELTS Plan 3b — Boju).
 */
export default function IeltsHubScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    // How many practice sets admin published per module (0 → "coming soon").
    const results = await Promise.all(
      IELTS_MODULES.map((m) =>
        getExercises(token, m.category)
          .then((r) => [m.key, r.items.length] as const)
          .catch(() => [m.key, 0] as const),
      ),
    );
    setCounts(Object.fromEntries(results));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('ieltsTitle')} back showBadges={false} />
      <ScrollView contentContainerStyle={styles.container}>
        <AppText variant="body" color={c.textSecondary}>{t('ieltsSubtitle')}</AppText>

        {IELTS_MODULES.map((m) => {
          const count = counts?.[m.key] ?? 0;
          // Open only what exists: an unbuilt (W/S) or empty module stays inert.
          const ready = m.auto && count > 0;
          return (
            <PressableScale
              key={m.key}
              haptic={ready}
              onPress={() => ready && router.push(`/skill/${m.category}`)}
              style={styles.tile}
            >
              <LinearGradient
                colors={m.grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.tileBody}>
                <AppText variant="h2" color={c.white}>{t(m.labelKey)}</AppText>
                <AppText variant="caption" color="rgba(255,255,255,0.9)">
                  {t(m.hintKey)}
                </AppText>
                {counts === null ? (
                  <Skeleton height={14} width={90} />
                ) : (
                  <AppText variant="caption" color="rgba(255,255,255,0.9)">
                    {ready ? tf('ieltsSetCount', { n: count }) : t('comingSoon')}
                  </AppText>
                )}
              </View>
              <Ionicons name={m.icon} size={44} color="rgba(255,255,255,0.95)" />
            </PressableScale>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    container: { padding: spacing.lg, gap: spacing.md },
    tile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.xl,
      padding: spacing.lg,
      overflow: 'hidden',
    },
    tileBody: { flex: 1, gap: 4 },
  });
