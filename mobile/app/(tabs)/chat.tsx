import { useState, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, ScrollView, Image,
  Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import * as aiApi from '../../src/api/ai';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { TappableText } from '../../src/components/DictionaryProvider';
import { colors, spacing, radius } from '../../src/theme/theme';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const sparkImg = require('../../assets/buddy-menu.png');

/** AI tutor characters. Only Спарк is active for now (with a 3D avatar image;
 *  the rest use emoji until their art is added). */
type Buddy = { id: string; name: string; emoji?: string; image?: ImageSourcePropType; active?: boolean };
const BUDDIES: Buddy[] = [
  { id: 'spark', name: 'Спарк', image: sparkImg, active: true },
  { id: 'oli', name: 'Оли', emoji: '🦉' },
  { id: 'lili', name: 'Лили', emoji: '🐰' },
  { id: 'reks', name: 'Рекс', emoji: '🐲' },
  { id: 'pandi', name: 'Панди', emoji: '🐼' },
];

export default function ChatScreen() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: LocalMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await aiApi.sendMessage(text, token!, conversationId);
      setConversationId(res.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: res.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Уучлаарай, алдаа гарлаа. Дахин оролдоорой.' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function onBuddyPress(active?: boolean) {
    if (active) {
      setMessages([]);
      setConversationId(undefined);
    } else {
      Alert.alert('Тун удахгүй', 'Энэ дүр удахгүй нэмэгдэнэ. 🦊');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="AI Найз" streak={5} />

      {/* Buddy selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.buddyRow}
        style={styles.buddyScroll}
      >
        {BUDDIES.map((b) => (
          <Pressable
            key={b.id}
            style={[styles.buddyCard, b.active && styles.buddyActive]}
            onPress={() => onBuddyPress(b.active)}
          >
            {b.image ? (
              <Image source={b.image} style={styles.buddyImg} resizeMode="contain" />
            ) : (
              <AppText style={styles.buddyEmoji}>{b.emoji}</AppText>
            )}
            <View style={styles.buddyNameRow}>
              <View style={[styles.dot, { backgroundColor: b.active ? colors.success : colors.borderStrong }]} />
              <AppText variant="caption" color={colors.text} style={styles.buddyName}>{b.name}</AppText>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={<EmptyState />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />

      {loading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <AppText variant="caption">Спарк бичиж байна...</AppText>
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <Pressable
            style={styles.voiceBtn}
            onPress={() => Alert.alert('Тун удахгүй', 'Дуу хоолойгоор ярих боломж удахгүй нэмэгдэнэ. 🎤')}
          >
            <Ionicons name="mic-outline" size={20} color={colors.textSecondary} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Мессеж бичнэ үү..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: LocalMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && <Image source={sparkImg} style={styles.avatarImg} resizeMode="contain" />}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        {/* Spark's replies are English-rich — tap any word for a Mongolian
            explanation. User's own messages stay plain. */}
        {isUser ? (
          <AppText variant="body" color={colors.white}>
            {message.content}
          </AppText>
        ) : (
          <TappableText variant="body" color={colors.text}>
            {message.content}
          </TappableText>
        )}
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Image source={sparkImg} style={styles.emptyImg} resizeMode="contain" />
      <AppText variant="h2" center style={styles.emptyTitle}>Сайн уу! Би Спарк 👋</AppText>
      <AppText variant="body" color={colors.textSecondary} center>
        Англи хэлний асуулт, дасгал, тайлбар — бүгдийг асуугаарай.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  buddyScroll: { flexGrow: 0, marginTop: spacing.xs, marginBottom: spacing.sm },
  buddyRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  buddyCard: {
    width: 68, alignItems: 'center', backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: 'transparent',
  },
  buddyActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  buddyEmoji: { fontSize: 30 },
  buddyImg: { width: 46, height: 46, borderRadius: 23 },
  buddyNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  buddyName: { fontWeight: '700' },
  messageList: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.xs },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleAi: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.text,
  },
  voiceBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: colors.borderStrong },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl },
  emptyImg: { width: 110, height: 110, borderRadius: 55, marginBottom: spacing.md },
  emptyTitle: { marginBottom: spacing.sm },
});
