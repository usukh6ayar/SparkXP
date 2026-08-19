import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BuddySelector } from '../../src/components/BuddySelector';
import { BuddyStatsRow } from '../../src/components/BuddyStatsRow';
import { BuddyShopEntry } from '../../src/components/BuddyShopEntry';
import { getEquippedBackground } from '../../src/api/buddyBackgrounds';
import { BuddyVoiceStage } from '../../src/components/BuddyVoiceStage';
import { BuddyChatSheet, type ChatMessage } from '../../src/components/BuddyChatSheet';
import { BuddyHistorySheet } from '../../src/components/BuddyHistorySheet';
import { EmptyState } from '../../src/components/EmptyState';
import { buildMockBuddies, FOX_SLUG } from '../../src/constants/mockBuddies';
import {
  useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, RecordingPresets,
  requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { useAuth } from '../../src/auth/AuthContext';
import * as aiApi from '../../src/api/ai';
import { sendBuddyTextTurnSmart, sendBuddyAudioTurnSmart } from '../../src/api/buddyRealtime';
import type { Buddy, BuddyUsageBlock, BuddyTextSession, BuddyTextSessionSummary } from '../../src/api/ai';
import { ApiError } from '../../src/api/client';
import { TopBar } from '../../src/components/TopBar';
import { useColors, useSettings } from '../../src/settings/SettingsContext';
import { t, tf } from '../../src/i18n';
import { type AppColors } from '../../src/theme/theme';

/**
 * Recording settings for a speech turn: mono 16 kHz at 32 kbps AAC, still in the
 * .m4a container the backend expects. HIGH_QUALITY (stereo 44.1 kHz, 128 kbps)
 * is music-grade — it makes the upload ~8× bigger for no gain, since the speech
 * model downsamples to 16 kHz mono anyway, and every extra byte is time the
 * user spends watching "бодож байна…" on mobile data.
 */
const SPEECH_RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
};

