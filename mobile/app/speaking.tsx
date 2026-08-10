import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { t, tf } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius, colors as staticColors, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/** How many words a practice round pulls, and how many tries per word. */
const ROUND_SIZE = 10;
const MAX_ATTEMPTS = 3;

type Phase = 'idle' | 'recording' | 'checking' | 'result';

/**
 * Speaking exercise — say the word aloud.
 *
 * Listen to the word (device TTS), tap the mic, say it; the recording goes to
 * `POST /speaking/check` (server STT) and comes back right/wrong. Three tries per
 * word, then the answer is revealed. A word-level pronunciation drill.
 */
export default function SpeakingScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { token } = useAuth();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<SpeakCheckResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const word = words[index];
  const finished = !loading && words.length > 0 && index >= words.length;

  useEffect(() => {
    if (!token) return;
    getWords(token, { limit: ROUND_SIZE })
      .then((r) => setWords(r.items))
      .catch((e) => console.warn('Speaking words load failed:', (e as Error)?.message ?? e))
      .finally(() => setLoading(false));
  }, [token]);

  /** Advance to the next word, resetting the per-word state. */
  const next = useCallback(() => {
    setIndex((i) => i + 1);
    setAttempts(0);
    setResult(null);
    setRevealed(false);
    setPhase('idle');
  }, []);

  async function startRecording() {
    if (phase !== 'idle') return;
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(t('permissionTitle'), t('micPermission'));
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptics.tap();
      setPhase('recording');
    } catch {
      setPhase('idle');
    }
  }

  async function stopAndCheck() {
    if (phase !== 'recording' || !word || !token) return;
    setPhase('checking');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!uri) throw new Error('no audio');
      const res = await checkPronunciation(uri, word.english, token);
      setResult(res);
      setPhase('result');
      if (res.correct) {
        haptics.success();
        setCorrectCount((n) => n + 1);
      } else {
        haptics.warning();
        // Out of tries → reveal the answer, then let them move on.
        if (attempts + 1 >= MAX_ATTEMPTS) setRevealed(true);
        setAttempts((a) => a + 1);
      }
    } catch (e) {
      setPhase('idle');
      alertError(e instanceof Error ? e.message : t('errorGeneric'));
    }
  }

  // ── Loading / empty / finished ────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('speakTitle')} back showBadges={false} />
        <ActivityIndicator color={c.primary} style={styles.center} />
      </SafeAreaView>
    );
  }
  if (words.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('speakTitle')} back showBadges={false} />
        <EmptyState icon="mic-outline" title={t('speakTitle')} hint={t('speakEmpty')} style={styles.center} />
      </SafeAreaView>
    );
  }
  if (finished) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('speakTitle')} back showBadges={false} />
        <View style={styles.center}>
          <Ionicons name="trophy" size={64} color={staticColors.xp} />
          <AppText variant="h1" color={c.text} style={{ marginTop: spacing.md }}>{t('speakDoneTitle')}</AppText>
          <AppText variant="h3" color={c.textSecondary}>{tf('speakScore', { n: correctCount, total: words.length })}</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const isCorrect = phase === 'result' && result?.correct;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('speakTitle')} back showBadges={false} />
      <ScrollView contentContainerStyle={[styles.container, bounded]}>
        <AppText variant="caption" color={c.textMuted} center>
          {index + 1} / {words.length}
        </AppText>

        {/* The word to say */}
        <View style={styles.card}>
          <AppText variant="h1" color={c.text} center>{word.english}</AppText>
          <AppText variant="body" color={c.textSecondary} center>{word.mongolian}</AppText>
          <PressableScale style={styles.listenBtn} onPress={() => speakEnglish(word.english)}>
            <Ionicons name="volume-high" size={18} color={c.primary} />
            <AppText variant="label" color={c.primary}>{t('speakListen')}</AppText>
          </PressableScale>
        </View>

        {/* Feedback */}
        {phase === 'result' && result ? (
          <View style={[styles.feedback, { backgroundColor: isCorrect ? c.successSoft : c.surfaceAlt }]}>
            <AppText variant="bodyStrong" color={isCorrect ? c.success : c.danger} center>
              {isCorrect ? t('speakCorrect') : t('speakTryAgain')}
            </AppText>
            {result.transcript ? (
              <AppText variant="caption" color={c.textSecondary} center>
                {t('speakHeard')}: “{result.transcript}”
              </AppText>
            ) : null}
            {revealed && !isCorrect ? (
              <AppText variant="caption" color={c.textMuted} center>{t('speakAnswerWas')} {word.english}</AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="body" color={c.textMuted} center style={styles.hint}>
            {phase === 'recording' ? t('speakRecording') : phase === 'checking' ? t('speakChecking') : t('speakInstruction')}
          </AppText>
        )}

        {/* Mic / next control */}
        <View style={styles.controls}>
          {phase === 'result' && (isCorrect || revealed) ? (
            <PressableScale style={styles.nextBtn} onPress={next}>
              <LinearGradient colors={staticColors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <AppText variant="bodyStrong" color={staticColors.white}>{t('continue')}</AppText>
              <Ionicons name="arrow-forward" size={18} color={staticColors.white} />
            </PressableScale>
          ) : (
            <PressableScale
              style={[styles.micBtn, phase === 'recording' && styles.micBtnActive]}
              disabled={phase === 'checking'}
              onPress={phase === 'recording' ? stopAndCheck : startRecording}
            >
              {phase === 'checking' ? (
                <ActivityIndicator color={staticColors.white} />
              ) : (
                <Ionicons name={phase === 'recording' ? 'stop' : 'mic'} size={36} color={staticColors.white} />
              )}
            </PressableScale>
          )}
          {phase !== 'result' || (!isCorrect && !revealed) ? (
            <AppText variant="caption" color={c.textMuted}>
              {phase === 'recording' ? t('speakRecording') : `${attempts}/${MAX_ATTEMPTS}`}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    container: { padding: spacing.lg, gap: spacing.lg, alignItems: 'stretch' },
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.xl,
      gap: spacing.sm,
      alignItems: 'center',
    },
    listenBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: c.primarySoft,
    },
    hint: { marginTop: spacing.sm },
    feedback: { borderRadius: radius.lg, padding: spacing.md, gap: 4 },
    controls: { alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
    micBtn: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micBtnActive: { backgroundColor: c.danger },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 52,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },
  });
