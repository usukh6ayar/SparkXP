import type { ImageSourcePropType } from 'react-native';

/**
 * Avatar resolution. A user's `avatarUrl` is either:
 *  - an uploaded image URL (`http…/uploads/…`) → render with `{ uri }`
 *  - a default key (`default:avN`) → render the bundled image below
 *  - null/unknown → caller shows a fallback (initial letter)
 *
 * Default images are placeholders for now (`assets/avatars/PROMPTS.md` has the
 * art prompts) — drop real PNGs over them to swap, no code change.
 */
export const DEFAULT_AVATARS: { key: string; src: ImageSourcePropType }[] = [
  { key: 'default:av1', src: require('../../assets/avatars/av1.webp') },
  { key: 'default:av2', src: require('../../assets/avatars/av2.webp') },
  { key: 'default:av3', src: require('../../assets/avatars/av3.webp') },
  { key: 'default:av4', src: require('../../assets/avatars/av4.webp') },
  { key: 'default:av5', src: require('../../assets/avatars/av5.webp') },
  { key: 'default:av6', src: require('../../assets/avatars/av6.webp') },
];

/** Image source for an avatarUrl, or null if there's nothing to show. */
export function resolveAvatar(
  avatarUrl: string | null | undefined,
): ImageSourcePropType | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('http')) return { uri: avatarUrl };
  if (avatarUrl.startsWith('default:')) {
    return DEFAULT_AVATARS.find((a) => a.key === avatarUrl)?.src ?? null;
  }
  return null;
}
