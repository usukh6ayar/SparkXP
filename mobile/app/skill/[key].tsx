import { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getLessons, type Lesson } from '../../src/api/lessons';
import { getReadingList, type ReadingPassage } from '../../src/api/reading';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { Loading } from '../../src/components/Loading';
import { getSkill } from '../../src/constants/skills';
import { colors, spacing, radius, levelColor } from '../../src/theme/theme';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Short Mongolian subtitle per skill, shown in the hero. */
const SUBTITLE: Record<string, string> = {
  listening: 'Сонсож ойлгох дасгалууд',
  reading: 'Уншиж ойлгох материалууд',
  fill: 'Зай нөхөх дасгалууд',
  writing: 'Бичих чадварын дасгалууд',
  grammar: 'Дүрмийн хичээлүүд',
  vocabulary: 'Үгсийн сангийн хичээлүүд',
};

/** Format seconds as a short "Xм" / "Yс" label. */
function fmtTime(sec: number): string {
  if (!sec) return '';
  const m = Math.round(sec / 60);
  return m > 0 ? `${m} мин` : `${sec}с`;
}

/**
 * One screen per learning skill (Сонсгол / Унших / Нөхөх / Бичих). Reached from
 * the Home skill tiles via /skill/<key> — a dedicated screen instead of hijacking
 * the Хичээл tab.
 *
 * Reading pulls real passages from /api/reading (authored in admin); the other
 * skills list lessons of that `type`.
 */
export default function SkillScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const skillKey = key ?? 'reading';
  const isReading = skillKey === 'reading';
  const skill = getSkill(skillKey);
  const { token } = useAuth();
  const router = useRouter();

  const [level, setLevel] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      if (isReading) {
        const r = await getReadingList(token, level ? { cefr: level } : undefined);
        setPassages(r.items);
      } else {
        const r = await getLessons(token, {
          type: skillKey,
          ...(level ? { level: level.toLowerCase() } : {}),
        });
        setLessons(r.items);
      }
    } catch (e) {
      console.warn('Skill load failed:', (e as Error)?.message ?? e);
      if (isReading) setPassages([]);
      else setLessons([]);
    }
  }, [token, isReading, skillKey, level]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const count = isReading ? passages.length : lessons.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={skill.label} back />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Skill hero */}
        <LinearGradient
          colors={[skill.tint.fg, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Ionicons name={skill.icon} size={26} color={skill.tint.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h2" color={colors.white}>
              {skill.label}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">
              {SUBTITLE[skillKey] ?? ''}
            </AppText>
          </View>
          <View style={styles.heroCount}>
            <AppText variant="h2" color={colors.white}>
              {count}
            </AppText>
            <AppText variant="overline" color="rgba(255,255,255,0.85)">
              {isReading ? 'МАТЕРИАЛ' : 'ХИЧЭЭЛ'}
            </AppText>
          </View>
        </LinearGradient>

        {/* Level filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Chip label="Бүх түвшин" active={level === null} onPress={() => setLevel(null)} />
          {LEVELS.map((lv) => (
            <Chip key={lv} label={lv} active={level === lv} onPress={() => setLevel(lv)} />
          ))}
        </ScrollView>

        {loading ? (
          <Loading />
        ) : count === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            {isReading ? 'Энд унших материал алга байна 🦊' : 'Энэ төрлийн хичээл алга 🦊'}
          </AppText>
        ) : isReading ? (
          passages.map((p) => (
            <PassageRow key={p.id} passage={p} onPress={() => router.push(`/reading/${p.id}`)} />
          ))
        ) : (
          lessons.map((l) => (
            <LessonRow
              key={l.id}
              lesson={l}
              skillIcon={skill.icon}
              onPress={() => router.push(`/lesson/${l.id}`)}
            />
          ))
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <AppText variant="label" color={active ? colors.white : colors.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A reading passage list row. */
function PassageRow({ passage, onPress }: { passage: ReadingPassage; onPress: () => void }) {
  const lvl = levelColor[passage.cefr] ?? levelColor.a1;
  const time = fmtTime(passage.estimatedReadingTime);
  return (
    <Card variant="raised" onPress={onPress} padding="md" style={styles.row}>
      {passage.coverImageUrl ? (
        <Image source={{ uri: passage.coverImageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name="book" size={22} color={colors.primary} />
        </View>
      )}
      <View style={styles.rowBody}>
        <AppText variant="h3" numberOfLines={2}>
          {passage.title}
        </AppText>
        <View style={styles.metaRow}>
          <View style={[styles.levelBadge, { backgroundColor: lvl.fg }]}>
            <AppText variant="overline" color={colors.white}>
              {passage.cefr.toUpperCase()}
            </AppText>
          </View>
          <Meta icon="document-text-outline" text={`${passage.wordCount} үг`} />
          {time ? <Meta icon="time-outline" text={time} /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
    </Card>
  );
}

/** A lesson list row (listening / fill / writing / grammar...). */
function LessonRow({
  lesson,
  skillIcon,
  onPress,
}: {
  lesson: Lesson;
  skillIcon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const lvl = levelColor[lesson.level] ?? levelColor.a1;
  return (
    <Card variant="raised" onPress={onPress} padding="md" style={styles.row}>
      {lesson.thumbnailUrl ? (
        <Image source={{ uri: lesson.thumbnailUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons name={skillIcon} size={22} color={colors.primary} />
        </View>
      )}
      <View style={styles.rowBody}>
        <AppText variant="h3" numberOfLines={2}>
          {lesson.title}
        </AppText>
        <View style={styles.metaRow}>
          <View style={[styles.levelBadge, { backgroundColor: lvl.fg }]}>
            <AppText variant="overline" color={colors.white}>
              {lesson.level.toUpperCase()}
            </AppText>
          </View>
          {lesson.priceSparks > 0 ? (
            <Meta icon="diamond" text={`${lesson.priceSparks}`} />
          ) : (
            <AppText variant="caption" color={colors.success}>
              Үнэгүй
            </AppText>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCount: { alignItems: 'center' },

  filterRow: { gap: spacing.sm, paddingBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  rowBody: { flex: 1, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  levelBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },

  empty: { marginTop: spacing.xxl },
});
