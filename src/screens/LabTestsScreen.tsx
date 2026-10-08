/**
 * Lab Tests — NABL tests list + search + book home collection.
 * Backend: GET /api/v1/lab-tests, booking → POST /bookings (serviceType lab_test).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from '../components/Icon';
import { AppButton, Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { LabTest } from '../api/api';
import { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LabTestsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [tests, setTests] = useState<LabTest[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.labTests.list({ search: query || undefined });
      setTests(result);
    } catch (e) {
      setError((e as Error).message || 'Could not load lab tests.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h3}>Lab Tests at Home</Text>
            <Text style={[typography.small, { marginTop: 2 }]}>
              Free sample pickup • Digital reports in 24 hrs
            </Text>
          </View>
          <Badge label="NABL Labs" tone="warning" icon="award" />
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

      {loading && tests.length === 0 ? (
        <Loader label="Loading diagnostic tests…" />
      ) : error && tests.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : tests.length === 0 ? (
        <EmptyState
          icon="flask"
          title="No diagnostic tests currently available"
          subtitle="Certified pathology labs will list test packages here soon."
          actionLabel="Refresh"
          onAction={load}
        />
      ) : (
        <FlatList
          data={tests}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item }) => {
            const mrp = item.price;
            const price = item.discountedPrice ?? item.price;
            const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
            return (
              <Card>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={styles.testIcon}>
                    <Icon name="flask" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h4} numberOfLines={2}>
                      {item.name}
                    </Text>
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
                  <AppButton
                    label="Book Test"
                    icon="calendar"
                    size="sm"
                    full={false}
                    onPress={() => navigation.navigate('Booking', { mode: 'lab', test: item })}
                  />
                </View>
              </Card>
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
  testIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
