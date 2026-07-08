import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TextInput,
  Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { AppImage } from '../../src/components/AppImage';
import { BuddySelector } from '../../src/components/BuddySelector';
import { BuddyVoiceStage } from '../../src/components/BuddyVoiceStage';
import { buildMockBuddies, FOX_SLUG } from '../../src/constants/mockBuddies';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../../src/lib/haptics';
import {
  useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { useAuth } from '../../src/auth/AuthContext';
import * as aiApi from '../../src/api/ai';
import type {
  Buddy, Correction, BuddyUsageBlock, BuddyTextSession, BuddyTextSessionSummary,
} from '../../src/api/ai';
import { ApiError } from '../../src/api/client';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { TappableText } from '../../src/components/DictionaryProvider';
import { useColors, useSettings } from '../../src/settings/SettingsContext';
import { t, tf } from '../../src/i18n';
import { spacing, radius, type AppColors } from '../../src/theme/theme';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  correction?: Correction | null;
  followUp?: string;
  audioUrl?: string | null;
}

const sparkImg = require('../../assets/buddy-menu.webp');

export default function ChatScreen() {
  const { token } = useAuth();
  const c = useColors();
  // Reactive translator: subscribing here re-renders this (always-mounted) tab
  // when the language changes. Module-level helpers below use the same i18n.
  const { t, lang } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);

  // select → pick a buddy · voice → hold-to-talk stage · text → typed chat
  const [mode, setMode] = useState<'select' | 'voice' | 'text'>('select');
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [buddiesLoading, setBuddiesLoading] = useState(true);
  const [buddiesError, setBuddiesError] = useState(false);
  const [buddiesErrorDetail, setBuddiesErrorDetail] = useState<string | null>(null);
  const [selected, setSelected] = useState<Buddy | null>(null);
  // Slugs the backend actually knows (from getBuddies) + a fallback real slug.
  // Mock buddies (placeholder characters, see mockBuddies.ts) aren't in the DB,
  // so their session is routed to a real buddy until Usukhbayar adds them.
  const [realSlugs, setRealSlugs] = useState<Set<string>>(new Set());
  const [fallbackSlug, setFallbackSlug] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Persistent typed-chat thread (ChatGPT-style history), separate from voice.
  const [textSessionId, setTextSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  // The voice screen's latest spoken reply (kept apart from the text `messages`).
  const [voiceReply, setVoiceReply] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [usage, setUsage] = useState<BuddyUsageBlock | null>(null);
  const [voiceLimited, setVoiceLimited] = useState(false);
  // Closed captions on the voice screen — show/hide the buddy's spoken text.
  const [captions, setCaptions] = useState(true);
  // Slug the persistent text thread is bound to (real buddy or fallback).
  const [textSlug, setTextSlug] = useState<string | null>(null);
  // ChatGPT-style history panel: past typed-chat threads for this buddy.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<BuddyTextSessionSummary[]>([]);

  const listRef = useRef<FlatList>(null);
  const holdRef = useRef(false); // synchronous "mic is held" flag (see startRecording)
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scrollDown = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  /** Flatten a loaded text thread into the local message list + bind its id. */
  const applyTextSession = useCallback((ts: BuddyTextSession) => {
    setTextSessionId(ts.sessionId);
    setMessages(ts.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      correction: m.correction,
      followUp: m.followUp ?? undefined,
      audioUrl: m.audioUrl,
    })));
  }, []);

  function playAudio(url?: string | null) {
    if (!url) return;
    try {
      player.replace({ uri: url });
      player.play();
    } catch { /* playback is best-effort */ }
  }

  // Load the buddy list; the user picks + Applies one on the selector screen
  // before any session is started (see BuddySelector / mode === 'select').
  // Real buddies are padded out with mock ones (see mockBuddies.ts) so the
  // full carousel/lock design can be reviewed before Usukhbayar adds the
  // rest via admin — a mock is dropped automatically once a real buddy with
  // the same slug exists.
  const loadBuddies = useCallback(() => {
    if (!token) return;
    setBuddiesLoading(true);
    setBuddiesError(false);
    setBuddiesErrorDetail(null);
    aiApi.getBuddies(token)
      .then((real) => {
        const covered = new Set(real.map((r) => r.slug));
        setRealSlugs(covered);
        setFallbackSlug(real[0]?.slug ?? null);
        const mocks = buildMockBuddies(t, lang).filter((m) => !covered.has(m.slug));
        const fox = mocks.find((m) => m.slug === FOX_SLUG);
        const rest = mocks.filter((m) => m.slug !== FOX_SLUG);
        setBuddies(fox ? [fox, ...real, ...rest] : [...real, ...rest]);
      })
      .catch((err) => {
        setBuddiesError(true);
        const detail = err instanceof ApiError ? `${err.status} ${err.message}` : String(err);
        setBuddiesErrorDetail(detail);
        console.warn('getBuddies failed:', detail);
      })
      .finally(() => setBuddiesLoading(false));
  }, [token, t, lang]);

  useEffect(() => { loadBuddies(); }, [loadBuddies]);

  const selectBuddy = useCallback(async (buddy: Buddy) => {
    if (!token) return;
    setSelected(buddy);
    setMessages([]);
    setVoiceReply(null);
    setSessionId(null);
    setTextSessionId(null);
    setVoiceLimited(false);
    // A mock/placeholder buddy has no backend record — chat with a real buddy
    // instead so the session starts (persona is a stopgap until it's added).
    const sessionSlug = realSlugs.has(buddy.slug) ? buddy.slug : fallbackSlug;
    if (!sessionSlug) {
      Alert.alert(t('error'), t('chatSessionError'));
      return;
    }
    setTextSlug(sessionSlug);
    try {
      // Voice session is the critical one — must succeed to chat at all.
      const s = await aiApi.startBuddySession(sessionSlug, token);
      setSessionId(s.sessionId);
      setUsage(s.usage);
      // Persistent text thread is best-effort: if the backend endpoint isn't
      // deployed yet (404), fall back to using the voice session for typing so
      // chat still works — history just won't persist until the backend ships.
      try {
        const ts = await aiApi.resumeBuddyTextSession(sessionSlug, token);
        applyTextSession(ts);
      } catch (e) {
        const d = e instanceof ApiError ? `${e.status} ${e.message}` : String(e);
        console.warn('resumeBuddyTextSession unavailable, using voice session for text:', d);
        setTextSessionId(s.sessionId);
      }
    } catch (err) {
      const detail = err instanceof ApiError ? `${err.status} ${err.message}` : String(err);
      console.warn('startBuddySession failed:', detail);
      Alert.alert(t('error'), `${t('chatSessionError')}\n\n${detail}`);
    }
  }, [token, realSlugs, fallbackSlug, applyTextSession]);

  /** Open the history panel and (re)load this buddy's past typed threads. */
  const openHistory = useCallback(async () => {
    if (!token || !textSlug) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      setHistorySessions(await aiApi.listBuddyTextSessions(textSlug, token));
    } catch (e) {
      const d = e instanceof ApiError ? `${e.status} ${e.message}` : String(e);
      console.warn('listBuddyTextSessions failed:', d);
      setHistorySessions([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token, textSlug]);

  /** Switch the typed chat to a specific past thread (or start a fresh one). */
  const openThread = useCallback(async (opts: { sessionId?: string; fresh?: boolean }) => {
    if (!token || !textSlug) return;
    setHistoryOpen(false);
    setLoading(true);
    try {
      const ts = await aiApi.resumeBuddyTextSession(textSlug, token, opts);
      applyTextSession(ts);
    } catch (e) {
      const d = e instanceof ApiError ? `${e.status} ${e.message}` : String(e);
      console.warn('resumeBuddyTextSession (history) failed:', d);
      Alert.alert(t('error'), t('chatSessionError'));
    } finally {
      setLoading(false);
    }
  }, [token, textSlug, applyTextSession, t]);

  /**
   * A completed VOICE turn. The voice screen is speak-only and ephemeral — it
   * shows just the latest spoken reply (in the buddy's bubble) and never writes
   * to the text `messages` list, so the two sections stay separate.
   */
  function renderVoiceTurn(res: aiApi.TurnResponse) {
    setVoiceReply(res.reply_text);
    setUsage(res.usage);
    playAudio(res.audio_url);
  }

  function handleTurnError(err: unknown, opts?: { voice?: boolean }) {
    if (err instanceof ApiError && err.code === 'VOICE_LIMIT') {
      setVoiceLimited(true);
      Alert.alert(t('voiceEndedTitle'), t('voiceLimitReached'));
      return;
    }
    // Keep the error in the section it happened in (voice bubble vs text list).
    if (opts?.voice) { setVoiceReply(t('chatReplyError')); return; }
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}e`, role: 'assistant', content: t('chatReplyError') },
    ]);
  }

  async function sendText() {
    const text = input.trim();
    if (!text || loading || !textSessionId) return;
    haptics.tap();
    setInput('');
    setMessages((prev) => [...prev, { id: `${Date.now()}u`, role: 'user', content: text }]);
    setLoading(true);
    scrollDown();
    try {
      const res = await aiApi.sendBuddyTextTurn(textSessionId, text, token!);
      // renderTurn also appends the user bubble; we already added it, so append AI only.
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}a`, role: 'assistant',
          content: res.reply_text, correction: res.correction,
          followUp: res.follow_up_question, audioUrl: res.audio_url,
        },
      ]);
      setUsage(res.usage);
      playAudio(res.audio_url);
    } catch (err) {
      handleTurnError(err);
    } finally {
      setLoading(false);
      scrollDown();
    }
  }

  async function startRecording() {
    if (loading || !sessionId || voiceLimited) return;
    if (holdRef.current) return;
    // Synchronous intent flag: startRecording is async (permissions + prepare),
    // so a quick tap's release can fire before it finishes. The ref lets
    // stop/cancel signal "the finger is already up" and abort cleanly, instead
    // of leaving a recorder running forever.
    holdRef.current = true;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        holdRef.current = false;
        Alert.alert(t('permissionTitle'), t('micPermission'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!holdRef.current) return; // released before we were ready → never record
      recorder.record();
      setRecording(true);
    } catch {
      holdRef.current = false;
      Alert.alert(t('error'), t('recordStartError'));
    }
  }

  async function stopRecording() {
    holdRef.current = false;
    if (!recording) return; // recorder never actually started (too-quick press)
    setRecording(false);
    setLoading(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || !sessionId) throw new Error('no audio');
      const res = await aiApi.sendBuddyAudioTurn(sessionId, uri, token!);
      renderVoiceTurn(res);
    } catch (err) {
      handleTurnError(err, { voice: true });
    } finally {
      setLoading(false);
    }
  }

  /** Stop capturing but discard — no turn is sent (slide-to-cancel / quick tap). */
  async function cancelRecording() {
    holdRef.current = false;
    if (!recording) return; // never started; startRecording will bail on its own
    setRecording(false);
    try { await recorder.stop(); } catch { /* discard */ }
  }

  const usageLabel = usage ? formatUsage(usage) : '';
  const voiceGreeting = voiceReply ?? tf('chatGreeting', { name: selected?.name ?? t('defaultBuddyName') });

  if (mode === 'select') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar
          title={t('buddySelectTitle')}
          streak={5}
          onAddSparks={() => Alert.alert(t('buddyUnlockComingSoon'))}
        />
        <BuddySelector
          buddies={buddies}
          appliedSlug={selected?.slug ?? null}
          onApply={(buddy) => { selectBuddy(buddy); setMode('voice'); }}
          loading={buddiesLoading}
          error={buddiesError}
          errorDetail={buddiesErrorDetail}
          onRetry={loadBuddies}
        />
      </SafeAreaView>
    );
  }

  if (mode === 'voice') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar
          title={selected?.name ?? t('aiBuddyShort')}
          subtitle={t('buddyOnline')}
          streak={5}
          back
          onBack={() => setMode('select')}
        />
        <Animated.View key="voice" entering={FadeIn.duration(260)} style={styles.flex}>
          <BuddyVoiceStage
            buddy={selected}
            greeting={voiceGreeting}
            speaking={playerStatus.playing}
            thinking={loading}
            voiceLimited={voiceLimited}
            usageLabel={usageLabel}
            usageWarn={usage?.warn_level === 'warn95'}
            captions={captions}
            onToggleCaptions={() => setCaptions((v) => !v)}
            onRecordStart={startRecording}
            onRecordCommit={stopRecording}
            onRecordCancel={cancelRecording}
            onOpenText={() => setMode('text')}
          />
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        title={selected?.name ?? t('aiBuddyShort')}
        subtitle={t('buddyOnline')}
        showBadges={false}
        back
        onBack={() => setMode('voice')}
        onHistory={openHistory}
      />

      <ChatHistoryPanel
        visible={historyOpen}
        loading={historyLoading}
        sessions={historySessions}
        activeId={textSessionId}
        onClose={() => setHistoryOpen(false)}
        onNewChat={() => openThread({ fresh: true })}
        onPick={(id) => openThread({ sessionId: id })}
      />

      {/* Messages — text-only chat (voice minutes are not spent here). */}
      <Animated.View key="text" entering={FadeIn.duration(260)} style={styles.flex}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={<EmptyState buddy={selected} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <MessageBubble message={item} onReplay={playAudio} buddy={selected} />}
        />
      </Animated.View>

      {loading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={c.primary} />
          <AppText variant="caption">{selected?.name ?? 'AI'} {t('typing')}</AppText>
        </View>
      )}

      {/* Input bar — typing only; speaking lives on the voice screen. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('typeMessage')}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={1000}
            onSubmitEditing={sendText}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendText}
            disabled={!input.trim() || loading}
            accessibilityRole="button"
            accessibilityLabel={t('send')}
          >
            <Ionicons name="arrow-up" size={20} color={c.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * ChatGPT-style history drawer: a left slide-over listing this buddy's past
 * typed threads (most recent first) plus a "New chat" button. Tapping a row
 * loads that thread into the chat; the active thread is highlighted.
 */
function ChatHistoryPanel({
  visible, loading, sessions, activeId, onClose, onNewChat, onPick,
}: {
  visible: boolean;
  loading: boolean;
  sessions: BuddyTextSessionSummary[];
  activeId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onPick: (sessionId: string) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.historyScrim} onPress={onClose}>
        <Pressable style={styles.historyPanel} onPress={(e) => e.stopPropagation()}>
          <View style={styles.historyHeader}>
            <AppText variant="h2">{t('chatHistoryTitle')}</AppText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={c.text} />
            </Pressable>
          </View>

          <Pressable style={styles.newChatBtn} onPress={onNewChat}>
            <Ionicons name="add" size={18} color={c.primary} />
            <AppText variant="label" color={c.primary}>{t('chatNewChat')}</AppText>
          </Pressable>

          {loading ? (
            <ActivityIndicator size="small" color={c.primary} style={styles.historyLoading} />
          ) : sessions.length === 0 ? (
            <AppText variant="caption" color={c.textSecondary} style={styles.historyEmpty}>
              {t('chatHistoryEmpty')}
            </AppText>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(s) => s.sessionId}
              contentContainerStyle={styles.historyList}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.historyRow, item.sessionId === activeId && styles.historyRowActive]}
                  onPress={() => onPick(item.sessionId)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.textSecondary} />
                  <AppText variant="body" numberOfLines={1} style={styles.historyRowText}>
                    {item.title || t('chatUntitled')}
                  </AppText>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MessageBubble({
  message, onReplay, buddy,
}: { message: LocalMessage; onReplay: (url?: string | null) => void; buddy: Buddy | null }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isUser = message.role === 'user';
  const thumb = buddy?.avatarThumbUrl ? { uri: buddy.avatarThumbUrl } : sparkImg;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}
    >
      {!isUser && <AppImage source={thumb} width={28} style={styles.avatarImg} contentFit="contain" />}
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

function EmptyState({ buddy }: { buddy: Buddy | null }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const thumb = buddy?.avatarThumbUrl ? { uri: buddy.avatarThumbUrl } : sparkImg;
  return (
    <View style={styles.emptyState}>
      <AppImage source={thumb} width={110} style={styles.emptyImg} contentFit="contain" />
      <AppText variant="h2" center style={styles.emptyTitle}>
        {tf('chatGreeting', { name: buddy?.name ?? t('defaultBuddyName') })}
      </AppText>
      <AppText variant="body" color={c.textSecondary} center>
        {t('buddyChatIntro')}
      </AppText>
    </View>
  );
}

/** "3.5 / 25 мин" style label from voice usage seconds. */
function formatUsage(u: BuddyUsageBlock): string {
  const used = (u.voice_seconds_used_this_month / 60).toFixed(1);
  if (u.voice_seconds_limit_this_month == null) return `${used} ${t('unitMin')}`;
  const limit = Math.round(u.voice_seconds_limit_this_month / 60);
  return `${used} / ${limit} ${t('unitMin')}`;
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  messageList: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.xs },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleAi: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  correctionCard: {
    backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.sm,
    marginBottom: spacing.xs, gap: 2, borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  strike: { textDecorationLine: 'line-through' },
  correctedText: { fontWeight: '700' },
  followUp: { marginTop: spacing.xs, fontStyle: 'italic' },
  replayBtn: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.text,
  },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: colors.borderStrong },
  historyScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  historyPanel: {
    width: '80%', maxWidth: 340, height: '100%', backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingTop: spacing.xxxl, paddingBottom: spacing.lg,
  },
  historyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md, paddingHorizontal: spacing.xs,
  },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.primary, marginBottom: spacing.md,
  },
  historyLoading: { marginTop: spacing.xl },
  historyEmpty: { textAlign: 'center', marginTop: spacing.xl },
  historyList: { gap: spacing.xs, paddingBottom: spacing.lg },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md,
  },
  historyRowActive: { backgroundColor: colors.surfaceAlt },
  historyRowText: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl },
  emptyImg: { width: 110, height: 110, borderRadius: 55, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
});
