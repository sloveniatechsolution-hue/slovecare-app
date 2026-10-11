/**
 * Booking flow — consultation type → date & slot → patient details → confirm.
 * Modes: 'doctor' | 'lab'
 * Backend: GET /vendors/:id/availability (working days + working hours se
 * slots, booked/past slots hata kar), POST /payments/create-order (server
 * price + slot reserve → Razorpay checkout → POST /payments/verify double
 * verification → booking confirmed).
 *
 * Medicine/pharmacy mode disabled hai — Medicines segment app se hata diya.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import Icon, { IconName } from '../components/Icon';
import { staffLabel, visitFee, photoUrl, initialsOf } from '../components/DoctorCard';
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
import { RootStackParamList } from '../navigation/types';

import { colors, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Booking'>;

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

const CONSULTATION_TYPES: { key: string; label: string; sub: string; icon: IconName }[] = [
  { key: 'Home Visit', label: 'Home Visit', sub: 'Doctor at your doorstep', icon: 'home' },
  { key: 'Online Consultation', label: 'Video / Call', sub: 'Consult from anywhere', icon: 'video' },
  { key: 'Clinic Visit', label: 'Clinic Visit', sub: 'Visit the clinic', icon: 'building' },
];

export default function BookingScreen({ navigation, route }: Props): React.JSX.Element {
  useThemePreference();
  const params = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [availability, setAvailability] = useState<VendorAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [consultationType, setConsultationType] = useState('Home Visit');
  /* '' = availability load hone ke baad pehla working day select hoga */
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Razorpay checkout + verify */
  const [checkout, setCheckout] = useState<Extract<PaymentOrderResult, { requiresPayment: true }> | null>(null);
  const [verifying, setVerifying] = useState(false);
  /** Last signature (ref — Alert callbacks me stale closure na ho). */
  const pendingVerifyRef = useRef<(PaymentSignature & { bookingId: string }) | null>(null);

  /* Booking confirm hone par premium success card (native Alert ki jagah). */
  const [success, setSuccess] = useState<BookingSuccessInfo | null>(null);

  /* patient details */
  const [patientName, setPatientName] = useState(user?.name ?? '');
  const [patientPhone, setPatientPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [notes, setNotes] = useState('');

  const isDoctorMode = params.mode === 'doctor';
  const isLabMode = params.mode === 'lab';
  const isMedicineMode = params.mode === 'medicine';

  /* ------------------------------- data load ------------------------------- */
  /**
   * Availability backend se: vendor ki working days/hours se bane dates +
   * slots, jinme booked aur aaj ke past slots already hat chuke hain.
   * Fail ho jaaye to koi fabricated slot NAHI dikhta — error + Retry.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetId = isDoctorMode
        ? params.doctorId
        : isLabMode
          ? (params.mode === 'lab' ? params.test.vendorId : undefined) || ''
          : '';

      const [detail, avail] = await Promise.all([
        targetId ? api.vendors.byId(targetId) : Promise.resolve(null),
        targetId
          ? api.vendors.availability(targetId, 14).catch(() => null)
          : Promise.resolve(null),
      ]);

      setVendor(detail);
      setAvailability(avail);
      if (targetId && !avail) {
        setError('Could not load slots. Tap Retry below to try again.');
      }

      /* Pehla jis din khali slot ho wahi date select (aaj nahi to kal/agle). */
      const firstOpen = avail?.days?.find(d => d.working && d.slots.length > 0);
      const firstWorking = avail?.days?.find(d => d.working);
      const fallbackDay = firstOpen?.date ?? firstWorking?.date ?? '';
      setSelectedDay(prev => (avail?.days?.some(d => d.date === prev) ? prev : fallbackDay));
      setSelectedSlot(null);
    } catch (e) {
      setError((e as Error).message || 'Could not load booking details.');
    } finally {
      setLoading(false);
    }
  }, [isDoctorMode, isLabMode, params]);

  useEffect(() => {
    load();
  }, [load]);

  /* Date strip: backend availability se hi. Slots khali ho to wahi khali. */
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

    /* Selected day band ho to pehla working day pakad lo. */
    if (source.length && !source.some(d => d.key === selectedDay && d.working)) {
      const firstOpen = source.find(d => d.working && d.slots.length > 0) ?? source.find(d => d.working);
      if (firstOpen && firstOpen.key !== selectedDay) {
        setSelectedDay(firstOpen.key);
      }
    }
    return source;
  }, [availability, selectedDay]);

  /**
   * Selected day ke available slots. Aaj ki date par current time se pehle
   * wale slots yahan bhi filter ho jaate hain (backend ke baad double safety).
   */
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

  /* --------------------------------- price --------------------------------- */
  const amount = useMemo(() => {
    if (isMedicineMode) {
      return params.mode === 'medicine' ? params.total : 0;
    }
    if (isLabMode) {
      const t = params.mode === 'lab' ? params.test : null;
      return t?.discountedPrice ?? t?.price ?? 0;
    }
    if (!vendor) {
      return 0;
    }
    const pricing =
      vendor.pricing ||
      vendor.doctorDetails?.pricing ||
      vendor.compounderDetails?.pricing ||
      vendor.nurseDetails?.pricing ||
      vendor.caretakerDetails?.pricing ||
      {};
    if (consultationType === 'Online Consultation') {
      return pricing.onlineConsultationFee ?? visitFee(vendor);
    }
    if (consultationType === 'Clinic Visit') {
      return pricing.clinicVisitFee ?? visitFee(vendor);
    }
    return pricing.homeVisitFee ?? visitFee(vendor);
  }, [vendor, consultationType, params, isLabMode, isMedicineMode]);

  const serviceName = useMemo(() => {
    if (isLabMode) {
      const t = params.mode === 'lab' ? params.test : null;
      return t?.name ?? 'Lab Test';
    }
    if (isMedicineMode) {
      return 'Medicine Order';
    }
    return vendor?.name ?? 'Consultation';
  }, [isLabMode, isMedicineMode, vendor, params]);

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
      if (isMedicineMode) {
        // Medicines/pharmacy segment disabled — ab tak ka koi order path nahi.
        Alert.alert('Not available', 'Medicine ordering is currently disabled in this version.');
        return;
      }

      const vendorId = isLabMode
        ? (params.mode === 'lab' ? params.test.vendorId : undefined) || 'ven-lab-001'
        : vendor?.id ?? '';

      const payload: CreateBookingPayload = {
        vendorId,
        customer: {
          id: user?.id,
          name: patientName.trim(),
          phone: patientPhone.trim(),
          email: user?.email,
          address: address.trim(),
          city: user?.city,
          pincode: user?.pincode,
        },
        serviceName,
        serviceType: isLabMode
          ? 'lab_test'
          : consultationType === 'Online Consultation'
            ? 'online_consultation'
            : consultationType === 'Clinic Visit'
              ? 'clinic_visit'
              : 'home_visit',
        doctorName: vendor?.name,
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        address: address.trim(),
        consultationType: isLabMode ? 'Home Sample Collection' : consultationType,
        date: selectedDay,
        timeSlot: selectedSlot,
        amount,
        notes,
        sampleStatus: isLabMode ? 'scheduled' : undefined,
        // Server isi testId se DB price verify karta hai (lab mode).
        testId: isLabMode && params.mode === 'lab' ? params.test.id : undefined,
      };

      /*
       * Payment flow: create-order par server booking validate + apni price
       * se match karta hai, slot reserve karta hai aur Razorpay order deta hai.
       * requiresPayment=false = free booking (seedha confirmed).
       */
      const order = await api.payments.createOrder(payload);
      if (!order.requiresPayment) {
        bookingConfirmed();
        return;
      }
      setCheckout(order);
    } catch (e) {
      const err = e as ApiError;
      if (err?.statusCode === 409) {
        // Kisi aur user ne isi slot ko pehle le liya — nayi availability load karke wapas bhejo.
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
        // Server price client se alag nikli — screen refresh karke naya amount dikhao.
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
   * Booking confirm — native Alert ki jagah premium "booking pass" card.
   * `bookingId` payment-verify wale path se aata hai (free booking par undefined).
   */
  const bookingConfirmed = (bookingId?: string) => {
    const providerName = isDoctorMode
      ? vendor
        ? `${vendor.name} • ${staffLabel(vendor)}`
        : 'Doctor appointment'
      : isLabMode
        ? 'Diagnostic lab • home sample pickup'
        : 'Delivered to your address';

    const serviceIcon: IconName = isLabMode
      ? 'flask'
      : isMedicineMode
        ? 'pill'
        : consultationType === 'Online Consultation'
          ? 'video'
          : consultationType === 'Clinic Visit'
            ? 'building'
            : 'home';

    setSuccess({
      serviceName,
      providerName,
      serviceIcon,
      serviceTypeLabel: isLabMode ? 'Home Sample Collection' : consultationType,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      date: selectedDay,
      timeSlot: selectedSlot ?? '',
      amount,
      bookingId,
      message: isLabMode
        ? 'Your payment was received and your home sample collection is scheduled. Track it under Appointments.'
        : 'Your payment was received and your appointment is confirmed. You can track it under Appointments.',
    });
  };

  /**
   * Backend DOUBLE verification — HMAC signature + Razorpay API ka payment
   * status/amount, dono server par check hote hain. Idempotent call hai
   * (retry par dobara charge/duplicate confirm nahi hota).
   */
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
      // Razorpay par payment ho chuka — ab sirf confirm baaki hai.
      setCheckout(null);
      Alert.alert(
        'Payment received — confirmation pending',
        err.message ||
          'We could not confirm your payment just now. You will not be charged again — please retry.',
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
    Alert.alert(
      'Payment not completed',
      'No money was charged. You can complete the payment whenever you are ready.',
    );
  };

  const checkoutFailed = (message: string) => {
    setCheckout(null);
    Alert.alert("Payment couldn't start", message);
  };

  /* --------------------------------- views --------------------------------- */
  if (loading && isDoctorMode) {
    return (
      <Screen>
        <AppHeader title="Book Appointment" onBack={() => navigation.goBack()} />
        <Loader label="Loading availability…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader title="Book Appointment" onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={isLabMode ? 'Book Lab Test' : isMedicineMode ? 'Order Medicines' : 'Book Appointment'}
        subtitle={serviceName}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Summary */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={styles.summaryIcon}>
                {(() => {
                  /* Lab mode: pehle LabTest ka embedded avatar try karo (turant),
                     phir vendor detail ka — dono me se jo mile wo dikhao. */
                  const testAvatar = isLabMode && params.mode === 'lab' ? params.test.vendorAvatar : undefined;
                  const vendorAvatar = vendor?.avatar ?? testAvatar;
                  const photo = vendorAvatar ? photoUrl(vendorAvatar) : undefined;
                  if (photo) {
                    return (
                      <Image source={{ uri: photo }} style={styles.summaryPhoto} resizeMode="cover" />
                    );
                  }
                  return (
                    <Icon
                      name={isLabMode ? 'flask' : isMedicineMode ? 'pill' : 'stethoscope'}
                      size={22}
                      color={colors.primary}
                    />
                  );
                })()}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h4} numberOfLines={1}>
                  {serviceName}
                </Text>
                <Text style={typography.caption} numberOfLines={1}>
                  {isDoctorMode && vendor ? staffLabel(vendor) : isLabMode ? 'Free home sample pickup' : 'Delivered to your address'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={typography.price}>₹{amount}</Text>
                <Badge label={amount > 0 ? 'Secure Razorpay payment' : 'Free booking'} tone="success" />
              </View>
            </View>
          </Card>

          {/* Consultation type (doctor mode only) */}
          {isDoctorMode ? (
            <View style={{ marginTop: spacing.xl }}>
              <SectionHeader title="Consultation type" />
              <View style={{ gap: spacing.sm }}>
                {CONSULTATION_TYPES.map(type => (
                  <Pressable
                    key={type.key}
                    onPress={() => setConsultationType(type.key)}
                    style={[styles.optionRow, consultationType === type.key && styles.optionActive]}
                  >
                    <View style={styles.optionIcon}>
                      <Icon name={type.icon} size={18} color={consultationType === type.key ? colors.blue : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.smallMedium}>{type.label}</Text>
                      <Text style={typography.caption}>{type.sub}</Text>
                    </View>
                    <Icon
                      name={consultationType === type.key ? 'check-circle' : 'chevron-right'}
                      size={18}
                      color={consultationType === type.key ? colors.blue : colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Date picker */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Select date" />
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
          </View>

          {/* Slots */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader
              title="Available slots"
              subtitle="Only open slots are shown — booked times are hidden automatically"
            />
            {availableSlots.length === 0 ? (
              <View style={styles.slotEmpty}>
                <Icon name="calendar" size={16} color={colors.textMuted} />
                <Text style={[typography.caption, { flex: 1, textAlign: 'center' }]}>
                  {viewDays.length === 0
                    ? 'This provider has not set availability yet — please check back later.'
                    : viewDays.find(d => d.key === selectedDay)?.working === false
                      ? 'This provider does not work on this day — please choose another date.'
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
                      <Text style={[typography.smallMedium, active && { color: colors.textInverse }]}>
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

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
              <TextField
                label={isMedicineMode ? 'Delivery Address' : 'Address for home visit'}
                icon="map-pin"
                value={address}
                onChangeText={setAddress}
                placeholder="House no., street, landmark"
                multiline
              />
              <TextField
                label="Notes for the professional (optional)"
                icon="edit"
                value={notes}
                onChangeText={setNotes}
                placeholder="Symptoms, preferred time, apartment floor…"
                multiline
              />
            </Card>
          </View>

          {/* Price summary */}
          <Card style={{ marginTop: spacing.lg }}>
            <View style={styles.priceRow}>
              <Text style={typography.small}>{isLabMode ? 'Test price' : 'Service fee'}</Text>
              <Text style={typography.smallMedium}>₹{amount}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={typography.small}>Home collection / visit</Text>
              <Text style={[typography.smallMedium, { color: colors.success }]}>FREE</Text>
            </View>
            <View style={[styles.priceRow, { borderBottomWidth: 0, paddingTop: spacing.md }]}>
              <Text style={typography.h4}>Total</Text>
              <Text style={typography.price}>₹{amount}</Text>
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
            <Text style={typography.price}>₹{amount}</Text>
          </View>
          <View style={{ flex: 2 }}>
            <AppButton
              label={
                amount > 0
                  ? `Pay ₹${amount} & Confirm`
                  : isLabMode
                    ? 'Confirm Lab Test'
                    : isMedicineMode
                      ? 'Place Order'
                      : 'Confirm Booking'
              }
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
            onResult={(signature) => {
              verifyPayment({ ...signature, bookingId: checkout.bookingId });
            }}
            onDismiss={dismissCheckout}
            onError={checkoutFailed}
          />
        ) : null}
      </KeyboardAvoidingView>

      {/* Booking confirm — premium success card (payment verify ke baad) */}
      <BookingSuccessModal
        visible={success !== null}
        info={success}
        primaryLabel="View Appointments"
        onPrimary={() => {
          setSuccess(null);
          navigation.replace('Appointments');
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
    overflow: 'hidden',
  },
  summaryPhoto: { width: '100%', height: '100%' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionActive: { borderColor: colors.blue, backgroundColor: '#F3F7FF' },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardMuted,
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
