import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, FlatList, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  FadeIn,
} from 'react-native-reanimated';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/auth/AuthContext';
import { getWords, type Word } from '../src/api/words';
import { checkPronunciation, type SpeakCheckResult } from '../src/api/speaking';
import { speakEnglish } from '../src/components/dictionary/useWordLookup';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { PressableScale } from '../src/components/PressableScale';
import { EmptyState } from '../src/components/EmptyState';
import { haptics } from '../src/lib/haptics';
import { alertError } from '../src/lib/alerts';
import { useReduceMotion } from '../src/lib/motion';
import { t } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius, colors as staticColors, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/** Words per page (the list pages in as you scroll) and tries per word. */
const PAGE_SIZE = 40;
const MAX_ATTEMPTS = 3;

type Phase = 'idle' | 'recording' | 'checking' | 'result';

/* ─────────────────────────── Practice modal ─────────────────────────── */

/** The mic button — pulses a soft ring while recording. */
function MicButton({ phase, onPress, color, danger }: {
  phase: Phase; onPress: () => void; color: string; danger: string;
}) {
  const reduce = useReduceMotion();
  const pulse = useSharedValue(0);
  const recording = phase === 'recording';
  useEffect(() => {
    cancelAnimation(pulse);
    if (recording && !reduce) pulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
    else pulse.value = 0;
  }, [recording, reduce, pulse]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.6 }],
  }));
  return (
    <View style={micStyles.wrap}>
      {recording ? <Animated.View style={[micStyles.ring, { backgroundColor: danger }, ringStyle]} pointerEvents="none" /> : null}
      <PressableScale
        style={[micStyles.btn, { backgroundColor: recording ? danger : color }]}
        disabled={phase === 'checking'}
        onPress={onPress}
      >
        {phase === 'checking' ? (
          <ActivityIndicator color={staticColors.white} />
        ) : (
          <Ionicons name={recording ? 'stop' : 'mic'} size={40} color={staticColors.white} />
        )}
      </PressableScale>
    </View>
  );
}

