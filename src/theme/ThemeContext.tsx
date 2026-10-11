import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  preference: ThemePreference;
  dark: boolean;
  /**
   * Theme badalne par yeh key badal jaati hai. `Screen` / tab-bar isi key se
   * apna subtree remount karte hain — neeche comment padho kyun.
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
  const [systemDark, setSystemDark] = useState(Appearance.getColorScheme() === 'dark');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then(value => {
        if (active && (value === 'system' || value === 'light' || value === 'dark')) {
          setPreferenceState(value);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemDark(colorScheme === 'dark'));
    return () => sub.remove();
  }, []);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    AsyncStorage.setItem(KEY, value).catch(() => {});
  }, []);

  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  const themeKey = dark ? 'dark' : 'light';

  const value = useMemo(
    () => ({ preference, dark, themeKey, setPreference }),
    [preference, dark, themeKey, setPreference],
  );

  /* Palette swap render se pehle — uske baad har `colors.x` / style getter nayi
     value padhta hai (poori app bina remount ke theme follow karti hai). */
  applyTheme(dark ? 'dark' : 'light');

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Theme badlav ke waqt themed UI remount karne ke liye stable key. */
export function useThemeKey(): string {
  return useContext(ThemeContext).themeKey;
}
