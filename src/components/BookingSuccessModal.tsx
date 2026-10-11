/**
 * BookingSuccessModal — booking/payment confirm hone par dikhne wala premium
 * "booking pass" card. Native `Alert` ki jagah yeh modal use hota hai, taaki
 * confirmation ek proper card jaisa lage: animated green tick, ticket-style
 * ribbon aur poori booking ki details date/time/amount ke saath.
 *
 * Do hisse:
 *  - `BookingSuccessCard` — poora visual (ribbon + details + actions).
 *  - `BookingSuccessModal` (default) — backdrop + entry animation + Modal.
 *
 * Dono booking screens (BookingScreen + ConsultationBookScreen) isi ek
 * component se apna success card dikhate hain — UI uniform rehta hai.
 */

import React, { useEffect, useId, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import { AppButton, Badge } from './UI';
import { colors, gradients, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

export interface BookingSuccessInfo {
  /** Ribbon ka bada heading — default 'Booking Confirmed'. */
  title?: string;
  /** Ribbon ke neeche ki ek line (payment/appointment ka status). */
  message?: string;
  serviceName: string;
  /** Doctor / lab / provider ka naam (+ specialization). */
  providerName?: string;
  /** Service ke hisaab se icon (doctor → stethoscope, lab → flask …). */
  serviceIcon?: IconName;
  /** 'Home Visit' | 'Video Consultation' | 'Home Sample Collection' … */
  serviceTypeLabel?: string;
  patientName?: string;
  patientPhone?: string;
  /** 'YYYY-MM-DD' */
  date: string;
  timeSlot: string;
  durationMinutes?: number;
  /** Seedha rupees (0 = free booking). */
  amount: number;
  bookingId?: string;
}

export interface BookingSuccessCardProps {
  info: BookingSuccessInfo;
  /** Primary CTA — mostly "View Appointments". */
  onPrimary?: () => void;
  /** Secondary CTA — mostly home par wapas. */
  onSecondary?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
  /** Modal se aane wala entry animation (opacity + transform). */
  animatedStyle?: Animated.WithAnimatedValue<ViewStyle>;
}

/** 'YYYY-MM-DD' → 'Mon, 12 Jan 2026'. Invalid date par wapas wahi string. */
function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Ek detail row (label left ikon ke saath, value right). */
function DetailRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabel}>
        <Icon name={icon} size={14} color={colors.textMuted} />
        <Text style={typography.small}>{label}</Text>
      </View>
      <Text style={[typography.smallMedium, styles.detailValue]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Poora card — ribbon (animated tick) → ticket tear line → details → actions.
 * Alag export isliye hai ki UI bina Modal/backdrop ke test + reuse ho sake.
 */
export function BookingSuccessCard({
  info,
  onPrimary,
  onSecondary,
  primaryLabel = 'View Appointments',
  secondaryLabel = 'Back to Home',
  animatedStyle,
}: BookingSuccessCardProps): React.JSX.Element {
  /* Theme subscription — colours dynamic getters se aati hain. */
  useThemePreference();
  const insets = useSafeAreaInsets();

  /* Har instance ka apna SVG gradient id — do card ek saath hon to bhi safe. */
  const gradientId = useId().replace(/:/g, '');
  const ribbonGradientId = `ribbon-${gradientId}`;
  const tickGradientId = `tick-${gradientId}`;

  const tickAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  /* Mount hote hi: tick "pop" + glow ring ka halka breathe loop. */
  useEffect(() => {
    const tick = Animated.spring(tickAnim, {
      toValue: 1,
      delay: 120,
      friction: 5,
      tension: 130,
      useNativeDriver: true,
    });
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    tick.start();
    pulse.start();
    return () => {
      tick.stop();
      pulse.stop();
    };
  }, [tickAnim, pulseAnim]);

  const rows = useMemo(() => {
    const list: { icon: IconName; label: string; value: string }[] = [
      { icon: 'calendar', label: 'Date', value: formatDate(info.date) },
      { icon: 'clock', label: 'Time', value: info.timeSlot },
    ];
    if (info.durationMinutes) {
      list.push({ icon: 'clock', label: 'Duration', value: `${info.durationMinutes} min` });
    }
    if (info.serviceTypeLabel) {
      list.push({ icon: 'briefcase', label: 'Type', value: info.serviceTypeLabel });
    }
    if (info.patientName) {
      list.push({ icon: 'user', label: 'Patient', value: info.patientName });
    }
    if (info.patientPhone) {
      list.push({ icon: 'phone', label: 'Contact', value: info.patientPhone });
    }
    return list;
  }, [info]);

  const paid = info.amount > 0;
  const title = info.title ?? 'Booking Confirmed';

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      {/* ------------------------- ticket ribbon (ink) ------------------------- */}
      <View style={styles.ribbon}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <SvgGradient id={ribbonGradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={gradients.ink[0]} />
                <Stop offset="1" stopColor={gradients.ink[1]} />
              </SvgGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${ribbonGradientId})`} />
          </Svg>
        </View>

        {/* Animated tick badge */}
        <View style={styles.tickWrap}>
          <Animated.View
            style={[
              styles.tickGlow,
              {
                opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                transform: [
                  { scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.tickCircle,
              {
                opacity: tickAnim,
                transform: [
                  { scale: tickAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                ],
              },
            ]}
          >
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGradient id={tickGradientId} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.accent} />
                  <Stop offset="1" stopColor={colors.primary} />
                </SvgGradient>
              </Defs>
              <Circle cx="34" cy="34" r="34" fill={`url(#${tickGradientId})`} />
            </Svg>
            <Icon name="check" size={34} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        </View>

        <View style={styles.paidPill}>
          <Icon name="shield-check" size={12} color={colors.textInverse} />
          <Text style={styles.paidPillText}>Payment Verified</Text>
        </View>
        <Text style={styles.ribbonTitle}>{title}</Text>
        <Text style={styles.ribbonMessage}>
          {info.message ??
            'Your payment was received and your appointment is confirmed. You can track it under Appointments.'}
        </Text>
      </View>

      {/* Ticket punch notches + dashed tear line */}
      <View style={styles.perforation}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      {/* ----------------------------- details ----------------------------- */}
      <ScrollView
        style={styles.details}
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Service summary */}
        <View style={styles.serviceRow}>
          <View style={styles.serviceIcon}>
            <Icon name={info.serviceIcon ?? 'stethoscope'} size={22} color={colors.primary} />
          </View>
          <View style={styles.serviceText}>
            <Text style={typography.h4} numberOfLines={2}>
              {info.serviceName}
            </Text>
            {info.providerName ? (
              <Text style={typography.caption} numberOfLines={2}>
                {info.providerName}
              </Text>
            ) : null}
          </View>
          <Badge label={paid ? 'Paid' : 'Free'} tone="success" icon={paid ? 'check' : 'shield-check'} />
        </View>

        <View style={styles.rowsBlock}>
          {rows.map(row => (
            <DetailRow key={`${row.label}-${row.value}`} icon={row.icon} label={row.label} value={row.value} />
          ))}
        </View>

        {/* Amount */}
        <View style={styles.totalBox}>
          <Text style={typography.small}>{paid ? 'Amount paid' : 'Amount'}</Text>
          <View style={styles.totalRight}>
            <Text style={[typography.price, { color: colors.success }]}>
              {paid ? `₹${info.amount}` : 'FREE'}
            </Text>
            {paid ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>via Razorpay</Text>
            ) : null}
          </View>
        </View>

        {info.bookingId ? (
          <View style={styles.idStrip}>
            <Icon name="id" size={14} color={colors.textMuted} />
            <Text style={typography.caption}>Booking ID</Text>
            <Text style={[typography.smallMedium, styles.idStripValue]} numberOfLines={1}>
              {info.bookingId}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ----------------------------- actions ----------------------------- */}
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <AppButton label={primaryLabel} icon="calendar" size="lg" onPress={onPrimary} />
        {onSecondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSecondary}
            hitSlop={8}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
          >
            <Icon name="home" size={15} color={colors.blue} />
            <Text style={[typography.smallMedium, { color: colors.blue }]}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

export interface BookingSuccessModalProps extends Omit<BookingSuccessCardProps, 'info'> {
  visible: boolean;
  info: BookingSuccessInfo | null;
}

/**
 * Modal wrapper — dim backdrop (tap = secondary action), card ka fade+slide
 * entry aur Android back button par wahi secondary action.
 */
export default function BookingSuccessModal({
  visible,
  info,
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel,
}: BookingSuccessModalProps): React.JSX.Element | null {
  useThemePreference();
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      backdropAnim.setValue(0);
      cardAnim.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, backdropAnim, cardAnim]);

  if (!visible || !info) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onSecondary}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onSecondary} />
        <BookingSuccessCard
          info={info}
          onPrimary={onPrimary}
          onSecondary={onSecondary}
          primaryLabel={primaryLabel}
          secondaryLabel={secondaryLabel}
          animatedStyle={{
            opacity: cardAnim,
            transform: [
              { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
              { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.float,
  },

  /* ------------------------------- ribbon ------------------------------- */
  ribbon: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  tickWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  tickCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  tickGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accent,
  },
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.md,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.onDarkChip,
    borderWidth: 1,
    borderColor: colors.onDarkBorder,
  },
  paidPillText: {
    ...typography.caption,
    color: colors.textInverse,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  ribbonTitle: {
    ...typography.h2,
    color: colors.textInverse,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  ribbonMessage: {
    ...typography.small,
    color: colors.onDarkMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },

  /* ---------------------------- perforation ---------------------------- */
  perforation: {
    height: 0,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  notch: {
    position: 'absolute',
    top: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.overlay,
  },
  notchLeft: { left: -11 },
  notchRight: { right: -11 },

  /* ------------------------------ details ------------------------------ */
  details: { flexShrink: 1, flexGrow: 0, maxHeight: 380 },
  detailsContent: { padding: spacing.lg, gap: spacing.md },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceText: { flex: 1 },
  rowsBlock: {
    backgroundColor: colors.cardMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailValue: { flexShrink: 1, textAlign: 'right' },
  totalBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  totalRight: { alignItems: 'flex-end' },
  idStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  idStripValue: { flex: 1, textAlign: 'right' },

  /* ------------------------------ actions ------------------------------ */
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.md,
  },
});
