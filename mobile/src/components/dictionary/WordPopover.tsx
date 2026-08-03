/**
 * The READER's translate popover — a small box that opens right above the word
 * you double-tapped, showing ONE short Mongolian meaning plus pronunciation and
 * save. Deliberately minimal: you are mid-sentence and want the meaning, not a
 * dictionary entry. The full multi-meaning view is the separate search panel
 * (`DictionaryPanel`), reached from the dictionary button.
 */
import { useEffect, useMemo } from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { DURATION, useReduceMotion } from '../../lib/motion';
import { spacing, radius, elevation, type AppColors } from '../../theme/theme';
import { useColors } from '../../settings/SettingsContext';
import type { WordLookupState } from './useWordLookup';

/** Where on screen the tapped word is — the popover anchors above this point. */
export interface Anchor {
  x: number;
  y: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function WordPopover({
  lk,
  anchor,
  onClose,
}: {
  lk: WordLookupState;
  anchor: Anchor;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const screen = useWindowDimensions();
  const reduce = useReduceMotion();
  const { word, isPhrase, loading, result, error, audioBusy, saved, saveBusy } = lk;

  // Position next to the tapped word, clamped to the screen. Both axes are
  // anchored by a FIXED edge so that when the content grows (spinner → result)
  // the box expands *away* from the word instead of re-centring — which used to
  // make the popover visibly jump.
  const GAP = 10;
  // Fixed width → no horizontal shift when the text length changes.
  const popW = isPhrase ? Math.min(320, screen.width - spacing.lg * 2) : 260;
  const left = clamp(anchor.x - popW / 2, spacing.sm, screen.width - popW - spacing.sm);
  // Enough room above? pin the BOTTOM just above the word (grows up); otherwise
  // pin the TOP just below it (grows down). The anchored edge never moves.
  const vpos =
    anchor.y > 150
      ? { bottom: screen.height - anchor.y + GAP }
      : { top: anchor.y + 22 };

  // Reveal: fade + slide up on open, so it presents instead of snapping in.
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = word ? (reduce ? 1 : withTiming(1, { duration: DURATION.fast })) : 0;
  }, [word, reduce, reveal]);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 8 }],
  }));

  return (
    <Modal visible={word !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[styles.popover, { left, width: popW, ...vpos }, revealStyle]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : error ? (
          <AppText variant="caption" color={colors.danger}>{error}</AppText>
        ) : result ? (
          <View style={styles.row}>
            <AppText
              variant={isPhrase ? 'body' : 'h3'}
              color={colors.text}
              style={styles.translation}
            >
              {result.translation}
            </AppText>
            <Pressable onPress={lk.speak} hitSlop={8} style={styles.iconBtn}>
              {audioBusy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="volume-high" size={22} color={colors.primary} />
              )}
            </Pressable>
            {/* Save is word-only — sentences aren't added to vocabulary. */}
            {!isPhrase ? (
              <Pressable onPress={lk.save} hitSlop={8} style={styles.iconBtn}>
                {saveBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={saved ? colors.success : colors.primary}
                  />
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  popover: {
    position: 'absolute',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.float,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  translation: { flexShrink: 1, marginRight: spacing.xs },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
