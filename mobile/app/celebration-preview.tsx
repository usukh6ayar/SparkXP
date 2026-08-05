import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CelebrationBackground } from '../src/components/celebration/CelebrationBackground';
import { CelebrationScreen } from '../src/components/celebration/CelebrationScreen';
import { SCENES, SCENE_ORDER, type SceneKey } from '../src/components/celebration/palette';
import { AppText } from '../src/components/Text';
import { TopBar } from '../src/components/TopBar';
import { haptics } from '../src/lib/haptics';
import { useColors } from '../src/settings/SettingsContext';
import { colors, radius, spacing } from '../src/theme/theme';

/**
 * Gallery for the four celebration worlds — a design tool, not a student route.
 *
 * Reached from Тохиргоо → DEV (that whole block is `__DEV__`-only, so Metro
 * strips it from a release bundle). It exists so the four plates can be
 * reviewed and screenshotted side by side, and so the live screen can be
 * checked over each one before shipping a copy change — the rotation otherwise
 * makes you finish four exercises to see them all.
 */
export default function CelebrationPreviewScreen() {
  const c = useColors();
  const [live, setLive] = useState<SceneKey | null>(null);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <TopBar title="Celebration scenes" back showBadges={false} />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <AppText variant="caption" color={c.textSecondary} style={styles.hint}>
          Дөрвүүлээ ээлжлэн гарна (kingdom → sky → mountain → space). Картыг дарж
          бодит баяр хүргэх дэлгэцийг тэр ертөнц дээр үзнэ үү.
        </AppText>

        {SCENE_ORDER.map((key, i) => (
          <Pressable
            key={key}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            onPress={() => { haptics.tap(); setLive(key); }}
          >
            {/* The real plate and the real scrim, just at tile size — this is
                what ships, not a mock-up of it. `animated` is off: twelve
                sparkle layers running behind a scroll view is pure waste. */}
            <CelebrationBackground scene={key} animated={false} />
            <View style={styles.tileLabel}>
              <AppText variant="overline" color="rgba(255,255,255,0.7)">
                {String(i + 1).padStart(2, '0')}
              </AppText>
              <AppText variant="h3" color={colors.textOnDark}>{SCENES[key].name}</AppText>
            </View>
            <View style={styles.playBadge}>
              <Ionicons name="play" size={14} color={colors.white} />
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <CelebrationScreen
        visible={live !== null}
        scene={live ?? undefined}
        eyebrow="ХИЧЭЭЛ ДУУСЛАА"
        title="Гайхалтай!"
        subtitle="Чи өнөөдрийн зорилгодоо дөхөж байна."
        xp={45}
        stats={[
          { icon: 'checkmark-circle', label: 'Зөв', value: '9/10', color: colors.success },
          { icon: 'time-outline', label: 'Хугацаа', value: '3:12', color: colors.sparks },
          { icon: 'flame', label: 'Дараалал', value: '7', color: colors.streak },
        ]}
        primary={{ label: 'Үргэлжлүүлэх', onPress: () => setLive(null) }}
        secondary={{ label: 'Дуусгах', onPress: () => setLive(null) }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  hint: { marginBottom: spacing.xs },
  tile: {
    height: 320,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#0B0730',
  },
  pressed: { opacity: 0.92 },
  tileLabel: { padding: spacing.lg, gap: 2 },
  playBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});
