import { t, tf } from '../i18n';

/**
 * How a due date should read to a student.
 *
 * A bare date ("8-р сарын 22") makes the student do the arithmetic themselves,
 * which is exactly the moment homework gets forgotten. This turns it into the
 * thing they actually want to know: how much time is left.
 *
 * `urgent` marks "today or tomorrow" so the row can colour it without every
 * caller re-deriving the rule.
 */
export interface DueState {
  label: string;
  overdue: boolean;
  urgent: boolean;
}

/** Whole days from now until `date`, counting a partial day as a full one. */
function daysUntil(date: Date): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDue = new Date(date);
  startOfDue.setHours(0, 0, 0, 0);
  return Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);
}

export function dueState(iso: string | null): DueState {
  if (!iso) return { label: t('noDueDate'), overdue: false, urgent: false };

  const due = new Date(iso);
  // Compare against the real instant, not midnight: a task due at 18:00 today
  // is not overdue at 09:00, and calendar-day maths alone would say it is.
  if (due.getTime() < Date.now()) {
    return { label: t('overdue'), overdue: true, urgent: false };
  }

  const days = daysUntil(due);
  if (days <= 0) return { label: t('dueToday'), overdue: false, urgent: true };
  if (days === 1) return { label: t('dueTomorrow'), overdue: false, urgent: true };
  return { label: tf('dueInDays', { n: days }), overdue: false, urgent: false };
}
