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
 *
 * ── Colour mapping kaise kaam karta hai (root-cause note) ────────────────────
 * `StyleSheet.create` module-load par colour value *capture* karta hai (object
 * literal evaluate hota hai). Captured hex se yeh pata nahi chalta ki value
 * `colors.card` thi ya `colors.text` — sirf ek string milti hai. Is liye
 * mapping ko SEMANTIC TOKEN tak wapas le jaana zaroori hai:
 *
 *   `TOKENS_BY_VALUE` (value → candidate tokens) + role sets (surface / ink /
 *   border / shadow) se captured value ka token mil jaata hai, aur token ka
 *   current-palette value EXACTLY resolve hota hai. Light → dark → light
 *   round-trip is liye lossless hai.
 *
 * ⚠️ Isko "luminance se guess" se replace mat karna. Pehle yahi heuristic
 * Light Mode me halki text ko BLACK ink (`LIGHT.text`) bana deti thi — isi
 * wajah se Dark → Light switch ke baad kuch elements black/dark reh jaate
 * the (jaise HeroSection ka `#C9F5F1` eyebrow). Ab unknown values apni
 * authored value hi rehti hain — naya colour kabhi invent nahi hota.
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

  /* Text — headings ke baaki labels par bhi achhi contrast chahiye */
  text: '#0B1B2E',
  textSecondary: '#3F5372',
  textMuted: '#4F6180',
  textInverse: '#FFFFFF',

  /* Surfaces */
  background: '#F5F7FB',
  card: '#FFFFFF',
  cardMuted: '#F7F9FC',
  cardOverlay: 'rgba(255, 255, 255, 0.90)',
  /**
   * Gradient card ka CTA pill — dono modes me same near-white rehta hai.
   * Seedha '#FFFFFF' istemal mat karo: dark mode me `themedStyleColor` usko
   * `DARK.card` (ink) bana deta hai, jo rich gradient par dooba hua dikhta hai.
   * Yeh token dono palettes me identical hai, isliye DARK_BY_LIGHT khud usse
   * wahi rehne deta hai.
   */
  ctaBg: '#F8FAFD',
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
  /** White pill ke upar violet text/icon — hamesha dark rehta hai (high contrast). */
  violetInk: '#6D28D9',
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

  /* Text — dark surfaces par headings/labels clearly readable hone chahiye */
  text: '#E9F1FA',
  textSecondary: '#C3D2E6',
  textMuted: '#A2B3CC',
  textInverse: '#FFFFFF',

  /* Surfaces — 3 layers: background < card < cardMuted, hairline borders */
  background: '#070C14',
  card: '#0F1725',
  cardMuted: '#16202F',
  cardOverlay: 'rgba(15, 23, 37, 0.94)',
  ctaBg: '#F8FAFD',
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
  violetInk: '#6D28D9',
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

/* -------------------------------------------------------------------------- */
/*  Token registry                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Palette ka LOSSLESS mapping — captured colour value se wapas semantic token
 * tak pahunchne ka tareeka.
 *
 * Kyun zaroori hai:
 * `StyleSheet.create` module-load par colour value *capture* kar leta hai
 * (object literal evaluate hota hai). Uske baad `themedStyleColor()` ko
 * pata nahi chalta ki captured value `colors.card` thi ya `colors.text` —
 * sirf ek hex string milti hai. Pehle yahi ambiguity "guessing" se hal ki
 * jaati thi (luminance heuristics), aur wahi heuristics Light Mode me
 * GALAT colour bana dete the (jaise light text -> BLACK ink).
 *
 * Registry dono palettes ke values register karti hai, isliye
 * `light -> dark -> light` round-trip EXACT rehta hai — koi heuristic nahi.
 */
type TokenName = keyof typeof LIGHT;

/** captured value → us value ko de sakte hain candidate tokens. */
const TOKENS_BY_VALUE = new Map<string, TokenName[]>();

