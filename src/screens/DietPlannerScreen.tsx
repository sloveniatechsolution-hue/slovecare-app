/**
 * AI Weekly Diet Planner — multi-step information form.
 *
 * Step 1 Personal → Step 2 Health → Step 3 Food Preferences → Step 4 Review
 *
 * Har step par validation; optional sawaal optional hi hain; conditional
 * fields (pregnancy sirf female/other, dietTypeOther sirf "other").
 * Generate existing backend endpoint (/diet-plans/generate) par chalta hai —
 * wahi existing Gemini integration, API key sirf backend me.
 *
 * Duplicate protection: generate ke dauran button disable + backend par
 * same week+preferences ka recent plan reuse ho jaata hai.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Country } from 'country-state-city';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { AppButton, Card, Chip, Screen, SelectField, TextField } from '../components/UI';
import api, { DietPlanPreferences, User } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DietPlanner'>;

/* ------------------------------- constants ------------------------------ */

const STEP_TITLES = ['Personal Information', 'Health Information', 'Food Preferences', 'Review & Generate'];

const SEX_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const ACTIVITY_OPTIONS = [
  { label: 'Sedentary', value: 'sedentary' },
  { label: 'Lightly active', value: 'lightly_active' },
  { label: 'Moderately active', value: 'moderately_active' },
  { label: 'Very active', value: 'very_active' },
];

const GOAL_OPTIONS = [
  { label: 'Weight loss', value: 'weight_loss' },
  { label: 'Weight gain', value: 'weight_gain' },
  { label: 'Muscle building', value: 'muscle_building' },
  { label: 'Weight maintenance', value: 'weight_maintenance' },
  { label: 'General healthy eating', value: 'general_healthy_eating' },
];

const DIET_TYPE_OPTIONS = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Eggetarian', value: 'eggetarian' },
  { label: 'Vegetarian + Dairy', value: 'vegetarian_dairy' },
  { label: 'Non-Vegetarian', value: 'non_vegetarian' },
  { label: 'Other', value: 'other' },
];

const CUISINE_OPTIONS = [
  { label: 'Indian', value: 'Indian' },
  { label: 'Gujarati', value: 'Gujarati' },
  { label: 'Rajasthani', value: 'Rajasthani' },
  { label: 'Punjabi', value: 'Punjabi' },
  { label: 'South Indian', value: 'South Indian' },
  { label: 'Mediterranean', value: 'Mediterranean' },
  { label: 'Other', value: 'Other' },
];

const BUDGET_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'Flexible', value: 'flexible' },
];

const COOKING_OPTIONS = [
  { label: 'Quick meals', value: 'quick' },
  { label: 'Home-cooked', value: 'home_cooked' },
  { label: 'Mixed', value: 'mixed' },
];

const PREGNANCY_OPTIONS = [
  { label: 'Pregnant', value: 'pregnant' },
  { label: 'Breastfeeding', value: 'breastfeeding' },
  { label: 'Both', value: 'both' },
  { label: 'No', value: 'no' },
  { label: 'Prefer not to say', value: 'not_applicable' },
];

const COUNTRY_OPTIONS = Country.getAllCountries().map(c => ({ label: c.name, value: c.name }));

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

const GOAL_LABELS: Record<string, string> = Object.fromEntries(GOAL_OPTIONS.map(o => [o.value, o.label]));
const DIET_LABELS: Record<string, string> = Object.fromEntries(DIET_TYPE_OPTIONS.map(o => [o.value, o.label]));
const ACTIVITY_LABELS: Record<string, string> = Object.fromEntries(ACTIVITY_OPTIONS.map(o => [o.value, o.label]));
const BUDGET_LABELS: Record<string, string> = Object.fromEntries(BUDGET_OPTIONS.map(o => [o.value, o.label]));
const COOKING_LABELS: Record<string, string> = Object.fromEntries(COOKING_OPTIONS.map(o => [o.value, o.label]));

/* --------------------------------- form state ---------------------------- */

interface FormState {
  /* Step 1 */
  age: string;
  sex: string;
  heightUnit: 'cm' | 'ftin';
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weightUnit: 'kg' | 'lbs';
  weight: string;
  goalWeight: string;
  country: string;
  state: string;
  city: string;
  activityLevel: string;
  /* Step 2 */
  goal: string;
  medicalConditions: string;
  allergies: string;
  dietaryRestrictions: string;
  medications: string;
  pregnancyStatus: string;
  exerciseRoutine: string;
  sleepSchedule: string;
  dailyRoutine: string;
  /* Step 3 */
  dietType: string;
  dietTypeOther: string;
  cuisine: string;
  favoriteFoods: string;
  dislikedFoods: string;
  mealsPerDay: number;
  mealTimings: string;
  budget: string;
  cookingPreference: string;
  restrictionsNotes: string;
}

