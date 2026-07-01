import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import * as classesApi from '../../src/api/classes';
import type { ClassSummary } from '../../src/api/classes';
import { getOrganizations, type Organization } from '../../src/api/organizations';
import { t } from '../../src/i18n';
import { AppText } from '../../src/components/Text';
import { Avatar } from '../../src/components/Avatar';
import { ClassCard } from '../../src/components/ClassCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, spacing, radius, elevation } from '../../src/theme/theme';

export default function TeacherClassesScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orgs, setOrgs] = useState<Organization[]>([]);

  // Orgs are only needed to show each class's school name on its card.
  useEffect(() => {
    if (token) getOrganizations(token).then(setOrgs).catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const mine = await classesApi.getMyClasses(token);
      setClasses(mine.teaching);
    } catch {
      // keep last
    } finally {
      setLoading(false);
    }
  }, [token]);

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

  const schoolOf = (id: string | null) => orgs.find((o) => o.id === id)?.name ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Gradient hero */}
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size={48} />
            <View style={{ flex: 1 }}>
              <AppText variant="overline" color={colors.textOnDarkMuted}>БАГШИЙН САМБАР</AppText>
              <AppText variant="h2" color={colors.white} numberOfLines={1}>{user?.fullName ?? ''}</AppText>
            </View>
          </View>
          <View style={styles.heroStats}>
            <Ionicons name="people" size={15} color={colors.white} />
            <AppText variant="label" color={colors.white}>{classes.length} анги</AppText>
          </View>
          <Pressable style={styles.heroBtn} onPress={() => router.push('/(teacher)/class/new')}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <AppText variant="bodyStrong" color={colors.primary}>{t('createClass')}</AppText>
          </Pressable>
        </LinearGradient>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : classes.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title={t('noClasses')}
            hint={t('noClassesHint')}
            style={{ marginTop: spacing.xxl }}
          />
        ) : (
          <View style={styles.list}>
            <SectionHeader title={t('teacherClasses')} />
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                name={c.name}
                school={schoolOf(c.organizationId)}
                joinCode={c.joinCode}
                onPress={() => router.push(`/(teacher)/class/${c.id}`)}
              />
            ))}
          </View>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.lg },
  hero: {
    margin: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...(elevation.float as object),
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroStats: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
  },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 12,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
