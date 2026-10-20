/**
 * PrescriptionCreditsCard — reader screen par live balance dikhata hai.
 *
 * Kya dikhata hai:
 *   • Abhi ka plan (Free plan / Read pack)
 *   • Kitne reads bache (badge + progress bar)
 *   • Credits khatam ho gaye to upgrade CTA (₹19 → 10 reads)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors, radius, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';
import { usePrescriptionCredits } from '../context/PrescriptionCreditsContext';
import {
  CREDIT_PACK_PRICE_RUPEES,
  CREDIT_PACK_SIZE,
  planLabel,
  readsUsed,
  totalGranted,
} from '../utils/prescriptionCredits';

export function PrescriptionCreditsCard({
  onUpgrade,
  showProgress = true,
}: {
  /** "Get more reads" tap par (paywall / plans screen kholne ke liye). */
  onUpgrade?: () => void;
  showProgress?: boolean;
}): React.JSX.Element {
  useThemePreference();
  const { credits, remaining, loading } = usePrescriptionCredits();

  const granted = totalGranted(credits);
  const used = readsUsed(credits);
  const progress = granted > 0 ? Math.min(1, used / granted) : 0;
  const exhausted = remaining <= 0;
  const low = !exhausted && remaining <= 1;

  const tone = exhausted ? colors.warning : low ? colors.warning : colors.primary;
  const toneBg = exhausted ? colors.warningLight : colors.primaryLight;

  const planLine = exhausted
    ? 'No reads left — top up to continue'
    : credits.paidCredits > 0
      ? `${remaining} read(s) left · ${credits.paidCredits} from read pack`
      : `${remaining} of ${credits.freeTotal} free read(s) left`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: exhausted || low ? colors.warning : colors.border,
        },
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.iconWrap, { backgroundColor: toneBg }]}>
          <Icon name="zap" size={16} color={tone} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[typography.smallMedium, { color: colors.text }]} numberOfLines={1}>
            {loading ? 'Checking your reads…' : planLabel(credits)}
          </Text>
          <Text style={[typography.caption, { marginTop: 1 }]} numberOfLines={1}>
            {planLine}
          </Text>
        </View>

        <View style={[styles.countPill, { backgroundColor: toneBg }]}>
          <Text style={[styles.countText, { color: tone }]}>
            {loading ? '—' : remaining}
          </Text>
          <Text style={[styles.countLabel, { color: tone }]}>left</Text>
        </View>
      </View>

      {showProgress ? (
        <View style={styles.trackWrap}>
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(progress * 100)}%`, backgroundColor: tone },
              ]}
            />
          </View>
          <Text style={[typography.caption, { marginTop: 6 }]}>
            {used} of {granted} read(s) used · 1 read = 1 prescription
          </Text>
        </View>
      ) : null}

      {exhausted && onUpgrade ? (
        <Pressable
          onPress={onUpgrade}
          accessibilityRole="button"
          accessibilityLabel={`Get ${CREDIT_PACK_SIZE} prescription reads for ${CREDIT_PACK_PRICE_RUPEES} rupees`}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Icon name="credit-card" size={16} color={colors.textInverse} />
          <Text style={[typography.button, { color: colors.textInverse, fontSize: 13.5 }]}>
            Get {CREDIT_PACK_SIZE} reads · ₹{CREDIT_PACK_PRICE_RUPEES}
          </Text>
          <Icon name="chevron-right" size={16} color={colors.textInverse} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  countText: { fontSize: 14, fontWeight: '800' },
  countLabel: { fontSize: 10, fontWeight: '700' },
  trackWrap: { marginTop: 2 },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: 42,
    marginTop: spacing.xs,
  },
});

export default PrescriptionCreditsCard;
