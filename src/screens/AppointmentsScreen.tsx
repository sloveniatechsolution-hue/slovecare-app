/**
 * Appointments — user ki bookings, status, cancel aur prescription view.
 * Backend: GET /auth/user/dashboard-data, PATCH /bookings/:id/status.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import { AppButton, Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { Booking, bookingTime } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'upcoming' | 'completed' | 'all';

/**
 * Live (chalu) bookings — backend inhe `new`/`upcoming`/`confirmed`/
 * `in_progress` me rakh sakta hai, isliye dono cover karne zaroori hain.
 */
const UPCOMING_STATUSES = ['new', 'upcoming', 'pending', 'confirmed', 'in_progress', 'active'];
const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected'];

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  new: 'warning',
  upcoming: 'info',
  confirmed: 'info',
  pending: 'warning',
  in_progress: 'warning',
  active: 'warning',
  completed: 'success',
  cancelled: 'danger',
  rejected: 'danger',
};

/** Booking ke serviceType → icon (backend me asli values in hain). */
const SERVICE_ICON: Record<string, IconName> = {
  home_visit: 'home',
  online_consultation: 'video',
  online: 'video',
  clinic_visit: 'building',
  doctor: 'stethoscope',
  lab_test: 'flask',
  medicine_order: 'pill',
  in_store: 'building',
  nursing: 'heart-pulse',
  nursing_care: 'heart-pulse',
  bed_booking: 'building',
};

/**
 * Vendor type → label/icon. Caretaker/nurse/compounder ki booking backend me
 * `home_visit` hi store hoti hai, isliye unke liye vendorType hi sach batata
 * hai ki card par kis tarah ka provider hai.
 */
const VENDOR_LABEL: Record<string, string> = {
  doctor: 'Doctor',
  compounder: 'Compounder',
  nurse: 'Nurse',
  caretaker: 'Care Taker',
  lab: 'Lab',
  pharmacy: 'Pharmacy',
  ambulance: 'Ambulance',
};

const VENDOR_ICON: Record<string, IconName> = {
  doctor: 'stethoscope',
  compounder: 'stethoscope',
  nurse: 'heart-pulse',
  caretaker: 'users',
  lab: 'flask',
  pharmacy: 'pill',
  ambulance: 'ambulance',
};

/** Card ka icon — specific serviceType pehle, warna vendor type. */
function bookingIcon(item: Booking): IconName {
  const specific = SERVICE_ICON[item.serviceType];
  const isGeneric = !specific || specific === 'home' || specific === 'video';
  if (!isGeneric) {
    return specific;
  }
  return VENDOR_ICON[item.vendorType ?? ''] ?? 'stethoscope';
}

/** "Doctor • Jayesh" jaisa caption — user ko pata chale kis type ki booking hai. */
function bookingCaption(item: Booking): string {
  const label = VENDOR_LABEL[item.vendorType ?? ''];
  const who = item.doctorName || item.vendorName;
  if (label && who && label.toLowerCase() !== who.toLowerCase()) {
    return `${label} • ${who}`;
  }
  return label || who || '';
}

