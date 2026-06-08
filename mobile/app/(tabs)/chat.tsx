import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, ScrollView,
  Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as aiApi from '../../src/api/ai';
import { TopBar } from '../../src/components/TopBar';
import { colors, spacing, radius, fontSize } from '../../src/theme/theme';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** AI tutor characters. Only Спарк is active for now. */
const BUDDIES = [
  { id: 'spark', name: 'Спарк', emoji: '🦊', active: true },
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
      // Tapping your active buddy starts a fresh conversation.
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
      <View style={styles.buddyHeader}>
        <Text style={styles.buddyTitle}>Таны AI найз</Text>
        <Pressable onPress={() => onBuddyPress(false)}>
          <Text style={styles.seeAll}>Бүгдийг харах ›</Text>
        </Pressable>
      </View>
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
            <Text style={styles.buddyEmoji}>{b.emoji}</Text>
            <Text style={styles.buddyName}>
              {b.name} {b.active ? '🟢' : '⚪'}
            </Text>
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
          <Text style={styles.typingText}>AI бичиж байна...</Text>
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
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
            <Text style={styles.sendIcon}>➤</Text>
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
      {!isUser && <Text style={styles.avatar}>🦊</Text>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🦊</Text>
      <Text style={styles.emptyTitle}>Сайн уу! Би Спарк байна 👋</Text>
      <Text style={styles.emptySub}>
        Англи хэл дэх асуулт, дасгал, тайлбар — бүгдийг асуугаарай!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  buddyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, marginTop: spacing.xs,
  },
  buddyTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.navy },
  seeAll: { color: colors.primary, fontWeight: '700' },
  buddyScroll: { flexGrow: 0, marginVertical: spacing.sm },
  buddyRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  buddyCard: {
    width: 76, alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, paddingVertical: spacing.sm, borderWidth: 2, borderColor: 'transparent',
  },
  buddyActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  buddyEmoji: { fontSize: 34 },
  buddyName: { fontSize: fontSize.xs, fontWeight: '700', color: colors.navy, marginTop: 2 },
  messageList: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.sm },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  avatar: { fontSize: 26 },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, padding: spacing.md },
  bubbleAi: { backgroundColor: colors.cream, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  bubbleTextUser: { color: colors.white },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  typingText: { color: colors.textMuted, fontSize: fontSize.sm },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background,
  },
  input: {
    flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: colors.surface, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.md, color: colors.text,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendIcon: { color: colors.white, fontSize: fontSize.md, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.navy, textAlign: 'center', marginBottom: spacing.sm },
  emptySub: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
