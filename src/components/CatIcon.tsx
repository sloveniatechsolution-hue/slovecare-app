/**
 * Slota AI ka cat icon — Slota ek billi ka naam hai, isliye AI tab aur
 * assistant header isi se dikhte hain.
 *
 * - Poori tarah react-native-svg se draw kiya colorful art (48x48 viewBox):
 *   gradient fur, tabby stripes, pink inner-ear + blush, cream muzzle,
 *   brand-teal aankhein aur collar bell.
 * - Animated: aankhein blink karti hain, billi halki float aur sway karti hai
 *   (sab native driver par).
 * - `animate={false}` se static version (chat avatars jaise chhote uses ke liye).
 * - Koi image asset nahi — sirf SVG, har screen par crisp.
 */

import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';

interface CatIconProps {
  /** Icon ka size (square, px). */
  size?: number;
  /** Blink / float / sway animations on ya off. */
  animate?: boolean;
  /**
   * Monochrome line variant — ek hi rang me stroke hua billi (baki tab icons
   * jaisa). Tab bar / header / avatar jaise chhote uses ke liye, jahan
   * colourful art chhota hokar mushkil se dikhta hai.
   */
  color?: string;
  /** Line variant ki stroke width (default 1.8). */
  strokeWidth?: number;
}

/* Palette — colourful but soft (theme ke teal se match karta hua). */
const OUTLINE = '#8A5A2B';
const FUR_TOP = '#FFE3B8';
const FUR_BOTTOM = '#FFA94D';
const STRIPE = '#F97316';
const INNER_EAR = '#FF8FA3';
const MUZZLE = '#FFF7EC';
const NOSE = '#FF6B8A';
const BLUSH = '#FF9EBB';
const IRIS = '#0BA39C';
const PUPIL = '#16324F';
const COLLAR = '#0BA39C';
const BELL = '#FFD43B';

/** Blink + float + sway ke loops — sirf tab chalte hain jab `animate` true ho. */
function useCatMotion(animate: boolean) {
  const blink = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      blink.setValue(1);
      float.setValue(0);
      sway.setValue(0);
      return undefined;
    }

    /* Aankhein — beech me double blink (cats aisa karti hain). */
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(blink, { toValue: 0.06, duration: 80, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.delay(260),
        Animated.timing(blink, { toValue: 0.06, duration: 70, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]),
    );

    /* Halki floating. */
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    /* Dayi-baaye sway. */
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );

    blinkLoop.start();
    floatLoop.start();
    swayLoop.start();

    return () => {
      blinkLoop.stop();
      floatLoop.stop();
      swayLoop.stop();
    };
  }, [animate, blink, float, sway]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -1.6] });
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-3.5deg', '3.5deg'] });

  return { blink, translateY, rotate };
}

/**
 * Line-art cat — sab strokes ek hi rang me (caller ka `color`), na koi fill,
 * na gradient. 15–24px par bhi crisp dikhta hai (tab icon ki tarah).
 */
