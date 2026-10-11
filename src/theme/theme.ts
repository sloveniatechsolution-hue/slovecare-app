/**
 * SloveCare design tokens — website (slovecare.in) ke palette se match.
 * Har screen/component isi file se colours, spacing aur typography leti hai.
 *
 * Design language (2026 refresh):
 *  - Deep ink headings + tight tracking → crisp, editorial look
 *  - Fresh teal (brand) + electric blue (actions) → GenZ friendly but professional
 *  - Larger radii, airy spacing, soft navy-tinted shadows → modern card surfaces
 *
 * Theme (light / dark) — dark mode "high-tech ink" surfaces par bana hai:
 *  - `colors` ek Proxy hai — `applyTheme()` ke turant baad har `colors.x`
 *    nayi palette ki value deta hai (component re-render par hi kaam karta hai)
 *  - module-level `StyleSheet.create` ki colour values getters ban jaati hain
 *    (dynamic styles), is liye poori app bina remount ke theme follow karti hai
 *  - `gradients`, `shadow`, `typography` ke colours bhi getters hain
 *  - ThemeContext user ka choice (system/light/dark) AsyncStorage me rakhta hai
 */

import { Platform, StyleSheet, TextStyle, ViewStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark';

/* ------------------------------------------------------------------ palettes */

const LIGHT = {
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
  shadowColor: '#0B2447',

  /* Extra accents — violet violet, blue info chips, warning text */
  violet: '#7C3AED',
  violetSoft: '#F1ECFE',
  infoLight: '#EAF1FF',
  warningText: '#B45309',

  /* Brand wordmark (Logo) ke do rang */
  brandBlue: '#0B3C8D',
  brandGreen: '#0E9E6E',

  /* Hero / gradient cards par jo bhi likha jaaye (dono modes me dark surface) */
  onDarkMuted: 'rgba(255, 255, 255, 0.72)',
  onDarkChip: 'rgba(255, 255, 255, 0.16)',
  onDarkBorder: 'rgba(255, 255, 255, 0.28)',

  /* Auth / splash background wash — soft teal → blue → white */
  washTop: '#E3F5F3',
  washMid: '#EDF5FF',
  washBottom: '#FFFFFF',
} as const;

export type Palette = { [K in keyof typeof LIGHT]: string };

/**
 * Dark palette — high-tech ink: near-black blue-tinted background, layered
 * elevated surfaces (card → cardMuted), teal glow accents aur hairline borders.
 */
const DARK: Palette = {
  /* Brand — teal dark par zyada bright (chips ke icons ke liye contrast) */
  primary: '#2DD4BF',
  primaryDark: '#5EEAD4',
  primaryLight: '#0E2E2C',
  accent: '#10B981',
  accentLight: '#0C2A21',

  /* Navy — gradient surfaces ke liye deep ink tones (light ke sonde wale) */
  navy: '#122A47',
  navyDeep: '#060D18',
  navySoft: '#0E2A44',

  /* Actions — brightened for text/contrast on dark surfaces */
  blue: '#3B82F6',
  blueDark: '#93B4FF',
  danger: '#F43F5E',
  dangerLight: '#3A1520',
  warning: '#FBBF24',
  warningLight: '#2C2110',
  success: '#4ADE80',
  successLight: '#0F2A1E',

  /* Text */
  text: '#E9F1FA',
  textSecondary: '#A3B3C9',
  textMuted: '#7A8AA3',
  textInverse: '#FFFFFF',

  /* Surfaces — 3 layers: background < card < cardMuted, hairline borders */
  background: '#070C14',
  card: '#0F1725',
  cardMuted: '#16202F',
  border: '#1E2A3C',
  borderStrong: '#2C3D55',
  overlay: 'rgba(3, 7, 14, 0.74)',

  /* Misc */
  star: '#FBBF24',
  skeleton: '#16202F',
  transparent: 'transparent',
  shadowColor: '#000000',

  /* Extra accents */
  violet: '#A78BFA',
  violetSoft: '#2A2140',
  infoLight: '#13233B',
  warningText: '#FBBF24',

  /* Wordmark — dark par readable */
  brandBlue: '#5B9BFF',
  brandGreen: '#3DD68C',

  /* On-dark helpers (hero cards dono modes me dark surfaces hain) */
  onDarkMuted: 'rgba(255, 255, 255, 0.72)',
  onDarkChip: 'rgba(255, 255, 255, 0.16)',
  onDarkBorder: 'rgba(255, 255, 255, 0.28)',

  /* Auth / splash wash — deep ink with a hint of teal */
  washTop: '#08131F',
  washMid: '#0A1727',
  washBottom: '#070C14',
};

/* --------------------------------------------------------------- theme state */

let themeIsDark = false;

export function applyTheme(mode: ThemeMode): void {
  themeIsDark = mode === 'dark';
}

export function getThemeMode(): ThemeMode {
  return themeIsDark ? 'dark' : 'light';
}

export function isDark(): boolean {
  return themeIsDark;
}

/**
 * Active palette — light/dark switch hone par har read par current mode ki
 * value milti hai (Proxy ki wajah se) inline `colors.x` usage ke liye.
 */
export const colors = new Proxy(LIGHT, {
  get(target, key: keyof typeof LIGHT) { return (themeIsDark ? DARK : target)[key]; },
}) as typeof LIGHT;

/* ------------------------------------------------- light → dark hue mapping */

/** Har light hex ka exact dark counterpart — palette se automatically banta hai. */
const DARK_BY_LIGHT: Record<string, string> = {};
for (const key of Object.keys(LIGHT) as (keyof typeof LIGHT)[]) {
  /* Wash / on-dark / transparent tokens sirf gradients ke through use hote hain —
     inhe remap table me daalne se shared hex (jaise white) ki value galat ban jaati hai. */
  if (['transparent', 'washTop', 'washMid', 'washBottom', 'onDarkMuted', 'onDarkChip', 'onDarkBorder'].includes(key)) continue;
  const hex = String(LIGHT[key]).toUpperCase();
  if (!(hex in DARK_BY_LIGHT)) DARK_BY_LIGHT[hex] = DARK[key];
}

/**
 * White light mode me card (surface) aur text/icon dono ke liye hai — dark mode me
 * uska matlab property se decide hota hai (background = ink card, text = white).
 */
const WHITE_BY_PROPERTY: Record<string, string> = {
  backgroundColor: DARK.card,
  borderColor: DARK.border,
  borderTopColor: DARK.border,
  borderBottomColor: DARK.border,
  borderLeftColor: DARK.border,
  borderRightColor: DARK.border,
  shadowColor: DARK.shadowColor,
};

/**
 * Solid brand shades (badge / button / tab-pill backgrounds) un light values par
 * rehti hain — unpar white text/icon chadhta hai. Text + icon wale slots me
 * bright shade chahiye, is liye property ke hisaab se do alag values.
 */
const SURFACE_SAFE: Record<string, { bg: string; fg: string }> = {
  '#0BA39C': { bg: '#0BA39C', fg: DARK.primary },
  '#2563EB': { bg: '#2563EB', fg: DARK.blue },
  '#10B981': { bg: '#10B981', fg: '#34D399' },
  '#E11D48': { bg: '#E11D48', fg: DARK.danger },
  '#F59E0B': { bg: '#F59E0B', fg: DARK.warning },
  '#16A34A': { bg: '#16A34A', fg: DARK.success },
  '#7C3AED': { bg: '#7C3AED', fg: DARK.violet },
};

/**
 * Navy light mode me heading + surface dono ke liye hai. Text/icon slot me yeh
 * dark ho sakta hai, is liye `color` par light-tinted value return hoti hai.
 */
const NAVY_AS_TEXT: Record<string, string> = {
  '#0B1B2E': DARK.text,
  '#0B2447': '#DCE9FA',
  '#071B36': '#DCE9FA',
  '#12325C': '#B6CBE6',
};

/** Ad-hoc hex literals jo screens me hard-coded hain — unke dark counterparts. */
const EXTRA_DARK: Record<string, string> = {
  /* blue info chips / icon touches */
  '#E8F0FE': DARK.infoLight,
  '#EAF1FE': DARK.infoLight,
  '#F3F7FF': DARK.infoLight,
  '#EEF3FB': DARK.infoLight,
  '#D8E4FF': DARK.borderStrong,
  '#CFE0FF': DARK.borderStrong,
  '#D8E2F2': DARK.borderStrong,
  /* violet chip */
  '#F1ECFE': DARK.violetSoft,
  /* amber / rose tints */
  '#FBE3BE': '#3B3021',
  '#FECACA': '#3F2327',
  '#FFF8F8': '#2A1A1E',
  '#FFF5F7': '#2C1620',
  '#B45309': DARK.warningText,
  '#92400E': DARK.warningText,
  /* icon default stroke (Icon.tsx) */
  '#0F1E33': DARK.text,
  /* purani dark palette ki values → nayi ink palette */
  '#0B1220': DARK.background,
  '#111B2E': DARK.card,
  '#26364E': DARK.border,
  '#E5EDF8': DARK.text,
  '#091522': DARK.background,
  '#111F30': DARK.card,
  '#17283B': DARK.cardMuted,
  '#26384D': DARK.border,
  '#354A61': DARK.borderStrong,
  '#E8EEF7': DARK.text,
  '#A7B5C9': DARK.textSecondary,
  '#8494AA': DARK.textMuted,
};

/**
 * Light hex → dark ink. Style values module load par banti hain, is liye
 * property ek getter ban jaata hai aur yeh function har read par chalta hai.
 */
function themedStyleColor(value: unknown, property: string): unknown {
  if (!themeIsDark || typeof value !== 'string') return value;

  /* White sheets (near-opaque) dark me ink sheets ban jaate hain. */
  const white = value.match(/^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)$/i);
  if (white) {
    return property === 'backgroundColor' && Number(white[1]) >= 0.9 ? `rgba(12, 19, 30, ${white[1]})` : value;
  }
  if (!value.startsWith('#')) return value;

  const hex = value.toUpperCase();

  /* Pure white — property ke hisaab se (card surface ya white text/icon). */
  if (hex === '#FFFFFF' || hex === '#FFF') {
    const surfaceValue = WHITE_BY_PROPERTY[property];
    return surfaceValue ?? '#FFFFFF';
  }
  /* Shadow light mode waale navy shadow se black shadow ban jaata hai. */
  if (property === 'shadowColor') return DARK.shadowColor;

  const surface = SURFACE_SAFE[hex];
  if (surface) return property === 'backgroundColor' ? surface.bg : surface.fg;

  const navy = NAVY_AS_TEXT[hex];
  if (navy && property === 'color') return navy;

  const extra = EXTRA_DARK[hex];
  if (extra !== undefined) return extra;

  const mapped = DARK_BY_LIGHT[hex];
  if (mapped !== undefined) return mapped;

  /* Baaki kisi bhi light value ko luminance se ink surface bana dete hain. */
  return fallbackInk(value, property);
}

