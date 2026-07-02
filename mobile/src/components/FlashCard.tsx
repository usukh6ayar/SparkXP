import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { AppImage } from './AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { AppText } from './Text';
import { t } from '../i18n';
import type { LearnWord } from '../api/reviews';
import { colors, spacing, radius } from '../theme/theme';

export type MemoryStatus = 'new' | 'learning' | 'mastered';

const MEMORY: Record<MemoryStatus, { color: string; label: Parameters<typeof t>[0] }> = {
  mastered: { color: colors.success, label: 'memMastered' },
  learning: { color: colors.xp, label: 'memLearning' },
  new: { color: colors.danger, label: 'memNew' },
};

interface Props {
  word: LearnWord;
  /** 0 = front, 1 = back (owned by the screen so navigation can reset it). */
  spin: SharedValue<number>;
  speaking: boolean;
  saved: boolean;
  memory: MemoryStatus;
  onToggleSave: () => void;
  onPlayAudio: () => void;
}

/**
 * Premium vocabulary flashcard with a 3D Y-axis flip.
 * - FRONT: image, word, part-of-speech, IPA, speaker (no translation).
 * - BACK:  translation, definition, highlighted example, difficulty badge.
 * Purely presentational — tap/swipe/long-press gestures live in the screen.
 */
export function FlashCard({ word, spin, speaking, saved, memory, onToggleSave, onPlayAudio }: Props) {
  // Crossfade the faces at the 90° midpoint so mirrored text never shows.
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(spin.value, [0, 1], [0, 180])}deg` }],
    opacity: interpolate(spin.value, [0, 0.5, 0.5, 1], [1, 1, 0, 0], Extrapolation.CLAMP),
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(spin.value, [0, 1], [180, 360])}deg` }],
    opacity: interpolate(spin.value, [0, 0.5, 0.5, 1], [0, 0, 1, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.face, frontStyle]}>
        <FrontFace
          word={word}
          speaking={speaking}
          saved={saved}
          memory={memory}
          onToggleSave={onToggleSave}
          onPlayAudio={onPlayAudio}
        />
      </Animated.View>
      <Animated.View style={[styles.face, backStyle]}>
        <BackFace word={word} />
      </Animated.View>
    </View>
  );
}

/* ── Front ──────────────────────────────────────────────────────────────── */
function FrontFace({
  word,
  speaking,
  saved,
  memory,
  onToggleSave,
  onPlayAudio,
}: Pick<Props, 'word' | 'speaking' | 'saved' | 'memory' | 'onToggleSave' | 'onPlayAudio'>) {
  const mem = MEMORY[memory];
  return (
    <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.faceBg}>
      {/* Image */}
      <View style={styles.imageWrap}>
        {word.imageUrl ? (
          <AppImage source={{ uri: word.imageUrl }} width={600} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <AppText style={styles.placeholderText}>{word.english.charAt(0).toUpperCase()}</AppText>
          </View>
        )}

        {/* difficulty + memory (top-left) */}
        <View style={styles.topLeft}>
          <View style={styles.badge}>
            <AppText variant="label" color={colors.white}>{word.level?.toUpperCase()}</AppText>
          </View>
          <View style={[styles.badge, styles.memBadge]}>
            <View style={[styles.memDot, { backgroundColor: mem.color }]} />
            <AppText variant="label" color={colors.white}>{t(mem.label)}</AppText>
          </View>
        </View>

        {/* favorite (top-right) */}
        <Pressable onPress={onToggleSave} hitSlop={10} style={styles.heart}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? colors.danger : colors.white} />
        </Pressable>

        {/* category (bottom-left) */}
        {word.category ? (
          <View style={styles.catBadge}>
            <Ionicons name="pricetag" size={12} color={colors.white} />
            <AppText variant="label" color={colors.white}>{word.category}</AppText>
          </View>
        ) : null}
      </View>

      {/* Word */}
      <View style={styles.frontBody}>
        <AppText style={styles.word} numberOfLines={1} adjustsFontSizeToFit>{word.english}</AppText>
        <View style={styles.metaRow}>
          {word.phonetic ? <AppText style={styles.phonetic}>{word.phonetic}</AppText> : null}
          {word.partOfSpeech ? (
            <View style={styles.posPill}>
              <AppText variant="label" color={colors.textOnDarkMuted}>{word.partOfSpeech}</AppText>
            </View>
          ) : null}
        </View>

        <SpeakerButton speaking={speaking} onPress={onPlayAudio} />
        <AppText variant="caption" color={colors.textOnDarkMuted} style={styles.flipHint}>
          {t('flipHint')}
        </AppText>
      </View>
    </LinearGradient>
  );
}

