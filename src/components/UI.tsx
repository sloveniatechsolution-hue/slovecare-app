/**
 * SloveCare UI primitives — buttons, cards, inputs, chips, badges, states.
 * Sab screens inhi components se banti hain taaki UI uniform rahe.
 */

import React, { useId, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemeKey, useThemePreference } from '../theme/ThemeContext';

/* -------------------------------------------------------------------------- */
/*  Screen wrapper                                                             */
/* -------------------------------------------------------------------------- */

export function Screen({
  children,
  style,
  backgroundColor = colors.background,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}): React.JSX.Element {
  /**
   * Theme subscription — isse component context change par dobara render
   * hota hai, aur `colors.*` (Proxy) current palette se padha jaata hai.
   *
   * ⚠️ Pehle yahan `<React.Fragment key={themeKey}>` se poora subtree remount
   * hota tha. Wo ek safety net tha (module-level styles refresh karne ke liye)
   * par uski wajah se har theme switch par scroll position, form state aur
   * animations reset ho jaate the. Ab colour mapping EXACT hai (token
   * registry), is liye remount ki zaroorat nahi — theme normal re-render se
   * propagate hota hai aur navigation/UX nahi toot-ta.
   */
  useThemePreference();

  return <View style={[{ flex: 1, backgroundColor }, style]}>{children}</View>;
}

/* -------------------------------------------------------------------------- */
/*  Gradient surface (website jaisa hero / CTA banner)                         */
/* -------------------------------------------------------------------------- */

