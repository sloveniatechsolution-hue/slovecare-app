/**
 * Brand logo components — assets folder ke official logos use hote hain.
 *  <Logo />      -> full horizontal logo (Splash / Auth / Onboarding)
 *  <LogoMark />  -> sirf heart mark (App bar / tabs)
 *
 * Assets transparent hain (white background hata diya gaya hai) — light/dark
 * dono themes par bina white box ke chalte hain. Dark theme par dark navy text
 * dikh nahi paata, is liye `-dark` (lightened) variant use hota hai.
 */

import React from 'react';
import { Image, ImageStyle, StyleProp, Text, View } from 'react-native';
import { colors } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

/** Full horizontal logo — white bg removed, 829 x 257. */
const FULL_LOGO = require('../../assets/slovecare_transparent.png');
const FULL_LOGO_DARK = require('../../assets/slovecare_transparent_dark.png');
/** Sirf heart mark — white bg removed. */
const LOGO_MARK = require('../../assets/icon-transparent.png');
const LOGO_MARK_DARK = require('../../assets/icon-transparent-dark.png');

/**
 * Sirf wordmark — "SloveCare" text, bina heart mark ke.
 * Splash me circle ke andar mark already hota hai, isliye bahar text hi kaafi hai.
 */
export function Wordmark({
  size = 34,
  style,
}: {
  size?: number;
  style?: StyleProp<import('react-native').TextStyle>;
}): React.JSX.Element {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}>
      <Text
        style={{
          fontSize: size,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: colors.brandBlue,
        }}
      >
        Slove
      </Text>
      <Text
        style={{
          fontSize: size,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: colors.brandGreen,
        }}
      >
        Care
      </Text>
    </View>
  );
}

export function Logo({
  width = 220,
  style,
}: {
  width?: number;
  style?: StyleProp<ImageStyle>;
}): React.JSX.Element {
  const { dark } = useThemePreference();
  // slovecare_transparent.png aspect ratio ≈ 829 x 257
  const height = Math.round((width * 257) / 829);
  return (
    <Image
      source={dark ? FULL_LOGO_DARK : FULL_LOGO}
      resizeMode="contain"
      style={[{ width, height }, style]}
      accessibilityLabel="SloveCare logo"
    />
  );
}

export function LogoMark({
  size = 36,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}): React.JSX.Element {
  const { dark } = useThemePreference();
  return (
    <Image
      source={dark ? LOGO_MARK_DARK : LOGO_MARK}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessibilityLabel="SloveCare"
    />
  );
}

/** Mark + wordmark ka compact combo app bar ke liye. */
export function BrandLockup({ markSize = 32 }: { markSize?: number }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <LogoMark size={markSize} />
    </View>
  );
}

export default Logo;
