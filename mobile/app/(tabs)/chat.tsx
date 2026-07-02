import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, ScrollView, Image,
  Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioPlayer, useAudioRecorder, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { useAuth } from '../../src/auth/AuthContext';
import * as aiApi from '../../src/api/ai';
import type { Buddy, Correction, BuddyUsageBlock } from '../../src/api/ai';
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

const sparkImg = require('../../assets/buddy-menu.png');

export default function ChatScreen() {
  const { token } = useAuth();
  const c = useColors();
  // Reactive translator: subscribing here re-renders this (always-mounted) tab
  // when the language changes. Module-level helpers below use the same i18n.
  const { t } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [selected, setSelected] = useState<Buddy | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [usage, setUsage] = useState<BuddyUsageBlock | null>(null);
  const [voiceLimited, setVoiceLimited] = useState(false);

  const listRef = useRef<FlatList>(null);
  const player = useAudioPlayer();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scrollDown = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  function playAudio(url?: string | null) {
    if (!url) return;
    try {
      player.replace({ uri: url });
      player.play();
    } catch { /* playback is best-effort */ }
  }

  // Load buddies once, then open a session with the first one.
  useEffect(() => {
    if (!token) return;
    aiApi.getBuddies(token)
      .then((list) => {
        setBuddies(list);
        if (list.length) selectBuddy(list[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const selectBuddy = useCallback(async (buddy: Buddy) => {
    if (!token) return;
    setSelected(buddy);
    setMessages([]);
    setSessionId(null);
    setVoiceLimited(false);
    try {
      const s = await aiApi.startBuddySession(buddy.slug, token);
      setSessionId(s.sessionId);
      setUsage(s.usage);
    } catch {
      Alert.alert(t('error'), t('chatSessionError'));
    }
  }, [token]);

  /** Show one completed turn (user bubble + AI bubble) and speak the reply. */
  function renderTurn(userText: string, res: aiApi.TurnResponse) {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}u`, role: 'user', content: userText },
      {
        id: `${Date.now()}a`, role: 'assistant',
        content: res.reply_text,
        correction: res.correction,
        followUp: res.follow_up_question,
        audioUrl: res.audio_url,
      },
    ]);
    setUsage(res.usage);
    playAudio(res.audio_url);
    scrollDown();
  }

  function handleTurnError(err: unknown) {
    if (err instanceof ApiError && err.code === 'VOICE_LIMIT') {
      setVoiceLimited(true);
      Alert.alert(t('voiceEndedTitle'), t('voiceLimitReached'));
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}e`, role: 'assistant', content: t('chatReplyError') },
    ]);
  }

  async function sendText() {
    const text = input.trim();
    if (!text || loading || !sessionId) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `${Date.now()}u`, role: 'user', content: text }]);
    setLoading(true);
    scrollDown();
    try {
      const res = await aiApi.sendBuddyTextTurn(sessionId, text, token!);
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
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(t('permissionTitle'), t('micPermission'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch {
      Alert.alert(t('error'), t('recordStartError'));
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setRecording(false);
    setLoading(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri || !sessionId) throw new Error('no audio');
      const res = await aiApi.sendBuddyAudioTurn(sessionId, uri, token!);
      renderTurn(res.user_transcript || '🎤', res);
    } catch (err) {
      handleTurnError(err);
    } finally {
      setLoading(false);
    }
  }

  const usageLabel = usage ? formatUsage(usage) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('aiBuddyShort')} streak={5} />

      {/* Buddy selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.buddyRow}
        style={styles.buddyScroll}
      >
        {buddies.map((b) => {
          const active = selected?.slug === b.slug;
          return (
            <Pressable
              key={b.slug}
              style={[styles.buddyCard, active && styles.buddyActive]}
              onPress={() => selectBuddy(b)}
            >
              {b.avatarThumbUrl ? (
                <Image source={{ uri: b.avatarThumbUrl }} style={styles.buddyImg} resizeMode="contain" />
              ) : b.slug === 'spark' ? (
                <Image source={sparkImg} style={styles.buddyImg} resizeMode="contain" />
              ) : (
                <AppText style={styles.buddyEmoji}>{b.emoji}</AppText>
              )}
              <View style={styles.buddyNameRow}>
                <View style={[styles.dot, { backgroundColor: active ? c.success : c.borderStrong }]} />
                <AppText variant="caption" color={c.text} style={styles.buddyName}>{b.name}</AppText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Usage meter */}
      {!!usageLabel && (
        <View style={styles.usageRow}>
          <Ionicons name="mic-outline" size={12} color={c.textSecondary} />
          <AppText variant="caption" color={usage?.warn_level === 'warn95' ? c.danger : c.textSecondary}>
            {usageLabel}
          </AppText>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={<EmptyState buddy={selected} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <MessageBubble message={item} onReplay={playAudio} buddy={selected} />}
      />

      {loading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={c.primary} />
          <AppText variant="caption">{selected?.name ?? 'AI'} {t('typing')}</AppText>
        </View>
      )}

      {voiceLimited && (
        <View style={styles.limitBanner}>
          <AppText variant="caption" color={c.danger} center>
            {t('voiceMonthEnded')}
          </AppText>
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <Pressable
            style={[styles.voiceBtn, recording && styles.voiceBtnActive, voiceLimited && styles.voiceBtnDisabled]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={voiceLimited || !sessionId}
          >
            <Ionicons name={recording ? 'stop' : 'mic-outline'} size={20} color={recording ? c.white : c.textSecondary} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={recording ? t('listeningPlaceholder') : t('typeMessage')}
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={1000}
            onSubmitEditing={sendText}
            returnKeyType="send"
            editable={!recording}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendText}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={20} color={c.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && <Image source={thumb} style={styles.avatarImg} resizeMode="contain" />}
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
    </View>
  );
}

function EmptyState({ buddy }: { buddy: Buddy | null }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const thumb = buddy?.avatarThumbUrl ? { uri: buddy.avatarThumbUrl } : sparkImg;
  return (
    <View style={styles.emptyState}>
      <Image source={thumb} style={styles.emptyImg} resizeMode="contain" />
      <AppText variant="h2" center style={styles.emptyTitle}>
        {tf('chatGreeting', { name: buddy?.name ?? t('defaultBuddyName') })}
      </AppText>
      <AppText variant="body" color={c.textSecondary} center>
        {t('chatGreetingBody')}
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
  buddyScroll: { flexGrow: 0, marginTop: spacing.xs, marginBottom: spacing.sm },
  buddyRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  buddyCard: {
    width: 68, alignItems: 'center', backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: 'transparent',
  },
  buddyActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  buddyEmoji: { fontSize: 30 },
  buddyImg: { width: 46, height: 46, borderRadius: 23 },
  buddyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  buddyName: { fontWeight: '700' },
  usageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: spacing.xs },
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
  limitBanner: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.text,
  },
  voiceBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  voiceBtnActive: { backgroundColor: colors.danger },
  voiceBtnDisabled: { opacity: 0.4 },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: colors.borderStrong },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl },
  emptyImg: { width: 110, height: 110, borderRadius: 55, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
});
