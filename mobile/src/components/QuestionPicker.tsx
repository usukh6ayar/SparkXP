import { useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Card } from './Card';
import { Pill } from './Pill';
import { FilterChips } from './FilterChips';
import { TextField } from './TextField';
import { EmptyState } from './EmptyState';
import { t, tf } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';
import type { Quiz } from '../api/quizzes';

/**
 * Багш даалгаварт өгөх **асуултуудаа сонгох** самбар.
 *
 * Яагаад сонголт нь асуултын түвшинд байдаг вэ: даалгаврын сангийн нэг тест
 * 15 асуулттай байж болох ба багш нэг хичээлд 5-ыг л өгнө. Тестийг 15 тусдаа
 * дасгал болгож хуваах нь сан зохиох ажлыг 3 дахин нэмэгдүүлнэ.
 *
 * **Хоёр сэдэв нэг дор.** Сонголт нь `quizId → индексүүд` гэсэн газрын зурагт
 * хуримтлагддаг тул багш «Present Simple»-ээс 3, «Modal verbs»-ээс 2 сонгоод
 * нэг дор явуулж болно (сэдэв солиход өмнөх сонголт хэвээр үлдэнэ).
 */

/** `quizId` → сонгосон асуултын индексүүд. Хоосон массив = сонгоогүй. */
export type PickedQuestions = Record<string, number[]>;

/** Сэдэвгүй тестүүд ч ямар нэг бүлэгт харагдах ёстой. */
const UNGROUPED = '—';

/** Тестийн бүлэг: админы бичсэн сэдэв, байхгүй бол түвшин. */
function groupOf(quiz: Quiz): string {
  return quiz.topic?.trim() || quiz.level?.toUpperCase() || UNGROUPED;
}

/**
 * Асуултын мөрөнд харуулах текст.
 *
 * `word_match`-д асуултын өгүүлбэр гэж байхгүй (зөвхөн үгийн хосууд) тул
 * хосын тоогоор нь тайлбарлана — эс бөгөөс жагсаалтад хоосон мөр гарна.
 */
function questionLabel(q: Quiz['questions'][number]): string {
  if (q.question?.trim()) return q.question.trim();
  if (q.prompt?.trim()) return q.prompt.trim();
  if (q.pairs?.length) return tf('pickerMatchPairs', { n: q.pairs.length });
  return t('pickerQuestion');
}

/** Нийт хэдэн асуулт, хэдэн сэдвээс сонгогдсоныг тоолно. */
export function countPicked(
  picked: PickedQuestions,
  quizzes: Quiz[],
): { questions: number; topics: number } {
  const byId = new Map(quizzes.map((q) => [q.id, q]));
  const topics = new Set<string>();
  let questions = 0;
  for (const [quizId, indexes] of Object.entries(picked)) {
    if (!indexes.length) continue;
    questions += indexes.length;
    const quiz = byId.get(quizId);
    if (quiz) topics.add(groupOf(quiz));
  }
  return { questions, topics: topics.size };
}