/** Luminance-based fallback — jo hex map me nahi hai uske liye. */
function fallbackInk(value: string, property: string): string {
  const hex = value.slice(1);
  if (hex.length !== 6) return value;
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (property === 'backgroundColor' && lum > 0.86 && saturation < 0.28) return lum > 0.96 ? DARK.card : DARK.cardMuted;
  if ((property === 'borderColor' || property === 'borderTopColor' || property === 'borderBottomColor' || property === 'borderLeftColor' || property === 'borderRightColor') && lum > 0.55 && saturation < 0.35) return DARK.borderStrong;
  if (property === 'color' && lum < 0.3 && saturation < 0.95) return DARK.text;
  return value;
}

// StyleSheet styles ek baar module load par banti hain. Un colour values ko
// dynamic getter bana dete hain taaki theme switch par har screen update ho —
// bina kisi screen ko remount kiye.
const dynamicStyleSheet = StyleSheet as unknown as {
  create: (styles: Record<string, Record<string, unknown>>) => Record<string, Record<string, unknown>>;
};
const originalCreate = dynamicStyleSheet.create.bind(StyleSheet);
dynamicStyleSheet.create = styles => {
  for (const style of Object.values(styles)) {
    for (const property of ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'shadowColor', 'tintColor']) {
      const value = style[property];
      if (typeof value === 'string') {
        Object.defineProperty(style, property, { enumerable: true, configurable: true, get: () => themedStyleColor(value, property) });
      }
    }
  }
  return originalCreate(styles);
};

