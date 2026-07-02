import { Ionicons } from '@expo/vector-icons';
import { tints } from '../theme/theme';
import type { TranslationKey } from '../i18n';

type IconName = keyof typeof Ionicons.glyphMap;

/** Skill type → i18n label key + icon + tint. Resolve the label with t(labelKey)
 *  at render so it follows the app language. Shared by Lessons list + detail. */
export const SKILL: Record<string, { labelKey: TranslationKey; icon: IconName; tint: { bg: string; fg: string } }> = {
  listening: { labelKey: 'catListening', icon: 'headset', tint: tints.purple },
  reading: { labelKey: 'catReading', icon: 'book', tint: tints.green },
  fill: { labelKey: 'catFill', icon: 'pencil', tint: tints.coral },
  writing: { labelKey: 'catWriting', icon: 'create', tint: tints.blue },
  grammar: { labelKey: 'skillGrammar', icon: 'school', tint: tints.amber },
  vocabulary: { labelKey: 'skillVocabulary', icon: 'albums', tint: tints.pink },
};

export const FALLBACK_SKILL = { labelKey: 'skillDefault' as TranslationKey, icon: 'play-circle' as IconName, tint: tints.purple };

export function getSkill(type: string) {
  return SKILL[type] ?? FALLBACK_SKILL;
}
