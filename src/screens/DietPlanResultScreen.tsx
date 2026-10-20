/**
 * AI Weekly Diet Planner — results ("Your Weekly Diet Plan").
 *
 * Din ke tabs (Day 1–7) + meal cards (ingredients, portion, calories,
 * protein/carbs/fat/fiber, instructions, alternatives), daily nutrition
 * summary, grocery list by category, meal checkboxes (server par persist),
 * prev/next day, regenerate (confirmation ke saath — purana version
 * history me rehta hai), naya plan, share aur delete.
 *
 * Nutrition values estimates hain — disclaimer hamesha saath.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import {
  AppButton,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  InfoRow,
  Loader,
  Screen,
  SectionHeader,
} from '../components/UI';
import api, { DietDay, DietMeal, DietPlan } from '../api/api';
import { RootStackParamList } from '../navigation/types';
import { exportDietPlanPdf } from '../utils/dietPlanPdf';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DietPlanResult'>;

/* ------------------------------- constants ------------------------------ */

const DISCLAIMER_FALLBACK =
  'This AI-generated plan provides general nutrition guidance only. It is not a medical diagnosis or a ' +
  'substitute for advice from a doctor or registered dietitian. All values are estimates.';

/** Meal key → icon + display name. */
const MEAL_META: Record<DietMeal['key'], { label: string; icon: IconName }> = {
  breakfast: { label: 'Breakfast', icon: 'utensils' },
  lunch: { label: 'Lunch', icon: 'utensils' },
  dinner: { label: 'Dinner', icon: 'utensils' },
  snack: { label: 'Snack', icon: 'zap' },
};

