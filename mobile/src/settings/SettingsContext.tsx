/**
 * App-wide user preferences: appearance (system/light/dark) + language (mn/en).
 *
 * - `useTheme()` returns the active premium palette (light/dark) — used by the
 *   Profile / Settings screens so they flip live when the toggle changes.
 * - `useT()` returns a translator that re-renders the component when the
 *   language changes (it keeps the i18n module in sync via `setLanguage`).
 *
 * Both preferences persist to AsyncStorage and are restored on launch.
 *
 * **Two different theme values, don't mix them up:**
 * - `themePref` is what the user PICKED — including `'system'`. Only the
 *   Settings toggle needs this.
 * - `theme` is the RESOLVED light/dark actually being painted. Everything else
 *   (palettes, status bar) wants this one.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLanguage, t as translate, type Lang, type TranslationKey } from '../i18n';
import { premiumThemes, appThemes, type PremiumPalette, type AppColors } from '../theme/theme';

/** The painted theme. */
type ThemeMode = 'dark' | 'light';
/** What the user picked — `'system'` follows the device. */
export type ThemePref = ThemeMode | 'system';

const THEME_KEY = 'settings.theme';
const LANG_KEY = 'settings.lang';

interface SettingsState {
  /** Resolved light/dark — use this for colours. */
  theme: ThemeMode;
  /** The user's raw choice, including `'system'` — for the Settings toggle. */
  themePref: ThemePref;
  lang: Lang;
  palette: PremiumPalette;
  colors: AppColors;
  setTheme: (pref: ThemePref) => void;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Default `'system'`, which is what the native layer already declares
  // (`app.json` → `userInterfaceStyle: "automatic"`, plus the splash's light/dark
  // pair). A user who has picked light or dark keeps it — the restore below only
  // ever overwrites this default.
  const [themePref, setThemePref] = useState<ThemePref>('system');
  const [lang, setLangState] = useState<Lang>('mn');

  // Re-renders whenever the device flips light/dark, so `'system'` tracks live.
  const deviceScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme: ThemeMode = themePref === 'system' ? deviceScheme : themePref;

  // Restore persisted prefs on mount.
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'dark' || v === 'light' || v === 'system') setThemePref(v);
    });
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === 'mn' || v === 'en') {
        setLanguage(v);
        setLangState(v);
      }
    });
  }, []);

  const setTheme = useCallback((pref: ThemePref) => {
    setThemePref(pref);
    AsyncStorage.setItem(THEME_KEY, pref);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLanguage(next); // keep the i18n module in sync so t() returns the new language
    setLangState(next); // re-render every consumer of this context
    AsyncStorage.setItem(LANG_KEY, next);
  }, []);

  const value: SettingsState = {
    theme,
    themePref,
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

/**
 * Status-bar content style for the ACTIVE app theme ('light' = white icons).
 *
 * Feeds the single app-wide `<StatusBar>` in `app/_layout.tsx`. Screens must
 * never set the status bar themselves (imperative `setStatusBarStyle` leaks to
 * the next screen; the per-screen `statusBarStyle` navigator option needs an
 * iOS Info.plist change we don't make) — change the theme instead.
 */
export function useStatusBarStyle(): 'light' | 'dark' {
  return useSettings().theme === 'dark' ? 'light' : 'dark';
}
