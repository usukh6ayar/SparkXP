import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppImage } from '../../src/components/AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { PagedReader } from '../../src/components/reading/PagedReader';
import { useDictionary } from '../../src/components/DictionaryProvider';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { ReadingQuiz } from '../../src/components/ReadingQuiz';
import { CelebrationScreen } from '../../src/components/celebration/CelebrationScreen';
import { celebrationCopy } from '../../src/components/celebration/copy';
import { AwardBadge } from '../../src/components/AwardBadge';
import { haptics } from '../../src/lib/haptics';
import { DURATION } from '../../src/lib/motion';
import { useReadAlong } from '../../src/lib/useReadAlong';
import { markReadingCompleted } from '../../src/lib/readingProgress';
import { t } from '../../src/i18n';
import { spacing, radius, levelColor, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';
import { bounded } from '../../src/theme/responsive';
import { checkCelebrations } from '../../src/lib/useCelebrations';

// Reading-body font size steps. The default is deliberately larger than the
// `body` variant (15/22): passages are long, and a comfortable reading size —
// not the UI's label size — is what keeps a reader scrolling to the end.
const BODY_FONT_SIZES = [16, 18, 20, 22, 25, 28];
const DEFAULT_FONT_INDEX = BODY_FONT_SIZES.indexOf(20);

/**
 * Reading passage reader. Shows the admin-authored passage (cover, metadata,
 * key vocabulary, text), with double-tap-to-translate and — when the admin has
 * generated per-sentence audio — read-along playback that highlights the
 * sentence being spoken (`useReadAlong`).
 *
 * XP is gated on the comprehension test, not on the reading: "Уншсан" only
 * marks the passage read (and reveals the test), and the XP lands once the
 * reader passes the questions the admin authored.
 *
 * ⚠️ A passage the admin authored NO questions for therefore earns nothing and
 * never reaches the celebration — `markRead` deliberately pays out nothing, so
 * that no button anywhere hands out XP for scrolling to the bottom. (An older
 * comment here claimed such passages "fall back to awarding on read"; the code
 * never did that, and the anti-abuse rule is the one to keep.) Admin has to
 * author the questions — see ROADMAP.
 */
export default function ReadingDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { lookup } = useDictionary();
  const insets = useSafeAreaInsets();
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  /** The reader pressed "Уншсан" — no XP yet, but the test is now open. */
  const [markedRead, setMarkedRead] = useState(false);
  /** XP awarded (the passage is complete). */
  const [done, setDone] = useState(false);
  /** The full-screen celebration is up, and the XP it announces. */
  const [celebrating, setCelebrating] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [fontIndex, setFontIndex] = useState(DEFAULT_FONT_INDEX);

  // Reading progress (0..1) → thin bar under the top bar. It tracks PAGES, not
  // scroll: the passage is paginated, so the outer scroll barely moves and
  // would report almost nothing.
  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  // Page count drives whether the bar is drawn at all: a one-page passage has
  // no progress to show, and a bar pinned at 100% just reads as a stray divider
  // between the back button and the cover.
  const [pageCount, setPageCount] = useState(1);
  const onPageChange = useCallback(
    (page: number, total: number) => {
      setPageCount(total);
      progress.value = withTiming(total > 1 ? page / (total - 1) : 0, {
        duration: DURATION.fast,
      });
    },
    [progress],
  );

  // The page window: tall enough to read in, short enough that the cover and
  // the "Уншсан" button stay one small scroll away.
  const { height: screenH } = useWindowDimensions();
  const pageHeight = Math.max(300, Math.round(screenH * 0.52));
  const scrollRef = useRef<ScrollView>(null);

  // Read-along ("аудио дагаж унших"). Stable array identity so the hook's
  // callbacks don't rebuild on every render.
  const sentences = useMemo(() => passage?.sentences ?? [], [passage]);
  const read = useReadAlong(sentences);

  /** Award the reading XP. The comprehension test is the ONLY caller. */
  const award = useCallback(async () => {
    if (!token || !id || done) return;
    try {
      // The server owns the number: a re-read pays 0, and the celebration must
      // never announce XP the student did not actually get.
      const res = await completeReading(id, token);
      setEarnedXp(res.xpAwarded);
    } catch {
      // ignore — still show as done locally
    } finally {
      markReadingCompleted(id); // local mirror → checkmark on the list
      setDone(true);
      setCelebrating(true); // full-screen celebration over a rotating scene
      // The trophy/streak check runs only once the celebration is dismissed —
      // two modals stacked on each other is a worse moment than either alone.
    }
  }, [token, id, done]);

  /** Dismissing the celebration is what releases any queued trophy or streak. */
  const closeCelebration = useCallback(() => {
    setCelebrating(false);
    checkCelebrations();
  }, []);

  const hasQuiz = (passage?.comprehensionQuestions?.length ?? 0) > 0;

  /**
   * "Уншсан" — a marker, never a payout. XP comes from the test only, so a
   * passage the admin authored no questions for simply earns none; there is no
   * button anywhere that hands out XP for scrolling to the bottom.
   */
  const markRead = useCallback(() => {
    haptics.tap();
    markReadingCompleted(id); // local mirror → checkmark on the list
    setMarkedRead(true);
    // The test mounts below the fold — without this the button looks like it
    // did nothing. One frame for the questions to lay out, then scroll to them.
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 260);
  }, [id]);

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
  const bodyFontSize = BODY_FONT_SIZES[fontIndex];
  // 1.6 leading: long passages need more air between lines than UI copy does,
  // otherwise the eye loses its place halfway down a scroll.
  const bodyTextStyle = { fontSize: bodyFontSize, lineHeight: Math.round(bodyFontSize * 1.6) };
  const canShrink = fontIndex > 0;
  const canGrow = fontIndex < BODY_FONT_SIZES.length - 1;

  // Whole passage as one string for the selectable reader, plus each sentence's
  // character range inside it — that range is what the read-along highlights.
  const { passageText, ranges } = useMemo(() => {
    let at = 0;
    const bounds = (passage?.sentences ?? []).map((s) => {
      const from = at;
      at += s.text.length + 1; // +1 for the joining space
      return { from, to: from + s.text.length };
    });
    return {
      passageText: (passage?.sentences ?? []).map((s) => s.text).join(' '),
      ranges: bounds,
    };
  }, [passage]);

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
        <>
        {/* Reading progress — fills as the reader turns pages. Only drawn when
            there is more than one page (see `pageCount`). */}
        {pageCount > 1 ? (
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressStyle]} />
          </View>
        ) : null}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.container, bounded]}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover — the title and its meta ride ON the image under a scrim,
              so the passage starts near the top of the screen instead of after
              three stacked blocks (image → title → meta). */}
          <View style={styles.cover}>
            {passage.coverImageUrl ? (
              <AppImage
                source={{ uri: passage.coverImageUrl }}
                width={800}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[colors.success, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {/* Scrim: the title has to stay legible over any admin-uploaded
                photo, bright or dark. */}
            <LinearGradient
              colors={['rgba(10,6,30,0)', 'rgba(10,6,30,0.88)']}
              locations={[0.3, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.coverText}>
              <View style={styles.metaRow}>
                <View style={[styles.levelBadge, { backgroundColor: lvl.fg }]}>
                  <AppText variant="overline" color={colors.white}>
                    {passage.cefr.toUpperCase()}
                  </AppText>
                </View>
                {passage.category ? (
                  <Meta icon="pricetag-outline" text={passage.category} onCover />
                ) : null}
                <Meta
                  icon="document-text-outline"
                  text={`${passage.wordCount} ${t('unitWords')}`}
                  onCover
                />
                <Meta
                  icon="list-outline"
                  text={`${passage.sentences.length} ${t('unitSentences')}`}
                  onCover
                />
              </View>
              <AppText variant="h1" color={colors.white} numberOfLines={3}>
                {passage.title}
              </AppText>
            </View>
          </View>

          {/* Key vocabulary — ONE horizontal line that scrolls sideways. A
              wrapping block ran three or four rows deep and pushed the passage
              itself off the first screen. */}
          {passage.keyVocab?.length > 0 && (
            <View style={styles.section}>
              <AppText variant="caption" color={colors.textMuted} style={styles.vocabHead}>
                {t('keyVocabulary')} · {t('keyVocabTapHint')}
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.vocabRow}
              >
                {/* Tapping a key word opens the same small meaning popover a
                    double-tap inside the passage does — reading is never
                    interrupted by the full dictionary panel. */}
                {passage.keyVocab.map((v, i) => (
                  <Pressable
                    key={`${v.word}-${i}`}
                    onPress={(e) => {
                      haptics.tap();
                      lookup(v.word, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                    }}
                    style={({ pressed }) => [styles.vocabChip, pressed && { opacity: 0.8 }]}
                    accessibilityRole="button"
                  >
                    <AppText variant="label" color={colors.primary}>
                      {v.word}
                    </AppText>
                    <Ionicons name="language-outline" size={13} color={colors.primary} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* THE reading sheet — one big box holding its own controls and the
              whole passage. Its height follows the text, at every level: a
              short A1 story is one screen, a long B2 one scrolls for several,
              on one uninterrupted surface rather than alternating strips of
              chrome and copy. */}
          <View style={styles.sheet}>
            {/* Controls live on the sheet's own header: read-along on the left
                (sentences the admin hasn't voiced fall back to the device
                voice inside `useReadAlong`), text size on the right. */}
            <View style={styles.sheetBar}>
              <Pressable
                onPress={() => { haptics.tap(); read.toggle(); }}
                style={({ pressed }) => [styles.listenBtn, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel={t('readAlong')}
              >
                <Ionicons name={read.playing ? 'pause' : 'play'} size={18} color={colors.white} />
                <AppText variant="label" color={colors.white}>
                  {read.playing ? t('readAlongPause') : t('readAlong')}
                </AppText>
              </Pressable>
              <Pressable onPress={read.prev} hitSlop={8} style={styles.listenSideBtn}>
                <Ionicons name="play-skip-back" size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={read.next} hitSlop={8} style={styles.listenSideBtn}>
                <Ionicons name="play-skip-forward" size={16} color={colors.textSecondary} />
              </Pressable>

              <View style={styles.sheetBarSpacer} />

              <View style={styles.fontControls}>
                <Pressable
                  onPress={() => setFontIndex((i) => Math.max(0, i - 1))}
                  disabled={!canShrink}
                  hitSlop={8}
                  style={styles.fontBtn}
                  accessibilityLabel={t('textSize')}
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
                  accessibilityLabel={t('textSize')}
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

            {/* Passage body — read a page at a time (swipe sideways or use the
                arrows), so a long B2 article never turns into one endless
                scroll. Double-tap a word → meaning popover (Word DB →
                translation cache → Gemini). The spoken sentence is tinted while
                read-along runs, and the reader follows it across pages. */}
            <View style={styles.sheetBody}>
              <PagedReader
                text={passageText}
                textStyle={bodyTextStyle}
                height={pageHeight}
                highlightRange={read.active != null ? ranges[read.active] : null}
                onPageChange={onPageChange}
              />
            </View>
          </View>
          <AppText variant="caption" color={colors.textMuted} style={styles.hint}>
            {t('selectTranslateHint')}
          </AppText>

          {/* Tells the reader where the XP actually comes from — or that this
              passage has no test at all, so an empty space is never left
              unexplained. */}
          {markedRead && !done && (
            <AppText variant="caption" color={colors.textSecondary} center style={styles.gateHint}>
              {hasQuiz ? t('readingQuizGate') : t('readingNoQuiz')}
            </AppText>
          )}

          {/* The comprehension test (authored in admin) — the XP gate. */}
          {markedRead && hasQuiz && (
            <ReadingQuiz questions={passage.comprehensionQuestions} onPass={award} />
          )}

          {/* Celebration banner once the test has paid out. Below the test, so
              it reads as the conclusion of it. */}
          {done && (
            <View style={styles.congrats}>
              <AwardBadge icon="checkmark-done" color={colors.white} bg={colors.success} />
              <AppText variant="h3" color={colors.success} center>{t('readingCongrats')}</AppText>
              <AppText variant="caption" color={colors.textSecondary} center>
                {t('readingCongratsHint')}
              </AppText>
            </View>
          )}

          {/* Clears the pinned call to action below. */}
          <View style={{ height: markedRead ? 60 : 110 }} />
        </ScrollView>

        {/* THE call to action, pinned to the bottom of the screen rather than
            parked under a screenful of passage. Its label says exactly what
            pressing it gets you. It retires once the test is open — from then
            on the test itself is the thing to do. */}
        {!markedRead && (
          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable
              onPress={markRead}
              style={({ pressed }) => [styles.finishBtn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons
                name={hasQuiz ? 'clipboard-outline' : 'checkmark-done'}
                size={20}
                color={colors.white}
              />
              <AppText variant="bodyStrong" color={colors.white}>
                {hasQuiz ? t('readingStartQuiz') : t('readingMarkRead')}
              </AppText>
            </Pressable>
          </View>
        )}
        </>
      )}

      {/* The shared completion celebration — a different world every time (see
          `CelebrationBackground`). Finishing a passage gets exactly the same
          ceremony as finishing a lesson or a quiz, on purpose. */}
      <CelebrationScreen
        visible={celebrating}
        {...celebrationCopy('reading')}
        xp={earnedXp}
        stats={[
          {
            icon: 'document-text-outline',
            label: t('celebrationStatWords'),
            value: String(passage?.wordCount ?? 0),
            color: colors.sparks,
          },
          {
            icon: 'list-outline',
            label: t('celebrationStatSentences'),
            value: String(passage?.sentences.length ?? 0),
            color: colors.success,
          },
          {
            icon: 'flash',
            label: t('celebrationStatXp'),
            value: `+${earnedXp}`,
            color: colors.xp,
          },
        ]}
        primary={{
          label: t('continue'),
          onPress: () => { closeCelebration(); router.back(); },
        }}
        secondary={{ label: t('close'), onPress: closeCelebration }}
      />
    </SafeAreaView>
  );
}

/** One meta fact. `onCover` switches it to light ink for the scrimmed cover. */
function Meta({
  icon,
  text,
  onCover,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onCover?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ink = onCover ? colors.textOnDarkMuted : colors.textMuted;
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={ink} />
      <AppText variant="caption" color={ink}>{text}</AppText>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  // No track colour: a filled 3px bar directly under the header reads as a
  // stray divider line between the back button and the cover before the reader
  // has scrolled. Only the filled part should be visible.
  progressTrack: { height: 3, backgroundColor: 'transparent' },
  progressFill: { height: 3, backgroundColor: colors.primary },

  // `minHeight` (not a fixed aspect ratio) so a long title can push the box
  // taller instead of overflowing the scrim it needs to stay readable on.
  cover: {
    minHeight: 168,
    justifyContent: 'flex-end',
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
  },
  coverText: { padding: spacing.lg, gap: spacing.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levelBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },

  section: { marginBottom: spacing.md },
  vocabHead: { marginBottom: spacing.sm },
  vocabRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  vocabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },

  // The reading sheet: controls and passage on ONE surface. `overflow: hidden`
  // keeps the header's hairline inside the rounded corners.
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetBarSpacer: { flex: 1 },
  // Generous margins: at B1/B2 this box holds several screens of text, so it
  // has to read like a page, not a card.
  sheetBody: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },

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

  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  listenSideBtn: {
    padding: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },

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
  // Pinned over the scroll, separated from it by a hairline.
  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  gateHint: { marginTop: spacing.lg },
  congrats: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },

  empty: { marginTop: spacing.xxl },
});
