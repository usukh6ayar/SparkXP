import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { AppText } from '../Text';
import { PressableScale } from '../PressableScale';
import { formatTime } from '../audio/SeekBar';
import { useColors } from '../../settings/SettingsContext';
import { haptics } from '../../lib/haptics';
import { alertError } from '../../lib/alerts';
import { t } from '../../i18n';
import { spacing, radius, type AppColors } from '../../theme/theme';

/**
 * The answer control for an IELTS **Speaking** task.
 *
 * Speaking is spoken — it had a text box, which is the wrong instrument
 * entirely: nobody sits an IELTS Speaking test by typing, and practising it by
 * typing trains the wrong skill. So the answer here is a **recording**: hold the
 * mic, talk, then listen back and compare yourself against the model answer.
 *
 * Nothing is uploaded or scored. IELTS Speaking is marked by a human examiner
 * on fluency, pronunciation and range — none of which we can judge — so this is
 * deliberately a self-study loop: record → listen → read the model → try again.
 */
export function SpeakingAnswer({
  recordedUri,
  onRecorded,
}: {
  /** The take kept for this question, or undefined before the first one. */
  recordedUri?: string;
  onRecorded: (uri: string) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  // Recording clock. Only runs while the mic is open, so it costs nothing on
  // the other questions in the part.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      500,
    );
    return () => clearInterval(id);
  }, [recording]);


  async function start() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) { alertError(t('micPermission'), t('permissionTitle')); return; }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptics.tap();
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
    } catch (e) {
      // Жинхэнэ шалтгааныг харуулна — «Алдаа гарлаа» гэвэл юу болсныг
      // хэн ч мэдэхгүй (микрофон завгүй, горим солигдоогүй г.м.).
      setRecording(false);
      alertError(e instanceof Error ? e.message : t('errorGeneric'));
    }
  }

  async function stop() {
    setRecording(false);
    try {
      await recorder.stop();
      // Back to playback mode, or the take plays through the earpiece on iOS.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (recorder.uri) { haptics.success(); onRecorded(recorder.uri); }
    } catch (e) {
      alertError(e instanceof Error ? e.message : t('errorGeneric'));
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <PressableScale
          onPress={recording ? stop : start}
          style={[styles.mic, recording && { backgroundColor: c.danger }]}
        >
          <Ionicons name={recording ? 'stop' : 'mic'} size={26} color={c.white} />
        </PressableScale>

        <View style={styles.label}>
          <AppText variant="bodyStrong">
            {recording ? t('speakRecordingNow') : recordedUri ? t('speakAgain') : t('speakStart')}
          </AppText>
          <AppText variant="caption" color={c.textMuted}>
            {recording ? formatTime(elapsed) : t('speakHint')}
          </AppText>
        </View>

        {/* Тоглуулагч нь бичлэг гарсны ДАРАА л mount болно.
            Ярих хэсэгт нэг Part-д 4 хүртэл даалгавар байдаг — тэдгээр нь
            бүгд урьдчилж player үүсгэвэл микрофонтой аудио сесс булаалдаж,
            бичлэг эхлэхгүй байх эрсдэлтэй. */}
        {recordedUri && !recording ? (
          <TakePlayback uri={recordedUri} styles={styles} c={c} />
        ) : null}
      </View>
    </View>
  );
}

/** Өөрийн бичлэгээ сонсох — зөвхөн бичлэг байгаа үед mount болно. */
function TakePlayback({ uri, styles, c }: { uri: string; styles: Styles; c: AppColors }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        // Суларсан/эх сурвалжгүй player шидэлт хийдэг — сонсох товч дасгалыг
        // унагаах ёсгүй.
        try {
          if (status.playing) player.pause();
          else {
            player.seekTo(0);
            player.play();
          }
        } catch {
          // Тоглуулж чадсангүй — бичлэг хэвээр, дахин дарж болно.
        }
      }}
      hitSlop={8}
      style={styles.play}
    >
      <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={c.primary} />
    </Pressable>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    mic: {
      width: 52,
      height: 52,
      borderRadius: radius.full,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { flex: 1, gap: 1 },
    play: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
  });
