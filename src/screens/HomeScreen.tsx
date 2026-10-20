/**
 * Home — dashboard: quick actions, services, featured doctors (2×2 grid).
 * Saari data calls src/api/api.ts se hain.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon, { IconName } from '../components/Icon';
import { Logo } from '../components/Logo';
import DoctorCard from '../components/DoctorCard';
import NearbyMap from '../components/NearbyMap';
import HeroSection from '../components/HeroSection';
import HowItWorksCard from '../components/HowItWorksCard';
import {
  AppButton,
  Card,
  GradientCard,
  Loader,
  Screen,
  SectionHeader,
} from '../components/UI';
import api, { apiOrigin, DietPlanListItem, Doctor, HealthcareService } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, StaffType } from '../navigation/types';

import { colors, gradients, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMERGENCY_NUMBER = '1800-123-456';

/**
 * Doctor cards grid me hain (2 columns) — width aisi ke 2 rows × 2 cards = 4
 * cards home tab par screen me hi dikh jayein, View All se poori list.
 */
const CARD_GAP = spacing.md;
const CARD_WIDTH = Math.floor((Dimensions.get('window').width - spacing.lg * 2 - CARD_GAP) / 2);

function avatarUrl(avatar?: string): string | undefined {
  if (!avatar) return undefined;
  if (/^https?:\/\//i.test(avatar)) return avatar;
  const origin = apiOrigin();
  return `${origin}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
}

/** 'YYYY-MM-DD' → '12 Oct' (home screen plan cards ke liye). */
function shortPlanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]}`;
}

const GOAL_SHORT: Record<string, string> = {
  weight_loss: 'Weight loss',
  weight_gain: 'Weight gain',
  muscle_building: 'Muscle building',
  weight_maintenance: 'Maintenance',
  general_healthy_eating: 'Healthy eating',
};

const FALLBACK_SERVICES: HealthcareService[] = [
  { id: 's1', name: 'Doctor Home Visits', description: 'Verified doctors at your door', icon: 'stethoscope', category: 'Doctor' },
  { id: 's2', name: 'Lab Tests at Home', description: 'Free sample pickup, reports in 24h', icon: 'flask', category: 'Lab' },
  { id: 's3', name: 'Nursing & Compounder', description: 'Dressing, IV & injections', icon: 'heart-pulse', category: 'Nursing' },
  { id: 's4', name: 'Emergency ICU Ambulance', description: '24/7 rapid response', icon: 'ambulance', category: 'Emergency' },
  { id: 's5', name: 'Elder & Physio Care', description: 'Home visits & care plans', icon: 'users', category: 'Elder' },
  /* Medicines delivery hata diya — jagah par Care Takers */
  { id: 's6', name: 'Care Takers', description: 'Elder & patient care at home', icon: 'hand-heart', category: 'Care', route: 'Doctors' },
];

const CARE_SERVICE: HealthcareService = {
  id: 's-care',
  name: 'Care Takers',
  description: 'Verified caretakers for elder & patient care',
  icon: 'hand-heart',
  category: 'Care',
  route: 'Doctors',
};

type QuickRoute = 'Doctors' | 'Labs' | 'PrescriptionReader' | 'Appointments' | 'DietPlanner';

/** Har quick action ka apna accent — solid icon badge + matching chevron tint. */
const TILE_BADGES = StyleSheet.create({
  blue: { backgroundColor: colors.blue, shadowColor: colors.blue },
  teal: { backgroundColor: colors.primary, shadowColor: colors.primary },
  violet: { backgroundColor: colors.violet, shadowColor: colors.violet },
  green: { backgroundColor: colors.accent, shadowColor: colors.accent },
});

const TILE_CHEVRONS = StyleSheet.create({
  blue: { backgroundColor: colors.infoLight },
  teal: { backgroundColor: colors.primaryLight },
  violet: { backgroundColor: colors.violetSoft },
  green: { backgroundColor: colors.accentLight },
});

type QuickAccent = keyof typeof TILE_BADGES;

/** Chevron ka foreground — palette key, render par resolve hota hai (dark mode aware). */
type AccentToken = 'blue' | 'primaryDark' | 'violet' | 'accent';
const ACCENT_TOKEN: Record<QuickAccent, AccentToken> = {
  blue: 'blue',
  teal: 'primaryDark',
  violet: 'violet',
  green: 'accent',
};

const QUICK_ACTIONS: {
  label: string;
  sub: string;
  icon: IconName;
  route: QuickRoute;
  type?: StaffType;
  accent?: QuickAccent;
  featured?: boolean;
}[] = [
  /* Pehla tile = user ki khud ki bookings (doctor/caretaker/lab — sab ek jagah). */
  { label: 'My Appointments', sub: 'Your booked visits', icon: 'calendar', route: 'Appointments', accent: 'blue' },
  { label: 'Find Doctors', sub: 'Near you', icon: 'search', route: 'Doctors', type: 'doctor', accent: 'teal' },
  { label: 'Lab Tests', sub: 'Home collection', icon: 'flask', route: 'Labs', accent: 'violet' },
  /* Medicines quick action hata diya — Care Takers ab yahan */
  { label: 'Care Takers', sub: 'Elder & patient care', icon: 'hand-heart', route: 'Doctors', type: 'caretaker', accent: 'green' },
  /* Featured tile — poori width ka gradient banner (chhote grid me akela card nahi) */
  { label: 'Prescription Reader', sub: 'Scan & understand RX with AI', icon: 'file-text', route: 'PrescriptionReader', accent: 'blue', featured: true },
];

export default function HomeScreen(): React.JSX.Element {
  useThemePreference();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<HealthcareService[]>([]);
  const [dietPlans, setDietPlans] = useState<DietPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  /** Care nearby map ka selected filter — 'Available for Booking' section ko sync rakhta hai. */
  const [nearbyFilter, setNearbyFilter] = useState<StaffType>('doctor');
  const userAvatar = avatarFailed ? undefined : avatarUrl(user?.avatar);
  const userInitial = user?.name?.trim().charAt(0).toUpperCase() || 'U';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      /* Nearby map ka filter 'Available for Booking' section ko bhi drive karta hai —
         Labs chip dabane par labs dikhte hain, Doctors par wapas doctors. */
      const docQuery =
        nearbyFilter === 'doctor'
          ? { homeVisit: true }
          : { type: nearbyFilter };
      const [docRes, svcRes, dietRes] = await Promise.allSettled([
        api.doctors.list(docQuery),
        api.services.list(),
        /* Diet plans sirf logged-in user ke liye (auth endpoint) — failure par
           home screen khaali history section ke saath bhi theek chalta hai. */
        isLoggedIn ? api.dietPlans.list() : Promise.reject(new Error('not logged in')),
      ]);
      if (docRes.status === 'fulfilled') {
        /* Home tab par hamesha 4 cards (2 rows × 2) — View All par poori list. */
        setDoctors(docRes.value.slice(0, 4));
      }
      if (svcRes.status === 'fulfilled' && svcRes.value.length > 0) {
        setServices(svcRes.value.slice(0, 6));
      }
      if (dietRes.status === 'fulfilled') {
        setDietPlans(dietRes.value);
      } else {
        setDietPlans([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, nearbyFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const callEmergency = () => {
    Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {});
  };

  /* route: string — service tiles backend/static list se aate hain, unka
     koi bhi route ho (ya galat ho) to Doctors par land karte hain. */
  const go = (route: string, type?: StaffType) => {
    if (route === 'Labs') {
      navigation.navigate('Main', { screen: 'Labs' });
    } else if (route === 'PrescriptionReader') {
      navigation.navigate('PrescriptionReader');
    } else if (route === 'Appointments') {
      navigation.navigate('Appointments');
    } else if (route === 'DietPlanner') {
      navigation.navigate('DietPlannerLanding');
    } else {
      /* type hamesha bhejo (doctor/caretaker/…) — undefined bhejne par purana
         filter (jaise Care Takers) Doctors tab me reh jaata tha. openedAt se
         har tap ek nayi intent — chahe type pehle se wahi kyun na ho. */
      navigation.navigate('Main', {
        screen: 'Doctors',
        params: { type: type ?? 'doctor', openedAt: Date.now() },
      });
    }
  };

  /** Medicines/pharmacy entries UI se hata diye (segment disabled) + Care Takers ensure. */
  const visibleServices = React.useMemo(() => {
    const base = (services.length ? services : FALLBACK_SERVICES).filter(
      s => !/medicine|pharmacy/i.test(`${s.name} ${s.category ?? ''} ${s.description ?? ''}`),
    );
    const hasCare = base.some(s => /caretaker|elder/i.test(`${s.name} ${s.category ?? ''}`));
    return [...(hasCare ? [] : [CARE_SERVICE]), ...base].slice(0, 6);
  }, [services]);

  /* Is hafte ka plan (aaj date week range me) = current; baaki history. */
  const { currentDietPlan, pastDietPlans } = React.useMemo(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const current = dietPlans.find(p => p.weekStart <= todayStr && todayStr <= p.weekEnd);
    return {
      currentDietPlan: current,
      pastDietPlans: dietPlans.filter(p => p.id !== current?.id).slice(0, 8),
    };
  }, [dietPlans]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
      >
        {/* ------------------------------- Top bar ------------------------------ */}
        <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
          <View style={styles.topRow}>
            <Logo width={108} />
            <Pressable
              style={styles.avatarButton}
              onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              {userAvatar ? (
                <Image source={{ uri: userAvatar }} style={styles.avatarImage} onError={() => setAvatarFailed(true)} />
              ) : (
                <Text style={styles.avatarInitial}>{userInitial}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* -------------------------------- Hero ------------------------------- */}
        <HeroSection
          onSosPress={() => navigation.navigate('Emergency')}
          onCallPress={callEmergency}
        />

        {/* ----------------------------- Quick actions -------------------------- */}
        <View style={styles.section}>
          <SectionHeader title="Quick Actions" subtitle="For faster and easier care" />
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.filter(action => !action.featured).map(action => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.quickTile, pressed && { opacity: 0.85 }]}
                onPress={() => go(action.route, action.type)}
              >
                <View style={styles.quickTopRow}>
                  <View style={[styles.quickIcon, TILE_BADGES[action.accent ?? 'blue']]}>
                    <Icon name={action.icon} size={17} color={colors.textInverse} />
                  </View>
                  <View style={[styles.quickChevron, TILE_CHEVRONS[action.accent ?? 'blue']]}>
                    <Icon name="chevron-right" size={11} color={colors[ACCENT_TOKEN[action.accent ?? 'blue']]} />
                  </View>
                </View>
                <Text style={styles.quickLabel} numberOfLines={1}>
                  {action.label}
                </Text>
                <Text style={styles.quickSub} numberOfLines={1}>
                  {action.sub}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Featured action — full-width gradient banner */}
          {QUICK_ACTIONS.filter(action => action.featured).map(action => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [styles.featuredTile, pressed && { opacity: 0.9 }]}
              onPress={() => go(action.route, action.type)}
            >
              <GradientCard style={styles.featuredCard} from={colors.navySoft} to={colors.blue}>
                <View style={styles.featuredRow}>
                  <View style={styles.featuredIcon}>
                    <Icon name={action.icon} size={17} color={colors.textInverse} />
                  </View>
                  <View style={styles.featuredTexts}>
                    <Text style={styles.featuredLabel} numberOfLines={1}>
                      {action.label}
                    </Text>
                    <Text style={styles.featuredSub} numberOfLines={1}>
                      {action.sub}
                    </Text>
                  </View>
                  <View style={styles.featuredArrow}>
                    <Icon name="chevron-right" size={13} color={colors.textInverse} />
                  </View>
                </View>
              </GradientCard>
            </Pressable>
          ))}
        </View>

        {/* ----------------------- AI Weekly Diet Planner ---------------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="AI Weekly Diet Planner"
            subtitle="Personalized 7-day meal plan for your goals"
          />
          <GradientCard style={styles.dietCard} from={gradients.diet[0]} to={gradients.diet[1]}>
            <View style={styles.dietInner}>
              <View style={styles.dietIcon}>
                <Icon name="utensils" size={18} color={colors.textInverse} />
              </View>
              <Text style={styles.dietTitle}>AI Weekly Diet Planner</Text>
              <Text style={styles.dietSub}>
                Get a personalized 7-day diet plan based on your health goals and food preferences.
              </Text>

              {currentDietPlan ? (
                <Pressable
                  style={({ pressed }) => [styles.dietCurrent, pressed && { opacity: 0.85 }]}
                  onPress={() =>
                    navigation.navigate('DietPlanResult', { planId: currentDietPlan.id })
                  }
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dietCurrentTitle} numberOfLines={1}>
                      This week’s plan ·{' '}
                      {GOAL_SHORT[currentDietPlan.summary?.goal ?? ''] ?? currentDietPlan.summary?.goal ?? 'Healthy eating'}
                    </Text>
                    <Text style={styles.dietCurrentSub}>
                      {shortPlanDate(currentDietPlan.weekStart)} – {shortPlanDate(currentDietPlan.weekEnd)}
                      {currentDietPlan.summary?.avgCalories ? ` · ~${currentDietPlan.summary.avgCalories} kcal/day` : ''}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={16} color={colors.textInverse} />
                </Pressable>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.dietCta, pressed && { opacity: 0.9 }]}
                onPress={() => go('DietPlanner')}
                accessibilityRole="button"
                accessibilityLabel="Create My Diet Plan"
              >
                <Icon name="sparkles" size={15} color={colors.violetInk} />
                <Text style={styles.dietCtaText}>Create My Diet Plan</Text>
              </Pressable>
            </View>
          </GradientCard>

          {/* Previous plans — history */}
          {pastDietPlans.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <SectionHeader title="Previous Plans" subtitle={`${pastDietPlans.length} saved plan${pastDietPlans.length === 1 ? '' : 's'}`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: CARD_GAP }}>
                {pastDietPlans.map(plan => (
                  <Pressable
                    key={plan.id}
                    style={({ pressed }) => [styles.pastPlanCard, pressed && { opacity: 0.85 }]}
                    onPress={() => navigation.navigate('DietPlanResult', { planId: plan.id })}
                  >
                    <View style={styles.pastPlanIcon}>
                      <Icon name="calendar" size={15} color={colors.primary} />
                    </View>
                    <Text style={typography.smallMedium} numberOfLines={1}>
                      {shortPlanDate(plan.weekStart)} – {shortPlanDate(plan.weekEnd)}
                    </Text>
                    <Text style={typography.caption} numberOfLines={1}>
                      {GOAL_SHORT[plan.summary?.goal ?? ''] ?? plan.summary?.goal ?? 'Healthy eating'}
                      {plan.version > 1 ? ` · v${plan.version}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {/* --------------------------- Care nearby map ------------------------ */}
        <View style={styles.section}>
          <SectionHeader
            title="Care nearby"
            subtitle="Medical staff around you — tap a pin to book"
          />
          <NearbyMap
            onSelect={provider => navigation.navigate('DoctorDetail', { doctorId: provider.id })}
            onFilterChange={type => setNearbyFilter(type as StaffType)}
          />
        </View>

        {/* ---------------------------- Featured doctors ------------------------ */}
        <View style={styles.section}>
          <SectionHeader
            title="Available for Booking"
            subtitle={
              nearbyFilter === 'lab'
                ? 'Diagnostic labs near you'
                : nearbyFilter === 'caretaker'
                  ? 'Caretakers for home visits'
                  : 'Medical staff for home visits'
            }
            actionLabel="View All"
            onAction={() =>
              nearbyFilter === 'lab'
                ? navigation.navigate('Main', { screen: 'Labs' })
                : navigation.navigate('Main', {
                    screen: 'Doctors',
                    params: { type: nearbyFilter === 'doctor' ? 'doctor' : nearbyFilter, openedAt: Date.now() },
                  })
            }
          />

          {loading ? (
            <Card>
              <Loader label="Loading medical staff…" />
            </Card>
          ) : doctors.length === 0 ? (
            <Card>
              <Text style={[typography.small, { textAlign: 'center' }]}>
                No staff listed right now. Pull to refresh.
              </Text>
            </Card>
          ) : (
            <>
              {/* 2 rows × 2 cards — home tab par hamesha 4 cards dikhte hain */}
              <View style={styles.doctorGrid}>
                {doctors.map(d => (
                  <View key={d.id} style={styles.doctorGridItem}>
                    <DoctorCard
                      doctor={d}
                      onPress={() => navigation.navigate('DoctorDetail', { doctorId: d.id })}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ------------------------------- Services ----------------------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Health Services"
            subtitle="Comprehensive care at your fingertips"
            actionLabel="All"
            onAction={() => navigation.navigate('Services')}
          />
          <View style={styles.serviceGrid}>
            {visibleServices.map(service => (
              <Pressable
                key={service.id}
                style={({ pressed }) => [styles.serviceTile, pressed && { opacity: 0.85 }]}
                onPress={() => go(service.route || 'Doctors')}
              >
                <View style={styles.serviceIcon}>
                  <Icon name={(service.icon as IconName) || 'activity'} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.smallMedium} numberOfLines={1}>
                    {service.name}
                  </Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {service.description}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* -------------------------------- Stats ------------------------------- */}
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <View style={styles.statsRow}>
            {[
              { icon: 'clock' as IconName, value: '24/7', label: 'Available now' },
              { icon: 'users' as IconName, value: '50+', label: 'Certified staff' },
              { icon: 'award' as IconName, value: '4.9', label: 'Average rating' },
            ].map(s => (
              <Card key={s.label} style={styles.statCard} padded={false}>
                <View style={{ padding: spacing.sm, alignItems: 'center' }}>
                  <View style={styles.statIcon}>
                    <Icon name={s.icon} size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={[typography.caption, { textAlign: 'center' }]} numberOfLines={1}>
                    {s.label}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* ------------------------ How it works (dropdown) ------------------ */}
        <View style={styles.section}>
          <HowItWorksCard />
        </View>

        {!isLoggedIn ? (
          <View style={styles.section}>
            <Card>
              <Text style={typography.h4}>Book faster with an account</Text>
              <Text style={[typography.small, { marginTop: 4 }]}>
                Save health details and track prescriptions & lab reports in one place.
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <AppButton label="Sign In / Register" onPress={() => navigation.navigate('Auth')} />
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.card,
    ...shadow.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { ...typography.smallMedium, color: colors.primary, fontSize: 14 },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.lg },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickTile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 3,
    ...shadow.card,
  },
  quickTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 3,
  },
  quickChevron: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...typography.smallMedium, fontSize: 13.5, letterSpacing: -0.2 },
  quickSub: { ...typography.caption, fontSize: 11, lineHeight: 14 },
  featuredTile: { marginTop: spacing.sm, borderRadius: 14 },
  featuredCard: { width: '100%', borderRadius: 14 },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  featuredIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredTexts: { flex: 1, gap: 1 },
  featuredLabel: { ...typography.smallMedium, fontSize: 14, color: colors.textInverse },
  featuredSub: { ...typography.caption, color: 'rgba(255,255,255,0.82)' },
  featuredArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietCard: { borderRadius: 14 },
  dietInner: { padding: spacing.md, gap: 6 },
  dietIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dietTitle: { ...typography.h4, color: colors.textInverse },
  dietSub: { ...typography.caption, color: 'rgba(255,255,255,0.9)', lineHeight: 15 },
  dietCurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  dietCurrentTitle: { ...typography.smallMedium, color: colors.textInverse },
  dietCurrentSub: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },
  dietCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    /* Near-white pill — rich gradient par sabse zyada pop. `#FFFFFF` nahi:
       dark mode me wo DARK.card bana deta (theme ka white→surface rule). */
    backgroundColor: colors.ctaBg,
    borderRadius: radius.sm,
    height: 40,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(11, 27, 46, 0.10)',
  },
  dietCtaText: { ...typography.button, color: colors.violetInk, fontSize: 13.5 },
  pastPlanCard: {
    width: 168,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4,
    ...shadow.card,
  },
  pastPlanIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1 },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { ...typography.h4, color: colors.primary },
  serviceGrid: { gap: spacing.sm },
  serviceTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    ...shadow.card,
  },
  serviceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Doctors grid — 2 columns, har card CARD_WIDTH ka */
  doctorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  doctorGridItem: { width: CARD_WIDTH },
});
