import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../../src/auth/AuthContext';
import { getStudentProgress, type StudentProgress } from '../../../../../src/api/teacher';
import { t } from '../../../../../src/i18n';
import { AppText } from '../../../../../src/components/Text';
import { Avatar } from '../../../../../src/components/Avatar';
import { Card } from '../../../../../src/components/Card';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { SkillBars, type SkillKey } from '../../../../../src/components/SkillBars';
import { StatusBadge } from '../../../../../src/components/StatusBadge';
import { SkeletonRows } from '../../../../../src/components/SkeletonRows';
import { spacing, radius, type AppColors } from '../../../../../src/theme/theme';
import { useColors } from '../../../../../src/settings/SettingsContext';
import { bounded } from '../../../../../src/theme/responsive';

const SKILL_ORDER: SkillKey[] = ['listening', 'reading', 'writing', 'fill', 'vocab'];

export default function StudentProgressScreen() {
  const { id, studentId } = useLocalSearchParams<{ id: string; studentId: string }>();
  const { token } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [data, setData] = useState<StudentProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id || !studentId) return;
    try {
      setData(await getStudentProgress(id, studentId, token));
    } catch {
      // data stays null → error screen offers a retry
    } finally {
      setLoading(false);
    }
  }, [token, id, studentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SkeletonRows count={6} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: () => { setLoading(true); load(); } }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="h3" numberOfLines={1} style={styles.topTitle}>{t('studentProgress')}</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, bounded]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Header: who + activity */}
        <Card variant="raised" padding="md">
          <View style={styles.head}>
            <Avatar name={data.fullName} size={56} />
            <View style={{ flex: 1 }}>
              <AppText variant="h3" numberOfLines={1}>{data.fullName}</AppText>
              <View style={styles.activityRow}>
                <Ionicons name="star" size={15} color={colors.streak} />
                <AppText variant="label" color={colors.textSecondary}>{data.xp} {t('xp')}</AppText>
                <Ionicons name="flame" size={15} color={colors.streak} style={{ marginLeft: spacing.md }} />
                <AppText variant="label" color={colors.textSecondary}>{data.currentStreak}</AppText>
              </View>
            </View>
          </View>
        </Card>

        {/* Skill breakdown */}
        <AppText variant="h3" style={styles.section}>{t('avgProgress')}</AppText>
        <Card variant="raised" padding="md">
          <SkillBars rows={SKILL_ORDER.map((k) => ({ key: k, value: data.skills[k] }))} />
        </Card>

        {/* Assignment history */}
        <AppText variant="h3" style={styles.section}>{t('assignments')}</AppText>
        {data.assignments.length === 0 ? (
          <EmptyState icon="clipboard-outline" title={t('noAssignments')} hint="" />
        ) : (
          <Card variant="raised" padding="md" style={{ gap: spacing.sm }}>
            {data.assignments.map((a) => (
              <View key={a.assignmentId} style={styles.assignRow}>
                <Ionicons
                  name={a.type === 'quiz' ? 'help-circle-outline' : 'book-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <StatusBadge status={a.status} />
                </View>
                {a.scorePct != null ? (
                  <AppText variant="bodyStrong">{a.scorePct}%</AppText>
                ) : (
                  <AppText variant="label" color={colors.textMuted}>—</AppText>
                )}
              </View>
            ))}
          </Card>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  section: { marginTop: spacing.lg, marginBottom: spacing.xs },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
