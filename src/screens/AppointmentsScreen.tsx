/**
 * Appointments — user ki bookings, status, cancel aur prescription view.
 * Backend: GET /auth/user/dashboard-data, PATCH /bookings/:id/status.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import ReviewSheet from '../components/ReviewSheet';
import BookingDetailsModal from '../components/BookingDetailsModal';
import { AppButton, Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { ApiError, Booking, bookingTime } from '../api/api';
import { consultationModeOf } from '../consultation/types';
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
  video_consultation: 'video',
  chat_consultation: 'message-circle',
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
  /** Guest ya session khatam — appointments ke liye login chahiye. */
  const [needsLogin, setNeedsLogin] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  /** Jis provider ko patient ne already review de diya — un par button na dikhe. */
  const [reviewedVendors, setReviewedVendors] = useState<Record<string, boolean>>({});
  /** Jis booking ke liye review sheet khuli hai (completed visits). */
  const [reviewTarget, setReviewTarget] = useState<{
    vendorId: string;
    vendorName: string;
    bookingId: string;
  } | null>(null);
  /** Jis booking ka details modal khula hai. */
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null);
  /** Race guard — purani (stale) request ka result screen par na aa jaye. */
  const loadIdRef = useRef(0);

  /**
   * Mere reviews — completed booking ke provider ke naam nikaal ke rakh lete
   * hain taaki "Review" button dobara na dikhe (backend dobara review allow
   * nahi karta).
   */
  const loadMyReviews = useCallback(async () => {
    if (!user) {
      setReviewedVendors({});
      return;
    }
    try {
      const mine = await api.reviews.mine();
      const map: Record<string, boolean> = {};
      mine.forEach(review => {
        if (review.vendorId) {
          map[review.vendorId] = true;
        }
      });
      setReviewedVendors(map);
    } catch {
      /* Review list na aaye to button rehne do — backend hi rok dega. */
    }
  }, [user]);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);
    setNeedsLogin(false);
    try {
      const dashboard = await api.auth.dashboard();
      if (loadIdRef.current !== loadId) {
        return;
      }
      setBookings(dashboard?.bookings ?? []);
      return;
    } catch (e) {
      const status = (e as ApiError)?.statusCode;

      /* Token missing/expired (401/403) ya guest — seedha backend ka raw
         "Access denied. Bearer token missing." mat dikhao, login maango. */
      if (!user || status === 401 || status === 403) {
        if (loadIdRef.current !== loadId) {
          return;
        }
        setBookings([]);
        setNeedsLogin(true);
        return;
      }

      /* Dashboard fail hone par GET /bookings (token ke saath) fallback. */
      try {
        const list = await api.bookings.list({ userId: user?.id });
        if (loadIdRef.current !== loadId) {
          return;
        }
        setBookings(list);
        return;
      } catch (fallbackError) {
        if (loadIdRef.current !== loadId) {
          return;
        }
        const failure = (fallbackError ?? e) as ApiError;
        if (!user || failure?.statusCode === 401 || failure?.statusCode === 403) {
          setBookings([]);
          setNeedsLogin(true);
          return;
        }
        setError(failure?.message || 'Could not load appointments.');
      }
    } finally {
      if (loadIdRef.current === loadId) {
        setLoading(false);
      }
    }
  }, [user]);

  /* Mount, focus (login/booking ke baad wapas aane par) aur user change —
     teeno par refresh. */
  useFocusEffect(
    useCallback(() => {
      load();
      loadMyReviews();
    }, [load, loadMyReviews]),
  );

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
        onRightPress={() => {
          load();
          loadMyReviews();
        }}
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
      ) : needsLogin ? (
        <EmptyState
          icon="user"
          title="Sign in to see appointments"
          subtitle="Your bookings are tied to your account. Sign in to view, track and cancel them."
          actionLabel="Sign In / Register"
          onAction={() => navigation.navigate('Auth')}
        />
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
              subtitle="Book a doctor, care taker, lab test or nursing visit — every booking shows up here."
              actionLabel="Find Doctors"
              onAction={() => navigation.navigate('Main', { screen: 'Doctors' })}
            />
          }
          renderItem={({ item }) => {
            const cancellable = ['new', 'upcoming', 'pending', 'confirmed'].includes(item.status);
            const isOnline =
              item.serviceType === 'online' || item.serviceType === 'online_consultation';
            /* Naye video/chat consultation bookings — seedha apne rooms. */
            const consultationMode = consultationModeOf(item.serviceType);
            const joinable =
              (isOnline || consultationMode !== null) && UPCOMING_STATUSES.includes(item.status);
            /* Completed visit par hi review — aur jahan abhi tak na diya ho. */
            const canReview =
              item.status === 'completed' &&
              Boolean(item.vendorId) &&
              !reviewedVendors[item.vendorId];
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
                  {canReview ? (
                    <AppButton
                      label="Review"
                      icon="star"
                      variant="ghost"
                      size="sm"
                      full={false}
                      style={{ flex: 1 }}
                      onPress={() =>
                        setReviewTarget({
                          vendorId: item.vendorId,
                          vendorName: item.doctorName || item.vendorName,
                          bookingId: item.id,
                        })
                      }
                    />
                  ) : null}
                  {joinable ? (
                    <AppButton
                      label={
                        consultationMode === 'chat'
                          ? 'Open Chat'
                          : 'Join Video Call'
                      }
                      icon={consultationMode === 'chat' ? 'message-circle' : 'video'}
                      size="sm"
                      full={false}
                      style={{ flex: 1 }}
                      onPress={() => {
                        if (consultationMode === 'chat') {
                          navigation.navigate('ChatRoom', {
                            bookingId: item.id,
                            peerName: item.doctorName || item.vendorName,
                          });
                        } else {
                          /* Video consultations (naye + purane online) — sab
                             in-app WebRTC call. Koi third-party room nahi. */
                          navigation.navigate('VideoCall', {
                            bookingId: item.id,
                            peerName: item.doctorName || item.vendorName,
                          });
                        }
                      }}
                    />
                  ) : null}
                  <AppButton
                    label="Details"
                    icon="info"
                    variant="outline"
                    size="sm"
                    full={false}
                    style={{ flex: 1 }}
                    onPress={() => setDetailsBooking(item)}
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

      {/* Completed visit ka review — yahin se, seedha. */}
      <ReviewSheet
        visible={Boolean(reviewTarget)}
        vendorId={reviewTarget?.vendorId ?? ''}
        vendorName={reviewTarget?.vendorName ?? ''}
        bookingId={reviewTarget?.bookingId}
        onClose={() => setReviewTarget(null)}
        onSubmitted={() => {
          setReviewTarget(null);
          loadMyReviews();
        }}
      />

      {/* Booking details — premium modal (native Alert ki jagah). */}
      <BookingDetailsModal
        visible={Boolean(detailsBooking)}
        info={
          detailsBooking
            ? {
                serviceName: detailsBooking.serviceName,
                providerName: bookingCaption(detailsBooking),
                serviceIcon: bookingIcon(detailsBooking),
                serviceTypeLabel: detailsBooking.serviceType.replace(/_/g, ' '),
                bookingId: detailsBooking.id,
                status: detailsBooking.status,
                isDelayed: detailsBooking.isDelayed,
                delayMinutes: detailsBooking.delayMinutes,
                date: detailsBooking.date,
                time: bookingTime(detailsBooking),
                patientName: detailsBooking.patientName,
                amount: detailsBooking.amount,
                address: detailsBooking.customer?.address,
              }
            : null
        }
        onClose={() => setDetailsBooking(null)}
      />
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
