/**
 * Lab Tests — pehle labs ki list (name + avatar), phir click par uske tests.
 * Backend: GET /api/v1/vendors?type=lab, GET /api/v1/lab-tests?vendorId=
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from '../components/Icon';
import { AppButton, Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { LabTest, Vendor } from '../api/api';
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
  const [tests, setTests] = useState<LabTest[]>([]);
  const [selectedLab, setSelectedLab] = useState<Vendor | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingTests, setLoadingTests] = useState(false);
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

  const loadTests = useCallback(async (vendorId: string) => {
    setLoadingTests(true);
    try {
      const result = await api.labTests.list({ vendorId, search: query || undefined });
      setTests(result);
    } catch {
      setTests([]);
    } finally {
      setLoadingTests(false);
    }
  }, [query]);

  useEffect(() => {
    loadLabs();
  }, [loadLabs]);

  useEffect(() => {
    if (selectedLab) {
      const t = setTimeout(() => loadTests(selectedLab.id), 300);
      return () => clearTimeout(t);
    }
  }, [selectedLab, loadTests]);

  const openLab = (lab: Vendor) => {
    setSelectedLab(lab);
    setTests([]);
    setQuery('');
  };

  const goBack = () => {
    setSelectedLab(null);
    setTests([]);
    setQuery('');
  };

  /* ------------------------------ Labs list ------------------------------ */
  if (!selectedLab) {
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
                <Pressable onPress={() => openLab(item)}>
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

  /* ------------------------------ Tests list ------------------------------ */
  const photo = photoUrl(selectedLab.avatar);
  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={goBack} hitSlop={8} style={styles.backBtn}>
            <Icon name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={typography.h3} numberOfLines={1}>{selectedLab.name}</Text>
            <Text style={[typography.small, { marginTop: 2 }]}>
              {tests.length} tests available
            </Text>
          </View>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.headerAvatar} resizeMode="cover" />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Icon name="flask" size={18} color={colors.primary} />
            </View>
          )}
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search test, e.g. CBC, Thyroid"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="x" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loadingTests && tests.length === 0 ? (
        <Loader label="Loading tests…" />
      ) : tests.length === 0 ? (
        <EmptyState
          icon="flask"
          title="No tests found"
          subtitle={query ? `No tests match "${query}" in this lab.` : 'This lab has not listed any tests yet.'}
          actionLabel="Refresh"
          onAction={() => loadTests(selectedLab.id)}
        />
      ) : (
        <FlatList
          data={tests}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshing={loadingTests}
          onRefresh={() => loadTests(selectedLab.id)}
          renderItem={({ item }) => {
            const mrp = item.price;
            const price = item.discountedPrice ?? item.price;
            const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
            return (
              <Pressable onPress={() => navigation.navigate('DoctorDetail', { doctorId: selectedLab.id })}>
                <Card>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <View style={styles.testIcon}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={styles.testImage} resizeMode="cover" />
                      ) : (
                        <Icon name="flask" size={22} color={colors.primary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.h4} numberOfLines={2}>{item.name}</Text>
                      <Text style={[typography.caption, { marginTop: 2 }]}>{item.category}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        <Badge label={`Report: ${item.turnaroundTime ?? '24 Hrs'}`} tone="info" icon="clock" />
                        <Badge label={`${item.sampleType ?? 'Blood'} sample`} tone="brand" />
                        {item.homeCollectionAvailable !== false ? (
                          <Badge label="Free home pickup" tone="success" icon="home" />
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {item.description ? (
                    <Text style={[typography.small, { marginTop: spacing.md }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.priceRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                        <Text style={typography.price}>₹{price}</Text>
                        {off > 0 ? <Text style={styles.mrp}>₹{mrp}</Text> : null}
                        {off > 0 ? <Text style={styles.off}>{off}% OFF</Text> : null}
                      </View>
                      <Text style={typography.caption}>Fasting: {item.preparationInstructions ? 'as instructed' : 'not required'}</Text>
                    </View>
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  headerAvatarFallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  searchInput: { flex: 1, ...typography.body, paddingVertical: 0, color: colors.text },
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
  testIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  testImage: { width: '100%', height: '100%' },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  mrp: { ...typography.small, textDecorationLine: 'line-through', color: colors.textMuted },
  off: { ...typography.caption, color: colors.success, fontWeight: '700' },
});