export function GradientCard({
  children,
  from = colors.navy,
  to = colors.primary,
  style,
  diagonal = true,
}: {
  children: React.ReactNode;
  from?: string;
  to?: string;
  style?: StyleProp<ViewStyle>;
  diagonal?: boolean;
}): React.JSX.Element {
  /* Theme subscription — gradient stops current palette se aate hain. */
  useThemePreference();
  const gradientId = `grad-${useId().replace(/:/g, '')}`;
  return (
    <View style={style}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <SvgGradient id={gradientId} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </SvgGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={16} fill={`url(#${gradientId})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  style,
  padded = true,
  elevated = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}): React.JSX.Element {
  /* Theme subscription — card surface colors dynamic getters se aate hain. */
  useThemePreference();
  return (
    <View
      style={[
        styles.card,
        padded && { padding: spacing.md },
        elevated ? shadow.float : shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'accent' | 'danger' | 'outline' | 'ghost' | 'navy';

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  full = true,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
}): React.JSX.Element {
  /* Theme subscription — button palette current mode se aata hai. */
  useThemePreference();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.blue, fg: colors.textInverse },
    navy: { bg: colors.navy, fg: colors.textInverse },
    accent: { bg: colors.accent, fg: colors.textInverse },
    danger: { bg: colors.danger, fg: colors.textInverse },
    outline: { bg: colors.card, fg: colors.blue, border: colors.borderStrong },
    ghost: { bg: colors.primaryLight, fg: colors.primary },
  };

  const p = palette[variant];
  const height = size === 'lg' ? 48 : size === 'sm' ? 34 : 44;
  const fontSize = size === 'sm' ? 12.5 : 14;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { height, backgroundColor: p.bg, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 1 : 0 },
        full && { alignSelf: 'stretch' },
        !p.border && shadow.sm,
        pressed && !isDisabled && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        isDisabled && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} color={p.fg} /> : null}
          <Text style={[typography.button, { color: p.fg, fontSize }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Text input                                                                 */
/* -------------------------------------------------------------------------- */

interface FieldProps extends TextInputProps {
  label?: string;
  icon?: IconName;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  secureTextEditable?: boolean;
}

export function TextField({
  label,
  icon,
  error,
  containerStyle,
  style,
  secureTextEditable,
  ...rest
}: FieldProps): React.JSX.Element {
  /* Theme subscription — field ka border/text current palette se aata hai. */
  useThemePreference();
  const [hidden, setHidden] = useState(Boolean(secureTextEditable));
  const [focused, setFocused] = useState(false);
  const inputRef = React.useRef<React.ElementRef<typeof TextInput>>(null);

  /**
   * Android par secureTextEntry focused input me toggle karne par kai devices
   * (Gboard samet) text ko hide hi rakhte hain — isi liye toggle par input ko
   * naye `key` se remount kiya jaata hai, phir wapas focus karwa diya jaata hai.
   */
  const toggleVisibility = () => {
    const refocus = focused;
    setHidden(v => !v);
    if (refocus) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <View style={[{ marginBottom: spacing.lg }, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && { borderColor: colors.blue, backgroundColor: colors.card },
          Boolean(error) && { borderColor: colors.danger },
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? colors.blue : colors.textMuted} /> : null}
        <TextInput
          ref={inputRef}
          key={secureTextEntryProp(hidden, secureTextEditable)}
          {...rest}
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          onFocus={e => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
        />
        {secureTextEditable ? (
          <Pressable onPress={toggleVisibility} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Icon name={hidden ? 'eye-off' : 'eye'} size={18} color={focused ? colors.blue : colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/** Password field ke liye stable-but-remount wala key (non-password field me undefined). */
function secureTextEntryProp(hidden: boolean, secure?: boolean): string | undefined {
  return secure ? (hidden ? 'pwd-hidden' : 'pwd-visible') : undefined;
}

/* -------------------------------------------------------------------------- */
/*  SelectField — searchable dropdown (state / city jaise lists ke liye)       */
/* -------------------------------------------------------------------------- */

export interface SelectOption {
  label: string;
  value: string;
}

export function SelectField({
  label,
  icon,
  value,
  placeholder = 'Select',
  options,
  onChange,
  disabled = false,
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing to select',
  containerStyle,
}: {
  label?: string;
  icon?: IconName;
  value?: string;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  /* Theme subscription + extraData — dropdown rows current palette se paint hon. */
  useThemePreference();
  const themeKey = useThemeKey();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Android navigation bar / gesture bar ke peeche sheet na chhup jaye
  const insets = useSafeAreaInsets();

  const selected = options.find(o => o.value === value || o.label === value);
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = trimmedQuery
    ? options.filter(o => o.label.toLowerCase().includes(trimmedQuery) || o.value.toLowerCase().includes(trimmedQuery))
    : options;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const displayText = selected?.label || (value && value.trim() ? value : placeholder);
  const isSelected = Boolean(selected || (value && value.trim()));

  return (
    <View style={[{ marginBottom: spacing.lg }, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.field,
          pressed && { borderColor: colors.blue, backgroundColor: colors.card },
          disabled && { opacity: 0.6 },
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={colors.textMuted} /> : null}
        <Text
          style={[styles.input, { paddingVertical: 14 }, !isSelected && { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {displayText}
        </Text>
        <Icon name="chevron-down" size={17} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheetBackdrop}>
          {/* Backdrop press dismisses sheet without capturing sheet children touches */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + spacing.xl }]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{label ?? placeholder}</Text>

            {options.length > 5 ? (
              <View style={[styles.field, { marginBottom: spacing.md }]}>
                <Icon name="search" size={17} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { paddingVertical: 10 }]}
                  autoCorrect={false}
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={10}>
                    <Icon name="x" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {query.trim() && !options.some(o => o.label.toLowerCase() === query.trim().toLowerCase()) ? (
              <Pressable
                onPress={() => pick(query.trim())}
                style={({ pressed }) => [
                  styles.sheetRow,
                  { backgroundColor: colors.cardMuted, borderRadius: radius.md, marginBottom: spacing.xs },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[typography.smallMedium, { color: colors.blue }]} numberOfLines={1}>
                  Use &quot;{query.trim()}&quot;
                </Text>
                <Icon name="check" size={16} color={colors.blue} />
              </Pressable>
            ) : null}

            <FlatList
              data={filtered}
              extraData={themeKey}
              keyExtractor={(item, index) => `${item.value}_${index}`}
              keyboardShouldPersistTaps="always"
              style={{ maxHeight: 320 }}
              ListEmptyComponent={
                <Text
                  style={[
                    typography.small,
                    { textAlign: 'center', paddingVertical: spacing.lg, color: colors.textMuted },
                  ]}
                >
                  {emptyText}
                </Text>
              }
              renderItem={({ item }) => {
                const active = item.value === value || item.label === value;
                return (
                  <Pressable
                    onPress={() => pick(item.value)}
                    style={({ pressed }) => [
                      styles.sheetRow,
                      pressed && { backgroundColor: colors.cardMuted },
                    ]}
                  >
                    <Text
                      style={[typography.small, active && { color: colors.blue, fontWeight: '700' }]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    {active ? <Icon name="check" size={16} color={colors.blue} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chip (filters)                                                             */
/* -------------------------------------------------------------------------- */

export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
}): React.JSX.Element {
  useThemePreference();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : styles.chipIdle,
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon ? (
        <Icon name={icon} size={13} color={active ? colors.textInverse : colors.textSecondary} />
      ) : null}
      <Text style={[styles.chipText, active && { color: colors.textInverse }]}>{label}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Badge / status pill                                                        */
/* -------------------------------------------------------------------------- */

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
  icon?: IconName;
}): React.JSX.Element {
  useThemePreference();
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: colors.cardMuted, fg: colors.textSecondary },
    success: { bg: colors.successLight, fg: colors.success },
    warning: { bg: colors.warningLight, fg: colors.warningText },
    danger: { bg: colors.dangerLight, fg: colors.danger },
    info: { bg: colors.infoLight, fg: colors.blue },
    brand: { bg: colors.primaryLight, fg: colors.primary },
  };
  const t = tones[tone];

  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={12} color={t.fg} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rating                                                                     */
/* -------------------------------------------------------------------------- */

export function Rating({
  value = 0,
  count,
  size = 13,
  showValue = true,
}: {
  value?: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}): React.JSX.Element {
  useThemePreference();
  const rounded = Math.round(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <Polygon24 fill={i <= rounded ? colors.star : colors.border} />
        </Svg>
      ))}
      {showValue ? (
        <Text style={[typography.smallMedium, { marginLeft: 2 }]}>
          {Number(value || 0).toFixed(1)}
          {count !== undefined ? <Text style={{ color: colors.textMuted }}> ({count})</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

function Polygon24({ fill }: { fill: string }): React.JSX.Element {
  return <SvgPolygonImpl fill={fill} />;
}

/* react-native-svg polygon import aliased for clarity */
const SvgPolygonImpl = ({ fill }: { fill: string }) => {
  const PolygonEl = require('react-native-svg').Polygon;
  return <PolygonEl points="12 2.5 15.1 8.8 22 9.8 17 14.7 18.2 21.7 12 18.4 5.8 21.7 7 14.7 2 9.8 8.9 8.8 12 2.5" fill={fill} />;
};

/* -------------------------------------------------------------------------- */
/*  Section header                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.JSX.Element {
  useThemePreference();
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={typography.h3}>{title}</Text>
        {subtitle ? <Text style={[typography.caption, { marginTop: 1 }]}>{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.sectionAction, pressed && { opacity: 0.7 }]}
        >
          <Text style={[typography.smallMedium, { color: colors.blue }]}>{actionLabel}</Text>
          <Icon name="chevron-right" size={14} color={colors.blue} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  States: loading / empty / error                                            */
/* -------------------------------------------------------------------------- */

export function Loader({
  label = 'Loading…',
  color = colors.blue,
}: {
  label?: string;
  color?: string;
}): React.JSX.Element {
  useThemePreference();
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator size="large" color={color} />
      <Text style={[typography.small, { marginTop: spacing.md }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.JSX.Element {
  useThemePreference();
  return (
    <View style={styles.stateBox}>
      <View style={styles.stateIcon}>
        <Icon name={icon} size={26} color={colors.textMuted} />
      </View>
      <Text style={[typography.h4, { marginTop: spacing.md, textAlign: 'center' }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.small, { textAlign: 'center', marginTop: 4, maxWidth: 300 }]}>{subtitle}</Text>
      ) : null}
      {actionLabel ? (
        <View style={{ marginTop: spacing.lg, minWidth: 180 }}>
          <AppButton label={actionLabel} onPress={onAction} variant="outline" full={false} size="sm" />
        </View>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}): React.JSX.Element {
  useThemePreference();
  return (
    <View style={styles.stateBox}>
      <View style={[styles.stateIcon, { backgroundColor: colors.dangerLight }]}>
        <Icon name="alert-triangle" size={26} color={colors.danger} />
      </View>
      <Text style={[typography.body, { textAlign: 'center', marginTop: spacing.md, maxWidth: 300 }]}>{message}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.lg, minWidth: 180 }}>
          <AppButton label="Try Again" icon="refresh" onPress={onRetry} full={false} size="sm" />
        </View>
      ) : null}
    </View>
  );
}

/** Block-style skeleton for list loading. */
export function SkeletonBlock({ height = 16, width = '100%', style }: { height?: number; width?: number | string; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  useThemePreference();
  return <View style={[{ height, width, backgroundColor: colors.skeleton, borderRadius: 8 }, style]} />;
}

/* -------------------------------------------------------------------------- */
/*  Key/value row (profile, booking summary)                                   */
/* -------------------------------------------------------------------------- */

export function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value?: React.ReactNode;
  icon?: IconName;
}): React.JSX.Element {
  useThemePreference();
  return (
    <View style={styles.infoRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Icon name={icon} size={14} color={colors.textMuted} /> : null}
        <Text style={typography.small}>{label}</Text>
      </View>
      <Text style={[typography.smallMedium, { flexShrink: 1, textAlign: 'right' }]}>{value ?? '—'}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  fieldLabel: {
    ...typography.smallMedium,
    color: colors.text,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: 10,
    color: colors.text,
  },
  fieldError: {
    ...typography.caption,
    color: colors.danger,
    marginTop: 5,
  },
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
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.h4, marginBottom: spacing.md },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipIdle: { backgroundColor: colors.card, borderColor: colors.border },
  chipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { ...typography.smallMedium, color: colors.textSecondary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.infoLight,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

export default AppButton;
