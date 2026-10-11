/**
 * Profile — user info, quick links (appointments, health profile, records),
 * emergency contact, app info aur logout.
 * Backend: /auth/me, /auth/user/dashboard-data, logout local.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon, { IconName } from '../components/Icon';
import AvatarPicker from '../components/AvatarPicker';
import { Logo } from '../components/Logo';
import { AppButton, Card, GradientCard, Screen, SectionHeader } from '../components/UI';
import api, { UserDashboard } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMERGENCY_NUMBER = '1800-123-456';

export default function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user, logout, isLoggedIn, updateUser } = useAuth();
  const { dark, setPreference } = useThemePreference();

  const [dashboard, setDashboard] = useState<UserDashboard | null>(null);

  /** Photo Cloudinary par upload ho chuki hai — ab user me save kar do. */
  const savePhoto = async (url: string) => {
    try {
      const updated = await api.auth.updateAvatar(url);
      updateUser(updated ?? { avatar: url });
    } catch (e) {
      Alert.alert('Profile photo', (e as Error).message || 'Could not save your photo. Please try again.');
    }
  };

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      return;
    }
    try {
      const data = await api.auth.dashboard();
      setDashboard(data);
    } catch {
      /* silent — profile screen still usable */
    }
  }, [isLoggedIn]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = dashboard?.stats;

  const menu: { icon: IconName; label: string; sub?: string; onPress: () => void; tone?: string }[] = [
    {
      icon: 'calendar',
      label: 'My Appointments',
      sub: stats ? `${stats.totalBookings} bookings • ${stats.activeBookings} active` : 'Track bookings',
      onPress: () => navigation.navigate('Appointments'),
    },
    {
      icon: 'heart-pulse',
      label: 'Health Profile',
      sub: user?.isProfileComplete ? 'Completed' : 'Pending — please complete',
      onPress: () => navigation.navigate('HealthProfile'),
    },
    {
      icon: 'file-text',
      label: 'Reports & Prescriptions',
      sub: stats ? `${stats.reportsCount} reports • ${stats.prescriptionsCount} prescriptions` : 'Health records',
      onPress: () => navigation.navigate('LabReports'),
    },
    {
      icon: 'clipboard',
      label: 'Prescription Reader',
      sub: 'Scan a prescription photo with AI',
      onPress: () => navigation.navigate('PrescriptionReader'),
    },
    {
      icon: 'zap',
      label: 'Emergency SOS',
      sub: '24/7 rapid response',
      onPress: () => navigation.navigate('Emergency'),
    },
    {
      icon: 'phone-call',
      label: 'Emergency Helpline',
      sub: EMERGENCY_NUMBER,
      onPress: () => Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {}),
    },
    {
      icon: 'mail',
      label: 'Help & Support',
      sub: 'help@slovecare.org',
      onPress: () => Linking.openURL('mailto:help@slovecare.org').catch(() => {}),
    },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          /* Status bar ke neeche thoda gap — warna card chipak jaata hai. */
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card — logo ke blue-teal gradient me */}
        <GradientCard from={colors.blue} to={colors.primary} style={[styles.header, shadow.float]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={styles.avatarRing}>
              <AvatarPicker
                avatar={user?.avatar}
                name={user?.name}
                size={64}
                editable={isLoggedIn}
                onUploaded={savePhoto}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h4, { color: colors.textInverse }]} numberOfLines={1}>
                {user?.name ?? 'Guest user'}
              </Text>
              <Text style={[typography.caption, { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
                {user?.phone ?? 'Sign in to book & track care'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={styles.headPill}>
                  <Icon name="shield-check" size={11} color={colors.textInverse} />
                  <Text style={styles.headPillText}>{isLoggedIn ? 'Verified account' : 'Guest'}</Text>
                </View>
                {user?.bloodGroup ? (
                  <View style={styles.headPill}>
                    <Text style={styles.headPillText}>Blood {user.bloodGroup}</Text>
                  </View>
                ) : null}
                {!isLoggedIn ? (
                  <View style={styles.headPill}>
                    <Text style={styles.headPillText}>Sign in</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {!isLoggedIn ? (
            <View style={{ marginTop: spacing.lg }}>
              <AppButton
                label="Sign In / Register"
                icon="user-plus"
                onPress={() => navigation.navigate('Auth')}
                size="lg"
                variant="navy"
              />
            </View>
          ) : (
            <View style={styles.statRow}>
              {[
                { l: 'Bookings', v: stats?.totalBookings ?? 0 },
                { l: 'Completed', v: stats?.completedVisits ?? 0 },
                { l: 'Reports', v: stats?.reportsCount ?? 0 },
              ].map(s => (
                <View key={s.l} style={styles.statItem}>
                  <Text style={styles.statValue}>{s.v}</Text>
                  <Text style={[typography.caption, { color: 'rgba(255,255,255,0.85)' }]}>{s.l}</Text>
                </View>
              ))}
            </View>
          )}
        </GradientCard>

        {/* Health snapshot */}
        {user ? (
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Health snapshot" actionLabel="Edit" onAction={() => navigation.navigate('HealthProfile')} />
            <Card>
              <View style={styles.snapshotGrid}>
                {[
                  { l: 'Gender', v: user.gender ?? '—' },
                  { l: 'Age', v: user.age ? `${user.age} yrs` : '—' },
                  { l: 'Weight', v: user.weight ? `${user.weight} kg` : '—' },
                  { l: 'Height', v: user.height ? `${user.height} cm` : '—' },
                ].map(item => (
                  <View key={item.l} style={styles.snapshotItem}>
                    <Text style={typography.caption}>{item.l}</Text>
                    <Text style={typography.bodyMedium}>{item.v}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.snapshotFooter}>
                <Icon name="map-pin" size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { flex: 1 }]} numberOfLines={1}>
                  {[user.address, user.city, user.state, user.pincode].filter(Boolean).join(', ') || 'No address saved'}
                </Text>
              </View>
              <View style={styles.snapshotFooter}>
                <Icon name="activity" size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { flex: 1 }]} numberOfLines={1}>
                  Conditions: {user.medicalConditions?.length ? user.medicalConditions.join(', ') : 'None reported'}
                </Text>
              </View>
            </Card>
          </View>
        ) : null}

        {/* Menu */}
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="Quick links" />
          <Card padded={false}>
            {menu.map((item, index) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.menuRow,
                  index === menu.length - 1 && { borderBottomWidth: 0 },
                  pressed && { backgroundColor: colors.cardMuted },
                ]}
              >
                <View style={styles.menuIcon}>
                  <Icon name={item.icon} size={17} color={colors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.smallMedium}>{item.label}</Text>
                  {item.sub ? (
                    <Text style={typography.caption} numberOfLines={1}>
                      {item.sub}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={17} color={colors.textMuted} />
              </Pressable>
            ))}
          </Card>
        </View>

        {/* Appearance — ek hi toggle: on = dark screen, off = light */}
        <View style={{ marginTop: spacing.xl }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={typography.h4}>Dark Mode</Text>
                <Text style={[typography.small, { marginTop: 2 }]}>
                  {dark ? 'On — screen dark theme me hai' : 'Off — screen light theme me hai'}
                </Text>
              </View>
              <Switch
                value={dark}
                onValueChange={value => setPreference(value ? 'dark' : 'light')}
                trackColor={{ true: colors.blue, false: colors.borderStrong }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.borderStrong}
                accessibilityLabel="Dark mode"
              />
            </View>
          </Card>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Card>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Logo width={170} />
              <Text style={[typography.caption, { textAlign: 'center' }]}>
                SloveCare Health • Version 1.0.0
              </Text>
            </View>
          </Card>
        </View>

        {isLoggedIn ? (
          <View style={{ marginTop: spacing.xl }}>
            <AppButton
              label="Log Out"
              icon="log-out"
              variant="danger"
              onPress={() =>
                Alert.alert('Log out?', 'You can sign in again anytime.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Log out',
                    style: 'destructive',
                    onPress: async () => {
                      await logout();
                      navigation.navigate('Auth');
                    },
                  },
                ])
              }
            />
          </View>
        ) : null}

        <Text style={[typography.caption, { textAlign: 'center', marginTop: spacing.xl }]}>
          © {new Date().getFullYear()} SloveCare Healthcare Solutions Pvt. Ltd.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  avatarRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  headPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headPillText: { ...typography.caption, color: colors.textInverse, fontWeight: '600' },
  statRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.4)',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.price, fontSize: 18, color: colors.textInverse },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  snapshotItem: {
    width: '50%',
    paddingVertical: spacing.sm,
    gap: 2,
  },
  snapshotFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