export function QuestionPicker({
  quizzes,
  picked,
  onChange,
}: {
  quizzes: Quiz[];
  picked: PickedQuestions;
  onChange: (next: PickedQuestions) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // Бүлгүүдийг байгаа контентоос үүсгэнэ — хоосон сэдвийн чип гаргахгүй.
  const chips = useMemo(() => {
    const seen = [...new Set(quizzes.map(groupOf))].sort();
    return [
      { key: 'all', label: t('filterAll') },
      ...seen.map((g) => ({ key: g, label: g })),
    ];
  }, [quizzes]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quizzes.filter(
      (quiz) =>
        (group === 'all' || groupOf(quiz) === group) &&
        (!q ||
          quiz.title.toLowerCase().includes(q) ||
          (quiz.topic ?? '').toLowerCase().includes(q)),
    );
  }, [quizzes, group, query]);

  function setFor(quizId: string, indexes: number[]) {
    const next = { ...picked };
    // Хоосон сонголтыг хадгалах шаардлагагүй — оноох үед шүүх нэг алхам хэмнэнэ.
    if (indexes.length) next[quizId] = indexes;
    else delete next[quizId];
    onChange(next);
  }

  function toggleQuestion(quizId: string, index: number) {
    const current = picked[quizId] ?? [];
    setFor(
      quizId,
      current.includes(index)
        ? current.filter((i) => i !== index)
        : [...current, index].sort((a, b) => a - b),
    );
  }

  function toggleAll(quiz: Quiz) {
    const all = quiz.questions.map((_, i) => i);
    const isAll = (picked[quiz.id]?.length ?? 0) === all.length;
    setFor(quiz.id, isAll ? [] : all);
  }

  if (quizzes.length === 0) {
    return (
      <EmptyState
        icon="clipboard-outline"
        title={t('pickerEmpty')}
        hint={t('pickerEmptyHint')}
      />
    );
  }

  return (
    <View>
      <TextField
        label={t('assignSearch')}
        placeholder={t('assignSearch')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      {/* Нэг бүлэг л байвал чипс сонголт биш чимэг болно. */}
      {chips.length > 2 ? (
        <FilterChips
          value={group}
          options={chips}
          onChange={setGroup}
          style={{ marginBottom: spacing.sm }}
        />
      ) : null}

      {visible.length === 0 ? (
        <AppText variant="caption" color={c.textSecondary} style={styles.note}>
          {t('assignNoMatch')}
        </AppText>
      ) : null}

      {visible.map((quiz) => {
        const chosen = picked[quiz.id] ?? [];
        const open = openId === quiz.id;
        const allOn = chosen.length === quiz.questions.length && chosen.length > 0;
        return (
          <Card key={quiz.id} variant="flat" padding="md" style={styles.card}>
            <Pressable
              style={styles.header}
              onPress={() => setOpenId(open ? null : quiz.id)}
            >
              <View style={styles.headerText}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {quiz.title}
                </AppText>
                <View style={styles.meta}>
                  {/* «Даалгаврын сан» гэсэн түгжээтэй шошго байсныг хассан:
                      энэ жагсаалтад одоо ЗӨВХӨН сангийн дасгал ирдэг тул мөр
                      болгон дээр давтагдаад мэдээлэл өгөхөө больсон. Тэр
                      баримтыг дэлгэцийн дээд талын нэг мөр тайлбар хэлнэ. */}
                  <Pill label={groupOf(quiz)} />
                  <AppText variant="caption" color={c.textMuted}>
                    {chosen.length > 0
                      ? `${chosen.length}/${quiz.questions.length}`
                      : tf('questionCount', { n: quiz.questions.length })}
                  </AppText>
                </View>
              </View>
              <Ionicons
                name={open ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={c.textMuted}
              />
            </Pressable>

            {open ? (
              <View style={styles.questions}>
                <Pressable style={styles.row} onPress={() => toggleAll(quiz)}>
                  <Ionicons
                    name={allOn ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={allOn ? c.primary : c.textMuted}
                  />
                  <AppText variant="caption" color={c.primary}>
                    {t('assignAllQuestions')}
                  </AppText>
                </Pressable>
                {quiz.questions.map((q, i) => {
                  const on = chosen.includes(i);
                  return (
                    <Pressable
                      key={i}
                      style={styles.row}
                      onPress={() => toggleQuestion(quiz.id, i)}
                    >
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={on ? c.primary : c.textMuted}
                      />
                      <AppText
                        variant="caption"
                        color={on ? c.text : c.textSecondary}
                        style={styles.qText}
                        numberOfLines={2}
                      >
                        {i + 1}. {questionLabel(q)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    note: { marginBottom: spacing.sm },
    card: { marginBottom: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerText: { flex: 1, gap: spacing.xs },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
    questions: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: spacing.xs,
      borderRadius: radius.sm,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
    qText: { flex: 1 },
  });
