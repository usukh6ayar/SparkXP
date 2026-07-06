import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
      {/* Left column — tap to pick (fallback) + drop targets */}
      <View style={styles.col}>
        {pairs.map((p, i) => (
          <View
            key={i}
            onLayout={(e) => setLeftFrames((m) => ({ ...m, [i]: e.nativeEvent.layout }))}
          >
            <Animated.View
              style={[
                styles.item,
                selLeft === i && styles.itemSel,
                matches[i] ? styles.itemDone : null,
              ]}
              onTouchEnd={() => setSelLeft(i)}
            >
              <AppText variant="bodyStrong">{p.left}</AppText>
              {matches[i] ? <AppText variant="caption" color={c.primary}>→ {matches[i]}</AppText> : null}
            </Animated.View>
          </View>
        ))}
      </View>

      {/* Right column — draggable chips (also tappable) */}
      <View style={styles.col}>
        {rights.map((r, i) => {
          const used = Object.values(matches).includes(r);
          return (
            <DraggableChip
              key={i}
              label={r}
              used={used}
              styles={styles}
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
  label, used, styles, onDrop, onTap,
}: {
  label: string;
  used: boolean;
  styles: ReturnType<typeof makeStyles>;
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
        style={[styles.item, styles.chip, style]}
      >
        <AppText variant="bodyStrong">{label}</AppText>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1, gap: spacing.sm },
  item: {
    borderWidth: 2, borderColor: c.border, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, minHeight: 48, justifyContent: 'center',
  },
  itemSel: { borderColor: c.primary, backgroundColor: c.primarySoft },
  itemDone: { borderColor: c.success, backgroundColor: c.successSoft },
  chip: { backgroundColor: c.surfaceAlt, alignItems: 'center' },
});
