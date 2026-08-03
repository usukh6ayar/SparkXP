/**
 * A passage read as a BOOK, not a scroll: the text is laid out once at full
 * height inside a fixed-height window, and turning a page slides that window
 * down to the next screenful. Swipe sideways, or use the arrows below.
 *
 * Why a window and not one view per page: the text is a single flowing block —
 * rendering N copies of it (one per page) would re-lay-out the whole passage N
 * times. Here it is laid out exactly once and only the offset changes, so a
 * twelve-page B2 article costs the same as a one-page A1 story.
 *
 * Page boundaries come from `onTextLayout`, which reports every rendered line's
 * y and height. Lines are packed into a page until the next one would fall past
 * the window's bottom — so a page NEVER cuts a line in half.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, type TextStyle, type TextLayoutLine } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { SelectableText } from '../SelectableText';
import { haptics } from '../../lib/haptics';
import { DURATION, useReduceMotion } from '../../lib/motion';
import { spacing, radius, type AppColors } from '../../theme/theme';
import { useColors } from '../../settings/SettingsContext';

/** How far a swipe must travel before it counts as a page turn. */
const SWIPE_MIN = 40;

interface Pages {
  /** y offset of each page's first line, in the laid-out text. */
  offsets: number[];
  /** Character index each page starts at — null when the platform withheld
   *  per-line text, in which case read-along falls back to an estimate. */
  startChars: number[] | null;
}

export function PagedReader({
  text,
  textStyle,
  highlightRange,
  height,
  onPageChange,
}: {
  text: string;
  /** Font size + line height chosen by the reader's A⁻/A⁺ control. */
  textStyle: TextStyle;
  highlightRange?: { from: number; to: number } | null;
  /** Height of the page window. */
  height: number;
  /** Reports position so the screen can drive its progress bar. */
  onPageChange?: (page: number, total: number) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduce = useReduceMotion();

  const [{ offsets, startChars }, setPages] = useState<Pages>({ offsets: [0], startChars: null });
  const [page, setPage] = useState(0);
  const total = offsets.length;

  // Kept on the UI thread so the window can move without a re-render.
  const offsetSv = useSharedValue(0);
  const turn = useSharedValue(1); // 0 → 1 across a page turn
  const dir = useSharedValue(1);

  /**
   * Pack lines into pages: a new page starts at the first line that would
   * overflow the window.
   *
   * `lastKey` is not an optimisation — it is required. Every `setPages` builds
   * a fresh object, React re-renders, the text lays out again and fires
   * `onTextLayout` again: without an identity check that is an endless loop.
   */
  const lastKey = useRef('');
  const measure = useCallback(
    (lines: TextLayoutLine[]) => {
      if (!lines?.length || height <= 0) return;
      const offs = [0];
      const chars = [0];
      let top = 0;
      let seen = 0;
      let anyText = false;
      for (const ln of lines) {
        if (ln.y + ln.height - top > height && ln.y > top) {
          top = ln.y;
          offs.push(top);
          chars.push(seen);
        }
        if (ln.text != null) anyText = true;
        seen += ln.text?.length ?? 0;
      }
      const key = `${height}|${offs.join(',')}`;
      if (key === lastKey.current) return;
      lastKey.current = key;
      setPages({ offsets: offs, startChars: anyText ? chars : null });
    },
    [height],
  );

  // A font-size change re-paginates; keep the reader inside the new range.
  useEffect(() => {
    setPage((p) => Math.min(p, offsets.length - 1));
  }, [offsets]);

  useEffect(() => {
    offsetSv.value = offsets[page] ?? 0;
    onPageChange?.(page, total);
  }, [offsets, page, total, offsetSv, onPageChange]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(next, offsets.length - 1));
      if (clamped === page) return;
      haptics.tap();
      dir.value = clamped > page ? 1 : -1;
      setPage(clamped);
      if (!reduce) {
        turn.value = 0;
        turn.value = withTiming(1, { duration: DURATION.fast });
      }
    },
    [page, offsets.length, reduce, dir, turn],
  );

  // Horizontal only: `failOffsetY` hands vertical drags back to the screen's
  // ScrollView, so the page still scrolls normally.
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-14, 14])
        .onEnd((e) => {
          if (e.translationX <= -SWIPE_MIN) runOnJS(go)(page + 1);
          else if (e.translationX >= SWIPE_MIN) runOnJS(go)(page - 1);
        }),
    [go, page],
  );

  // Read-along: when the spoken sentence sits on another page, follow it.
  useEffect(() => {
    if (!highlightRange || total < 2) return;
    const at = highlightRange.from;
    let target: number;
    if (startChars) {
      // The last page that begins at or before this character.
      target = 0;
      for (let i = 0; i < startChars.length; i++) if (startChars[i] <= at) target = i;
    } else {
      // The platform withheld per-line text — estimate from how far into the
      // passage this sentence starts.
      target = Math.min(total - 1, Math.floor((at / Math.max(1, text.length)) * total));
    }
    if (target !== page) go(target);
  }, [highlightRange, startChars, total, text.length, page, go]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: turn.value,
    transform: [
      { translateY: -offsetSv.value },
      { translateX: (1 - turn.value) * 26 * dir.value },
    ],
  }));

  return (
    <View>
      <GestureDetector gesture={swipe}>
        <View style={[styles.window, { height }]}>
          <Animated.View style={contentStyle}>
            <SelectableText
              text={text}
              variant="body"
              style={textStyle}
              highlightRange={highlightRange}
              onTextLayout={(e) => measure(e.nativeEvent.lines)}
            />
          </Animated.View>
        </View>
      </GestureDetector>

      {total > 1 ? (
        <View style={styles.pager}>
          <PagerBtn icon="chevron-back" disabled={page === 0} onPress={() => go(page - 1)} />
          <AppText variant="label" color={colors.textSecondary}>
            {page + 1} / {total}
          </AppText>
          <PagerBtn
            icon="chevron-forward"
            disabled={page === total - 1}
            onPress={() => go(page + 1)}
          />
        </View>
      ) : null}
    </View>
  );
}

function PagerBtn({
  icon,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [styles.pagerBtn, disabled && styles.pagerBtnOff, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={disabled ? colors.textMuted : colors.primary} />
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  // The window clips the full-height text down to one screenful.
  window: { overflow: 'hidden', justifyContent: 'flex-start' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pagerBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerBtnOff: { opacity: 0.4 },
});
