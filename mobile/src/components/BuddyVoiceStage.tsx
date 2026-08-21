import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSpring, withSequence,
  interpolate, Extrapolation, runOnJS, cancelAnimation, FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { BuddyAvatar } from './BuddyAvatar';
import type { VisemeCue } from './azureVisemes';
import { SHOW_3D_AVATAR } from '../lib/buddyAvatarFlag';
import { PressableScale } from './PressableScale';
import { haptics } from '../lib/haptics';
import { useColors, useSettings } from '../settings/SettingsContext';
import { spacing, radius, elevation, colors as staticColors, type AppColors } from '../theme/theme';
import { ms, bounded } from '../theme/responsive';
import type { Buddy } from '../api/ai';

/** Drag left past this (px) while holding → release cancels instead of sends. */
const CANCEL_X = -90;
/** Drag right past this (px) → hands-free lock; release keeps recording. */
const LOCK_X = 90;
/**
 * Breathing room between the buddy and each screen edge. Small on purpose —
 * the brief was "almost touching both sides" — but not zero, so the art never
 * reads as clipped on a device with curved glass.
 */
const EDGE_GAP = 6;
/**
 * Height reserved for the caption bubble, always. TWO lines of body text plus
 * the bubble's padding and the gap to the buddy.
 *
 * It is a constant on purpose: anything that varies here changes the buddy's
 * canvas and re-fits the 3D model. It is also as SMALL as it can be, because
 * every pixel it does not take is a pixel the buddy grows by — and the buddy can
 * only grow upward, since anything below it is the character's own body.
 * A rare third line is truncated; the audio is still saying the whole thing.
 */
const BUBBLE_SLOT_H = 88;

type Phase = 'idle' | 'recording' | 'locked';

/**
 * Voice-first buddy screen (the landing after "Apply"). A big buddy avatar
 * (the 3D GLB when the buddy has one, otherwise its thumbnail / name initial)
 * floating over a soft glowing stage, a WhatsApp-style
 * hold-to-talk mic (slide ← to cancel, slide → to lock hands-free), and a
 * "type to chat" bar that hands off to the text conversation.
 *
 * Recording lifecycle lives in the parent (it owns the expo-audio recorder);
 * this component only drives the gesture + visuals and reports the outcome:
 *   onRecordStart  – finger down, begin capturing
 *   onRecordCommit – release (or tap-to-stop while locked) → send the audio
 *   onRecordCancel – released in the cancel zone → discard
 */