/* ----------------------------------------------------------------- gradients */

/** Named gradients — hero cards, buttons, tab pill aur background wash ke liye. */
export const gradients: Record<'brand' | 'hero' | 'ink' | 'success' | 'warning' | 'danger' | 'info' | 'wash' | 'authWash', string[]> = {
  /** Teal → azure — brand signature (tab pill, primary buttons). */
  get brand(): string[] { return themeIsDark ? ['#2DD4BF', '#3B82F6'] : ['#0BA39C', '#1C7EE0']; },
  /** Deep ink → teal — dashboard/profile hero headers. */
  get hero(): string[] { return themeIsDark ? ['#0A1A2E', '#0E3B52', '#0BA39C'] : ['#0A2246', '#0E5F82', '#0BA39C']; },
  /** Flat ink — sophisticated dark surfaces. */
  get ink(): string[] { return themeIsDark ? ['#0D1826', '#16263B'] : ['#0B2447', '#12325C']; },
  get success(): string[] { return themeIsDark ? ['#3DD68C', '#16A34A'] : ['#12B76A', '#0E9F6E']; },
  get warning(): string[] { return themeIsDark ? ['#FBBF24', '#D97706'] : ['#FBBF24', '#F59E0B']; },
  get danger(): string[] { return themeIsDark ? ['#FB7185', '#E11D48'] : ['#FB7185', '#E11D48']; },
  get info(): string[] { return themeIsDark ? ['#60A5FA', '#2563EB'] : ['#60A5FA', '#2563EB']; },
  /** Soft wash — splash/auth background (3 stops). */
  get wash(): string[] { return themeIsDark ? [DARK.washTop, DARK.washMid, DARK.washBottom] : ['#E8F4FB', '#F7FBFE', '#FFFFFF']; },
  /** Auth wash — splash jaisa hi, bas top par halka teal tint. */
  get authWash(): string[] { return themeIsDark ? [DARK.washTop, DARK.washMid, DARK.washBottom] : ['#E3F5F3', '#EDF5FF', '#FFFFFF']; },
};

