import { useMemo, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppImage } from './AppImage';
import { AppText } from './Text';
import { IconButton } from './IconButton';
import { Button } from './Button';
import { AwardBadge } from './AwardBadge';
import { ProgressBar } from './ProgressBar';
import { haptics } from '../lib/haptics';
import { t } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';
import type { LearnWord } from '../api/reviews';

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Flashcard practice over the user's saved words. Shows one card at a time
 * (English side); tap to flip to the Mongolian meaning, then self-assess:
 * "Мэднэ" drops the card, "Мэдэхгүй" re-queues it to the end. Runs entirely
 * over the already-loaded saved list — no extra API calls.
 */
export function SavedFlashcards({
  visible,
  words,
  onClose,
  onPlay,
}: {
  visible: boolean;
  words: LearnWord[];
  onClose: () => void;
  onPlay: (w: LearnWord) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Real device insets read from the ROOT provider (reliable even though the
  // content lives inside a full-screen, status-bar-translucent Modal).
  const insets = useSafeAreaInsets();
  const [deck, setDeck] = useState<LearnWord[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);

  const reset = useCallback(() => {
    setDeck(shuffle(words));
    setFlipped(false);
    setKnown(0);
  }, [words]);

  // (Re)start the deck each time the practice modal opens.
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const total = words.length;
  const card = deck[0];
  const doneCount = total - deck.length;

  // Self-assessment: known → drop the card, not-known → send it to the end.
  const answer = (isKnown: boolean) => {
    haptics.tap();
    setFlipped(false);
    if (isKnown) setKnown((k) => k + 1);
    setDeck((d) => {
      const [head, ...rest] = d;
      return isKnown ? rest : [...rest, head];
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton icon="arrow-back" size={40} onPress={onClose} accessibilityLabel={t('close')} />
          <AppText variant="h3">{t('savedWords')}</AppText>
          <AppText variant="label" color={c.textSecondary} style={styles.counter}>
            {card ? `${doneCount + 1} / ${total}` : `${total} / ${total}`}
          </AppText>
        </View>
        <View style={styles.progressWrap}>
          <ProgressBar value={total > 0 ? doneCount / total : 0} color={c.primary} />
        </View>

        {card ? (
          <View style={styles.body}>
            {/* Flip card: front = English, back = meaning. Tap to flip. */}
            <Animated.View key={`${card.id}-${flipped}`} entering={FadeIn.duration(160)} style={styles.cardWrap}>
              <Pressable style={styles.card} onPress={() => { haptics.select(); setFlipped((f) => !f); }}>
                {!flipped ? (
                  <>
                    {card.imageUrl ? (
                      <AppImage source={{ uri: card.imageUrl }} width={220} style={styles.cardImg} contentFit="cover" />
                    ) : null}
                    <AppText style={styles.word} numberOfLines={2}>{card.english}</AppText>
                    {card.phonetic ? (
                      <AppText variant="body" color={c.textMuted}>{card.phonetic}</AppText>
                    ) : null}
                    <View style={styles.revealHint}>
                      <Ionicons name="sync-outline" size={14} color={c.textMuted} />
                      <AppText variant="caption" color={c.textMuted}>{t('tapToReveal')}</AppText>
                    </View>
                  </>
                ) : (
                  <>
                    <AppText variant="label" color={c.textMuted}>{card.english}</AppText>
                    <AppText style={styles.meaning} numberOfLines={4}>{card.mongolian}</AppText>
                    {card.exampleSentence ? (
                      <AppText variant="body" color={c.textSecondary} center style={styles.example}>
                        “{card.exampleSentence}”
                      </AppText>
                    ) : null}
                  </>
                )}
              </Pressable>
            </Animated.View>

            {/* Pronounce the word */}
            <IconButton
              icon="volume-high"
              size={52}
              iconSize={24}
              variant="filled"
              iconColor={c.primary}
              onPress={() => onPlay(card)}
              style={styles.audio}
              accessibilityLabel={t('savedWords')}
            />

            {/* Self-assessment */}
            <View style={styles.actions}>
              <Button label={t('reviewLabel')} variant="secondary" icon="refresh" onPress={() => answer(false)} style={styles.actionBtn} />
              <Button label={t('knownLabel')} icon="checkmark" onPress={() => answer(true)} style={styles.actionBtn} />
            </View>
          </View>
        ) : (
          // Deck cleared → summary
          <View style={styles.done}>
            <AwardBadge icon="trophy" color={c.white} bg={c.primary} size={88} />
            <AppText variant="h2" center style={styles.doneTitle}>{t('reviewComplete')}</AppText>
            {/* Big known/total score so the result reads at a glance. */}
            <View style={styles.doneScore}>
              <AppText variant="display" color={c.primary}>{known}</AppText>
              <AppText variant="h3" color={c.textMuted}>/ {total}</AppText>
            </View>
            <AppText variant="caption" color={c.textMuted} center style={styles.doneHint}>
              {t('reviewDoneHint')}
            </AppText>
            <Button label={t('playAgain')} icon="refresh" onPress={reset} style={styles.doneBtn} />
            <Button label={t('close')} variant="secondary" onPress={onClose} style={styles.doneBtn2} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  counter: { minWidth: 48, textAlign: 'right' },
  progressWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  cardWrap: { alignSelf: 'stretch' },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.xl,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cardImg: { width: 132, height: 132, borderRadius: radius.lg, marginBottom: spacing.md, backgroundColor: c.surfaceAlt },
  word: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: c.navy, textAlign: 'center' },
  meaning: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: c.primary, textAlign: 'center' },
  example: { marginTop: spacing.md, fontStyle: 'italic' },
  revealHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },

  audio: { marginTop: -spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  actionBtn: { flex: 1 },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneTitle: { marginTop: spacing.lg },
  doneScore: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.sm },
  doneHint: { marginTop: spacing.sm },
  doneBtn: { alignSelf: 'stretch', marginTop: spacing.xl },
  doneBtn2: { alignSelf: 'stretch', marginTop: spacing.sm },
});
