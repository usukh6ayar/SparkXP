import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetTextInput,
  useBottomSheetSpringConfigs,
  type BottomSheetFooterProps,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn, FadeInDown, interpolate, useAnimatedStyle, useSharedValue,
  withRepeat, withTiming, withDelay, withSequence, Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../lib/haptics';
import { t, tf } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';
import { useColors, useSettings } from '../settings/SettingsContext';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { TappableText } from './DictionaryProvider';
import type { Correction } from '../api/ai';

// The typed chat presents ONE unified assistant identity — "SparkXP" — no
// matter which buddy persona (police, doctor, firefighter…) was picked. The
// persona still shapes the replies, but the header/avatars stay brand-consistent
// so it reads as chatting with the SparkXP AI, not a different character each time.
const BRAND_NAME = 'SparkXP';
const brandAvatar = require('../../assets/buddy-menu.webp');

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  correction?: Correction | null;
  followUp?: string;
  audioUrl?: string | null;
}

/**
 * The typed AI-buddy conversation as a draggable, frosted-glass bottom sheet
 * that rises over the (blurred) voice stage — the same in-place sheet language
 * as the sign-in screen. Drag the handle down (or tap the dimmed backdrop) to
 * return to voice. Messages scroll; the input stays pinned above the keyboard
 * as a sheet footer. A history button in the header opens past threads.
 */
export function BuddyChatSheet({
  open, onClose, messages, loading, onSend, onReplay, onOpenHistory,
}: {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  onReplay: (url?: string | null) => void;
  onOpenHistory: () => void;
}) {
  const c = useColors();
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, isLight), [c, isLight]);
  const ref = useRef<BottomSheetModal>(null);
  const listRef = useRef<any>(null);
  const snapPoints = useMemo(() => ['92%'], []);

  const springConfigs = useBottomSheetSpringConfigs({
    damping: 50, stiffness: 420, mass: 1, overshootClamping: false,
  });

  // The parent only mounts this while open, so present on mount / dismiss on close.
  useEffect(() => { ref.current?.present(); }, []);
  const close = useCallback(() => ref.current?.dismiss(), []);

  // Keep a live ref to onSend so the footer callback can stay STABLE across
  // keystrokes. If the footer (or its TextInput) is recreated on every letter,
  // the input remounts and the keyboard collapses — hence the input's own text
  // state lives inside <ChatInputBar>, and this ref decouples it from onSend's
  // changing identity. The parent already guards against sending while loading.
  const sendRef = useRef(onSend);
  sendRef.current = onSend;
  const handleSend = useCallback((text: string) => sendRef.current(text), []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <GlassBackdrop {...props} onPress={close} />,
    [close],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      // bottomInset lifts the input off the home indicator when the keyboard is
      // closed; gorhom drops it automatically while typing (no white gap).
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <ChatInputBar onSend={handleSend} styles={styles} c={c} />
      </BottomSheetFooter>
    ),
    [handleSend, styles, c, insets.bottom],
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={onClose}
      animationConfigs={springConfigs}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassBackground}
      footerComponent={renderFooter}
      handleIndicatorStyle={styles.handleIndicator}
      // 'extend' keeps the sheet at its (single) snap point when the keyboard
      // opens instead of shoving the whole sheet up to the top of the screen —
      // only the content shrinks and the footer rides above the keyboard.
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      {/* Header — unified SparkXP identity + history button. */}
      <View style={styles.header}>
        <AppImage source={brandAvatar} width={34} style={styles.headerAvatar} contentFit="contain" />
        <View style={styles.headerText}>
          <AppText variant="bodyStrong" numberOfLines={1}>{BRAND_NAME}</AppText>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: c.success }]} />
            <AppText variant="caption" color={c.textSecondary}>{t('buddyOnline')}</AppText>
          </View>
        </View>
        <Pressable
          // Drop the keyboard before the history sheet rises, otherwise it
          // lingers open over/behind the panel.
          onPress={() => { Keyboard.dismiss(); onOpenHistory(); }}
          hitSlop={8}
          style={[styles.historyBtn, { backgroundColor: c.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel={t('chatHistoryTitle')}
        >
          <Ionicons name="time-outline" size={20} color={c.text} />
        </Pressable>
      </View>

      <BottomSheetFlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState />}
        ListFooterComponent={loading ? <TypingBubble styles={styles} c={c} /> : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => <MessageBubble message={item} onReplay={onReplay} />}
      />
    </BottomSheetModal>
  );
}

/**
 * The chat input bar. Owns its own draft text so typing never re-renders the
 * sheet (and never recreates the footer) — that is what keeps the keyboard from
 * collapsing after a single character. Sends via a stable onSend and clears.
 */
