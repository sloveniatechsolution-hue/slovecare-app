/**
 * Review sheet — patient provider (doctor/nurse/lab) ko stars + comment de
 * sakta hai. Doctor profile, Appointments aur My Consultations — teeno jagah
 * se khola ja sakta hai, isliye ye alag component hai.
 *
 * Backend: POST /api/v1/reviews — review 'pending' banta hai aur provider ke
 * accept karne par hi public profile par dikhta hai.
 */

import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { AppButton, TextField } from './UI';
import api, { Review } from '../api/api';
import { colors, radius, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

export interface ReviewSheetProps {
  visible: boolean;
  /** Jis provider ko review de rahe hain. */
  vendorId: string;
  /** Sheet title me dikhne wala naam. */
  vendorName: string;
  /** Completed booking jiske against review de rahe hain (agar pata ho). */
  bookingId?: string | null;
  onClose: () => void;
  /** Submit hone par — parent apni list/eligibility refresh kar sakta hai. */
  onSubmitted?: (review: Review) => void;
}

export default function ReviewSheet({
  visible,
  vendorId,
  vendorName,
  bookingId,
  onClose,
  onSubmitted,
}: ReviewSheetProps): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const [starRating, setStarRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const reset = () => {
    setStarRating(0);
    setReviewComment('');
  };

  const close = () => {
    if (submittingReview) {
      return;
    }
    reset();
    onClose();
  };

  const submitReview = async () => {
    if (submittingReview) {
      return;
    }
    if (!starRating) {
      Alert.alert('Rating choose karein', 'Please select 1 to 5 stars.');
      return;
    }
    if (!reviewComment.trim()) {
      Alert.alert('Comment zaroori hai', 'Apna experience chhota sa likhein.');
      return;
    }
    try {
      setSubmittingReview(true);
      const review = await api.reviews.add({
        vendorId,
        rating: starRating,
        comment: reviewComment.trim(),
        bookingId: bookingId || undefined,
      });
      reset();
      onSubmitted?.(review);
      onClose();
      Alert.alert(
        'Review submitted!',
        'Aapka review provider ke paas approval ke liye gaya hai. Wo accept karte hi is profile par public ho jayega.',
      );
    } catch (e) {
      Alert.alert('Nahi bheja ja saka', (e as Error).message || 'Review submit fail hua. Try again.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + spacing.xl }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Rate {vendorName || 'provider'}</Text>
          <Text style={[typography.caption, { marginBottom: spacing.md }]}>
            Aapka review approval ke liye provider ko jayega — accept hone par hi profile par dikhega.
          </Text>

          {/* Interactive stars */}
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <Pressable
                key={i}
                style={styles.starButton}
                onPress={() => setStarRating(i)}
                accessibilityRole="button"
                accessibilityLabel={`${i} star${i > 1 ? 's' : ''}`}
              >
                <Icon name="star" size={30} color={i <= starRating ? colors.star : colors.border} />
              </Pressable>
            ))}
          </View>

          <TextField
            label="Your experience"
            icon="file-text"
            value={reviewComment}
            onChangeText={setReviewComment}
            placeholder="Care kaisi mili? Doctor/promptness…"
            multiline
          />

          <View style={styles.sheetActions}>
            <AppButton
              label="Cancel"
              variant="outline"
              onPress={close}
              style={{ flex: 1 }}
            />
            <AppButton
              label="Submit Review"
              icon="send"
              loading={submittingReview}
              onPress={submitReview}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.h4, marginBottom: spacing.xs },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  starButton: { padding: spacing.xs },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
