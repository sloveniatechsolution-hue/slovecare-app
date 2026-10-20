/**
 * Lab Reports & Prescriptions — dashboard data se reports list.
 * Backend: GET /auth/user/dashboard-data (labReports + prescriptions).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { UserDashboard } from '../api/api';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemeKey, useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'LabReports'>;

export default function LabReportsScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const themeKey = useThemeKey();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<UserDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await api.auth.dashboard();
      setData(dashboard);
    } catch (e) {
      setError((e as Error).message || 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reports = data?.labReports ?? [];
  const prescriptions = data?.prescriptions ?? [];

  /**
   * Asli file (provider ki upload ki PDF/image) browser me kholein.
   * Relative link ho to file abhi pending hai — bina fabricated URL ke batate hain.
   */
  const openFile = useCallback((url: string | undefined, title: string) => {
    if (url && /^https?:\/\//i.test(url)) {
      Linking.openURL(url).catch(() =>
        Alert.alert('Could not open', 'The file link could not be opened — please try again in a few minutes.'),
      );
      return;
    }
    Alert.alert(
      title,
      'This file has not been uploaded by the provider yet — it will appear here as soon as it is ready.',
    );
  }, []);

  return (
    <Screen>
      <AppHeader
        title="Health Records"
        subtitle="Lab reports & prescriptions"
        onBack={() => navigation.goBack()}
        rightIcon="refresh"
        onRightPress={load}
      />

      {loading && !data ? (
        <Loader label="Loading health records…" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={reports}
          extraData={themeKey}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={load}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              <View style={styles.statsRow}>
                {[
                  { l: 'Reports', v: reports.length },
                  { l: 'Prescriptions', v: prescriptions.length },
                  { l: 'Bookings', v: data?.stats.totalBookings ?? 0 },
                ].map(s => (
                  <Card key={s.l} style={styles.statCard}>
                    <Text style={styles.statValue}>{s.v}</Text>
                    <Text style={typography.caption}>{s.l}</Text>
                  </Card>
                ))}
              </View>

              <Text style={[typography.h4, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                Prescriptions
              </Text>
              {prescriptions.length === 0 ? (
                <Card>
                  <Text style={typography.small}>
                    No prescriptions yet — they appear here after your consultation.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {prescriptions.map(rx => (
                    <Card key={`${rx.bookingId}-${rx.id}`}>
                      <Pressable
                        onPress={() =>
                          navigation.navigate('PrescriptionDetail', {
                            bookingId: rx.bookingId,
                            prescription: rx,
                            doctorName: rx.doctorName || rx.vendorName,
                            serviceName: rx.serviceName,
                          })
                        }
                        style={({ pressed }) => [
                          { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
                          pressed && { opacity: 0.85 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Open prescription: ${rx.diagnosis ?? 'prescription'}`}
                      >
                        <View style={styles.rxIcon}>
                          <Icon name="file-text" size={20} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={typography.smallMedium} numberOfLines={1}>
                            {rx.diagnosis}
                          </Text>
                          <Text style={typography.caption} numberOfLines={1}>
                            {rx.doctorName || rx.vendorName} • {rx.date} • {rx.medicines?.length ?? 0} medicines
                          </Text>
                        </View>
                        <Badge label="Ready" tone="success" />
                        <Icon name="chevron-right" size={16} color={colors.textMuted} />
                      </Pressable>
                      {rx.files && rx.files.length > 0 ? (
                        <View style={{ gap: 6, marginTop: spacing.sm }}>
                          {rx.files.map((file, index) => (
                            <Text
                              key={`${file.fileUrl}-${index}`}
                              style={[typography.smallMedium, { color: colors.blue }]}
                              onPress={() => openFile(file.fileUrl, file.title || 'Prescription file')}
                            >
                              {file.title || `Attachment ${index + 1}`} →
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </Card>
                  ))}
                </View>
              )}

              <Text style={[typography.h4, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                Lab Reports
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="flask"
              title="No lab reports yet"
              subtitle="Book a lab test and your digital report will appear here within 24 hours."
              actionLabel="Browse Lab Tests"
              onAction={() => navigation.navigate('Main')}
            />
          }
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View style={styles.rxIcon}>
                  <Icon name="flask" size={20} color={colors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.smallMedium} numberOfLines={1}>
                    {item.testName}
                  </Text>
                  <Text style={typography.caption} numberOfLines={1}>
                    {item.vendorName} • {item.date}
                  </Text>
                </View>
                <Badge
                  label={item.status === 'ready' ? 'Ready' : 'Processing'}
                  tone={item.status === 'ready' ? 'success' : 'warning'}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
                <Icon name="info" size={13} color={colors.textMuted} />
                <Text style={typography.caption}>Sample: {item.sampleStatus?.replace('_', ' ') ?? 'collected'}</Text>
              </View>

              <View style={styles.actions}>
                <Badge
                  label={item.fileUrl ? `${(item.fileType || 'file').toUpperCase()} ready` : `Booking ${item.bookingId}`}
                  tone={item.fileUrl ? 'success' : 'neutral'}
                />
                <Text
                  style={[typography.smallMedium, { color: colors.blue }]}
                  onPress={() => openFile(item.fileUrl || item.downloadUrl, item.testName)}
                >
                  {item.fileUrl ? 'Open report →' : 'View report →'}
                </Text>
              </View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { ...typography.price, fontSize: 20, color: colors.primary },
  rxIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
