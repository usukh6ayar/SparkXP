import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as usersApi from '../../src/api/users';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { StatCard } from '../../src/components/StatCard';
import { MN_PROVINCES as PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { colors, spacing, radius, fontSize } from '../../src/theme/theme';

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);

  const isUB = province === 'Улаанбаатар';

  async function save() {
    if (!fullName.trim()) {
      Alert.alert('Алдаа', 'Нэрээ оруулна уу.');
      return;
    }
    setSaving(true);
    try {
      await usersApi.updateProfile(
        { fullName: fullName.trim(), province: province || undefined, district: isUB ? district || undefined : undefined },
        token!,
      );
      Alert.alert('Амжилттай', 'Профайл шинэчлэгдлээ.');
    } catch {
      Alert.alert('Алдаа', 'Хадгалахад алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Профайл</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="⚡" label="XP" value={user?.xp ?? 0} color={colors.xp} bg={colors.primarySoft} />
          <StatCard icon="✨" label="Очирхон" value={user?.sparks ?? 0} color={colors.sparks} bg={colors.cream} />
        </View>

        {/* Email (read-only) */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Имэйл</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>

        {/* Editable fields */}
        <TextField
          label="Бүтэн нэр"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Нэрээ оруулна уу"
        />

        <SelectField
          label="Аймаг / Хот"
          value={province}
          options={PROVINCES}
          placeholder="Сонгох (заавал биш)"
          onSelect={(v) => { setProvince(v); setDistrict(''); }}
        />

        {isUB && (
          <SelectField
            label="Дүүрэг"
            value={district}
            options={UB_DISTRICTS}
            placeholder="Дүүрэг сонгох"
            onSelect={setDistrict}
          />
        )}

        <Button
          label={saving ? 'Хадгалж байна...' : 'Хадгалах'}
          onPress={save}
          disabled={saving}
          style={{ marginTop: spacing.lg }}
        />

        <Button
          label="Гарах"
          variant="secondary"
          onPress={() => Alert.alert('Гарах уу?', '', [
            { text: 'Болих' },
            { text: 'Гарах', style: 'destructive', onPress: logout },
          ])}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  infoRow: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  label: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: 2 },
  infoValue: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
});
