/**
 * Prescription Reader Plans — pricing + paywall screen.
 *
 * Rules (spec):
 *   • First 3 prescription reads are FREE (for every user).
 *   • After that, a pack of 10 reads for ₹19 (repeatable — top up anytime).
 *   • Credits never expire; 1 read = 1 prescription.
 *
 * This screen shows the user:
 *   - their balance (how many reads are left),
 *   - plan comparison (Free vs Read pack),
 *   - what each read includes,
 *   - payment (Razorpay).
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import PrescriptionCreditsCard from '../components/PrescriptionCreditsCard';
import RazorpayCheckout from '../components/RazorpayCheckout';
import { AppButton, Card, GradientCard, Screen } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { usePrescriptionCredits } from '../context/PrescriptionCreditsContext';
import { usePrescriptionPackPurchase } from '../hooks/usePrescriptionPackPurchase';
import { RootStackParamList } from '../navigation/types';
import {
  CREDIT_PACK_PRICE_RUPEES,
  CREDIT_PACK_SIZE,
  FREE_READS_TOTAL,
  pricePerRead,
} from '../utils/prescriptionCredits';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PrescriptionReaderPlans'>;

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'sparkles',
    title: 'Plain-English summary',
    text: 'A simple summary of the full prescription — in plain language.',
  },
  {
    icon: 'pill',
    title: 'Medicine details',
    text: 'Name, strength, dose, frequency, duration and instructions.',
  },
  {
    icon: 'alert-triangle',
    title: 'Warnings & safety',
    text: 'Interactions and cautions — things doctors may forget to mention.',
  },
  {
    icon: 'eye-off',
    title: 'Fully private',
    text: 'Your photo is never stored — deleted right after the read.',
  },
];

const STEPS = [
  { icon: 'camera' as IconName, title: 'Take a photo', text: 'Take a clear photo of the prescription or upload from your gallery.' },
  { icon: 'zap' as IconName, title: 'AI reads it', text: 'PaddleOCR extracts the text, Gemini makes sense of it.' },
  { icon: 'file-text' as IconName, title: 'Understand it', text: 'Medicines, doses and warnings — all in one place.' },
];

const FAQ = [
  {
    q: 'What happens when my free reads run out?',
    a: 'You buy the ₹19 10-read pack once and can then read 10 more prescriptions. When credits run out, you can buy the same pack again.',
  },
  {
    q: 'Do credits expire?',
    a: 'No. You can buy a pack whenever you like — credits have no expiry date.',
  },
  {
    q: 'How many prescriptions does one read cover?',
    a: 'One read = full AI analysis of one prescription photo (OCR + summary + medicine details).',
  },
  {
    q: 'Is payment secure?',
    a: "Yes — payment happens in Razorpay's secure checkout sheet. Card, UPI and netbanking are all supported.",
  },
];

export default function PrescriptionReaderPlansScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const { remaining, serverBacked } = usePrescriptionCredits();

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [justBought, setJustBought] = useState(false);

  const { purchase, checkoutProps, busy, error, clearError } = usePrescriptionPackPurchase({
    onActivated: () => setJustBought(true),
  });

  const onPay = () => {
    if (!isLoggedIn) {
      navigation.navigate('Auth');
      return;
    }
    clearError();
    setJustBought(false);
    purchase();
  };

  return (
    <Screen>
      <AppHeader
        title="Prescription Reader Plans"
        subtitle="3 free reads · then ₹19 for 10 reads"
        onBack={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + 108,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------- Hero ------------------------------ */}
        <GradientCard from={colors.blue} to={colors.primary} style={[styles.hero, shadow.float]}>
          <View style={styles.heroIcon}>
            <Icon name="file-text" size={22} color={colors.textInverse} />
          </View>
          <Text style={styles.heroTitle}>Understand your prescription</Text>
          <Text style={styles.heroSub}>
            Take one photo — AI will explain the medicines, doses, duration and warnings in simple language.
          </Text>

          <View style={styles.heroPriceRow}>
            <View>
              <Text style={styles.heroPrice}>₹{CREDIT_PACK_PRICE_RUPEES}</Text>
              <Text style={styles.heroPriceSub}>one-time</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroPrice}>{CREDIT_PACK_SIZE}</Text>
              <Text style={styles.heroPriceSub}>prescription reads</Text>
            </View>
            <View style={styles.heroDivider} />
            <View>
              <Text style={styles.heroPrice}>{pricePerRead()}</Text>
              <Text style={styles.heroPriceSub}>per read</Text>
            </View>
          </View>

          <AppButton
            label={`Get ${CREDIT_PACK_SIZE} Reads · ₹${CREDIT_PACK_PRICE_RUPEES}`}
            icon="credit-card"
            variant="accent"
            size="lg"
            loading={busy}
            onPress={onPay}
            style={{ marginTop: spacing.lg }}
          />
          <Text style={styles.heroNote}>
            {FREE_READS_TOTAL} free reads are already included for every user
          </Text>
        </GradientCard>

        {/* --------------------------- Balance card -------------------------- */}
        <PrescriptionCreditsCard onUpgrade={() => setJustBought(false)} />

        {/* ------------------------------ Error ----------------------------- */}
        {error ? (
          <Card style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Icon name="alert-triangle" size={16} color={colors.danger} />
              <Text style={[typography.small, { flex: 1, color: colors.danger }]}>{error}</Text>
              <Pressable onPress={clearError} hitSlop={8} accessibilityLabel="Dismiss error">
                <Icon name="x" size={16} color={colors.danger} />
              </Pressable>
            </View>
          </Card>
        ) : null}

        {justBought ? (
          <Card style={styles.successCard}>
            <View style={styles.successRow}>
              <Icon name="check-circle" size={20} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.h4, { fontSize: 15 }]}>
                  {CREDIT_PACK_SIZE} reads added!
                </Text>
                <Text style={[typography.small, { marginTop: 2 }]}>
                  You can now read {remaining} more prescriptions — head back to the reader.
                </Text>
              </View>
            </View>
            <AppButton
              label="Read a prescription"
              icon="file-text"
              variant="primary"
              size="sm"
              onPress={() => navigation.navigate('PrescriptionReader')}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : null}

        {/* --------------------------- Plan comparison ----------------------- */}
        <View>
          <Text style={typography.h3}>Simple pricing</Text>
          <Text style={[typography.caption, { marginTop: 2 }]}>
            No subscription, no hidden charges.
          </Text>

          <View style={styles.planRow}>
            <Card style={[styles.planCard, styles.planFree]}>
              <Text style={typography.smallMedium}>Free plan</Text>
              <Text style={[styles.planPrice, { color: colors.text }]}>₹0</Text>
              <Text style={[typography.caption, { marginBottom: spacing.sm }]}>
                {FREE_READS_TOTAL} prescription reads
              </Text>
              <View style={styles.planBullet}>
                <Icon name="check" size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { flex: 1 }]}>Full AI analysis</Text>
              </View>
              <View style={styles.planBullet}>
                <Icon name="check" size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { flex: 1 }]}>Medicine + warning details</Text>
              </View>
              <View style={styles.planBullet}>
                <Icon name="check" size={14} color={colors.textSecondary} />
                <Text style={[typography.caption, { flex: 1 }]}>One time — lifetime</Text>
              </View>
            </Card>

            <Card style={[styles.planCard, styles.planPaid]}>
              <View style={styles.popularTag}>
                <Text style={styles.popularText}>POPULAR</Text>
              </View>
              <Text style={typography.smallMedium}>Read pack</Text>
              <Text style={[styles.planPrice, { color: colors.accent }]}>
                ₹{CREDIT_PACK_PRICE_RUPEES}
              </Text>
              <Text style={[typography.caption, { marginBottom: spacing.sm }]}>
                {CREDIT_PACK_SIZE} prescription reads
              </Text>
              <View style={styles.planBullet}>
                <Icon name="check" size={14} color={colors.accent} />
                <Text style={[typography.caption, { flex: 1 }]}>Only {pricePerRead()} per read</Text>
              </View>
              <View style={styles.planBullet}>
                <Icon name="check" size={14} color={colors.accent} />
                <Text style={[typography.caption, { flex: 1 }]}>Credits never expire</Text>
              </View>
              <View style={styles.planBullet}>
                <Icon name="check" size={14} color={colors.accent} />
                <Text style={[typography.caption, { flex: 1 }]}>Top up anytime</Text>
              </View>
            </Card>
          </View>
        </View>

        {/* ----------------------------- Features ---------------------------- */}
        <Card>
          <Text style={typography.h4}>What you get with every read</Text>
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {FEATURES.map(feature => (
              <View key={feature.title} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Icon name={feature.icon} size={15} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.smallMedium, { color: colors.text }]}>{feature.title}</Text>
                  <Text style={[typography.caption, { marginTop: 1 }]}>{feature.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* --------------------------- How it works -------------------------- */}
        <Card>
          <Text style={typography.h4}>How it works</Text>
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {STEPS.map((step, index) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.stepIcon}>
                  <Icon name={step.icon} size={15} color={colors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.smallMedium, { color: colors.text }]}>
                    {index + 1}. {step.title}
                  </Text>
                  <Text style={[typography.caption, { marginTop: 1 }]}>{step.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* -------------------------------- FAQ ------------------------------ */}
        <Card>
          <Text style={typography.h4}>FAQ</Text>
          <View style={{ marginTop: spacing.sm }}>
            {FAQ.map((item, index) => {
              const open = openFaq === index;
              return (
                <Pressable
                  key={item.q}
                  onPress={() => setOpenFaq(open ? null : index)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  style={styles.faqRow}
                >
                  <View style={styles.faqHead}>
                    <Text style={[typography.smallMedium, { flex: 1, color: colors.text }]}>
                      {item.q}
                    </Text>
                    <Icon
                      name={open ? 'chevron-down' : 'chevron-right'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </View>
                  {open ? <Text style={[typography.small, { marginTop: 6 }]}>{item.a}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* ------------------------------ Trust ------------------------------ */}
        <View style={styles.trustRow}>
          <Icon name="shield-check" size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { flex: 1 }]}>
            Photos are never stored · Medical disclaimer with every summary
          </Text>
        </View>

        {!serverBacked ? (
          <View style={styles.devNote}>
            <Icon name="info" size={14} color={colors.warningText} />
            <Text style={[typography.caption, { flex: 1, color: colors.warningText }]}>
              Payments are in final setup — packs activate instantly on this device for now.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ------------------------- Sticky bottom CTA ----------------------- */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h4, { color: colors.text }]}>₹{CREDIT_PACK_PRICE_RUPEES}</Text>
          <Text style={typography.caption}>
            {CREDIT_PACK_SIZE} reads · {pricePerRead()} per read
          </Text>
        </View>
        <AppButton
          label={isLoggedIn ? `Get ${CREDIT_PACK_SIZE} Reads` : 'Sign in to buy'}
          icon="credit-card"
          variant="accent"
          size="md"
          loading={busy}
          onPress={onPay}
          style={{ flex: 1.2 }}
        />
      </View>

      {/* ---------------------------- Razorpay sheet ------------------------ */}
      <RazorpayCheckout {...checkoutProps} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.textInverse,
    letterSpacing: -0.5,
    marginTop: spacing.md,
  },
  heroSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.sm,
  },
  heroPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  heroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  heroPrice: { fontSize: 19, fontWeight: '800', color: colors.textInverse },
  heroPriceSub: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  heroNote: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  successCard: { borderColor: colors.success },
  successRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  errorCard: { borderColor: colors.danger },
  errorRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  planRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  planCard: { flex: 1, paddingVertical: spacing.md },
  planFree: { borderColor: colors.border },
  planPaid: { borderColor: colors.accent, borderWidth: 1.5 },
  popularTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  popularText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textInverse,
  },
  planPrice: { fontSize: 24, fontWeight: '800', letterSpacing: -0.8, marginTop: 2 },
  planBullet: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  featureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  devNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: colors.warningLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.nav,
  },
});
