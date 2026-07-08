import { Ionicons } from '@expo/vector-icons';
import { tints } from '../theme/theme';
import { appIcons, type AppIconName } from './appIcons';

type IconName = keyof typeof Ionicons.glyphMap;

/** Хичээлийн скилл төрөл → нэр + icon + tint. Lessons жагсаалт + detail хуваалцана.
 *  `img` = 3D glossy icon (assets/icons). IconTile байвал зургийг, эс байвал
 *  Ionicons `icon`-ийг харуулна. */
export const SKILL: Record<
  string,
  { label: string; icon: IconName; img: AppIconName; tint: { bg: string; fg: string } }
> = {
  listening: { label: 'Сонсгол', icon: 'headset', img: 'listening', tint: tints.purple },
  reading: { label: 'Унших', icon: 'book', img: 'reading', tint: tints.green },
  fill: { label: 'Нөхөх', icon: 'pencil', img: 'fill', tint: tints.coral },
  writing: { label: 'Бичих', icon: 'create', img: 'writing', tint: tints.blue },
  grammar: { label: 'Дүрэм', icon: 'school', img: 'grammar', tint: tints.amber },
  vocabulary: { label: 'Үгсийн сан', icon: 'albums', img: 'vocabulary', tint: tints.pink },
};

export const FALLBACK_SKILL = {
  label: 'Хичээл',
  icon: 'play-circle' as IconName,
  img: 'reading' as AppIconName,
  tint: tints.purple,
};

/** 3D зургийн эх сурвалж (IconTile `image` prop-д дамжуулна). */
export function getSkillImage(type: string) {
  return appIcons[(SKILL[type]?.img ?? FALLBACK_SKILL.img)];
}

export function getSkill(type: string) {
  return SKILL[type] ?? FALLBACK_SKILL;
}