const EMPTY_FORM: FormState = {
  age: '',
  sex: '',
  heightUnit: 'cm',
  heightCm: '',
  heightFt: '',
  heightIn: '',
  weightUnit: 'kg',
  weight: '',
  goalWeight: '',
  country: 'India',
  state: '',
  city: '',
  activityLevel: '',
  goal: '',
  medicalConditions: '',
  allergies: '',
  dietaryRestrictions: '',
  medications: '',
  pregnancyStatus: '',
  exerciseRoutine: '',
  sleepSchedule: '',
  dailyRoutine: '',
  dietType: '',
  dietTypeOther: '',
  cuisine: 'Indian',
  favoriteFoods: '',
  dislikedFoods: '',
  mealsPerDay: 4,
  mealTimings: '',
  budget: 'medium',
  cookingPreference: 'mixed',
  restrictionsNotes: '',
};

const numOrNull = (value: string): number | null => {
  const n = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const listText = (value: string): string[] =>
  value
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean);

const genderToSex = (gender?: string): string => {
  const g = (gender || '').toLowerCase();
  if (g.startsWith('m')) return 'male';
  if (g.startsWith('f')) return 'female';
  if (g === 'other') return 'other';
  return 'prefer_not_to_say';
};

/** Form → backend preferences payload (canonical cm/kg). */
const toPreferences = (form: FormState): DietPlanPreferences => {
  let heightCm = numOrNull(form.heightCm);
  if (form.heightUnit === 'ftin') {
    const ft = numOrNull(form.heightFt) ?? 0;
    const inch = numOrNull(form.heightIn) ?? 0;
    const totalInches = ft * 12 + inch;
    heightCm = totalInches > 0 ? Math.round(totalInches * CM_PER_INCH * 10) / 10 : null;
  }

  let weightKg = numOrNull(form.weight);
  if (weightKg !== null && form.weightUnit === 'lbs') {
    weightKg = Math.round(weightKg * KG_PER_LB * 10) / 10;
  }
  let goalWeightKg = numOrNull(form.goalWeight);
  if (goalWeightKg !== null && form.weightUnit === 'lbs') {
    goalWeightKg = Math.round(goalWeightKg * KG_PER_LB * 10) / 10;
  }

  return {
    age: numOrNull(form.age) !== null ? Math.round(numOrNull(form.age) as number) : null,
    sex: form.sex || 'prefer_not_to_say',
    heightCm,
    weightKg,
    goalWeightKg,
    country: form.country.trim() || 'India',
    state: form.state.trim(),
    city: form.city.trim(),
    activityLevel: form.activityLevel || 'sedentary',
    goal: form.goal,
    medicalConditions: listText(form.medicalConditions),
    allergies: listText(form.allergies),
    dietaryRestrictions: listText(form.dietaryRestrictions),
    medications: form.medications.trim(),
    pregnancyStatus: form.pregnancyStatus || 'not_applicable',
    exerciseRoutine: form.exerciseRoutine.trim(),
    sleepSchedule: form.sleepSchedule.trim(),
    dailyRoutine: form.dailyRoutine.trim(),
    dietType: form.dietType,
    dietTypeOther: form.dietType === 'other' ? form.dietTypeOther.trim() : '',
    cuisine: form.cuisine.trim() || 'Indian',
    favoriteFoods: listText(form.favoriteFoods),
    dislikedFoods: listText(form.dislikedFoods),
    mealsPerDay: form.mealsPerDay,
    mealTimings: form.mealTimings.trim(),
    budget: form.budget,
    cookingPreference: form.cookingPreference,
    restrictionsNotes: form.restrictionsNotes.trim(),
  };
};

