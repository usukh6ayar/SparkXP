import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import {
  getReadingPassage,
  completeReading,
  type ReadingPassage,
} from '../../src/api/reading';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { TappableText } from '../../src/components/DictionaryProvider';
import { Card } from '../../src/components/Card';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { ReadingQuiz } from '../../src/components/ReadingQuiz';
import { t } from '../../src/i18n';
import { spacing, radius, levelColor, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

function fmtTime(sec: number): string {
  if (!sec) return '';
  const m = Math.round(sec / 60);
  return m > 0 ? `${m} ${t('unitMin')}` : `${sec}${t('unitSec')}`;
}

// Reading-body font size steps (base `body` variant is 15/22 — see theme.ts).
const BODY_FONT_SIZES = [13, 15, 17, 19, 21, 23];
const DEFAULT_FONT_INDEX = BODY_FONT_SIZES.indexOf(15);

/**
 * Reading passage reader. Shows the admin-authored passage (cover, metadata,
 * key vocabulary, text). Tap-to-guess (Phase 2) and sentence audio / shadow
 * reading (Phase 3) hook in here later.
 */
export default function ReadingDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [done, setDone] = useState(false);
  const [fontIndex, setFontIndex] = useState(DEFAULT_FONT_INDEX);

  const finish = useCallback(async () => {
    if (!token || !id || done) return;
    try {
      await completeReading(id, token);
    } catch {
      // ignore — still show as done locally
    } finally {
      setDone(true);
    }
  }, [token, id, done]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setPassage(await getReadingPassage(id, token));
      setError(false);
      setNotFound(false);
    } catch (e) {
      console.warn('Passage load failed:', (e as Error)?.message ?? e);
      setPassage(null);
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true);
        setError(false);
      } else {
        setError(true);
        setNotFound(false);
      }
    }
  }, [token, id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const lvl = passage ? levelColor[passage.cefr] ?? levelColor.a1 : levelColor.a1;
  const time = passage ? fmtTime(passage.estimatedReadingTime) : '';
  const bodyFontSize = BODY_FONT_SIZES[fontIndex];
  const bodyTextStyle = { fontSize: bodyFontSize, lineHeight: Math.round(bodyFontSize * 1.45) };
  const canShrink = fontIndex > 0;
  const canGrow = fontIndex < BODY_FONT_SIZES.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('reading')} back showBadges={false} />
      {loading ? (
        <View style={styles.container}>
          <Skeleton height={180} radius={radius.xl} style={{ marginBottom: spacing.lg }} />
          <Skeleton height={26} width="70%" style={{ marginBottom: spacing.sm }} />
          <View style={styles.metaRow}>
            <Skeleton width={60} height={20} radius={radius.full} />
            <Skeleton width={80} height={20} radius={radius.full} />
            <Skeleton width={70} height={20} radius={radius.full} />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} width="85%" />
            <Skeleton height={16} width="60%" />
          </View>
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: load }}
          style={styles.empty}
        />
      ) : notFound || !passage ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('passageNotFound')}
          style={styles.empty}
        />
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
            {passage.category ? <Meta icon="pricetag-outline" text={passage.category} /> : null}
            <Meta icon="document-text-outline" text={`${passage.wordCount} ${t('unitWords')}`} />
            {time ? <Meta icon="time-outline" text={time} /> : null}
            <Meta icon="list-outline" text={`${passage.sentences.length} ${t('unitSentences')}`} />
          </View>

          {/* Key vocabulary */}
          {passage.keyVocab?.length > 0 && (
            <View style={styles.section}>
              <AppText variant="h3" style={styles.sectionTitle}>
                {t('keyVocabulary')}
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

          {/* Font size control — sits right above the passage container. */}
          <View style={styles.fontRow}>
            <AppText variant="caption" color={colors.textMuted}>
              {t('textSize')}
            </AppText>
            <View style={styles.fontControls}>
              <Pressable
                onPress={() => setFontIndex((i) => Math.max(0, i - 1))}
                disabled={!canShrink}
                hitSlop={8}
                style={styles.fontBtn}
              >
                <AppText
                  variant="label"
                  color={canShrink ? colors.primary : colors.textMuted}
                  style={styles.fontBtnTextSmall}
                >
                  A
                </AppText>
              </Pressable>
              <View style={styles.fontDivider} />
              <Pressable
                onPress={() => setFontIndex((i) => Math.min(BODY_FONT_SIZES.length - 1, i + 1))}
                disabled={!canGrow}
                hitSlop={8}
                style={styles.fontBtn}
              >
                <AppText
                  variant="label"
                  color={canGrow ? colors.primary : colors.textMuted}
                  style={styles.fontBtnTextLarge}
                >
                  A
                </AppText>
              </Pressable>
            </View>
          </View>

          {/* Passage body — double-tap a word → meaning popover
              (Word DB → translation cache → Gemini). */}
          <Card variant="filled" style={styles.body}>
            {passage.sentences.map((s, i) => (
              <TappableText key={i} variant="body" style={bodyTextStyle}>
                {s.text}
              </TappableText>
            ))}
          </Card>
          <AppText variant="caption" color={colors.textMuted} style={styles.hint}>
            {t('tapWordHint')}
          </AppText>

          <Pressable
            onPress={finish}
            disabled={done}
            style={({ pressed }) => [
              styles.finishBtn,
              done && styles.finishBtnDone,
              pressed && !done && { opacity: 0.9 },
            ]}
          >
            <Ionicons
              name={done ? 'checkmark-circle' : 'checkmark-done'}
              size={20}
              color={colors.white}
            />
            <AppText variant="bodyStrong" color={colors.white}>
              {done ? t('readingDone') : t('readingFinish')}
            </AppText>
          </Pressable>

          {/* After finishing, show comprehension questions (AI-authored). */}
          {done && passage.comprehensionQuestions?.length > 0 && (
            <ReadingQuiz questions={passage.comprehensionQuestions} />
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
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

  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
  },
  fontBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  fontDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.border },
  fontBtnTextSmall: { fontSize: 13 },
  fontBtnTextLarge: { fontSize: 19 },

  body: { gap: spacing.sm },
  hint: { marginTop: spacing.md, textAlign: 'center' },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  finishBtnDone: { backgroundColor: colors.success },

  empty: { marginTop: spacing.xxl },
});
