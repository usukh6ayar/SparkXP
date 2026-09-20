import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSpring,
  interpolate, Extrapolation, runOnJS, cancelAnimation, FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { BuddyAvatar } from './BuddyAvatar';
import type { VisemeCue } from './azureVisemes';
import { SHOW_3D_AVATAR } from '../lib/buddyAvatarFlag';
import { cachedBuddyAssetUri } from '../lib/buddyAssetCache';
import { PressableScale } from './PressableScale';
import { haptics } from '../lib/haptics';
import { useColors, useSettings } from '../settings/SettingsContext';
import { spacing, radius, elevation, colors as staticColors, type AppColors } from '../theme/theme';
import { ms, bounded } from '../theme/responsive';
import { GLASS, GLASS_EDGE, ON_ART_SHADOW } from '../theme/onArt';
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
  captions, onRecordStart, onRecordCommit, onRecordCancel, onOpenText,
  emotion, gesture, speechText, speechDurationMs, visemes, getPositionMs,
}: {
  buddy: Buddy | null;
  /** LLM emotion tag for the last reply → drives the 3D face expression. */
  emotion?: string;
  /** LLM gesture tag for the last reply (wave, small_nod, …) → played once. */
  gesture?: string;
  /** Reply text → the 3D avatar derives its mouth shapes from it. */
  speechText?: string | null;
  /** Real audio length so the mouth keeps pace with the voice. */
  speechDurationMs?: number | null;
  /** Timed viseme cues for the reply audio (empty = derive them from the text). */
  visemes?: VisemeCue[] | null;
  /**
   * Reads the reply audio's live position in ms — the lip-sync master clock.
   * A function, not a value, so the avatar can sample it every frame without
   * re-rendering this screen (see `BuddyAvatar`). `null` = no player to follow.
   */
  getPositionMs?: () => number | null;
  greeting: string;
  speaking: boolean;
  thinking: boolean;
  voiceLimited?: boolean;
  /** "3.5 / 25 мин" — voice minutes are only spent (and shown) on this screen. */
  usageLabel?: string;
  /** Voice-cap warning tier (doc guardrail): amber at 80%, red at 95%. */
  usageLevel?: 'none' | 'warn80' | 'warn95';
  /** Closed captions: when off, the buddy's spoken text is hidden. The toggle
   *  itself lives in the header (`CaptionToggle`). */
  captions: boolean;
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
  /** This buddy HAS a 3D model — whether or not it has finished loading yet. */
  const has3d = SHOW_3D_AVATAR && !!buddy?.avatarAssetUrl;
  /**
   * Is this the one-time download, or a read off the disk?
   *
   * The avatar is a downloadable game resource: tens of megabytes the first
   * time and nothing at all afterwards (`buddyAssetCache`). Those are minutes
   * apart on a slow connection, so the wait says which one the student is
   * actually in rather than "Уншиж байна…" for both.
   *
   * Asked once per buddy, when the wait begins — a synchronous directory
   * lookup, no network and no state machine to keep in sync with the loader.
   */
  const downloading = useMemo(
    () => (buddy?.avatarAssetUrl ? !cachedBuddyAssetUri(buddy.avatarAssetUrl) : false),
    [buddy?.avatarAssetUrl],
  );

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
  const avatarBox = useMemo(() => ({ width: boxW, height: boxH }), [boxW, boxH]);
  const ripple = useSharedValue(0); // expanding mic rings while recording
  const didLock = useSharedValue(false); // fire lock() once per gesture, not per frame

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
  /**
   * The buddy does not move — not the 3D avatar, and not the 2D fallback.
   * Transforming a GL surface every frame makes it swim and shear, and with the
   * library behind it every bob read as the character sliding around in FRONT
   * of a photograph instead of standing inside a room.
   */
  const buddyStyle = useAnimatedStyle(() => ({ transform: [] }));

  function lockedStop() { setPhase('idle'); active.value = withSpring(0); haptics.success(); onRecordCommit(); }
  function lockedCancel() { setPhase('idle'); active.value = withSpring(0); haptics.warning(); onRecordCancel(); }

  return (
    <View style={[styles.wrap, bounded]}>
      {/* The voice-minutes meter, shown ONLY once it is a warning (80% / 95%).
          It used to sit here permanently, reading "3.0 мин" at the top of an
          otherwise clean scene. The caption toggle that shared this row now
          lives in the header. */}
      {usageLabel && (usageLevel === 'warn80' || usageLevel === 'warn95') ? (
        <View style={styles.topRow}>
          <View style={styles.usagePill}>
            <Ionicons name="mic-outline" size={13} color={usageLevel === 'warn95' ? c.danger : c.warning} />
            <AppText variant="caption" color={usageLevel === 'warn95' ? c.danger : c.warning}>
              {usageLabel}
            </AppText>
          </View>
        </View>
      ) : null}

      {/* Buddy stage — speech bubble (captions) sits ABOVE the buddy.
          The bubble lives in a FIXED-HEIGHT slot. Its own height used to follow
          its text, so "Thinking…" (one line) and a reply (two or three) left
          different amounts of room below — which resized the buddy's canvas and
          therefore re-fitted the model. The buddy visibly changed size every
          time it started or stopped thinking. A constant slot decouples them. */}
      <View style={styles.stage}>
        {/* The slot is ALWAYS here, captions or not. It only holds the bubble
            when captions are on — but if it disappeared, the buddy's canvas
            would grow by its height and the model would be re-fitted larger.
            Toggling CC is a caption preference; it must not resize the buddy. */}
        <View style={styles.bubbleSlot}>
          {captions && (
            <Animated.View key={thinking ? 'thinking' : greeting} entering={FadeIn.duration(220)} style={[styles.bubble, elevation.md]}>
              {thinking ? (
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <AppText variant="body" color={c.textOnDark}>{t('buddyThinking')}</AppText>
                </View>
              ) : (
                <AppText variant="bodyStrong" color={c.textOnDark} center style={styles.bubbleText}>
                  {greeting}
                </AppText>
              )}
            </Animated.View>
          )}
        </View>

        <View
          style={styles.buddyWrap}
          onLayout={(e) => setRoomH(e.nativeEvent.layout.height)}
        >
          <Animated.View style={buddyStyle}>
            {/* Waiting for the character. The admin thumbnail used to fill this
                gap, but it is the PICKER's artwork — showing it here flashed a
                flat 2D picture and then swapped it for the 3D character, two
                different-looking buddies in a row. A plain "loading" state says
                what is actually happening instead of pretending to be the buddy.

                The GLB is tens of megabytes, so the FIRST entry on this device
                genuinely waits. After that it is read from the device's own
                storage (`buddyAssetCache`) on every later launch, and from
                `modelCache` within a session — neither touches the network. */}
            {has3d && !ready3d && (
              <View style={[styles.avatarLoading, { width: boxW, height: boxH }]}>
                <ActivityIndicator size="large" color={c.primary} />
                <AppText variant="caption" color={c.textMuted}>
                  {downloading ? t('buddyDownloading') : t('loading')}
                </AppText>
              </View>
            )}

            {/* Only a buddy with NO 3D model at all falls back to its picture —
                there is nothing else coming for it to wait for. */}
            {!has3d && (buddy?.avatarThumbUrl ? (
              <AppImage
                source={{ uri: buddy.avatarThumbUrl }}
                width={Math.round(boxW)}
                style={[styles.buddyImg, { width: boxW, height: boxH }]}
                contentFit="contain"
              />
            ) : (
              <AppText style={styles.buddyEmoji}>{buddy?.name?.charAt(0) ?? '?'}</AppText>
            ))}
            {SHOW_3D_AVATAR && !!buddy?.avatarAssetUrl && (
              <BuddyAvatar
                assetUrl={buddy.avatarAssetUrl}
                emotionMap={buddy.emotionMap}
                isSpeaking={speaking}
                // While a turn is processing the face wears the thinking
                // expression; otherwise the emotion the LLM asked for.
                emotion={thinking ? 'thinking' : emotion}
                gesture={gesture}
                speechText={speechText}
                speechDurationMs={speechDurationMs}
                visemes={visemes}
                getPositionMs={getPositionMs}
                lowPower={thinking}
                onReady={setReady3d}
                // Memoized so the memoized avatar actually stays memoized: a
                // fresh style object every render would defeat it on its own.
                style={avatarBox}
              />
            )}
          </Animated.View>
        </View>

        {/* The character is a BUST: the art (and the GLB) stops at the chest,
            and that straight cut lands in open floor, where it reads as a
            sticker laid on the photograph. Two layers hide it:
              · a BLUR band, so whatever the cut falls across stops being
                readable — it reads as a surface IN FRONT of the buddy;
              · a long, many-stopped gradient over the blur, so the top of the
                blur lands where the darkening is already well underway. A blur
                band alone draws a hard line exactly where it begins.

            ⚠️ It runs PAST the bottom of the stage (`bottom: -FADE_TAIL`),
            behind the mic and the type bar. Confined to the stage it ended in a
            second hard line of its own. The controls are later siblings, so
            they still draw on top. Sizes are a share of the buddy's own box,
            never fixed points, so it survives a screen it was not tuned on. */}
        {(() => {
          const soft = Math.round(boxH * 0.26);
          const total = soft + FADE_TAIL;
          const k = soft / total;
          return (
            <View style={[styles.characterFade, { height: total, bottom: -FADE_TAIL }]} pointerEvents="none">
              <BlurView intensity={34} tint="dark" style={[styles.characterBlur, { top: Math.round(soft * 0.45) }]} />
              <LinearGradient
                colors={CHARACTER_FADE}
                locations={[0, k * 0.35, k * 0.7, k, 1]}
                style={StyleSheet.absoluteFill}
              />
            </View>
          );
        })()}
      </View>

      {/* Mic control zone */}
      <View style={styles.micZone}>
        {/* Status line: hold hint at idle; hands-free note while locked. */}
        {phase === 'locked' ? (
          <AppText variant="caption" color={c.textOnDark} style={styles.hintRow}>{t('buddyHandsFree')}</AppText>
        ) : recording ? (
          <View style={{ height: 20 }} />
        ) : (
          <AppText variant="caption" color={c.textOnDark} style={styles.hintRow}>
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
              {/* Decorative halo, OUTSIDE the gesture so it cannot change what
                  the finger has to hit. */}
              <View style={[styles.micGlow, recording && styles.micGlowLive]} pointerEvents="none" />
              <GestureDetector gesture={pan}>
                <Animated.View style={[styles.micBtn, micStyle, elevation.float, styles.micRing]}>
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
      <PressableScale onPress={onOpenText} style={[styles.typeBar, elevation.sm]}>
        <View style={styles.typeBarLead}>
          <Ionicons name="create-outline" size={20} color={c.textOnDark} />
        </View>
        <AppText variant="body" color={c.textOnDark} style={styles.typeBarText}>
          {t('buddyTypeMessage')}
        </AppText>
        <View style={styles.typeBarIcon}>
          <LinearGradient colors={staticColors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Ionicons name="send" size={16} color={c.white} />
        </View>
      </PressableScale>
    </View>
  );
}

/**
 * Transparent → the scrim's own tone. FIVE stops, not two: a long ramp of one
 * hue bands visibly on a 24-bit screen, and banding lines read as edges — the
 * one thing this gradient exists to remove. Tuned against `BuddyBackdrop`:
 * together they must never reach opaque, or the floor goes with the edge.
 */
const CHARACTER_FADE = [
  'rgba(10,6,26,0)',
  'rgba(10,6,26,0.18)',
  'rgba(10,6,26,0.46)',
  'rgba(10,6,26,0.68)',
  'rgba(10,6,26,0.80)',
] as const;
/** How far the blur carries on below the stage. It only has to reach the
 *  bottom of the screen; past that it is clipped and costs nothing. */
const FADE_TAIL = 340;

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
    backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_EDGE,
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  characterFade: { position: 'absolute', left: 0, right: 0 },
  characterBlur: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  buddyWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  // Size is applied inline from the window width (see `boxW`/`boxH`).
  buddyImg: {},
  avatarLoading: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  /** The 3D canvas gets more room: the model is fitted with margin inside it. */
  buddyEmoji: { fontSize: ms(156), lineHeight: ms(176) },
  // Constant height, whatever the caption says — see the note at the stage.
  // Bottom-aligned so the tail stays put and short text hangs from the buddy
  // rather than floating in the middle of an obviously empty box.
  bubbleSlot: {
    height: BUBBLE_SLOT_H, width: '100%',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  // Glass, not a themed card: it sits on the library art. ABSOLUTE and anchored
  // to the slot's bottom so it grows UPWARD — toward the header, never over the
  // buddy's face — and never reaches the layout. That is what lets the caption
  // show in full: the two-line clamp existed only so it could not resize the
  // buddy's canvas, which it now cannot do at any length.
  bubble: {
    position: 'absolute', bottom: spacing.lg,
    maxWidth: '86%', backgroundColor: GLASS, borderRadius: radius.xl,
    borderWidth: 1, borderColor: GLASS_EDGE,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  bubbleText: { lineHeight: 24 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Tightened from spacing.xl — the buddy is the thing that should have the room.
  micZone: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, minHeight: 120, justifyContent: 'flex-end' },
  // Shadow, not a pill: the hint must read over a sunlit floor as well as a
  // dark shelf. `textOnDark` because it is the only bare text on the screen.
  hintRow: { height: 20, textAlignVertical: 'center', ...ON_ART_SHADOW },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  edgeHint: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 52, justifyContent: 'center' },
  micCenter: { alignItems: 'center', justifyContent: 'center' },
  micRipple: {
    position: 'absolute', width: 76, height: 76, borderRadius: radius.full,
    backgroundColor: c.primary,
  },
  // `shadowColor` is the brand purple, not black: a coloured glow, not a drop
  // shadow, so the control looks like it lights the floor it sits on.
  micGlow: {
    position: 'absolute', width: 96, height: 96, borderRadius: radius.full,
    backgroundColor: 'rgba(108,59,255,0.28)',
    shadowColor: c.primary, shadowOpacity: 0.85, shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  micGlowLive: { backgroundColor: 'rgba(108,59,255,0.45)', shadowRadius: 34 },
  micBtn: {
    width: 76, height: 76, borderRadius: radius.full, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  // A rim on the button itself — the gesture target is unchanged.
  micRing: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  sideBtn: {
    width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
  },
  typeBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: '90%',
    borderRadius: radius.full, borderWidth: 1,
    backgroundColor: GLASS, borderColor: GLASS_EDGE,
    paddingLeft: spacing.xs, paddingRight: spacing.xs, paddingVertical: spacing.xs, height: 58,
  },
  typeBarLead: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  typeBarText: { flex: 1, opacity: 0.85 },
  typeBarIcon: {
    width: 40, height: 40, borderRadius: radius.full, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
});
