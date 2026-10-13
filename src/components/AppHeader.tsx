/**
 * Stack screens ka standard header — back arrow, title, optional right action.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import { colors, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

export function AppHeader({
  title,
  subtitle,
  onBack,
  rightIcon,
  onRightPress,
  rightLabel,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightLabel?: string;
}): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn} accessibilityLabel="Go back">
            <Icon name="arrow-left" size={20} color={colors.text} />
          </Pressable>
        ) : (
          <View style={{ width: 8 }} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={typography.h4} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={typography.caption} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightIcon || rightLabel ? (
          <Pressable onPress={onRightPress} hitSlop={10} style={styles.action}>
            {rightIcon ? <Icon name={rightIcon} size={19} color={colors.blue} /> : null}
            {rightLabel ? <Text style={[typography.smallMedium, { color: colors.blue }]}>{rightLabel}</Text> : null}
          </Pressable>
        ) : (
          <View style={{ width: 8 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
  },
});

export default AppHeader;
