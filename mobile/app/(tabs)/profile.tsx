import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import * as usersApi from '../../src/api/users';
import { getReviewStats } from '../../src/api/reviews';
import { MN_PROVINCES as PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { Pill } from '../../src/components/Pill';
import { IconTile } from '../../src/components/IconTile';
import { StatCard } from '../../src/components/StatCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const fox = require('../../assets/logo.png');

const ACHIEVEMENTS: { icon: IconName; label: string; earned: boolean }[] = [
  { icon: 'footsteps', label: 'Анхны алхам', earned: true },
  { icon: 'flame', label: '7 хоног', earned: true },
  { icon: 'headset', label: 'Сонсох мастер', earned: true },
  { icon: 'trophy', label: 'Сорил мастер', earned: false },
  { icon: 'ribbon', label: '100 хичээл', earned: false },
];

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [known, setKnown] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    getReviewStats(token).then((s) => setKnown(s.known)).catch(() => {});
  }, [token]);

  const soon = () => Alert.alert('Тун удахгүй', 'Энэ хэсэг удахгүй нэмэгдэнэ.');
  const confirmLogout = () =>
    Alert.alert('Гарах уу?', '', [
      { text: 'Болих' },
      { text: 'Гарах', style: 'destructive', onPress: logout },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="Профайл" streak={5} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.profileCard}>
          <Image source={fox} style={styles.avatar} resizeMode="contain" />
          <View style={styles.profileInfo}>
            <AppText variant="h2" numberOfLines={1}>{user?.fullName}</AppText>
            <AppText variant="caption" numberOfLines={1} style={styles.email}>{user?.email}</AppText>
            <Pill label="A2 түвшин" bg={colors.primarySoft} fg={colors.primaryDark} />
          </View>
          <Pressable style={styles.editBtn} onPress={() => setEditing(true)} hitSlop={8}>
            <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="flash" label="XP" value={user?.xp ?? 0} color={colors.xp} bg={tints.orange.bg} />
          <StatCard icon="sparkles" label="Очирхон" value={user?.sparks ?? 0} color={colors.sparks} bg={colors.cream} />
          <StatCard icon="flame" label="Цуврал" value="5" color={colors.streak} bg={colors.dangerSoft} />
        </View>

        {/* Known words */}
        <Card onPress={() => router.push('/swipe')} padding="md" style={styles.rowCard}>
          <IconTile icon="library" bg={tints.green.bg} fg={tints.green.fg} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Мэдэх үг</AppText>
            <AppText variant="caption">Дарж шинэ үг сур</AppText>
          </View>
          <AppText variant="h2" color={colors.success}>{known ?? '—'}</AppText>
        </Card>

        {/* Leaderboard banner */}
        <Pressable
          style={({ pressed }) => [styles.leaderboard, pressed && styles.pressed]}
          onPress={() => router.push('/leaderboard')}
        >
          <IconTile icon="podium" bg="rgba(255,255,255,0.12)" fg={colors.sparks} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3" color={colors.white}>Дэлхийн чансаа</AppText>
            <AppText variant="caption" color={colors.textOnDarkMuted}>Таны байр · Top 12%</AppText>
          </View>
          <AppText variant="h2" color={colors.white}>#1284</AppText>
          <Ionicons name="chevron-forward" size={18} color={colors.textOnDarkMuted} />
        </Pressable>

        {/* Achievements */}
        <SectionHeader title="Амжилтын тэмдэг" actionLabel="Бүгд" onAction={soon} style={styles.section} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achRow}>
          {ACHIEVEMENTS.map((a) => (
            <View key={a.label} style={styles.achItem}>
              <View style={[styles.achBadge, !a.earned && styles.achBadgeLocked]}>
                <Ionicons
                  name={a.earned ? a.icon : 'lock-closed'}
                  size={26}
                  color={a.earned ? colors.sparks : colors.textMuted}
                />
              </View>
              <AppText variant="caption" center numberOfLines={2} style={styles.achLabel}>{a.label}</AppText>
            </View>
          ))}
        </ScrollView>

        {/* Settings list */}
        <SectionHeader title="Тохиргоо" style={styles.section} />
        <Card padding={0} style={styles.list}>
          <Row icon="globe-outline" label="Хэл" value="Монгол" onPress={soon} />
          <Row icon="notifications-outline" label="Мэдэгдэл" onPress={soon} />
          <Row icon="help-circle-outline" label="Тусламж" onPress={soon} />
          <Row icon="information-circle-outline" label="Бидний тухай" onPress={soon} />
          <Row icon="log-out-outline" label="Гарах" onPress={confirmLogout} danger last />
        </Card>

        <View style={{ height: 110 }} />
      </ScrollView>

      <EditProfileModal
        visible={editing}
        onClose={() => setEditing(false)}
        initialName={user?.fullName ?? ''}
        token={token}
      />
    </SafeAreaView>
  );
}

function Row({
  icon, label, value, onPress, danger, last,
}: {
  icon: IconName; label: string; value?: string; onPress: () => void; danger?: boolean; last?: boolean;
}) {
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable style={[styles.row, !last && styles.rowBorder]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSecondary} />
      <AppText variant="bodyStrong" color={fg} style={{ flex: 1 }}>{label}</AppText>
      {value ? <AppText variant="caption">{value}</AppText> : null}
      {!danger ? <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} /> : null}
    </Pressable>
  );
}

/** Edit-profile modal — keeps the existing PATCH /api/users/me logic. */
function EditProfileModal({
  visible, onClose, initialName, token,
}: {
  visible: boolean; onClose: () => void; initialName: string; token: string | null;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);
  const isUB = province === 'Улаанбаатар';

  async function save() {
    if (!fullName.trim()) { Alert.alert('Алдаа', 'Нэрээ оруулна уу.'); return; }
    setSaving(true);
    try {
      await usersApi.updateProfile(
        { fullName: fullName.trim(), province: province || undefined, district: isUB ? district || undefined : undefined },
        token!,
      );
      Alert.alert('Амжилттай', 'Профайл шинэчлэгдлээ.');
      onClose();
    } catch {
      Alert.alert('Алдаа', 'Хадгалахад алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar title="Профайл засах" showBadges={false} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <TextField label="Бүтэн нэр" value={fullName} onChangeText={setFullName} placeholder="Нэрээ оруулна уу" />
          <SelectField
            label="Аймаг / Хот" value={province} options={PROVINCES}
            placeholder="Сонгох (заавал биш)"
            onSelect={(v) => { setProvince(v); setDistrict(''); }}
          />
          {isUB && (
            <SelectField label="Дүүрэг" value={district} options={UB_DISTRICTS} placeholder="Дүүрэг сонгох" onSelect={setDistrict} />
          )}
          <Button label={saving ? 'Хадгалж байна...' : 'Хадгалах'} onPress={save} disabled={saving} style={{ marginTop: spacing.lg }} />
          <Button label="Болих" variant="secondary" onPress={onClose} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.cream, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
  },
  avatar: { width: 60, height: 60 },
  profileInfo: { flex: 1, gap: 4 },
  email: { marginBottom: 2 },
  editBtn: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  leaderboard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.xs,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  section: { marginTop: spacing.lg },
  achRow: { gap: spacing.md, paddingRight: spacing.lg },
  achItem: { alignItems: 'center', width: 72 },
  achBadge: {
    width: 60, height: 60, borderRadius: radius.full, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.sparks,
  },
  achBadgeLocked: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
  achLabel: { marginTop: spacing.xs },
  list: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