function registerToken(value: string, token: TokenName): void {
  const list = TOKENS_BY_VALUE.get(value);
  if (list) {
    if (!list.includes(token)) list.push(token);
  } else {
    TOKENS_BY_VALUE.set(value, [token]);
  }
}

for (const key of Object.keys(LIGHT) as TokenName[]) {
  registerToken(String(LIGHT[key]), key);
  registerToken(String(DARK[key]), key);
}

/**
 * Role-wise token groups — style property se decide hota hai ki captured
 * value ka matlab kya hai. Jaise '#FFFFFF' card surface bhi hai aur text bhi;
 * `backgroundColor` par surface, `color` par text.
 */
const SURFACE_TOKENS = new Set<TokenName>([
  'background',
  'card',
  'cardMuted',
  'primaryLight',
  'accentLight',
  'dangerLight',
  'warningLight',
  'successLight',
  'violetSoft',
  'infoLight',
  'skeleton',
  'ctaBg',
]);

const INK_TOKENS = new Set<TokenName>([
  'text',
  'textSecondary',
  'textMuted',
  'textInverse',
  'navy',
  'navyDeep',
  'navySoft',
  'brandBlue',
  'brandGreen',
  'violet',
  'violetInk',
  'warningText',
  'blue',
  'blueDark',
  'primary',
  'primaryDark',
  'accent',
  'danger',
  'warning',
  'success',
  'star',
]);

const BORDER_TOKENS = new Set<TokenName>(['border', 'borderStrong']);
const SHADOW_TOKENS = new Set<TokenName>(['shadowColor']);

const BORDER_PROPERTIES = new Set<string>([
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
]);

function roleTokensFor(property: string): Set<TokenName> | undefined {
  switch (property) {
    case 'backgroundColor':
      return SURFACE_TOKENS;
    case 'color':
    case 'tintColor':
      return INK_TOKENS;
    case 'shadowColor':
      return SHADOW_TOKENS;
    default:
      return BORDER_PROPERTIES.has(property) ? BORDER_TOKENS : undefined;
  }
}

/**
 * Captured value + style property → palette token.
 * Role match pehle, warna koi bhi token jo dono palettes me defined ho.
 */
function tokenFor(value: string, property: string): TokenName | undefined {
  const candidates = TOKENS_BY_VALUE.get(value);
  if (!candidates || candidates.length === 0) return undefined;

  const role = roleTokensFor(property);
  if (role) {
    for (const token of candidates) {
      if (role.has(token)) return token;
    }
  }

  const lightValues = LIGHT as unknown as Record<string, string | undefined>;
  const darkValues = DARK as unknown as Record<string, string | undefined>;
  for (const token of candidates) {
    if (lightValues[token] !== undefined && darkValues[token] !== undefined) return token;
  }
  return undefined;
}

/**
 * Deliberately fixed colours — inhe kabhi remap NAHI karna.
 * (Video-call ka hamesha-dark surface, brand logos, splash blobs.)
 *
 * Design intentional hai — inhe theme ke saath badalna bug hai, feature nahi.
 */
const FIXED_COLORS = new Set<string>([
  /* Video call screen — hamesha dark (call UI convention) */
  '#0B1220',
  '#091522',
  '#131C2E',
  '#0A1A2E',
  '#0D1826',
  '#16263B',
  'RGBA(11,18,32,0.55)',
  'RGBA(11,18,32,0.92)',
  'RGBA(11,18,32,0.75)',
  /* Hero scrim ke upar mint text — hamesha light */
  '#C9F5F1',
  '#7FE9E1',
  /* Splash ke legacy blobs */
  '#198AEA',
  '#0CB6B6',
  /* Google brand colours */
  '#4285F4',
  '#34A853',
  '#FBBC05',
  '#EA4335',
]);

/* ------------------------------------------------- light → dark hue mapping */

