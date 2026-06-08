import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { apiRequest } from '../../src/api/client';
import { TopBar } from '../../src/components/TopBar';
import { Pill } from '../../src/components/Pill';
import { Loading } from '../../src/components/Loading';
import { colors, spacing, radius, fontSize, levelColor, tints } from '../../src/theme/theme';

interface LessonItem {
  id: string;
  title: string;
  description: string | null;
  level: string;
  priceSparks: number;
}

const THUMBS = ['🦊', '🥗', '✈️', '🏠', '🕐', '🎒', '🏙️', '👨‍👩‍👧'];
const TINT_LIST = [tints.green, tints.amber, tints.blue, tints.purple, tints.pink, tints.teal];

export default function LessonsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ items: LessonItem[] }>('/lessons?limit=50', { token })
      .then((r) => setLessons(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="Хичээлүүд" back streak={5} />
      <ScrollView contentContainerStyle={styles.container}>
        {lessons.map((l, i) => {
          const locked = l.priceSparks > 0;
          const lvl = levelColor[l.level] ?? levelColor.a1;
          const tint = TINT_LIST[i % TINT_LIST.length];
          return (
            <Pressable
              key={l.id}
              style={styles.card}
              onPress={() => router.push(`/lesson/${l.id}`)}
            >
              <View style={[styles.thumb, { backgroundColor: tint.bg }]}>
                <Text style={styles.thumbEmoji}>{THUMBS[i % THUMBS.length]}</Text>
                <View style={styles.numBadge}>
                  <Text style={styles.numText}>{i + 1}</Text>
                </View>
              </View>

              <View style={styles.info}>
                <Text style={styles.cardTitle}>{l.title}</Text>
                {l.description ? (
                  <Text style={styles.cardSub} numberOfLines={1}>{l.description}</Text>
                ) : null}
                <Pill label={l.level.toUpperCase()} bg={lvl.bg} fg={lvl.fg} />
              </View>

              <View style={styles.right}>
                {locked ? (
                  <>
                    <Text style={styles.lock}>🔒</Text>
                    <View style={styles.priceTag}>
                      <Text style={styles.priceText}>✨ {l.priceSparks}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.chev}>›</Text>
                )}
              </View>
            </Pressable>
          );
        })}
        {lessons.length === 0 ? (
          <Text style={styles.empty}>Хичээл алга. Admin-аас нэмнэ.</Text>
        ) : null}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 30 },
  numBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  numText: { color: colors.white, fontWeight: '800', fontSize: fontSize.xs },
  info: { flex: 1, gap: 4 },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.navy },
  cardSub: { fontSize: fontSize.sm, color: colors.textMuted },
  right: { alignItems: 'center', gap: 4 },
  lock: { fontSize: fontSize.lg },
  priceTag: {
    backgroundColor: colors.cream,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  priceText: { fontSize: fontSize.xs, fontWeight: '800', color: colors.sparks },
  chev: { fontSize: 28, color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});
