import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { getAssignmentAnswers, type AssignmentAnswers } from '../api/teacher';
import { useAuth } from '../auth/AuthContext';
import { Pill } from './Pill';
import { t } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius } from '../theme/theme';

/**
 * **Сурагч юун дээр алдав.**
 *
 * Багш «6/10» гэсэн дүнгээс цааш юу ч харж чаддаггүй байсан — аль асуулт дээр,
 * юу гэж хариулснаа мэдэхгүй бол дараагийн хичээлдээ юуг давтахаа шийдэж
 * чадахгүй. Одоо асуулт бүр: сурагчийн хариулт ба зөв хариулт хажуу хажуугаа.
 *
 * **Алдсан асуултууд эхэлж** — багшийн хайж байгаа зүйл тэр. Зөв хийснийг нь
 * доор нь, намуухан өнгөөр.
 *
 * Багц бүр өөрийн илгээлттэй тул `assignmentIds` бүрд нэг хүсэлт явна —
 * зөвхөн багш тухайн сурагчийн нэрийг дарахад.
 */
export function StudentAnswers({
  packs: parts,
  studentId,
}: {
  /**
   * Багцууд — **нэртэйгээр**. Урьд нь зөвхөн id ирдэг байсан тул гарчиг нь
   * «1-р багц» гэсэн дугаар байв: багш ямар сэдэв дээр алдсаныг нь мэдэхийн
   * тулд дээшээ гүйлгэж, тоогоо тоолох хэрэгтэй болдог байлаа.
   */
  packs: { id: string; label: string }[];
  studentId: string;
}) {
  const { token } = useAuth();
  const c = useColors();
  const [data, setData] = useState<AssignmentAnswers[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Массив нь render бүрд шинэ хаягтай болдог тул хамаарлын түлхүүр нь мөр.
  const key = parts.map((p) => p.id).join(',');

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all(key.split(',').map((id) => getAssignmentAnswers(id, studentId, token)))
      .then((r) => active && setData(r))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [key, studentId, token]);

  if (failed) {
    return (
      <AppText variant="caption" color={c.danger} style={styles.pad}>
        {t('errorGeneric')}
      </AppText>
    );
  }
  if (!data) return <ActivityIndicator color={c.primary} style={styles.pad} />;

  // Багцын нэрийг хариутай нь хослуулна (дараалал нь `parts`-тай ижил).
  const answered = data
    .map((pack, i) => ({ ...pack, label: parts[i]?.label ?? '' }))
    .filter((p) => p.questions.length > 0);
  if (answered.length === 0) {
    return (
      <AppText variant="caption" color={c.textMuted} style={styles.pad}>
        {t('answersEmpty')}
      </AppText>
    );
  }

  /** Сурагчийн хариултыг уншигдахаар — сонголтын дугаарыг текст болгоно. */
  const shown = (q: AssignmentAnswers['questions'][number]) => {
    if (q.studentAnswer == null) return t('answerSkipped');
    if (typeof q.studentAnswer === 'number') {
      return q.options?.[q.studentAnswer] ?? `#${q.studentAnswer + 1}`;
    }
    return q.studentAnswer;
  };

  return (
    <View style={[styles.wrap, { borderLeftColor: c.border }]}>
      {answered.map((pack, packIndex) => {
        // Алдсан нь эхэлж — багшийн хайж байгаа зүйл.
        const rows = [...pack.questions].sort(
          (a, b) => Number(a.correct ?? true) - Number(b.correct ?? true),
        );
        const score = pack.scorePct ?? 0;
        const tone = score >= 70 ? c.success : score >= 40 ? c.warning : c.danger;
        return (
          <View
            key={pack.label + packIndex}
            style={[
              styles.pack,
              // Багц хооронд бодит зураас: урьд нь бүх асуулт нэг урсгал болж,
              // хаана нэг сэдэв дуусаад нөгөө нь эхэлснийг ялгах аргагүй байв.
              packIndex > 0 && { borderTopColor: c.border, ...styles.packDivider },
            ]}
          >
            {answered.length > 1 ? (
              <View style={styles.packHead}>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.packName}>
                  {pack.label}
                </AppText>
                <Pill label={`${score}%`} bg={tone + '22'} fg={tone} />
              </View>
            ) : null}
            {rows.map((q, i) => (
              <View key={i} style={styles.row}>
                <Ionicons
                  name={q.correct ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={q.correct ? c.success : c.danger}
                  style={styles.icon}
                />
                <View style={styles.body}>
                  <AppText variant="caption" color={c.text}>{q.question}</AppText>
                  {/* Зөв хийсэн асуултад тайлбар хэрэггүй — зөвхөн алдсаныг задална. */}
                  {q.correct === false ? (
                    <View style={styles.compare}>
                      <AppText variant="caption" color={c.danger}>
                        {t('answerGiven')}: {shown(q)}
                      </AppText>
                      <AppText variant="caption" color={c.success}>
                        {t('answerCorrect')}: {q.correctAnswer ?? '—'}
                      </AppText>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginLeft: spacing.lg,
    paddingLeft: spacing.md,
    paddingVertical: spacing.xs,
    borderLeftWidth: 2,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  pad: { paddingVertical: spacing.sm, paddingLeft: spacing.lg },
  pack: { gap: 4 },
  packDivider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, marginTop: 2 },
  packHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  packName: { flex: 1 },
  row: { flexDirection: 'row', gap: 6 },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 2 },
  compare: { gap: 1 },
});
