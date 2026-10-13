/**
 * Doctor / medical-staff card — Home (2-column grid, 2×2 = 4 cards) aur Doctors list dono me.
 * Poore card par tap karne se detail khulti hai — alag "Book Now" button nahi hai.
 */

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiOrigin, Doctor } from '../api/api';
import Icon from './Icon';
import { Badge } from './UI';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

export interface DoctorCardProps {
  doctor: Doctor;
  onPress: () => void;
  variant?: 'grid' | 'row';
}

/** Vendor ke type ke hisaab se label (website ke staff categories se milta-julta). */
export function staffLabel(doctor: Doctor): string {
  const spec = doctor.doctorDetails?.specialization;
  if (spec) {
    return spec;
  }
  switch (doctor.type) {
    case 'compounder':
      return 'Compounder & Nursing Care';
    case 'nurse':
      return 'Home Nursing Care';
    case 'caretaker':
      return 'Elderly Caretaker';
    case 'lab':
      return doctor.labDetails?.labName
        ? `${doctor.labDetails.labName} • Lab Care`
        : 'Diagnostic Lab & Home Collection';
    default:
      return 'Medical Professional';
  }
}

/** Visit fee — vendor ki khud set ki pricing (top-level `pricing`) pehle. */
export function visitFee(doctor: Doctor): number {
  const pricing =
    doctor.pricing ||
    doctor.doctorDetails?.pricing ||
    doctor.compounderDetails?.pricing ||
    doctor.nurseDetails?.pricing ||
    doctor.caretakerDetails?.pricing ||
    {};
  return (
    pricing.homeVisitFee ??
    pricing.clinicVisitFee ??
    pricing.perVisit ??
    pricing.baseVisitFee ??
    pricing.onlineConsultationFee ??
    pricing.homeCollectionFee ??
    0
  );
}

function qualification(doctor: Doctor): string {
  const details = doctor.doctorDetails || doctor.compounderDetails || doctor.nurseDetails || doctor.caretakerDetails;
  // Details sub-object pehle, warna vendor ka top-level qualification.
  const qual = details?.qualification || doctor.qualification || '';
  const years = details?.experienceYears ?? doctor.experienceYears;
  if (qual && years) {
    return `${qual} • ${years} yrs exp`;
  }
  return qual || (years ? `${years} yrs experience` : 'Verified professional');
}

