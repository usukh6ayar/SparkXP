import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { IconTile } from '../../src/components/IconTile';
import { Pill } from '../../src/components/Pill';
import { ProgressBar } from '../../src/components/ProgressBar';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface Game {
  icon: IconName;
  title: string;
  desc: string;
  tint: { bg: string; fg: string };
}

const GAMES: Game[] = [
  { icon: 'eye', title: 'Үг таах', desc: 'Зураг харж, зөв үгийг сонго.', tint: tints.green },
  { icon: 'headset', title: 'Сонсох', desc: 'Аудио сонсож хариул.', tint: tints.blue },
  { icon: 'book', title: 'Дүрэм', desc: 'Грамматик дасгал.', tint: tints.purple },
  { icon: 'timer', title: 'Хурдан хариулт', desc: 'Хугацаанд багтаа!', tint: tints.amber },
  { icon: 'git-compare', title: 'Холбох', desc: 'Үг, зургийг холбо.', tint: tints.pink },
  { icon: 'create', title: 'Дүүргэх', desc: 'Хоосон зайг нөх.', tint: tints.teal },
];

const DAILY_DONE = 1;
const DAILY_GOAL = 3;

export default function SorilScreen() {
  const open = () => Alert.alert('Тун удахгүй', 'Энэ тоглоом удахгүй нэмэгдэнэ. 🦊');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar back />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <AppText variant="h1">Сорил &amp; тоглоом</AppText>
        <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
          Хөгжилтэй тоглоомоор дадлага хий.
        </AppText>

        <View style={styles.grid}>
          {GAMES.map((g) => (
            <Pressable
              key={g.title}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={open}
            >
              <View style={styles.cardTop}>
                <IconTile icon={g.icon} bg={g.tint.bg} fg={g.tint.fg} size={42} />
                <Pill label="+10" icon="flash" bg={tints.orange.bg} fg={colors.xp} />
              </View>
              <AppText variant="h3" style={styles.cardTitle}>{g.title}</AppText>
              <AppText variant="caption">{g.desc}</AppText>
            </Pressable>
          ))}
        </View>

        {/* Daily challenge */}
        <View style={styles.challenge}>
          <View style={styles.challengeHead}>
            <Ionicons name="trophy" size={18} color={colors.sparks} />
            <AppText variant="h3" color={colors.white}>Өдрийн сорил</AppText>
          </View>
          <AppText variant="caption" color={colors.textOnDarkMuted} style={styles.challengeSub}>
            3 тоглоом тоглож нэмэлт 20 XP ав.
          </AppText>
          <ProgressBar value={DAILY_DONE / DAILY_GOAL} track="rgba(255,255,255,0.15)" style={styles.progress} />
          <AppText variant="label" color={colors.white} style={styles.progressLabel}>
            {DAILY_DONE} / {DAILY_GOAL}
          </AppText>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  subtitle: { marginTop: 2, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  card: {
    width: '48.5%',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 132,
  },
  cardPressed: { backgroundColor: colors.surface, transform: [{ scale: 0.99 }] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { marginBottom: 2 },
  challenge: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  challengeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  challengeSub: { marginTop: spacing.xs },
  progress: { marginTop: spacing.md },
  progressLabel: { alignSelf: 'flex-end', marginTop: spacing.xs },
});
