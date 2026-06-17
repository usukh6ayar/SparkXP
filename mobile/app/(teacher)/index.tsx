import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import * as classesApi from '../../src/api/classes';
import type { ClassSummary } from '../../src/api/classes';
import { getOrganizations, type Organization } from '../../src/api/organizations';
import { ApiError } from '../../src/api/client';
import { t } from '../../src/i18n';
import { AppText } from '../../src/components/Text';
import { Avatar } from '../../src/components/Avatar';
import { ClassCard } from '../../src/components/ClassCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, elevation } from '../../src/theme/theme';

export default function TeacherClassesScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [schoolName, setSchoolName] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrgs = useCallback(() => {
    if (token) getOrganizations(token).then(setOrgs).catch(() => {});
  }, [token]);
  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  function openCreate() {
    loadOrgs();
    setError(null);
    setModalOpen(true);
  }

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

  async function onCreate() {
    const org = orgs.find((o) => o.name === schoolName);
    if (!token || !name.trim() || !org) return;
    setError(null);
    setBusy(true);
    try {
      const created = await classesApi.createClass(name.trim(), org.id, token);
      setModalOpen(false);
      setName('');
      setSchoolName(undefined);
      await load();
      router.push(`/(teacher)/class/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const schoolOf = (id: string | null) => orgs.find((o) => o.id === id)?.name ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
          <Pressable style={styles.heroBtn} onPress={openCreate}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <AppText variant="bodyStrong" color={colors.primary}>{t('createClass')}</AppText>
          </Pressable>
        </LinearGradient>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : classes.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="school-outline" size={40} color={colors.primary} />
            </View>
            <AppText variant="h3" center style={{ marginTop: spacing.md }}>{t('noClasses')}</AppText>
            <AppText variant="body" center color={colors.textSecondary} style={{ marginTop: 2 }}>
              {t('noClassesHint')}
            </AppText>
          </View>
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

      {/* Create-class bottom sheet */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <AppText variant="h2" style={{ marginBottom: spacing.lg }}>{t('createClass')}</AppText>
            <SelectField
              label={t('school')}
              placeholder={t('selectSchool')}
              value={schoolName}
              options={orgs.map((o) => o.name)}
              onSelect={setSchoolName}
            />
            <TextField
              label={t('className')}
              placeholder={t('classNamePlaceholder')}
              value={name}
              onChangeText={setName}
            />
            {orgs.length === 0 ? (
              <AppText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
                {t('noSchools')}
              </AppText>
            ) : null}
            {error ? (
              <AppText variant="caption" color={colors.danger} style={{ marginBottom: spacing.sm }}>{error}</AppText>
            ) : null}
            <Button
              label={t('createClass')}
              iconRight="arrow-forward"
              onPress={onCreate}
              loading={busy}
              disabled={!name.trim() || !schoolName}
            />
          </Pressable>
        </Pressable>
      </Modal>
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
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: radius.full, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,10,40,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
});
