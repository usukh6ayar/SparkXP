import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/auth/AuthContext';
import * as usersApi from '../../src/api/users';
import * as classesApi from '../../src/api/classes';
import { getGamification, type Gamification } from '../../src/api/gamification';
import { MN_PROVINCES as PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Pill } from '../../src/components/Pill';
import { SectionHeader } from '../../src/components/SectionHeader';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { resolveAvatar } from '../../src/lib/avatar';
import { colors, spacing, radius, tints, elevation } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const avatarImg = require('../../assets/buddy-menu.png');

// Fallbacks until /gamification loads.
const STREAK = 0;
const LEVEL_SIZE = 1000;

const ROLE_LABEL: Record<string, string> = {
  student: 'Сурагч', teacher: 'Багш', admin: 'Админ', super_admin: 'Супер админ',
};

/** A usage / limit row with a thin progress bar (turns red when over). */
function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const over = used >= limit;
  const u = unit ? ` ${unit}` : '';
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.usageTop}>
        <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
        <AppText variant="caption" color={over ? colors.danger : colors.textSecondary}>
          {used}{u} / {limit}{u}
        </AppText>
      </View>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { width: `${Math.max(pct * 100, 3)}%`, backgroundColor: over ? colors.danger : colors.primary }]} />
      </View>
    </View>
  );
}

