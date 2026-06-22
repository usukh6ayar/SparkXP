import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import type { LearnWord } from '../api/reviews';
import { colors, spacing, radius, elevation } from '../theme/theme';

interface Props {
  word: LearnWord;
  /** ⭐ saved state (controlled by the parent so it can update optimistically). */
  saved: boolean;
  onToggleSave: () => void;
  onPlayAudio: () => void;
}

/**
 * The vocabulary swipe card (see design mockup zurag.jpg). Purely presentational
 * — swipe gestures + Forgot/Know live in the parent screen. Reused by the swipe
 * deck and (later) the saved-words screen, so it owns no animation state.
 *
 * Layout: hero image with level / save / category / part-of-speech overlays,
 * then word + phonetic + 🔊, English definition, Mongolian meaning, example.
 */
export function VocabCard({ word, saved, onToggleSave, onPlayAudio }: Props) {
  return (
    <View style={styles.card}>
      {/* ── Hero image + overlays ─────────────────────────────────────── */}
      <View style={styles.hero}>
        {word.imageUrl ? (
          <Image source={{ uri: word.imageUrl }} style={styles.heroImg} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImg, styles.heroPlaceholder]}>
            <AppText style={styles.placeholderText}>{word.english}</AppText>
          </View>
        )}

        {/* level (top-left) */}
        <View style={[styles.overlayPill, styles.levelPill]}>
          <AppText variant="label" color={colors.white} style={styles.pillText}>
            {word.level?.toUpperCase()}
          </AppText>
        </View>

        {/* ⭐ save (top-right) */}
        <Pressable onPress={onToggleSave} hitSlop={10} style={styles.saveBtn}>
          <Ionicons
            name={saved ? 'star' : 'star-outline'}
            size={22}
            color={saved ? colors.xp : colors.navy}
          />
        </Pressable>

        {/* category (bottom-left) */}
        {word.category ? (
          <View style={[styles.overlayPill, styles.categoryPill]}>
            <AppText variant="label" color={colors.white} style={styles.pillText}>
              {word.category}
            </AppText>
          </View>
        ) : null}

        {/* part of speech (bottom-right) */}
        {word.partOfSpeech ? (
          <View style={[styles.overlayPill, styles.posPill]}>
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
              <AppText variant="body" color={colors.textMuted} style={styles.phonetic}>
                {word.phonetic}
              </AppText>
            ) : null}
          </View>
          {word.audioUrl ? (
            <Pressable onPress={onPlayAudio} hitSlop={8} style={styles.audioBtn}>
              <Ionicons name="volume-high" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {word.englishDefinition ? (
          <AppText variant="body" style={styles.definition}>
            {word.englishDefinition}
          </AppText>
        ) : null}

        {/* Mongolian meaning */}
        <View style={styles.meaningRow}>
          <View style={styles.meaningIcon}>
            <Ionicons name="language" size={14} color={colors.primary} />
          </View>
          <AppText variant="h3" color={colors.primary} style={styles.meaning}>
            {word.mongolian}
          </AppText>
        </View>

        {/* Example */}
        {word.exampleSentence ? (
          <View style={styles.exampleBox}>
            <View style={styles.exampleHead}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
              <AppText variant="label" color={colors.primary}>Example</AppText>
            </View>
            <AppText variant="body" style={styles.exampleEn}>{word.exampleSentence}</AppText>
            {word.exampleTranslation ? (
              <>
                <View style={styles.exampleDivider} />
                <AppText variant="body" color={colors.textMuted}>
                  {word.exampleTranslation}
                </AppText>
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
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...(elevation.md as object),
  },
  hero: { height: 240, backgroundColor: colors.surfaceAlt },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 34, fontWeight: '800', color: colors.primary },
  overlayPill: {
    position: 'absolute',
    backgroundColor: 'rgba(24,36,74,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  levelPill: { top: spacing.md, left: spacing.md },
  categoryPill: { bottom: spacing.md, left: spacing.md },
  posPill: { bottom: spacing.md, right: spacing.md },
  pillText: { fontWeight: '700' },
  saveBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...(elevation.sm as object),
  },
  body: { padding: spacing.lg },
  wordRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  wordCol: { flex: 1, paddingRight: spacing.md },
  word: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: colors.navy },
  phonetic: { marginTop: 2 },
  audioBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  definition: { marginTop: spacing.md, color: colors.text },
  meaningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  meaningIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaning: { fontWeight: '700' },
  exampleBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  exampleHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  exampleEn: { fontWeight: '700', color: colors.navy },
  exampleDivider: {
    height: 1,
    backgroundColor: colors.borderStrong,
    marginVertical: spacing.sm,
    opacity: 0.5,
  },
});