/*
 * NOTE: Light ↔ dark hex tables ki zaroorat ab nahi — `TOKENS_BY_VALUE`
 * (upar) semantic token ko value se wapas resolve karta hai, isliye mapping
 * exact hai aur hand-maintained lookup tables nahi rakhne padte.
 */

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
  '#EAF1FF': DARK.infoLight,
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
  '#111B2E': DARK.card,
  '#26364E': DARK.border,
  '#E5EDF8': DARK.text,
  '#111F30': DARK.card,
  '#17283B': DARK.cardMuted,
  '#26384D': DARK.border,
  '#354A61': DARK.borderStrong,
  '#E8EEF7': DARK.text,
  '#A7B5C9': DARK.textSecondary,
  '#8494AA': DARK.textMuted,
};

/*
 * Reverse table — jo values DARK palette me aayein, unka light-mode counterpart.
 * Ye `EXTRA_DARK` ka exact mirror hai, isliye round-trip lossless rehta hai.
 */
const EXTRA_LIGHT: Record<string, string> = {
  '#111B2E': LIGHT.card,
  '#111F30': LIGHT.card,
  '#17283B': LIGHT.cardMuted,
  '#26364E': LIGHT.border,
  '#26384D': LIGHT.border,
  '#354A61': LIGHT.borderStrong,
  '#3B3021': '#FBE3BE',
  '#3F2327': '#FECACA',
  '#2A1A1E': '#FFF8F8',
  '#2C1620': '#FFF5F7',
};

/**
 * Text-token swap (mode ke hisaab se). Agar kisi screen ka text token galat
 * mode ki value le aata hai (ya mapping se dim value ban jaati hai) toh yeh
 * use padhne layak sahi-mode ke token me badal deta hai.
 *
 * Sirf exact palette tokens badle jaate hain — isliye brand buttons ka white
 * text (`textInverse`) aur saare backgrounds bilkul nahi chalte.
 */
const DARK_TEXT_SWAPS: Record<string, string> = {
  /* light-mode dim text → dark mode me bright ink text */
  '#0B1B2E': DARK.text,
  '#3F5372': DARK.textSecondary,
  '#566784': DARK.textSecondary,
  '#6B7C96': DARK.textMuted,
  '#8A97AB': DARK.textMuted,
  '#5A6E8C': DARK.textMuted,
  /* purani dark tokens jo ab brightened hain */
  '#A3B3C9': DARK.textSecondary,
  '#7A8AA3': DARK.textMuted,
};

const LIGHT_TEXT_SWAPS: Record<string, string> = {
  /* dark-mode bright text → light mode me dark ink text */
  '#E9F1FA': LIGHT.text,
  '#DCE9FA': LIGHT.text,
  '#C3D2E6': LIGHT.textSecondary,
  '#A3B3C9': LIGHT.textSecondary,
  '#B6CBE6': LIGHT.textSecondary,
  '#A2B3CC': LIGHT.textMuted,
  '#7A8AA3': LIGHT.textMuted,
  /* purani light tokens jo ab darkened hain */
  '#566784': LIGHT.textSecondary,
  '#8A97AB': LIGHT.textMuted,
  '#5A6E8C': LIGHT.textMuted,
};

/**
 * Style colour ka EXACT, lossless mapping.
 *
 * Pehle yahan "guessing" hoti thi — captured hex ko luminance dekh kar
 * doosre mode ka colour banaya jaata tha. Wahi guessing Light Mode me
 * BLACK ink bana deti thi (light text -> `LIGHT.text`) aur unknown dark
 * surfaces ko dark hi chhod deti thi. Isi wajah se Dark -> Light switch
 * ke baad kuch elements black/dark reh jaate the.
 *
 * Ab resolution order:
 *   1. `FIXED_COLORS`            — design intentional, kabhi nahi badalta
 *   2. property-specific rules   — brand surfaces, navy-as-text, legacy swaps
 *   3. TOKEN REGISTRY            — palette ka exact round-trip (no guessing)
 *   4. rgba sheet rules          — white sheet <-> ink sheet
 *   5. curated literal tables   — screens ke hard-coded hexes
 *   6. conservative fallback     — value waisa hi rehta hai (naya colour
 *                                  kabhi invent nahi hota)
 */
