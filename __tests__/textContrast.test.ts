/**
 * @format
 *
 * Text contrast guard — dark aur light dono modes me har text token padhne
 * layak hona chahiye.
 *
 * Yeh regression rokta hai jo do baar report hua tha: theme switch ke baad
 * headings/labels dobara light ho jaate the. Token values aur
 * `themedStyleColor` swap dono yahin cover hote hain.
 */

import { StyleSheet } from 'react-native';
import { applyTheme, colors, gradients } from '../src/theme/theme';

/** WCAG 2.x relative luminance. */
function relativeLuminance(hex: string): number {
  const channels = [0, 2, 4]
    .map(i => parseInt(hex.slice(i + 1, i + 3), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio — 4.5+ = normal text ke liye pass. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** StyleSheet style par live colour nikaalte hain. */
function colorOf(style: Record<string, unknown>): string {
  return (StyleSheet.flatten(style) as Record<string, unknown> | null | undefined)?.color as string;
}

/** Har mode par heading/label/muted ke same three tokens. */
function themedTextStyles(): Record<string, Record<string, unknown>> {
  return StyleSheet.create({
    heading: { color: colors.text },
    label: { color: colors.textSecondary },
    muted: { color: colors.textMuted },
  });
}

/** Ek text token ke dono surfaces par 4.5:1 se zyada contrast chahiye. */
function expectReadable(name: string, color: string): void {
  const onBackground = contrast(color, colors.background);
  const onCard = contrast(color, colors.card);
  if (onBackground < 4.5 || onCard < 4.5) {
    throw new Error(
      `${name} = ${color} is too low-contrast — background ${onBackground.toFixed(2)}:1, card ${onCard.toFixed(2)}:1 (need 4.5:1)`,
    );
  }
}

describe('text contrast guard (both modes)', () => {
  it('dark mode — ink surfaces par sab readable', () => {
    applyTheme('dark');
    for (const [name, style] of Object.entries(themedTextStyles())) {
      expectReadable(`dark ${name}`, colorOf(style));
    }
  });

  it('light mode — card surfaces par sab readable', () => {
    applyTheme('light');
    for (const [name, style] of Object.entries(themedTextStyles())) {
      expectReadable(`light ${name}`, colorOf(style));
    }
  });

  it('brand buttons ka white text dono modes me safe rehta hai', () => {
    const styles = StyleSheet.create({ onBrand: { color: colors.textInverse } });
    applyTheme('light');
    expect(colorOf(styles.onBrand)).toBe('#FFFFFF');
    applyTheme('dark');
    expect(colorOf(styles.onBrand)).toBe('#FFFFFF');
  });

  it('wrong-mode text token us mode ka readable token ban jaata hai', () => {
    const legacy = StyleSheet.create({
      dimSecondary: { color: '#A3B3C9' },
      dimMuted: { color: '#8A97AB' },
      lightInk: { color: '#0B1B2E' },
    });

    applyTheme('light');
    expectReadable('light dimSecondary', colorOf(legacy.dimSecondary));
    expectReadable('light dimMuted', colorOf(legacy.dimMuted));
    expectReadable('light lightInk', colorOf(legacy.lightInk));

    applyTheme('dark');
    expectReadable('dark dimSecondary', colorOf(legacy.dimSecondary));
    expectReadable('dark dimMuted', colorOf(legacy.dimMuted));
    expectReadable('dark lightInk', colorOf(legacy.lightInk));
  });

  it('palette ke text tokens dono modes me defined hain', () => {
    applyTheme('light');
    const light = { text: colors.text, textSecondary: colors.textSecondary, textMuted: colors.textMuted };
    applyTheme('dark');
    const dark = { text: colors.text, textSecondary: colors.textSecondary, textMuted: colors.textMuted };
    expect(Object.keys(dark)).toEqual(Object.keys(light));
    expect(dark).not.toEqual(light);
  });

  it('diet card — text wale gradient stop par white readable (both modes)', () => {
    for (const mode of ['light', 'dark'] as const) {
      applyTheme(mode);
      /*
       * Gradient diagonal chalta hai (top-left → bottom-right). Icon, title aur
       * subtitle sab top-left me hain, neeche opaque CTA pill hai. Isliye sirf
       * text wala stop (index 0) ko 4.5:1 ka paas hona chahiye — doosre stop par
       * koi text nahi betha.
       */
      const textStop = gradients.diet[0];
      const ratio = contrast('#FFFFFF', textStop);
      if (ratio < 4.5) {
        throw new Error(
          `${mode} gradients.diet[0] = ${textStop} — white text only ${ratio.toFixed(2)}:1 (need 4.5:1)`,
        );
      }

      /* Pill ka gradient se alag dikhna zaroori hai — warna button gayab. */
      const pill = contrast(colors.ctaBg, gradients.diet[1]);
      if (pill < 2.5) {
        throw new Error(
          `${mode}: CTA pill ${colors.ctaBg} does not stand out from gradient stop ${gradients.diet[1]} (${pill.toFixed(2)}:1)`,
        );
      }
    }
  });

  it('diet card CTA — pill white + label violet dono modes me bache rehte hain', () => {
    for (const mode of ['light', 'dark'] as const) {
      applyTheme(mode);
      /* StyleSheet.create hi wahan hai jahan themedStyleColor values rewrite
         karta hai — isi liye yahan se guzara chahiye. */
      const styles = StyleSheet.create({
        pill: { backgroundColor: colors.ctaBg, borderColor: 'rgba(11, 27, 46, 0.10)' },
        label: { color: colors.violetInk },
      });
      const pill = StyleSheet.flatten(styles.pill) as Record<string, string>;
      const label = StyleSheet.flatten(styles.label) as Record<string, string>;

      if (pill.backgroundColor !== colors.ctaBg) {
        throw new Error(
          `${mode}: CTA pill background ${pill.backgroundColor} was rewritten from ${colors.ctaBg}`,
        );
      }
      if (label.color !== colors.violetInk) {
        throw new Error(`${mode}: CTA label ${label.color} was rewritten from ${colors.violetInk}`);
      }

      const ratio = contrast(label.color, pill.backgroundColor);
      if (ratio < 4.5) {
        throw new Error(
          `${mode}: diet CTA label ${label.color} on pill ${pill.backgroundColor} is only ${ratio.toFixed(2)}:1 (need 4.5:1)`,
        );
      }
    }
  });
});
