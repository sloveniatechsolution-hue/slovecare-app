/**
 * Consultation booking — paid video call / live chat with a doctor.
 * Backend: GET /vendors/:id + /vendors/:id/availability → slot chuno →
 * POST /payments/create-order (server price + slot reserve → Razorpay order)
 * → checkout → POST /payments/verify (double verification) → booking confirmed.
 *
 * serviceType backend par `video_consultation` / `chat_consultation` hoti hai
 * (purane 'online' bookings bhi ab in-app WebRTC call se chalti hain).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { staffLabel } from '../components/DoctorCard';
import RazorpayCheckout from '../components/RazorpayCheckout';
import BookingSuccessModal, { BookingSuccessInfo } from '../components/BookingSuccessModal';
import { AppButton, Badge, Card, ErrorState, Loader, Screen, SectionHeader, TextField } from '../components/UI';
import api, {
  ApiError,
  CreateBookingPayload,
  PaymentOrderResult,
  PaymentSignature,
  Vendor,
  VendorAvailability,
} from '../api/api';
import { useAuth } from '../context/AuthContext';
import { ConsultationMode } from '../consultation/types';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ConsultationBook'>;

const DEFAULT_DURATION_MINUTES = 15;

/** '09:00 AM' → minutes since midnight — aaj ke past slots filter karne ke liye. */
function slotMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) {
    return null;
  }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = (match[3] || '').toLowerCase();
  if (meridiem === 'pm' && hour < 12) {
    hour += 12;
  }
  if (meridiem === 'am' && hour === 12) {
    hour = 0;
  }
  if (hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

const MODE_META: Record<ConsultationMode, { title: string; icon: 'video' | 'message-circle'; blurb: string }> = {
  video: {
    title: 'Video Consultation',
    icon: 'video',
    blurb: 'Live face-to-face consultation — join from Appointments at the booked time.',
  },
  chat: {
    title: 'Chat with Doctor',
    icon: 'message-circle',
    blurb: 'Paid live chat — your paid chat window starts when the doctor joins.',
  },
};

export default function ConsultationBookScreen({ navigation, route }: Props): React.JSX.Element {
  useThemePreference();
  const { doctorId, mode } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const meta = MODE_META[mode];

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [availability, setAvailability] = useState<VendorAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Razorpay checkout + verify */
  const [checkout, setCheckout] = useState<Extract<PaymentOrderResult, { requiresPayment: true }> | null>(null);
  const [verifying, setVerifying] = useState(false);
  const pendingVerifyRef = useRef<(PaymentSignature & { bookingId: string }) | null>(null);

  /* Consultation confirm hone par premium success card (native Alert ki jagah). */
  const [success, setSuccess] = useState<BookingSuccessInfo | null>(null);

  /* patient details */
  const [patientName, setPatientName] = useState(user?.name ?? '');
  const [patientPhone, setPatientPhone] = useState(user?.phone ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, avail] = await Promise.all([
        api.vendors.byId(doctorId),
        api.vendors.availability(doctorId, 14).catch(() => null),
      ]);
      setVendor(detail);
      setAvailability(avail);

      /* Pehla jis din khali slot ho wahi date select. */
      const firstOpen = avail?.days?.find(d => d.working && d.slots.length > 0);
      const firstWorking = avail?.days?.find(d => d.working);
      const fallbackDay = firstOpen?.date ?? firstWorking?.date ?? '';
      setSelectedDay(prev => (avail?.days?.some(d => d.date === prev) ? prev : fallbackDay));
      setSelectedSlot(null);
    } catch (e) {
      setError((e as Error).message || 'Could not load consultation details.');
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Doctor ki asli fee/duration — vendor panel (Pricing screen) se. */
  const pricing = vendor?.pricing ?? vendor?.doctorDetails?.pricing ?? {};
  const fee =
    mode === 'video'
      ? (pricing.videoConsultationFee ?? 0)
      : (pricing.chatConsultationFee ?? 0);
  const durationMinutes =
    (mode === 'video' ? pricing.videoConsultationMinutes : pricing.chatSessionMinutes) ??
    DEFAULT_DURATION_MINUTES;

  const viewDays = useMemo(() => {
    const source = availability?.days?.length
      ? availability.days.map((day, index) => ({
          key: day.date,
          weekday: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.weekday.slice(0, 3),
          day: day.date.slice(8, 10),
          month: new Date(`${day.date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' }),
          working: day.working,
          slots: day.slots,
          isToday: day.isToday,
        }))
      : [];

    if (source.length && !source.some(d => d.key === selectedDay && d.working)) {
      const firstOpen = source.find(d => d.working && d.slots.length > 0) ?? source.find(d => d.working);
      if (firstOpen && firstOpen.key !== selectedDay) {
        setSelectedDay(firstOpen.key);
      }
    }
    return source;
  }, [availability, selectedDay]);

  /* Selected day ke available slots — aaj ke past slots yahan bhi filter. */
  const availableSlots = useMemo(() => {
    const day = viewDays.find(d => d.key === selectedDay);
    if (!day) {
      return [];
    }
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return day.slots.filter(slot => {
      if (!day.isToday) {
        return true;
      }
      const start = slotMinutes(slot);
      return start === null || start > nowMinutes;
    });
  }, [viewDays, selectedDay]);

  /* -------------------------------- submit --------------------------------- */
  const confirm = async () => {
    if (!patientName.trim()) {
      Alert.alert('Missing details', 'Please enter the patient name.');
      return;
    }
    if (!patientPhone.trim()) {
      Alert.alert('Missing details', 'Please enter a contact number.');
      return;
    }
    if (!selectedSlot) {
      Alert.alert('Select a slot', 'Please choose a time slot to continue.');
      return;
    }

    /* Booking ke liye logged-in account zaroori hai — backend customer
       identity aur booking ownership dono token se hi banata hai. Guest par
       raw "Bearer token missing" error aata tha, isliye pehle login maango. */
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to confirm your booking.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateBookingPayload = {
        vendorId: doctorId,
        customer: {
          id: user?.id,
          name: patientName.trim(),
          phone: patientPhone.trim(),
          email: user?.email,
          city: user?.city,
          pincode: user?.pincode,
        },
        serviceName: mode === 'video' ? 'Video Consultation' : 'Chat Consultation',
        /* Backend isi serviceType se price verify + room/session banata hai. */
        serviceType: mode === 'video' ? 'video_consultation' : 'chat_consultation',
        consultationMode: mode,
        durationMinutes,
        doctorName: vendor?.name,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        consultationType: meta.title,
        date: selectedDay,
        timeSlot: selectedSlot,
        amount: fee,
        notes: '',
      };

      const order = await api.payments.createOrder(payload);
      if (!order.requiresPayment) {
        bookingConfirmed();
        return;
      }
      setCheckout(order);
    } catch (e) {
      const err = e as ApiError;
      if (err?.statusCode === 409) {
        Alert.alert('Slot just got booked', err.message || 'Someone else booked this slot. Pick another time.', [
          {
            text: 'Choose another',
            onPress: () => {
              setSelectedSlot(null);
              load();
            },
          },
        ]);
      } else if (err?.statusCode === 400 && /price/i.test(err.message || '')) {
        Alert.alert('Price updated', err.message || 'The price changed. Please review and try again.', [
          { text: 'Refresh', onPress: () => load() },
        ]);
      } else {
        Alert.alert('Booking failed', err.message || 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* --------------------------- payment helpers --------------------------- */

  /**
   * Consultation confirm — native Alert ki jagah premium "booking pass" card.
   * `bookingId` payment-verify wale path se aata hai (free booking par undefined).
   */
  const bookingConfirmed = (bookingId?: string) => {
    setSuccess({
      serviceName: mode === 'video' ? 'Video Consultation' : 'Chat Consultation',
      providerName: vendor ? `${vendor.name} • ${staffLabel(vendor)}` : undefined,
      serviceIcon: meta.icon,
      serviceTypeLabel: meta.title,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      date: selectedDay,
      timeSlot: selectedSlot ?? '',
      durationMinutes,
      amount: fee,
      bookingId,
      message:
        mode === 'video'
          ? 'Your video consultation is confirmed. Join from Appointments at the booked time.'
          : 'Your chat consultation is confirmed. Open it from Appointments — the paid chat window starts when the doctor joins.',
    });
  };

  /** Backend DOUBLE verification — HMAC + Razorpay API status, dono server par. */
  const verifyPayment = async (signature: PaymentSignature & { bookingId: string }) => {
    pendingVerifyRef.current = signature;
    setVerifying(true);
    try {
      await api.payments.verify(signature);
      pendingVerifyRef.current = null;
      setCheckout(null);
      bookingConfirmed(signature.bookingId);
    } catch (e) {
      const err = e as ApiError;
      setCheckout(null);
      Alert.alert(
        'Payment received — confirmation pending',
        err.message || 'We could not confirm your payment just now. You will not be charged again — please retry.',
        [
          { text: 'Retry confirmation', onPress: () => retryVerify() },
          { text: 'Do it later', style: 'cancel' },
        ],
      );
    } finally {
      setVerifying(false);
    }
  };

  /** Verify dobara (ref se) — stale-closure safe. */
  const retryVerify = async () => {
    const payload = pendingVerifyRef.current;
    if (!payload) {
      return;
    }
    setSubmitting(true);
    try {
      await api.payments.verify(payload);
      pendingVerifyRef.current = null;
      bookingConfirmed(payload.bookingId);
    } catch (e) {
      const err = e as ApiError;
      Alert.alert('Still not confirmed', err.message || 'We could not confirm your payment.', [
        { text: 'Retry', onPress: () => retryVerify() },
        {
          text: 'Do it later',
          style: 'cancel',
          onPress: () => {
            pendingVerifyRef.current = null;
          },
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const dismissCheckout = () => {
    if (verifying) {
      return;
    }
    setCheckout(null);
    Alert.alert('Payment not completed', 'No money was charged. You can complete the payment whenever you are ready.');
  };

  const checkoutFailed = (message: string) => {
    setCheckout(null);
    Alert.alert("Payment couldn't start", message);
  };

  /* --------------------------------- views --------------------------------- */
  if (loading) {
    return (
      <Screen>
        <AppHeader title={meta.title} onBack={() => navigation.goBack()} />
        <Loader label="Loading availability…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader title={meta.title} onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={meta.title} subtitle={vendor?.name} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Summary */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={styles.summaryIcon}>
                <Icon name={meta.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h4} numberOfLines={1}>
                  {meta.title}
                </Text>
                <Text style={typography.caption} numberOfLines={2}>
                  {vendor ? staffLabel(vendor) : ''} • {durationMinutes} min
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={typography.price}>{fee > 0 ? `₹${fee}` : 'Free'}</Text>
                <Badge label={fee > 0 ? 'Secure Razorpay payment' : 'Free booking'} tone="success" />
              </View>
            </View>
            <Text style={[typography.caption, { marginTop: spacing.md, lineHeight: 18 }]}>{meta.blurb}</Text>
          </Card>

          {/* Date picker */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Select date" />
            {viewDays.length === 0 ? (
              <View style={styles.slotEmpty}>
                <Icon name="calendar" size={16} color={colors.textMuted} />
                <Text style={[typography.caption, { flex: 1, textAlign: 'center' }]}>
                  This doctor has not set availability yet — please check back later.
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {viewDays.map(day => {
                  const active = selectedDay === day.key;
                  const closed = !day.working;
                  return (
                    <Pressable
                      key={day.key}
                      disabled={closed}
                      onPress={() => {
                        setSelectedDay(day.key);
                        setSelectedSlot(null);
                      }}
                      style={[styles.dayCell, closed && styles.dayCellClosed, active && styles.dayCellActive]}
                    >
                      <Text
                        style={[
                          typography.caption,
                          active && { color: 'rgba(255,255,255,0.85)' },
                          closed && { color: colors.textMuted },
                        ]}
                      >
                        {day.weekday}
                      </Text>
                      <Text
                        style={[
                          styles.dayNumber,
                          active && { color: colors.textInverse },
                          closed && { color: colors.textMuted },
                        ]}
                      >
                        {day.day}
                      </Text>
                      <Text
                        style={[
                          typography.caption,
                          active && { color: 'rgba(255,255,255,0.85)' },
                          closed && { color: colors.textMuted },
                        ]}
                      >
                        {closed ? 'Off' : day.month}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Slots */}
          {viewDays.length ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader
                title="Available slots"
                subtitle="Only open slots are shown — booked times are hidden automatically"
              />
              {availableSlots.length === 0 ? (
                <View style={styles.slotEmpty}>
                  <Icon name="clock" size={16} color={colors.textMuted} />
                  <Text style={[typography.caption, { flex: 1, textAlign: 'center' }]}>
                    {viewDays.find(d => d.key === selectedDay)?.working === false
                      ? 'This doctor does not work on this day — please choose another date.'
                      : 'All slots for this day are fully booked — please choose another date.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.slotGrid}>
                  {availableSlots.map(slot => {
                    const active = selectedSlot === slot;
                    return (
                      <Pressable
                        key={slot}
                        onPress={() => setSelectedSlot(slot)}
                        style={[styles.slotCell, active && styles.slotCellActive]}
                      >
                        <Text style={[typography.smallMedium, active && { color: colors.textInverse }]}>{slot}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

          {/* Patient details */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Patient details" />
            <Card>
              <TextField
                label="Patient Name"
                icon="user"
                value={patientName}
                onChangeText={setPatientName}
                placeholder="Full name"
              />
              <TextField
                label="Contact Number"
                icon="phone"
                keyboardType="phone-pad"
                value={patientPhone}
                onChangeText={setPatientPhone}
                placeholder="+91 98xxx xxxxx"
              />
            </Card>
          </View>

          {/* Price summary */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={styles.priceRow}>
              <Text style={typography.small}>{meta.title} ({durationMinutes} min)</Text>
              <Text style={typography.smallMedium}>{fee > 0 ? `₹${fee}` : 'FREE'}</Text>
            </View>
            <View style={[styles.priceRow, { borderBottomWidth: 0, paddingTop: spacing.md }]}>
              <Text style={typography.h4}>Total</Text>
              <Text style={typography.price}>{fee > 0 ? `₹${fee}` : 'FREE'}</Text>
            </View>
          </Card>
        </ScrollView>

        {/* Sticky confirm — system nav bar ke upar (safe-area) */}
        <View style={[styles.footer, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption} numberOfLines={1}>
              {selectedSlot
                ? `${viewDays.find(d => d.key === selectedDay)?.weekday ?? selectedDay} • ${selectedSlot}`
                : 'No slot selected'}
            </Text>
            <Text style={typography.price}>{fee > 0 ? `₹${fee}` : 'Free'}</Text>
          </View>
          <View style={{ flex: 2 }}>
            <AppButton
              label={fee > 0 ? `Pay ₹${fee} & Confirm` : 'Confirm Consultation'}
              icon="check"
              size="lg"
              loading={submitting || verifying}
              onPress={confirm}
            />
          </View>
        </View>

        {/* Razorpay checkout — order backend se; signature wapas backend verify ko */}
        {checkout && checkout.requiresPayment ? (
          <RazorpayCheckout
            visible
            order={checkout}
            prefill={{ name: patientName, contact: patientPhone, email: user?.email }}
            verifying={verifying}
            onResult={signature => {
              verifyPayment({ ...signature, bookingId: checkout.bookingId });
            }}
            onDismiss={dismissCheckout}
            onError={checkoutFailed}
          />
        ) : null}
      </KeyboardAvoidingView>

      {/* Consultation confirm — premium success card (payment verify ke baad) */}
      <BookingSuccessModal
        visible={success !== null}
        info={success}
        primaryLabel="View My Consultations"
        onPrimary={() => {
          setSuccess(null);
          navigation.replace('MyConsultations');
        }}
        onSecondary={() => {
          setSuccess(null);
          navigation.navigate('Main');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    width: 66,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: 2,
  },
  dayCellActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  dayCellClosed: { backgroundColor: colors.cardMuted, borderColor: colors.border, opacity: 0.65 },
  dayNumber: { ...typography.h4, color: colors.text },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
  },
  slotCell: {
    paddingHorizontal: spacing.lg,
    height: 42,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  slotCellActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
