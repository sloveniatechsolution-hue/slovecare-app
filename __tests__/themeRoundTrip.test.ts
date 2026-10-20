/**
 * @format
 *
 * ROOT-CAUSE regression test — Dark → Light switch ke baad kuch UI elements
 * black/dark reh jaate the.
 *
 * Asli karan:
 * `StyleSheet.create` module-load par colour value *capture* karta hai, aur
 * captured hex se semantic token wapas nahi pata chalta tha. Isliye mapping
 * "guessing" (luminance heuristics) par based thi. Wahi heuristics:
 *
 *   • Light Mode me halki text ko `LIGHT.text` (BLACK ink) bana deti thi —
 *     jaise HeroSection ka `#C9F5F1` eyebrow → pure black (hero scrim par
 *     invisible).
 *   • Unknown dark surfaces ko dark hi chhod deti thi — jaise VideoCall ka
 *     `#131C2E` preview Light Mode me bhi dark rehta tha.
 *
 * Ab mapping EXACT hai (token registry), is liye:
 *   1. Har palette token ka light → dark → light round-trip lossless hai.
 *   2. App ke har hard-coded colour literal registered hai (completeness).
 *   3. Theme switch par component bina remount ke update hota hai.
 */

/* eslint-disable @react-native/no-deep-imports -- RN internals hi drive karne hain */

/// <reference types="node" />

import fs from 'fs';
import path from 'path';
import { StyleSheet, Text } from 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {
  applyTheme,
  colors,
  gradients,
  resolveThemedColor,
  typography,
} from '../src/theme/theme';
import { ThemeProvider, useThemePreference } from '../src/theme/ThemeContext';
import { AppButton, Card, Screen } from '../src/components/UI';

const PROPERTIES = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
] as const;

afterEach(() => {
  applyTheme('light');
});

/* -------------------------------------------------------------------------- */
/*  1. Palette tokens — exact round trip                                       */
/* -------------------------------------------------------------------------- */

describe('palette tokens — lossless light → dark → light round trip', () => {
  it('har token har property role me wapas apni value par lauta hai', () => {
    const tokens = Object.keys(colors) as (keyof typeof colors)[];

    for (const token of tokens) {
      applyTheme('light');
      const lightValue = String((colors as Record<string, string>)[token]);

      for (const property of PROPERTIES) {
        applyTheme('dark');
        const darkValue = resolveThemedColor(lightValue, property);

        applyTheme('light');
        const backToLight = resolveThemedColor(darkValue, property);

        expect({
          token,
          property,
          lightValue,
          darkValue,
          backToLight,
        }).toEqual({
          token,
          property,
          lightValue,
          darkValue,
          backToLight,
        });
      }
    }
  });

  it('module-level StyleSheet styles bhi exact round trip karte hain', () => {
    const styles = StyleSheet.create({
      surface: { backgroundColor: colors.card, borderColor: colors.border },
      heading: { color: colors.text, backgroundColor: colors.background },
      muted: { color: colors.textMuted, borderTopColor: colors.borderStrong },
      inverse: { color: colors.textInverse, backgroundColor: colors.primary },
      chip: { backgroundColor: colors.infoLight, color: colors.blue },
      sheet: { backgroundColor: colors.cardOverlay },
      scrim: { backgroundColor: colors.overlay },
    });

    applyTheme('light');
    const lightSnapshot = JSON.stringify(StyleSheet.flatten(styles.surface));
    const headingLight = StyleSheet.flatten(styles.heading);
    const sheetLight = StyleSheet.flatten(styles.sheet);
    const scrimLight = StyleSheet.flatten(styles.scrim);

    applyTheme('dark');
    const darkSnapshot = JSON.stringify(StyleSheet.flatten(styles.surface));
    const headingDark = StyleSheet.flatten(styles.heading);
    const sheetDark = StyleSheet.flatten(styles.sheet);
    const scrimDark = StyleSheet.flatten(styles.scrim);

    expect(darkSnapshot).not.toBe(lightSnapshot);
    expect(headingDark?.backgroundColor).toBe('#070C14');
    expect(headingDark?.color).toBe('#E9F1FA');
    expect(sheetDark?.backgroundColor).toBe('rgba(15, 23, 37, 0.94)');
    expect(scrimDark?.backgroundColor).toBe('rgba(3, 7, 14, 0.74)');

    applyTheme('light');
    expect(JSON.stringify(StyleSheet.flatten(styles.surface))).toBe(lightSnapshot);
    expect(StyleSheet.flatten(styles.heading)).toEqual(headingLight);
    expect(StyleSheet.flatten(styles.sheet)).toEqual(sheetLight);
    expect(StyleSheet.flatten(styles.scrim)).toEqual(scrimLight);
  });

  it('typography tokens bhi wapas apni value par laute hain', () => {
    applyTheme('light');
    const lightHeading = typography.h3.color;
    applyTheme('dark');
    expect(typography.h3.color).toBe('#E9F1FA');
    applyTheme('light');
    expect(typography.h3.color).toBe(lightHeading);
  });

  it('gradients bhi round trip karte hain', () => {
    applyTheme('light');
    const lightBrand = [...gradients.brand];
    applyTheme('dark');
    expect(gradients.brand).not.toEqual(lightBrand);
    applyTheme('light');
    expect(gradients.brand).toEqual(lightBrand);
  });
});

