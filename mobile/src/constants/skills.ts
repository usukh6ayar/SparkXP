import { Ionicons } from '@expo/vector-icons';
import { tints } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Хичээлийн скилл төрөл → нэр + icon + tint. Lessons жагсаалт + detail хуваалцана. */
export const SKILL: Record<string, { label: string; icon: IconName; tint: { bg: string; fg: string } }> = {
  listening: { label: 'Сонсгол', icon: 'headset', tint: tints.purple },
  reading: { label: 'Унших', icon: 'book', tint: tints.green },
  fill: { label: 'Нөхөх', icon: 'pencil', tint: tints.coral },
  writing: { label: 'Бичих', icon: 'create', tint: tints.blue },
  grammar: { label: 'Дүрэм', icon: 'school', tint: tints.amber },
  vocabulary: { label: 'Үгсийн сан', icon: 'albums', tint: tints.pink },
};

export const FALLBACK_SKILL = { label: 'Хичээл', icon: 'play-circle' as IconName, tint: tints.purple };

export function getSkill(type: string) {
  return SKILL[type] ?? FALLBACK_SKILL;
}
