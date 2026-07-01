/**
 * App-wide user preferences: appearance (light/dark) + language (mn/en).
 *
 * - `useTheme()` returns the active premium palette (light/dark) — used by the
 *   Profile / Settings screens so they flip live when the toggle changes.
 * - `useT()` returns a translator that re-renders the component when the
 *   language changes (it keeps the i18n module in sync via `setLanguage`).
 *
 * Both preferences persist to AsyncStorage and are restored on launch.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLanguage, t as translate, type Lang, type TranslationKey } from '../i18n';
import { premiumThemes, appThemes, type PremiumPalette, type AppColors } from '../theme/theme';

type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'settings.theme';
const LANG_KEY = 'settings.lang';

interface SettingsState {
  theme: ThemeMode;
  lang: Lang;
  palette: PremiumPalette;
  colors: AppColors;
  setTheme: (mode: ThemeMode) => void;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [lang, setLangState] = useState<Lang>('mn');

  // Restore persisted prefs on mount.
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'dark' || v === 'light') setThemeState(v);
    });
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === 'mn' || v === 'en') {
        setLanguage(v);
        setLangState(v);
      }
    });
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem(THEME_KEY, mode);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLanguage(next); // keep the i18n module in sync so t() returns the new language
    setLangState(next); // re-render every consumer of this context
    AsyncStorage.setItem(LANG_KEY, next);
  }, []);

  const value: SettingsState = {
    theme,
    lang,
    palette: premiumThemes[theme],
    colors: appThemes[theme],
    setTheme,
    setLang,
    t: translate,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}

/** Reactive translator — re-renders the component when the language changes. */
export function useT(): (key: TranslationKey) => string {
  return useSettings().t;
}

/** Active premium palette (light/dark) for Profile / Settings-style screens. */
export function useTheme(): PremiumPalette {
  return useSettings().palette;
}

/** Active app-wide palette (light/dark) — drop-in replacement for the static
 *  `colors` import, but reactive to the appearance toggle. */
export function useColors(): AppColors {
  return useSettings().colors;
}