/** Saved snapshot/preferences → form (prefill). */
const fromPreferences = (prefs: DietPlanPreferences, user: User | null): FormState => {
  const base = { ...EMPTY_FORM };

  /* User health profile se basic details (sirf tab jab form khaali ho). */
  if (user?.age) base.age = String(user.age);
  if (user?.gender) base.sex = genderToSex(user.gender);
  if (user?.height) base.heightCm = String(user.height);
  if (user?.weight) base.weight = String(user.weight);
  /* Location hamesha health profile se — user se dobara nahi poochhte. */
  if (user?.state) base.state = user.state;
  if (user?.city) base.city = user.city;

  if (!prefs || typeof prefs !== 'object') {
    return base;
  }

  const next: FormState = {
    ...base,
    age: prefs.age != null ? String(prefs.age) : base.age,
    sex: prefs.sex || base.sex,
    heightCm: prefs.heightCm != null ? String(prefs.heightCm) : base.heightCm,
    heightFt: '',
    heightIn: '',
    weightUnit: 'kg',
    weight: prefs.weightKg != null ? String(prefs.weightKg) : base.weight,
    goalWeight: prefs.goalWeightKg != null ? String(prefs.goalWeightKg) : '',
    country: prefs.country || base.country,
    /* Profile se aayi location saved preference se upar — profile hi source of truth. */
    state: base.state || prefs.state || '',
    city: base.city || prefs.city || '',
    activityLevel: prefs.activityLevel || '',
    goal: prefs.goal || '',
    medicalConditions: (prefs.medicalConditions || []).join(', '),
    allergies: (prefs.allergies || []).join(', '),
    dietaryRestrictions: (prefs.dietaryRestrictions || []).join(', '),
    medications: prefs.medications || '',
    pregnancyStatus: prefs.pregnancyStatus || '',
    exerciseRoutine: prefs.exerciseRoutine || '',
    sleepSchedule: prefs.sleepSchedule || '',
    dailyRoutine: prefs.dailyRoutine || '',
    dietType: prefs.dietType || '',
    dietTypeOther: prefs.dietTypeOther || '',
    cuisine: prefs.cuisine || 'Indian',
    favoriteFoods: (prefs.favoriteFoods || []).join(', '),
    dislikedFoods: (prefs.dislikedFoods || []).join(', '),
    mealsPerDay: prefs.mealsPerDay || 4,
    mealTimings: prefs.mealTimings || '',
    budget: prefs.budget || 'medium',
    cookingPreference: prefs.cookingPreference || 'mixed',
    restrictionsNotes: prefs.restrictionsNotes || '',
  };
  return next;
};

/* ---------------------------- small local UI bits ------------------------ */

/** Flex-wrap choice chips — form ke saare single-select sawaalon ke liye. */
function ChoiceChips({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.chipWrap}>
      {options.map(option => (
        <Chip
          key={option.value}
          label={option.label}
          active={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

/** cm | ft+in ya kg | lbs unit toggle. */
function UnitToggle({
  left,
  right,
  value,
  onChange,
}: {
  left: string;
  right: string;
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.unitToggle}>
      {[left, right].map(option => (
        <Chip key={option} label={option} active={option === value} onPress={() => onChange(option)} />
      ))}
    </View>
  );
}

/** Form section ka card header — title + optional hint. */
function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card style={styles.sectionCard}>
      <Text style={typography.h4}>{title}</Text>
      {hint ? <Text style={[typography.caption, { marginTop: 2 }]}>{hint}</Text> : null}
      <View style={{ marginTop: spacing.md }}>{children}</View>
    </Card>
  );
}

/** Review step ka label/value row — "edit" se us step par wapas. */
function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.reviewRow}>
      <View style={{ flex: 1 }}>
        <Text style={typography.caption}>{label}</Text>
        <Text style={[typography.smallMedium, { marginTop: 1 }]}>{value || '—'}</Text>
      </View>
      <Chip label="Edit" onPress={onEdit} icon="edit" />
    </View>
  );
}

/* --------------------------------- screen -------------------------------- */