function themedStyleColor(value: unknown, property: string): unknown {
  if (typeof value !== 'string') return value;

  const upper = value.toUpperCase();
  const isText = property === 'color' || property === 'tintColor';
  const isBorder = BORDER_PROPERTIES.has(property);

  /* 1. Deliberately fixed colours (video-call surface, brand logos …). */
  if (FIXED_COLORS.has(upper)) return value;

  /* 2. Property-specific rules jo design par depend karti hain. */
  if (isText) {
    /* Purane (palette se bahar) dim text tokens → is mode ka readable text. */
    const swapped = (themeIsDark ? DARK_TEXT_SWAPS : LIGHT_TEXT_SWAPS)[upper];
    if (swapped) return swapped;

    /* Navy text slot me dark mode me bright ink chahiye. */
    if (themeIsDark) {
      const navy = NAVY_AS_TEXT[upper];
      if (navy) return navy;
    }
  }

  /*
   * Brand surface (badge / button / tab-pill) apna colour DARK mode me bhi
   * rehti hai — sirf uspar ka text/icon bright hota hai. Light mode me
   * palette ka token hi sahi value deta hai, is liye ye rule sirf dark mode
   * me lagta hai.
   */
  if (themeIsDark) {
    const surface = SURFACE_SAFE[upper];
    if (surface) return isText ? surface.fg : surface.bg;
  }

  /* Shadow: design me dark mode me black, light mode me navy. */
  if (property === 'shadowColor') {
    if (themeIsDark) return DARK.shadowColor;
    if (upper === '#000000' || upper === '#000') return LIGHT.shadowColor;
  }

  /* White border: light mode me white, dark mode me ink border. */
  if (isBorder && (upper === '#FFFFFF' || upper === '#FFF')) {
    return themeIsDark ? DARK.border : value;
  }

  /* 3. TOKEN REGISTRY — palette ka exact, lossless round-trip. */
  const token = tokenFor(value, property);
  if (token) return themeIsDark ? DARK[token] : LIGHT[token];

  /* 4. rgba sheets — white sheet <-> ink sheet (sirf opposite mode me badalta hai). */
  if (!value.startsWith('#')) {
    if (themeIsDark) {
      /* White sheet (near-opaque) dark me ink sheet ban jaata hai. */
      const whiteSheet = value.match(/^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)$/i);
      if (whiteSheet) {
        return property === 'backgroundColor' && Number(whiteSheet[1]) >= 0.9
          ? `rgba(12, 19, 30, ${whiteSheet[1]})`
          : value;
      }
    } else {
      /* Ink sheet light mode me white sheet ban jaata hai. */
      const inkSheet = value.match(/^rgba\(\s*12\s*,\s*19\s*,\s*30\s*,\s*([0-9.]+)\s*\)$/i);
      if (inkSheet) {
        return property === 'backgroundColor' ? `rgba(255, 255, 255, ${inkSheet[1]})` : value;
      }
    }

    /* Baaki translucent values (overlay scrims, white-on-dark chips) — as-is. */
    return value;
  }

  /* 5. Curated tables — screens ke hard-coded hexes. */
  const extra = themeIsDark ? EXTRA_DARK[upper] : EXTRA_LIGHT[upper];
  if (extra !== undefined) return extra;

  /* 6. Conservative fallback. */
  return themeIsDark ? fallbackInk(value, property) : fallbackLight(value, property);
}

/**
 * Light mode fallback — sirf SURFACE/BORDER roles me.
 *
 * ⚠️ Text (`color`) ke liye KABHI fallback nahi: halki text ko ink (black)
 * banana hi woh bug tha jisse Light Mode me elements black ho jaate the.
 * Text halki hai toh woh dark surface par hi rakhi hai (hero, chat bubble).
 */
