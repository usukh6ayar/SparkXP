import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { haptics } from '../lib/haptics';
import { SPRING } from '../lib/motion';
import { spacing, radius, type AppColors } from '../theme/theme';

interface Pair { left: string; right: string }

/**
 * word_match board with BOTH interactions (DRY + robust):
 *  - **Drag & drop** (playful): drag a right-column chip onto a left row.
 *  - **Tap fallback**: tap a left row, then tap a chip — always works even if a
 *    drag misses, so the quiz flow can never get stuck.
 *
 * `matches` maps leftIndex → chosen right value. Parent owns the state.
 */
export function WordMatchBoard({
  pairs,
  rights,
  matches,
  onAssign,
}: {
  pairs: Pair[];
  rights: string[];
  matches: Record<number, string>;
  onAssign: (leftIndex: number, right: string) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Vertical frame of each left row (within this board) so a dropped chip can be
  // hit-tested against them.
  const [leftFrames, setLeftFrames] = useState<Record<number, LayoutRectangle>>({});
  const [selLeft, setSelLeft] = useState<number | null>(null);

  /** Assign the right value to whichever left row the drop point falls in. */
  function dropOnto(dropY: number, right: string) {
    const hit = Object.entries(leftFrames).find(
      ([, f]) => dropY >= f.y && dropY <= f.y + f.height,
    );
    if (hit) {
      haptics.success();
      onAssign(Number(hit[0]), right);
    }
  }

  function tapRight(right: string) {
    if (selLeft === null) return;
    haptics.select();
    onAssign(selLeft, right);
    setSelLeft(null);
  }

  return (
    <View style={styles.row}>
      {/* Left column — prompt cards with a slot to fill (tap to pick + drop target) */}
      <View style={styles.col}>
        {pairs.map((p, i) => {
          const done = !!matches[i];
          const active = selLeft === i;
          return (
            <View
              key={i}
              onLayout={(e) => {
                // Read the layout synchronously: the setState updater below runs
                // after the synthetic event is pooled, so e.nativeEvent would be
                // null inside it (→ "Cannot read property 'layout' of null").
                const layout = e.nativeEvent.layout;
                setLeftFrames((m) => ({ ...m, [i]: layout }));
              }}
            >
              <Animated.View
                style={[styles.item, active && styles.itemSel, done && styles.itemDone]}
                onTouchEnd={() => setSelLeft(i)}
              >
                <View style={[styles.indexDot, done && styles.indexDotDone, active && styles.indexDotActive]}>
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={c.white} />
                  ) : (
                    <AppText variant="label" color={active ? c.white : c.primary}>{i + 1}</AppText>
                  )}
                </View>
                <AppText variant="bodyStrong" numberOfLines={2} style={styles.leftWord}>{p.left}</AppText>
                {/* The answer slot: a filled success pill once matched, else a
                    dashed drop target so it reads as a fill-in game (not a list). */}
                {done ? (
                  <View style={styles.answerPill}>
                    <AppText variant="label" color={c.success} numberOfLines={1}>{matches[i]}</AppText>
                  </View>
                ) : (
                  <View style={[styles.slot, active && styles.slotActive]}>
                    <Ionicons name="arrow-back" size={14} color={active ? c.primary : c.textMuted} />
                  </View>
                )}
              </Animated.View>
            </View>
          );
        })}
      </View>

      {/* Right column — draggable answer chips (also tappable) */}
      <View style={styles.col}>
        {rights.map((r, i) => {
          const used = Object.values(matches).includes(r);
          return (
            <DraggableChip
              key={i}
              label={r}
              used={used}
              styles={styles}
              c={c}
              onDrop={(y) => dropOnto(y, r)}
              onTap={() => tapRight(r)}
            />
          );
        })}
      </View>
    </View>
  );
}

/** A right-column chip that can be dragged (springs back) or tapped. */
function DraggableChip({
  label, used, styles, c, onDrop, onTap,
}: {
  label: string;
  used: boolean;
  styles: ReturnType<typeof makeStyles>;
  c: AppColors;
  onDrop: (dropYWithinBoard: number) => void;
  onTap: () => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);
  // Row's own top offset within the board, captured on layout, so the release
  // point can be converted to board coordinates for hit-testing.
  const rowTop = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(!used)
    .onStart(() => { dragging.value = 1; })
    .onUpdate((e) => { tx.value = e.translationX; ty.value = e.translationY; })
    .onEnd((e) => {
      // Board-space Y of the drop = this chip's row top + drag offset + grab point.
      runOnJS(onDrop)(rowTop.value + e.translationY + 20);
      tx.value = withSpring(0, SPRING);
      ty.value = withSpring(0, SPRING);
      dragging.value = 0;
    });

  const tap = Gesture.Tap().enabled(!used).onEnd(() => runOnJS(onTap)());

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: dragging.value ? 10 : 0,
    opacity: used ? 0.35 : 1,
  }));

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        onLayout={(e) => { rowTop.value = e.nativeEvent.layout.y; }}
        style={[styles.chip, used && styles.chipUsed, style]}
      >
        <Ionicons
          name={used ? 'checkmark-circle' : 'reorder-three'}
          size={16}
          color={used ? c.success : c.textMuted}
        />
        <AppText variant="bodyStrong" numberOfLines={2} style={styles.chipLabel}>{label}</AppText>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  col: { flex: 1, gap: spacing.md },

  // Left prompt card: index chip · word · answer slot. A soft shadow lifts it
  // off the page so the two columns read as a real matching board, not a list.
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, minHeight: 62,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  itemSel: {
    borderColor: c.primary, backgroundColor: c.primarySoft, borderWidth: 1.5,
    shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  itemDone: { borderColor: c.success, backgroundColor: c.successSoft },
  indexDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  indexDotActive: { backgroundColor: c.primary },
  indexDotDone: { backgroundColor: c.success },
  leftWord: { flex: 1 },
  // Empty dashed drop target so the row reads as "fill me in".
  slot: {
    minWidth: 44, height: 32, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: c.borderStrong, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  slotActive: { borderColor: c.primary, borderStyle: 'solid', backgroundColor: c.primarySoft },
  answerPill: {
    maxWidth: 112, backgroundColor: c.successSoft, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
  },

  // Right draggable answer chip: grip icon + word, raised pill so it clearly
  // invites a drag (or tap) onto a left card.
  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.full,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, minHeight: 52,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  chipUsed: { borderColor: c.success, backgroundColor: c.successSoft, elevation: 0, shadowOpacity: 0 },
  chipLabel: { flexShrink: 1 },
});
