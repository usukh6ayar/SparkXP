import { useCallback, useEffect, useState, useMemo } from 'react';
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
import { t } from '../../../src/i18n';
import { AppText } from '../../../src/components/Text';
import { TextField } from '../../../src/components/TextField';
import { SelectField } from '../../../src/components/SelectField';
import { ActionButton } from '../../../src/components/ActionButton';
import { spacing, type AppColors } from '../../../src/theme/theme';
import { useColors } from '../../../src/settings/SettingsContext';
import { bounded } from '../../../src/theme/responsive';

/**
 * Create-class screen. A standalone route (not a modal) so the school dropdown
 * — which opens its own modal — isn't nested inside another modal, and so the
 * keyboard can push the form up instead of hiding the name field.
 */
export default function NewClassScreen() {
  const { token } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [name, setName] = useState('');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [schoolName, setSchoolName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const loadOrgs = useCallback(() => {
    if (token) getOrganizations(token).then(setOrgs).catch(() => {});
  }, [token]);
  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function onCreate() {
    setError(null);
    const org = orgs.find((o) => o.name === schoolName)!;
    return classesApi.createClass(name.trim(), org.id, token!);
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
          contentContainerStyle={[styles.body, bounded]}
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
          <ActionButton
            label={t('createClass')}
            iconRight="arrow-forward"
            action={onCreate}
            // Replace so Back from the detail returns to the class list, not here.
            onSuccess={(created) => router.replace(`/(teacher)/class/${created.id}`)}
            onError={setError}
            disabled={!name.trim() || !schoolName || !token || !orgs.some((o) => o.name === schoolName)}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
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
