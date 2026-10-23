/**
 * PrescriptionPaywallModal — credits khatam hone par dikhta hai.
 *
 * Sheet me: reason + price (₹19 → 10 reads) + kya milega + Razorpay CTA.
 * Payment `hooks/usePrescriptionPackPurchase` se hoti hai (order → sheet →
 * verify → credits grant).
 */

import React, { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { AppButton } from './UI';
import RazorpayCheckout, { RazorpayCheckoutProps } from './RazorpayCheckout';
import { usePrescriptionCredits } from '../context/PrescriptionCreditsContext';
import { usePrescriptionPackPurchase } from '../hooks/usePrescriptionPackPurchase';
import {
  CREDIT_PACK_PRICE_RUPEES,
  CREDIT_PACK_SIZE,
  FREE_READS_TOTAL,
  pricePerRead,
} from '../utils/prescriptionCredits';
import { colors, radius, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

const INCLUDED = [
  'AI summary of the whole prescription',
  'Medicines, strength, dose & duration',
  'Warnings and safety notes',
  'Photo never stored — deleted after reading',
];

export interface PrescriptionPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  /** User login nahi hai → sign-in screen kholne ke liye. */
  onRequireLogin?: () => void;
  /** Detailed plans screen kholne ke liye (optional). */
  onViewPlans?: () => void;
  onPay?: () => void;
  busy?: boolean;
  error?: string | null;
  clearError?: () => void;
  checkoutProps?: RazorpayCheckoutProps & { visible: boolean };
}

export function PrescriptionPaywallModal({
  visible,
  onClose,
  onRequireLogin,
  onViewPlans,
  onPay,
  busy: externalBusy,
  error: externalError,
  clearError: externalClearError,
  checkoutProps: externalCheckoutProps,
}: PrescriptionPaywallModalProps): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const { credits, serverBacked } = usePrescriptionCredits();
  const internal = usePrescriptionPackPurchase({
    onActivated: onClose,
  });

  const purchase = onPay ?? internal.purchase;
  const busy = externalBusy !== undefined ? externalBusy : internal.busy;
  const error = externalError !== undefined ? externalError : internal.error;
  const clearError = externalClearError ?? internal.clearError;
  const checkoutProps = externalCheckoutProps ?? internal.checkoutProps;

  /* Sheet band karte hi stale error clear. */
  useEffect(() => {
    if (!visible) {
      clearError();
    }
  }, [visible, clearError]);

  /* Free quota khatam hai ya paid pack — copy ke hisaab se alag message. */
  const freeDone = credits.freeUsed >= credits.freeTotal && credits.freeTotal > 0;
  const title = freeDone ? 'Free reads khatam ho gaye' : 'Reads khatam ho gaye';
  const subtitle = freeDone
    ? `Aapke ${FREE_READS_TOTAL} free prescription reads use ho chuke hain.`
    : 'Abhi koi prescription read nahi bacha — ek pack lein aur aage badhein.';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + spacing.lg }]}>
          <View style={styles.handle} />

          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityLabel="Close paywall"
          >
            <Icon name="x" size={18} color={colors.textSecondary} />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.md }}
          >
            {/* ------------------------------ Hero ----------------------------- */}
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Icon name="rupee" size={26} color={colors.textInverse} />
              </View>
              <Text style={[typography.h4, { marginTop: spacing.md, textAlign: 'center' }]}>
                {title}
              </Text>
              <Text style={[typography.small, { marginTop: 4, textAlign: 'center' }]}>
                {subtitle}
              </Text>
            </View>

            {/* ---------------------------- Price strip ------------------------ */}
            <View style={styles.priceStrip}>
              <View style={styles.priceMain}>
                <Text style={[styles.priceValue, { color: colors.text }]}>
                  ₹{CREDIT_PACK_PRICE_RUPEES}
                </Text>
                <Text style={[typography.caption, { marginTop: 2 }]}>one-time payment</Text>
              </View>

              <View style={styles.priceDivider} />

              <View style={styles.priceCell}>
                <Text style={[typography.h4, { color: colors.text }]}>{CREDIT_PACK_SIZE}</Text>
                <Text style={[typography.caption, { marginTop: 2 }]}>prescription reads</Text>
              </View>

              <View style={styles.priceDivider} />

              <View style={styles.priceCell}>
                <Text style={[typography.h4, { color: colors.text }]}>
                  {pricePerRead()}
                </Text>
                <Text style={[typography.caption, { marginTop: 2 }]}>per read</Text>
              </View>
            </View>

            {/* -------------------------- What's included -------------------- */}
            <View style={styles.listBox}>
              {INCLUDED.map(item => (
                <View key={item} style={styles.listRow}>
                  <Icon name="check-circle" size={15} color={colors.success} />
                  <Text style={[typography.small, { flex: 1 }]}>{item}</Text>
                </View>
              ))}
            </View>

            {/* ------------------------------ Error ---------------------------- */}
            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-triangle" size={15} color={colors.danger} />
                <Text style={[typography.small, { flex: 1, color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* ------------------------------- CTA ----------------------------- */}
            {onRequireLogin ? (
              <AppButton
                label="Sign in to continue"
                icon="user"
                size="lg"
                onPress={() => {
                  onClose();
                  onRequireLogin();
                }}
                style={{ marginTop: spacing.md }}
              />
            ) : (
              <AppButton
                label={`Pay ₹${CREDIT_PACK_PRICE_RUPEES} · Get ${CREDIT_PACK_SIZE} Reads`}
                icon="credit-card"
                variant="accent"
                size="lg"
                loading={busy}
                onPress={purchase}
                style={{ marginTop: spacing.md }}
              />
            )}

            {/* ----------------------------- Notes ----------------------------- */}
            <View style={styles.noteRow}>
              <Icon name="lock" size={13} color={colors.textMuted} />
              <Text style={[typography.caption, { flex: 1 }]}>
                Secure payment by Razorpay · UPI, cards & netbanking
              </Text>
            </View>

            {onViewPlans ? (
              <Pressable
                onPress={() => {
                  onClose();
                  onViewPlans();
                }}
                hitSlop={8}
                accessibilityRole="button"
                style={({ pressed }) => [styles.plansLink, pressed && { opacity: 0.7 }]}
              >
                <Text style={[typography.smallMedium, { color: colors.blue }]}>
                  See full plan details
                </Text>
                <Icon name="chevron-right" size={15} color={colors.blue} />
              </Pressable>
            ) : null}
            <Text style={[typography.caption, { textAlign: 'center', marginTop: 4 }]}>
              Credits kabhi expire nahi hote · Jab chahiye tab top up karo
            </Text>
            {!serverBacked ? (
              <Text style={[typography.caption, { textAlign: 'center', marginTop: 6, color: colors.warningText }]}>
                Payments are in final setup — this pack activates instantly on your device.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
      {!externalCheckoutProps ? <RazorpayCheckout {...checkoutProps} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '88%',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  priceMain: { flex: 1.1, alignItems: 'center' },
  priceCell: { flex: 1, alignItems: 'center' },
  priceDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  priceValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 },
  listBox: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  plansLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
});

export default PrescriptionPaywallModal;
