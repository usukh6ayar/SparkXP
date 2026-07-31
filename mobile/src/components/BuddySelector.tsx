import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Dimensions, StyleSheet, Pressable, FlatList, ActivityIndicator, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle, useAnimatedScrollHandler, useSharedValue,
  interpolate, interpolateColor, Extrapolation, FadeIn, FadeOut, type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { BuddyAvatar } from './BuddyAvatar';
import { Pill } from './Pill';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { BuddyUnlockSheet } from './BuddyUnlockSheet';
import { haptics } from '../lib/haptics';
import { SHOW_3D_AVATAR } from '../lib/buddyAvatarFlag';
import { useAuth } from '../auth/AuthContext';
import { useColors, useSettings } from '../settings/SettingsContext';
import { tf } from '../i18n';
import type { TranslationKey } from '../i18n';
import { spacing, radius, elevation, tints, colors as staticColors, type AppColors } from '../theme/theme';
import { CONTENT_MAX_WIDTH } from '../theme/responsive';
import type { Buddy } from '../api/ai';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
// On tablets, size the carousel off a capped width so cards stay phone-sized
// (a card is 60% of this, then SIDE_PAD centers it on the real screen).
const BASE_W = Math.min(SCREEN_W, CONTENT_MAX_WIDTH);
// Narrower card + tighter gap so the neighbouring buddies peek in further on
// both sides (the carousel reads as a "coverflow", not a single card). The tall
// 1.46 ratio keeps the panel portrait (not a boxy square) with room for a
// standing character.
//
// Height is capped by an ABSOLUTE reservation for the chrome + everything below
// the card (TopBar, tab bar, insets, motto, dots, name, the single-row tag strip
// and the Apply CTA), with margin to spare. A fraction of the screen wasn't
// enough on shorter phones, so the fixed-height card overflowed its flex slot and
// punched down into the dots / name. Reserving a fixed budget keeps the card fit
// and non-overlapping on every device. Width is derived back from the 1.46 ratio.
const CARD_RESERVED_H = 500;
const CARD_HEIGHT = Math.max(190, Math.min(Math.round(BASE_W * 0.6 * 1.46), SCREEN_H - CARD_RESERVED_H));
const CARD_WIDTH = Math.round(CARD_HEIGHT / 1.46);
const CARD_GAP = spacing.xs;
const SNAP = CARD_WIDTH + CARD_GAP;
const SIDE_PAD = (SCREEN_W - CARD_WIDTH) / 2;
const MOTTO_LINE_HEIGHT = 23;
/** Pill-soft corners — a plain rounded rect still read as "boxy". */
const CARD_RADIUS = 38;
/** Vertical breathing room inside the horizontal list so each card's shadow has
 *  space to fully fade before the list frame — otherwise the frame clips it into
 *  a hard line. Must exceed the shadow reach (offset + ~1.5×radius ≈ 30). The
 *  list is grown by this top+bottom and pulled back with a negative margin, so
 *  surrounding layout is unchanged. */
const SHADOW_PAD = 40;

// Soft lavender card panels (match the reference mockup): the active buddy sits
// on a brighter periwinkle→white gradient; the peek cards use a flatter, lighter
// lavender so the centered one clearly reads as "spotlit".
const CARD_BG_ACTIVE = ['#D8CBF3', '#F7F4FD'] as const;
const CARD_BG_IDLE = ['#ECE6F9', '#F4F0FB'] as const;

/** Placeholder unlock price until Usukhbayar's backend sends a real one. */
const DEFAULT_UNLOCK_COST = 500;
/**
 * The real admin-managed default buddy — kept always unlocked so it can be
 * tested end-to-end without spending Sparks (the unlock flow is still a
 * client-only placeholder). Remove once the backend sends real `isLocked`.
 */
const POLICE_SLUG = 'police';
/**
 * Nothing is gated server-side yet: the backend sends no `isLocked` and the
 * unlock sheet doesn't spend Sparks (see BuddyUnlockSheet). So the invented
 * lock only runs in dev — where it exercises the design against the mock
 * roster. In production every real buddy admin publishes stays open rather
 * than showing a fake 500-Spark price it can't actually charge.
 */
