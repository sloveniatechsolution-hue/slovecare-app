/**
 * Review gate modal — native Alert ki jagah premium centered card.
 * Teen cases handle karta hai: login zaroori, review pehle se de diya,
 * ya completed visit ke baad hi review allowed.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import { AppButton } from './UI';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

export type ReviewGateKind = 'login' | 'already-reviewed' | 'visit-required';

interface ReviewGateCopy {
  icon: IconName;
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel: string | null;
}

const COPY: Record<ReviewGateKind, ReviewGateCopy> = {
  login: {
    icon: 'user',
    title: 'Sign in to review',
    message: 'You need to be signed in to write a review.',
    primaryLabel: 'Sign In',
    secondaryLabel: 'Not now',
  },
  'already-reviewed': {
    icon: 'check-circle',
    title: 'Review already submitted',
    message:
      "You've already reviewed this provider. It will appear on this profile once the provider approves it.",
    primaryLabel: 'Got it',
    secondaryLabel: null,
  },
  'visit-required': {
    icon: 'calendar',
    title: 'Review after your visit',
    message:
      'Reviews can only be shared after a completed booking with this provider. Book an appointment first, then share your experience from Appointments → Completed.',
    primaryLabel: 'Book Appointment',
    secondaryLabel: 'Maybe later',
  },
};

export interface ReviewGateModalProps {
  visible: boolean;
  kind: ReviewGateKind;
  onPrimary: () => void;
  onDismiss: () => void;
}

export default function ReviewGateModal({
  visible,
  kind,
  onPrimary,
  onDismiss,
}: ReviewGateModalProps): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const copy = COPY[kind];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View
          style={[
            styles.card,
            { paddingBottom: spacing.xl + insets.bottom },
            shadow.float,
          ]}
        >
          <View style={styles.iconCircle}>
            <Icon name={copy.icon} size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.message}>{copy.message}</Text>
          <View style={styles.actions}>
            {copy.secondaryLabel ? (
              <AppButton
                label={copy.secondaryLabel}
                variant="outline"
                onPress={onDismiss}
                style={{ flex: 1 }}
              />
            ) : null}
            <AppButton
              label={copy.primaryLabel}
              onPress={onPrimary}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.small,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
});
