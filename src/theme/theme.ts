/**
 * SloveCare design tokens — website (slovecare.in) ke palette se match.
 * Har screen/component isi file se colours, spacing aur typography leti hai.
 *
 * Design language (2026 refresh):
 *  - Deep ink headings + tight tracking → crisp, editorial look
 *  - Fresh teal (brand) + electric blue (actions) → GenZ friendly but professional
 *  - Larger radii, airy spacing, soft navy-tinted shadows → modern card surfaces
 */

import { Platform, TextStyle } from 'react-native';

export const colors = {
  /* Brand — logo (assets/icon.png) ke blue-teal gradient se liye gaye hain */
  primary: '#0BA39C',
  primaryDark: '#078480',
  primaryLight: '#E3F7F5',
  accent: '#10B981',
  accentLight: '#E7F8F1',

  /* Navy (headings / dark surfaces) */
  navy: '#0B2447',
  navyDeep: '#071B36',
  navySoft: '#12325C',

  /* Actions — modern electric blue (white text ke saath AA contrast) */
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  danger: '#E11D48',
  dangerLight: '#FDECEF',
  warning: '#F59E0B',
  warningLight: '#FEF4E5',
  success: '#16A34A',
  successLight: '#E9F8EF',

  /* Text */
  text: '#0B1B2E',
  textSecondary: '#566784',
  textMuted: '#8A97AB',
  textInverse: '#FFFFFF',

  /* Surfaces */
  background: '#F5F7FB',
  card: '#FFFFFF',
  cardMuted: '#F7F9FC',
  border: '#E7ECF4',
  borderStrong: '#D5DEEB',
  overlay: 'rgba(7, 27, 54, 0.55)',

  /* Misc */
  star: '#F59E0B',
  skeleton: '#E9EEF5',
  transparent: 'transparent',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 30,
  pill: 999,
} as const;

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const fontFamilyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const typography: Record<string, TextStyle> = {
  h1: { fontFamily, fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  h2: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  h3: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h4: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  body: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '400', color: colors.text },
  bodyMedium: { fontFamily: fontFamilyMedium, fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.text },
  small: { fontFamily, fontSize: 12.5, lineHeight: 17, fontWeight: '400', color: colors.textSecondary },
  smallMedium: { fontFamily: fontFamilyMedium, fontSize: 12.5, lineHeight: 17, fontWeight: '700', color: colors.text },
  caption: { fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textMuted },
  button: { fontFamily: fontFamilyMedium, fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.textInverse },
  price: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '800', color: colors.text },
  /* Extra tokens — modern headers / labels ke liye */
  eyebrow: {
    fontFamily: fontFamilyMedium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  display: { fontFamily, fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  lead: { fontFamily, fontSize: 14.5, lineHeight: 21, fontWeight: '500', color: colors.textSecondary },
};

export const shadow = {
  sm: Platform.select({
    android: { elevation: 1 },
    ios: {
      shadowColor: '#0B2447',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
    },
    default: {},
  }) as object,
  card: Platform.select({
    android: { elevation: 2 },
    ios: {
      shadowColor: '#0B2447',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
    },
    default: {},
  }) as object,
  float: Platform.select({
    android: { elevation: 8 },
    ios: {
      shadowColor: '#0B2447',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
    },
    default: {},
  }) as object,
  nav: Platform.select({
    android: { elevation: 16 },
    ios: {
      shadowColor: '#0B2447',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    default: {},
  }) as object,
};

export default { colors, spacing, radius, typography, shadow };