export default function DietPlannerScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [stepError, setStepError] = useState<string | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [weekPlanExists, setWeekPlanExists] = useState(false);
  /* Location health profile se aati hai — sirf tab edit fields dikhti hain jab user khud badalna chahe. */
  const [editingLocation, setEditingLocation] = useState(false);
  const [existingPlanId, setExistingPlanId] = useState<string | null>(null);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const hasProfileLocation = Boolean(user?.city || user?.state);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setStepError(null);
  }, []);

  /* ------------------------- prefill: saved + profile ------------------------ */
  useEffect(() => {
    if (!isLoggedIn) {
      setLoadingPrefs(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [saved, plans] = await Promise.allSettled([
          api.dietPlans.getPreferences(),
          api.dietPlans.list(),
        ]);
        if (cancelled) return;
        const savedPrefs = saved.status === 'fulfilled' ? saved.value.preferences : null;
        setForm(fromPreferences(savedPrefs ?? ({} as DietPlanPreferences), user));

        if (plans.status === 'fulfilled') {
          const today = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
          const existing = plans.value.find(p => p.weekStart <= todayStr && todayStr <= p.weekEnd);
          setWeekPlanExists(Boolean(existing));
          setExistingPlanId(existing?.id ?? null);
        }
      } catch {
        /* prefill optional hai — profile se chalega */
      } finally {
        if (!cancelled) setLoadingPrefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user]);

  /* ------------------------------- validation ------------------------------- */

  const validateStep = (index: number): string | null => {
    if (index === 0) {
      const age = numOrNull(form.age);
      if (!age || age < 3 || age > 120) return 'Please enter your age (3–120 years).';
      if (form.heightUnit === 'cm') {
        const h = numOrNull(form.heightCm);
        if (!h || h < 50 || h > 260) return 'Please enter your height in cm (50–260).';
      } else {
        const ft = numOrNull(form.heightFt);
        const inch = numOrNull(form.heightIn) ?? 0;
        if (!ft || ft < 1 || ft > 9 || (ft === 9 && inch > 6)) {
          return 'Please enter your height in feet & inches.';
        }
      }
      const w = numOrNull(form.weight);
      const wKg = w && form.weightUnit === 'lbs' ? w * KG_PER_LB : w;
      if (!wKg || wKg < 20 || wKg > 400) {
        return form.weightUnit === 'lbs'
          ? 'Please enter your weight in lbs (44–880).'
          : 'Please enter your weight in kg (20–400).';
      }
      if (!form.sex) return 'Please select your sex (you can choose “Prefer not to say”).';
      if (!form.activityLevel) return 'Please select your daily activity level.';
      return null;
    }
    if (index === 1) {
      if (!form.goal) return 'Please choose your primary goal.';
      return null;
    }
    if (index === 2) {
      if (!form.dietType) return 'Please choose your diet type.';
      if (form.dietType === 'other' && !form.dietTypeOther.trim()) {
        return 'Please tell us your diet type.';
      }
      return null;
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(step);
    if (error) {
      setStepError(error);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setStepError(null);
    setGenerateError(null);
    setStep(prev => Math.min(3, prev + 1));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const goBack = () => {
    setStepError(null);
    setStep(prev => Math.max(0, prev - 1));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const jumpToStep = (index: number) => {
    setStep(index);
    setStepError(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  /* -------------------------------- generate -------------------------------- */

  const generate = async () => {
    if (generating) return; // duplicate taps — ek hi request
    setGenerateError(null);

    /* Saare steps ek baar phir se validate (edit ke baad bhi safe). */
    for (let i = 0; i <= 2; i += 1) {
      const error = validateStep(i);
      if (error) {
        setStep(i);
        setStepError(error);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
    }

    const preferences = toPreferences(form);
    setGenerating(true);
    try {
      const plan = await api.dietPlans.generate(preferences);
      /* Snapshot save — agli baar form prefill ho (best effort). */
      api.dietPlans.savePreferences(preferences).catch(() => {});
      navigation.replace('DietPlanResult', { plan });
    } catch (e) {
      setGenerateError((e as Error).message || 'Could not generate your diet plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  /* --------------------------------- render --------------------------------- */

  const reviewRows = useMemo(() => {
    const heightLabel =
      form.heightUnit === 'cm'
        ? `${form.heightCm || '—'} cm`
        : `${form.heightFt || '—'}′ ${form.heightIn || '0'}″`;
    const weightLabel = `${form.weight || '—'} ${form.weightUnit}`;
    const sexLabel = SEX_OPTIONS.find(o => o.value === form.sex)?.label || '';
    const activityLabel = ACTIVITY_LABELS[form.activityLevel] || '';
    const dietTypeLabel =
      form.dietType === 'other' ? form.dietTypeOther || 'Other' : DIET_LABELS[form.dietType] || '';

    return [
      { stepIndex: 0, label: 'Age', value: `${form.age} years` },
      { stepIndex: 0, label: 'Sex', value: sexLabel },
      { stepIndex: 0, label: 'Height', value: heightLabel },
      { stepIndex: 0, label: 'Current weight', value: weightLabel },
      { stepIndex: 0, label: 'Goal weight', value: form.goalWeight ? `${form.goalWeight} ${form.weightUnit}` : 'Not specified' },
      { stepIndex: 0, label: 'Location', value: [form.city, form.state, form.country].filter(Boolean).join(', ') },
      { stepIndex: 0, label: 'Activity level', value: activityLabel },
      { stepIndex: 1, label: 'Primary goal', value: GOAL_LABELS[form.goal] || '' },
      { stepIndex: 1, label: 'Medical conditions', value: form.medicalConditions },
      { stepIndex: 1, label: 'Allergies / intolerances', value: form.allergies },
      { stepIndex: 1, label: 'Dietary restrictions', value: form.dietaryRestrictions },
      { stepIndex: 1, label: 'Medications', value: form.medications },
      {
        stepIndex: 1,
        label: 'Pregnancy / breastfeeding',
        value: PREGNANCY_OPTIONS.find(o => o.value === form.pregnancyStatus)?.label || '',
      },
      { stepIndex: 1, label: 'Exercise routine', value: form.exerciseRoutine },
      { stepIndex: 1, label: 'Sleep / daily routine', value: [form.sleepSchedule, form.dailyRoutine].filter(Boolean).join(' · ') },
      { stepIndex: 2, label: 'Diet type', value: dietTypeLabel },
      { stepIndex: 2, label: 'Preferred cuisine', value: form.cuisine },
      { stepIndex: 2, label: 'Favorite foods', value: form.favoriteFoods },
      { stepIndex: 2, label: 'Disliked foods', value: form.dislikedFoods },
      { stepIndex: 2, label: 'Meals per day', value: String(form.mealsPerDay) },
      { stepIndex: 2, label: 'Preferred meal timings', value: form.mealTimings },
      { stepIndex: 2, label: 'Food budget', value: BUDGET_LABELS[form.budget] || '' },
      { stepIndex: 2, label: 'Cooking preference', value: COOKING_LABELS[form.cookingPreference] || '' },
      { stepIndex: 2, label: 'Other restrictions', value: form.restrictionsNotes },
    ];
  }, [form]);

  if (!isLoggedIn) {
    return (
      <Screen>
        <AppHeader title="Weekly Diet Planner" onBack={() => navigation.goBack()} />
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

  /* Weekly plan already exists — sweet message, form band. */
  if (weekPlanExists && existingPlanId) {
    return (
      <Screen>
        <AppHeader title="Weekly Diet Planner" onBack={() => navigation.goBack()} />
        <View style={styles.authBox}>
          <Card>
            <View style={styles.authIcon}>
              <Icon name="calendar" size={26} color={colors.success} />
            </View>
            <Text style={[typography.h4, { textAlign: 'center', marginTop: spacing.md }]}>
              You already have this week's plan!
            </Text>
            <Text style={[typography.small, { textAlign: 'center', marginTop: 4 }]}>
              You have already created a diet plan for this week. Please wait for next week to generate a new one.
              You can view or export your current plan below.
            </Text>
            <View style={{ marginTop: spacing.lg }}>
              <AppButton
                label="View This Week's Plan"
                icon="calendar"
                variant="accent"
                onPress={() => navigation.navigate('DietPlanResult', { planId: existingPlanId })}
              />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title="Weekly Diet Planner"
        subtitle={`Step ${step + 1} of 4 · ${STEP_TITLES[step]}`}
        onBack={() => (step === 0 ? navigation.goBack() : goBack())}
      />

      {/* Progress — 4 segments */}
      <View style={styles.progressRow}>
        {[0, 1, 2, 3].map(index => (
          <View
            key={index}
            style={[styles.progressSegment, index <= step && styles.progressSegmentActive]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl + insets.bottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loadingPrefs && step === 0 ? (
            <Text style={[typography.caption, { marginBottom: spacing.sm }]}>Loading your saved details…</Text>
          ) : null}

          {/* ----------------------------- Step 1 ----------------------------- */}
          {step === 0 ? (
            <>
              <SectionCard title="About you" hint="Used to estimate your daily energy needs.">
                <TextField
                  label="Age (years)"
                  icon="user"
                  value={form.age}
                  onChangeText={v => set('age', v)}
                  keyboardType="number-pad"
                  placeholder="e.g. 30"
                  maxLength={3}
                />

                <Text style={styles.fieldLabel}>Sex</Text>
                <ChoiceChips options={SEX_OPTIONS} value={form.sex} onChange={v => set('sex', v)} />
                <View style={{ height: spacing.md }} />

                <View style={styles.inlineHeader}>
                  <Text style={styles.fieldLabel}>Height</Text>
                  <UnitToggle
                    left="cm"
                    right="ft in"
                    value={form.heightUnit}
                    onChange={v => set('heightUnit', v as 'cm' | 'ftin')}
                  />
                </View>
                {form.heightUnit === 'cm' ? (
                  <TextField
                    value={form.heightCm}
                    onChangeText={v => set('heightCm', v)}
                    keyboardType="decimal-pad"
                    placeholder="Height in cm (e.g. 170)"
                    maxLength={5}
                  />
                ) : (
                  <View style={styles.rowGap}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        value={form.heightFt}
                        onChangeText={v => set('heightFt', v)}
                        keyboardType="number-pad"
                        placeholder="Feet (e.g. 5)"
                        maxLength={2}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextField
                        value={form.heightIn}
                        onChangeText={v => set('heightIn', v)}
                        keyboardType="number-pad"
                        placeholder="Inches (e.g. 7)"
                        maxLength={2}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inlineHeader}>
                  <Text style={styles.fieldLabel}>Current weight</Text>
                  <UnitToggle
                    left="kg"
                    right="lbs"
                    value={form.weightUnit}
                    onChange={v => set('weightUnit', v as 'kg' | 'lbs')}
                  />
                </View>
                <TextField
                  value={form.weight}
                  onChangeText={v => set('weight', v)}
                  keyboardType="decimal-pad"
                  placeholder={form.weightUnit === 'kg' ? 'Weight in kg (e.g. 65)' : 'Weight in lbs (e.g. 143)'}
                  maxLength={6}
                />

                <TextField
                  label="Goal weight (optional)"
                  value={form.goalWeight}
                  onChangeText={v => set('goalWeight', v)}
                  keyboardType="decimal-pad"
                  placeholder={form.weightUnit === 'kg' ? 'e.g. 60 kg' : 'e.g. 132 lbs'}
                  maxLength={6}
                />
              </SectionCard>

              {/* Location — health profile se auto-fill (dobara nahi poochhte). */}
              {hasProfileLocation && !editingLocation ? (
                <SectionCard
                  title="Where you live"
                  hint="Same as your health profile — used to suggest locally available, affordable foods."
                >
                  <View style={styles.locationRow}>
                    <Icon name="map-pin" size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={typography.smallMedium}>
                        {[form.city, form.state, form.country].filter(Boolean).join(', ')}
                      </Text>
                      <Text style={typography.caption}>From your health profile</Text>
                    </View>
                    <Chip label="Change" icon="edit" onPress={() => setEditingLocation(true)} />
                  </View>
                </SectionCard>
              ) : (
                <SectionCard title="Where you live" hint="Helps us suggest locally available, affordable foods.">
                  <SelectField
                    label="Country"
                    icon="globe"
                    value={form.country}
                    options={COUNTRY_OPTIONS}
                    onChange={v => set('country', v)}
                  />
                  <TextField
                    label="State"
                    icon="map"
                    value={form.state}
                    onChangeText={v => set('state', v)}
                    placeholder="e.g. Rajasthan"
                    maxLength={80}
                  />
                  <TextField
                    label="City"
                    icon="map-pin"
                    value={form.city}
                    onChangeText={v => set('city', v)}
                    placeholder="e.g. Ahmedabad"
                    maxLength={80}
                  />
                  {hasProfileLocation ? (
                    <Chip
                      label="Use profile location"
                      icon="refresh"
                      onPress={() => {
                        setForm(prev => ({
                          ...prev,
                          state: user?.state ?? prev.state,
                          city: user?.city ?? prev.city,
                        }));
                        setEditingLocation(false);
                      }}
                    />
                  ) : null}
                </SectionCard>
              )}

              <SectionCard title="Daily activity level">
                <ChoiceChips options={ACTIVITY_OPTIONS} value={form.activityLevel} onChange={v => set('activityLevel', v)} />
                <Text style={[typography.caption, { marginTop: spacing.sm }]}>
                  Sedentary = desk job, little exercise · Very active = heavy work or daily intense workouts
                </Text>
              </SectionCard>
            </>
          ) : null}

          {/* ----------------------------- Step 2 ----------------------------- */}
          {step === 1 ? (
            <>
              <SectionCard title="Your primary goal">
                <ChoiceChips options={GOAL_OPTIONS} value={form.goal} onChange={v => set('goal', v)} />
              </SectionCard>

              <SectionCard
                title="Health information"
                hint="Optional — but it helps the plan stay safe for you."
              >
                <TextField
                  label="Existing medical conditions (optional)"
                  value={form.medicalConditions}
                  onChangeText={v => set('medicalConditions', v)}
                  placeholder="e.g. diabetes, PCOS, thyroid (comma separated)"
                  multiline
                  maxLength={300}
                />
                <TextField
                  label="Food allergies & intolerances"
                  value={form.allergies}
                  onChangeText={v => set('allergies', v)}
                  placeholder="e.g. peanuts, milk, gluten (comma separated)"
                  multiline
                  maxLength={300}
                />
                <Text style={[typography.caption, { marginTop: -spacing.md, marginBottom: spacing.md }]}>
                  We ask for this so the AI never includes these foods in your meals.
                </Text>
                <TextField
                  label="Dietary restrictions (optional)"
                  value={form.dietaryRestrictions}
                  onChangeText={v => set('dietaryRestrictions', v)}
                  placeholder="e.g. no onion-garlic, Jain, no red meat"
                  multiline
                  maxLength={300}
                />
                <TextField
                  label="Current medications (optional)"
                  value={form.medications}
                  onChangeText={v => set('medications', v)}
                  placeholder="Only if you want to share"
                  multiline
                  maxLength={300}
                />
                <Text style={[typography.caption, { marginTop: -spacing.md, marginBottom: spacing.md }]}>
                  Shared voluntarily. The plan will never suggest changing any medicine.
                </Text>

                {form.sex === 'female' || form.sex === 'other' || form.sex === 'prefer_not_to_say' || !form.sex ? (
                  <>
                    <Text style={styles.fieldLabel}>Pregnancy or breastfeeding</Text>
                    <ChoiceChips
                      options={PREGNANCY_OPTIONS}
                      value={form.pregnancyStatus}
                      onChange={v => set('pregnancyStatus', v)}
                    />
                    <View style={{ height: spacing.md }} />
                  </>
                ) : null}

                <TextField
                  label="Exercise routine (optional)"
                  value={form.exerciseRoutine}
                  onChangeText={v => set('exerciseRoutine', v)}
                  placeholder="e.g. gym 4 days/week, evening walks"
                  maxLength={300}
                />
                <TextField
                  label="Sleep schedule (optional)"
                  value={form.sleepSchedule}
                  onChangeText={v => set('sleepSchedule', v)}
                  placeholder="e.g. 11pm–6am"
                  maxLength={200}
                />
                <TextField
                  label="Daily routine (optional)"
                  value={form.dailyRoutine}
                  onChangeText={v => set('dailyRoutine', v)}
                  placeholder="e.g. shift work, long commute"
                  maxLength={300}
                />
              </SectionCard>
            </>
          ) : null}

          {/* ----------------------------- Step 3 ----------------------------- */}
          {step === 2 ? (
            <>
              <SectionCard title="Diet type">
                <ChoiceChips options={DIET_TYPE_OPTIONS} value={form.dietType} onChange={v => set('dietType', v)} />
                {form.dietType === 'other' ? (
                  <View style={{ marginTop: spacing.md }}>
                    <TextField
                      value={form.dietTypeOther}
                      onChangeText={v => set('dietTypeOther', v)}
                      placeholder="Tell us your diet type"
                      maxLength={80}
                    />
                  </View>
                ) : null}
              </SectionCard>

              <SectionCard title="Food preferences" hint="Meals will be built around what you actually enjoy.">
                <SelectField
                  label="Preferred cuisine"
                  value={form.cuisine}
                  options={CUISINE_OPTIONS}
                  onChange={v => set('cuisine', v)}
                />
                <TextField
                  label="Favorite foods (optional)"
                  value={form.favoriteFoods}
                  onChangeText={v => set('favoriteFoods', v)}
                  placeholder="e.g. dal khichdi, thepla, curd rice"
                  multiline
                  maxLength={300}
                />
                <TextField
                  label="Disliked foods (optional)"
                  value={form.dislikedFoods}
                  onChangeText={v => set('dislikedFoods', v)}
                  placeholder="e.g. bitter gourd, beetroot"
                  multiline
                  maxLength={300}
                />
              </SectionCard>

              <SectionCard title="Meal routine">
                <Text style={styles.fieldLabel}>Meals per day</Text>
                <View style={styles.chipWrap}>
                  {[3, 4, 5, 6].map(count => (
                    <Chip
                      key={count}
                      label={`${count} meals`}
                      active={form.mealsPerDay === count}
                      onPress={() => set('mealsPerDay', count)}
                    />
                  ))}
                </View>
                <View style={{ height: spacing.md }} />
                <TextField
                  label="Preferred meal timings (optional)"
                  value={form.mealTimings}
                  onChangeText={v => set('mealTimings', v)}
                  placeholder="e.g. breakfast 8am, lunch 1pm, dinner 8pm"
                  multiline
                  maxLength={300}
                />
              </SectionCard>

              <SectionCard title="Budget & cooking">
                <Text style={styles.fieldLabel}>Food budget</Text>
                <ChoiceChips options={BUDGET_OPTIONS} value={form.budget} onChange={v => set('budget', v)} />
                <View style={{ height: spacing.md }} />
                <Text style={styles.fieldLabel}>Cooking preference</Text>
                <ChoiceChips options={COOKING_OPTIONS} value={form.cookingPreference} onChange={v => set('cookingPreference', v)} />
                <View style={{ height: spacing.md }} />
                <TextField
                  label="Dietary, cultural or personal restrictions (optional)"
                  value={form.restrictionsNotes}
                  onChangeText={v => set('restrictionsNotes', v)}
                  placeholder="Anything else the plan should respect"
                  multiline
                  maxLength={400}
                />
              </SectionCard>
            </>
          ) : null}

          {/* ----------------------------- Step 4 ----------------------------- */}
          {step === 3 ? (
            <>
              {weekPlanExists ? (
                <Card style={[styles.noteCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                  <View style={styles.noteRow}>
                    <Icon name="info" size={16} color={colors.warningText} />
                    <Text style={[typography.small, { flex: 1, color: colors.warningText }]}>
                      You already have a plan for this week. Generating a new one keeps the old plan in your history — nothing is deleted.
                    </Text>
                  </View>
                </Card>
              ) : null}

              <SectionCard title="Review your answers" hint="Tap Edit on any row to change it.">
                {reviewRows.map(row => (
                  <ReviewRow key={row.label} label={row.label} value={row.value} onEdit={() => jumpToStep(row.stepIndex)} />
                ))}
              </SectionCard>

              <Card style={styles.noteCard}>
                <View style={styles.noteRow}>
                  <Icon name="shield-check" size={16} color={colors.primary} />
                  <Text style={[typography.small, { flex: 1 }]}>
                    This plan is general nutrition guidance only — not a medical diagnosis or a substitute for
                    professional advice. Calorie and nutrient values are estimates. Talk to a doctor or registered
                    dietitian before making big diet changes.
                  </Text>
                </View>
              </Card>

              {generateError ? (
                <Card style={[styles.noteCard, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
                  <View style={styles.noteRow}>
                    <Icon name="alert-triangle" size={16} color={colors.danger} />
                    <Text style={[typography.small, { flex: 1, color: colors.danger }]}>{generateError}</Text>
                  </View>
                </Card>
              ) : null}

              <AppButton
                label={generating ? 'Generating…' : 'Generate My 7-Day Diet Plan'}
                icon={generating ? undefined : 'sparkles'}
                onPress={generate}
                loading={generating}
                disabled={generating}
                variant="accent"
                size="lg"
              />
              {generating ? (
                <Text style={[typography.caption, { textAlign: 'center', marginTop: spacing.md }]}>
                  Building your personalized week — this can take up to a minute. Please don’t press again.
                </Text>
              ) : null}
            </>
          ) : null}

          {stepError ? (
            <View style={styles.stepError}>
              <Icon name="alert-triangle" size={14} color={colors.danger} />
              <Text style={[typography.small, { color: colors.danger, flex: 1 }]}>{stepError}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer — Back / Continue */}
        {step < 3 ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            {step > 0 ? (
              <View style={{ flex: 1 }}>
                <AppButton label="Back" icon="chevron-left" variant="outline" onPress={goBack} />
              </View>
            ) : null}
            <View style={step > 0 ? { flex: 1.6 } : { flex: 1 }}>
              <AppButton label="Continue" icon="chevron-right" onPress={goNext} />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cardMuted,
  },
  progressSegmentActive: { backgroundColor: colors.blue },
  sectionCard: { marginBottom: spacing.md },
  fieldLabel: { ...typography.smallMedium, color: colors.text, marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  unitToggle: { flexDirection: 'row', gap: 6 },
  rowGap: { flexDirection: 'row', gap: spacing.sm },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteCard: { marginBottom: spacing.md, borderColor: colors.border },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
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
});
