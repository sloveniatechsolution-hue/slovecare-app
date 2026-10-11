/**
 * My Consultations — video/chat consultation bookings list + join.
 * Backend: GET /auth/user/dashboard-data (bookings serviceType
 * `video_consultation` / `chat_consultation` filter).
 * Join eligibility: confirmed/in_progress bookings; session ka asli
 * authorization server par hota hai (room join ke waqt).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import ReviewSheet from '../components/ReviewSheet';
import { AppButton, Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { Booking, bookingTime } from '../api/api';
import { consultationModeOf, ConsultationMode } from '../consultation/types';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const JOINABLE_STATUSES = ['confirmed', 'in_progress', 'active', 'upcoming', 'new'];
const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected'];

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  new: 'warning',
  upcoming: 'info',
  pending: 'warning',
  confirmed: 'info',
  in_progress: 'warning',
  active: 'warning',
  completed: 'success',
  cancelled: 'danger',
  rejected: 'danger',
};

const MODE_ICON: Record<ConsultationMode, IconName> = { video: 'video', chat: 'message-circle' };

export default function MyConsultationsScreen({ navigation }: { navigation: Nav }): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Jis provider ko already review de diya — un par button na dikhe. */
  const [reviewedVendors, setReviewedVendors] = useState<Record<string, boolean>>({});
  /** Jis consultation ke liye review sheet khuli hai. */
  const [reviewTarget, setReviewTarget] = useState<{
    vendorId: string;
    vendorName: string;
    bookingId: string;
  } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const dashboard = await api.auth.dashboard();
      const all: Booking[] = dashboard?.bookings ?? [];
      /* Sirf naye consultation types — purane online bookings Appointments me chalti hain. */
      const consultations = all.filter(b => consultationModeOf(b.serviceType) !== null);
      setBookings(consultations);
    } catch (e) {
      setError((e as Error).message || 'Could not load consultations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /** Mere reviews — completed consultation ke baad review option ke liye. */
  const loadMyReviews = useCallback(async () => {
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
      /* Guest / session khatam — review button us par kaam nahi karti. */
    }
  }, []);

  useEffect(() => {
    load();
    loadMyReviews();
  }, [load, loadMyReviews]);

  if (loading) {
    return (
      <Screen>
        <AppHeader title="My Consultations" onBack={() => navigation.goBack()} />
        <Loader label="Loading consultations…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader title="My Consultations" onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="My Consultations" subtitle="Video calls & live chat with doctors" onBack={() => navigation.goBack()} />
      {bookings.length === 0 ? (
        <EmptyState
          icon="video"
          title="No consultations yet"
          subtitle="Open a doctor's profile and choose Video Consultation or Chat with Doctor to book one."
          actionLabel="Find a Doctor"
          onAction={() => navigation.navigate('Main', { screen: 'Doctors' })}
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.xxxl * 2 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const mode = consultationModeOf(item.serviceType) ?? 'video';
            const joinable = JOINABLE_STATUSES.includes(item.status);
            const closed = CLOSED_STATUSES.includes(item.status);
            /* Completed consultation par hi review, aur sirf ek baar. */
            const canReview =
              item.status === 'completed' &&
              Boolean(item.vendorId) &&
              !reviewedVendors[item.vendorId];
            return (
              <Card style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={styles.modeIcon}>
                    <Icon name={MODE_ICON[mode]} size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h4} numberOfLines={1}>
                      {mode === 'video' ? 'Video Consultation' : 'Chat Consultation'}
                    </Text>
                    <Text style={typography.caption} numberOfLines={1}>
                      {item.doctorName || item.vendorName}
                      {item.durationMinutes ? ` • ${item.durationMinutes} min` : ''}
                    </Text>
                  </View>
                  <Badge label={item.status.replace('_', ' ')} tone={STATUS_TONE[item.status] ?? 'neutral'} />
                </View>

                <View style={styles.metaRow}>
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

                <View style={styles.actions}>
                  {joinable && mode === 'video' ? (
                    <AppButton
                      label="Join Video Call"
                      icon="video"
                      size="sm"
                      full={false}
                      style={{ flex: 1 }}
                      onPress={() =>
                        navigation.navigate('VideoCall', {
                          bookingId: item.id,
                          peerName: item.doctorName || item.vendorName,
                        })
                      }
                    />
                  ) : null}
                  {joinable && mode === 'chat' ? (
                    <AppButton
                      label="Open Chat"
                      icon="message-circle"
                      size="sm"
                      full={false}
                      style={{ flex: 1 }}
                      onPress={() =>
                        navigation.navigate('ChatRoom', {
                          bookingId: item.id,
                          peerName: item.doctorName || item.vendorName,
                        })
                      }
                    />
                  ) : null}
                  {closed ? (
                    canReview ? (
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
                    ) : (
                      <Text style={[typography.caption, { flex: 1, textAlign: 'center' }]}>
                        {item.status === 'completed' ? 'Consultation completed' : 'No longer active'}
                      </Text>
                    )
                  ) : null}
                  <AppButton
                    label="Details"
                    icon="info"
                    variant="outline"
                    size="sm"
                    full={false}
                    style={{ flex: 1 }}
                    onPress={() =>
                      // eslint-disable-next-line @typescript-eslint/no-var-requires
                      require('react-native').Alert.alert(
                        mode === 'video' ? 'Video Consultation' : 'Chat Consultation',
                        `Booking: ${item.id}\nDoctor: ${item.doctorName || item.vendorName}\nStatus: ${item.status}\nDate: ${item.date} • ${bookingTime(item)}\nDuration: ${item.durationMinutes ?? '—'} min\nAmount: ₹${item.amount}`,
                      )
                    }
                  />
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Completed consultation ka review — yahin se. */}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md },
  modeIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