const ACHIEVEMENTS: { icon: IconName; label: string; tint: { bg: string; fg: string }; earned: boolean }[] = [
  { icon: 'book', label: 'Анхны хичээл', tint: tints.purple, earned: true },
  { icon: 'trophy', label: 'Шилдэг сурагч', tint: tints.amber, earned: true },
  { icon: 'flash', label: '10 дараалал', tint: tints.blue, earned: true },
  { icon: 'calendar', label: '7 хоног дараалал', tint: tints.green, earned: true },
  { icon: 'diamond', label: '100 очирхон', tint: tints.purple, earned: false },
];

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; teacherName: string | null }[]>([]);
  const [plan, setPlan] = useState<usersApi.PlanInfo | null>(null);
  const [gam, setGam] = useState<Gamification | null>(null);

  // Enrolled classes (+ which teacher), plan and gamification — refetched on focus.
  const loadProfile = useCallback(async () => {
    if (!token) return;
    usersApi.getMyPlan(token).then(setPlan).catch(() => {});
    getGamification(token).then(setGam).catch(() => {});
    try {
      const mine = await classesApi.getMyClasses(token);
      const details = await Promise.all(mine.enrolled.map((c) => classesApi.getClass(c.id, token)));
      setClasses(details.map((d) => ({ id: d.id, name: d.name, teacherName: d.teacher?.fullName ?? null })));
    } catch {
      // ignore
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const soon = () => Alert.alert('Тун удахгүй', 'Энэ хэсэг удахгүй нэмэгдэнэ.');
  const confirmLogout = () =>
    Alert.alert('Гарах уу?', '', [
      { text: 'Болих' },
      { text: 'Гарах', style: 'destructive', onPress: logout },
    ]);

  const xp = user?.xp ?? 0;
  const sparks = user?.sparks ?? 0;
  // Real gamification (backend curve) with a local fallback until it loads.
  const level = gam?.level ?? Math.floor(xp / LEVEL_SIZE) + 1;
  const pct = gam ? Math.round(gam.progress * 100) : Math.round(((xp % LEVEL_SIZE) / LEVEL_SIZE) * 100);
  const levelXp = gam?.levelXp ?? xp % LEVEL_SIZE;
  const levelTarget = gam?.levelTarget ?? LEVEL_SIZE;
  const streak = gam?.currentStreak ?? STREAK;
  const lessonsDone = gam?.lessonsDone ?? 0;
  const quizzesDone = gam?.quizzesDone ?? 0;

  const STATS = [
    { icon: 'book' as IconName, value: lessonsDone, label: 'Хичээл', tint: tints.purple },
    { icon: 'trophy' as IconName, value: quizzesDone, label: 'Сорил', tint: tints.green },
    { icon: 'flame' as IconName, value: streak, label: 'Өдөр дараалал', tint: tints.blue },
    { icon: 'diamond' as IconName, value: sparks, label: 'Очирхон', tint: tints.amber },
  ];

  const QUICK: { icon: IconName; label: string; tint: { bg: string; fg: string }; onPress: () => void }[] = [
    { icon: 'person', label: 'Миний мэдээлэл', tint: tints.blue, onPress: () => setEditing(true) },
    { icon: 'stats-chart', label: 'Миний ахиц', tint: tints.pink, onPress: () => router.push('/leaderboard') },
    { icon: 'bookmark', label: 'Хадгалсан', tint: tints.green, onPress: () => router.push('/saved') },
    { icon: 'notifications', label: 'Мэдэгдэл', tint: tints.orange, onPress: soon },
    { icon: 'gift', label: 'Шагналууд', tint: tints.purple, onPress: soon },
    { icon: 'time', label: 'Сүүлийн үзсэн', tint: tints.blue, onPress: soon },
    { icon: 'heart', label: 'Дуртай', tint: tints.pink, onPress: soon },
    { icon: 'settings', label: 'Тохиргоо', tint: tints.teal, onPress: soon },
  ];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="h1">Профайл</AppText>
            <View style={styles.diamondBadge}>
              <Ionicons name="diamond" size={16} color={colors.sparks} />
              <AppText variant="label" color={colors.text}>{sparks}</AppText>
            </View>
          </View>

          {/* Profile hero — gradient panel + glowing avatar */}
          <LinearGradient colors={['#FFFFFF', '#F4EEFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarGlow} />
              <Pressable onPress={() => router.push('/avatar')}>
                <LinearGradient colors={['#8A5BFF', '#6C3BFF']} style={styles.avatarRing}>
                  <Image source={resolveAvatar(user?.avatarUrl) ?? avatarImg} style={styles.avatar} resizeMode="cover" />
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.editBtn} onPress={() => router.push('/avatar')} hitSlop={6}>
                <Ionicons name="camera" size={13} color={colors.white} />
              </Pressable>
            </View>

            <View style={styles.heroInfo}>
              <View style={styles.nameRow}>
                <AppText variant="h2" numberOfLines={1}>{user?.fullName}</AppText>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              </View>
              <Pill label={ROLE_LABEL[user?.role ?? 'student'] ?? 'Сурагч'} bg={colors.primarySoft} fg={colors.primaryDark} />
              <View style={styles.levelRow}>
                <Ionicons name="star" size={15} color={colors.xp} />
                <AppText variant="bodyStrong">Түвшин {level}</AppText>
              </View>
              {/* Premium XP progress */}
              <View style={styles.xpTrack}>
                <LinearGradient
                  colors={['#9A6DFF', '#6C3BFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.xpFill, { width: `${Math.max(pct, 4)}%` }]}
                />
              </View>
              <AppText variant="caption" style={styles.levelXp}>{levelXp} / {levelTarget} XP</AppText>
            </View>
          </LinearGradient>

          {/* Stats — colorful elevated cells */}
          <View style={styles.statsCard}>
            {STATS.map((s) => (
              <View key={s.label} style={[styles.statCell, { backgroundColor: s.tint.bg }]}>
                <View style={[styles.statIcon, { backgroundColor: colors.white }]}>
                  <Ionicons name={s.icon} size={20} color={s.tint.fg} />
                </View>
                <AppText variant="h3" style={styles.statValue}>{s.value}</AppText>
                <AppText variant="caption" center numberOfLines={2}>{s.label}</AppText>
              </View>
            ))}
          </View>

          {/* Plan / limits */}
          {plan ? (
            <View style={styles.planCard}>
              <View style={styles.planTop}>
                <View style={{ flex: 1 }}>
                  <AppText variant="overline" color={colors.textSecondary}>МИНИЙ БАГЦ</AppText>
                  <AppText variant="h3">{plan.planName}</AppText>
                </View>
                <View style={[styles.planBadge, { backgroundColor: plan.isFree ? colors.surfaceAlt : colors.xp }]}>
                  <Ionicons name={plan.isFree ? 'leaf' : 'star'} size={12} color={plan.isFree ? colors.textSecondary : colors.white} />
                  <AppText variant="caption" color={plan.isFree ? colors.textSecondary : colors.white}>
                    {plan.isFree ? 'Үнэгүй' : 'Premium'}
                  </AppText>
                </View>
              </View>
              {plan.limits ? (
                <View style={styles.planUsage}>
                  {plan.limits.voiceMinutes != null ? (
                    <UsageBar label="AI яриа" used={plan.usage.voiceMinutes} limit={plan.limits.voiceMinutes} unit="мин" />
                  ) : null}
                  {plan.limits.dictionaryAi != null ? (
                    <UsageBar label="Толь бичиг" used={plan.usage.dictionaryAi} limit={plan.limits.dictionaryAi} unit="" />
                  ) : null}
                  {plan.limits.memoryMb != null ? (
                    <UsageBar label="Санах ой" used={plan.usage.memoryMb} limit={plan.limits.memoryMb} unit="MB" />
                  ) : null}
                </View>
              ) : (
                <AppText variant="caption" color={colors.textSecondary} style={{ marginTop: 6 }}>
                  Premium багцаар AI яриа, толь бичиг зэрэг илүү боломжийг нээгээрэй.
                </AppText>
              )}
            </View>
          ) : null}

          {/* Achievements — large collectible badges */}
          <SectionHeader title="Миний амжилтууд" actionLabel="Бүгдийг харах ›" onAction={soon} style={styles.section} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achRow}>
            {ACHIEVEMENTS.map((a) => (
              <View key={a.label} style={styles.achItem}>
                {a.earned ? (
                  <LinearGradient colors={['#FFFFFF', a.tint.bg]} style={[styles.achBadge, styles.achEarned]}>
                    <Ionicons name={a.icon} size={32} color={a.tint.fg} />
                  </LinearGradient>
                ) : (
                  <View style={[styles.achBadge, styles.achLocked]}>
                    <Ionicons name="lock-closed" size={28} color={colors.textMuted} />
                  </View>
                )}
                <AppText variant="caption" center numberOfLines={2} style={styles.achLabel}>{a.label}</AppText>
              </View>
            ))}
          </ScrollView>

          {/* Quick menu — premium soft cards */}
          <SectionHeader title="Түргэн цэс" style={styles.section} />
          <View style={styles.quickGrid}>
            {QUICK.map((q) => (
              <Pressable key={q.label} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]} onPress={q.onPress}>
                <View style={[styles.quickIcon, { backgroundColor: q.tint.bg }]}>
                  <Ionicons name={q.icon} size={22} color={q.tint.fg} />
                </View>
                <AppText variant="caption" center numberOfLines={1} style={styles.quickLabel}>{q.label}</AppText>
              </Pressable>
            ))}
          </View>

          {/* My classes — which teacher's class the student joined */}
          <SectionHeader
            title="Миний ангиуд"
            actionLabel="Анги нэгдэх ›"
            onAction={() => router.push('/join')}
            style={styles.section}
          />
          {classes.length === 0 ? (
            <Pressable style={styles.joinEmpty} onPress={() => router.push('/join')}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <AppText variant="body" color={colors.textSecondary}>Анги нэгдээгүй байна — нэгдэх</AppText>
            </Pressable>
          ) : (
            classes.map((c) => (
              <View key={c.id} style={styles.classRow}>
                <View style={styles.classIcon}>
                  <Ionicons name="people" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{c.name}</AppText>
                  {c.teacherName ? <AppText variant="caption">Багш: {c.teacherName}</AppText> : null}
                </View>
              </View>
            ))
          )}

          {/* Premium banner — gradient feature card */}
          <Pressable onPress={soon} style={({ pressed }) => pressed && styles.pressed}>
            <LinearGradient colors={['#7A4DFF', '#5A28F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premium}>
              <View style={styles.premGlow} pointerEvents="none" />
              <View style={{ flex: 1 }}>
                <View style={styles.premiumTitleRow}>
                  <AppText style={styles.crown}>👑</AppText>
                  <AppText variant="h3" color={colors.white}>SparkXP Premium</AppText>
                </View>
                <AppText variant="caption" color="rgba(255,255,255,0.85)" style={styles.premiumSub}>
                  Давуу эрх, илүү их боломжууд
                </AppText>
                <View style={styles.premiumBtn}>
                  <AppText variant="bodyStrong" color={colors.primary}>Дэлгэрэнгүй →</AppText>
                </View>
              </View>
              <AppText style={styles.treasure}>💎</AppText>
            </LinearGradient>
          </Pressable>

          {/* Logout */}
          <Pressable style={styles.logout} onPress={confirmLogout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <AppText variant="bodyStrong" color={colors.danger}>Гарах</AppText>
          </Pressable>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      <EditProfileModal
        visible={editing}
        onClose={() => setEditing(false)}
        initialName={user?.fullName ?? ''}
        token={token}
      />
    </View>
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

const PURPLE_SHADOW = {
  shadowColor: colors.primary,
  shadowOpacity: 0.18,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 6,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diamondBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    ...(elevation.sm as object),
  },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.lg,
    ...PURPLE_SHADOW,
  },
  avatarOuter: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  avatarGlow: {
    position: 'absolute', top: -8, left: -8, width: 116, height: 116, borderRadius: 58,
    backgroundColor: 'rgba(124,77,255,0.25)',
  },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#EEE6FF' },
  editBtn: {
    position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.white,
  },
  heroInfo: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  xpTrack: { height: 12, borderRadius: 6, backgroundColor: '#E4DBFF', overflow: 'hidden', marginTop: 4 },
  xpFill: { height: 12, borderRadius: 6 },
  levelXp: { alignSelf: 'flex-end', marginTop: 3 },

  // Stats
  section: { marginTop: spacing.xxl },
  planCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full,
  },
  planUsage: { marginTop: spacing.md, gap: spacing.sm },
  usageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  usageTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  usageFill: { height: 6, borderRadius: 3 },
  joinEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md,
  },
  classRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  classIcon: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  statsCard: {
    flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.sm, marginTop: spacing.xl, ...(elevation.md as object),
  },
  statCell: { flex: 1, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: 4, alignItems: 'center', gap: 4 },
  statIcon: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', ...(elevation.sm as object) },
  statValue: { marginTop: 2 },

  // Achievements
  achRow: { gap: spacing.md, paddingRight: spacing.lg, paddingVertical: spacing.xs },
  achItem: { alignItems: 'center', width: 84 },
  achBadge: { width: 74, height: 74, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  achEarned: { borderWidth: 1, borderColor: 'rgba(124,77,255,0.15)', ...(elevation.sm as object) },
  achLocked: { backgroundColor: colors.surfaceAlt },
  achLabel: { marginTop: spacing.sm },

  // Quick menu
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  quickItem: {
    width: '23%', aspectRatio: 0.86, backgroundColor: colors.surface, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: 2,
    ...(elevation.sm as object),
  },
  quickIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { marginTop: 2 },

  // Premium
  premium: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xxl, overflow: 'hidden',
    ...PURPLE_SHADOW, shadowOpacity: 0.3,
  },
  premGlow: { position: 'absolute', top: -40, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)' },
  premiumTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crown: { fontSize: 18 },
  premiumSub: { marginTop: 4, marginBottom: spacing.md },
  premiumBtn: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg },
  treasure: { fontSize: 52 },

  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl },

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