const DEMO_LOCKING = __DEV__;
/** Dark text on the gold Unlock button — white would have poor contrast on `colors.xp`. */
const UNLOCK_TEXT_COLOR = '#402D00';

// Shadows sit on each card and SCROLL WITH IT (no static element that swiping
// would slide off of and expose). Two tiers so peek→center isn't an abrupt jump:
// every card gets a gentle drop; the centered one a stronger glow. The COLOR is
// set per-card (see HALO_COLORS) — these presets only carry radius/opacity/
// offset, kept tight enough to fully fade within SHADOW_PAD (no clip line).
const CARD_SHADOW = Platform.select({
  ios: { shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 5 },
  default: {},
});
const CARD_HALO = Platform.select({
  ios: { shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 12 },
  default: {},
});
/** Each buddy card gets its own glow colour, cycled by position. */
const HALO_COLORS = ['#9D7BFF', '#4FC3F7', '#FF8A3D', '#34D399', '#F472B6', '#FFC93C'];

/**
 * Buddy fields the backend doesn't send yet (personality/motto/lock/price —
 * see Buddy in src/api/ai.ts). Applied per-buddy so the screen works today
 * against the real `police` buddy and keeps working once real fields land —
 * at that point `buddy.xxx ?? default` just prefers the real value.
 * Takes `t` as a param (rather than the module import) so results re-derive
 * whenever the app language changes, not just once at import time.
 */
function withDefaults(buddy: Buddy, index: number, t: (key: TranslationKey) => string) {
  return {
    ...buddy,
    personalityTags: buddy.personalityTags ?? [t('traitFriendly'), t('traitPatient'), t('traitEncouraging')],
    motto: buddy.motto ?? t('defaultBuddyMotto'),
    isLocked: buddy.isLocked ?? (DEMO_LOCKING && index > 0 && buddy.slug !== POLICE_SLUG),
    unlockCostSparks: buddy.unlockCostSparks ?? DEFAULT_UNLOCK_COST,
  };
}

