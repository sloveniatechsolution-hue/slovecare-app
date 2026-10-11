/**
 * Home — dashboard: quick actions, services, featured doctors, live bed status.
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
import {
  AppButton,
  Badge,
  Card,
  GradientCard,
  Loader,
  Screen,
  SectionHeader,
} from '../components/UI';
import api, { apiOrigin, Doctor, HealthcareService, HospitalBed } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList, StaffType } from '../navigation/types';

import { colors, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMERGENCY_NUMBER = '1800-123-456';

/**
 * Featured cards chhote hain taaki horizontal scroll me ek baar 2 cards aa jayein —
 * screen ki visible width (section padding ke baad) me gap ke saath 2 cards fit.
 */
const CARD_GAP = spacing.md;
const CARD_WIDTH = Math.floor((Dimensions.get('window').width - spacing.lg * 2 - CARD_GAP) / 2);

function avatarUrl(avatar?: string): string | undefined {
  if (!avatar) return undefined;
  if (/^https?:\/\//i.test(avatar)) return avatar;
  const origin = apiOrigin();
  return `${origin}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
}

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

type QuickRoute = 'Doctors' | 'Labs' | 'PrescriptionReader' | 'Appointments';

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

const STEPS = [
  { no: '01', icon: 'calendar' as IconName, title: 'Book Appointment', text: 'Pick a doctor, nurse or lab test in seconds.' },
  { no: '02', icon: 'home' as IconName, title: 'Professional Arrives', text: 'Certified staff reaches your door with equipment.' },
  { no: '03', icon: 'stethoscope' as IconName, title: 'Treatment & Care', text: 'Checkup, sample pickup or emergency support.' },
  { no: '04', icon: 'file-text' as IconName, title: 'Digital Report', text: 'Prescription & reports on your phone instantly.' },
];

export default function HomeScreen(): React.JSX.Element {
  useThemePreference();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<HealthcareService[]>([]);
  const [beds, setBeds] = useState<HospitalBed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const userAvatar = avatarFailed ? undefined : avatarUrl(user?.avatar);
  const userInitial = user?.name?.trim().charAt(0).toUpperCase() || 'U';

  const load = useCallback(async () => {
    try {
      const [docRes, svcRes, bedRes] = await Promise.allSettled([
        api.doctors.list({ homeVisit: true }),
        api.services.list(),
        api.hospitals.beds(),
      ]);
      if (docRes.status === 'fulfilled') {
        setDoctors(docRes.value.slice(0, 6));
      }
      if (svcRes.status === 'fulfilled' && svcRes.value.length > 0) {
        setServices(svcRes.value.slice(0, 6));
      }
      if (bedRes.status === 'fulfilled') {
        setBeds(bedRes.value.slice(0, 3));
      }
    } finally {
      setLoading(false);
    }
  }, []);

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

        {/* --------------------------- Care nearby map ------------------------ */}
        <View style={styles.section}>
          <SectionHeader
            title="Care nearby"
            subtitle="Medical staff around you — tap a pin to book"
          />
          <NearbyMap onSelect={provider => navigation.navigate('DoctorDetail', { doctorId: provider.id })} />
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

        {/* ---------------------------- Featured doctors ------------------------ */}
        <View style={styles.section}>
          <SectionHeader
            title="Available for Booking"
            subtitle="Medical staff for home visits"
            actionLabel="View All"
            onAction={() => navigation.navigate('Main', { screen: 'Doctors' })}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: CARD_GAP }}>
              {doctors.map(d => (
                <View key={d.id} style={{ width: CARD_WIDTH }}>
                  <DoctorCard
                    doctor={d}
                    onPress={() => navigation.navigate('DoctorDetail', { doctorId: d.id })}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* --------------------------- Live bed status -------------------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Live Bed Availability"
            subtitle="Hospital status near you"
            actionLabel="Refresh"
            onAction={load}
          />
          {beds.length === 0 ? (
            <Card>
              <View style={styles.bedEmpty}>
                <Icon name="bed" size={18} color={colors.textMuted} />
                <Text style={[typography.small, { textAlign: 'center' }]}>
                  No live ward data available yet.
                </Text>
              </View>
            </Card>
          ) : (
            beds.map(bed => (
              <Card key={bed.id} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={typography.h4} numberOfLines={1}>
                    {bed.hospitalName}
                  </Text>
                  <Badge label="Live" tone="danger" icon="activity" />
                </View>
                <View style={styles.bedRow}>
                  {[
                    { label: 'General', v: bed.availableGeneralBeds ?? 0 },
                    { label: 'ICU', v: bed.availableIcuBeds ?? 0 },
                    { label: 'Oxygen', v: bed.availableOxygenBeds ?? 0 },
                  ].map(b => (
                    <View key={b.label} style={styles.bedChip}>
                      <Text style={styles.bedValue}>{b.v}</Text>
                      <Text style={typography.caption}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            ))
          )}
        </View>

        {/* ------------------------------ How it works -------------------------- */}
        <View style={styles.section}>
          <SectionHeader title="How SloveCare Works" subtitle="4 quick steps to doorstep care" />
          <View style={{ gap: spacing.md }}>
            {STEPS.map(step => (
              <Card key={step.no} style={styles.stepCard}>
                <View style={styles.stepIcon}>
                  <Icon name={step.icon} size={16} color={colors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.smallMedium}>{step.title}</Text>
                  <Text style={[typography.caption, { marginTop: 2 }]}>{step.text}</Text>
                </View>
                <Text style={styles.stepNo}>{step.no}</Text>
              </Card>
            ))}
          </View>
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
  bedEmpty: { alignItems: 'center', gap: 8, paddingVertical: spacing.sm },
  bedRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  bedChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.cardMuted,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bedValue: { ...typography.price, color: colors.primary, fontSize: 16 },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNo: { fontSize: 17, fontWeight: '800', color: colors.border },
});