/* ------------------------------------------------------------ spacing / radius */

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

/* -------------------------------------------------------------- typography */

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

/**
 * `color` ek getter hai — spreading (`{...typography.h3}`) ya direct use hamesha
 * current palette padhta hai, is liye dark mode me text sahi rehta hai.
 */
export const typography: Record<string, TextStyle> = {
  h1: { fontFamily, fontSize: 26, lineHeight: 32, fontWeight: '800', get color() { return colors.text; }, letterSpacing: -0.8 },
  h2: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '800', get color() { return colors.text; }, letterSpacing: -0.5 },
  h3: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: '800', get color() { return colors.text; }, letterSpacing: -0.3 },
  h4: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '700', get color() { return colors.text; }, letterSpacing: -0.2 },
  body: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '400', get color() { return colors.text; } },
  bodyMedium: { fontFamily: fontFamilyMedium, fontSize: 14, lineHeight: 20, fontWeight: '700', get color() { return colors.text; } },
  small: { fontFamily, fontSize: 12.5, lineHeight: 17, fontWeight: '400', get color() { return colors.textSecondary; } },
  smallMedium: { fontFamily: fontFamilyMedium, fontSize: 12.5, lineHeight: 17, fontWeight: '700', get color() { return colors.text; } },
  caption: { fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', get color() { return colors.textMuted; } },
  button: { fontFamily: fontFamilyMedium, fontSize: 14, lineHeight: 19, fontWeight: '700', get color() { return colors.textInverse; } },
  price: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '800', get color() { return colors.text; } },
  /* Extra tokens — modern headers / labels ke liye */
  eyebrow: {
    fontFamily: fontFamilyMedium,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    get color() { return colors.textMuted; },
  },
  display: { fontFamily, fontSize: 30, lineHeight: 36, fontWeight: '800', get color() { return colors.text; }, letterSpacing: -1 },
  lead: { fontFamily, fontSize: 14.5, lineHeight: 21, fontWeight: '500', get color() { return colors.textSecondary; } },
};

/* ------------------------------------------------------------------ shadows */

export const shadow = {
  sm: Platform.select({
    android: { elevation: 1 },
    ios: {
      get shadowColor() { return colors.shadowColor; },
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
    },
    default: {},
  }) as ViewStyle,
  card: Platform.select({
    android: { elevation: 2 },
    ios: {
      get shadowColor() { return colors.shadowColor; },
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    default: {},
  }) as ViewStyle,
  float: Platform.select({
    android: { elevation: 8 },
    ios: {
      get shadowColor() { return colors.shadowColor; },
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
    },
    default: {},
  }) as ViewStyle,
  nav: Platform.select({
    android: { elevation: 16 },
    ios: {
      get shadowColor() { return colors.shadowColor; },
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    default: {},
  }) as ViewStyle,
  /** Soft tinted glow — gradient pills / primary actions ke neeche. */
  glow: Platform.select({
    android: { elevation: 6 },
    ios: {
      shadowColor: '#0BA39C',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    default: {},
  }) as ViewStyle,
};

export default { colors, gradients, spacing, radius, typography, shadow };
