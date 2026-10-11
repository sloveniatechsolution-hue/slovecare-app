/**
 * Consultation — online appointment ka Jitsi room (WebView).
 *
 * Room formula vendor panel ke saath same hai:
 *   https://meet.jit.si/SloveCare-<bookingId>
 * Provider "Start Consultation" kare tab bhi yahi link khulta hai —
 * patient ko alag se kuch nahi karna, bas "Join" dabana hai.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import WebView from 'react-native-webview';
import AppHeader from '../components/AppHeader';
import { AppButton, Badge, Card, Loader, Screen } from '../components/UI';
import api, { Booking, bookingTime, meetingLinkFor } from '../api/api';
import { RootStackParamList } from '../navigation/types';

import { colors, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Consultation'>;

const LIVE_STATUSES = ['new', 'upcoming', 'pending', 'confirmed', 'in_progress', 'active'];

export default function ConsultationScreen({ navigation, route }: Props): React.JSX.Element {
  useThemePreference();
  const { bookingId, patientName } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inRoom, setInRoom] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.bookings.byId(bookingId);
      setBooking(data);
    } catch {
      // Room link booking se bhi ban jaata hai — loading fail room ko nahi rokna.
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const link = meetingLinkFor({ id: bookingId });
  const canJoin = booking ? LIVE_STATUSES.includes(booking.status) : true;

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Consultation" onBack={() => navigation.goBack()} />
        <Loader label="Loading consultation…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={booking?.doctorName || booking?.vendorName || 'Consultation'}
        subtitle={patientName ?? booking?.patientName}
        onBack={() => navigation.goBack()}
      />

      {!inRoom ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={styles.roomIcon}>
                <Text style={styles.roomIconText}>📹</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h4}>Video Consultation Room</Text>
                <Text style={[typography.caption, { marginTop: 2 }]}>
                  {booking ? `${booking.date} • ${bookingTime(booking)}` : 'Secure Jitsi room'}
                </Text>
              </View>
              {booking?.status ? (
                <Badge label={booking.status.replace('_', ' ')} tone="info" />
              ) : null}
            </View>
            <Text style={[typography.small, { marginTop: spacing.md, lineHeight: 20 }]}>
              Join karte hi aawaz-video on ho jaayenge. Provider ke room join karne ka wait
              karein — dono ek hi room me honge.
            </Text>
          </Card>

          {!canJoin ? (
            <Text style={[typography.small, { color: colors.danger, textAlign: 'center' }]}>
              Ye consultation ab band hai — Appointments se nayi booking karein.
            </Text>
          ) : null}

          <AppButton
            label={joining ? 'Joining…' : 'Join Consultation'}
            icon="video"
            size="lg"
            disabled={!canJoin}
            loading={joining}
            onPress={() => {
              setJoining(true);
              setInRoom(true);
              setJoining(false);
            }}
          />
        </View>
      ) : (
        <View style={styles.roomWrap}>
          <WebView
            source={{ uri: link }}
            style={styles.webview}
            startInLoadingState
            allowsFullscreenVideo
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            renderLoading={() => <Loader label="Room load ho raha hai…" />}
          />
          <View style={styles.roomFooter}>
            <Text style={[typography.caption, { flex: 1 }]} numberOfLines={1}>
              {link}
            </Text>
            <AppButton
              label="Leave"
              variant="danger"
              size="sm"
              full={false}
              onPress={() => setInRoom(false)}
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomIconText: { fontSize: 20 },
  roomWrap: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#000' },
  roomFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
