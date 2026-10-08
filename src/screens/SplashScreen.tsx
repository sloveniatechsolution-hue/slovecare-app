/**
 * Splash — rich animated brand intro.
 *  • Background: gradient wash + 3 drifting blobs + floating medical icons
 *  • Mark: spring pop-in + heartbeat + expanding pulse rings
 *  • Wordmark: text "SloveCare" (bina heart mark ke) + uppercase tagline
 *  • Promise line + staggered feature chips
 *  • Count-up trust stats (24/7 • 50+ staff • 2,400+ families)
 *  • Progress bar with live % + rotating status text
 * Session restore ke baad Auth / HealthProfile / Main par navigate karta hai.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LogoMark, Wordmark } from '../components/Logo';
import { Screen } from '../components/UI';
import Icon, { IconName } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

const FEATURES: { icon: IconName; label: string }[] = [
  { icon: 'shield-check', label: 'Verified Doctors & Nurses' },
  { icon: 'zap', label: '24/7 Emergency & ICU Ambulance' },
  { icon: 'home', label: 'Free Home Sample Pickup' },
  { icon: 'video', label: 'Free Teleconsultation' },
];

const FLOATERS: { icon: IconName; left: number; top: number; size: number; delay: number }[] = [
  { icon: 'stethoscope', left: 34, top: 130, size: 22, delay: 0 },
  { icon: 'hand-heart', left: 310, top: 190, size: 18, delay: 600 },
  { icon: 'heart-pulse', left: 46, top: 470, size: 20, delay: 1200 },
  { icon: 'flask', left: 300, top: 520, size: 17, delay: 300 },
  { icon: 'ambulance', left: 170, top: 96, size: 19, delay: 900 },
  { icon: 'bed', left: 250, top: 640, size: 16, delay: 1500 },
];

const STATS: { value: number; suffix: string; label: string }[] = [
  { value: 24, suffix: '/7', label: 'Emergency' },
  { value: 50, suffix: '+', label: 'Certified Staff' },
  { value: 2400, suffix: '+', label: 'Families Trusted' },
];

const STATUS_MESSAGES = [
  'Preparing your care…',
  'Connecting to certified staff…',
  'Loading labs & pharmacy…',
  'Almost there…',
];

export default function SplashScreen({ navigation }: Props): React.JSX.Element {
  const { initializing, isLoggedIn, needsHealthProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  /* Chhoti/almihti devices par content compress karo taki footer kabhi overlap na kare */
  const compact = winH < 720;
  const markSize = compact ? 74 : 92;
  const circleSize = compact ? 124 : 152;
  const ringSize = compact ? 140 : 172;
  const wrapSize = compact ? 196 : 244;
  /** Floaters ka layout 390x844 design par bana hai — device size ke hisaab se scale. */
  const floaterX = winW / 390;
  const floaterY = winH / 844;

  /* -------------------- animation values -------------------- */
  const markScale = useRef(new Animated.Value(0.4)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markRotate = useRef(new Animated.Value(-12)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslate = useRef(new Animated.Value(28)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const promiseOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const counter = useRef(new Animated.Value(0)).current;
  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
  const floaterAnims = useRef(FLOATERS.map(() => new Animated.Value(0))).current;

  const [statusIndex, setStatusIndex] = useState(0);
  const [percent, setPercent] = useState(0);
  const [counts, setCounts] = useState(STATS.map(() => 0));

  /* ---------------------- intro sequence --------------------- */
  useEffect(() => {
    const intro = Animated.sequence([
      Animated.parallel([
        Animated.spring(markScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(markRotate, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslate, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(promiseOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      /* feature chips — staggered slide-in */
      Animated.stagger(
        120,
        featureAnims.map(v =>
          Animated.timing(v, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
      /* trust stats fade + count-up */
      Animated.timing(statsOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    intro.start();

    /* count-up numbers */
    Animated.timing(counter, {
      toValue: 1,
      duration: 1400,
      delay: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    /* heartbeat pulse on the mark */
    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(pulse, { toValue: 1.06, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    heartbeat.start();

    /* expanding pulse rings around the mark */
    const makeRing = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const ringAnim1 = makeRing(ring1, 0);
    const ringAnim2 = makeRing(ring2, 1100);
    ringAnim1.start();
    ringAnim2.start();

    /* floating medical icons — gentle bobbing */
    floaterAnims.forEach((value, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(FLOATERS[index].delay),
          Animated.sequence([
            Animated.timing(value, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(value, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ]),
      ).start();
    });

    /* looping progress bar */
    barWidth.setValue(0);
    const progress = Animated.loop(
      Animated.sequence([
        Animated.timing(barWidth, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.delay(220),
      ]),
    );
    progress.start();

    return () => {
      intro.stop();
      heartbeat.stop();
      ringAnim1.stop();
      ringAnim2.stop();
      progress.stop();
    };
  }, [markScale, markOpacity, markRotate, logoOpacity, logoTranslate, taglineOpacity, promiseOpacity, statsOpacity, pulse, barWidth, ring1, ring2, counter, featureAnims, floaterAnims]);

  /* --------------- listeners: % + counters ---------------- */
  useEffect(() => {
    // barWidth 8%→100% map hota hai — usi ka live % dikhao
    const progressListener = barWidth.addListener(({ value }) => {
      setPercent(Math.min(100, Math.max(8, Math.round(value * 100))));
    });
    const counterListener = counter.addListener(({ value }) => {
      setCounts(STATS.map(stat => Math.round(value * stat.value)));
    });
    return () => {
      barWidth.removeListener(progressListener);
      counter.removeListener(counterListener);
    };
  }, [barWidth, counter]);

  /* ------------------ rotating status text ------------------ */
  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % STATUS_MESSAGES.length);
    }, 1600);
    return () => clearInterval(timer);
  }, []);

  /* -------------------- navigation -------------------- */
  useEffect(() => {
    if (initializing) {
      return;
    }
    const timer = setTimeout(() => {
      if (!isLoggedIn) {
        navigation.replace('Auth');
      } else if (needsHealthProfile) {
        navigation.replace('HealthProfile');
      } else {
        navigation.replace('Main');
      }
    }, 3500); // splash ko thoda zyada dikhao — poori animation complete ho jaye
    return () => clearTimeout(timer);
  }, [initializing, isLoggedIn, needsHealthProfile, navigation]);

  const barAnimatedStyle = {
    width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['8%', '100%'] }),
  };

  const ringStyle = (ring: Animated.Value) => ({
    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.85] }) }],
  });

  const formatCount = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(value >= 1000 ? 1 : 0)}k` : String(value));

  return (
    <Screen backgroundColor={colors.card}>
      {/* soft brand gradient wash */}
      <View style={styles.gradientLayer} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="splashBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#E8F4FB" />
              <Stop offset="0.55" stopColor="#F7FBFE" />
              <Stop offset="1" stopColor="#FFFFFF" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#splashBg)" />
        </Svg>
      </View>

      {/* floating medical icons */}
      {FLOATERS.map((floater, index) => (
        <Animated.View
          key={`${floater.icon}-${index}`}
          pointerEvents="none"
          style={[
            styles.floater,
            { left: floater.left * floaterX, top: floater.top * floaterY },
            {
              opacity: floaterAnims[index].interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.4] }),
              transform: [
                { translateY: floaterAnims[index].interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
                {
                  rotate: floaterAnims[index].interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }),
                },
              ],
            },
          ]}
        >
          <Icon name={floater.icon} size={floater.size} color={colors.blue} />
        </Animated.View>
      ))}

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Mark + subtle pulse rings */}
        <View style={[styles.markWrap, { width: wrapSize, height: wrapSize }]}>
          <Animated.View style={[styles.pulseRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }, ringStyle(ring1)]} />
          <Animated.View style={[styles.pulseRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }, ringStyle(ring2)]} />

          <Animated.View
            style={[
              styles.markCircle,
              { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
              {
                opacity: markOpacity,
                transform: [
                  { scale: Animated.multiply(markScale, pulse) },
                  { rotate: markRotate.interpolate({ inputRange: [-12, 0], outputRange: ['-12deg', '0deg'] }) },
                ],
              },
            ]}
          >
            <LogoMark size={markSize} />
          </Animated.View>
        </View>

        {/* Wordmark — sirf text, heart mark nahi (circle me already hai) */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ translateY: logoTranslate }],
            marginTop: spacing.lg,
            alignItems: 'center',
          }}
        >
          <Wordmark size={compact ? 34 : 40} />
          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            — Healthcare, Together. —
          </Animated.Text>
        </Animated.View>

        {/* Promise line */}
        <Animated.Text style={[styles.promise, { opacity: promiseOpacity }]}>
          Certified home healthcare — doctors, nurses & labs at your doorstep
        </Animated.Text>

        {/* Feature chips — staggered */}
        <View style={styles.featureList}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={feature.label}
              style={[
                styles.featureChip,
                {
                  opacity: featureAnims[index],
                  transform: [
                    {
                      translateY: featureAnims[index].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.featureIcon}>
                <Icon name={feature.icon} size={13} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Trust stats — count-up */}
        <Animated.View style={[styles.statsRow, { opacity: statsOpacity }]}>
          {STATS.map((stat, index) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>
                {index === 0 ? '24' : formatCount(counts[index])}
                <Text style={styles.statSuffix}>{stat.suffix}</Text>
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Footer: progress + rotating status — normal flow me, taki content overlap na kare */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.barHeader}>
          <Text style={styles.barLabel}>{STATUS_MESSAGES[statusIndex]}</Text>
          <Text style={styles.barPercent}>{percent}%</Text>
        </View>
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, barAnimatedStyle]} />
        </View>
        <Text style={styles.footerNote}>India's trusted home healthcare platform</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 420,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobBlue: {
    width: 250,
    height: 250,
    top: -80,
    right: -70,
    backgroundColor: '#198AEA',
  },
  blobTeal: {
    width: 210,
    height: 210,
    bottom: 140,
    left: -90,
    backgroundColor: '#0CB6B6',
  },
  blobMint: {
    width: 150,
    height: 150,
    top: 240,
    right: -60,
    backgroundColor: '#10B981',
  },
  floater: {
    position: 'absolute',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.35)',
  },
  markCircle: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2447',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 6,
  },
  tagline: {
    ...typography.caption,
    marginTop: 6,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  promise: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 300,
    lineHeight: 20,
  },
  featureList: {
    marginTop: spacing.lg,
    alignItems: 'flex-start',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    width: '100%',
    maxWidth: 340,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.blue,
  },
  statSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 9.5,
    marginTop: 2,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xxl,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    ...typography.caption,
  },
  barPercent: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.blue,
  },
  barTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.blue,
  },
  footerNote: {
    ...typography.caption,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.4,
  },
});
