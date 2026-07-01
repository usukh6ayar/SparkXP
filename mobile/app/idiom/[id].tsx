import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useAuth } from '../../src/auth/AuthContext';
import { getIdiom, type Idiom } from '../../src/api/idioms';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { TappableText } from '../../src/components/DictionaryProvider';
import { Card } from '../../src/components/Card';
import { Loading } from '../../src/components/Loading';
import { t } from '../../src/i18n';
import { spacing, radius, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/** Idiom detail: phrase, Mongolian, meaning, definition, example, audio. */
export default function IdiomDetailScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const player = useAudioPlayer();
  const [idiom, setIdiom] = useState<Idiom | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setIdiom(await getIdiom(id, token));
    } catch (e) {
      console.warn('Idiom load failed:', (e as Error)?.message ?? e);
      setIdiom(null);
    }
  }, [token, id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  function playAudio() {
    if (!idiom) return;
    if (idiom.audioUrl) {
      try {
        player.replace({ uri: idiom.audioUrl });
        player.play();
        return;
      } catch {
        /* fall through to device TTS */
      }
    }
    Speech.stop();
    Speech.speak(idiom.phrase, { language: 'en-US', rate: 0.9 });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('idiomsTitle')} back showBadges={false} />
      {loading ? (
        <Loading />
      ) : !idiom ? (
        <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
          {t('idiomNotFound')}
        </AppText>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Cover */}
          <View style={styles.cover}>
            {idiom.imageUrl ? (
              <Image source={{ uri: idiom.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
                <Ionicons name="chatbubbles" size={70} color="rgba(255,255,255,0.25)" style={styles.coverIcon} />
              </LinearGradient>
            )}
          </View>

          {/* Phrase + audio */}
          <View style={styles.headRow}>
            <AppText variant="h1" style={{ flex: 1 }}>{idiom.phrase}</AppText>
            <Pressable onPress={playAudio} style={styles.speaker} hitSlop={8}>
              <Ionicons name="volume-high" size={22} color={colors.white} />
            </Pressable>
          </View>
          <AppText variant="h3" color={colors.primary} style={styles.mongolian}>{idiom.mongolian}</AppText>

          {idiom.meaning ? (
            <Section label={t('meaningLabel')}>
              <AppText variant="body">{idiom.meaning}</AppText>
            </Section>
          ) : null}

          {idiom.definition ? (
            <Section label={t('definitionLabel')}>
              <AppText variant="body">{idiom.definition}</AppText>
            </Section>
          ) : null}

          {idiom.exampleSentence ? (
            <Section label={t('exampleLabel')}>
              <Card variant="filled" style={styles.example}>
                <TappableText variant="body">{idiom.exampleSentence}</TappableText>
                {idiom.exampleTranslation ? (
                  <AppText variant="caption" color={colors.textSecondary} style={styles.exampleTr}>
                    {idiom.exampleTranslation}
                  </AppText>
                ) : null}
              </Card>
            </Section>
          ) : null}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <AppText variant="overline" color={colors.textMuted} style={styles.sectionLabel}>{label}</AppText>
      {children}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  cover: { height: 160, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceAlt, marginBottom: spacing.lg },
  coverIcon: { position: 'absolute', right: 18, bottom: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  speaker: {
    width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  mongolian: { marginTop: spacing.xs, marginBottom: spacing.md },
  section: { marginTop: spacing.lg },
  sectionLabel: { marginBottom: spacing.xs },
  example: { gap: spacing.sm },
  exampleTr: { marginTop: spacing.xs },
  empty: { marginTop: spacing.xxl },
});
