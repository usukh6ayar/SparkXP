import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { apiRequest } from '../../src/api/client';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { Pill } from '../../src/components/Pill';
import { Loading } from '../../src/components/Loading';
import { colors, spacing, radius, levelColor, tints } from '../../src/theme/theme';

interface LessonItem {
  id: string;
  title: string;
  description: string | null;
  level: string;
  priceSparks: number;
}

const TINT_LIST = [tints.green, tints.amber, tints.blue, tints.purple, tints.pink, tints.teal];

/** Скилл төрлийн нэр (Home grid-ээс ирэх `type` param). */
const TYPE_LABEL: Record<string, string> = {
  listening: 'Сонсгол',
  reading: 'Унших',
  fill: 'Нөхөх',
  writing: 'Бичих',
  grammar: 'Дүрэм',
  vocabulary: 'Үгсийн сан',
};

export default function LessonsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ limit: '50', isPublished: 'true' });
    if (type) q.set('type', type);
    apiRequest<{ items: LessonItem[] }>(`/lessons?${q}`, { token })
      .then((r) => setLessons(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, type]);

  if (loading) return <Loading />;

  const title = type ? TYPE_LABEL[type] ?? 'Хичээлүүд' : 'Хичээлүүд';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={title} back />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {lessons.map((l, i) => {
          const locked = l.priceSparks > 0;
          const lvl = levelColor[l.level] ?? levelColor.a1;
          const tint = TINT_LIST[i % TINT_LIST.length];
          return (
            <Card key={l.id} onPress={() => router.push(`/lesson/${l.id}`)} padding="md" style={styles.card}>
              <View style={[styles.thumb, { backgroundColor: tint.bg }]}>
                <AppText variant="h2" color={tint.fg}>{i + 1}</AppText>
              </View>

              <View style={styles.info}>
                <AppText variant="h3" numberOfLines={1}>{l.title}</AppText>
                {l.description ? (
                  <AppText variant="caption" numberOfLines={1} style={styles.desc}>{l.description}</AppText>
                ) : null}
                <View style={styles.meta}>
                  <Pill label={l.level.toUpperCase()} bg={lvl.bg} fg={lvl.fg} />
                  {locked ? (
                    <Pill label={String(l.priceSparks)} icon="sparkles" bg={colors.cream} fg={colors.sparks} />
                  ) : (
                    <Pill label="Үнэгүй" bg={colors.successSoft} fg={colors.success} />
                  )}
                </View>
              </View>

              <Ionicons
                name={locked ? 'lock-closed' : 'chevron-forward'}
                size={18}
                color={locked ? colors.textMuted : colors.borderStrong}
              />
            </Card>
          );
        })}
        {lessons.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            Хичээл алга. Admin-аас нэмнэ.
          </AppText>
        ) : null}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  thumb: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4 },
  desc: { marginBottom: 2 },
  meta: { flexDirection: 'row', gap: spacing.xs },
  empty: { marginTop: spacing.xxl },
});