const ChatInputBar = memo(function ChatInputBar({
  onSend, styles, c,
}: { onSend: (text: string) => void; styles: any; c: AppColors }) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;
  function submit() {
    const value = text.trim();
    if (!value) return;
    haptics.tap();
    setText('');
    onSend(value);
  }
  return (
    <View style={styles.inputBar}>
      <BottomSheetTextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={t('typeMessage')}
        placeholderTextColor={c.textMuted}
        multiline
        maxLength={1000}
        returnKeyType="default"
      />
      <Pressable
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={submit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={t('send')}
      >
        <Ionicons name="arrow-up" size={20} color={c.white} />
      </Pressable>
    </View>
  );
});

/** One bouncing dot in the "AI is typing…" bubble. */
function TypingDot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), -1),
    );
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(v.value, [0, 1], [0.3, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(v.value, [0, 1], [2, -3], Extrapolation.CLAMP) }],
  }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]} />;
}

/**
 * The buddy's "typing…" bubble — three bouncing dots in an assistant bubble,
 * shown while the reply is in flight so the wait is obvious instead of the
 * answer popping in with no warning.
 */
function TypingBubble({ styles, c }: { styles: any; c: AppColors }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.bubbleRow}>
      <AppImage source={brandAvatar} width={28} style={styles.avatarImg} contentFit="contain" />
      <View style={[styles.bubble, styles.bubbleAi, styles.typingBubble]}>
        <TypingDot delay={0} color={c.textSecondary} />
        <TypingDot delay={150} color={c.textSecondary} />
        <TypingDot delay={300} color={c.textSecondary} />
      </View>
    </Animated.View>
  );
}

function MessageBubble({
  message, onReplay,
}: { message: ChatMessage; onReplay: (url?: string | null) => void }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c, false), [c]);
  const isUser = message.role === 'user';

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}
    >
      {!isUser && <AppImage source={brandAvatar} width={28} style={styles.avatarImg} contentFit="contain" />}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        {isUser ? (
          <AppText variant="body" color={c.white}>{message.content}</AppText>
        ) : (
          <>
            {message.correction && (
              <View style={styles.correctionCard}>
                <AppText variant="caption" color={c.danger} style={styles.strike}>
                  {message.correction.original}
                </AppText>
                <AppText variant="caption" color={c.success} style={styles.correctedText}>
                  ✓ {message.correction.corrected}
                </AppText>
                <AppText variant="caption" color={c.textSecondary}>
                  {message.correction.short_explanation}
                </AppText>
              </View>
            )}
            <TappableText variant="body" color={c.text}>{message.content}</TappableText>
            {!!message.followUp && (
              <TappableText variant="body" color={c.textSecondary} style={styles.followUp}>
                {message.followUp}
              </TappableText>
            )}
            {message.audioUrl !== undefined && (
              <Pressable style={styles.replayBtn} onPress={() => onReplay(message.audioUrl)}>
                <Ionicons name="volume-medium-outline" size={16} color={c.primary} />
              </Pressable>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

function EmptyState() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c, false), [c]);
  return (
    <View style={styles.emptyState}>
      <AppImage source={brandAvatar} width={92} style={styles.emptyImg} contentFit="contain" />
      <AppText variant="h2" center style={styles.emptyTitle}>
        {tf('chatGreeting', { name: BRAND_NAME })}
      </AppText>
      <AppText variant="body" color={c.textSecondary} center>
        {t('buddyChatIntro')}
      </AppText>
    </View>
  );
}

/** Frosted-glass sheet background (blurs the voice stage behind it). */
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

/** Blur + dim backdrop whose opacity tracks the sheet position; tap to close. */
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
          intensity={26}
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

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isLight ? c.border : c.glassBorder,
  },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerText: { flex: 1, gap: 2 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  historyBtn: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },

  list: { padding: spacing.md, gap: spacing.sm, flexGrow: 1, paddingBottom: 96 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.xs },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleAi: { backgroundColor: c.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  correctionCard: {
    backgroundColor: c.background, borderRadius: radius.md, padding: spacing.sm,
    marginBottom: spacing.xs, gap: 2, borderLeftWidth: 3, borderLeftColor: c.success,
  },
  strike: { textDecorationLine: 'line-through' },
  correctedText: { fontWeight: '700' },
  followUp: { marginTop: spacing.xs, fontStyle: 'italic' },
  replayBtn: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: isLight ? c.border : c.glassBorder, backgroundColor: c.surface,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: c.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: c.text,
  },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: c.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: c.borderStrong },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl },
  emptyImg: { width: 92, height: 92, borderRadius: 46, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
});
