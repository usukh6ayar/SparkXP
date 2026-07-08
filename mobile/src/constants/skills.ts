import { Ionicons } from '@expo/vector-icons';
import { tints } from '../theme/theme';
import type { TranslationKey } from '../i18n';
import { appIcons, type AppIconName } from './appIcons';

type IconName = keyof typeof Ionicons.glyphMap;

/** Skill type → i18n label key + icon + tint. Resolve the label with t(labelKey)
 *  at render so it follows the app language. Shared by Lessons list + detail.
 *  `img` = 3D glossy icon (assets/icons); render via <AppIcon>/IconTile `image`. */
export const SKILL: Record<
  string,
  { labelKey: TranslationKey; icon: IconName; img: AppIconName; tint: { bg: string; fg: string } }
> = {
  listening: { labelKey: 'catListening', icon: 'headset', img: 'listening', tint: tints.purple },
  reading: { labelKey: 'catReading', icon: 'book', img: 'reading', tint: tints.green },
  fill: { labelKey: 'catFill', icon: 'pencil', img: 'fill', tint: tints.coral },
  writing: { labelKey: 'catWriting', icon: 'create', img: 'writing', tint: tints.blue },
  grammar: { labelKey: 'skillGrammar', icon: 'school', img: 'grammar', tint: tints.amber },
  vocabulary: { labelKey: 'skillVocabulary', icon: 'albums', img: 'vocabulary', tint: tints.pink },
};

export const FALLBACK_SKILL = {
  labelKey: 'skillDefault' as TranslationKey,
  icon: 'play-circle' as IconName,
  img: 'reading' as AppIconName,
  tint: tints.purple,
};

/** 3D зургийн эх сурвалж (IconTile `image` prop-д дамжуулна). */
export function getSkillImage(type: string) {
  return appIcons[SKILL[type]?.img ?? FALLBACK_SKILL.img];
}

export function getSkill(type: string) {
  return SKILL[type] ?? FALLBACK_SKILL;
}
