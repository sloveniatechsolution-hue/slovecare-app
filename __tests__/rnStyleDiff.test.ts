/**
 * @format
 *
 * ROOT-CAUSE regression test — dark/light switch par sirf kuch text update
 * hota tha (baaki stale reh jaate the).
 *
 * React Native ka style diff (`ReactNativeAttributePayload`)
 * `prevProp === nextProp` par foran bail out ho jaata hai. Agar
 * `style={typography.h3}` jaisa module-scope stable object diya jaaye toh RN
 * kabhi dobara diff nahi karta — aur uska `colors.text` getter kabhi dobara
 * padha nahi jaata, native view par purane theme ka rang bana rehta hai.
 *
 * Fix: `dynamicStyleMap` — har style access par naya object. Is test me RN ka
 * ASLI `diff()` chala kar native update payload par assert kiya jaata hai.
 */

/* eslint-disable @react-native/no-deep-imports -- RN internals hi drive karne hain */

import { StyleSheet, processColor } from 'react-native';
import { diff } from 'react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload';
import ReactNativeStyleAttributes from 'react-native/Libraries/Components/View/ReactNativeStyleAttributes';
import { applyTheme, colors, typography } from '../src/theme/theme';

const validAttributes = { style: ReactNativeStyleAttributes };

afterEach(() => {
  applyTheme('light');
});

const styles = StyleSheet.create({
  heading: { color: colors.text },
});

describe('RN native style diff — theme switch par colour update', () => {
  it('typography har access par naya object deta hai', () => {
    expect(typography.h3).not.toBe(typography.h3);
    expect(styles.heading).not.toBe(styles.heading);
  });

  it('heading (typography.h3) ka rang native me update hota hai', () => {
    applyTheme('light');
    const prev = { style: typography.h3 };
    applyTheme('dark');
    const next = { style: typography.h3 };

    const payload = diff(prev, next, validAttributes);
    expect(payload).not.toBeNull();
    expect(payload!.color).toBe(processColor('#E9F1FA'));
  });

  it('StyleSheet heading bhi update hoti hai', () => {
    applyTheme('light');
    const prev = { style: styles.heading };
    applyTheme('dark');
    const next = { style: styles.heading };

    const payload = diff(prev, next, validAttributes);
    expect(payload).not.toBeNull();
    expect(payload!.color).toBe(processColor('#E9F1FA'));
  });

  it('ek hi mode me dobara diff karne par kuch update nahi hota', () => {
    applyTheme('dark');
    const prev = { style: typography.h3 };
    const next = { style: typography.h3 };
    expect(diff(prev, next, validAttributes)).toBeNull();
  });

  it('brand button ka white text safe rehta hai', () => {
    applyTheme('light');
    const styles2 = StyleSheet.create({ btn: { color: colors.textInverse } });
    applyTheme('dark');
    expect(StyleSheet.flatten(styles2.btn)?.color).toBe('#FFFFFF');
  });
});
