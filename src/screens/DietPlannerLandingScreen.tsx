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

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { AppButton, Card, GradientCard, Loader, Screen } from '../components/UI';
import RazorpayCheckout, { CheckoutOrder } from '../components/RazorpayCheckout';
import api, { DietPlanSubscriptionStatus } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

import { colors, spacing, typography } from '../theme/theme';

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
  const [payError, setPayError] = useState<string | null>(null);
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
    setPayError(null);
    try {
      const order = await api.dietPlans.createPaymentOrder();
      if (!order.requiresPayment) {
        /* Server ne bola payment nahi chahiye (free week / already paid) —
           seedha plan form par jao. */
        setStarting(false);
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
      setPayError((e as Error).message || 'Could not start payment. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  /* ------------------------- payment result ------------------------- */
  const onPaymentResult = async (signature: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    if (!checkout) return;
    setVerifying(true);
    try {
      await api.dietPlans.verifyPayment({
        razorpay_order_id: signature.razorpay_order_id,
        razorpay_payment_id: signature.razorpay_payment_id,
        razorpay_signature: signature.razorpay_signature,
      });
      setCheckout(null);
      setVerifying(false);
      await loadStatus();
      navigation.navigate('DietPlanner');
    } catch (e) {
      setVerifying(false);
      setPayError((e as Error).message || 'Payment verification failed. Please try again.');
    }
  };

  const onPaymentDismiss = () => {
    setCheckout(null);
  };

  const onPaymentError = (message: string) => {
    setPayError(message);
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
              <GradientCard style={styles.heroCard} from={colors.violet} to={colors.primary}>
                <View style={styles.heroIcon}>
                  <Icon name="utensils" size={22} color={colors.textInverse} />
                </View>
                <Text style={styles.heroTitle}>AI Weekly Diet Planner</Text>
                <Text style={styles.heroSub}>
                  Get a personalized 7-day diet plan based on your health goals and food preferences.
                </Text>

                <View style={styles.verifiedRow}>
                  <Icon name="shield-check" size={14} color={colors.textInverse} />
                  <Text style={styles.verifiedText}>Doctor &amp; Gym Trainer Verified</Text>
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
                  style={styles.heroCta}
                />

                <Text style={styles.heroNote}>
                  {isFree
                    ? 'Your first week is completely free!'
                    : `First week free · ₹${price}/week after that`}
                </Text>
              </GradientCard>

              {/* ── Features ── */}
              <Card style={styles.featuresCard}>
                <Text style={typography.h4}>What you get</Text>
                {[
                  { icon: 'calendar' as const, text: 'Updated every week for you' },
                  { icon: 'download' as const, text: 'Downloadable PDF of your plan' },
                  { icon: 'sparkles' as const, text: 'Personalized meals for your goals' },
                  { icon: 'shield-check' as const, text: 'Verified by doctors & gym trainers' },
                ].map(f => (
                  <View key={f.text} style={styles.featureRow}>
                    <View style={styles.featureIcon}>
                      <Icon name={f.icon} size={14} color={colors.primary} />
                    </View>
                    <Text style={[typography.small, { flex: 1 }]}>{f.text}</Text>
                  </View>
                ))}
              </Card>

              {/* ── Pricing ── */}
              <Card style={styles.pricingCard}>
                <Text style={typography.h4}>Simple pricing</Text>
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.smallMedium}>Week 1</Text>
                    <Text style={[typography.h3, { color: colors.success }]}>FREE</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.smallMedium}>Week 2 onwards</Text>
                    <Text style={[typography.h3, { color: colors.text }]}>₹{price}/week</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  One plan per week. Payment is weekly — cancel anytime.
                </Text>
              </Card>

              {/* ── Pay error ── */}
              {payError ? (
                <Card style={[styles.noteCard, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                  <View style={styles.noteRow}>
                    <Icon name="alert-triangle" size={16} color={colors.danger} />
                    <Text style={[typography.small, { flex: 1, color: colors.danger }]}>{payError}</Text>
                  </View>
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      {/* Razorpay checkout */}
      <RazorpayCheckout
        visible={Boolean(checkout)}
        order={checkout ?? { keyId: '', orderId: '', amount: 0, currency: 'INR', amountRupees: 0 }}
        prefill={user ? { name: user.name, email: user.email, contact: user.phone } : undefined}
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
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textInverse,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textInverse,
    opacity: 0.9,
  },
  heroCta: {
    marginTop: spacing.lg,
  },
  heroNote: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  featuresCard: {
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingCard: {
    marginBottom: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  noteCard: { marginBottom: spacing.md, borderColor: colors.border },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  weekPlanCard: { marginBottom: spacing.md },
});