/** Short date label — "12 Oct". */
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]}`;
};

/* --------------------------------- screen -------------------------------- */

export default function DietPlanResultScreen({ navigation, route }: Props): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();

  const initialPlan = route.params?.plan;
  const planId = route.params?.planId ?? initialPlan?.id;

  const [plan, setPlan] = useState<DietPlan | null>(initialPlan ?? null);
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [completion, setCompletion] = useState<Record<string, boolean>>(initialPlan?.completion ?? {});
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [groceryOpen, setGroceryOpen] = useState(false);

  /* ------------------------------- load plan ------------------------------- */
  const load = useCallback(async () => {
    if (!planId) {
      setError('This diet plan could not be found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loaded = await api.dietPlans.byId(planId);
      setPlan(loaded);
      setCompletion(loaded.completion ?? {});
    } catch (e) {
      setError((e as Error).message || 'Could not load this diet plan. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (!initialPlan && planId) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  /* Today ka din highlight (agar plan is week ka hai). */
  useEffect(() => {
    if (!plan?.plan?.days?.length) return;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const index = plan.plan.days.findIndex(day => day.date === todayStr);
    if (index >= 0) setActiveDay(index);
  }, [plan]);

  const days: DietDay[] = useMemo(() => plan?.plan?.days ?? [], [plan]);
  const day: DietDay | undefined = days[activeDay];

  /* ---------------------------- meal completion ---------------------------- */

  const mealKey = (dayIndex: number, mealKeyStr: string) => `d${dayIndex}-${mealKeyStr}`;

  const toggleMeal = (dayIndex: number, key: string) => {
    if (!plan) return;
    const storageKey = mealKey(dayIndex, key);
    const nextValue = !completion[storageKey];
    setCompletion(prev => ({ ...prev, [storageKey]: nextValue }));
    api.dietPlans.complete(plan.id, storageKey, nextValue).catch(() => {
      /* rollback on failure */
      setCompletion(prev => ({ ...prev, [storageKey]: !nextValue }));
    });
  };

  /* ------------------------------- regenerate ------------------------------ */

  const regenerate = () => {
    if (!plan || busy) return;
    Alert.alert(
      'Regenerate this week’s plan?',
      'A fresh plan will be created for the same week. Your current plan stays in your history — nothing is deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'default',
          onPress: async () => {
            setBusy(true);
            try {
              const fresh = await api.dietPlans.generate(plan.preferences, plan.weekStart);
              setPlan(fresh);
              setCompletion(fresh.completion ?? {});
              setActiveDay(0);
              Alert.alert('New plan ready', 'Your regenerated weekly plan is ready.');
            } catch (e) {
              Alert.alert('Could not regenerate', (e as Error).message || 'Please try again.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const startNewPlan = () => navigation.navigate('DietPlannerLanding');

  const deletePlan = () => {
    if (!plan || busy) return;
    Alert.alert('Delete this plan?', 'This plan will be removed from your history. Other saved plans are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.dietPlans.remove(plan.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', (e as Error).message || 'Please try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const sharePlan = async () => {
    if (!plan) return;
    try {
      const lines: string[] = [
        `My 7-Day Diet Plan (${shortDate(plan.weekStart)} – ${shortDate(plan.weekEnd)})`,
        `Goal: ${plan.summary?.goal || 'healthy eating'}`,
        '',
        ...plan.plan.days.flatMap(d => [
          `${d.weekday}, ${shortDate(d.date)}`,
          ...d.meals.map(m => `• ${MEAL_META[m.key]?.label ?? m.key}: ${m.name} (~${m.calories} kcal)`),
          '',
        ]),
        'Generated with SloveCare AI Diet Planner',
      ];
      await Share.share({ message: lines.join('\n') });
    } catch {
      /* user cancelled */
    }
  };

  /* ----------------------------------- PDF ---------------------------------- */

  /**
   * Branded SloveCare PDF banakar system share sheet kholta hai — wahan se
   * WhatsApp/Drive/Files/Print… me save ya bhej sakte ho. Duplicate taps rokе
   * jaate hain (exporting guard).
   */
  const exportPdf = async () => {
    if (!plan || exporting || busy) return;
    setExporting(true);
    try {
      await exportDietPlanPdf(plan, completion);
    } catch (e) {
      Alert.alert('Could not export PDF', (e as Error).message || 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  /* --------------------------------- render -------------------------------- */

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Your Weekly Diet Plan" onBack={() => navigation.goBack()} />
        <View style={{ padding: spacing.lg }}>
          <Card>
            <Loader label="Loading your weekly plan…" />
          </Card>
        </View>
      </Screen>
    );
  }

  if (error || !plan) {
    return (
      <Screen>
        <AppHeader title="Your Weekly Diet Plan" onBack={() => navigation.goBack()} />
        <View style={{ padding: spacing.lg }}>
          <Card>
            <ErrorState message={error ?? 'Diet plan not found.'} onRetry={planId ? load : undefined} />
          </Card>
        </View>
      </Screen>
    );
  }

  const data = plan.plan;
  const isCurrentWeek = (() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    return plan.weekStart <= todayStr && todayStr <= plan.weekEnd;
  })();

  return (
    <Screen>
      <AppHeader
        title="Your Weekly Diet Plan"
        subtitle={`${shortDate(plan.weekStart)} – ${shortDate(plan.weekEnd)}${
          plan.version > 1 ? ` · v${plan.version}` : ''
        }`}
        onBack={() => navigation.goBack()}
        rightIcon="share"
        onRightPress={sharePlan}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------- plan header ---------------------------- */}
        <Card style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerIcon}>
              <Icon name="utensils" size={20} color={colors.textInverse} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.h3} numberOfLines={1}>
                {goalLabel(plan)}
              </Text>
              <Text style={typography.caption}>
                {plan.summary?.dietType ? `${plan.summary.dietType.replace(/_/g, ' ')} · ` : ''}
                {plan.plan.days.length} days · ~{plan.summary?.avgCalories ?? averageCalories(data.days)} kcal/day
              </Text>
            </View>
            {isCurrentWeek ? <Badge label="This week" tone="success" icon="check-circle" /> : <Badge label="Past plan" tone="neutral" icon="calendar" />}
          </View>

          {data.overview ? <Text style={[typography.small, { marginTop: spacing.md }]}>{data.overview}</Text> : null}
          {data.reasoning ? (
            <>
              <Text style={[typography.caption, { marginTop: spacing.md, marginBottom: 2 }]}>WHY THIS PLAN FITS YOU</Text>
              <Text style={typography.small}>{data.reasoning}</Text>
            </>
          ) : null}
        </Card>

        {/* ------------------------------ warnings ------------------------------ */}
        {data.warnings?.length ? (
          <Card style={[styles.noteCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            {data.warnings.map((warning, index) => (
              <View key={index} style={styles.noteRow}>
                <Icon name="alert-triangle" size={14} color={colors.warningText} />
                <Text style={[typography.small, { flex: 1, color: colors.warningText }]}>{warning}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* ------------------------------- day tabs ------------------------------ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayTabs}
        >
          {days.map((d, index) => {
            const active = index === activeDay;
            const doneCount = d.meals.filter(m => completion[mealKey(index, m.key)]).length;
            return (
              <Pressable
                key={d.date}
                onPress={() => setActiveDay(index)}
                style={({ pressed }) => [styles.dayTab, active && styles.dayTabActive, pressed && { opacity: 0.85 }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Day ${index + 1}, ${d.weekday} ${shortDate(d.date)}`}
              >
                <Text style={[styles.dayTabNo, active && { color: colors.textInverse }]}>Day {index + 1}</Text>
                <Text style={[styles.dayTabDate, active && { color: 'rgba(255,255,255,0.85)' }]}>
                  {d.weekday.slice(0, 3)} · {shortDate(d.date)}
                </Text>
                {doneCount > 0 ? (
                  <Text style={[styles.dayTabDone, active && { color: 'rgba(255,255,255,0.85)' }]}>
                    {doneCount}/{d.meals.length} done
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ------------------------------ meal cards ----------------------------- */}
        {day ? (
          <>
            <SectionHeader title={`${day.weekday}, ${shortDate(day.date)}`} subtitle={`Day ${activeDay + 1} of ${days.length}`} />

            {day.meals.length === 0 ? (
              <Card>
                <EmptyState icon="utensils" title="No meals for this day" subtitle="This day could not be planned safely. Please review or regenerate." />
              </Card>
            ) : (
              day.meals.map(meal => (
                <MealCard
                  key={meal.key}
                  meal={meal}
                  done={Boolean(completion[mealKey(activeDay, meal.key)])}
                  onToggle={() => toggleMeal(activeDay, meal.key)}
                />
              ))
            )}

            {/* Daily nutrition summary */}
            <Card style={styles.totalsCard}>
              <Text style={typography.smallMedium}>Daily nutrition (estimated)</Text>
              <View style={styles.totalsRow}>
                <TotalChip label="kcal" value={day.totals.calories} color={colors.blue} />
                <TotalChip label="Protein" value={day.totals.protein} unit="g" color={colors.primary} />
                <TotalChip label="Carbs" value={day.totals.carbs} unit="g" color={colors.violet} />
                <TotalChip label="Fat" value={day.totals.fat} unit="g" color={colors.warning} />
                <TotalChip label="Fiber" value={day.totals.fiber} unit="g" color={colors.accent} />
              </View>
              <Text style={[typography.caption, { marginTop: spacing.sm }]}>
                Values are rough estimates generated by AI — not exact lab measurements.
              </Text>
            </Card>

            {/* Day navigation */}
            <View style={styles.dayNav}>
              <View style={{ flex: 1 }}>
                <AppButton
                  label="Previous Day"
                  icon="chevron-left"
                  variant="outline"
                  size="sm"
                  disabled={activeDay === 0}
                  onPress={() => setActiveDay(index => Math.max(0, index - 1))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton
                  label="Next Day"
                  icon="chevron-right"
                  variant="outline"
                  size="sm"
                  disabled={activeDay >= days.length - 1}
                  onPress={() => setActiveDay(index => Math.min(days.length - 1, index + 1))}
                />
              </View>
            </View>
          </>
        ) : null}

        {/* ------------------------------ hydration ------------------------------ */}
        {data.hydration ? (
          <Card style={styles.sectionCard}>
            <View style={styles.noteRow}>
              <Icon name="activity" size={16} color={colors.blue} />
              <View style={{ flex: 1 }}>
                <Text style={typography.smallMedium}>Hydration</Text>
                <Text style={[typography.small, { marginTop: 2 }]}>{data.hydration}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* ------------------------------- prep tips ----------------------------- */}
        {data.prep_tips?.length ? (
          <Card style={styles.sectionCard}>
            <Text style={typography.smallMedium}>Meal prep tips</Text>
            {data.prep_tips.map((tip, index) => (
              <View key={index} style={[styles.noteRow, { marginTop: spacing.sm }]}>
                <Icon name="check" size={13} color={colors.accent} />
                <Text style={[typography.small, { flex: 1 }]}>{tip}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {/* ------------------------------ grocery list --------------------------- */}
        {data.grocery?.length ? (
          <Card style={styles.sectionCard}>
            <Pressable
              onPress={() => setGroceryOpen(open => !open)}
              style={styles.groceryHeader}
              accessibilityRole="button"
              accessibilityLabel={groceryOpen ? 'Hide weekly grocery list' : 'Show weekly grocery list'}
            >
              <View style={{ flex: 1 }}>
                <Text style={typography.smallMedium}>Weekly grocery list</Text>
                <Text style={typography.caption}>Quantities estimated for the full week</Text>
              </View>
              <Icon name={groceryOpen ? 'chevron-down' : 'chevron-right'} size={18} color={colors.textMuted} />
            </Pressable>
            {groceryOpen
              ? data.grocery.map(cat => (
                  <View key={cat.category} style={styles.groceryCat}>
                    <Text style={styles.groceryCatTitle}>{cat.category}</Text>
                    {cat.items.map((item, index) => (
                      <InfoRow key={`${item.name}-${index}`} label={item.name} value={item.quantity} />
                    ))}
                  </View>
                ))
              : null}
          </Card>
        ) : null}

        {/* ----------------------------- plan actions ---------------------------- */}
        <View style={styles.actions}>
          <AppButton
            label={exporting ? 'Creating your PDF…' : 'Save / Export as PDF'}
            icon="download"
            variant="accent"
            onPress={exportPdf}
            loading={exporting}
            disabled={exporting || busy}
          />
          <AppButton
            label={busy ? 'Working…' : 'Regenerate This Week’s Plan'}
            icon="refresh"
            variant="outline"
            onPress={regenerate}
            disabled={busy || exporting}
          />
          <AppButton label="Start a New Weekly Plan" icon="plus" variant="primary" onPress={startNewPlan} disabled={busy || exporting} />
          <AppButton label="Share as Text" icon="share" variant="ghost" onPress={sharePlan} disabled={busy || exporting} />
          <Pressable onPress={deletePlan} disabled={busy || exporting} style={styles.deleteBtn} accessibilityLabel="Delete this plan">
            <Icon name="trash" size={15} color={colors.danger} />
            <Text style={[typography.smallMedium, { color: colors.danger }]}>Delete this plan</Text>
          </Pressable>
        </View>

        {/* ------------------------------- disclaimer ---------------------------- */}
        <Text style={styles.disclaimer}>{plan.disclaimer ?? DISCLAIMER_FALLBACK}</Text>
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------ sub-components ---------------------------- */

function MealCard({
  meal,
  done,
  onToggle,
}: {
  meal: DietMeal;
  done: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const meta = MEAL_META[meal.key] ?? { label: meal.key, icon: 'clock' as IconName };
  return (
    <Card style={[styles.mealCard, done && styles.mealCardDone]}>
      <View style={styles.mealTop}>
        <View style={[styles.mealIcon, done && { backgroundColor: colors.successLight }]}>
          <Icon name={meta.icon} size={15} color={done ? colors.success : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.mealTitleRow}>
            <Text style={typography.caption}>{meta.label.toUpperCase()}{meal.time ? ` · ${meal.time}` : ''}</Text>
            {done ? <Badge label="Done" tone="success" icon="check" /> : null}
          </View>
          <Text style={typography.h4} numberOfLines={2}>
            {meal.name}
          </Text>
        </View>
        <Pressable
          onPress={onToggle}
          hitSlop={10}
          style={styles.checkbox}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Mark ${meal.name} as ${done ? 'not done' : 'done'}`}
        >
          <Icon name={done ? 'check-circle' : 'circle'} size={24} color={done ? colors.success : colors.borderStrong} />
        </Pressable>
      </View>

      {meal.items.length ? (
        <View style={styles.itemsBox}>
          {meal.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemDot} />
              <Text style={[typography.small, { flex: 1 }]}>
                {item.name}
                {item.quantity ? <Text style={{ color: colors.textMuted }}> — {item.quantity}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.macroRow}>
        <MacroChip icon="zap" label={`${meal.calories} kcal`} />
        <MacroChip label={`P ${meal.protein}g`} />
        <MacroChip label={`C ${meal.carbs}g`} />
        <MacroChip label={`F ${meal.fat}g`} />
        <MacroChip label={`Fiber ${meal.fiber}g`} />
      </View>

      {meal.instructions ? (
        <View style={styles.instructionsRow}>
          <Icon name="info" size={13} color={colors.textMuted} />
          <Text style={[typography.small, { flex: 1 }]}>{meal.instructions}</Text>
        </View>
      ) : null}

      {meal.alternatives.length ? (
        <View style={styles.altBox}>
          <Text style={typography.caption}>ALTERNATIVES</Text>
          {meal.alternatives.map((alt, index) => (
            <Text key={index} style={[typography.small, { marginTop: 2 }]}>
              • {alt}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function MacroChip({ icon, label }: { icon?: IconName; label: string }): React.JSX.Element {
  return (
    <View style={styles.macroChip}>
      {icon ? <Icon name={icon} size={11} color={colors.textSecondary} /> : null}
      <Text style={styles.macroChipText}>{label}</Text>
    </View>
  );
}

function TotalChip({ label, value, unit, color }: { label: string; value: number; unit?: string; color: string }): React.JSX.Element {
  return (
    <View style={styles.totalChip}>
      <Text style={[styles.totalValue, { color }]} numberOfLines={1}>
        {value}
        {unit || ''}
      </Text>
      <Text style={typography.caption} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* --------------------------------- helpers -------------------------------- */

function goalLabel(plan: DietPlan): string {
  const goal = (plan.summary?.goal || plan.preferences?.goal || '').replace(/_/g, ' ');
  if (!goal) return 'Weekly Diet Plan';
  return goal.replace(/\b\w/g, char => char.toUpperCase());
}

function averageCalories(days: DietDay[]): number {
  if (!days.length) return 0;
  return Math.round(days.reduce((total, d) => total + (d.totals?.calories || 0), 0) / days.length);
}

/* ---------------------------------- styles -------------------------------- */

const styles = StyleSheet.create({
  headerCard: { marginBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: { marginBottom: spacing.md, borderColor: colors.border, gap: spacing.sm },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dayTabs: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  dayTab: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 96,
    gap: 1,
  },
  dayTabActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  dayTabNo: { ...typography.smallMedium, fontSize: 12.5 },
  dayTabDate: { ...typography.caption },
  dayTabDone: { ...typography.caption, color: colors.success },
  mealCard: { marginBottom: spacing.md },
  mealCardDone: { borderColor: colors.success },
  mealTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  mealIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { padding: 2 },
  itemsBox: {
    backgroundColor: colors.cardMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 4,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  itemDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  macroChipText: { fontSize: 10.5, fontWeight: '700', color: colors.textSecondary },
  instructionsRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, alignItems: 'flex-start' },
  altBox: {
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  totalsCard: { marginBottom: spacing.md },
  totalsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  totalChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.cardMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalValue: { fontSize: 14, fontWeight: '800' },
  dayNav: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  sectionCard: { marginBottom: spacing.md },
  groceryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groceryCat: { marginTop: spacing.md },
  groceryCatTitle: { ...typography.eyebrow, marginBottom: 2 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
