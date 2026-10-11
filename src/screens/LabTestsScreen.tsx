/**
 * Labs — certified pathology labs ki list.
 * Lab pe click → uski profile (DoctorDetail) khulti hai, jisme tests ki
 * table + har test ke saath "Book Now" hota hai → slot booking.
 * Backend: GET /api/v1/vendors?type=lab
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from '../components/Icon';
import { Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { Vendor } from '../api/api';
import { photoUrl } from '../components/DoctorCard';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LabTestsScreen(): React.JSX.Element {
  useThemePreference();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [labs, setLabs] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLabs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.vendors.list({ type: 'lab' });
      setLabs(result);
    } catch (e) {
      setError((e as Error).message || 'Could not load labs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  /* Lab pe click → uski profile khulti hai (tests + Book Now wahan se). */
  const openLabProfile = (lab: Vendor) => {
    navigation.navigate('DoctorDetail', { doctorId: lab.id });
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h3}>Laboratories</Text>
            <Text style={[typography.small, { marginTop: 2 }]}>
              {labs.length} certified labs • Free home pickup
            </Text>
          </View>
          <Badge label="NABL Labs" tone="warning" icon="award" />
        </View>
      </View>

      {loading ? (
        <Loader label="Loading labs…" />
      ) : error ? (
        <ErrorState message={error} onRetry={loadLabs} />
      ) : labs.length === 0 ? (
        <EmptyState
          icon="flask"
          title="No labs available"
          subtitle="Certified pathology labs will appear here soon."
          actionLabel="Refresh"
          onAction={loadLabs}
        />
      ) : (
        <FlatList
          data={labs}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadLabs}
          renderItem={({ item }) => {
            const photo = photoUrl(item.avatar);
            return (
              <Pressable onPress={() => openLabProfile(item)}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={styles.labAvatar}>
                      {photo ? (
                        <Image source={{ uri: photo }} style={styles.labAvatarImage} resizeMode="cover" />
                      ) : (
                        <Icon name="flask" size={22} color={colors.primary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.h4} numberOfLines={1}>{item.name}</Text>
                      {item.city ? (
                        <Text style={[typography.caption, { marginTop: 2 }]}>{item.city}</Text>
                      ) : null}
                      {item.labDetails?.homeSampleCollectionAvailable ? (
                        <View style={{ marginTop: 6 }}>
                          <Badge label="Free home pickup" tone="success" icon="home" />
                        </View>
                      ) : null}
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.textMuted} />
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  labAvatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  labAvatarImage: { width: '100%', height: '100%' },
});
