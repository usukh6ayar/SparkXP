import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../../src/components/TopBar';
import { colors, spacing, radius, fontSize, tints } from '../../src/theme/theme';

interface Game {
  icon: string;
  title: string;
  desc: string;
  tint: { bg: string; fg: string };
}

const GAMES: Game[] = [
  { icon: '🔤', title: 'Үг таах', desc: 'Зураг харж, зөв үгийг сонгоорой.', tint: tints.green },
  { icon: '🎧', title: 'Сонсох', desc: 'Аудио сонсоод, зөв хариуг сонгоорой.', tint: tints.blue },
  { icon: '📘', title: 'Дүрэм', desc: 'Грамматик дүрмийн даалгавар.', tint: tints.purple },
  { icon: '⏱️', title: 'Хурдан хариулт', desc: 'Хугацаанд багтааж зөв хариулаарай!', tint: tints.amber },
  { icon: '🧩', title: 'Холбох', desc: 'Үг, зураг эсвэл өгүүлбэрийг холбоорой.', tint: tints.pink },
  { icon: '📝', title: 'Дүүргэх', desc: 'Хоосон зайг зөв үгээр нөхөөрэй.', tint: tints.teal },
];

export default function SorilScreen() {
  const open = () => Alert.alert('Тун удахгүй', 'Энэ тоглоом удахгүй нэмэгдэнэ. 🦊');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar back streak={5} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Сорил & тоглоомууд</Text>
        <Text style={styles.subtitle}>
          Суралцахаа хөгжилтэй тоглоомуудаар үргэлжлүүлээрэй!
        </Text>

        <View style={styles.grid}>
          {GAMES.map((g) => (
            <Pressable
              key={g.title}
              style={[styles.card, { backgroundColor: g.tint.bg }]}
              onPress={open}
            >
              <Text style={styles.icon}>{g.icon}</Text>
              <Text style={[styles.cardTitle, { color: g.tint.fg }]}>{g.title}</Text>
              <Text style={styles.cardDesc}>{g.desc}</Text>
              <View style={styles.xpBadge}>
                <Text style={styles.xpText}>✨ 10</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Daily challenge */}
        <View style={styles.challenge}>
          <Text style={styles.challengeText}>
            🏆 Өнөөдөр 3 тоглоом тоглож, нэмэлт ✨ 20 аваарай!
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '33%' }]} />
          </View>
          <Text style={styles.progressLabel}>1 / 3</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: 150,
  },
  icon: { fontSize: 36, marginBottom: spacing.sm },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800' },
  cardDesc: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 4, flex: 1 },
  xpBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  xpText: { fontWeight: '800', color: colors.sparks, fontSize: fontSize.sm },
  challenge: {
    backgroundColor: colors.cream,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  challengeText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.navy },
  progressTrack: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { height: 10, borderRadius: radius.full, backgroundColor: colors.primary },
  progressLabel: { alignSelf: 'flex-end', fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4, fontWeight: '700' },
});