/* -------------------------------------------------------------------------- */
/*  2. The actual reported bug                                                 */
/* -------------------------------------------------------------------------- */

describe('reported bug — Light Mode me black/dark elements', () => {
  it('hero eyebrow ka halka mint text Light Mode me BLACK nahi hota', () => {
    /* HeroSection.styles.eyebrowText — hero scrim (hamesha dark) par hai. */
    const mint = '#C9F5F1';

    applyTheme('dark');
    expect(resolveThemedColor(mint, 'color')).toBe(mint);

    applyTheme('light');
    const resolved = resolveThemedColor(mint, 'color');
    expect(resolved).toBe(mint);
    /* Pehle yahi value `LIGHT.text` (#0B1B2E = black) ban jaati thi. */
    expect(resolved).not.toBe('#0B1B2E');
    expect(resolved.toUpperCase()).not.toBe('#000000');
  });

  it('video-call ka dark surface Light Mode me bhi dark rehta hai (design intentional)', () => {
    applyTheme('light');
    expect(resolveThemedColor('#0B1220', 'backgroundColor')).toBe('#0B1220');
    expect(resolveThemedColor('#131C2E', 'backgroundColor')).toBe('#131C2E');
  });

  it('halki text kabhi ink (black) me convert nahi hoti', () => {
    applyTheme('light');
    const lightTexts = ['#C9F5F1', '#FFD2D2', '#FFFFFF', '#F8FAFD', '#E8EEF7'];
    for (const value of lightTexts) {
      const resolved = resolveThemedColor(value, 'color');
      expect(resolved.toUpperCase()).not.toBe('#000000');
      expect(resolved.toUpperCase()).not.toBe('#0B1B2E');
    }
  });

  it('dark surface Light Mode me white/light surface ban jaata hai', () => {
    applyTheme('dark');
    const darkCard = colors.card; // #0F1725
    applyTheme('light');
    expect(resolveThemedColor(darkCard, 'backgroundColor')).toBe('#FFFFFF');
  });
});

/* -------------------------------------------------------------------------- */
/*  3. Completeness guard — har app literal registered hona chahiye           */
/* -------------------------------------------------------------------------- */

