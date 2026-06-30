import { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/auth/AuthContext';
import * as classesApi from '../../../src/api/classes';
import { getOrganizations, type Organization } from '../../../src/api/organizations';
import { ApiError } from '../../../src/api/client';
import { t } from '../../../src/i18n';
import { AppText } from '../../../src/components/Text';
import { TextField } from '../../../src/components/TextField';
import { SelectField } from '../../../src/components/SelectField';
import { Button } from '../../../src/components/Button';
import { colors, spacing } from '../../../src/theme/theme';

/**
 * Create-class screen. A standalone route (not a modal) so the school dropdown
 * — which opens its own modal — isn't nested inside another modal, and so the
 * keyboard can push the form up instead of hiding the name field.
 */
export default function NewClassScreen() {
  const { token } = useAuth();
  const router = useRouter();
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

  async function onCreate() {
    const org = orgs.find((o) => o.name === schoolName);
    if (!token || !name.trim() || !org) return;
    setError(null);
    setBusy(true);
    try {
      const created = await classesApi.createClass(name.trim(), org.id, token);
      // Replace so Back from the detail returns to the class list, not here.
      router.replace(`/(teacher)/class/${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="h3" style={styles.topTitle}>{t('createClass')}</AppText>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
            iconRight="arrow-forward"
            onPress={onCreate}
            loading={busy}
            disabled={!name.trim() || !schoolName}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
