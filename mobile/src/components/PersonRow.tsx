import { type ReactNode } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { AppText } from './Text';
import { Avatar } from './Avatar';
import { spacing } from '../theme/theme';

/** Base row: avatar + name (+ @username), with slots for leading (e.g. rank) and trailing content. */
export function PersonRow({
  name,
  username,
  avatarUrl,
  avatarSize = 40,
  leading,
  right,
  onPress,
  style,
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  avatarSize?: number;
  leading?: ReactNode;
  right: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const Row = onPress ? Pressable : View;
  return (
    <Row style={[styles.row, style]} onPress={onPress}>
      {leading}
      <Avatar avatarUrl={avatarUrl} name={name} size={avatarSize} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
        {username ? (
          <AppText variant="caption" numberOfLines={1}>@{username}</AppText>
        ) : null}
      </View>
      {right}
    </Row>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  body: { flex: 1, gap: 1 },
});
