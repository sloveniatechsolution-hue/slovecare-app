/**
 * BookingDetailsModal — booking par "Details" dabane par khulne wala premium
 * details card. Native `Alert.alert()` ki jagah yeh custom modal use hota
 * hai taaki booking ki poori information ek polished, branded card me dikhe:
 * gradient header, service icon, status badge, detail rows (booking ID, date,
 * time, patient, amount, address) aur action buttons.
 *
 * Design `BookingSuccessModal` ko follow karta hai — same theme tokens, same
 * perforation pattern, same entry animation — taaki poori app me visual
 * consistency rahe.
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
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import { AppButton, Badge } from './UI';
import { colors, gradients, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

export interface BookingDetailsInfo {
  serviceName: string;
  providerName?: string;
  serviceIcon?: IconName;
  serviceTypeLabel?: string;
  bookingId: string;
  status: string;
  isDelayed?: boolean;
  delayMinutes?: number;
  date: string;
  time: string;
  patientName: string;
  amount: number;
  address?: string;
}

export interface BookingDetailsCardProps {
  info: BookingDetailsInfo;
  onClose?: () => void;
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

/** Status ke hisaab se badge tone. */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = status.toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'cancelled' || s === 'rejected') return 'danger';
  if (s === 'confirmed' || s === 'in_progress' || s === 'active') return 'info';
  if (s === 'new' || s === 'upcoming' || s === 'pending') return 'warning';
  return 'neutral';
}

/** Ek detail row (label left icon ke saath, value right). */
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
 * Poora card — gradient header (service icon + status) → ticket tear line →
 * details → actions. Alag export isliye hai ki UI bina Modal/backdrop ke
 * test + reuse ho sake.
 */
export function BookingDetailsCard({
  info,
  onClose,
  animatedStyle,
}: BookingDetailsCardProps): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();

  const gradientId = useId().replace(/:/g, '');
  const headerGradientId = `header-${gradientId}`;

  const rows = useMemo(() => {
    const list: { icon: IconName; label: string; value: string }[] = [
      { icon: 'calendar', label: 'Date', value: formatDate(info.date) },
      { icon: 'clock', label: 'Time', value: info.time },
    ];
    if (info.serviceTypeLabel) {
      list.push({ icon: 'briefcase', label: 'Type', value: info.serviceTypeLabel });
    }
    list.push({ icon: 'user', label: 'Patient', value: info.patientName });
    if (info.address) {
      list.push({ icon: 'map-pin', label: 'Address', value: info.address });
    }
    return list;
  }, [info]);

  const paid = info.amount > 0;

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      {/* ------------------------- gradient header ------------------------- */}
      <View style={styles.header}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <SvgGradient id={headerGradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={gradients.ink[0]} />
                <Stop offset="1" stopColor={gradients.ink[1]} />
              </SvgGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${headerGradientId})`} />
          </Svg>
        </View>

        <View style={styles.headerContent}>
          <View style={styles.serviceIconWrap}>
            <Icon name={info.serviceIcon ?? 'stethoscope'} size={28} color={colors.textInverse} />
          </View>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {info.serviceName}
          </Text>
          {info.providerName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {info.providerName}
            </Text>
          ) : null}
          <View style={styles.headerBadges}>
            <Badge
              label={info.status.replace('_', ' ')}
              tone={statusTone(info.status)}
            />
            {info.isDelayed ? (
              <Badge
                label={`Delayed ${info.delayMinutes ?? ''} min`.trim()}
                tone="warning"
                icon="clock"
              />
            ) : null}
          </View>
        </View>
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
        {/* Booking ID strip */}
        <View style={styles.idStrip}>
          <Icon name="id" size={14} color={colors.textMuted} />
          <Text style={typography.caption}>Booking ID</Text>
          <Text style={[typography.smallMedium, styles.idStripValue]} numberOfLines={1}>
            {info.bookingId}
          </Text>
        </View>

        {/* Detail rows */}
        <View style={styles.rowsBlock}>
          {rows.map(row => (
            <DetailRow key={`${row.label}-${row.value}`} icon={row.icon} label={row.label} value={row.value} />
          ))}
        </View>

        {/* Amount */}
        <View style={styles.totalBox}>
          <Text style={typography.small}>Amount</Text>
          <View style={styles.totalRight}>
            <Text style={[typography.price, { color: paid ? colors.success : colors.textMuted }]}>
              {paid ? `₹${info.amount}` : 'FREE'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ----------------------------- actions ----------------------------- */}
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        {onClose ? (
          <AppButton label="Done" icon="check" size="lg" onPress={onClose} />
        ) : null}
      </View>
    </Animated.View>
  );
}

export interface BookingDetailsModalProps extends Omit<BookingDetailsCardProps, 'info'> {
  visible: boolean;
  info: BookingDetailsInfo | null;
}

/**
 * Modal wrapper — dim backdrop (tap = close), card ka fade+slide entry aur
 * Android back button par close.
 */
export default function BookingDetailsModal({
  visible,
  info,
  onClose,
}: BookingDetailsModalProps): React.JSX.Element | null {
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
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        <BookingDetailsCard
          info={info}
          onClose={onClose}
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

  /* ------------------------------- header ------------------------------- */
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  headerContent: {
    alignItems: 'center',
  },
  serviceIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.onDarkChip,
    borderWidth: 1,
    borderColor: colors.onDarkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textInverse,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.onDarkMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  headerBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
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

  /* ------------------------------ actions ------------------------------ */
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
});
