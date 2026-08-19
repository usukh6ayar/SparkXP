/**
 * 3D GLB avatars (BuddyAvatar.tsx, three.js/expo-gl) render as an untextured
 * gray silhouette right now — the checked-in BuddyAvatar.tsx only decodes
 * JPEG embedded textures (dataUriToTexture), but Meshy commonly exports PNG
 * base-colour maps, so the mesh is silently left untextured.
 *
 * A PNG-texture fix already exists on the unmerged `origin/boju` branch
 * ("BuddyAvatar — PNG textures, idle-return, memory disposal"), but it
 * hasn't landed on main or been verified against a real buddy yet.
 *
 * Flip this to true once that fix lands and has been checked end-to-end —
 * both BuddySelector.tsx (buddy carousel) and chat.tsx (post-Apply screen)
 * read this single flag, so there's one place to flip, not two.
 */
export const SHOW_3D_AVATAR = true;