describe('completeness — app ke har hard-coded colour literal registered hai', () => {
  const SRC = path.join(__dirname, '..', 'src');
  /* Sirf UI layers — PDF/print utils ka apna palette hai. */
  const UI_DIRS = ['screens', 'components', 'navigation'];

  function collectFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(full);
      return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [full] : [];
    });
  }

  /** UI files me hard-coded hex literals. */
  function appLiterals(): Array<{ file: string; literal: string }> {
    const found: Array<{ file: string; literal: string }> = [];
    for (const dir of UI_DIRS) {
      for (const file of collectFiles(path.join(SRC, dir))) {
        const source = fs.readFileSync(file, 'utf8');
        const matches = source.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
        for (const literal of matches) {
          found.push({ file: path.relative(SRC, file), literal: literal.toUpperCase() });
        }
      }
    }
    return found;
  }

  it('Light Mode me har authored literal apni hi value rehta hai (design kabhi badalta nahi)', () => {
    /*
     * App ka design LIGHT mode me authored hai. Theme machinery kabhi bhi us
     * value ko badal nahi sakti — warna "Light Mode me kuch elements black
     * ho gaye" wahi bug wapas aa jaata hai.
     */
    applyTheme('light');
    const broken = appLiterals()
      .filter(({ literal }) => !isKnownFixed(literal))
      .filter(({ literal }) => {
        const asText = resolveThemedColor(literal, 'color');
        const asBackground = resolveThemedColor(literal, 'backgroundColor');
        const asBorder = resolveThemedColor(literal, 'borderColor');
        return asText !== literal || asBackground !== literal || asBorder !== literal;
      })
      .map(entry => `${entry.file} → ${entry.literal}`)
      .sort();

    expect([...new Set(broken)].join('\n')).toBe('');
  });

  it('Dark Mode me har literal ya mapped hai ya jaan-boojh kar fixed hai', () => {
    applyTheme('dark');
    const unmapped = appLiterals()
      .filter(({ literal }) => !isKnownFixed(literal))
      .filter(({ literal }) => {
        const asText = resolveThemedColor(literal, 'color');
        const asBackground = resolveThemedColor(literal, 'backgroundColor');
        /* Dark mode me value badli ya wahi rahi — dono valid hain. Bas value
           'undefined'/'[object Object]' jaisi garbage nahi honi chahiye. */
        return (
          typeof asText !== 'string' ||
          typeof asBackground !== 'string' ||
          asText.includes('undefined') ||
          asBackground.includes('undefined')
        );
      })
      .map(entry => `${entry.file} → ${entry.literal}`)
      .sort();

    expect([...new Set(unmapped)].join('\n')).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/*  4. Component-level — theme switch bina remount ke propagate hona chahiye    */
/* -------------------------------------------------------------------------- */

function ThemedProbe({ onReady }: { onReady?: (api: { setPreference: (v: 'light' | 'dark' | 'system') => void }) => void }): React.JSX.Element {
  const { dark, setPreference } = useThemePreference();
  onReady?.({ setPreference });
  const styles = StyleSheet.create({
    probe: { backgroundColor: colors.card, color: colors.text },
  });
  return React.createElement(
    'View' as never,
    { style: styles.probe, testID: `probe-${dark ? 'dark' : 'light'}` },
    null,
  );
}

describe('theme propagation — component bina remount ke update hota hai', () => {
  it('preference badalne par consumer dobara render hota hai', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    let api: { setPreference: (v: 'light' | 'dark' | 'system') => void } | null = null;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(ThemedProbe, { onReady: value => (api = value) }),
        ),
      );
    });

    const findProbe = () =>
      renderer!.root.findAll(node => node.props?.testID?.startsWith('probe-'), {
        deep: true,
      })[0];

    expect(findProbe().props.testID).toBe('probe-light');

    await ReactTestRenderer.act(async () => {
      api!.setPreference('dark');
    });

    expect(findProbe().props.testID).toBe('probe-dark');

    await ReactTestRenderer.act(async () => {
      api!.setPreference('light');
    });

    expect(findProbe().props.testID).toBe('probe-light');
  });
});

/* -------------------------------------------------------------------------- */
/*  6. Import-order guard — theme.ts sabse pehle load hona chahiye              */
/* -------------------------------------------------------------------------- */