function fallbackLight(value: string, property: string): string {
  const hex = value.slice(1);
  if (hex.length !== 6) return value;
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const saturation = max === 0 ? 0 : (max - min) / max;

  if (property === 'backgroundColor' && lum < 0.22 && saturation < 0.35) {
    return lum < 0.12 ? LIGHT.card : LIGHT.cardMuted;
  }
  if (BORDER_PROPERTIES.has(property) && lum < 0.3 && saturation < 0.4) {
    return LIGHT.border;
  }
  return value;
}

/** Dark mode fallback — sirf SURFACE/BORDER/TEXT roles me (text: dark ink -> bright ink). */
function fallbackInk(value: string, property: string): string {
  const hex = value.slice(1);
  if (hex.length !== 6) return value;
  const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (property === 'backgroundColor' && lum > 0.75 && saturation < 0.35) {
    return lum > 0.94 ? DARK.card : DARK.cardMuted;
  }
  if (BORDER_PROPERTIES.has(property) && lum > 0.55 && saturation < 0.35) return DARK.borderStrong;
  if ((property === 'color' || property === 'tintColor') && lum < 0.3 && saturation < 0.95) return DARK.text;
  return value;
}

/**
 * Public helper — captured colour ko current mode ke colour me resolve karta
 * hai. Tests isse round-trip verify karte hain.
 */
export function resolveThemedColor(value: string, property: string): string {
  const resolved = themedStyleColor(value, property);
  return typeof resolved === 'string' ? resolved : value;
}

/**
 * Palette tokens ka public listing — tests isse completeness check karte hain
 * (har token dono palettes me defined hona chahiye).
 */
export function themeTokenNames(): string[] {
  return Object.keys(LIGHT);
}

// StyleSheet styles ek baar module load par banti hain. Un colour values ko
// dynamic getter bana dete hain taaki theme switch par har screen update ho.
//
// Lekin sirf getter kaafi NAHI hai: React Native ka style diff
// (`ReactNativeAttributePayload.diffNestedProperty`) `prevProp === nextProp`
// par foran bail out kar deta hai. Agar `style={typography.h3}` jaisa stable
// object reference diya jaaye toh RN dobara diff hi nahi karta aur purani
// theme ki colour native view par bani rehti hai (isliye headings dark mode
// me bhi light-mode colour dikhate the). Isliye har access par EK NAYA object
// milta hai — reference badalta hai, diff chalta hai, getters dobara padhe
// jaate hain.
function dynamicStyleMap<T extends Record<string, unknown>>(source: T): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    const value = source[key] as Record<string, unknown>;
    Object.defineProperty(out, key, {
      enumerable: true,
      configurable: true,
      get: () => ({ ...value }),
    });
  }
  return out as T;
}

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
  originalCreate(styles); // DEV me freeze + validation
  return dynamicStyleMap(styles);
};

/* ----------------------------------------------------------------- gradients */

/** Named gradients — hero cards, buttons, tab pill aur background wash ke liye. */
export const gradients: Record<'brand' | 'hero' | 'ink' | 'diet' | 'success' | 'warning' | 'danger' | 'info' | 'wash' | 'authWash', string[]> = {
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
  /**
   * Diet planner card — light me violet→teal, dark me DEEP violet→deep teal.
   * Dark mode me `colors.violet` (#A78BFA) text ke liye bright hota hai, par
   * surface/gradient ke liye washed-out padta tha — isliye yahan alag stops.
   */
  get diet(): string[] { return themeIsDark ? ['#5B21B6', '#0F766E'] : ['#7C3AED', '#0BA39C']; },
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
 * current palette padhta hai.
 *
 * `dynamicStyleMap` se har access par naya object milta hai, warna RN ka style
 * diff stable reference par bail out kar deta aur heading ka rang theme switch
 * par update hi nahi hota.
 */
const typographySource: Record<string, TextStyle> = {
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

export const typography = dynamicStyleMap(typographySource);

/* ------------------------------------------------------------------ shadows */

const shadowSource: Record<string, ViewStyle> = {
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

export const shadow = dynamicStyleMap(shadowSource);

export default { colors, gradients, spacing, radius, typography, shadow };