export function BuddySelector({
  buddies,
  onApply,
  loading = false,
  error = false,
  errorDetail,
  onRetry,
}: {
  buddies: Buddy[];
  onApply: (buddy: Buddy) => void;
  /** True while the buddy list is being fetched — shows a spinner instead of an empty carousel. */
  loading?: boolean;
  /** True if the fetch failed — shows a retry state instead of silently rendering nothing. */
  error?: boolean;
  /** Raw error message (e.g. "401 Unauthorized") shown under the friendly copy, for debugging. */
  errorDetail?: string | null;
  onRetry?: () => void;
}) {
  const c = useColors();
  const { lang, t } = useSettings();
  const { user } = useAuth();

  // `t`'s function reference never changes (it just reads the current
  // language internally), so `lang` — not `t` — is what must drive these
  // memos to recompute after a language switch.
  const display = useMemo(() => buddies.map((b, i) => withDefaults(b, i, t)), [buddies, lang]);
  const traitIcons = useMemo<Record<string, keyof typeof Ionicons.glyphMap>>(() => ({
    [t('traitFriendly')]: 'happy-outline',
    [t('traitPatient')]: 'hourglass-outline',
    [t('traitEncouraging')]: 'flame-outline',
    [t('traitWise')]: 'bulb-outline',
    [t('traitMotivating')]: 'trending-up-outline',
    [t('traitFocused')]: 'locate-outline',
    [t('traitCalm')]: 'leaf-outline',
    [t('traitCaring')]: 'heart-outline',
    [t('traitBrave')]: 'shield-outline',
    [t('traitStrong')]: 'fitness-outline',
  }), [lang]);
  const traitTints = useMemo<Record<string, { bg: string; fg: string }>>(() => ({
    [t('traitFriendly')]: tints.amber,
    [t('traitPatient')]: tints.pink,
    [t('traitEncouraging')]: tints.coral,
    [t('traitWise')]: tints.blue,
    [t('traitMotivating')]: tints.green,
    [t('traitFocused')]: tints.teal,
    [t('traitCalm')]: tints.green,
    [t('traitCaring')]: tints.pink,
    [t('traitBrave')]: tints.purple,
    [t('traitStrong')]: tints.orange,
  }), [lang]);
  // Infinite loop: pad the real data with a clone of the last item up front
  // and a clone of the first item at the end. Swiping past either edge lands
  // on a clone that looks identical to the real item it mimics, so we can
  // silently (unanimated) snap the scroll position back into the real range
  // — the "wrap" is invisible to the user instead of a jarring hard cut.
  const loopData = useMemo(
    () => (display.length > 1 ? [display[display.length - 1], ...display, display[0]] : display),
    [display],
  );
  const [unlockedSlugs, setUnlockedSlugs] = useState<Set<string>>(new Set());
  const [centerIndex, setCenterIndex] = useState(0);
  const [speakingSlug, setSpeakingSlug] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<Buddy | null>(null);
  // Matches initialScrollIndex below (1 when looping) so the first frame's
  // card scale/opacity isn't computed against the wrong (pre-scroll) offset.
  const scrollX = useSharedValue(display.length > 1 ? SNAP : 0);
  const listRef = useRef<FlatList<ReturnType<typeof withDefaults>>>(null);

  const centerBuddy = display[centerIndex] ?? null;
  const isLocked = !!centerBuddy?.isLocked && !unlockedSlugs.has(centerBuddy.slug);

  useEffect(() => () => { Speech.stop(); }, []);

  /**
   * Greet ONCE on arrival, then stay quiet while swiping.
   *
   * `aac2f54` removed auto-speak entirely because it fired on every centered
   * buddy, so the carousel talked over itself on each swipe. The hello on entry
   * was the half worth keeping — `greetedRef` is what separates the two.
   */
  const [focused, setFocused] = useState(false);
  const greetedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        // This tab stays mounted, so leaving it would otherwise keep talking.
        // Re-arm the greeting too: coming back counts as arriving again.
        setFocused(false);
        greetedRef.current = false;
        Speech.stop();
        setSpeakingSlug(null);
      };
    }, []),
  );

  useEffect(() => {
    if (!focused || greetedRef.current || !centerBuddy) return;
    greetedRef.current = true;
    speak(centerBuddy.motto);
    // `speak` is a stable function declaration below; re-running this on every
    // centered buddy is exactly what we are avoiding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, centerBuddy]);

  function speak(text: string) {
    if (!centerBuddy) return;
    Speech.stop();
    setSpeakingSlug(centerBuddy.slug);
    Speech.speak(text, {
      language: lang === 'mn' ? 'mn-MN' : 'en-US',
      onDone: () => setSpeakingSlug((s) => (s === centerBuddy.slug ? null : s)),
      onStopped: () => setSpeakingSlug((s) => (s === centerBuddy.slug ? null : s)),
      onError: () => setSpeakingSlug((s) => (s === centerBuddy.slug ? null : s)),
    });
  }

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  function handleMomentumEnd(offsetX: number) {
    const loopIdx = Math.round(offsetX / SNAP);

    if (display.length > 1) {
      if (loopIdx <= 0) {
        // Landed on the prepended "last item" clone — snap to the real last,
        // no animation so the identical-looking clone/real swap is invisible.
        listRef.current?.scrollToOffset({ offset: display.length * SNAP, animated: false });
        setCenterIndex(display.length - 1);
        haptics.select();
        return;
      }
      if (loopIdx >= display.length + 1) {
        // Landed on the appended "first item" clone — snap to the real first.
        listRef.current?.scrollToOffset({ offset: SNAP, animated: false });
        setCenterIndex(0);
        haptics.select();
        return;
      }
      setCenterIndex(loopIdx - 1);
      haptics.select();
      return;
    }

    setCenterIndex(Math.min(display.length - 1, Math.max(0, loopIdx)));
    haptics.select();
  }

  /** Scroll to a real-data index, wrapping around at either end (prev of first → last, next of last → first). */
  function scrollToIndex(idx: number) {
    if (display.length === 0) return;
    const wrapped = ((idx % display.length) + display.length) % display.length;
    const loopPos = display.length > 1 ? wrapped + 1 : wrapped;
    listRef.current?.scrollToOffset({ offset: loopPos * SNAP, animated: true });
    setCenterIndex(wrapped);
  }

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (error || display.length === 0) {
    return (
      <View style={styles.centerFill}>
        <Ionicons name="alert-circle-outline" size={28} color={c.textSecondary} />
        <AppText variant="body" color={c.textSecondary} center>
          {t('buddyLoadError')}
        </AppText>
        {error && !!errorDetail && (
          <AppText variant="caption" color={c.textMuted} center>{errorDetail}</AppText>
        )}
        {onRetry && (
          <Button label={t('retry')} onPress={onRetry} variant="secondary" size="md" fullWidth={false} style={styles.retryBtn} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {centerBuddy && (
        <Pressable onPress={() => speak(centerBuddy.motto)} style={styles.mottoBubbleWrap}>
          <View style={[styles.mottoBubble, { backgroundColor: c.surface }, elevation.sm]}>
            <View style={[styles.mottoIconCircle, { backgroundColor: c.primary }]}>
              <Ionicons name={speakingSlug === centerBuddy.slug ? 'volume-high' : 'volume-medium'} size={14} color={c.white} />
            </View>
            <Animated.View key={centerBuddy.slug} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={styles.mottoTextWrap}>
              <AppText variant="bodyStrong" color={c.text} numberOfLines={2} style={styles.mottoBubbleText}>
                {centerBuddy.motto}
              </AppText>
            </Animated.View>
          </View>
          <View style={[styles.mottoTail, { backgroundColor: c.surface }]} />
        </Pressable>
      )}

      <View style={styles.carouselFlex}>
      <View style={styles.carouselRow}>
        <Animated.FlatList
          ref={listRef}
          data={loopData}
          horizontal
          keyExtractor={(b, i) => `${b.slug}-${i}`}
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP}
          decelerationRate="fast"
          style={styles.carousel}
          contentContainerStyle={{ paddingHorizontal: SIDE_PAD, paddingVertical: SHADOW_PAD }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({ length: SNAP, offset: SNAP * index, index })}
          initialScrollIndex={display.length > 1 ? 1 : 0}
          onMomentumScrollEnd={(e) => handleMomentumEnd(e.nativeEvent.contentOffset.x)}
          renderItem={({ item, index }) => {
            // Map the loop index back to the real data index so each buddy keeps
            // one stable glow colour (its front/back clones match it too).
            const realIdx = display.length > 1 ? (index - 1 + display.length) % display.length : index;
            return (
              <BuddyCard
                buddy={item}
                index={index}
                scrollX={scrollX}
                haloColor={HALO_COLORS[realIdx % HALO_COLORS.length]}
                isCenter={index === (display.length > 1 ? centerIndex + 1 : centerIndex)}
                isSpeaking={speakingSlug === item.slug}
              />
            );
          }}
        />

        {display.length > 1 && (
          <Pressable style={[styles.navBtn, styles.navBtnLeft, { backgroundColor: c.surface }]} onPress={() => scrollToIndex(centerIndex - 1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
        )}
        {display.length > 1 && (
          <Pressable style={[styles.navBtn, styles.navBtnRight, { backgroundColor: c.surface }]} onPress={() => scrollToIndex(centerIndex + 1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </Pressable>
        )}
      </View>
      </View>

      {display.length > 1 && (
        <View style={styles.dots}>
          {display.map((b, i) => (
            <Dot key={b.slug} index={display.length > 1 ? i + 1 : i} scrollX={scrollX} colors={c} />
          ))}
        </View>
      )}

      {centerBuddy && (
        // Keyed by slug so switching buddies crossfades the whole panel
        // (name/tags/CTA) instead of the text hard-cutting the instant
        // centerIndex updates — matches the smooth card scale/opacity above.
        <Animated.View key={centerBuddy.slug} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={styles.infoPanel}>
          <View style={styles.nameRow}>
            <AppText variant="h1" numberOfLines={1} style={styles.nameText} center>{centerBuddy.name}</AppText>
            {isLocked ? (
              <Pill label={t('buddyLocked')} icon="lock-closed" bg={tints.amber.bg} fg={tints.amber.fg} />
            ) : null}
            {/* Hide the play button while locked (nothing to preview yet); once
                unlocked it fades cleanly back into the same spot. */}
            {!isLocked && (
              <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(120)}>
                <Pressable
                  onPress={() => speak(centerBuddy.motto)}
                  hitSlop={8}
                  style={[styles.soundBtn, { backgroundColor: c.surface }, elevation.sm]}
                >
                  <Ionicons
                    name={speakingSlug === centerBuddy.slug ? 'volume-high' : 'volume-medium-outline'}
                    size={24}
                    color={c.primary}
                  />
                </Pressable>
              </Animated.View>
            )}
          </View>

          <View style={styles.tagsRow}>
            {centerBuddy.personalityTags.map((tag) => {
              const tint = traitTints[tag] ?? tints.purple;
              return (
                <TraitChip key={tag} label={tag} icon={traitIcons[tag] ?? 'sparkles-outline'} tint={tint} />
              );
            })}
          </View>

          {isLocked ? (
            <UnlockCTAButton
              label={tf('buddyUnlockFor', { n: centerBuddy.unlockCostSparks ?? DEFAULT_UNLOCK_COST })}
              onPress={() => setUnlockTarget(centerBuddy)}
            />
          ) : (
            <ApplyBuddyButton label={t('buddyApply')} onPress={() => onApply(centerBuddy)} colors={c} />
          )}
        </Animated.View>
      )}

      <BuddyUnlockSheet
        visible={!!unlockTarget}
        buddy={unlockTarget}
        sparksBalance={user?.sparks ?? 0}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={(b) => {
          setUnlockedSlugs((prev) => new Set(prev).add(b.slug));
          setUnlockTarget(null);
        }}
      />
    </View>
  );
}

/** Pill-shaped page indicator dot that grows + brightens as its card nears center, driven by live scroll position (not just the settled `centerIndex`) so it tracks the drag as smoothly as the cards do. */
function Dot({ index, scrollX, colors: c }: { index: number; scrollX: SharedValue<number>; colors: AppColors }) {
  const style = useAnimatedStyle(() => {
    const pos = scrollX.value / SNAP - index;
    const width = interpolate(pos, [-1, 0, 1], [6, 20, 6], Extrapolation.CLAMP);
    const opacity = interpolate(pos, [-1, 0, 1], [0.45, 1, 0.45], Extrapolation.CLAMP);
    const backgroundColor = interpolateColor(pos, [-1, 0, 1], [c.borderStrong, c.primary, c.borderStrong]);
    return { width, opacity, backgroundColor };
  });
  return <Animated.View style={[dotStyles.dot, style]} />;
}

const dotStyles = StyleSheet.create({
  dot: { height: 6, borderRadius: 3 },
});

function BuddyCard({
  buddy, index, scrollX, haloColor, isCenter, isSpeaking,
}: {
  buddy: ReturnType<typeof withDefaults>;
  index: number;
  scrollX: SharedValue<number>;
  haloColor: string;
  isCenter: boolean;
  isSpeaking: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const cardStyle = useAnimatedStyle(() => {
    const pos = scrollX.value / SNAP - index;
    const scale = interpolate(pos, [-1, 0, 1], [0.82, 1, 0.82], Extrapolation.CLAMP);
    const opacity = interpolate(pos, [-1, 0, 1], [0.55, 1, 0.55], Extrapolation.CLAMP);
    // Anchor the scale to the card's BOTTOM edge so every buddy "stands" on the
    // same ground line. Scaling around the centre (the default) made the peek
    // cards float up/down as they grew/shrank while swiping — uneven levels.
    // translateY cancels the centre-scale's vertical shift so the bottom stays put.
    const translateY = (CARD_HEIGHT * (1 - scale)) / 2;
    return { transform: [{ translateY }, { scale }], opacity };
  });

  // Only the centered card mounts the 3D model (perf: avoid several live GL
  // canvases at once, and peek cards are scaled down anyway). It renders on
  // top of the 2D fallback, which stays visible as a placeholder while the
  // GLB streams in and decodes. SHOW_3D_AVATAR is off for now (see
  // buddyAvatarFlag.ts) — emoji/thumb is the deliberate primary rendering
  // until the GLB texture pipeline is fixed and verified.
  const show3d = SHOW_3D_AVATAR && isCenter && !!buddy.avatarAssetUrl;

  return (
    <Animated.View style={[styles.cardSlot, cardStyle]}>
      {/* Two nested views on purpose: the shadow lives on cardGlow (a plain view
          with NO overflow — iOS clips a view's own shadow when overflow:hidden),
          while the inner card clips the gradient/art to the rounded corners. */}
      <View style={[styles.cardGlow, isCenter && styles.cardGlowActive, { shadowColor: haloColor }]}>
        <View style={styles.card}>
          <LinearGradient
            colors={isCenter ? CARD_BG_ACTIVE : CARD_BG_IDLE}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {buddy.avatarThumbUrl && !imgFailed ? (
            // `contain` so the character stands on the lavender panel with the
            // gradient showing around it (like the reference), instead of the
            // art being cropped edge-to-edge. Falls back to the emoji if the
            // remote asset is broken/unreachable.
            <AppImage
              source={{ uri: buddy.avatarThumbUrl }}
              width={CARD_WIDTH}
              style={styles.cardAvatarFill}
              contentFit="contain"
              onError={() => {
                console.warn('BuddyCard: failed to load avatarThumbUrl', buddy.slug, buddy.avatarThumbUrl);
                setImgFailed(true);
              }}
            />
          ) : (
            <AppText style={styles.cardEmoji}>{buddy.emoji}</AppText>
          )}
          {show3d && (
            <BuddyAvatar
              assetUrl={buddy.avatarAssetUrl}
              emotionMap={buddy.emotionMap}
              isSpeaking={isSpeaking}
              style={styles.cardAvatarFill}
            />
          )}
          {buddy.isLocked && (
            // Centered translucent lock disc with a thin white ring (reference).
            <View style={styles.cardLockBadge} pointerEvents="none">
              <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

/** Pill-shaped CTA with a trailing circular arrow badge (matches the reference mockup). */
function ApplyBuddyButton({ label, onPress, colors: c }: { label: string; onPress: () => void; colors: AppColors }) {
  return (
    <PressableScale onPress={onPress} style={[styles.applyBtn, elevation.md]}>
      <LinearGradient
        colors={c.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius.full }]}
      />
      <AppText variant="bodyStrong" color={c.white} style={styles.applyBtnLabel}>{label}</AppText>
      <View style={[styles.applyBtnArrow, { backgroundColor: c.white }]}>
        <Ionicons name="arrow-forward" size={18} color={c.primary} />
      </View>
    </PressableScale>
  );
}

/** Gold pill CTA for locked buddies — sits where Apply Buddy goes, opens the unlock sheet. */
function UnlockCTAButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.applyBtn, { backgroundColor: staticColors.xp }, elevation.md]}>
      <Ionicons name="lock-closed" size={18} color={UNLOCK_TEXT_COLOR} style={styles.unlockCtaIcon} />
      <AppText variant="bodyStrong" color={UNLOCK_TEXT_COLOR} style={styles.applyBtnLabel}>{label}</AppText>
    </PressableScale>
  );
}

/** Big, colorful personality tag — bolder than the shared `Pill` (used for CEFR/state tags elsewhere). */
function TraitChip({ label, icon, tint }: { label: string; icon: keyof typeof Ionicons.glyphMap; tint: { bg: string; fg: string } }) {
  return (
    <View style={[chipStyles.chip, { backgroundColor: tint.bg }]}>
      <View style={[chipStyles.iconCircle, { backgroundColor: tint.fg }]}>
        <Ionicons name={icon} size={12} color="#FFFFFF" />
      </View>
      <AppText variant="label" color={tint.fg} numberOfLines={1} style={chipStyles.label}>{label}</AppText>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0,
    paddingLeft: 3, paddingRight: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
  iconCircle: {
    width: 20, height: 20, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
  },
  label: { flexShrink: 1 },
});

// No themed values in here (colours are applied inline from `useColors`), so
// these are plain constants — no per-render rebuild in four components.
const styles = StyleSheet.create({
  // No `justifyContent: 'center'`: on short phones that lets the centered group
  // overflow (RN default overflow is visible) and the Apply CTA renders below
  // the scene, under the tab bar. Instead the carousel row flexes (below) so the
  // fixed motto/CTA always stay in view; paddingBottom keeps the CTA off the bar.
  wrap: { flex: 1, paddingTop: spacing.sm, paddingBottom: spacing.md },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, minHeight: CARD_HEIGHT },
  retryBtn: { marginTop: spacing.xs },
  mottoBubbleWrap: { alignItems: 'center', marginBottom: spacing.md },
  mottoBubble: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: BASE_W * 0.8,
    borderRadius: radius.xl, paddingLeft: spacing.sm, paddingRight: spacing.lg, paddingVertical: spacing.sm,
  },
  mottoIconCircle: { width: 30, height: 30, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  mottoTextWrap: { flexShrink: 1, minHeight: MOTTO_LINE_HEIGHT * 2, justifyContent: 'center' },
  mottoBubbleText: { fontSize: 16, lineHeight: MOTTO_LINE_HEIGHT },
  mottoTail: {
    width: 14, height: 14, marginTop: -7, transform: [{ rotate: '45deg' }],
  },
  // -SHADOW_PAD cancels the list's added top/bottom padding in layout flow, so
  // surrounding elements keep their spacing while each card's shadow gets room.
  // A flex wrapper (carouselFlex) absorbs the height variation instead of this
  // row, so the SHADOW_PAD / negative-margin shadow mechanism stays untouched
  // (flex on this row clipped the card's shadow into a hard line).
  carouselFlex: { flex: 1, justifyContent: 'center' },
  carouselRow: { justifyContent: 'center', marginVertical: -SHADOW_PAD },
  carousel: { height: CARD_HEIGHT + SHADOW_PAD * 2 },
  navBtn: {
    position: 'absolute', top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', ...elevation.sm,
  },
  navBtnLeft: { left: spacing.sm },
  navBtnRight: { right: spacing.sm },
  cardSlot: {
    width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: CARD_GAP,
    alignItems: 'center', justifyContent: 'center',
  },
  // Shadow-only wrapper (no overflow, so iOS doesn't clip its own shadow).
  cardGlow: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: CARD_RADIUS, ...CARD_SHADOW },
  cardGlowActive: CARD_HALO,
  card: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: CARD_RADIUS,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  cardAvatarFill: { ...StyleSheet.absoluteFillObject },
  cardEmoji: { fontSize: CARD_WIDTH * 0.42, lineHeight: CARD_WIDTH * 0.48 },
  cardLockBadge: {
    position: 'absolute', width: 62, height: 62, borderRadius: radius.full,
    backgroundColor: 'rgba(35,20,70,0.42)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginTop: spacing.sm },
  infoPanel: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  nameText: { flexShrink: 1 },
  soundBtn: {
    width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
  },
  // One single row, no wrap, no scroll — all chips visible side by side. Chips
  // are small (see chipStyles) and may shrink so they always fit on one line
  // (a 2nd wrapped row used to punch the card down into the name/dots).
  tagsRow: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.md, paddingHorizontal: spacing.sm },
  applyBtn: {
    height: 56, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  applyBtnLabel: { fontSize: 17 },
  applyBtnArrow: {
    position: 'absolute', right: 4, width: 46, height: 46, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  unlockCtaIcon: { marginRight: spacing.sm },
});
