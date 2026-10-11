/**
 * @format
 *
 * Theme tokens + light→dark mapping ka unit test.
 *  - palette keys dono modes me defined hain
 *  - `colors` Proxy theme switch follow karta hai
 *  - StyleSheet.create ki colour values dynamic getters hain (dark mode)
 *  - gradient stops theme-aware hain
 */

import { applyTheme, colors, gradients, shadow, typography } from '../src/theme/theme';
import { StyleSheet } from 'react-native';

beforeEach(() => {
  applyTheme('light');
});

test('light palette light values deti hai', () => {
  applyTheme('light');
  expect(colors.background).toBe('#F5F7FB');
  expect(colors.card).toBe('#FFFFFF');
  expect(colors.primary).toBe('#0BA39C');
});

test('dark palette ink surfaces + teal glow deti hai', () => {
  applyTheme('dark');
  expect(colors.background).toBe('#070C14');
  expect(colors.card).toBe('#0F1725');
  expect(colors.cardMuted).toBe('#16202F');
  expect(colors.border).toBe('#1E2A3C');
  expect(colors.text).toBe('#E9F1FA');
  expect(colors.primary).toBe('#2DD4BF');
  expect(colors.shadowColor).toBe('#000000');
});

test('dono palettes me hi keys match karti hain', () => {
  applyTheme('dark');
  const darkKeys = Object.keys(colors);
  applyTheme('light');
  const lightKeys = Object.keys(colors);
  expect(darkKeys).toEqual(lightKeys);
});

test('module-level styles theme switch follow karti hain', () => {
  const styles = StyleSheet.create({
    surface: { backgroundColor: colors.card, borderColor: colors.border, color: colors.textSecondary },
    hero: { backgroundColor: colors.navyDeep, color: colors.textInverse },
    chip: { backgroundColor: '#E8F0FE', color: '#B45309' },
    overlay: { backgroundColor: 'rgba(255,255,255,0.94)' },
  });

  applyTheme('light');
  expect(styles.surface.backgroundColor).toBe('#FFFFFF');
  expect(styles.chip.backgroundColor).toBe('#E8F0FE');
  expect(styles.overlay.backgroundColor).toBe('rgba(255,255,255,0.94)');

  applyTheme('dark');
  /* Surfaces ink ban jaate hain */
  expect(styles.surface.backgroundColor).toBe('#0F1725');
  expect(styles.surface.borderColor).toBe('#1E2A3C');
  expect(styles.surface.color).toBe('#C3D2E6');
  /* Hero ka ink base dark hi rehta hai, white text white hi rehta hai */
  expect(styles.hero.backgroundColor).toBe('#060D18');
  expect(styles.hero.color).toBe('#FFFFFF');
  /* Ad-hoc literals bhi dark me sahe hue */
  expect(styles.chip.backgroundColor).toBe('#13233B');
  expect(styles.chip.color).toBe('#FBBF24');
  /* Near-opaque white sheet ink sheet ban jaata hai */
  expect(styles.overlay.backgroundColor).toBe('rgba(12, 19, 30, 0.94)');
});

test('solid brand surfaces (badge/button) dark me bhi white icon ke saath rehte hain', () => {
  const styles = StyleSheet.create({
    badge: { backgroundColor: colors.primary, color: colors.textInverse },
    badgeBlue: { backgroundColor: colors.blue, color: colors.textInverse },
  });
  applyTheme('dark');
  expect(styles.badge.backgroundColor).toBe('#0BA39C');
  expect(styles.badge.color).toBe('#FFFFFF');
  expect(styles.badgeBlue.backgroundColor).toBe('#2563EB');
});

test('gradient stops theme-aware hain', () => {
  applyTheme('light');
  expect(gradients.brand).toEqual(['#0BA39C', '#1C7EE0']);
  applyTheme('dark');
  expect(gradients.brand).toEqual(['#2DD4BF', '#3B82F6']);
  expect(gradients.wash[2]).toBe('#070C14');
});

test('typography + shadow current palette padhte hain', () => {
  applyTheme('dark');
  expect(typography.h3.color).toBe('#E9F1FA');
  applyTheme('light');
  expect(typography.h3.color).toBe('#0B1B2E');
  expect(shadow.card).toHaveProperty('shadowOffset');
});
