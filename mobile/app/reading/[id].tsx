import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getReadingPassage, type ReadingPassage } from '../../src/api/reading';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { Loading } from '../../src/components/Loading';
import { colors, spacing, radius, levelColor } from '../../src/theme/theme';

function fmtTime(sec: number): string {
  if (!sec) return '';
  const m = Math.round(sec / 60);
  return m > 0 ? `${m} мин` : `${sec}с`;
}

/**
 * Reading passage reader. Shows the admin-authored passage (cover, metadata,
 * key vocabulary, text). Tap-to-guess (Phase 2) and sentence audio / shadow
 * reading (Phase 3) hook in here later.
 */
export default function ReadingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setPassage(await getReadingPassage(id, token));
    } catch (e) {
      console.warn('Passage load failed:', (e as Error)?.message ?? e);
      setPassage(null);
    }
  }, [token, id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const lvl = passage ? levelColor[passage.cefr] ?? levelColor.a1 : levelColor.a1;
  const time = passage ? fmtTime(passage.estimatedReadingTime) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="Унших" back showBadges={false} />
      {loading ? (
        <Loading />
      ) : !passage ? (
        <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
          Материал олдсонгүй 🦊
        </AppText>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover */}
          <View style={styles.cover}>
            {passage.coverImageUrl ? (
              <Image
                source={{ uri: passage.coverImageUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={[colors.success, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              >
                <Ionicons
                  name="book"
                  size={80}
                  color="rgba(255,255,255,0.2)"
                  style={styles.coverIcon}
                />
              </LinearGradient>
            )}
          </View>

          <AppText variant="h1" style={styles.title}>
            {passage.title}
          </AppText>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={[styles.levelBadge, { backgroundColor: lvl.fg }]}>
              <AppText variant="overline" color={colors.white}>
                {passage.cefr.toUpperCase()}
              </AppText>
            </View>
            <Meta icon="document-text-outline" text={`${passage.wordCount} үг`} />
            {time ? <Meta icon="time-outline" text={time} /> : null}
            <Meta icon="list-outline" text={`${passage.sentences.length} өгүүлбэр`} />
          </View>

          {/* Key vocabulary */}
          {passage.keyVocab?.length > 0 && (
            <View style={styles.section}>
              <AppText variant="h3" style={styles.sectionTitle}>
                Гол үгс
              </AppText>
              <View style={styles.vocabWrap}>
                {passage.keyVocab.map((v, i) => (
                  <View key={`${v.word}-${i}`} style={styles.vocabChip}>
                    <AppText variant="label" color={colors.primary}>
                      {v.word}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Passage body */}
          <Card variant="filled" style={styles.body}>
            {passage.sentences.map((s, i) => (
              <AppText key={i} variant="body" style={styles.sentence}>
                {s.text}
              </AppText>
            ))}
          </Card>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  cover: {
    height: 180,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.lg,
  },
  coverIcon: { position: 'absolute', right: 18, bottom: 14 },

  title: { marginBottom: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levelBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },

  section: { marginBottom: spacing.lg },
  sectionTitle: { marginBottom: spacing.sm },
  vocabWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vocabChip: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },

  body: { gap: spacing.sm },
  sentence: { lineHeight: 26 },

  empty: { marginTop: spacing.xxl },
});