export default function AppointmentsScreen({ navigation }: { navigation: Nav }): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (user) {
        const dashboard = await api.auth.dashboard().catch(() => null);
        if (dashboard) {
          setBookings(dashboard.bookings);
          setLoading(false);
          return;
        }
      }
      const list = await api.bookings.list({ userId: user?.id });
      setBookings(list);
    } catch (e) {
      setError((e as Error).message || 'Could not load appointments.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = (booking: Booking) => {
    Alert.alert('Cancel appointment?', `${booking.serviceName} on ${booking.date} will be cancelled.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(booking.id);
          try {
            await api.bookings.updateStatus(booking.id, 'cancelled');
            setBookings(prev => prev.map(b => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)));
          } catch (e) {
            Alert.alert('Error', (e as Error).message);
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  /**
   * Ordering: pehle chalu bookings (sabse pehle aane wali date upar), phir
   * band bookings (naye se purane). Dashboard insertion order par depend
   * nahi karta — user ko hamesha apni aane wali appointment dikhti hai.
   */
  const sorted = [...bookings].sort((a, b) => {
    const aLive = UPCOMING_STATUSES.includes(a.status);
    const bLive = UPCOMING_STATUSES.includes(b.status);
    if (aLive !== bLive) {
      return aLive ? -1 : 1;
    }
    if (a.date === b.date) {
      return 0;
    }
    return aLive ? (a.date < b.date ? -1 : 1) : a.date < b.date ? 1 : -1;
  });

  const filtered = sorted.filter(b => {
    if (filter === 'upcoming') {
      return UPCOMING_STATUSES.includes(b.status);
    }
    if (filter === 'completed') {
      return CLOSED_STATUSES.includes(b.status);
    }
    return true;
  });

  return (
    <Screen>
      <AppHeader
        title="My Appointments"
        subtitle={`${bookings.length} total booking${bookings.length === 1 ? '' : 's'}`}
        onBack={() => navigation.goBack()}
        rightIcon="refresh"
        onRightPress={load}
      />

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['upcoming', 'completed', 'all'] as Filter[]).map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterActive]}
          >
            <Text style={[typography.smallMedium, filter === f && { color: colors.textInverse }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && bookings.length === 0 ? (
        <Loader label="Loading appointments…" />
      ) : error && bookings.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={load}
          ListEmptyComponent={
            <EmptyState
              icon="calendar"
              title="No appointments yet"
              subtitle="Book a doctor, care taker, lab test or nursing visit — har booking yahan dikhegi."
              actionLabel="Find Doctors"
              onAction={() => navigation.navigate('Main', { screen: 'Doctors' })}
            />
          }
          renderItem={({ item }) => {
            const cancellable = ['new', 'upcoming', 'pending', 'confirmed'].includes(item.status);
            const isOnline =
              item.serviceType === 'online' || item.serviceType === 'online_consultation';
            const joinable = isOnline && UPCOMING_STATUSES.includes(item.status);
            return (
              <Card>
                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <View style={styles.serviceIcon}>
                    <Icon name={bookingIcon(item)} size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h4} numberOfLines={1}>
                      {item.serviceName}
                    </Text>
                    <Text style={typography.caption} numberOfLines={1}>
                      {bookingCaption(item)}
                    </Text>
                  </View>
                  <Badge label={item.status.replace('_', ' ')} tone={STATUS_TONE[item.status] ?? 'neutral'} />
                  {item.isDelayed ? (
                    <Badge
                      label={`Delayed ${item.delayMinutes ?? ''} min`.trim()}
                      tone="warning"
                      icon="clock"
                    />
                  ) : null}
                </View>

                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Icon name="calendar" size={14} color={colors.textMuted} />
                    <Text style={typography.caption}>{item.date}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="clock" size={14} color={colors.textMuted} />
                    <Text style={typography.caption} numberOfLines={1}>
                      {bookingTime(item)}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="rupee" size={14} color={colors.textMuted} />
                    <Text style={typography.caption}>₹{item.amount}</Text>
                  </View>
                </View>

                {item.prescription ? (
                  <View style={styles.rxBox}>
                    <Icon name="file-text" size={15} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.smallMedium, { color: colors.primary }]}>
                        Prescription ready — {item.prescription.diagnosis}
                      </Text>
                      <Text style={typography.caption}>
                        {item.prescription.medicines?.length ?? 0} medicine(s) • {item.prescription.date}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.primary} />
                  </View>
                ) : null}

                <View style={styles.actions}>
                  {joinable ? (
                    <AppButton
                      label="Join Consultation"
                      icon="video"
                      size="sm"
                      full={false}
                      style={{ flex: 1 }}
                      onPress={() =>
                        navigation.navigate('Consultation', {
                          bookingId: item.id,
                          patientName: item.patientName,
                        })
                      }
                    />
                  ) : null}
                  <AppButton
                    label="Details"
                    icon="info"
                    variant="outline"
                    size="sm"
                    full={false}
                    style={{ flex: 1 }}
                    onPress={() =>
                      Alert.alert(
                        `${item.serviceName}`,
                        `Booking: ${item.id}\nStatus: ${item.status}${item.isDelayed ? ` (delayed ${item.delayMinutes} min)` : ''}\nDate: ${item.date} • ${bookingTime(item)}\nPatient: ${item.patientName}\nAmount: ₹${item.amount}\nAddress: ${item.customer?.address ?? '—'}`,
                      )
                    }
                  />
                  {cancellable ? (
                    <AppButton
                      label={cancellingId === item.id ? 'Cancelling…' : 'Cancel'}
                      variant="danger"
                      size="sm"
                      full={false}
                      style={{ flex: 1 }}
                      loading={cancellingId === item.id}
                      onPress={() => cancel(item)}
                    />
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  serviceIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  rxBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
