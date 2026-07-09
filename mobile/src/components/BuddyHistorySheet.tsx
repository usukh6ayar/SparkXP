import { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import Animated, {
  interpolate, useAnimatedStyle, Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';
import { useColors, useSettings } from '../settings/SettingsContext';
import { AppText } from './Text';
import type { BuddyTextSessionSummary } from '../api/ai';

/**
 * ChatGPT-style history as a draggable frosted-glass bottom sheet (matches the
 * sign-in sheet language). Lists this buddy's past typed threads, most recent
 * first, with a "New chat" action pinned on top. Drag down / tap backdrop to
 * dismiss. Presented above the chat sheet, so the chat blurs behind it.
 */
export function BuddyHistorySheet({
  open, loading, sessions, activeId, onClose, onNewChat, onPick,
}: {
  open: boolean;
  loading: boolean;
  sessions: BuddyTextSessionSummary[];
  activeId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onPick: (sessionId: string) => void;
}) {
  const c = useColors();
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const styles = useMemo(() => makeStyles(c, isLight), [c, isLight]);
  const ref = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%', '88%'], []);

  const springConfigs = useBottomSheetSpringConfigs({
    damping: 50, stiffness: 420, mass: 1, overshootClamping: false,
  });

  useEffect(() => { ref.current?.present(); }, []);
  const close = useCallback(() => ref.current?.dismiss(), []);

  // Run the action, then let the sheet slide down (onDismiss tells the parent).
  const pick = useCallback((id: string) => { onPick(id); ref.current?.dismiss(); }, [onPick]);
  const newChat = useCallback(() => { onNewChat(); ref.current?.dismiss(); }, [onNewChat]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <GlassBackdrop {...props} onPress={close} />,
    [close],
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      // Stack ON TOP of the chat sheet instead of the default 'switch', which
      // would minimise/dismiss the chat underneath — that dismissal is what
      // dropped the user back to the voice stage on "New chat". With 'push' the
      // chat sheet stays mounted, so history stays entirely inside the chat.
      stackBehavior="push"
      onDismiss={onClose}
      animationConfigs={springConfigs}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View style={styles.header}>
        <AppText variant="h2">{t('chatHistoryTitle')}</AppText>
      </View>

      <Pressable style={[styles.newChatBtn, { borderColor: c.primary }]} onPress={newChat}>
        <Ionicons name="add" size={18} color={c.primary} />
        <AppText variant="label" color={c.primary}>{t('chatNewChat')}</AppText>
      </Pressable>

      {loading ? (
        <ActivityIndicator size="small" color={c.primary} style={styles.loading} />
      ) : sessions.length === 0 ? (
        <AppText variant="caption" color={c.textSecondary} style={styles.empty}>
          {t('chatHistoryEmpty')}
        </AppText>
      ) : (
        <BottomSheetFlatList
          data={sessions}
          keyExtractor={(s) => s.sessionId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, item.sessionId === activeId && { backgroundColor: c.surfaceAlt }]}
              onPress={() => pick(item.sessionId)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.textSecondary} />
              <AppText variant="body" numberOfLines={1} style={styles.rowText}>
                {item.title || t('chatUntitled')}
              </AppText>
              {item.sessionId === activeId && (
                <Ionicons name="checkmark-circle" size={16} color={c.primary} />
              )}
            </Pressable>
          )}
        />
      )}
    </BottomSheetModal>
  );
}

/** Frosted-glass sheet background. */
function GlassBackground({ style }: BottomSheetBackgroundProps) {
  const c = useColors();
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const styles = useMemo(() => makeStyles(c, isLight), [c, isLight]);
  return (
    <View style={[style, styles.sheetBg]}>
      <BlurView
        intensity={50}
        tint={isLight ? 'light' : 'dark'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.sheetTint]} />
      <View style={styles.sheetHighlight} />
    </View>
  );
}

/** Blur + dim backdrop; tap to close. */
function GlassBackdrop({
  animatedIndex, style, onPress,
}: BottomSheetBackdropProps & { onPress: () => void }) {
  const c = useColors();
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const styles = useMemo(() => makeStyles(c, isLight), [c, isLight]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
        <BlurView
          intensity={22}
          tint={isLight ? 'light' : 'dark'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (c: AppColors, isLight: boolean) => StyleSheet.create({
  dim: { backgroundColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(10,6,26,0.35)' },
  sheetBg: {
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: isLight ? c.border : c.glassBorder,
    backgroundColor: isLight ? c.surface : 'transparent', overflow: 'hidden',
  },
  sheetTint: { backgroundColor: isLight ? 'transparent' : c.glassBgStrong },
  sheetHighlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: isLight ? 'transparent' : 'rgba(255,255,255,0.28)',
  },
  handleIndicator: { backgroundColor: isLight ? c.borderStrong : 'rgba(255,255,255,0.4)', width: 48 },

  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    marginHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, marginBottom: spacing.md,
  },
  loading: { marginTop: spacing.xl },
  empty: { textAlign: 'center', marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md,
  },
  rowText: { flex: 1 },
});
