/**
 * Brand logo components — assets folder ke official logos use hote hain.
 *  <Logo />      -> full horizontal logo (Splash / Auth / Onboarding)
 *  <LogoMark />  -> sirf heart mark (App bar / tabs)
 */

import React from 'react';
import { Image, ImageStyle, StyleProp, Text, View } from 'react-native';

/** logo.jpg ka trimmed version — original me content ke chaaro taraf bahut
 *  zyada white padding thi, isliye logo ke neeche space zyada dikhta tha. */
const FULL_LOGO = require('../../assets/logo-trimmed.jpg');
const LOGO_MARK = require('../../assets/icon.png');

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
          color: '#0B3C8D',
        }}
      >
        Slove
      </Text>
      <Text
        style={{
          fontSize: size,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: '#0E9E6E',
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
  // logo-trimmed.jpg aspect ratio ≈ 829 x 257
  const height = Math.round((width * 257) / 829);
  return (
    <Image
      source={FULL_LOGO}
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
  return (
    <Image
      source={LOGO_MARK}
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
