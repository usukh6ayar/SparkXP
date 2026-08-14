import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { PressableScale } from '../PressableScale';
import { SeekBar, formatTime } from './SeekBar';
import { useColors } from '../../settings/SettingsContext';
import { haptics } from '../../lib/haptics';
import { tf } from '../../i18n';
import { spacing, radius, type AppColors } from '../../theme/theme';

/** What the player needs to know, whatever is actually producing the sound. */
export interface PlayerState {
  playing: boolean;
  /** Where playback is, in seconds. */
  position: number;
  /** Whole recording/script length, in seconds. */
  duration: number;
  /**
   * Segment the position falls in, when playback is chunked (device voice reads
   * one sentence at a time). Drives the "0:58 – 1:12 · 4/12" readout.
   */
  segment?: { index: number; count: number; from: number; to: number } | null;
  /** Segment starts in seconds — the ticks on the bar. */
  marks?: number[];
  toggle: () => void;
  /** Jump to a second. */
  seek: (second: number) => void;
  stepBack: () => void;
  stepForward: () => void;
}

/**
 * The listening player.
 *
 * It used to be a play button and a bare drag bar, on the theory that dragging
 * says where you are as well as moving you. In practice a drag on a phone is a
 * fiddly, two-handed thing to land, and "sentence 4 of 12" is not a position
 * anyone can act on — you cannot decide to go back six seconds if the only unit
 * on screen is sentences. So:
 *
 * - **Step buttons carry the precise moves.** Back/forward are one tap, land
 *   exactly on a boundary, and need no aim. Dragging still works for big jumps.
 * - **Everything is in seconds.** `1:04 / 3:12` for where you are overall, and
 *   the current segment's own span underneath, so a replay of one sentence is a
 *   visible, bounded thing rather than a guess.
 * - **The bar is chunky and ticked.** The ticks are the sentence boundaries, so
 *   the shape of what you are listening to is visible before you touch it.
 */
export function AudioPlayer({
  state,
  /** Extra controls (speed toggle, transcript…) shown under the bar. */
  children,
}: {
  state: PlayerState;
  children?: React.ReactNode;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { playing, position, duration, segment, marks } = state;

  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
  const tickRatios = useMemo(
    () => (duration > 0 ? (marks ?? []).map((m) => m / duration) : []),
    [marks, duration],
  );

  return (
    <View style={styles.card}>
      <View style={styles.controls}>
        <StepButton icon="play-back" onPress={state.stepBack} styles={styles} c={c} />
        <PressableScale onPress={state.toggle} style={styles.playBtn}>
          <Ionicons name={playing ? 'pause' : 'play'} size={28} color={c.white} />
        </PressableScale>
        <StepButton icon="play-forward" onPress={state.stepForward} styles={styles} c={c} />

        <View style={styles.clock}>
          <AppText variant="bodyStrong" color={c.text}>{formatTime(position)}</AppText>
          <AppText variant="caption" color={c.textMuted}>/ {formatTime(duration)}</AppText>
        </View>
      </View>

      <SeekBar
        value={ratio}
        onSeek={(r) => state.seek(r * duration)}
        marks={tickRatios}
        tone="onSurface"
      />

      {/* Where the current chunk starts and ends. This is the line that makes a
          replay feel bounded — you can see it is twelve seconds, not "a bit". */}
      {segment ? (
        <View style={styles.segRow}>
          <Ionicons name="ellipse" size={7} color={c.primary} />
          <AppText variant="caption" color={c.textSecondary}>
            {formatTime(segment.from)} – {formatTime(segment.to)}
          </AppText>
          <AppText variant="caption" color={c.textMuted}>
            · {tf('listenPosition', { at: segment.index + 1, total: segment.count })}
          </AppText>
        </View>
      ) : null}

      {children ? <View style={styles.tools}>{children}</View> : null}
    </View>
  );
}

function StepButton({
  icon, onPress, styles, c,
}: {
  icon: 'play-back' | 'play-forward';
  onPress: () => void;
  styles: Styles;
  c: AppColors;
}) {
  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress(); }}
      hitSlop={10}
      style={styles.stepBtn}
    >
      <Ionicons name={icon} size={20} color={c.primary} />
    </Pressable>
  );
}

/** Pill used for the tools row (speed, transcript) so they match everywhere. */
export function PlayerPill({
  icon, label, on, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  on?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <PressableScale haptic={false} onPress={onPress} style={[styles.pill, on && styles.pillOn]}>
      <Ionicons name={icon} size={14} color={on ? c.white : c.textSecondary} />
      <AppText variant="caption" color={on ? c.white : c.textSecondary}>{label}</AppText>
    </PressableScale>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: c.border,
    },
    controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    playBtn: {
      width: 52,
      height: 52,
      borderRadius: radius.full,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clock: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 },
    segRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
    },
    pillOn: { backgroundColor: c.primary },
  });