/** Practise one word: listen, record, check. Three tries, then reveal. */
function PracticeModal({ word, token, onClose }: { word: Word; token: string; onClose: () => void }) {
  const c = useColors();
  const styles = useMemo(() => makeModalStyles(c), [c]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<SpeakCheckResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);

  async function startRecording() {
    if (phase !== 'idle') return;
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) { Alert.alert(t('permissionTitle'), t('micPermission')); return; }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptics.tap();
      setPhase('recording');
    } catch { setPhase('idle'); }
  }

  async function stopAndCheck() {
    if (phase !== 'recording') return;
    setPhase('checking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!uri) throw new Error('no audio');
      const res = await checkPronunciation(uri, word.english, token);
      setResult(res);
      setPhase('result');
      if (res.correct) haptics.success();
      else {
        haptics.warning();
        if (attempts + 1 >= MAX_ATTEMPTS) setRevealed(true);
        setAttempts((a) => a + 1);
      }
    } catch (e) {
      setPhase('idle');
      alertError(e instanceof Error ? e.message : t('errorGeneric'));
    }
  }

  function retry() {
    setPhase('idle');
    setResult(null);
  }

  const isCorrect = phase === 'result' && result?.correct;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, bounded]}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={c.textSecondary} />
          </Pressable>

          <AppText variant="overline" color={c.textMuted} center>{t('speakInstruction')}</AppText>
          <AppText style={styles.word} color={c.text} center numberOfLines={1}>{word.english}</AppText>
          <AppText variant="body" color={c.textSecondary} center>{word.mongolian}</AppText>
          <PressableScale style={styles.listenBtn} onPress={() => speakEnglish(word.english)}>
            <Ionicons name="volume-high" size={18} color={c.primary} />
            <AppText variant="label" color={c.primary}>{t('speakListen')}</AppText>
          </PressableScale>

          {phase === 'result' && result ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.feedback, { backgroundColor: isCorrect ? c.successSoft : c.surfaceAlt }]}>
              <View style={styles.feedbackHead}>
                <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={20} color={isCorrect ? c.success : c.danger} />
                <AppText variant="bodyStrong" color={isCorrect ? c.success : c.danger}>
                  {isCorrect ? t('speakCorrect') : t('speakTryAgain')}
                </AppText>
              </View>
              {result.transcript ? (
                <AppText variant="caption" color={c.textSecondary} center>{t('speakHeard')}: “{result.transcript}”</AppText>
              ) : null}
              {revealed && !isCorrect ? (
                <AppText variant="caption" color={c.textMuted} center>{t('speakAnswerWas')} {word.english}</AppText>
              ) : null}
            </Animated.View>
          ) : (
            <AppText variant="caption" color={c.textMuted} center style={styles.status}>
              {phase === 'recording' ? t('speakRecording') : phase === 'checking' ? t('speakChecking') : `${attempts}/${MAX_ATTEMPTS}`}
            </AppText>
          )}

          {/* Controls */}
          {isCorrect || revealed ? (
            <PressableScale style={styles.doneBtn} onPress={onClose}>
              <LinearGradient colors={staticColors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <AppText variant="bodyStrong" color={staticColors.white}>{t('continue')}</AppText>
            </PressableScale>
          ) : phase === 'result' ? (
            <PressableScale style={styles.retryBtn} onPress={retry}>
              <Ionicons name="refresh" size={18} color={c.primary} />
              <AppText variant="bodyStrong" color={c.primary}>{t('speakTryAgain')}</AppText>
            </PressableScale>
          ) : (
            <MicButton phase={phase} onPress={phase === 'recording' ? stopAndCheck : startRecording} color={c.primary} danger={c.danger} />
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ───────────────────────────── List screen ───────────────────────────── */

/**
 * Speaking / pronunciation exercise.
 *
 * A scrollable list of ALL the words the admin added (the Үгс bank). Tap a word
 * to practise it: listen, record, and the server STT checks your pronunciation.
 */
export default function SpeakingScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { token } = useAuth();

  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Word | null>(null);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    getWords(token, { page: 1, limit: PAGE_SIZE })
      .then((r) => { setWords(r.items); setTotal(r.total); })
      .catch((e) => console.warn('Speaking words load failed:', (e as Error)?.message ?? e))
      .finally(() => setLoading(false));
  }, [token]);

  const loadMore = useCallback(async () => {
    if (!token || loadingMoreRef.current || words.length >= total) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const r = await getWords(token, { page: next, limit: PAGE_SIZE });
      setWords((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        return [...prev, ...r.items.filter((w) => !seen.has(w.id))];
      });
      setTotal(r.total);
      pageRef.current = next;
    } catch (e) {
      console.warn('Speaking loadMore failed:', (e as Error)?.message ?? e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [token, words.length, total]);

  const renderItem = useCallback(
    ({ item: w }: { item: Word }) => (
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => { haptics.tap(); setSelected(w); }}
      >
        <View style={styles.rowIcon}>
          <Ionicons name="mic" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>{w.english}</AppText>
          <AppText variant="caption" color={c.textSecondary} numberOfLines={1}>{w.mongolian}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
      </Pressable>
    ),
    [styles, c],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('speakTitle')} back showBadges={false} />
        <ActivityIndicator color={c.primary} style={styles.center} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('speakTitle')} back showBadges={false} />
      <FlatList
        data={words}
        keyExtractor={(w) => w.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.container, bounded]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          words.length > 0 ? (
            <AppText variant="caption" color={c.textMuted} style={styles.hint}>{t('speakPickWord')}</AppText>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState icon="mic-outline" title={t('speakTitle')} hint={t('speakEmpty')} style={styles.center} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={c.primary} style={styles.footer} /> : <View style={styles.footerSpacer} />
        }
      />

      {selected && token ? (
        <PracticeModal key={selected.id} word={selected} token={token} onClose={() => setSelected(null)} />
      ) : null}
    </SafeAreaView>
  );
}

const micStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  btn: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center',
    shadowColor: staticColors.primary, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
});

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, marginTop: spacing.xxl },
    container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
    hint: { marginBottom: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    rowIcon: {
      width: 40, height: 40, borderRadius: radius.md,
      backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center',
    },
    footer: { marginVertical: spacing.lg },
    footerSpacer: { height: 110 },
    pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  });

const makeModalStyles = (c: AppColors) =>
  StyleSheet.create({
    sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,4,26,0.55)' },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
      alignItems: 'center',
    },
    closeBtn: { position: 'absolute', top: spacing.md, right: spacing.md, padding: 4 },
    word: { fontSize: 40, lineHeight: 48, fontWeight: '800', textAlign: 'center', marginTop: 4 },
    listenBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm,
      paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.full, backgroundColor: c.primarySoft,
    },
    status: { minHeight: 20, marginTop: spacing.sm },
    feedback: { alignSelf: 'stretch', borderRadius: radius.lg, padding: spacing.md, gap: 6, alignItems: 'center', marginTop: spacing.sm },
    feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    doneBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 54, alignSelf: 'stretch', marginTop: spacing.lg, borderRadius: radius.lg, overflow: 'hidden',
    },
    retryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 54, alignSelf: 'stretch', marginTop: spacing.lg, borderRadius: radius.lg,
      borderWidth: 1, borderColor: c.primary,
    },
  });
