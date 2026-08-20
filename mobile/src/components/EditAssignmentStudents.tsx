import { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheetModal } from './SheetModal';
import { AppText } from './Text';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { ActionButton } from './ActionButton';
import { updateAssignmentStudents } from '../api/assignments';
import { useAuth } from '../auth/AuthContext';
import type { ClassStudent } from '../api/classes';
import { t } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing } from '../theme/theme';

/**
 * **Даалгаврын хүрээг засах** — хэнд оногдох вэ.
 *
 * Хоёр бодит хэрэгцээ: даалгавар өгсний дараа ангид **шинэ сурагч элсэх**, ба
 * буруу сонголтоо **залруулах**. Урьд нь ганц ч зам байгаагүй тул багш
 * даалгавраа устгаад дахин өгөх ёстой байсан — тэгэхэд аль хэдийн хийсэн
 * сурагчдын дүн бүгд алга болно.
 *
 * ⚠️ Нэг даалгавар олон багцтай байж болох тул **багц бүрд** нэг PATCH явна:
 * бүх багц ижил бүрэлдэхүүнтэй байх ёстой, эс бөгөөс сурагч 5 багцын 3-ыг нь
 * л хардаг болно.
 */
export function EditAssignmentStudents({
  visible,
  onClose,
  onSaved,
  assignmentIds,
  roster,
  /** Одоогийн хүрээ. `null` = бүх анги. */
  current,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  assignmentIds: string[];
  roster: ClassStudent[];
  current: string[] | null;
}) {
  const { token } = useAuth();
  const c = useColors();
  // `null` (бүх анги) = бүгдийг нь тэмдэглэсэнтэй ижил — багш «хэн харах вэ»
  // гэдгийг нэг л жагсаалтаас уншина.
  const [picked, setPicked] = useState<string[]>(
    current?.length ? current : roster.map((s) => s.id),
  );
  const all = picked.length === roster.length;

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save() {
    if (!token) return;
    // Бүгдийг тэмдэглэсэн = бүх анги (сервер дээр `NULL`) — ингэснээр дараа
    // элссэн сурагч ч энэ даалгаврыг автоматаар авна.
    const ids = all ? [] : picked;
    await Promise.all(assignmentIds.map((id) => updateAssignmentStudents(id, ids, token)));
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <AppText variant="h3">{t('editStudents')}</AppText>
      <AppText variant="caption" color={c.textSecondary} style={styles.hint}>
        {t('editStudentsHint')}
      </AppText>

      <Pressable style={styles.allRow} onPress={() => setPicked(all ? [] : roster.map((s) => s.id))}>
        <Ionicons
          name={all ? 'checkbox' : 'square-outline'}
          size={22}
          color={all ? c.primary : c.textMuted}
        />
        <AppText variant="bodyStrong" color={all ? c.primary : undefined}>
          {t('editStudentsAll')}
        </AppText>
      </Pressable>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {roster.map((s) => {
          const on = picked.includes(s.id);
          return (
            <Pressable key={s.id} style={styles.row} onPress={() => toggle(s.id)}>
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={22}
                color={on ? c.primary : c.textMuted}
              />
              <Avatar avatarUrl={s.avatarUrl} name={s.fullName} size={28} />
              <AppText variant="body" numberOfLines={1} style={styles.name}>
                {s.fullName}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ActionButton
        label={t('saveChanges')}
        action={save}
        onSuccess={() => { onSaved(); onClose(); }}
        // Хэнд ч оногдоогүй даалгавар нь даалгавар биш.
        disabled={picked.length === 0}
      />
      <Button label={t('back')} variant="secondary" onPress={onClose} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: 4, marginBottom: spacing.md },
  allRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  list: { maxHeight: 260 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  name: { flex: 1 },
});
