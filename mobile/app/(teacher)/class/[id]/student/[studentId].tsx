import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../../src/auth/AuthContext';
import { getStudentProgress, type StudentProgress } from '../../../../../src/api/teacher';
import { t, tf } from '../../../../../src/i18n';
import { AppText } from '../../../../../src/components/Text';
import { Avatar } from '../../../../../src/components/Avatar';
import { Card } from '../../../../../src/components/Card';
import { EmptyState } from '../../../../../src/components/EmptyState';
import { SkillBars, type SkillKey } from '../../../../../src/components/SkillBars';
import { StudentAnswers } from '../../../../../src/components/StudentAnswers';
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
  /** Аль даалгаврын алдааны задаргаа нээлттэй байна вэ (нэг нь л). */
  const [openKey, setOpenKey] = useState<string | null>(null);

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

  /**
   * Нэг илгээлт = нэг мөр. Багш 5 багц өгөхөд сервер 5 мөр буцаадаг тул урьд
   * нь энэ жагсаалт 15 танигдахгүй эгнээ болж урсдаг байв.
   */
  const groups = useMemo(() => {
    const byKey = new Map<string, typeof rows>();
    const rows = data?.assignments ?? [];
    for (const a of rows) {
      const key = `${a.createdAt ?? a.assignmentId}|${a.dueAt ?? ''}`;
      const list = byKey.get(key);
      if (list) list.push(a);
      else byKey.set(key, [a]);
    }
    return [...byKey].map(([key, parts]) => {
      /*
       * Гарчиг. Багц бүр өөрийн нэртэй ба тэдгээр нь ихэвчлэн нэг хавтсаас
       * ирдэг («Present Simple» → «… 1 · Positive», «… 2 · Negative» …), тул
       * нэрсийг нь залгавал «Test5 · Test 2 · Test5 · Test 5 +3» гэсэн
       * давхардсан урт мөр болно. Бүх багц НЭГ сэдэвтэй бол тэр сэдэв нь
       * даалгаврын жинхэнэ нэр — түүнийг харуулна.
       */
      const topics = [...new Set(parts.map((p) => p.targetTopic).filter(Boolean))];
      if (parts.length > 1 && topics.length === 1) {
        return { key, parts, head: parts[0], title: topics[0] as string };
      }
      const names = [...new Set(parts.map((p) => p.targetTitle).filter(Boolean))] as string[];
      // Гарчиггүй = админ дасгалыг устгасан. Дүн нь хэвээр тул мөрийг
      // хаяхгүй — «—» гэхийн оронд шалтгааныг нь хэлнэ.
      const title =
        names.length === 0
          ? t('assignmentDeleted')
          : names.length <= 2
            ? names.join(' · ')
            : `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
      return { key, parts, head: parts[0], title };
    });
  }, [data]);

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
            <Avatar avatarUrl={data.avatarUrl} name={data.fullName} size={56} />
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
        <Card variant="raised" padding="md" style={{ gap: spacing.sm }}>
          <SkillBars rows={SKILL_ORDER.map((k) => ({ key: k, value: data.skills[k] }))} />
          {/*
            Бүх зураас хоосон байхад «—» гэдэг нь юу гэсэн үг болох нь
            ойлгомжгүй: багш «ажиллахгүй байна уу» гэж эргэлздэг. Тоо байхгүй
            гэдэг нь эвдрэл биш — сурагч тухайн ур чадварын дасгал хийгээгүй
            гэсэн үг (даалгаврын сангийн дасгал ур чадварт тооцогддоггүй).
          */}
          {SKILL_ORDER.every((k) => data.skills[k] == null) ? (
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
              <AppText variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
                {t('skillsNoData')}
              </AppText>
            </View>
          ) : null}
        </Card>

        {/* Assignment history */}
        <AppText variant="h3" style={styles.section}>{t('assignments')}</AppText>
        {groups.length === 0 ? (
          <EmptyState icon="clipboard-outline" title={t('noAssignments')} hint="" />
        ) : (
          <Card variant="raised" padding="md" style={{ gap: spacing.xs }}>
            {groups.map((g) => {
              const done = g.parts.filter((p) => p.status !== 'assigned');
              const scored = done.filter((p) => p.scorePct != null);
              const avg = scored.length
                ? Math.round(
                    scored.reduce((n, p) => n + (p.scorePct ?? 0), 0) / scored.length,
                  )
                : null;
              const late = g.parts.some((p) => p.status === 'late');
              const allDone = done.length === g.parts.length;
              // Дүнгээр өнгө: багш нэг харцаар «сайн уу, муу юу» гэдгийг мэдэх.
              const tone = !allDone
                ? colors.textMuted
                : avg == null
                  ? colors.success
                  : avg >= 70
                    ? colors.success
                    : avg >= 40
                      ? colors.warning
                      : colors.danger;
              // Юу ч хийгээгүй даалгаварт задлах зүйл алга — дарагдахгүй.
              const canOpen = done.length > 0;
              const isOpen = openKey === g.key;
              return (
                <View key={g.key}>
                  <Pressable
                    style={styles.assignRow}
                    disabled={!canOpen}
                    onPress={() => setOpenKey(isOpen ? null : g.key)}
                  >
                    <View style={[styles.assignIcon, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons
                        name={g.head.type === 'quiz' ? 'document-text-outline' : 'play-circle-outline'}
                        size={16}
                        color={colors.textSecondary}
                      />
                    </View>
                    <View style={styles.assignBody}>
                      {/* Гарчиг — урьд нь ЮУ Ч байгаагүй тул мөр нь
                          «? · Хийгээгүй · —» гэсэн танигдахгүй эгнээ байв. */}
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {g.title}
                      </AppText>
                      <AppText variant="caption" color={colors.textMuted}>
                        {g.parts.length > 1
                          ? `${tf('assignmentPartCount', { n: g.parts.length })} · ${done.length}/${g.parts.length} ${t('submissionsDone').toLowerCase()}`
                          : allDone
                            ? t('submissionsDone')
                            : t('submissionStatus_assigned')}
                        {late ? ` · ${t('submissionStatus_late')}` : ''}
                      </AppText>
                    </View>
                    {/* Баруун талд ГАНЦ утга: дүн, эсвэл хийгээгүйн тэмдэг. */}
                    {allDone ? (
                      <AppText variant="bodyStrong" color={tone}>
                        {avg != null ? `${avg}%` : '✓'}
                      </AppText>
                    ) : (
                      <AppText variant="label" color={colors.textMuted}>
                        {done.length > 0 ? `${done.length}/${g.parts.length}` : '—'}
                      </AppText>
                    )}
                    {/* Дарагдана гэдгийг зөвхөн задлах зүйлтэй мөр дээр хэлнэ. */}
                    {canOpen ? (
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.borderStrong}
                      />
                    ) : null}
                  </Pressable>

                  {/* Хийсэн багцуудын алдааны задаргаа — ангийн дэлгэцтэй
                      ЯГ ижил компонент (`StudentAnswers`), тиймээс хоёр
                      газарт хоёр өөр харагдац үүсэхгүй. */}
                  {isOpen ? (
                    <StudentAnswers
                      packs={done.map((p) => ({
                        id: p.assignmentId,
                        label: p.targetTitle || p.targetTopic || t('assignmentDeleted'),
                      }))}
                      studentId={studentId!}
                    />
                  ) : null}
                </View>
              );
            })}
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
  assignRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  assignIcon: {
    width: 30, height: 30, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  assignBody: { flex: 1, gap: 1 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
});
