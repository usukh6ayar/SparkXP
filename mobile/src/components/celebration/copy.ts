import { t } from '../../i18n';

/**
 * Which kind of thing was just finished.
 *
 * Every completion in the app maps to one of these. The list exists so that
 * adding a new flow means adding a case here — not inventing a fresh headline
 * at the call site, which is how five screens end up celebrating five
 * different-sized victories.
 */
export type CelebrationKind =
  | 'lesson'
  | 'quiz'
  | 'exercise'
  | 'reading'
  | 'review'
  | 'game'
  | 'daily';

export interface CelebrationCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
}

/**
 * The words for one completion.
 *
 * **The ceremony never changes — only the words do.** Same screen, same
 * animation, same weight, whether the student finished a twenty-minute lesson
 * or a sixty-second review deck. A flow that celebrates louder than its
 * neighbour quietly tells the student which parts of the app matter, and the
 * ones that celebrate quietly are the ones they stop doing.
 *
 * `perfect` upgrades the headline only — never the size of the moment.
 */
export function celebrationCopy(
  kind: CelebrationKind,
  opts: { perfect?: boolean } = {},
): CelebrationCopy {
  const title = opts.perfect ? t('celebrationTitlePerfect') : t('celebrationTitle');

  switch (kind) {
    case 'lesson':
      return { eyebrow: t('celebrationEyebrowLesson'), title, subtitle: t('celebrationSubtitleLesson') };
    case 'quiz':
      return { eyebrow: t('celebrationEyebrowQuiz'), title, subtitle: t('celebrationSubtitleQuiz') };
    case 'exercise':
      return { eyebrow: t('celebrationEyebrowExercise'), title, subtitle: t('celebrationSubtitleQuiz') };
    case 'reading':
      return { eyebrow: t('celebrationEyebrowReading'), title, subtitle: t('celebrationSubtitle') };
    case 'review':
      return { eyebrow: t('celebrationEyebrowReview'), title, subtitle: t('celebrationSubtitleReview') };
    case 'game':
      return { eyebrow: t('celebrationEyebrowGame'), title, subtitle: t('celebrationSubtitleGame') };
    case 'daily':
      return { eyebrow: t('celebrationEyebrowDaily'), title, subtitle: t('celebrationSubtitleDaily') };
  }
}
