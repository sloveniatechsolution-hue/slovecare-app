/**
 * Doctors — search + specialty chips + distance filter + location detect.
 * Backend: GET /api/v1/doctors (verified staff), GET /api/v1/vendors.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Icon from '../components/Icon';
import DoctorCard from '../components/DoctorCard';
import { AppButton, Chip, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { Doctor, VendorType } from '../api/api';
import { locationHelpAlert, requestFreshLocation, requestLocation, reverseGeocode } from '../utils/location';
import { RootStackParamList, StaffType, TabParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DoctorsRoute = RouteProp<TabParamList, 'Doctors'>;

const SPECIALTIES = [
  'All',
  'General Physician',
  'Pediatrician',
  'Cardiologist',
  'Physiotherapist',
  'Psychologist',
  'Compounders',
  'Nurses',
  'Care Takers',
];

const DISTANCES = [
  { label: 'All', value: 0 },
  { label: '< 3 km', value: 3 },
  { label: '< 5 km', value: 5 },
  { label: '< 10 km', value: 10 },
  { label: '< 25 km', value: 25 },
];

/**
 * Chip → backend query.
 * Staff categories (compounder/nurse/caretaker) `type` param se aati hain kyunki
 * unka doctorDetails.specialization field nahi hota.
 */
function staffQuery(chip: string): { type?: VendorType; specialty?: string } {
  switch (chip) {
    case 'All':
      return {};
    case 'Compounders':
      return { type: 'compounder' };
    case 'Nurses':
      return { type: 'nurse' };
    case 'Care Takers':
      return { type: 'caretaker' };
    default:
      return { specialty: chip };
  }
}

/** Route param (Home ke quick action se) → chip. */
function chipForType(type?: StaffType): string {
  switch (type) {
    case 'doctor':
      return 'All';
    case 'compounder':
      return 'Compounders';
    case 'nurse':
      return 'Nurses';
    case 'caretaker':
      return 'Care Takers';
    default:
      return 'All';
  }
}

