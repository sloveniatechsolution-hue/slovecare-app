import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme } from './theme';
import { applyNativeTheme } from './nativeTheme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  dark: boolean;
  /**
   * Theme badalne par yeh key badal jaati hai. Screens/components ise
   * `extraData` ya remount key ke roop me use kar sakte hain, par zaroorat
   * nahi — theme propagation ab automatic hai.
   */
  themeKey: string;
  setPreference: (value: ThemePreference) => void;
};

const KEY = 'slovecare_theme_preference';

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  dark: false,
  themeKey: 'light',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(() => Appearance.getColorScheme() === 'dark');
  const [hydrated, setHydrated] = useState(false);

  /**
   * Latest system scheme + preference — refs me, taaki `setPreference` ke
   * andar stale closure na ho (theme switch ke waqt yahi bug aata tha).
   */
  const systemDarkRef = useRef(systemDark);
  const preferenceRef = useRef(preference);

  /**
   * Module palette (`theme.ts` ka `themeIsDark`) ko React state ke saath
   * SYNCHRONOUSLY sync karta hai.
   *
   * ⚠️ Ye render body me NAHI hota (pehle hota tha). Render-phase side
   * effect se React ka render discard/interrupt hone par module palette
   * committed tree se desync ho jaata tha — aur wahi "kuch elements black
   * reh gaye" ka root cause tha. Ab palette state update se PEHLE set hota
   * hai, is liye children hamesha sahi palette ke saath render hote hain.
   */
  const syncPalette = useCallback((nextDark: boolean) => {
    applyTheme(nextDark ? 'dark' : 'light');
    /* Native system bars (status + navigation) bhi app ke theme ke saath
       sync — phone ke dark-mode se independent. */
    applyNativeTheme(nextDark);
  }, []);

  const setPreference = useCallback(
    (value: ThemePreference) => {
      preferenceRef.current = value;
      const nextDark = value === 'dark' || (value === 'system' && systemDarkRef.current);
      syncPalette(nextDark); // state update se PEHLE — children sahi palette se render hon
      setPreferenceState(value);
      AsyncStorage.setItem(KEY, value).catch(() => {});
    },
    [syncPalette],
  );

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then(value => {
        if (!active) return;
        if (value === 'system' || value === 'light' || value === 'dark') {
          preferenceRef.current = value;
          const nextDark = value === 'dark' || (value === 'system' && systemDarkRef.current);
          syncPalette(nextDark);
          setPreferenceState(value);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [syncPalette]);

  useEffect(() => {
    const syncSystemTheme = (colorScheme = Appearance.getColorScheme()) => {
      const nextDark = colorScheme === 'dark';
      systemDarkRef.current = nextDark;
      setSystemDark(nextDark);
      /* Sirf 'system' preference hi phone ke theme ko follow karta hai. */
      if (preferenceRef.current === 'system') syncPalette(nextDark);
    };
    const appearanceSub = Appearance.addChangeListener(({ colorScheme }) => syncSystemTheme(colorScheme));
    // Kuch Android builds background me Appearance event nahi bhejte. Resume
    // par current phone theme dobara padhne se old-theme frame nahi dikhega.
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') syncSystemTheme();
    });
    return () => {
      appearanceSub.remove();
      appStateSub.remove();
    };
  }, [syncPalette]);

  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  const themeKey = dark ? 'dark' : 'light';

  /**
   * Safety net — committed tree ke saath palette match karne ke liye.
   * Ye render-phase side effect nahi hai (commit ke BAAD chalta hai), is liye
   * React ke render discard karne par bhi palette corrupt nahi hota.
   */
  useLayoutEffect(() => {
    syncPalette(dark);
  }, [dark, syncPalette]);

  const value = useMemo(
    () => ({ preference, dark, themeKey, setPreference }),
    [preference, dark, themeKey, setPreference],
  );

  /* Saved preference aane se pehle screens mount na hon. Isse system-dark ka
     first frame saved light theme ke cards me capture nahi hota. */
  if (!hydrated) return <></>;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Theme badlav ke liye stable key (extraData / remount key). */
export function useThemeKey(): string {
  return useContext(ThemeContext).themeKey;
}