/* ── Back ───────────────────────────────────────────────────────────────── */
function BackFace({ word }: { word: LearnWord }) {
  return (
    <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.faceBg}>
      <View style={styles.backBody}>
        <View style={styles.backTop}>
          <AppText variant="overline" color={colors.textOnDarkMuted}>{word.english}</AppText>
          <View style={styles.badge}>
            <AppText variant="label" color={colors.white}>{word.level?.toUpperCase()}</AppText>
          </View>
        </View>

        {/* Mongolian translation */}
        <AppText style={styles.translation} numberOfLines={2} adjustsFontSizeToFit>{word.mongolian}</AppText>

        {/* English definition */}
        {word.englishDefinition ? (
          <AppText style={styles.definition}>{word.englishDefinition}</AppText>
        ) : null}

        {/* Example with the vocab highlighted */}
        {word.exampleSentence ? (
          <View style={styles.glassPanel}>
            <View style={styles.panelHead}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textOnDark} />
              <AppText variant="label" color={colors.textOnDark}>{t('example')}</AppText>
            </View>
            <Highlighted sentence={word.exampleSentence} word={word.english} />
            {word.exampleTranslation ? (
              <AppText style={styles.exampleMn}>{word.exampleTranslation}</AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

/** Renders a sentence with the target word highlighted in gold. */
function Highlighted({ sentence, word }: { sentence: string; word: string }) {
  const idx = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (idx < 0) return <AppText style={styles.exampleEn}>{sentence}</AppText>;
  return (
    <AppText style={styles.exampleEn}>
      {sentence.slice(0, idx)}
      <AppText style={styles.highlight}>{sentence.slice(idx, idx + word.length)}</AppText>
      {sentence.slice(idx + word.length)}
    </AppText>
  );
}

/** Speaker button that pulses while audio is playing. */
function SpeakerButton({ speaking, onPress }: { speaking: boolean; onPress: () => void }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (speaking) {
      pulse.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 150 });
    }
  }, [speaking, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.6]) }],
  }));

  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.speaker}>
      <Animated.View style={[styles.speakerRing, ringStyle]} />
      <Ionicons name="volume-high" size={24} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  face: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    // Soft violet glow lift.
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  faceBg: { flex: 1, borderRadius: 30 },

  // Front — image (large, only a thin frame around it)
  imageWrap: { height: '62%', margin: 4, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  placeholderText: { fontSize: 72, fontWeight: '800', color: 'rgba(255,255,255,0.5)' },
  topLeft: { position: 'absolute', top: spacing.md, left: spacing.md, gap: 6, alignItems: 'flex-start' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(15,10,40,0.55)', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
  },
  memBadge: {},
  memDot: { width: 8, height: 8, borderRadius: 4 },
  heart: {
    position: 'absolute', top: spacing.md, right: spacing.md,
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: 'rgba(15,10,40,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  catBadge: {
    position: 'absolute', bottom: spacing.md, left: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(15,10,40,0.55)', paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
  },

  // Front — word block
  frontBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  word: { fontSize: 40, lineHeight: 46, fontWeight: '800', color: colors.white, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  phonetic: { fontSize: 17, color: colors.textOnDarkMuted },
  posPill: {
    backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
  speaker: {
    marginTop: spacing.sm, width: 58, height: 58, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  speakerRing: { ...StyleSheet.absoluteFillObject, borderRadius: radius.full, backgroundColor: colors.white },
  flipHint: { marginTop: spacing.xs },

  // Back
  backBody: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
  backTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  translation: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.white },
  definition: { fontSize: 16, lineHeight: 23, color: colors.textOnDarkMuted },
  glassPanel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exampleEn: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.white },
  highlight: { color: colors.xp, fontWeight: '800' },
  exampleMn: { fontSize: 14, lineHeight: 20, color: colors.textOnDarkMuted },
});
