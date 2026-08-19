import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { AppText } from './Text';
import { StatusBadge } from './StatusBadge';
import { getAssignmentSubmissions, type Submission } from '../api/teacher';
import { useAuth } from '../auth/AuthContext';
import { t, tf } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing } from '../theme/theme';

/**
 * Who has handed one assignment in, and who has not.
 *
 * Until now the teacher could only answer this student by student — the
 * per-assignment endpoint existed and the API wrapper was written, but nothing
 * ever called it. This is the view that makes "who still owes me this?" a
 * glance instead of thirty taps.
 *
 * **Not done is listed first, and it is the only part that needs action.**
 * Sorting the finished students to the top would bury exactly the names the
 * teacher opened this for.
 *
 * Fetches lazily — only when the row is expanded — so opening a class with
 * twenty assignments does not fire twenty requests.
 */
export function SubmissionList({ assignmentId }: { assignmentId: string }) {
  const { token } = useAuth();
  const c = useColors();
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getAssignmentSubmissions(assignmentId, token)
      .then((r) => active && setRows(r))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [assignmentId, token]);

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

  const pending = rows.filter((r) => r.status === 'assigned');
  const done = rows.filter((r) => r.status !== 'assigned');

  const group = (label: string, list: Submission[], tint?: string) =>
    list.length === 0 ? null : (
      <View style={styles.group}>
        <AppText variant="label" color={tint ?? c.textSecondary}>
          {label} ({list.length})
        </AppText>
        {list.map((s) => (
          <View key={s.studentId} style={styles.row}>
            <AppText variant="body" style={styles.name} numberOfLines={1}>
              {s.fullName ?? '—'}
            </AppText>
            {s.scorePct != null ? (
              <AppText variant="label" color={c.textSecondary}>
                {s.scorePct}%
              </AppText>
            ) : null}
            <StatusBadge status={s.status} />
          </View>
        ))}
      </View>
    );

  return (
    <View style={styles.wrap}>
      {rows.length === 0 ? (
        <AppText variant="caption" color={c.textSecondary}>
          {t('noStudents')}
        </AppText>
      ) : (
        <>
          {/* Pending first — these are the students the teacher must chase. */}
          {group(t('submissionsPending'), pending, pending.length ? c.warning : undefined)}
          {group(t('submissionsDone'), done, c.success)}
          <AppText variant="caption" color={c.textMuted}>
            {tf('submissionsSummary', { done: done.length, total: rows.length })}
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingBottom: spacing.md },
  pad: { paddingVertical: spacing.md },
  group: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
});
