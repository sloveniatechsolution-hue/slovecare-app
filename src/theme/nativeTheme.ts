import { NativeModules, Platform } from 'react-native';

/**
 * Native (Android) system-bar appearance ko app ke in-app theme ke saath
 * sync karta hai.
 *
 * Kyun zaroori hai:
 * Android ka `AppTheme` XML theme `Theme.AppCompat.DayNight` hai — native
 * system bars PHONE ke dark-mode setting follow karte hain, app ke in-app
 * theme ko nahi. Edge-to-edge ke saath bars transparent hote hain aur unke
 * icons app ke content ke upar aate hain. Is liye phone dark + app light
 * par nav-bar icons invisible ho jaate hain (aur vice-versa).
 *
 * `AppThemeModule` (Kotlin) ye flags app ke actual theme ke hisaab se set
 * karta hai aur API 29+ ka navigation-bar contrast scrim hata deta hai.
 *
 * Module na mile (unit tests / web) toh call silently no-op ho jaata hai.
 */

type AppThemeNativeModule = {
  setAppTheme(isDark: boolean): Promise<boolean>;
};

const nativeModule = (NativeModules as Record<string, unknown>).AppTheme as
  | AppThemeNativeModule
  | undefined;

export function applyNativeTheme(dark: boolean): void {
  if (Platform.OS !== 'android') return;
  if (!nativeModule?.setAppTheme) return;
  try {
    const result = nativeModule.setAppTheme(dark);
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        /* Activity attach nahi hai — ignore. */
      });
    }
  } catch {
    /* Native module unavailable — ignore. */
  }
}
