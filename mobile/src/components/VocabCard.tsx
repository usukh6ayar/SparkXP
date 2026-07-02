import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import type { LearnWord } from '../api/reviews';
import { colors, spacing, radius, elevation } from '../theme/theme';

interface Props {
  word: LearnWord;
  onPlayAudio: () => void;
  /** ⭐ save (optional). Star shown only when a handler is provided. */
  saved?: boolean;
  onToggleSave?: () => void;
}

/**
 * The vocabulary flashcard (design mockup). Purely presentational — swipe
 * gestures + actions live in the parent screen. Reused by the review deck and
 * (later) the saved-words screen.
 *
 * This is intentionally a LIGHT (white) card that pops on the app's dark
 * night-sky background — a clean, high-contrast surface that's easiest to read
 * while reviewing. Its text colors are therefore explicit (CARD.*) rather than
 * the theme tokens, which are inverted for the dark UI. Purple accents reuse
 * `colors.primary`, which reads correctly on white.
 *
 * Layout: hero image with level / category / part-of-speech overlays, then
 * word + phonetic + 🔊, English definition, Mongolian meaning, and an example.
 */

/** Light-card palette (this surface only). */
const CARD = {
  bg: '#FFFFFF',
  ink: '#101A38', // word + meaning (deep navy)
  body: '#3D465F', // definition copy
  muted: '#8A93A8', // phonetic + example translation
  overlay: 'rgba(17,25,46,0.72)', // dark translucent image pills
  exampleBg: '#F1F0FC', // light-purple example box
  divider: '#E3E1F4',
};

export function VocabCard({ word, onPlayAudio, saved, onToggleSave }: Props) {
  return (
    <View style={styles.card}>
      {/* ── Hero image + overlays ─────────────────────────────────────── */}
      <View style={styles.hero}>
        {word.imageUrl ? (
          <AppImage source={{ uri: word.imageUrl }} width={600} style={styles.heroImg} contentFit="cover" />
        ) : (
          <View style={[styles.heroImg, styles.heroPlaceholder]}>
            <AppText style={styles.placeholderText}>{word.english}</AppText>
          </View>
        )}

        {/* level (top-left) */}
        <View style={styles.levelPill}>
          <AppText variant="label" color={colors.white} style={styles.pillText}>
            {word.level?.toUpperCase()}
          </AppText>
        </View>

        {/* ⭐ save (top-right) */}
        {onToggleSave ? (
          <Pressable onPress={onToggleSave} hitSlop={10} style={styles.saveBtn}>
            <Ionicons
              name={saved ? 'star' : 'star-outline'}
              size={20}
              color={saved ? colors.xp : colors.primary}
            />
          </Pressable>
        ) : null}

        {/* category (bottom-left) */}
        {word.category ? (
          <View style={[styles.imgPill, styles.catPill]}>
            <AppText variant="label" color={colors.white} style={styles.pillText}>
              {word.category}
            </AppText>
          </View>
        ) : null}

        {/* part of speech (bottom-right) */}
        {word.partOfSpeech ? (
          <View style={[styles.imgPill, styles.posPill]}>
            <AppText variant="label" color={colors.white} style={styles.pillText}>
              {word.partOfSpeech}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <View style={styles.body}>
        <View style={styles.wordRow}>
          <View style={styles.wordCol}>
            <AppText style={styles.word}>{word.english}</AppText>
            {word.phonetic ? (
              <AppText style={styles.phonetic}>{word.phonetic}</AppText>
            ) : null}
          </View>
          {/* Always available: plays the uploaded audio if any, else device TTS. */}
          <Pressable onPress={onPlayAudio} hitSlop={8} style={styles.audioBtn}>
            <Ionicons name="volume-high" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {/* English definition */}
        {word.englishDefinition ? (
          <AppText style={styles.definition}>{word.englishDefinition}</AppText>
        ) : null}

        {/* Mongolian meaning */}
        <View style={styles.meaningRow}>
          <View style={styles.meaningIcon}>
            <Ionicons name="language" size={14} color={colors.primary} />
          </View>
          <AppText style={styles.meaning}>{word.mongolian}</AppText>
        </View>

        {/* Example */}
        {word.exampleSentence ? (
          <View style={styles.exampleBox}>
            <View style={styles.exampleHead}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
              <AppText variant="label" color={colors.primary}>Example</AppText>
            </View>
            <AppText style={styles.exampleEn}>{word.exampleSentence}</AppText>
            {word.exampleTranslation ? (
              <>
                <View style={styles.exampleDivider} />
                <AppText style={styles.exampleMn}>{word.exampleTranslation}</AppText>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD.bg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...(elevation.md as object),
  },
  hero: { height: 230, backgroundColor: '#E9E7F3' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 34, fontWeight: '800', color: colors.primary },

  // Image overlays
  levelPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: CARD.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  saveBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...(elevation.sm as object),
  },
  imgPill: {
    position: 'absolute',
    bottom: spacing.md,
    backgroundColor: CARD.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  catPill: { left: spacing.md },
  posPill: { right: spacing.md },
  pillText: { fontWeight: '700' },

  // Body
  body: { padding: spacing.lg },
  wordRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  wordCol: { flex: 1, paddingRight: spacing.md },
  word: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: CARD.ink },
  phonetic: { marginTop: 2, fontSize: 15, color: CARD.muted },
  audioBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  definition: { marginTop: spacing.md, fontSize: 16, lineHeight: 23, color: CARD.body },
  meaningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  meaningIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaning: { flex: 1, fontSize: 16, fontWeight: '700', color: CARD.ink },
  exampleBox: {
    marginTop: spacing.lg,
    backgroundColor: CARD.exampleBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  exampleHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  exampleEn: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: CARD.ink },
  exampleDivider: {
    height: 1,
    backgroundColor: CARD.divider,
    marginVertical: spacing.sm,
  },
  exampleMn: { fontSize: 14, lineHeight: 20, color: CARD.muted },
});
