/**
 * Doctor detail — profile, pricing, availability, reviews + booking CTA.
 * Backend: GET /vendors/:id, /vendors/:id/reviews, /vendors/:id/stats.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import ReviewGateModal, { ReviewGateKind } from '../components/ReviewGateModal';
import ReviewSheet from '../components/ReviewSheet';
import { DegreeVerifiedBadge, photoUrl, staffLabel, visitFee, VerificationBadge } from '../components/DoctorCard';
import { AppButton, Badge, Card, ErrorState, Loader, Rating, Screen, SectionHeader } from '../components/UI';
import api, { LabTest, Review, ReviewEligibility, Vendor, VendorStats } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorDetail'>;

const HERO_FALLBACK_H = 230;

export default function DoctorDetailScreen({ navigation, route }: Props): React.JSX.Element {
  useThemePreference();
  const { doctorId } = route.params;

  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, isLoggedIn } = useAuth();

  const [doctor, setDoctor] = useState<Vendor | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroHeight, setHeroHeight] = useState(HERO_FALLBACK_H);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const heroPhoto = photoUrl(doctor?.avatar);

  /* --------------------------- Review form state --------------------------- */
  const [reviewAccess, setReviewAccess] = useState<ReviewEligibility | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  /* Lab tests — selected test ka ID (tab-style selection, doctor tab jaisa). */
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  /* Native Alert ki jagah premium centered card — login / already reviewed /
     completed visit ke teeno gates ke liye. */
  const [gateModal, setGateModal] = useState<{ kind: ReviewGateKind } | null>(null);

  /**
   * Patient review de sakta ya nahi (completed booking + pehle se na diya ho).
   * Sirf logged-in patient ke liye; failure par button chhup jaata hai.
   */
  const loadReviewAccess = useCallback(async () => {
    if (!isLoggedIn || !user) {
      setReviewAccess(null);
      return;
    }
    try {
      const access = await api.reviews.eligibility(doctorId);
      setReviewAccess(access);
    } catch {
      setReviewAccess(null);
    }
  }, [doctorId, isLoggedIn, user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, reviewList] = await Promise.all([
        api.vendors.byId(doctorId),
        api.vendors.reviews(doctorId).catch(() => [] as Review[]),
      ]);
      setDoctor(detail);
      setReviews(reviewList.length ? reviewList : detail.reviews ?? []);
      api.vendors.stats(doctorId).then(setStats).catch(() => {});
      // Lab profile — apne tests + daam (vendor panel ke Pricing screen se).
      if (detail.type === 'lab') {
        api.labTests
          .list({ vendorId: doctorId })
          .then(setLabTests)
          .catch(() => setLabTests([]));
      }
    } catch (e) {
      setError((e as Error).message || 'Could not load profile.');
    } finally {
      setLoading(false);
    }
    loadReviewAccess();
  }, [doctorId, loadReviewAccess]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * "Write Review" ka entry point — button hamesha dikhta hai (warna patient
   * ko pata hi nahi chalta ki review kahan se hota hai), lekin file hone par
   * wajah ke saath premium gate modal dikhta hai: login / completed visit /
   * already reviewed.
   */
  const openReview = () => {
    if (!isLoggedIn || !user) {
      setGateModal({ kind: 'login' });
      return;
    }
    if (reviewAccess?.myReview) {
      setGateModal({ kind: 'already-reviewed' });
      return;
    }
    if (!reviewAccess?.eligible) {
      setGateModal({ kind: 'visit-required' });
      return;
    }
    setReviewModalOpen(true);
  };

  const closeGateModal = () => setGateModal(null);

  const handleGatePrimary = () => {
    const kind = gateModal?.kind;
    closeGateModal();
    if (kind === 'login') {
      navigation.navigate('Auth');
    } else if (kind === 'visit-required') {
      navigation.navigate('Booking', { mode: 'doctor', doctorId });
    }
  };

  /* Photo ke aspect ratio se hero height — chehra upar se cut na ho. */
  useEffect(() => {
    const uri = photoUrl(doctor?.avatar);
    if (!uri) {
      setHeroHeight(HERO_FALLBACK_H);
      return undefined;
    }
    const boxWidth = windowWidth - spacing.lg * 2;
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (cancelled || !w || !h) {
          return;
        }
        const exact = Math.round((boxWidth * h) / w);
        setHeroHeight(Math.min(Math.max(exact, 220), 400));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [doctor?.avatar, windowWidth]);

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Doctor Profile" onBack={() => navigation.goBack()} />
        <Loader label="Loading profile…" />
      </Screen>
    );
  }

  if (error || !doctor) {
    return (
      <Screen>
        <AppHeader title="Doctor Profile" onBack={() => navigation.goBack()} />
        <ErrorState message={error ?? 'Profile not found.'} onRetry={load} />
      </Screen>
    );
  }

  const lab = doctor.type === 'lab' ? doctor.labDetails : undefined;
  const details =
    doctor.doctorDetails ||
    doctor.compounderDetails ||
    doctor.nurseDetails ||
    doctor.caretakerDetails ||
    undefined;
  /** Vendor panel se set ki gayi asli pricing (sabse upar). */
  const pricing = doctor.pricing ?? details?.pricing ?? lab?.pricing ?? {};
  const fee = visitFee(doctor);

  /* Sirf vendor-set fees dikhate hain — koi fabricated number nahi. */
  const feeRows: { label: string; value: number | undefined }[] = [
    { label: 'Home Visit', value: pricing.homeVisitFee },
    { label: 'Online Consultation', value: pricing.onlineConsultationFee },
    { label: 'Clinic Visit', value: pricing.clinicVisitFee },
    { label: 'Per Visit', value: pricing.perVisit },
    { label: 'Per Hour', value: pricing.perHour },
    { label: 'Half Day', value: pricing.halfDay },
    { label: 'Full Day', value: pricing.fullDay },
    { label: 'Injection', value: pricing.injectionFee },
    { label: 'Dressing', value: pricing.dressingFee },
    { label: 'BP / Sugar Check', value: pricing.bpSugarCheckFee },
    { label: 'IV Drip', value: pricing.ivDripFee },
    { label: 'Home Collection', value: pricing.homeCollectionFee },
  ].filter((row): row is { label: string; value: number } => typeof row.value === 'number');

  const highlights: { icon: IconName; label: string }[] = [
    {
      icon: 'shield-check',
      label:
        details?.registrationNumber ||
        lab?.licenseNumber ||
        'Verified & background checked',
    },
    {
      icon: 'award',
      label: details?.experienceYears
        ? `${details.experienceYears} years experience`
        : 'Experienced professional',
    },
    { icon: 'message-circle', label: (details?.languages ?? ['Hindi', 'English']).join(' • ') },
  ];

  const serviceChips = Object.entries(details?.services ?? lab?.services ?? doctor.services ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => labelForService(key));

  /*
   * Consult online card — sirf tab jab doctor ne panel se video/chat
   * consultation enable ki ho (services.videoConsultation / chatConsultation).
   * Fee/duration bhi wahi se (koi fabricated number nahi).
   */
  const consultServices = details?.services ?? doctor.services ?? {};
  const consultationRows = ([
    {
      mode: 'video' as const,
      title: 'Video Consultation',
      icon: 'video' as const,
      enabled: consultServices.videoConsultation === true,
      fee: pricing.videoConsultationFee ?? 0,
      duration: pricing.videoConsultationMinutes,
    },
    {
      mode: 'chat' as const,
      title: 'Chat with Doctor',
      icon: 'message-circle' as const,
      enabled: consultServices.chatConsultation === true,
      fee: pricing.chatConsultationFee ?? 0,
      duration: pricing.chatSessionMinutes,
    },
  ]).filter(row => row.enabled);

  return (
    <Screen>
      <AppHeader
        title={doctor.name}
        subtitle={staffLabel(doctor)}
        onBack={() => navigation.goBack()}
        /* Privacy: doctor ka phone number patient ko kabhi nahi dikhta —
           koi tel: link / call button nahi (sirf in-app consultations). */
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2 }}>
        {/* Cover card — height photo ke aspect se (face cut na ho) */}
        <View style={[styles.hero, { height: heroHeight }, shadow.float]}>
          {heroPhoto && heroPhoto !== failedPhoto ? (
            <Image
              source={{ uri: heroPhoto }}
              style={styles.heroImage}
              resizeMode="cover"
              onError={() => setFailedPhoto(heroPhoto)}
            />
          ) : (
            <View style={[styles.heroImage, styles.heroInitials]}>
              <Text style={styles.heroInitialsText}>{initials(doctor.name)}</Text>
            </View>
          )}
          <View style={styles.heroOverlay}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <VerificationBadge doctor={doctor} />
              <DegreeVerifiedBadge doctor={doctor} />
              {doctor.emergencyAvailable ? <Badge label="Emergency" tone="danger" icon="zap" /> : null}
              {doctor.liveStatus === 'available' ? <Badge label="Available" tone="brand" /> : null}
            </View>
          </View>
        </View>

        {/* Name block */}
        <View style={{ marginTop: spacing.lg }}>
          <Text style={typography.h2}>{doctor.name}</Text>
          <Text style={[typography.bodyMedium, { color: colors.blue, marginTop: 2 }]}>
            {staffLabel(doctor)}
          </Text>
          <Text style={[typography.small, { marginTop: 4 }]}>
            {[
              details?.qualification || doctor.qualification,
              (details?.experienceYears ?? doctor.experienceYears)
                ? `${details?.experienceYears ?? doctor.experienceYears} yrs exp`
                : null,
            ]
              .filter(Boolean)
              .join(' • ')}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <Rating value={doctor.rating ?? 0} count={doctor.reviewCount ?? reviews.length} size={15} />
          </View>
        </View>

        {/* Stats strip — sirf vendor-set daam + asli bookings */}
        <View style={styles.statsStrip}>
          {[
            ...feeRows.slice(0, 2).map(row => ({ label: row.label, value: `₹${row.value}` })),
            {
              label: 'Bookings',
              value: String(stats?.totalBookings ?? doctor.totalBookingsCount ?? 0),
            },
          ].map(s => (
            <View key={s.label} style={styles.statItem}>
              <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
              <Text style={[typography.caption, { textAlign: 'center' }]} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Vendor-set fees — panel ke "Services & Prices" se aate hain */}
        {feeRows.length ? (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Fees" subtitle="Set directly by the provider" />
            <View style={{ gap: 2 }}>
              {feeRows.map(row => (
                <View key={row.label} style={styles.feeRow}>
                  <Text style={[typography.small, { flex: 1 }]}>{row.label}</Text>
                  <Text style={[typography.smallMedium, { color: colors.primary }]}>₹{row.value}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Consult online — video call / paid chat (doctor ke enable kiye hue) */}
        {consultationRows.length ? (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Consult online" subtitle="Video call & live chat — no phone number shared" />
            <View style={{ gap: spacing.sm }}>
              {consultationRows.map(row => (
                <Pressable
                  key={row.mode}
                  onPress={() => navigation.navigate('ConsultationBook', { doctorId, mode: row.mode })}
                  style={styles.consultRow}
                >
                  <View style={styles.highlightIcon}>
                    <Icon name={row.icon} size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.smallMedium}>{row.title}</Text>
                    <Text style={typography.caption}>
                      {row.duration ? `${row.duration} min • ` : ''}
                      {row.fee > 0 ? `₹${row.fee}` : 'Free'}
                    </Text>
                  </View>
                  <AppButton
                    label="Book"
                    size="sm"
                    variant="outline"
                    onPress={() => navigation.navigate('ConsultationBook', { doctorId, mode: row.mode })}
                  />
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        {/* Lab profile — naam, license, collection timing + tests */}
        {lab ? (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Lab Details" />
            <View style={{ gap: spacing.md }}>
              {lab.labName ? (
                <View style={styles.highlightRow}>
                  <View style={styles.highlightIcon}>
                    <Icon name="flask" size={16} color={colors.primary} />
                  </View>
                  <Text style={[typography.small, { flex: 1 }]}>{lab.labName}</Text>
                </View>
              ) : null}
              {lab.licenseNumber ? (
                <View style={styles.highlightRow}>
                  <View style={styles.highlightIcon}>
                    <Icon name="shield-check" size={16} color={colors.primary} />
                  </View>
                  <Text style={[typography.small, { flex: 1 }]}>License: {lab.licenseNumber}</Text>
                </View>
              ) : null}
              <View style={styles.highlightRow}>
                <View style={styles.highlightIcon}>
                  <Icon name="home" size={16} color={colors.primary} />
                </View>
                <Text style={[typography.small, { flex: 1 }]}>
                  {lab.homeSampleCollectionAvailable
                    ? `Home sample collection available${lab.homeCollectionFee ? ` (₹${lab.homeCollectionFee})` : ''}`
                    : 'Visit the lab for samples'}
                </Text>
              </View>
              {lab.labTimings?.start ? (
                <View style={styles.highlightRow}>
                  <View style={styles.highlightIcon}>
                    <Icon name="clock" size={16} color={colors.primary} />
                  </View>
                  <Text style={[typography.small, { flex: 1 }]}>
                    Lab timings: {lab.labTimings.start} – {lab.labTimings.end}
                  </Text>
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* Lab tests + daam + book (doctor tab jaisa flow) */}
        {lab && labTests.length ? (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Lab Tests" subtitle={`${labTests.length} tests available`} />
            <View style={{ gap: spacing.sm }}>
              {labTests.map(test => {
                const active = selectedTestId === test.id;
                const price = test.discountedPrice ?? test.price;
                return (
                  <View key={test.id}>
                    <Pressable
                      onPress={() => setSelectedTestId(test.id)}
                      style={[styles.testRow, active && styles.testRowActive]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={typography.smallMedium} numberOfLines={1}>{test.name}</Text>
                        {test.category ? (
                          <Text style={typography.caption}>{test.category}</Text>
                        ) : null}
                      </View>
                      <Text style={[typography.smallMedium, { color: colors.primary }]}>
                        ₹{price}
                      </Text>
                    </Pressable>
                    {/* Selected test — price + Book Test button */}
                    {active ? (
                      <View style={styles.testBookRow}>
                        <View>
                          <Text style={typography.price}>₹{price}</Text>
                          {test.turnaroundTime ? (
                            <Text style={typography.caption}>Report in {test.turnaroundTime}</Text>
                          ) : null}
                        </View>
                        <AppButton
                          label="Book Now"
                          size="sm"
                          onPress={() => navigation.navigate('Booking', { mode: 'lab', test })}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* Bio */}
        {doctor.doctorDetails?.bio ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={typography.h4}>About</Text>
            <Text style={[typography.small, { marginTop: 6, lineHeight: 20 }]}>{doctor.doctorDetails.bio}</Text>
          </Card>
        ) : null}

        {/* Highlights */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Why patients book" />
          <View style={{ gap: spacing.md }}>
            {highlights.map(h => (
              <View key={h.label} style={styles.highlightRow}>
                <View style={styles.highlightIcon}>
                  <Icon name={h.icon} size={16} color={colors.primary} />
                </View>
                <Text style={[typography.small, { flex: 1 }]}>{h.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Services */}
        {serviceChips.length ? (
          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Services offered" />
            <View style={styles.chipWrap}>
              {serviceChips.map(s => (
                <Badge key={s} label={s} tone="info" />
              ))}
            </View>
          </Card>
        ) : null}

        {/* Location & availability */}
        <Card style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Location & availability" />
          <View style={styles.infoRow}>
            <Icon name="map-pin" size={15} color={colors.textMuted} />
            <Text style={[typography.small, { flex: 1 }]}>{[doctor.address, doctor.city, doctor.pincode].filter(Boolean).join(', ')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="clock" size={15} color={colors.textMuted} />
            <Text style={[typography.small, { flex: 1 }]}>
              {(() => {
                const hours = details?.workingHours ?? doctor.workingHours ?? lab?.labTimings;
                return hours?.start ? `${hours.start} – ${hours.end}` : 'Timings on call';
              })()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="calendar" size={15} color={colors.textMuted} />
            <Text style={[typography.small, { flex: 1 }]}>
              {(details?.workingDays ?? doctor.workingDays ?? lab?.workingDays)?.join(', ') ||
                'Working days on call'}
            </Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Icon name="map-pin" size={15} color={colors.textMuted} />
            <Text style={[typography.small, { flex: 1 }]}>
              Service radius: {doctor.serviceRadiusKm ?? 10} km from {doctor.city}
            </Text>
          </View>
        </Card>

        {/* Reviews */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Patient Reviews"
            subtitle={`${reviews.length} verified review${reviews.length === 1 ? '' : 's'}`}
            /* Button kabhi chhupta nahi — warna patient ko review ka pata na
               chale. Login / completed visit / already reviewed — teeno cases
               openReview() me handle ho jaate hain. */
            actionLabel={reviewAccess?.myReview ? 'Reviewed' : 'Write Review'}
            onAction={openReview}
          />

          {/* Patient ka apna review — provider tak approval me hai */}
          {reviewAccess?.myReview ? (
            <Card style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(user?.name || reviewAccess.myReview.customerName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.smallMedium}>Your review</Text>
                  <Text style={typography.caption}>{reviewAccess.myReview.date}</Text>
                </View>
                <Rating value={reviewAccess.myReview.rating} size={12} showValue={false} />
              </View>
              <Text style={[typography.small, { marginTop: spacing.sm, lineHeight: 20 }]}>
                {reviewAccess.myReview.comment}
              </Text>
              {reviewAccess.myReview.status === 'pending' ? (
                <View style={styles.pendingWrap}>
                  <Icon name="clock" size={13} color={colors.warning} />
                  <Text style={styles.pendingText}>
                    Approval pending — provider accept karega tabhi ye profile par dikhega.
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {reviews.length === 0 ? (
            <Card>
              <Text style={[typography.small, { textAlign: 'center' }]}>
                No reviews yet — be the first to share your experience.
              </Text>
              {/* Review dene ka option khali section me bhi */}
              <View style={{ marginTop: spacing.md }}>
                <AppButton
                  label="Write a Review"
                  icon="star"
                  variant="outline"
                  onPress={openReview}
                />
              </View>
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {reviews.map(review => (
                <Card key={review.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(review.customerName)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.smallMedium}>{review.customerName}</Text>
                      <Text style={typography.caption}>{review.date}</Text>
                    </View>
                    <Rating value={review.rating} size={12} showValue={false} />
                  </View>
                  <Text style={[typography.small, { marginTop: spacing.sm, lineHeight: 20 }]}>{review.comment}</Text>
                  {review.reply ? (
                    <View style={styles.reply}>
                      <Text style={[typography.caption, { color: colors.primary }]}>
                        {doctor.name} replied • {review.reply.repliedAt}
                      </Text>
                      <Text style={[typography.small, { marginTop: 2 }]}>{review.reply.text}</Text>
                    </View>
                  ) : null}
                </Card>
              ))}
            </View>
          )}

          {/* Patient ko batao ki review bhi hota hai — Appointments se bhi. */}
          <Text style={[typography.caption, styles.reviewHint]}>
            {reviewAccess?.myReview
              ? 'Aapka review is provider ke paas approval ke liye hai.'
              : 'Visit complete hone ke baad Appointments → Completed se bhi review de sakte hain.'}
          </Text>
        </View>
      </ScrollView>

      {/* Sticky CTA — system nav bar ke upar (safe-area).
          Lab profile par tests ki cards se hi booking hoti hai. */}
      {!lab ? (
        <View style={[styles.cta, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>
              {pricing.homeVisitFee != null ? 'Home visit fee' : 'Consultation fee'}
            </Text>
            <Text style={typography.price}>{fee > 0 ? `₹${fee}` : 'On request'}</Text>
          </View>
          <View style={{ flex: 2 }}>
            <AppButton
              label="Book Appointment"
              icon="calendar"
              size="lg"
              onPress={() => navigation.navigate('Booking', { mode: 'doctor', doctorId })}
            />
          </View>
        </View>
      ) : null}

      {/* ------------------------ Review form sheet ------------------------ */}
      <ReviewSheet
        visible={reviewModalOpen}
        vendorId={doctorId}
        vendorName={doctor?.name ?? ''}
        bookingId={reviewAccess?.completedBookingId}
        onClose={() => setReviewModalOpen(false)}
        onSubmitted={() => loadReviewAccess()}
      />

      {/* Review gate — login / completed visit / already reviewed (premium card) */}
      <ReviewGateModal
        visible={gateModal !== null}
        kind={gateModal?.kind ?? 'visit-required'}
        onPrimary={handleGatePrimary}
        onDismiss={closeGateModal}
      />
    </Screen>
  );
}

function labelForService(key: string): string {
  const map: Record<string, string> = {
    onlineConsultation: 'Online Consultation',
    videoConsultation: 'Video Consultation',
    chatConsultation: 'Live Chat',
    homeVisit: 'Home Visit',
    clinicVisit: 'Clinic Visit',
    injection: 'Injection',
    dressing: 'Dressing',
    bpCheck: 'BP Check',
    sugarCheck: 'Sugar Test',
    ivDrip: 'IV Drip',
    elderCare: 'Elder Care',
    patientCare: 'Patient Care',
    nightCare: 'Night Care',
    dayCare: 'Day Care',
  };
  return map[key] ?? key;
}

function initials(name?: string): string {
  if (!name) {
    return 'P';
  }
  return name
    .split(' ')
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  testRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  testBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hero: {
    height: 230,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.skeleton,
  },
  heroImage: { width: '100%', height: '100%' },
  heroInitials: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  heroInitialsText: { fontSize: 64, fontWeight: '800', color: colors.primary, letterSpacing: 3 },
  heroOverlay: { position: 'absolute', left: spacing.md, top: spacing.md },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadow.card,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.price, fontSize: 17, color: colors.primary },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  highlightIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  consultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.smallMedium, color: colors.primary },
  reply: {
    backgroundColor: colors.cardMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  /* ------------------------- Review form (bottom sheet) ------------------- */
  reviewHint: {
    marginTop: spacing.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  pendingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.warningLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  pendingText: { ...typography.caption, color: colors.warning, flex: 1 },
});
