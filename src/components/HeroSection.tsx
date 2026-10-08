/**
 * Hero — Home ke top par full-bleed hero section.
 *
 * - assets/bg-video.mp4 looping background video (muted, cover)
 * - Navy/teal scrim taaki text hamesha readable rahe
 * - Eyebrow + emergency (SOS / helpline) ek hi surface par
 * - Video fail ho jaaye to navy base hi background ban jaata hai
 */

import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useIsFocused } from '@react-navigation/native';
import Icon from './Icon';
import { AppButton } from './UI';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

type HeroSectionProps = {
  onSosPress?: () => void;
  onCallPress?: () => void;
};

export default function HeroSection({
  onSosPress,
  onCallPress,
}: HeroSectionProps): React.JSX.Element {
  const videoRef = useRef<VideoRef>(null);
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [videoFailed, setVideoFailed] = useState(false);

  /* Background video sirf screen + app active rahe tab chale — battery bachti hai. */
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.hero}>
      {/* Base colour — video na chale tab bhi hero blank na dikhe */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navyDeep }]} pointerEvents="none" />

      {videoFailed ? null : (
        <Video
          ref={videoRef}
          source={require('../../assets/bg-video.mp4')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          muted
          paused={!isFocused || !appActive}
          ignoreSilentSwitch="ignore"
          progressUpdateInterval={1000}
          onError={() => setVideoFailed(true)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}

      {/*
        Scrim + content ek hi wrapper me hain — wrapper in-flow hone ki wajah se
        video ke baad draw hota hai, aur scrim wrapper ke andar first child hai
        (video ke upar, text uske neeche) — ordering hamesha guaranteed.
      */}
      <View style={styles.overlay}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <SvgGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#04131F" stopOpacity="0.6" />
                <Stop offset="0.3" stopColor="#0B2447" stopOpacity="0.2" />
                <Stop offset="0.65" stopColor="#063A4A" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#04131F" stopOpacity="0.85" />
              </SvgGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroScrim)" />
          </Svg>
        </View>

        <View style={styles.content}>
          {/* Eyebrow */}
          <View style={styles.eyebrow}>
            <Icon name="shield-check" size={12} color="#7FE9E1" />
            <Text style={styles.eyebrowText}>24/7 trusted home healthcare</Text>
          </View>

          {/* Emergency block */}
          <View style={styles.sosCard}>
            <View style={styles.sosRow}>
              <View style={styles.sosIcon}>
                <Icon name="ambulance" size={16} color={colors.textInverse} />
              </View>
              <View style={styles.sosInfo}>
                <Text style={styles.sosTitle}>Emergency 24/7</Text>
                <Text style={styles.sosText}>ICU ambulance & critical care — avg. ETA 10 min</Text>
              </View>
              <View style={styles.liveDot}>
                <View style={styles.livePulse} />
              </View>
            </View>

            <View style={styles.sosActions}>
              <AppButton
                label="Launch SOS"
                icon="zap"
                variant="danger"
                size="sm"
                full={false}
                style={styles.sosButton}
                onPress={onSosPress}
              />
              <AppButton
                label="Call Helpline"
                icon="phone"
                variant="outline"
                size="sm"
                full={false}
                style={styles.sosButton}
                onPress={onCallPress}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    /* Side me space + charon taraf rounded. minHeight se video ko lamba
       karne ka control — content (eyebrow + card) uske andar spread hota hai. */
    marginTop: spacing.xs,
    marginHorizontal: spacing.md,
    minHeight: 160,
    overflow: 'hidden',
    borderRadius: radius.xl,
    ...shadow.float,
  },
  /* In-flow wrapper — flex:1 se hero ki minHeight tak stretch hota hai */
  overlay: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    /* Eyebrow upar, Emergency card neeche — beech me video dikhta rehta hai */
    justifyContent: 'space-between',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  eyebrowText: { ...typography.eyebrow, fontSize: 10, color: '#C9F5F1' },
  sosCard: {
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(7,27,54,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing.sm,
  },
  sosRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sosInfo: { flex: 1 },
  sosIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTitle: { ...typography.smallMedium, fontSize: 14, color: colors.textInverse },
  sosText: { ...typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(225,29,72,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger },
  sosActions: { flexDirection: 'row', gap: spacing.sm },
  sosButton: { flex: 1 },
});
