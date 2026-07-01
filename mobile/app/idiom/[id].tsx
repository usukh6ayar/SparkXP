import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { getIdiom, type Idiom } from '../../src/api/idioms';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { TappableText } from '../../src/components/DictionaryProvider';
import { Card } from '../../src/components/Card';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { t } from '../../src/i18n';
import { colors, spacing, radius } from '../../src/theme/theme';

/** Idiom detail: phrase, Mongolian, meaning, definition, example, audio. */
export default function IdiomDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const player = useAudioPlayer();
  const [idiom, setIdiom] = useState<Idiom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setIdiom(await getIdiom(id, token));
      setError(false);
      setNotFound(false);
    } catch (e) {
      console.warn('Idiom load failed:', (e as Error)?.message ?? e);
      setIdiom(null);
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true);
        setError(false);
      } else {
        setError(true);
        setNotFound(false);
      }
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
        <View style={styles.container}>
          <Skeleton height={160} radius={radius.xl} style={{ marginBottom: spacing.lg }} />
          <Skeleton height={26} width="65%" style={{ marginBottom: spacing.sm }} />
          <Skeleton height={18} width="45%" style={{ marginBottom: spacing.lg }} />
          <Skeleton height={12} width="30%" style={{ marginBottom: spacing.xs }} />
          <Skeleton height={16} style={{ marginBottom: spacing.lg }} />
          <Skeleton height={12} width="30%" style={{ marginBottom: spacing.xs }} />
          <Skeleton height={16} width="90%" />
        </View>
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: load }}
          style={styles.empty}
        />
      ) : notFound || !idiom ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('idiomNotFound')}
          style={styles.empty}
        />
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
  return (
    <View style={styles.section}>
      <AppText variant="overline" color={colors.textMuted} style={styles.sectionLabel}>{label}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
