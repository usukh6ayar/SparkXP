import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as usersApi from '../../src/api/users';
import { MN_PROVINCES as PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { TopBar } from '../../src/components/TopBar';
import { Pill } from '../../src/components/Pill';
import { StatCard } from '../../src/components/StatCard';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, fontSize } from '../../src/theme/theme';

const fox = require('../../assets/logo.png');

const ACHIEVEMENTS = [
  { icon: '📖', label: 'Анхны алхам' },
  { icon: '🔥', label: '7 хоног' },
  { icon: '🎧', label: 'Сонсох мастер' },
  { icon: '🏆', label: 'Сорил мастер' },
  { icon: '👑', label: '100 хичээл' },
];

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const [editing, setEditing] = useState(false);

  const soon = () => Alert.alert('Тун удахгүй', 'Энэ хэсэг удахгүй нэмэгдэнэ.');
  const confirmLogout = () =>
    Alert.alert('Гарах уу?', '', [
      { text: 'Болих' },
      { text: 'Гарах', style: 'destructive', onPress: logout },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="Профайл" streak={5} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <Image source={fox} style={styles.avatar} resizeMode="contain" />
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.fullName}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Pill label="A2  Түвшин" bg={colors.primarySoft} fg={colors.primary} />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="⚡" label="XP" value={user?.xp ?? 0} color={colors.xp} bg={colors.primarySoft} />
          <StatCard icon="🪙" label="Очирхон" value={user?.sparks ?? 0} color={colors.sparks} bg={colors.cream} />
          <StatCard icon="🔥" label="Цуврал" value="5" color={colors.danger} bg="#FDE8E8" />
        </View>

        {/* Leaderboard banner */}
        <Pressable style={styles.leaderboard} onPress={soon}>
          <Text style={styles.lbIcon}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.lbTitle}>Дэлхийн чансаа</Text>
            <Text style={styles.lbSub}>Таны байр</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.lbRank}>#1284</Text>
            <Text style={styles.lbTop}>Top 12%</Text>
          </View>
          <Text style={styles.lbChev}>›</Text>
        </Pressable>

        {/* Settings list */}
        <View style={styles.list}>
          <Row icon="👤" label="Профайл засах" onPress={() => setEditing(true)} />
          <Row icon="🌐" label="Хэл" value="Монгол" onPress={soon} />
          <Row icon="❓" label="Тусламж" onPress={soon} />
          <Row icon="ℹ️" label="Бидний тухай" onPress={soon} />
          <Row icon="🚪" label="Гарах" onPress={confirmLogout} danger last />
        </View>

        {/* Achievements */}
        <View style={styles.achHeader}>
          <Text style={styles.achTitle}>Амжилтын тэмдгүүд</Text>
          <Pressable onPress={soon}><Text style={styles.seeAll}>Бүгдийг харах ›</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achRow}>
          {ACHIEVEMENTS.map((a) => (
            <View key={a.label} style={styles.achItem}>
              <View style={styles.achBadge}><Text style={styles.achIcon}>{a.icon}</Text></View>
              <Text style={styles.achLabel}>{a.label}</Text>
            </View>
          ))}
        </ScrollView>

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

/** A settings list row. */
function Row({
  icon, label, value, onPress, danger, last,
}: {
  icon: string; label: string; value?: string; onPress: () => void; danger?: boolean; last?: boolean;
}) {
  return (
    <Pressable style={[styles.row, !last && styles.rowBorder]} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <Text style={styles.rowChev}>›</Text>
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
        <TopBar title="Профайл засах" back={false} />
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
  container: { paddingHorizontal: spacing.lg },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.cream, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  avatar: { width: 76, height: 76 },
  profileInfo: { flex: 1, gap: 4 },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  email: { fontSize: fontSize.sm, color: colors.textMuted },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  leaderboard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg,
  },
  lbIcon: { fontSize: 30 },
  lbTitle: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  lbSub: { color: '#C7CEDF', fontSize: fontSize.sm },
  lbRank: { color: colors.white, fontWeight: '800', fontSize: fontSize.lg },
  lbTop: { color: colors.sparks, fontWeight: '700', fontSize: fontSize.sm },
  lbChev: { color: colors.white, fontSize: 24 },
  list: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: { fontSize: fontSize.lg },
  rowLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.navy },
  rowValue: { color: colors.textMuted, fontSize: fontSize.sm },
  rowChev: { color: colors.textMuted, fontSize: 22 },
  achHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  achTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.navy },
  seeAll: { color: colors.primary, fontWeight: '700' },
  achRow: { gap: spacing.md, paddingRight: spacing.lg },
  achItem: { alignItems: 'center', width: 76 },
  achBadge: {
    width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.sparks,
  },
  achIcon: { fontSize: 30 },
  achLabel: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
