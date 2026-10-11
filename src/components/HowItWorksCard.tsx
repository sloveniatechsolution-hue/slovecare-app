/**
 * HowItWorksCard — "How SloveCare Works" ka collapsible dropdown.
 *
 * Pehle yeh section hamesha khula rehta tha aur home screen me bahut jagah
 * kha jaata tha. Ab sirf ek compact light card dikhta hai; tap par
 * animated height ke saath 4-step flow khulta hai (timeline layout).
 *
 * - Chevron 180° rotate hota hai
 * - Har step stagger (ek ke baad ek) fade + slide + scale se aata hai
 * - Content ki height onLayout se measure hoti hai, phir Animated se
 *   0 → measured height animate hoti hai (JS driver — height native nahi ho sakti)
 */

import React, { useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon, { IconName } from './Icon';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

type Step = { no: string; icon: IconName; title: string; text: string };

const STEPS: Step[] = [
  { no: '01', icon: 'calendar', title: 'Book Appointment', text: 'Pick a doctor, nurse or lab test in seconds.' },
  { no: '02', icon: 'home', title: 'Professional Arrives', text: 'Certified staff reaches your door with equipment.' },
  { no: '03', icon: 'stethoscope', title: 'Treatment & Care', text: 'Checkup, sample pickup or emergency support.' },
  { no: '04', icon: 'file-text', title: 'Digital Report', text: 'Prescription & reports on your phone instantly.' },
];

/* Stagger + reveal timings */
const OPEN_MS = 320;
const CLOSE_MS = 220;
const STEP_MS = 300;
const STEP_DELAY = 90;

export default function HowItWorksCard({
  title = 'How SloveCare Works',
  subtitle = '4 quick steps to doorstep care',
}: {
  title?: string;
  subtitle?: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  /** Collapse/expand progress — height, opacity aur chevron rotation isi se. */
  const progress = useRef(new Animated.Value(0)).current;
  /** Har step ka apna reveal value — stagger ke liye. */
  const stepAnims = useRef(STEPS.map(() => new Animated.Value(0))).current;
  /** onLayout ke andar latest `open` chahiye (stale closure se bachne ko). */
  const openRef = useRef(open);
  openRef.current = open;

  const toggle = () => {
    const next = !open;
    setOpen(next);

    Animated.timing(progress, {
      toValue: next ? 1 : 0,
      duration: next ? OPEN_MS : CLOSE_MS,
      easing: next ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false, /* height animate ho rahi hai — JS driver */
    }).start();

    if (next) {
      /* Open: steps ek ke baad ek pop in */
      Animated.parallel(
        stepAnims.map((anim, i) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: STEP_MS,
            delay: 60 + i * STEP_DELAY,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ),
      ).start();
    } else {
      /* Close: sab ek saath fade out — height collapse ke saath saaf */
      Animated.parallel(
        stepAnims.map(anim =>
          Animated.timing(anim, { toValue: 0, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
        ),
      ).start();
    }
  };

  const onBodyLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - contentHeight) > 0.5) {
      setContentHeight(h);
      /* Pehli measurement open hone ke baad aayi (race) — seedha final state. */
      if (openRef.current) progress.setValue(1);
    }
  };

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const bodyHeight = contentHeight ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] }) : 0;

  return (
    <View>
      {/* -------------------------- Dropdown header ------------------------- */}
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title} — ${open ? 'collapse' : 'expand'} flow`}
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Icon name="activity" size={16} color={colors.primary} />
            </View>
            <View style={styles.headerTexts}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <Animated.View style={[styles.chevronChip, { transform: [{ rotate }] }]}>
              <Icon name="chevron-down" size={14} color={colors.textMuted} />
            </Animated.View>
          </View>
        </View>
      </Pressable>

      {/* -------------------- Animated flow (dropdown body) ----------------- */}
      <Animated.View style={[styles.body, { height: bodyHeight, opacity: progress }]}>
        <View onLayout={onBodyLayout} style={styles.bodyInner}>
          {STEPS.map((step, i) => {
            const s = stepAnims[i];
            return (
              <Animated.View
                key={step.no}
                style={[
                  styles.timelineRow,
                  {
                    opacity: s,
                    transform: [
                      { translateY: s.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                      { scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
                    ],
                  },
                ]}
              >
                {/* Rail — numbered node + agle node tak jodne wali line */}
                <View style={styles.rail}>
                  <View style={styles.node}>
                    <Icon name={step.icon} size={15} color={colors.blue} />
                  </View>
                  {i < STEPS.length - 1 ? <View style={styles.railLine} /> : null}
                </View>

                <View style={styles.stepText}>
                  <View style={styles.stepHeadRow}>
                    <Text style={styles.stepTitle} numberOfLines={1}>
                      {step.title}
                    </Text>
                    <Text style={styles.stepNo}>{step.no}</Text>
                  </View>
                  <Text style={styles.stepDesc}>{step.text}</Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const HEADER_ICON_SIZE = 30;
const NODE_SIZE = 30;

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  headerIcon: {
    width: HEADER_ICON_SIZE,
    height: HEADER_ICON_SIZE,
    borderRadius: HEADER_ICON_SIZE / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: { flex: 1, gap: 0 },
  headerTitle: { ...typography.smallMedium, fontSize: 13.5, letterSpacing: -0.2, color: colors.text },
  headerSub: { ...typography.caption, fontSize: 10.5, color: colors.textMuted },
  chevronChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Body — measured height + overflow hidden se collapse animation banti hai */
  body: { overflow: 'hidden' },
  bodyInner: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
    padding: spacing.sm,
    gap: spacing.sm,
    ...shadow.card,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  rail: {
    width: NODE_SIZE,
    alignItems: 'center',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: colors.infoLight,
    borderWidth: 1.5,
    borderColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Agle node tak line — row gap ko bridge karne ke liye negative bottom */
  railLine: {
    position: 'absolute',
    left: NODE_SIZE / 2 - 1,
    top: NODE_SIZE + 4,
    bottom: -spacing.sm,
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.blue,
    opacity: 0.25,
  },
  stepText: { flex: 1, justifyContent: 'center', paddingBottom: 1 },
  stepHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepTitle: { ...typography.smallMedium, flex: 1 },
  stepNo: { ...typography.price, fontSize: 13, color: colors.textMuted, opacity: 0.5 },
  stepDesc: { ...typography.caption, fontSize: 10.5, lineHeight: 15, marginTop: 1 },
});