function CatLine({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={StyleSheet.absoluteFill}>
      {/* Kaan */}
      <Path
        d="M11.5 20.5 L6 8.5 L17 14.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d="M36.5 20.5 L42 8.5 L31 14.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Head */}
      <Circle cx={24} cy={27.5} r={13.5} stroke={color} strokeWidth={strokeWidth} />
      {/* Aankhein (dots) + nose */}
      <Circle cx={18.8} cy={26} r={1.9} fill={color} />
      <Circle cx={29.2} cy={26} r={1.9} fill={color} />
      <Path d="M22.4 31.4 h3.2 L24 33.7 Z" fill={color} />
      {/* Muskurahat */}
      <Path
        d="M24 33.7 c-0.7 2 -3.1 2.3 -4.4 0.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M24 33.7 c0.7 2 3.1 2.3 4.4 0.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Whiskers */}
      <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
        <Line x1={5.6} y1={28.4} x2={11.8} y2={29.8} />
        <Line x1={6.4} y1={34.2} x2={12.6} y2={32.8} />
        <Line x1={42.4} y1={28.4} x2={36.2} y2={29.8} />
        <Line x1={41.6} y1={34.2} x2={35.4} y2={32.8} />
      </G>
      {/* Collar */}
      <Path
        d="M15.6 39.5 Q24 44.4 32.4 39.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CatIcon({ size = 24, animate = true, color, strokeWidth = 1.8 }: CatIconProps): React.JSX.Element {
  const { blink, translateY, rotate } = useCatMotion(animate);
  /* Gradient id unique — warna do SVGs me id clash ho sakti hai. */
  const furId = `cat-fur-${useId().replace(/:/g, '')}`;

  /* Monochrome variant — tab bar / header / chat avatar */
  if (color) {
    return (
      <View style={{ width: size, height: size }}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { rotate }] }]}>
          <CatLine size={size} color={color} strokeWidth={strokeWidth} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { rotate }] }]}>
        {/* Body — gradient fur + sab detail (aankhein chhod kar) */}
        <Svg
          width={size}
          height={size}
          viewBox="0 0 48 48"
          fill="none"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id={furId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={FUR_TOP} />
              <Stop offset="1" stopColor={FUR_BOTTOM} />
            </LinearGradient>
          </Defs>

          {/* Kaan (head ke peeche) + inner ears */}
          <Path
            d="M11 19.5 L5.2 7.5 L16.5 14 Z"
            fill={FUR_TOP}
            stroke={OUTLINE}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Path
            d="M37 19.5 L42.8 7.5 L31.5 14 Z"
            fill={FUR_TOP}
            stroke={OUTLINE}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Path d="M10.96 16.6 L8.05 10.6 L13.7 13.85 Z" fill={INNER_EAR} stroke="none" />
          <Path d="M37.04 16.6 L39.95 10.6 L34.3 13.85 Z" fill={INNER_EAR} stroke="none" />

          {/* Head — gradient fur */}
          <Circle cx={24} cy={27} r={15} fill={`url(#${furId})`} stroke={OUTLINE} strokeWidth={2} />

          {/* Tabby stripes */}
          <G stroke={STRIPE} strokeWidth={2.2} strokeLinecap="round">
            <Line x1={24} y1={13.4} x2={24} y2={17.6} />
            <Line x1={19.6} y1={14.8} x2={20.7} y2={18.6} />
            <Line x1={28.4} y1={14.8} x2={27.3} y2={18.6} />
          </G>

          {/* Muzzle + blush */}
          <Ellipse cx={24} cy={35} rx={9.5} ry={6.2} fill={MUZZLE} stroke={OUTLINE} strokeWidth={1.4} />
          <Ellipse cx={12.6} cy={34.6} rx={3} ry={2} fill={BLUSH} opacity={0.8} stroke="none" />
          <Ellipse cx={35.4} cy={34.6} rx={3} ry={2} fill={BLUSH} opacity={0.8} stroke="none" />

          {/* Nose + muskurahat */}
          <Path
            d="M21.6 32.6 L26.4 32.6 L24 35.4 Z"
            fill={NOSE}
            stroke={OUTLINE}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <Path d="M24 35.4 c-0.7 2.4 -3.9 2.9 -5.4 0.8" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M24 35.4 c0.7 2.4 3.9 2.9 5.4 0.8" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />

          {/* Whiskers — head ke outline par aake rukte hain */}
          <G stroke={OUTLINE} strokeWidth={1.5} strokeLinecap="round">
            <Line x1={4.6} y1={30.2} x2={9.6} y2={31.4} />
            <Line x1={5.4} y1={36.6} x2={11.6} y2={35.6} />
            <Line x1={43.4} y1={30.2} x2={38.4} y2={31.4} />
            <Line x1={42.6} y1={36.6} x2={36.4} y2={35.6} />
          </G>

          {/* Collar + bell (extra colour) */}
          <Path d="M15.5 40 Q24 45.2 32.5 40" stroke={COLLAR} strokeWidth={3.2} strokeLinecap="round" />
          <Circle cx={24} cy={45} r={2.4} fill={BELL} stroke={OUTLINE} strokeWidth={1.2} />
          <Line x1={22.2} y1={45} x2={25.8} y2={45} stroke={OUTLINE} strokeWidth={1} />
        </Svg>

        {/* Aankhein — inhi par blink ka scaleY lagta hai */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleY: blink }] }]}>
          <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={StyleSheet.absoluteFill}>
            <Ellipse cx={17.6} cy={25.5} rx={5.4} ry={6} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={1.6} />
            <Circle cx={17.9} cy={26.1} r={3.8} fill={IRIS} />
            <Circle cx={17.9} cy={26.3} r={1.7} fill={PUPIL} />
            <Circle cx={16.4} cy={24.2} r={1.3} fill="#FFFFFF" />

            <Ellipse cx={30.4} cy={25.5} rx={5.4} ry={6} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={1.6} />
            <Circle cx={30.1} cy={26.1} r={3.8} fill={IRIS} />
            <Circle cx={30.1} cy={26.3} r={1.7} fill={PUPIL} />
            <Circle cx={28.6} cy={24.2} r={1.3} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export default CatIcon;
