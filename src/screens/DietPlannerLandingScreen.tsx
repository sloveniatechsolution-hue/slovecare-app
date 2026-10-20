/**
 * AI Weekly Diet Planner — landing / paywall screen.
 *
 * Flow (server-authoritative):
 *   1. Screen khulte hi `subscription-status` se pata chalta hai:
 *      - is hafte ka plan hai?      → sweet message + "View This Week's Plan"
 *      - pehla week hai (free)?     → seedha "Create My Diet Plan"
 *      - paid week hai?             → Razorpay checkout (₹9) → verify → plan
 *   2. Server har decision khud karta hai (free/paid/duplicate) — app
 *      sirf usi ke hisaab se UI dikhata hai.
 *   3. Payment Razorpay se hota hai (existing RazorpayCheckout component).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { AppButton, Card, GradientCard, Loader, Screen } from '../components/UI';
import RazorpayCheckout, { CheckoutOrder } from '../components/RazorpayCheckout';
import api, { ApiError, DietPlanSubscriptionStatus } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

import { colors, gradients, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DietPlannerLanding'>;

export default function DietPlannerLandingScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DietPlanSubscriptionStatus | null>(null);
  const [checkout, setCheckout] = useState<CheckoutOrder | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [starting, setStarting] = useState(false);

  /* ------------------------- status load (server authoritative) ------------------------- */
  const loadStatus = useCallback(async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await api.dietPlans.subscriptionStatus();
      setStatus(next);
    } catch {
      /* Status fetch fail → user ko block mat karo (form pe jaane do,
         server generate par phir se check karega). */
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /* ------------------------- start payment ------------------------- */
  const startPayment = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const order = await api.dietPlans.createPaymentOrder();
      if (!order.requiresPayment) {
        /* Server ne bola payment nahi chahiye (free week / already paid) —
           seedha plan form par jao. */
        await loadStatus();
        navigation.navigate('DietPlanner');
        return;
      }
      setCheckout({
        keyId: order.keyId ?? '',
        orderId: order.orderId ?? '',
        amount: order.amount ?? 0,
        currency: order.currency ?? 'INR',
        amountRupees: order.amountRupees,
      });
    } catch (e) {
      const err = e as ApiError;
      Alert.alert(
        "Payment couldn't start",
        err.message || 'Could not start payment. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  };

  /* ------------------------- payment result ------------------------- */

  /**
   * Backend DOUBLE verification (HMAC + Razorpay API status) — dono server par.
   * Pending signature ref me rakh-te hain taaki retry stale-closure na ho.
   */
  const pendingVerifyRef = useRef<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  } | null>(null);

  const onPaymentResult = async (signature: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    if (!checkout) return;
    pendingVerifyRef.current = signature;
    setVerifying(true);
    try {
      await api.dietPlans.verifyPayment({
        razorpay_order_id: signature.razorpay_order_id,
        razorpay_payment_id: signature.razorpay_payment_id,
        razorpay_signature: signature.razorpay_signature,
      });
      pendingVerifyRef.current = null;
      setCheckout(null);
      setVerifying(false);
      await loadStatus();
      navigation.navigate('DietPlanner');
    } catch (e) {
      setVerifying(false);
      const err = e as ApiError;
      Alert.alert(
        'Payment received — confirmation pending',
        err.message ||
          'We could not confirm your payment just now. You will not be charged again — please retry.',
        [
          { text: 'Retry confirmation', onPress: () => retryVerify() },
          { text: 'Do it later', style: 'cancel' },
        ],
      );
    }
  };

  /** Verify dobara (ref se) — stale-closure safe. */
  const retryVerify = async () => {
    const payload = pendingVerifyRef.current;
    if (!payload) {
      return;
    }
    setVerifying(true);
    try {
      await api.dietPlans.verifyPayment(payload);
      pendingVerifyRef.current = null;
      setCheckout(null);
      setVerifying(false);
      await loadStatus();
      navigation.navigate('DietPlanner');
    } catch (e) {
      setVerifying(false);
      const err = e as ApiError;
      Alert.alert('Still not confirmed', err.message || 'We could not confirm your payment.', [
        { text: 'Retry', onPress: () => retryVerify() },
        {
          text: 'Do it later',
          style: 'cancel',
          onPress: () => {
            pendingVerifyRef.current = null;
          },
        },
      ]);
    }
  };

  const onPaymentDismiss = () => {
    if (verifying) {
      return;
    }
    setCheckout(null);
    Alert.alert('Payment not completed', 'No money was charged. You can complete the payment whenever you are ready.');
  };

  const onPaymentError = (message: string) => {
    setCheckout(null);
    Alert.alert("Payment couldn't start", message);
  };

  /* ------------------------- render ------------------------- */

  if (!isLoggedIn) {
    return (
      <Screen>
        <AppHeader title="AI Weekly Diet Planner" onBack={() => navigation.goBack()} />
        <View style={styles.authBox}>
          <Card>
            <View style={styles.authIcon}>
              <Icon name="utensils" size={26} color={colors.primary} />
            </View>
            <Text style={[typography.h4, { textAlign: 'center', marginTop: spacing.md }]}>
              Sign in to create your diet plan
            </Text>
            <Text style={[typography.small, { textAlign: 'center', marginTop: 4 }]}>
              Your weekly plan is saved privately to your account so you can track meals and revisit past plans.
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <AppButton label="Sign In / Register" onPress={() => navigation.navigate('Auth')} />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  const hasWeekPlan = Boolean(status?.hasPlanThisWeek);
  const price = status?.amountRupees ?? 9;
  const needsPayment = Boolean(status?.requiresPayment);
  const isFree = Boolean(status?.isFreeWeek);

  return (
    <Screen>
      <AppHeader title="AI Weekly Diet Planner" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.loaderBox}>
          <Loader label="Checking your plan status…" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Sweet message: is week ka plan pehle se hai ── */}
          {hasWeekPlan ? (
            <Card style={styles.weekPlanCard}>
              <View style={styles.noteRow}>
                <Icon name="calendar" size={18} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.h4, { fontSize: 15 }]}>You already have this week's plan ready!</Text>
                  <Text style={[typography.small, { marginTop: 4 }]}>
                    You have already created a diet plan for this week. Please wait for next week to generate a new
                    one. You can view or export your current plan below.
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <AppButton
                  label="View This Week's Plan"
                  icon="calendar"
                  variant="accent"
                  onPress={() =>
                    status?.planId
                      ? navigation.navigate('DietPlanResult', { planId: status.planId })
                      : navigation.navigate('DietPlanResult', {})
                  }
                />
              </View>
            </Card>
          ) : (
            <>
              {/* ── Hero gradient card ── */}
              <GradientCard style={styles.heroCard} from={gradients.diet[0]} to={gradients.diet[1]}>
                {/* decorative glow blobs */}
                <View style={styles.blobLarge} pointerEvents="none" />
                <View style={styles.blobSmall} pointerEvents="none" />

                <View style={styles.heroTopRow}>
                  <View style={styles.heroIcon}>
                    <Icon name="utensils" size={24} color={colors.textInverse} />
                  </View>
                  <View style={styles.heroChip}>
                    <Icon name="sparkles" size={11} color={colors.textInverse} />
                    <Text style={styles.heroChipText}>AI-POWERED</Text>
                  </View>
                </View>

                <Text style={styles.heroTitle}>{'AI Weekly\nDiet Planner'}</Text>
                <Text style={styles.heroSub}>
                  A personalized 7-day diet plan built around your health goals, routine and food
                  preferences.
                </Text>

                <View style={styles.heroChipsRow}>
                  <View style={styles.glassChip}>
                    <Icon name="shield-check" size={12} color={colors.textInverse} />
                    <Text style={styles.glassChipText}>Doctor verified</Text>
                  </View>
                  <View style={styles.glassChip}>
                    <Icon name="award" size={12} color={colors.textInverse} />
                    <Text style={styles.glassChipText}>Trainer approved</Text>
                  </View>
                  <View style={styles.glassChip}>
                    <Icon name="leaf" size={12} color={colors.textInverse} />
                    <Text style={styles.glassChipText}>7-day plan</Text>
                  </View>
                </View>

                <AppButton
                  label={needsPayment ? `Unlock My Plan · ₹${price}` : 'Create My Diet Plan'}
                  icon="sparkles"
                  variant="accent"
                  size="lg"
                  loading={starting}
                  disabled={starting}
                  onPress={() => {
                    if (needsPayment) {
                      startPayment();
                    } else {
                      navigation.navigate('DietPlanner');
                    }
                  }}
                  style={[styles.heroCta, shadow.glow]}
                />

                <View style={styles.heroNoteRow}>
                  <Icon name="rupee" size={12} color={colors.textInverse} />
                  <Text style={styles.heroNote}>
                    {isFree
                      ? 'Your first week is completely free!'
                      : `First week free · ₹${price}/week after that`}
                  </Text>
                </View>
              </GradientCard>

              {/* ── What you get ── */}
              <Card style={styles.sectionCard}>
                <Text style={[typography.eyebrow, { marginBottom: 4 }]}>Included</Text>
                <Text style={typography.h4}>What you get</Text>
                {[
                  {
                    icon: 'calendar' as const,
                    bg: colors.infoLight,
                    fg: colors.blue,
                    title: 'Refreshed every week',
                    sub: 'A new plan is ready for you each week.',
                  },
                  {
                    icon: 'download' as const,
                    bg: colors.primaryLight,
                    fg: colors.primary,
                    title: 'Downloadable PDF',
                    sub: 'Export your plan and follow it offline.',
                  },
                  {
                    icon: 'sparkles' as const,
                    bg: colors.violetSoft,
                    fg: colors.violet,
                    title: 'Personalized meals',
                    sub: 'Built around your goals and preferences.',
                  },
                  {
                    icon: 'shield-check' as const,
                    bg: colors.successLight,
                    fg: colors.success,
                    title: 'Expert verified',
                    sub: 'By doctors & gym trainers.',
                  },
                ].map(f => (
                  <View key={f.title} style={styles.featureRow}>
                    <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                      <Icon name={f.icon} size={17} color={f.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.smallMedium}>{f.title}</Text>
                      <Text style={[typography.caption, { marginTop: 1 }]}>{f.sub}</Text>
                    </View>
                  </View>
                ))}
              </Card>

              {/* ── How it works ── */}
              <Card style={styles.sectionCard}>
                <Text style={[typography.eyebrow, { marginBottom: 4 }]}>Process</Text>
                <Text style={typography.h4}>How it works</Text>
                {[
                  { n: '1', title: 'Share your details', sub: 'A few quick questions about your body and routine.' },
                  { n: '2', title: 'AI builds your plan', sub: 'A nutritionist-style plan is generated for your week.' },
                  { n: '3', title: 'Follow & download', sub: 'Use the plan all week and export it as a PDF.' },
                ].map(s => (
                  <View key={s.n} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{s.n}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.smallMedium}>{s.title}</Text>
                      <Text style={[typography.caption, { marginTop: 1 }]}>{s.sub}</Text>
                    </View>
                  </View>
                ))}
              </Card>

              {/* ── Pricing ── */}
              <Card style={styles.sectionCard}>
                <Text style={[typography.eyebrow, { marginBottom: 4 }]}>Pricing</Text>
                <Text style={typography.h4}>Simple pricing</Text>
                <View style={styles.priceRow}>
                  <View
                    style={[styles.priceTile, { backgroundColor: colors.successLight, borderColor: 'transparent' }]}
                  >
                    <Text style={typography.caption}>Week 1</Text>
                    <Text style={[styles.priceTileValue, { color: colors.success }]}>FREE</Text>
                    <Text style={styles.priceTileNote}>Full 7-day plan</Text>
                  </View>
                  <View style={styles.priceTile}>
                    <Text style={typography.caption}>Week 2 onwards</Text>
                    <Text style={styles.priceTileValue}>
                      ₹{price}
                      <Text style={styles.priceUnit}>/week</Text>
                    </Text>
                    <Text style={styles.priceTileNote}>Weekly · cancel anytime</Text>
                  </View>
                </View>
                <View style={styles.priceFootRow}>
                  <Icon name="check-circle" size={14} color={colors.success} />
                  <Text style={[typography.caption, { flex: 1 }]}>
                    One plan per week. Payment is weekly — cancel anytime.
                  </Text>
                </View>
              </Card>
            </>
          )}
        </ScrollView>
      )}

      {/* Razorpay checkout */}
      <RazorpayCheckout
        visible={Boolean(checkout)}
        order={checkout ?? { keyId: '', orderId: '', amount: 0, currency: 'INR', amountRupees: 0 }}
        prefill={user ? { name: user.name, email: user.email, contact: user.phone } : undefined}
        description="Weekly Diet Plan"
        verifying={verifying}
        onResult={onPaymentResult}
        onDismiss={onPaymentDismiss}
        onError={onPaymentError}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loaderBox: { padding: spacing.lg },
  authBox: { padding: spacing.lg },
  authIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  heroCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  /* Decorative glow blobs — gradient card ke peeche soft light. */
  blobLarge: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  blobSmall: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  heroChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textInverse,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.textInverse,
    letterSpacing: -0.8,
  },
  heroSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
  },
  /* Glass chips row — "Doctor verified / Trainer approved / 7-day plan". */
  heroChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.md,
  },
  glassChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  glassChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
  },
  heroCta: {
    marginTop: spacing.lg,
  },
  heroNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: spacing.md,
  },
  heroNote: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.75)',
  },
  /* ── Premium sections (features / how-it-works / pricing) ── */
  sectionCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  priceRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  priceTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.cardMuted,
  },
  priceTileValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 2,
  },
  priceTileNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  priceUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  priceFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  weekPlanCard: { marginBottom: spacing.md },
});