export default function DoctorsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DoctorsRoute>();
  const insets = useSafeAreaInsets();

  const paramType = route.params?.type;
  /** Har quick action tap = nayi intent (params merge hone ke bawajood filter apply ho). */
  const openedAt = route.params?.openedAt;

  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [radiusKm, setRadiusKm] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Filter ka source: route param (Home quick action) ya user ki apni chip.
   * Route se aaya filter tab tak "stale" hai — jab tak user khud koi chip na
   * chune, Doctors tab dobara tap par All par reset ho jaana chahiye, warna
   * Care Takers wala filter wapas aakar doctors ko gayab kar deta tha.
   */
  const paramDrivenRef = useRef(Boolean(route.params?.type));

  /* Home/quick action se aaya staff-type param (jaise Care Takers) chip me badal do */
  useEffect(() => {
    if (paramType) {
      paramDrivenRef.current = true;
      setSpecialty(chipForType(paramType));
    } else if (paramDrivenRef.current) {
      // Quick action ne filter hata diya (type undefined) — wapas All par jao.
      paramDrivenRef.current = false;
      setSpecialty('All');
    }
  }, [paramType, openedAt]);

  /* Doctors tab dobara tap → route se aaya filter hata do. User ki manually
     chuni hui chips (Cardiologist waghera) waisi hi rehti hain. */
  useEffect(() => {
    const tabNavigation = navigation as unknown as BottomTabNavigationProp<TabParamList>;
    const unsubscribe = tabNavigation.addListener('tabPress', () => {
      if (paramDrivenRef.current) {
        paramDrivenRef.current = false;
        setSpecialty('All');
      }
    });
    return () => {
      unsubscribe();
    };
  }, [navigation]);

  /* Mount par hi location maango — tabhi "distance / Nearest first" filter
     meaning rakhta hai. Permission deny ho to list bina distance ke chalti hai
     (Detect button se dobara try kar sakte ho). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loc = await requestLocation();
      if (!cancelled && loc) {
        setCoords(loc);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Coordinates milte hi reverse geocode se jagah ka naam lo —
     "Location detected" ke aage user ko dikhe kahan track hua. */
  useEffect(() => {
    let cancelled = false;
    if (!coords) {
      setPlaceLabel(null);
      return;
    }
    setPlaceLabel(null);
    reverseGeocode(coords.lat, coords.lng).then(label => {
      if (!cancelled && label) {
        setPlaceLabel(label);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [coords]);

  const load = useCallback(
    async (searchText: string, spec: string, dist: number, location: { lat: number; lng: number } | null) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.doctors.list({
          search: searchText || undefined,
          ...staffQuery(spec),
          lat: location?.lat,
          lng: location?.lng,
          radiusKm: dist || undefined,
        });
        setDoctors(result);
      } catch (e) {
        setError((e as Error).message || 'Could not load doctors.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* search debounce */
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      load(query.trim(), specialty, radiusKm, coords);
    }, 350);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, specialty, radiusKm, coords, load]);

  const detectLocation = async () => {
    setDetecting(true);
    /* Fresh (non-cached) location — Detect dabne par purana stale fix na aaye,
       warna 10 km filter me paas ke providers bhi nahi dikhte. */
    const loc = await requestFreshLocation();
    setDetecting(false);
    if (loc) {
      setCoords(loc);
    } else {
      locationHelpAlert();
    }
  };

  const listData = useMemo(
    () => doctors,
    [doctors],
  );

  const header = (
    <View style={{ paddingBottom: spacing.md }}>
      {/* Search */}
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, specialty or city"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Icon name="x" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Location card */}
      <View style={styles.locationCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={styles.locIcon}>
            <Icon name="map-pin" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>PATIENT LOCATION</Text>
            <Text style={typography.smallMedium} numberOfLines={1}>
              {coords ? placeLabel || 'Location detected…' : 'Detect nearest doctors'}
            </Text>
            {coords ? (
              <Text style={styles.locMeta} numberOfLines={1}>
                {radiusKm ? `Nearest within ${radiusKm} km — sorted by distance` : 'Sorted by nearest first'}
              </Text>
            ) : null}
          </View>
        </View>
        <AppButton
          label={detecting ? 'Detecting…' : 'Detect'}
          icon="navigation"
          variant="accent"
          size="sm"
          full={false}
          loading={detecting}
          onPress={detectLocation}
        />
      </View>

      {/* Distance chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {DISTANCES.map(d => (
          <Chip
            key={d.label}
            label={d.label}
            active={radiusKm === d.value}
            onPress={() => setRadiusKm(d.value)}
          />
        ))}
      </ScrollView>

      {/* Specialty chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginTop: 8 }]}>
        {SPECIALTIES.map(s => (
          <Chip
            key={s}
            label={s}
            active={specialty === s}
            onPress={() => {
              paramDrivenRef.current = false; // user ka apna choice — ab reset mat karo
              setSpecialty(s);
            }}
          />
        ))}
      </ScrollView>

      <View style={styles.resultRow}>
        <Text style={typography.smallMedium}>
          {listData.length} professional{listData.length === 1 ? '' : 's'} found
          {radiusKm ? ` within ${radiusKm} km` : ''}
        </Text>
        <View style={styles.sortTag}>
          <Icon name="trending-up" size={13} color={colors.blue} />
          <Text style={[typography.caption, { color: colors.blue }]}>
            {coords ? 'Nearest first' : 'All listed staff'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <Screen>
      {/* Screen title */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={typography.h3}>Our Doctors & Medical Staff</Text>
        <Text style={[typography.small, { marginTop: 2 }]}>
          Book top-rated physicians, nurses & compounders for home visits.
        </Text>
      </View>

      {loading && doctors.length === 0 ? (
        <Loader label="Finding medical staff…" />
      ) : error && doctors.length === 0 ? (
        <ErrorState message={error} onRetry={() => load(query, specialty, radiusKm, coords)} />
      ) : listData.length === 0 ? (
        <EmptyState
          icon="search"
          title="No professionals found"
          subtitle="Try a different specialty or clear the distance filter."
          actionLabel="Clear Filters"
          onAction={() => {
            paramDrivenRef.current = false;
            setQuery('');
            setSpecialty('All');
            setRadiusKm(0);
          }}
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <DoctorCard
                doctor={item}
                variant="row"
                onPress={() => navigation.navigate('DoctorDetail', { doctorId: item.id })}
              />
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => load(query, specialty, radiusKm, coords)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  searchInput: { flex: 1, ...typography.body, paddingVertical: 0, color: colors.text },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  locIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  chipRow: { gap: 8, marginTop: spacing.md, paddingRight: spacing.lg },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  sortTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  listItem: { marginBottom: spacing.md },
});
