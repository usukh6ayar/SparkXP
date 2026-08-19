import type { TranslationKey, Lang } from '../i18n';
import type { Buddy } from '../api/ai';

/**
 * DEV-ONLY placeholder buddy roster for the AI Buddy selector — TEMPORARY
 * content so the full carousel/lock/unlock design can be built and reviewed
 * before the real characters exist in the backend.
 *
 * ⚠️ These characters have no backend record, so starting a session with one
 * silently falls back to a *different* (real) buddy — the user would be
 * talking to a persona they didn't pick. That is why `buildMockBuddies` is
 * gated behind `__DEV__` (same rule as DEV_MOCK_NOTIFICATIONS): in production
 * the carousel shows only the real buddies the backend returns. Usukhbayar
 * adds those via admin (name/GLB/thumbnail/etc.), and they appear with no app
 * update. DELETE this file once the real roster is authored.
 *
 * `FOX_SLUG` is the default/flagship stand-in (matches the app's existing
 * "Спарк" fox mascot — see defaultBuddyName / the AI Buddy tab icon), shown
 * first and unlocked. The rest are locked to exercise that part of the design.
 *
 * Name/title/description/motto are bilingual (unlike real backend buddy
 * content, which is plain DB text) so the screen doesn't mix languages when
 * the app is switched to English.
 */
export const FOX_SLUG = 'spark-fox';

interface MockBuddyDef {
  slug: string;
  traitKeys: [TranslationKey, TranslationKey, TranslationKey];
  isLocked?: boolean;
  mn: { name: string; title: string; description: string; motto: string };
  en: { name: string; title: string; description: string; motto: string };
}

const DEFS: MockBuddyDef[] = [
  {
    slug: FOX_SLUG,
    traitKeys: ['traitFriendly', 'traitPatient', 'traitEncouraging'],
    isLocked: false,
    mn: {
      name: 'Спарк',
      title: 'Англи багш',
      description: 'Найрсаг үнэг багш — өдөр тутмын англи ярианд тусална.',
      motto: 'Сайн уу! Англи хэлийг хамтдаа хөгжилтэй сур!',
    },
    en: {
      name: 'Spark',
      title: 'English Teacher',
      description: 'A friendly fox teacher — helps with everyday English conversation.',
      motto: "Hi there! Let's make English fun together!",
    },
  },
  {
    slug: 'doctor',
    traitKeys: ['traitWise', 'traitCalm', 'traitCaring'],
    mn: {
      name: 'Эмч Сарнай',
      title: 'Эмч',
      description: 'Эрүүл мэндийн сэдвээр англиар ярьж дадлагажина.',
      motto: 'Сайн уу! Эрүүл мэндийн англи үг хэллэгийг хамт сурцгаая.',
    },
    en: {
      name: 'Dr. Sarnai',
      title: 'Doctor',
      description: 'Practice English around health and medical topics.',
      motto: "Hi! Let's learn health & medical English together.",
    },
  },
  {
    slug: 'firefighter',
    traitKeys: ['traitBrave', 'traitStrong', 'traitEncouraging'],
    mn: {
      name: 'Гал сөнөөгч Эрдэнэ',
      title: 'Гал сөнөөгч',
      description: 'Зоригтой, шийдэмгий яриагаар англи хэлээ бэхжүүл.',
      motto: 'Зоригтой байгаарай! Англи хэлээ бат бэх сур.',
    },
    en: {
      name: 'Firefighter Erdene',
      title: 'Firefighter',
      description: 'Build confident, decisive English through bold conversation.',
      motto: "Stay brave! Let's make your English strong.",
    },
  },
  {
    slug: 'teacher',
    traitKeys: ['traitWise', 'traitMotivating', 'traitFocused'],
    mn: {
      name: 'Багш Мөнхзул',
      title: 'Багш',
      description: 'Дүрэм, найруулгыг тодорхой тайлбарладаг ментор.',
      motto: 'Сайн уу! Дүрэм зүйгээ хамт нягтлая.',
    },
    en: {
      name: 'Teacher Munkhzul',
      title: 'Teacher',
      description: 'A mentor who explains grammar and writing clearly.',
      motto: "Hi! Let's sharpen your grammar together.",
    },
  },
];

export function buildMockBuddies(t: (key: TranslationKey) => string, lang: Lang): Buddy[] {
  // Never ship fake characters — production shows only what the backend returns.
  if (!__DEV__) return [];
  return DEFS.map((d) => {
    const copy = lang === 'mn' ? d.mn : d.en;
    return {
      slug: d.slug,
      name: d.slug === FOX_SLUG ? t('defaultBuddyName') : copy.name,
      title: copy.title,
      description: copy.description,
      avatarAssetUrl: null,
      avatarThumbUrl: null,
      emotionMap: {},
      personalityTags: d.traitKeys.map((k) => t(k)),
      motto: copy.motto,
      isLocked: d.isLocked,
    };
  });
}