/** "Jayesh Malviya" -> "JM" — photo na ho to naam ke initials dikhte hain. */
export function initialsOf(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

/**
 * Avatar URL ko absolute banao — backend kabhi relative path (/uploads/...) bhejta hai.
 * Valid URL na ho to undefined, card/hero phir initials dikhata hai.
 */
export function photoUrl(avatar?: string | null): string | undefined {
  const value = (avatar || '').trim();
  if (!value) {
    return undefined;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const origin = apiOrigin();
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
}

/** liveStatus → footer ka chhota status label aur dot ka colour. */
function liveStatusOf(doctor: Doctor): { text: string; color: string } {
  switch (doctor.liveStatus) {
    case 'busy':
      return { text: 'Busy', color: colors.warning };
    case 'offline':
      return { text: 'Offline', color: colors.textMuted };
    default:
      return { text: 'Available', color: colors.success };
  }
}

/**
 * verificationStatus → card ka top badge.
 * Public directory me verified ke saath under_review/pending vendors bhi aate hain
 * (web ke staff list jaise), isliye badge hamesha actual status dikhata hai —
 * pending vendor ko kabhi "Verified" label nahi milna chahiye.
 */
export function verificationBadge(doctor: Doctor): {
  label: string;
  tone: 'success' | 'warning';
  icon: 'shield-check' | 'clock';
} | null {
  switch (doctor.verificationStatus) {
    case 'verified':
      return { label: 'Verified', tone: 'success', icon: 'shield-check' };
    case 'rejected':
      return null;
    default:
      return { label: 'Verification pending', tone: 'warning', icon: 'clock' };
  }
}

/** Upar wala helper ka render-ready version — card, map callout aur detail page sab yahi use karte hain. */
export function VerificationBadge({ doctor }: { doctor: Doctor }): React.JSX.Element | null {
  const badge = verificationBadge(doctor);
  if (!badge) {
    return null;
  }
  return <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />;
}

/**
 * Degree certificate team ne verify kar di — tabhi card pe "Degree Verified"
 * badge dikhta hai. Pending/rejected ka koi badge nahi.
 */
export function DegreeVerifiedBadge({ doctor }: { doctor: Doctor }): React.JSX.Element | null {
  if (doctor.degreeVerificationStatus !== 'verified') {
    return null;
  }
  return <Badge label="Degree Verified" tone="success" icon="graduation-cap" />;
}

export function DoctorCard({ doctor, onPress, variant = 'grid' }: DoctorCardProps): React.JSX.Element {
  useThemePreference();
  const horizontal = variant === 'row';
  const fee = visitFee(doctor);
  const showRating = Number(doctor.rating) > 0;
  const status = liveStatusOf(doctor);
  const badge = verificationBadge(doctor);
  const photo = photoUrl(doctor.avatar);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);

  const image = (
    <View style={horizontal ? styles.rowImageWrap : styles.imageWrap}>
      {photo && photo !== failedPhoto ? (
        <Image
          source={{ uri: photo }}
          resizeMode="cover"
          style={horizontal ? styles.rowPhoto : styles.photo}
          onError={() => setFailedPhoto(photo)}
        />
      ) : (
        <View style={[horizontal ? styles.rowImage : styles.image, styles.initialsBox]}>
          <Text style={styles.initialsText}>{initialsOf(doctor.name) || '?'}</Text>
        </View>
      )}
      {doctor.type === 'lab' ? (
        <View style={styles.homeVisitTag}>
          <Icon name="flask" size={10} color={colors.textInverse} />
          <Text style={styles.homeVisitText}>Home Collection</Text>
        </View>
      ) : (
        <View style={styles.homeVisitTag}>
          <Icon name="home" size={10} color={colors.textInverse} />
          <Text style={styles.homeVisitText}>Home Visit</Text>
        </View>
      )}
    </View>
  );

  const body = (
    <View style={horizontal ? styles.rowBody : styles.body}>
      {/* Naam + rating — photo ke upar nahi, side me */}
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {doctor.name}
        </Text>
        {showRating ? (
          <View style={styles.ratingTag}>
            <Icon name="star" size={10} color={colors.star} />
            <Text style={styles.ratingText}>
              {Number(doctor.rating).toFixed(1)} ({doctor.reviewCount ?? 0})
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.specialization} numberOfLines={1}>
        {staffLabel(doctor)}
      </Text>
      <Text style={styles.qualification} numberOfLines={1}>
        {qualification(doctor)}
      </Text>
      {/* Team ne degree verify ki hai tabhi dikhta hai */}
      {doctor.degreeVerificationStatus === 'verified' ? (
        <View style={styles.degreeBadgeWrap}>
          <DegreeVerifiedBadge doctor={doctor} />
        </View>
      ) : null}
      <View style={styles.addressRow}>
        <Icon name="map-pin" size={11} color={colors.textMuted} />
        <Text style={styles.address} numberOfLines={1}>
          {[doctor.address, doctor.city].filter(Boolean).join(', ')}
        </Text>
        {/* Patient location milne par backend `calculatedDistance` bhejta hai —
            isi se radius filter dikhta bhi hai (0.4 km / 12 km …). */}
        {typeof doctor.calculatedDistance === 'number' ? (
          <View style={styles.distanceTag}>
            <Text style={styles.distanceText}>{doctor.calculatedDistance} km</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.statusWrap}>
          <View style={[styles.dot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
        </View>
        <Text style={styles.price}>
          {/* Vendor khud daam set karta hai — na ho to "On request". */}
          {fee > 0 ? (
            <>
              ₹{fee}
              <Text style={[typography.caption, { color: colors.textMuted }]}> /visit</Text>
            </>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Fee on request</Text>
          )}
        </Text>
      </View>
    </View>
  );

  if (horizontal) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.95 }]}>
        {image}
        {body}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}>
      {badge ? (
        <View style={styles.verifiedRow}>
          <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
        </View>
      ) : null}
      {image}
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadow.card,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 6,
  },
  imageWrap: {
    width: '100%',
    height: 104,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.skeleton,
    marginBottom: spacing.sm,
  },
  image: { width: '100%', height: '100%' },
  /**
   * Photo ko frame se thoda lamba rakh ke top pe anchor karte hain —
   * cover-crop neeche ki taraf jaata hai, chehra upar se cut nahi hota.
   */
  photo: { position: 'absolute', left: 0, top: 0, width: '100%', height: 168 },
  rowPhoto: { position: 'absolute', left: 0, top: 0, width: '100%', height: 156 },
  body: {},
  name: { ...typography.h4, fontSize: 15.5, lineHeight: 20, flexShrink: 1 },
  specialization: { ...typography.smallMedium, fontSize: 12.5, lineHeight: 17, color: colors.blue, marginTop: 3 },
  qualification: { ...typography.caption, marginTop: 3 },
  degreeBadgeWrap: { alignSelf: 'flex-start', marginTop: 5 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  address: { ...typography.caption, flexShrink: 1 },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: '#CFE0FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  distanceText: { fontSize: 10, fontWeight: '700', color: colors.blue },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  statusWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.caption, fontWeight: '700' },
  price: { ...typography.price, fontSize: 16, lineHeight: 20, flexShrink: 0 },
  homeVisitTag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: radius.pill,
  },
  homeVisitText: { fontSize: 9, fontWeight: '700', color: colors.textInverse },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  ratingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: '#FBE3BE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  ratingText: { fontSize: 10, fontWeight: '700', color: colors.text },
  initialsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  initialsText: { fontSize: 26, fontWeight: '800', color: colors.primary, letterSpacing: 1 },

  /* row variant */
  rowCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  rowImageWrap: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.skeleton,
  },
  rowImage: { width: '100%', height: '100%' },
  rowBody: { flex: 1, justifyContent: 'center' },
});

export default DoctorCard;
