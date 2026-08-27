import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Avatar } from './Avatar';
import { Pill } from './Pill';
import { StudentAnswers } from './StudentAnswers';
import { getAssignmentSubmissions, type Submission } from '../api/teacher';
import { useAuth } from '../auth/AuthContext';
import { t, tf } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing } from '../theme/theme';

/** Нэг сурагчийн бүх багц дээрх нэгтгэсэн байдал. */
interface StudentProgress {
  studentId: string;
  fullName: string | null;
  /** Хэдэн багц хийсэн бэ. */
  done: number;
  /** Хэдэн багц оногдсон бэ. */
  total: number;
  /** Хийсэн багцуудын дундаж оноо (оноогүй бол `null`). */
  scorePct: number | null;
  /** Ямар нэг багцыг хугацаанаас хожуу хийсэн эсэх. */
  late: boolean;
}

/**
 * Нэг даалгаврыг **хэн хийсэн, хэр хийсэн** бэ.
 *
 * ⚠️ Нэгж нь **сурагч**, багц биш. Багш «Present Simple»-ийн 5 багцыг нэг
 * даалгавар болгож өгдөг ба сурагч түүнийг багц багцаар нь гүйцэтгэдэг —
 * тиймээс багшийн асуулт нь «Болд хэдэн багц хийчихсэн бэ» болохоос «энэ
 * багцад ямар сурагчид байна» биш. Урьд нь багц бүрийн доор бүх сурагчийн
 * нэр давтагдаж гарч, хийсэн эсэх нь тодорхойгүй байв.
 *
 * **Хийгээгүй нь эхэлж** — багшийн хөөцөлдөх ёстой цорын ганц хэсэг тэр.
 *
 * Задрах үед л татна (`assignmentIds` бүрд нэг хүсэлт) — 20 даалгавартай
 * анги нээхэд 20 хүсэлт явахгүй.
 */
export function SubmissionList({
  packs,
}: {
  /** Багцууд — id ба **нэр**. Нэр нь алдааны задаргааны гарчиг болно. */
  packs: { id: string; label: string }[];
}) {
  const { token } = useAuth();
  const c = useColors();
  const [rows, setRows] = useState<StudentProgress[] | null>(null);
  const [failed, setFailed] = useState(false);
  /** Аль сурагчийн алдааны задаргаа нээлттэй байна вэ (нэг нь л). */
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  // Массив нь render бүрд шинэ хаяг авдаг тул хамаарлын түлхүүр болгож
  // ашиглаж болохгүй — эс бөгөөс мөнхийн давталтад орно.
  const key = packs.map((p) => p.id).join(',');

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all(key.split(',').map((id) => getAssignmentSubmissions(id, token)))
      .then((lists) => active && setRows(merge(lists)))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [key, token]);

  if (failed) {
    return (
      <AppText variant="caption" color={c.danger} style={styles.pad}>
        {t('errorGeneric')}
      </AppText>
    );
  }
  if (!rows) {
    return <ActivityIndicator color={c.primary} style={styles.pad} />;
  }

  const pending = rows.filter((r) => r.done < r.total);
  const done = rows.filter((r) => r.done === r.total);

  /** Баруун талын чип — сурагчийн явц. Хоосон мөр = огт эхлээгүй. */
  const chip = (r: StudentProgress) => {
    if (r.done === 0) return null;
    if (r.done < r.total) {
      // Эхэлсэн ч дуусаагүй — хамгийн хэрэгтэй мэдээлэл нь хэд үлдсэн нь.
      return (
        <Pill
          label={tf('submissionsPacksDone', { done: r.done, total: r.total })}
          bg={c.warningSoft}
          fg={c.warning}
          icon="hourglass-outline"
        />
      );
    }
    return (
      <Pill
        label={r.scorePct != null ? `${r.scorePct}%` : t('submissionsDone')}
        icon={r.late ? 'time-outline' : 'checkmark'}
        bg={r.late ? c.warningSoft : c.successSoft}
        fg={r.late ? c.warning : c.success}
      />
    );
  };

  const group = (label: string, list: StudentProgress[], tint: string) =>
    list.length === 0 ? null : (
      <View style={styles.group}>
        <AppText variant="overline" color={tint}>
          {label} · {list.length}
        </AppText>
        {list.map((r) => {
          // Юу ч хийгээгүй сурагчид задлах зүйл алга — дарагдахгүй.
          const canOpen = r.done > 0;
          const isOpen = openStudent === r.studentId;
          return (
            <View key={r.studentId}>
              <Pressable
                style={styles.row}
                disabled={!canOpen}
                onPress={() => setOpenStudent(isOpen ? null : r.studentId)}
              >
                <Avatar name={r.fullName} size={28} />
                <AppText variant="body" style={styles.name} numberOfLines={1}>
                  {r.fullName ?? '—'}
                </AppText>
                {chip(r)}
                {canOpen ? (
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={c.borderStrong}
                  />
                ) : null}
              </Pressable>
              {isOpen ? (
                <StudentAnswers packs={packs} studentId={r.studentId} />
              ) : null}
            </View>
          );
        })}
      </View>
    );

  return (
    // Нимгэн зураас нь энэ жагсаалтыг дээрх даалгаврын мөртэй нь холбоно —
    // эс бөгөөс нээгдсэн нэрс дараагийн даалгавар мэт харагдана.
    <View style={[styles.wrap, { borderTopColor: c.border }]}>
      {rows.length === 0 ? (
        <AppText variant="caption" color={c.textSecondary}>
          {t('noStudents')}
        </AppText>
      ) : (
        <>
          {group(t('submissionsPending'), pending, c.warning)}
          {group(t('submissionsDone'), done, c.success)}
        </>
      )}
    </View>
  );
}

/**
 * Багц бүрийн жагсаалтуудыг **сурагчаар** нэгтгэнэ.
 *
 * Багц бүр ижил сурагчдад оногддог тул нэг сурагч жагсаалт бүрд нэг мөртэй
 * гарна; тэдгээрийг тоолж «3/5 багц» гэсэн ганц мөр болгоно.
 */
function merge(lists: Submission[][]): StudentProgress[] {
  const byStudent = new Map<string, StudentProgress & { scores: number[] }>();
  for (const list of lists) {
    for (const s of list) {
      const row = byStudent.get(s.studentId) ?? {
        studentId: s.studentId,
        fullName: s.fullName,
        done: 0,
        total: 0,
        scorePct: null,
        late: false,
        scores: [],
      };
      row.total += 1;
      if (s.status !== 'assigned') row.done += 1;
      if (s.status === 'late') row.late = true;
      if (s.scorePct != null) row.scores.push(s.scorePct);
      byStudent.set(s.studentId, row);
    }
  }
  return [...byStudent.values()].map(({ scores, ...row }) => ({
    ...row,
    // Дундаж оноо — багц бүр өөрийн дүнтэй тул нэгийг нь сонгох биш дунджаар.
    scorePct: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
  }));
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pad: { paddingVertical: spacing.md },
  group: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
});