describe('import order — theme.ts sabse pehle', () => {
  it('index.js me theme ka bare import sabse upar hai', () => {
    /*
     * Metro `inlineRequires: true` se module-evaluation order badal jaata hai.
     * Agar koi screen module theme.ts se pehle load ho, uske module-level
     * `StyleSheet.create` styles STATIC reh jaate hain (patch install hone se
     * pehle capture ho jaati hain) — aur dark mode me splash ke cards white
     * reh jaate hain. Is liye index.js me theme ka bare import sabse pehla
     * hona chahiye.
     */
    const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
    const lines = source
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'));

    const firstImport = lines.find(line => line.startsWith('import') || line.startsWith('require('));
    expect(firstImport).toBeDefined();
    expect(firstImport).toContain('src/theme/theme');
  });
});

/** FIXED list se pata karne ke liye helper (test-only). */
function isKnownFixed(literal: string): boolean {
  const fixed = [
    '#0B1220',
    '#091522',
    '#131C2E',
    '#0A1A2E',
    '#0D1826',
    '#16263B',
    '#C9F5F1',
    '#7FE9E1',
    '#198AEA',
    '#0CB6B6',
    '#4285F4',
    '#34A853',
    '#FBBC05',
    '#EA4335',
  ];
  return fixed.includes(literal.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/*  5. End-to-end — real components par theme switch                            */
/* -------------------------------------------------------------------------- */

describe('end-to-end — real components par Light → Dark → Light', () => {
  function tree(): React.ReactElement {
    return React.createElement(
      ThemeProvider,
      null,
      React.createElement(
        Screen,
        null,
        React.createElement(
          Card,
          null,
          React.createElement(Text, { style: typography.h3, testID: 'heading' }, 'Heading'),
          React.createElement(AppButton, { label: 'Pay' }),
        ),
      ),
    );
  }

  async function render() {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    /* Async await zaroori hai — ThemeProvider AsyncStorage se hydrate hone ke
       baad hi children render karta hai. */
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(tree());
    });
    return renderer;
  }

  /** Rendered tree se saare colour style props ka flat snapshot. */
  function snapshot(renderer: ReactTestRenderer.ReactTestRenderer): string {
    const parts: string[] = [];
    renderer.root.findAll(node => node.props?.style != null).forEach(node => {
      const raw = node.props.style;
      /* Pressable ka style ek function hota hai — unpressed state lete hain. */
      const style = typeof raw === 'function' ? raw({ pressed: false }) : raw;
      const flat = StyleSheet.flatten(style) as Record<string, unknown> | undefined;
      if (!flat) return;
      const colours = Object.keys(flat)
        .filter(key => /color$/i.test(key) || key === 'shadowColor')
        .sort()
        .map(key => `${key}=${String(flat[key])}`)
        .join(',');
      if (colours) parts.push(`${node.props.testID ?? String(node.type)}: ${colours}`);
    });
    return parts.sort().join(' | ');
  }

  it('Dark → Light switch par colours bilkul wapas aa jaate hain', async () => {
    const renderer = await render();

    const lightSnapshot = snapshot(renderer);
    expect(lightSnapshot).toContain('#FFFFFF'); // card surface
    expect(lightSnapshot).toContain('#0B1B2E'); // text ink

    await ReactTestRenderer.act(async () => {
      applyTheme('dark');
      renderer.update(tree());
    });

    const darkSnapshot = snapshot(renderer);
    expect(darkSnapshot).not.toBe(lightSnapshot);
    expect(darkSnapshot).toContain('#0F1725'); // ink card
    expect(darkSnapshot).toContain('#E9F1FA'); // bright ink text

    await ReactTestRenderer.act(async () => {
      applyTheme('light');
      renderer.update(tree());
    });

    /* ← Yahi assertion pehle fail hota tha: Light Mode me kuch colours
       black/dark reh jaate the. */
    expect(snapshot(renderer)).toBe(lightSnapshot);
  });
});
