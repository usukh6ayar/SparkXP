import { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import * as classesApi from '../../src/api/classes';
import type { ClassSummary } from '../../src/api/classes';
import { getOrganizations, type Organization } from '../../src/api/organizations';
import { ApiError } from '../../src/api/client';
import { t } from '../../src/i18n';
import { AppText } from '../../src/components/Text';
import { ClassCard } from '../../src/components/ClassCard';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius } from '../../src/theme/theme';

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

  // Schools the teacher can attach a class to (super-admin managed list).
  useEffect(() => {
    if (token) getOrganizations(token).then(setOrgs).catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const mine = await classesApi.getMyClasses(token);
      setClasses(mine.teaching);
    } catch {
      // keep whatever we had; surfaced on next action
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Refetch whenever the tab regains focus (e.g. after creating a class).
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <AppText variant="h1">{t('teacherClasses')}</AppText>
          <AppText variant="caption">
            {t('teacher')} · {user?.fullName ?? ''}
          </AppText>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
          <Ionicons name="add" size={24} color={colors.white} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : classes.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={56} color={colors.textMuted} />
          <AppText variant="h3" center style={{ marginTop: spacing.md }}>
            {t('noClasses')}
          </AppText>
          <AppText variant="body" center color={colors.textSecondary}>
            {t('noClassesHint')}
          </AppText>
          <Button label={t('createClass')} icon="add" onPress={() => setModalOpen(true)} style={styles.emptyBtn} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {classes.map((c) => (
            <ClassCard
              key={c.id}
              name={c.name}
              joinCode={c.joinCode}
              onPress={() => router.push(`/(teacher)/class/${c.id}`)}
            />
          ))}
        </ScrollView>
      )}

      {/* Create-class modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <AppText variant="h2" style={{ marginBottom: spacing.lg }}>
              {t('createClass')}
            </AppText>
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
              <AppText variant="caption" color={colors.danger} style={{ marginBottom: spacing.sm }}>
                {error}
              </AppText>
            ) : null}
            <Button
              label={t('createClass')}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xxxl, gap: 4 },
  emptyBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});
