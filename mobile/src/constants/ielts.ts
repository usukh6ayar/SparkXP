import { Ionicons } from '@expo/vector-icons';
import { skillGradients } from '../theme/theme';
import type { TranslationKey } from '../i18n';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The 4 IELTS modules. Content model (Approach A): an IELTS practice set is a
 * normal Quiz whose `category` is `ielts_<module>` — no separate entity, so the
 * quiz list/runner are reused as-is.
 *
 * `auto` = objective module: answers are graded and the server returns a band
 * (0–9). Writing/Speaking are self-study practice (model answer, no score) and
 * live in their own screen — owned by Boju (IELTS Plan 3b).
 */
export interface IeltsModule {
  key: 'listening' | 'reading' | 'writing' | 'speaking';
  category: string;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  icon: IconName;
  grad: readonly [string, string];
  auto: boolean;
}

export const IELTS_MODULES: IeltsModule[] = [
  {
    key: 'listening',
    category: 'ielts_listening',
    labelKey: 'ieltsListening',
    hintKey: 'ieltsAutoBand',
    icon: 'headset',
    grad: skillGradients.listening,
    auto: true,
  },
  {
    key: 'reading',
    category: 'ielts_reading',
    labelKey: 'ieltsReading',
    hintKey: 'ieltsAutoBand',
    icon: 'book',
    grad: skillGradients.reading,
    auto: true,
  },
  {
    key: 'writing',
    category: 'ielts_writing',
    labelKey: 'ieltsWriting',
    hintKey: 'ieltsSelfStudy',
    icon: 'create',
    grad: skillGradients.writing,
    auto: false,
  },
  {
    key: 'speaking',
    category: 'ielts_speaking',
    labelKey: 'ieltsSpeaking',
    hintKey: 'ieltsSelfStudy',
    icon: 'mic',
    grad: skillGradients.speaking,
    auto: false,
  },
];

/** Is this quiz category an IELTS one (drives passage/audio/band UI in the runner)? */
export function isIeltsCategory(category?: string | null): boolean {
  return !!category?.startsWith('ielts_');
}

/** Band is shown with one decimal (IELTS uses half-steps): 6 → "6.0". */
export function formatBand(band: number): string {
  return band.toFixed(1);
}
