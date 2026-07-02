import type { TranslationKey } from '../i18n';

/** Role → i18n key, so role labels follow the app language (mn/en). */
export const ROLE_TKEY: Record<string, TranslationKey> = {
  student: 'roleStudent', teacher: 'teacher', admin: 'roleAdmin', super_admin: 'roleSuperAdmin',
};