export function BuddyVoiceStage({
  buddy, greeting, speaking, thinking, voiceLimited, usageLabel, usageLevel,
  captions, onToggleCaptions, onRecordStart, onRecordCommit, onRecordCancel, onOpenText,
  backgroundUrl, emotion, speechText, speechDurationMs, visemes, speechPositionMs,
}: {
  buddy: Buddy | null;
  /** LLM emotion tag for the last reply → drives the 3D face expression. */
  emotion?: string;
  /** Reply text → the 3D avatar derives its mouth shapes from it. */
  speechText?: string | null;
  /** Real audio length so the mouth keeps pace with the voice. */
  speechDurationMs?: number | null;
  /** Timed viseme cues for the reply audio (empty = derive them from the text). */
  visemes?: VisemeCue[] | null;
  /** Live playback position of the reply audio in ms — the lip-sync master clock. */
  speechPositionMs?: number | null;
  greeting: string;
  /** Equipped background scene (from the shop) shown behind the buddy. */
  backgroundUrl?: string | null;
  speaking: boolean;
  thinking: boolean;
  voiceLimited?: boolean;
  /** "3.5 / 25 мин" — voice minutes are only spent (and shown) on this screen. */
  usageLabel?: string;
  /** Voice-cap warning tier (doc guardrail): amber at 80%, red at 95%. */
  usageLevel?: 'none' | 'warn80' | 'warn95';
  /** Closed captions: when off, the buddy's spoken text is hidden. */
  captions: boolean;
  onToggleCaptions: () => void;
  onRecordStart: () => void;
  onRecordCommit: () => void;
  onRecordCancel: () => void;
  onOpenText: () => void;
}) {
  const c = useColors();
  const { t } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [phase, setPhase] = useState<Phase>('idle');
  const pressStart = useRef(0);

  const tx = useSharedValue(0);     // horizontal finger drag: ← cancel · → lock
  const active = useSharedValue(0); // 0 idle → 1 recording (drives mic scale/tint)
  const [ready3d, setReady3d] = useState(false);
  const is3d = SHOW_3D_AVATAR && !!buddy?.avatarAssetUrl && ready3d;

  /**
   * The buddy is the screen — it spans the full display width, leaving only
   * EDGE_GAP so it doesn't literally touch the bezel. Square, because both the
   * 3D canvas and the 2D art are fitted by height and would otherwise letterbox.
   *
   * Sized from the window rather than a fixed `ms()` value on purpose: this is
   * the one element that should grow with the device instead of being scaled
   * from a reference phone.
   */
  const { width: winW } = useWindowDimensions();
  // The frame the buddy is drawn in: ALWAYS the full screen width, and as tall
  // as the room left under the speech bubble. Not square — a square capped by
  // the available height was narrower than the screen, so the character could
  // never reach the edges no matter how it was fitted inside.
  //
  // `BuddyAvatar` fits the model to this frame's WIDTH and anchors it by the
  // top, so the head stays in view and the overflow falls off the bottom.
  // Height is measured off `buddyWrap` (`flex: 1`) — no feedback loop, since
  // that height comes from the layout, never from this child.
  const [roomH, setRoomH] = useState(0);
  const boxW = winW - EDGE_GAP * 2;
  const boxH = roomH || boxW;
  const pulse = useSharedValue(0);  // buddy breathing / speaking pulse (backdrop glow)
  const float = useSharedValue(0);  // slow vertical bob so the buddy feels alive
  const think = useSharedValue(0);  // gentle head-tilt wobble while thinking (-1…1)
  const ripple = useSharedValue(0); // expanding mic rings while recording
  const didLock = useSharedValue(false); // fire lock() once per gesture, not per frame

  // Gentle idle breathing; a livelier pulse while the buddy is speaking.
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = withRepeat(withTiming(1, { duration: speaking ? 500 : 2200 }), -1, true);
  }, [speaking, pulse]);

  // Continuous slow float — independent of speaking so the stage is never static.
  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 2600 }), -1, true);
  }, [float]);

  // "Thinking" state: a small left↔right head tilt while the buddy processes a
  // turn — a distinct third state next to idle (float) and speaking (pulse).
  useEffect(() => {
    cancelAnimation(think);
    if (thinking) {
      think.value = withRepeat(
        withSequence(withTiming(1, { duration: 620 }), withTiming(-1, { duration: 620 })),
        -1,
        false,
      );
    } else {
      think.value = withTiming(0, { duration: 300 });
    }
  }, [thinking, think]);

  // Mic "listening" rings only run while actually recording.
  const recording = phase === 'recording' || phase === 'locked';
  useEffect(() => {
    cancelAnimation(ripple);
    if (recording) ripple.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false);
    else ripple.value = 0;
  }, [recording, ripple]);

  // Whenever we're not actively dragging-to-talk, spring the mic back to center
  // and to rest size. This guarantees it re-centers after a cancel/lock release,
  // regardless of which gesture path ended the drag.
  useEffect(() => {
    if (phase !== 'recording') {
      tx.value = withSpring(0);
      active.value = withSpring(0, { damping: 14 });
    }
  }, [phase, tx, active]);

  function begin() {
    if (voiceLimited) return;
    pressStart.current = Date.now();
    setPhase('recording');
    haptics.tap();
    onRecordStart();
  }
  function finish(cancelled: boolean) {
    setPhase('idle');
    // A stray tap (too short to be speech) is discarded, not sent.
    const tooShort = Date.now() - pressStart.current < 400;
    if (cancelled || tooShort) { haptics.warning(); onRecordCancel(); }
    else { haptics.success(); onRecordCommit(); }
  }
  function lock() {
    setPhase('locked');
    haptics.select();
  }

  // minDistance 0 → the pan "activates" on touch-down so onBegin==press start
  // and onFinalize==release, giving a true press-and-hold to talk.
  const pan = Gesture.Pan()
    .minDistance(0)
    .enabled(!voiceLimited)
    .onBegin(() => {
      'worklet';
      didLock.value = false;
      active.value = withSpring(1, { damping: 14 });
      runOnJS(begin)();
    })
    .onUpdate((e) => {
      'worklet';
      // Follow the finger horizontally (clamped) so the mic feels physical.
      tx.value = Math.max(-130, Math.min(130, e.translationX));
      // Cross the lock threshold (drag right) once → latch into hands-free.
      if (e.translationX > LOCK_X && !didLock.value) {
        didLock.value = true;
        runOnJS(lock)();
      }
    })
    .onFinalize(() => {
      'worklet';
      const cancelled = tx.value < CANCEL_X;
      // Snap back immediately; the phase effect also recenters as a safety net.
      tx.value = withSpring(0);
      // When locked, release keeps recording — the mic becomes a tap-to-stop.
      if (!didLock.value) runOnJS(finish)(cancelled);
    });

  const micStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { scale: interpolate(active.value, [0, 1], [1, 1.18], Extrapolation.CLAMP) },
    ],
  }));
  // Expanding "listening" ring emanating from the mic while recording.
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 1], [0.45, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 2.4], Extrapolation.CLAMP) }],
  }));
  // Left hint brightens as you drag toward cancel; right hint as you drag to lock.
  const cancelHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [CANCEL_X, 0], [1, 0.4], Extrapolation.CLAMP),
  }));
  const lockHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [0, LOCK_X], [0.4, 1], Extrapolation.CLAMP),
  }));
  // The 2D art is bobbed/tilted from here. The 3D avatar gets NO transform at
  // all. Transforming a GL surface every frame makes it swim and shear (and
  // costs a re-composite), and the speaking scale-pulse that used to survive
  // here — 1 → 1.03 twice a second — read as the character drifting toward and
  // away from the camera once the buddy was drawn at full screen width, where
  // 3% is over a centimetre of travel. The 3D buddy has real lip-sync and
  // expressions to show that it is talking; it does not need the body to move.
  const buddyStyle = useAnimatedStyle(() => ({
    transform: is3d
      ? []
      : [
          { translateY: interpolate(float.value, [0, 1], [6, -6], Extrapolation.CLAMP) },
          { scale: interpolate(pulse.value, [0, 1], [1, speaking ? 1.04 : 1.015], Extrapolation.CLAMP) },
          { rotate: `${think.value * 3}deg` },
        ],
  }));

  function lockedStop() { setPhase('idle'); active.value = withSpring(0); haptics.success(); onRecordCommit(); }
  function lockedCancel() { setPhase('idle'); active.value = withSpring(0); haptics.warning(); onRecordCancel(); }

  return (
    <View style={[styles.wrap, bounded]}>
      {/* Equipped background scene (shop) behind everything, with a scrim so the
          buddy + controls stay legible over any image. */}
      {backgroundUrl ? (
        <>
          <AppImage source={backgroundUrl} width={800} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,6,26,0.45)' }]} pointerEvents="none" />
        </>
      ) : null}
      {/* Top row: voice-minutes meter (left) + CC caption toggle (right). */}
      <View style={styles.topRow}>
        {usageLabel ? (() => {
          // Two-tier voice-cap warning (doc guardrail): 95% → red, 80% → amber.
          const usageColor =
            usageLevel === 'warn95' ? c.danger : usageLevel === 'warn80' ? c.warning : c.textSecondary;
          return (
            <View style={[styles.usagePill, { backgroundColor: c.surfaceAlt }]}>
              <Ionicons name="mic-outline" size={13} color={usageColor} />
              <AppText variant="caption" color={usageColor}>{usageLabel}</AppText>
            </View>
          );
        })() : <View />}

        <PressableScale
          onPress={onToggleCaptions}
          style={[styles.ccBtn, { backgroundColor: captions ? c.primary : c.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Closed captions"
          accessibilityState={{ selected: captions }}
        >
          <Ionicons name="chatbox-ellipses-outline" size={15} color={captions ? c.white : c.textSecondary} />
          <AppText variant="label" color={captions ? c.white : c.textSecondary} style={styles.ccText}>CC</AppText>
        </PressableScale>
      </View>

      {/* Buddy stage — speech bubble (captions) sits ABOVE the buddy.
          The bubble lives in a FIXED-HEIGHT slot. Its own height used to follow
          its text, so "Thinking…" (one line) and a reply (two or three) left
          different amounts of room below — which resized the buddy's canvas and
          therefore re-fitted the model. The buddy visibly changed size every
          time it started or stopped thinking. A constant slot decouples them. */}
      <View style={styles.stage}>
        {captions && (
          <View style={styles.bubbleSlot}>
            <Animated.View key={thinking ? 'thinking' : greeting} entering={FadeIn.duration(220)} style={[styles.bubble, elevation.md]}>
              {thinking ? (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <AppText variant="body" color={c.textSecondary}>{t('buddyThinking')}</AppText>
                </View>
              ) : (
                <AppText
                  variant="bodyStrong"
                  color={c.text}
                  center
                  // Clamped so a long reply can't grow past the slot and start
                  // pushing the buddy around again.
                  numberOfLines={2}
                  style={styles.bubbleText}
                >
                  {greeting}
                </AppText>
              )}
              <View style={[styles.bubbleTail, { backgroundColor: c.surface }]} />
            </Animated.View>
          </View>
        )}

        <View
          style={styles.buddyWrap}
          onLayout={(e) => setRoomH(e.nativeEvent.layout.height)}
        >
          <Animated.View style={buddyStyle}>
            {/* 2D art shows until the GLB is on screen, then gives way to it —
                the 3D canvas is transparent, so leaving both would overlap. */}
            {ready3d ? null : buddy?.avatarThumbUrl ? (
              <AppImage
                source={{ uri: buddy.avatarThumbUrl }}
                width={Math.round(boxW)}
                style={[styles.buddyImg, { width: boxW, height: boxH }]}
                contentFit="contain"
              />
            ) : (
              <AppText style={styles.buddyEmoji}>{buddy?.name?.charAt(0) ?? '?'}</AppText>
            )}
            {SHOW_3D_AVATAR && !!buddy?.avatarAssetUrl && (
              <BuddyAvatar
                assetUrl={buddy.avatarAssetUrl}
                emotionMap={buddy.emotionMap}
                isSpeaking={speaking}
                // While a turn is processing the face wears the thinking
                // expression; otherwise the emotion the LLM asked for.
                emotion={thinking ? 'thinking' : emotion}
                speechText={speechText}
                speechDurationMs={speechDurationMs}
                visemes={visemes}
                speechPositionMs={speechPositionMs}
                lowPower={thinking}
                onReady={setReady3d}
                style={{ width: boxW, height: boxH }}
              />
            )}
          </Animated.View>
        </View>
      </View>

      {/* Mic control zone */}
      <View style={styles.micZone}>
        {/* Status line: hold hint at idle; hands-free note while locked. */}
        {phase === 'locked' ? (
          <AppText variant="caption" color={c.primary} style={styles.hintRow}>{t('buddyHandsFree')}</AppText>
        ) : recording ? (
          <View style={{ height: 20 }} />
        ) : (
          <AppText variant="caption" color={c.textMuted} style={styles.hintRow}>
            {voiceLimited ? t('voiceMonthEnded') : t('buddyHoldToTalk')}
          </AppText>
        )}

        {phase === 'locked' ? (
          <Animated.View entering={FadeIn} style={styles.lockedRow}>
            <PressableScale onPress={lockedCancel} style={[styles.sideBtn, { backgroundColor: c.surfaceAlt }]}>
              <Ionicons name="trash-outline" size={20} color={c.danger} />
            </PressableScale>
            <PressableScale onPress={lockedStop} style={styles.micBtn}>
              <LinearGradient colors={staticColors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="stop" size={30} color={c.white} />
            </PressableScale>
            <View style={styles.sideBtn}>
              <Ionicons name="lock-closed" size={18} color={c.primary} />
            </View>
          </Animated.View>
        ) : (
          <View style={styles.controlRow}>
            {/* ← cancel (left) · mic (center) · lock → (right) */}
            <Animated.View style={[styles.edgeHint, cancelHintStyle]}>
              {recording && (
                <>
                  <Ionicons name="chevron-back" size={16} color={c.danger} />
                  <Ionicons name="trash-outline" size={18} color={c.danger} />
                </>
              )}
            </Animated.View>

            <View style={styles.micCenter}>
              {recording && <Animated.View style={[styles.micRipple, rippleStyle]} pointerEvents="none" />}
              <GestureDetector gesture={pan}>
                <Animated.View style={[styles.micBtn, micStyle, elevation.float]}>
                  <LinearGradient colors={staticColors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <Ionicons name="mic" size={34} color={c.white} />
                </Animated.View>
              </GestureDetector>
            </View>

            <Animated.View style={[styles.edgeHint, lockHintStyle]}>
              {recording && (
                <>
                  <Ionicons name="lock-closed" size={18} color={c.primary} />
                  <Ionicons name="chevron-forward" size={16} color={c.primary} />
                </>
              )}
            </Animated.View>
          </View>
        )}
      </View>

      {/* Type-to-chat handoff → the separate text-only chat screen. */}
      <PressableScale onPress={onOpenText} style={[styles.typeBar, { backgroundColor: c.surface, borderColor: c.border }, elevation.sm]}>
        <View style={[styles.typeBarLead, { backgroundColor: c.primarySoft }]}>
          <Ionicons name="create-outline" size={24} color={c.primary} />
        </View>
        <AppText variant="bodyStrong" color={c.text} style={styles.typeBarText}>{t('buddyTypeToChat')}</AppText>
        <View style={styles.typeBarIcon}>
          <LinearGradient colors={staticColors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="arrow-forward" size={18} color={c.white} />
        </View>
      </PressableScale>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  // No top padding: the stage below is the buddy's, and it needs the height.
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.lg },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: spacing.lg, minHeight: 30,
  },
  usagePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
  },
  ccBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
  },
  ccText: { letterSpacing: 0.5 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  buddyWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  // Size is applied inline from the window width (see `boxW`/`boxH`).
  buddyImg: {},
  /** The 3D canvas gets more room: the model is fitted with margin inside it. */
  buddyEmoji: { fontSize: ms(156), lineHeight: ms(176) },
  // Constant height, whatever the caption says — see the note at the stage.
  // Bottom-aligned so the tail stays put and short text hangs from the buddy
  // rather than floating in the middle of an obviously empty box.
  bubbleSlot: {
    height: BUBBLE_SLOT_H, width: '100%',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '86%', backgroundColor: c.surface, borderRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.lg,
  },
  bubbleTail: {
    position: 'absolute', bottom: -6, alignSelf: 'center', width: 16, height: 16,
    borderRadius: 3, transform: [{ rotate: '45deg' }],
  },
  bubbleText: { lineHeight: 24 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Tightened from spacing.xl — the buddy is the thing that should have the room.
  micZone: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, minHeight: 120, justifyContent: 'flex-end' },
  hintRow: { height: 20, textAlignVertical: 'center' },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  edgeHint: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 52, justifyContent: 'center' },
  micCenter: { alignItems: 'center', justifyContent: 'center' },
  micRipple: {
    position: 'absolute', width: 76, height: 76, borderRadius: radius.full,
    backgroundColor: c.primary,
  },
  micBtn: {
    width: 76, height: 76, borderRadius: radius.full, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  sideBtn: {
    width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
  },
  typeBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: '90%',
    borderRadius: radius.full, borderWidth: 1, paddingLeft: spacing.xs, paddingRight: spacing.xs, paddingVertical: spacing.xs, height: 58,
  },
  typeBarLead: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  typeBarText: { flex: 1 },
  typeBarIcon: {
    width: 40, height: 40, borderRadius: radius.full, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
});