export default function ChatScreen() {
  const { token } = useAuth();
  const c = useColors();
  // Reactive translator: subscribing here re-renders this (always-mounted) tab
  // when the language changes. Module-level helpers below use the same i18n.
  const { t, lang } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);

  /**
   * Is the buddy feature open on the server (`AI_BUDDY_ENABLED`)?
   *
   * `null` = not answered yet. Turns bill ElevenLabs and Anthropic per call
   * while payments are off, so the owner ships with it closed; the server
   * decides, which is what lets it be opened later with no app update. The API
   * helper fails closed, so offline/old-backend also lands on "Тун удахгүй"
   * rather than a tab that 503s on the first thing the user says.
   */
  const [buddyEnabled, setBuddyEnabled] = useState<boolean | null>(null);

  // select → pick a buddy · voice → hold-to-talk stage (chat rises as a sheet)
  const [mode, setMode] = useState<'select' | 'voice'>('select');
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [buddiesLoading, setBuddiesLoading] = useState(true);
  const [buddiesError, setBuddiesError] = useState(false);
  const [buddiesErrorDetail, setBuddiesErrorDetail] = useState<string | null>(null);
  const [selected, setSelected] = useState<Buddy | null>(null);
  // Slugs the backend actually knows (from getBuddies) + a fallback real slug.
  // Only dev builds can hold a buddy the DB doesn't know (the mock roster is
  // __DEV__-gated), and those route their session to a real buddy. In
  // production every listed buddy is real, so the fallback never fires.
  const [realSlugs, setRealSlugs] = useState<Set<string>>(new Set());
  const [fallbackSlug, setFallbackSlug] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // AI Buddy practice stats (minutes today / all-time) — shown on the picker.
  const [stats, setStats] = useState<aiApi.BuddyStatistics | null>(null);
  // Equipped background (shop) shown behind the buddy on the voice stage.
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  // Persistent typed-chat thread (ChatGPT-style history), separate from voice.
  const [textSessionId, setTextSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // The voice screen's latest spoken reply (kept apart from the text `messages`).
  const [voiceReply, setVoiceReply] = useState<string | null>(null);
  // What the LLM asked the avatar's face to do on the last turn (emotion + gesture).
  const [avatarEmotion, setAvatarEmotion] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [usage, setUsage] = useState<BuddyUsageBlock | null>(null);
  const [voiceLimited, setVoiceLimited] = useState(false);
  // Closed captions on the voice screen — show/hide the buddy's spoken text.
  const [captions, setCaptions] = useState(true);
  // Slug the persistent text thread is bound to (real buddy or fallback).
  const [textSlug, setTextSlug] = useState<string | null>(null);
  // Typed-chat bottom sheet (rises over the blurred voice stage).
  const [chatOpen, setChatOpen] = useState(false);
  // ChatGPT-style history sheet: past typed-chat threads for this buddy.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<BuddyTextSessionSummary[]>([]);

  const holdRef = useRef(false); // synchronous "mic is held" flag (see startRecording)
  const player = useAudioPlayer();
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(SPEECH_RECORDING);

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

  // Play speech both here (replay a chat bubble) and after a voice turn.
  //
  // Typed-chat replies usually come back with `audio_url = null` (ElevenLabs TTS
  // only runs on voice turns, to save credit), so the speaker button used to pop
  // an "audio unavailable" alert and stay silent. Now it falls back to the
  // device's own TTS with the reply text — the same trick the saved-words and
  // flashcard screens use — so the button always speaks.
  async function playAudio(url?: string | null, text?: string | null) {
    try {
      // Recording flips the audio session into record mode (mic/earpiece, and
      // muted by the ringer switch). Flip it back to speaker playback that isn't
      // silenced by the silent switch, or the reply plays but is inaudible.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (url) {
        player.replace({ uri: url });
        player.play();
        return;
      }
      if (text?.trim()) {
        Speech.stop(); // never stack two readings on a double-tap
        Speech.speak(text.trim(), { language: 'en-US' });
        return;
      }
      Alert.alert(t('audioUnavailableTitle'), t('audioUnavailable'));
    } catch {
      Alert.alert(t('error'), t('audioPlayError'));
    }
  }

  // Load the buddy list; the user picks + Applies one on the selector screen
  // before any session is started (see BuddySelector / mode === 'select').
  // In DEV the real buddies are padded out with mocks (see mockBuddies.ts) so
  // the full carousel/lock design can be reviewed; `buildMockBuddies` returns
  // [] in production, so shipped builds list only what admin has published.
  const loadBuddies = useCallback(() => {
    if (!token) return;
    // Don't fetch the roster for a tab we're about to replace with the
    // coming-soon screen. `null` (still asking) also waits — no flash of the
    // real UI before the answer lands.
    if (buddyEnabled !== true) return;
    setBuddiesLoading(true);
    setBuddiesError(false);
    setBuddiesErrorDetail(null);
    aiApi.getBuddies(token)
      .then((real) => {
        const covered = new Set(real.map((r) => r.slug));
        setRealSlugs(covered);
        setFallbackSlug(real[0]?.slug ?? null);
        // Real buddies exist → show ONLY them (no mock padding). The DEV mocks
        // (mockBuddies.ts) are a fallback for an empty backend so the carousel
        // design can still be reviewed; once real buddies are authored they'd
        // just duplicate them (e.g. a second "Спарк" with no avatar).
        if (real.length > 0) {
          setBuddies(real);
        } else {
          const mocks = buildMockBuddies(t, lang);
          const fox = mocks.find((m) => m.slug === FOX_SLUG);
          const rest = mocks.filter((m) => m.slug !== FOX_SLUG);
          setBuddies(fox ? [fox, ...rest] : rest);
        }
      })
      .catch((err) => {
        setBuddiesError(true);
        const detail = err instanceof ApiError ? `${err.status} ${err.message}` : String(err);
        setBuddiesErrorDetail(detail);
        console.warn('getBuddies failed:', detail);
      })
      .finally(() => setBuddiesLoading(false));
  }, [token, t, lang, buddyEnabled]);

  // Ask the server whether the feature is open, once per sign-in.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    aiApi.getBuddyAvailability(token).then((on) => {
      if (alive) setBuddyEnabled(on);
    });
    return () => { alive = false; };
  }, [token]);

  useEffect(() => { loadBuddies(); }, [loadBuddies]);

  /** Refresh the practice-time stats + equipped background on focus. */
  const loadStats = useCallback(() => {
    if (!token || buddyEnabled !== true) return;
    aiApi.getBuddyStatistics(token).then(setStats).catch(() => {});
    getEquippedBackground(token).then((b) => setBgUrl(b?.imageUrl ?? null)).catch(() => {});
  }, [token, buddyEnabled]);

  /**
   * Leaving the tab silences the buddy at once.
   *
   * A tab screen is not unmounted when you switch away, so a reply that is
   * mid-sentence — the ElevenLabs file on `player`, or the device-TTS fallback —
   * otherwise follows the student onto Home and keeps talking.
   */
  useFocusEffect(
    useCallback(() => {
      loadStats();
      return () => {
      Speech.stop();
      try {
        player.pause();
      } catch {
        // best-effort — never break navigation over playback
      }
      // Hand the audio session back in playback mode. `startRecording` puts the
      // WHOLE app into `allowsRecording: true`, and only `playAudio` ever clears
      // it — so walking away after holding the mic left every other screen
      // routing sound to the earpiece, where it just sounds like the volume
      // faded out (read-along, saved words, flashcards, all of it).
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      };
    }, [player, loadStats]),
  );

  const selectBuddy = useCallback(async (buddy: Buddy) => {
    if (!token) return;
    setSelected(buddy);
    setMessages([]);
    setVoiceReply(null);
    setSessionId(null);
    setTextSessionId(null);
    setChatOpen(false);
    setHistoryOpen(false);
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

  /**
   * End the active voice session (idempotent server-side) and refresh stats, so
   * the picker reflects the minutes just practised. Called when the learner
   * leaves the conversation.
   */
  const endActiveSession = useCallback(() => {
    if (sessionId && token) {
      aiApi.endBuddySession(sessionId, token).catch(() => {}).finally(loadStats);
    }
  }, [sessionId, token, loadStats]);

  /** Open the history sheet and (re)load this buddy's past typed threads. */
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

  /** Switch the typed chat to a specific past thread (or start a fresh one).
   *  The history sheet dismisses itself (animated); we just load the thread. */
  const openThread = useCallback(async (opts: { sessionId?: string; fresh?: boolean }) => {
    if (!token || !textSlug) return;
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

  /** Delete a past thread from history. Optimistic: drop it from the list right
   *  away; if it's the open thread, start a fresh one. Persists via
   *  DELETE /ai/buddy/text-session/:id (a failure is logged, not surfaced). */
  const deleteHistorySession = useCallback(async (id: string) => {
    setHistorySessions((prev) => prev.filter((s) => s.sessionId !== id));
    if (id === textSessionId) openThread({ fresh: true });
    if (!token) return;
    try {
      await aiApi.deleteBuddyTextSession(id, token);
    } catch (e) {
      const d = e instanceof ApiError ? `${e.status} ${e.message}` : String(e);
      console.warn('deleteBuddyTextSession unavailable:', d);
    }
  }, [token, textSessionId, openThread]);

  /**
   * A completed VOICE turn. The voice screen is speak-only and ephemeral — it
   * shows just the latest spoken reply (in the buddy's bubble) and never writes
   * to the text `messages` list, so the two sections stay separate.
   */
  function renderVoiceTurn(res: aiApi.TurnResponse) {
    setVoiceReply(res.reply_text);
    setAvatarEmotion(res.avatar_instruction?.emotion);
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

  /** Send a typed message (the chat sheet owns the draft input + clears it). */
  async function sendMessage(text: string) {
    if (loading || !textSessionId) return;
    setMessages((prev) => [...prev, { id: `${Date.now()}u`, role: 'user', content: text }]);
    setLoading(true);
    try {
      const startedAt = Date.now();
      const res = await sendBuddyTextTurnSmart(textSessionId, text, token!);
      if (__DEV__) console.log(`[buddy] text turn took ${Date.now() - startedAt} ms`);
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
      const startedAt = Date.now();
      const res = await sendBuddyAudioTurnSmart(sessionId, uri, token!);
      // The turn is STT + LLM + TTS on the server; log it so a slow reply can be
      // pinned on the pipeline rather than guessed at.
      if (__DEV__) console.log(`[buddy] voice turn took ${Date.now() - startedAt} ms`);
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

  // Feature closed on the server (or not answered yet — see `buddyEnabled`).
  // Rendered before any buddy UI so nothing that costs money is reachable, and
  // so the user is told plainly instead of hitting a 503 mid-sentence.
  if (buddyEnabled !== true) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('aiBuddyShort')} showDictionary />
        {buddyEnabled === false ? (
          <EmptyState
            icon="time-outline"
            title={t('buddyClosedTitle')}
            hint={t('buddyClosedBody')}
          />
        ) : (
          // Still asking. Blank rather than a spinner: the answer is one cached
          // request away, and a flash of spinner on every tab visit is worse.
          null
        )}
      </SafeAreaView>
    );
  }

  if (mode === 'select') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar
          title={t('buddySelectTitle')}
          showDictionary
          onAddSparks={() => Alert.alert(t('buddyUnlockComingSoon'))}
        />
        <BuddyStatsRow stats={stats} />
        <BuddyShopEntry />
        <BuddySelector
          buddies={buddies}
          onApply={(buddy) => { selectBuddy(buddy); setMode('voice'); }}
          loading={buddiesLoading}
          error={buddiesError}
          errorDetail={buddiesErrorDetail}
          onRetry={loadBuddies}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        title={selected?.name ?? t('aiBuddyShort')}
        subtitle={t('buddyOnline')}
        showDictionary
        back
        onBack={() => {
          // Same rule as leaving the tab: the reply must not follow you back to
          // the buddy carousel, which is about to speak its own greeting.
          Speech.stop();
          try { player.pause(); } catch { /* best-effort */ }
          endActiveSession(); // close the session → its minutes count in stats
          setMode('select');
        }}
      />
      <Animated.View key="voice" entering={FadeIn.duration(260)} style={styles.flex}>
        <BuddyVoiceStage
          buddy={selected}
          greeting={voiceGreeting}
          backgroundUrl={bgUrl}
          speaking={playerStatus.playing}
          emotion={avatarEmotion}
          speechText={voiceReply}
          // expo-audio reports seconds; the avatar stretches its mouth-shape
          // sequence over this so the lips keep pace with the actual voice.
          speechDurationMs={playerStatus.duration ? playerStatus.duration * 1000 : null}
          thinking={loading}
          voiceLimited={voiceLimited}
          usageLabel={usageLabel}
          usageLevel={usage?.warn_level}
          captions={captions}
          onToggleCaptions={() => setCaptions((v) => !v)}
          onRecordStart={startRecording}
          onRecordCommit={stopRecording}
          onRecordCancel={cancelRecording}
          onOpenText={() => setChatOpen(true)}
        />
      </Animated.View>

      {chatOpen && (
        <BuddyChatSheet
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          onReplay={playAudio}
          onOpenHistory={openHistory}
        />
      )}

      {historyOpen && (
        <BuddyHistorySheet
          open={historyOpen}
          loading={historyLoading}
          sessions={historySessions}
          activeId={textSessionId}
          onClose={() => setHistoryOpen(false)}
          onNewChat={() => openThread({ fresh: true })}
          onPick={(id) => openThread({ sessionId: id })}
          onDelete={deleteHistorySession}
        />
      )}
    </SafeAreaView>
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
});
