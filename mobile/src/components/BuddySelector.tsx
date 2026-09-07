import { useMemo, useRef, useState } from 'react';
import { View, Dimensions, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import Animated, {
  useAnimatedStyle, useAnimatedScrollHandler, useSharedValue,
  interpolate, interpolateColor, Extrapolation, FadeIn, FadeOut, type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { Pill } from './Pill';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { BuddyUnlockSheet } from './BuddyUnlockSheet';
import { haptics } from '../lib/haptics';
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
const CARD_RESERVED_H = 400;
const CARD_HEIGHT = Math.max(190, Math.min(Math.round(BASE_W * 0.78 * 1.46), SCREEN_H - CARD_RESERVED_H));
const CARD_WIDTH = Math.round(CARD_HEIGHT / 1.46);
const CARD_GAP = spacing.xs;
const SNAP = CARD_WIDTH + CARD_GAP;
const SIDE_PAD = (SCREEN_W - CARD_WIDTH) / 2;
const MOTTO_LINE_HEIGHT = 23;
/**
 * Fewest buddies worth looping. With two, the strip is centre + one peek on each
 * side — three slots drawn from two buddies, so one of them is always on screen
 * twice and the carousel looks like it holds more buddies than it does.
 */
const LOOP_MIN = 3;
/** Vertical breathing room inside the horizontal list so each card's shadow has
 *  space to fully fade before the list frame — otherwise the frame clips it into
 *  a hard line. Must exceed the shadow reach (offset + ~1.5×radius ≈ 30). The
 *  list is grown by this top+bottom and pulled back with a negative margin, so
 *  surrounding layout is unchanged. */
const SHADOW_PAD = 40;


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
 * unlock sheet doesn't spend Sparks (see BuddyUnlockSheet). Off by default so
 * DEV matches production — every real buddy admin publishes stays open rather
 * than showing a fake 500-Spark price it can't actually charge. Flip to
 * `__DEV__` temporarily to exercise the lock/unlock design against mocks.
 */
const DEMO_LOCKING = false;
/** Dark text on the gold Unlock button — white would have poor contrast on `colors.xp`. */
const UNLOCK_TEXT_COLOR = '#402D00';


function withDefaults(buddy: Buddy, index: number, t: (key: TranslationKey) => string) {
  return {
    ...buddy,
    personalityTags: buddy.personalityTags ?? [t('traitFriendly'), t('traitPatient'), t('traitEncouraging')],
    // Backend sends no motto yet → fall back to the buddy's own description so
    // each greeting is distinct (not the same generic line on every buddy).
    motto: buddy.motto || buddy.description || t('defaultBuddyMotto'),
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
  /**
   * Infinite loop: pad the real data with a clone of the last item up front and
   * a clone of the first at the end. Swiping past either edge lands on a clone
   * identical to the item it mimics, so the scroll can be snapped back into the
   * real range unanimated and the wrap is invisible.
   *
   * **Only from three buddies up.** The carousel shows the neighbours peeking in
   * on both sides, so with two buddies the left peek, the centre and the right
   * peek are drawn from a set of two — the same two faces repeat across the
   * strip and it reads as four or more buddies rather than two. Below the
   * threshold the list is finite and the arrows clamp at the ends.
   */
  const looping = display.length >= LOOP_MIN;
  const loopData = useMemo(
    () => (display.length >= LOOP_MIN ? [display[display.length - 1], ...display, display[0]] : display),
    [display],
  );
  const [unlockedSlugs, setUnlockedSlugs] = useState<Set<string>>(new Set());
  const [centerIndex, setCenterIndex] = useState(0);
  const [unlockTarget, setUnlockTarget] = useState<Buddy | null>(null);
  // Matches initialScrollIndex below (1 when looping) so the first frame's
  // card scale/opacity isn't computed against the wrong (pre-scroll) offset.
  const scrollX = useSharedValue(display.length >= LOOP_MIN ? SNAP : 0);
  const listRef = useRef<FlatList<ReturnType<typeof withDefaults>>>(null);

  const centerBuddy = display[centerIndex] ?? null;
  const isLocked = !!centerBuddy?.isLocked && !unlockedSlugs.has(centerBuddy.slug);

  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  function handleMomentumEnd(offsetX: number) {
    const loopIdx = Math.round(offsetX / SNAP);

    if (looping) {
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

  /**
   * Step one card left (−1) or right (+1).
   *
   * Moves by LOOP position, never by real index. That distinction is the whole
   * bug this replaced: jumping straight to the wrapped real index meant that
   * pressing → on the last buddy animated all the way back across every card —
   * so the arrow visibly travelled the wrong way — and pressing ← on the first
   * did the same in reverse. One step onto the neighbouring clone looks like a
   * normal move, and `handleMomentumEnd` does the invisible swap on landing.
   *
   * It also does NOT set `centerIndex`. `handleMomentumEnd` is the single place
   * that knows whether we came to rest on a clone; setting it here too made the
   * two disagree mid-animation, which is what made the carousel judder and
   * appear to change buddy on its own.
   */
  function step(delta: -1 | 1) {
    if (display.length === 0) return;
    if (!looping) {
      // Finite list: clamp instead of wrapping, or we'd scroll into empty space.
      const next = Math.min(display.length - 1, Math.max(0, centerIndex + delta));
      if (next === centerIndex) return;
      listRef.current?.scrollToOffset({ offset: next * SNAP, animated: true });
      return;
    }
    listRef.current?.scrollToOffset({ offset: (centerIndex + 1 + delta) * SNAP, animated: true });
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
      {/* Нэр нь buddy-гийн ДЭЭР. Өмнө нь энд motto-ны бөмбөлөг, доор нь нэр +
          чанга яригчийн товч + зан чанарын шошгууд байсан. Сонголт хийхэд аль
          нь ч хэрэггүй бөгөөд гурвуулан картын босоо зайг иддэг байв. */}
      {centerBuddy && (
        <Animated.View
          key={centerBuddy.slug}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(120)}
          style={styles.nameRow}
        >
          <AppText variant="h1" numberOfLines={1} style={styles.nameText} center>{centerBuddy.name}</AppText>
          {isLocked ? (
            <Pill label={t('buddyLocked')} icon="lock-closed" bg={tints.amber.bg} fg={tints.amber.fg} />
          ) : null}
        </Animated.View>
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
          initialScrollIndex={looping ? 1 : 0}
          onMomentumScrollEnd={(e) => handleMomentumEnd(e.nativeEvent.contentOffset.x)}
          renderItem={({ item, index }) => {
            return (
              <BuddyCard
                buddy={item}
                index={index}
                scrollX={scrollX}
              />
            );
          }}
        />

        {display.length > 1 && (
          <Pressable style={[styles.navBtn, styles.navBtnLeft, { backgroundColor: c.surface }]} onPress={() => step(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
        )}
        {display.length > 1 && (
          <Pressable style={[styles.navBtn, styles.navBtnRight, { backgroundColor: c.surface }]} onPress={() => step(1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </Pressable>
        )}
      </View>
      </View>

      {display.length > 1 && (
        <View style={styles.dots}>
          {display.map((b, i) => (
            <Dot key={b.slug} index={looping ? i + 1 : i} scrollX={scrollX} colors={c} />
          ))}
        </View>
      )}

      {centerBuddy && (
        <View style={styles.infoPanel}>
          {isLocked ? (
            <UnlockCTAButton
              label={tf('buddyUnlockFor', { n: centerBuddy.unlockCostSparks ?? DEFAULT_UNLOCK_COST })}
              onPress={() => setUnlockTarget(centerBuddy)}
            />
          ) : (
            <ApplyBuddyButton label={t('buddyApply')} onPress={() => onApply(centerBuddy)} colors={c} />
          )}
        </View>
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
  buddy, index, scrollX,
}: {
  buddy: ReturnType<typeof withDefaults>;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // The 3D canvas is transparent, so leaving the 2D art underneath makes a
  // rendering problem invisible (the PNG just shows through). Show the art only
  // until the GLB is actually on screen.
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
  // GLB streams in and decodes. When SHOW_3D_AVATAR is off (see
  // buddyAvatarFlag.ts) the thumbnail (or a name-initial placeholder) is the
  // primary rendering until the GLB texture pipeline is fixed and verified.
  const c = useColors();
  return (
    <Animated.View style={[styles.cardSlot, cardStyle]}>
      {/* No panel, no gradient, no shadow — just the character.
          The card used to sit on a lavender gradient plate with a coloured
          halo. That frame was most of the card's area, so the buddy the student
          is actually choosing between was the smallest thing on screen.

          No 3D here either: the picker shows the ADMIN THUMBNAIL. Mounting a
          live GL canvas meant streaming and decoding tens of megabytes for a
          card that gets swiped past, paid again on every visit to the tab. The
          3D character belongs to the conversation screen. */}
      <View style={styles.card}>
          {buddy.avatarThumbUrl && !imgFailed ? (
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
            // No artwork for this buddy yet. A bare letter at 110px read as a
            // rendering fault rather than a placeholder, so it is set in a soft
            // disc — the same shape an avatar would occupy.
            <View style={[styles.cardMonogram, { backgroundColor: c.surface }]}>
              <AppText style={[styles.cardMonogramText, { color: c.primary }]}>
                {buddy.name?.charAt(0)?.toUpperCase() ?? '?'}
              </AppText>
            </View>
          )}
          {buddy.isLocked && (
            // Centered translucent lock disc with a thin white ring (reference).
            <View style={styles.cardLockBadge} pointerEvents="none">
              <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
            </View>
          )}
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
  // No background, no radius, no clipping — the character IS the card now.
  card: {
    width: CARD_WIDTH, height: CARD_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  cardAvatarFill: { ...StyleSheet.absoluteFill },
  cardMonogram: {
    width: CARD_WIDTH * 0.46, height: CARD_WIDTH * 0.46, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', opacity: 0.9,
  },
  cardMonogramText: { fontSize: CARD_WIDTH * 0.2, lineHeight: CARD_WIDTH * 0.26 },
  cardLockBadge: {
    position: 'absolute', width: 62, height: 62, borderRadius: radius.full,
    backgroundColor: 'rgba(35,20,70,0.42)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginTop: spacing.sm },
  infoPanel: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  // Sits ABOVE the carousel now, so it names the buddy you are looking at
  // before you look at it rather than after.
  nameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.lg,
  },
  nameText: { flexShrink: 1 },
  soundBtn: {
    width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
  },
  // One single row, no wrap, no scroll — all chips visible side by side. Chips
  // are small (see chipStyles) and may shrink so they always fit on one line
  // (a 2nd wrapped row used to punch the card down into the name/dots).
  tagsRow: {
    flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center',
    gap: spacing.xs, marginBottom: spacing.md,
    // Inset well clear of the screen edge — at spacing.sm the outer chips ran
    // right up against it and the row read as cut off rather than centred.
    paddingHorizontal: spacing.lg,
  },
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
