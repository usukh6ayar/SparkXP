import { useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
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
 * Layout: hero image with level / category / part-of-speech overlays, then
 * word + phonetic + 🔊, Mongolian meaning, example, and a collapsible
 * "Spark сануулга" memory tip.
 */
export function VocabCard({ word, onPlayAudio, saved, onToggleSave }: Props) {
  const [tipOpen, setTipOpen] = useState(false);

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
        <View style={[styles.levelPill]}>
          <AppText variant="label" color={colors.white} style={styles.pillText}>
            {word.level?.toUpperCase()}
          </AppText>
        </View>

        {/* category + part of speech (top-right, stacked) */}
        <View style={styles.topRight}>
          {word.category ? (
            <View style={styles.categoryPill}>
              <Ionicons name="home" size={12} color={colors.white} />
              <AppText variant="label" color={colors.white} style={styles.pillText}>
                {word.category}
              </AppText>
            </View>
          ) : null}
          {word.partOfSpeech ? (
            <View style={styles.posPill}>
              <Ionicons name="pricetag" size={11} color={colors.primary} />
              <AppText variant="label" color={colors.primary} style={styles.pillText}>
                {word.partOfSpeech}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* ⭐ save (optional, top-right corner of image) */}
        {onToggleSave ? (
          <Pressable onPress={onToggleSave} hitSlop={10} style={styles.saveBtn}>
            <Ionicons
              name={saved ? 'star' : 'star-outline'}
              size={20}
              color={saved ? colors.xp : colors.navy}
            />
          </Pressable>
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

        {/* Mongolian meaning */}
        <View style={styles.meaningRow}>
          <View style={styles.meaningIcon}>
            <Ionicons name="language" size={14} color={colors.primary} />
          </View>
          <AppText variant="h3" color={colors.navy} style={styles.meaning}>
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

        {/* Spark tip (collapsed by default) */}
        {word.sparkTip ? (
          <Pressable style={styles.tipBox} onPress={() => setTipOpen((o) => !o)}>
            <View style={styles.tipHead}>
              <AppText style={styles.tipFox}>🦊</AppText>
              <AppText variant="label" color={colors.primary} style={styles.tipTitle}>
                Spark сануулга
              </AppText>
              <Ionicons
                name={tipOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.primary}
              />
            </View>
            {tipOpen ? (
              <AppText variant="body" color={colors.textSecondary} style={styles.tipBody}>
                {word.sparkTip}
              </AppText>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...(elevation.md as object),
  },
  hero: { height: 230, backgroundColor: colors.surfaceAlt },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 34, fontWeight: '800', color: colors.primary },
  levelPill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  topRight: { position: 'absolute', top: spacing.md, right: spacing.md, alignItems: 'flex-end', gap: 6 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(24,36,74,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  posPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  pillText: { fontWeight: '700' },
  saveBtn: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...(elevation.sm as object),
  },
  body: { padding: spacing.lg },
  wordRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  wordCol: { flex: 1, paddingRight: spacing.md },
  word: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: colors.navy },
  phonetic: { marginTop: 2 },
  audioBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  meaningIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaning: { fontWeight: '700', flex: 1 },
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
  tipBox: {
    marginTop: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipFox: { fontSize: 18 },
  tipTitle: { flex: 1, fontWeight: '700' },
  tipBody: { marginTop: spacing.sm },
});
