import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useAuth } from '../src/auth/AuthContext';
import { getSaved, toggleSave, type LearnWord } from '../src/api/reviews';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { Loading } from '../src/components/Loading';
import { IconButton } from '../src/components/IconButton';
import { Card } from '../src/components/Card';
import { t } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../src/theme/theme';

/**
 * Saved words (⭐). Lists everything the user starred from the flashcard deck.
 * Tap 🔊 to hear it (uploaded audio or device TTS); tap ★ to unsave.
 */
export default function SavedScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [words, setWords] = useState<LearnWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const player = useAudioPlayer();

  const load = useCallback(async () => {
    if (!token) return;
    try { setWords(await getSaved(token)); } catch { /* keep current */ }
  }, [token]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function play(w: LearnWord) {
    if (w.audioUrl) {
      try { player.replace({ uri: w.audioUrl }); player.play(); return; } catch { /* fall through */ }
    }
    Speech.stop();
    Speech.speak(w.english, { language: 'en-US', rate: 0.9 });
  }

  function unsave(w: LearnWord) {
    setWords((list) => list.filter((x) => x.id !== w.id)); // optimistic
    if (token) toggleSave(token, w.id).catch(() => {});
  }

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar title={t('savedWords')} back />
      <FlatList
        data={words}
        keyExtractor={(w) => w.id}
        contentContainerStyle={words.length === 0 ? styles.emptyWrap : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText style={styles.emptyEmoji}>⭐</AppText>
            <AppText variant="h3" center>{t('noSavedWords')}</AppText>
            <AppText variant="body" color={c.textSecondary} center style={styles.emptyHint}>
              {t('noSavedWordsHint')}
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <Card variant="raised" padding="md" style={styles.row}>
            <View style={styles.thumb}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} />
              ) : (
                <Ionicons name="image-outline" size={20} color={c.textMuted} />
              )}
            </View>
            <View style={styles.info}>
              <AppText variant="h3" color={c.navy} numberOfLines={1}>{item.english}</AppText>
              <AppText variant="caption" color={c.primary} numberOfLines={1}>{item.mongolian}</AppText>
            </View>
            <IconButton icon="volume-high" size={38} variant="filled" iconColor={c.primary} onPress={() => play(item)} />
            <IconButton icon="star" size={38} variant="filled" iconColor={c.xp} onPress={() => unsave(item)} />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  list: { padding: spacing.lg, gap: spacing.sm },
  emptyWrap: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  info: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyHint: { marginTop: spacing.xs },
});
