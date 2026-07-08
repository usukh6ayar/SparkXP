import { useMemo, useState } from 'react';
import { View, Modal, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Button } from './Button';
import { AppImage } from './AppImage';
import { PressableScale } from './PressableScale';
import { haptics } from '../lib/haptics';
import { useColors } from '../settings/SettingsContext';
import { t, tf } from '../i18n';
import { spacing, radius, colors as staticColors, type AppColors } from '../theme/theme';
import type { Buddy } from '../api/ai';

type UnlockMethod = 'sparks' | 'premium';

/**
 * Centered "unlock this buddy" dialog — Spark vs Premium choice.
 * Sparks unlock is a client-only placeholder (flips local state, doesn't spend
 * the user's real balance) until Usukhbayar ships a buddy-unlock endpoint that
 * mirrors LessonUnlock (POST /ai/buddies/:slug/unlock, sparksSpent snapshot).
 * The Premium/money option is a UI stub — no payment integration exists yet.
 */
export function BuddyUnlockSheet({
  visible,
  buddy,
  sparksBalance,
  onClose,
  onUnlocked,
}: {
  visible: boolean;
  buddy: Buddy | null;
  sparksBalance: number;
  onClose: () => void;
  onUnlocked: (buddy: Buddy) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [method, setMethod] = useState<UnlockMethod>('sparks');

  if (!buddy) return null;

  const cost = buddy.unlockCostSparks ?? 0;
  const canAffordSparks = sparksBalance >= cost;

  function handleUnlock() {
    if (!buddy) return;
    if (method === 'premium') {
      Alert.alert(t('buddyUnlockPremium'), t('buddyUnlockComingSoon'));
      return;
    }
    if (!canAffordSparks) {
      Alert.alert(t('buddyUnlockInsufficient'));
      return;
    }
    haptics.success();
    onUnlocked(buddy);
    Alert.alert(tf('buddyUnlockSuccess', { name: buddy.name }));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={20} color={c.text} />
          </Pressable>

          <View style={styles.avatarWrap}>
            {buddy.avatarThumbUrl ? (
              <AppImage source={{ uri: buddy.avatarThumbUrl }} width={72} style={styles.avatarImg} contentFit="contain" />
            ) : (
              <AppText style={styles.avatarEmoji}>{buddy.emoji}</AppText>
            )}
          </View>

          <AppText variant="h2" center style={styles.title}>
            {tf('buddyUnlockTitle', { name: buddy.name })}
          </AppText>
          <AppText variant="body" color={c.textSecondary} center style={styles.subtitle}>
            {t('buddyUnlockSubtitle')}
          </AppText>

          <OptionRow
            icon="flame"
            iconColor={staticColors.streak}
            label={t('buddyUnlockWithSparks')}
            sublabel={`${cost} · ${tf('buddyUnlockBalance', { n: sparksBalance })}`}
            selected={method === 'sparks'}
            disabled={!canAffordSparks}
            onPress={() => setMethod('sparks')}
            colors={c}
          />
          <OptionRow
            icon="diamond"
            iconColor={staticColors.sparks}
            label={t('buddyUnlockPremium')}
            sublabel={t('buddyUnlockPremiumBody')}
            selected={method === 'premium'}
            onPress={() => setMethod('premium')}
            colors={c}
          />

          <Button label={t('buddyUnlockNow')} onPress={handleUnlock} style={styles.unlockBtn} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function OptionRow({
  icon, iconColor, label, sublabel, selected, disabled, onPress, colors: c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  sublabel: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  colors: AppColors;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        rowStyles.row,
        { backgroundColor: c.surfaceAlt, borderColor: selected ? c.primary : 'transparent' },
        disabled && rowStyles.disabled,
      ]}
    >
      <View style={[rowStyles.iconCircle, { backgroundColor: c.background }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={rowStyles.textCol}>
        <AppText variant="bodyStrong" color={c.text}>{label}</AppText>
        <AppText variant="caption" color={c.textSecondary}>{sublabel}</AppText>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? c.primary : c.textMuted}
      />
    </PressableScale>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginTop: spacing.sm,
  },
  disabled: { opacity: 0.5 },
  iconCircle: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1 },
});

const makeStyles = (c: AppColors) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    card: {
      width: '100%', maxWidth: 380, backgroundColor: c.surface, borderRadius: radius.xl,
      padding: spacing.xl, paddingTop: spacing.xxl, alignItems: 'stretch',
    },
    closeBtn: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 1 },
    avatarWrap: {
      alignSelf: 'center', width: 88, height: 88, borderRadius: radius.full, marginBottom: spacing.md,
      backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center',
    },
    avatarImg: { width: 72, height: 72, borderRadius: 36 },
    avatarEmoji: { fontSize: 44 },
    title: { marginBottom: 4 },
    subtitle: { marginBottom: spacing.sm },
    unlockBtn: { marginTop: spacing.lg },
  });
