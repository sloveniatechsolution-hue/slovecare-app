/**
 * Pharmacy — medicine search + stock info + order (cart style).
 * Backend: GET /api/v1/medicines, order → POST /bookings (medicine_order).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from '../components/Icon';
import { AppButton, Badge, Card, EmptyState, ErrorState, Loader, Screen } from '../components/UI';
import api, { Medicine } from '../api/api';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PharmacyScreen(): React.JSX.Element {
  useThemePreference();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.medicines.list({ search: query || undefined });
      setMedicines(result);
    } catch (e) {
      setError((e as Error).message || 'Could not load medicines.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const changeQty = (id: string, delta: number) => {
    setCart(prev => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) };
      if (next[id] === 0) {
        delete next[id];
      }
      return next;
    });
  };

  const cartItems = useMemo(
    () =>
      medicines
        .filter(m => cart[m.id])
        .map(m => ({ medicine: m, qty: cart[m.id] })),
    [medicines, cart],
  );

  const cartTotal = cartItems.reduce((sum, item) => sum + item.medicine.price * item.qty, 0);

  const checkout = () => {
    if (cartItems.length === 0) {
      return;
    }
    navigation.navigate('Booking', {
      mode: 'medicine',
      items: cartItems.map(i => i.medicine),
      total: cartTotal,
    });
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h3}>Pharmacy</Text>
            <Text style={[typography.small, { marginTop: 2 }]}>Genuine medicines delivered fast</Text>
          </View>
          <Badge label="Rx Delivery" tone="brand" icon="pill" />
        </View>

        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search medicine, salt or brand"
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

      {loading && medicines.length === 0 ? (
        <Loader label="Loading medicines…" />
      ) : error && medicines.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : medicines.length === 0 ? (
        <EmptyState
          icon="pill"
          title="No medicines found"
          subtitle="Try another salt or brand name."
          actionLabel="Refresh"
          onAction={load}
        />
      ) : (
        <FlatList
          data={medicines}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item }) => {
            const qty = cart[item.id] ?? 0;
            const outOfStock = item.stock === 0 || item.stockStatus === 'out_of_stock';
            return (
              <Card style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={styles.medImageWrap}>
                    <Image source={{ uri: item.image }} style={styles.medImage} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.h4} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[typography.caption, { marginTop: 2 }]} numberOfLines={1}>
                      {item.salt || item.brand}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <Badge label={item.packSize ?? 'Strip'} tone="neutral" />
                      {item.prescriptionRequired ? <Badge label="Rx required" tone="warning" /> : null}
                      {outOfStock ? (
                        <Badge label="Out of stock" tone="danger" />
                      ) : item.stockStatus === 'low_stock' ? (
                        <Badge label="Low stock" tone="warning" />
                      ) : (
                        <Badge label="In stock" tone="success" />
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={typography.price}>₹{item.price}</Text>
                    {item.mrp && item.mrp > item.price ? (
                      <Text style={styles.mrp}>₹{item.mrp}</Text>
                    ) : null}
                  </View>

                  {outOfStock ? (
                    <Text style={[typography.small, { color: colors.danger }]}>Notify me</Text>
                  ) : qty === 0 ? (
                    <AppButton
                      label="Add"
                      icon="plus"
                      size="sm"
                      full={false}
                      onPress={() => changeQty(item.id, 1)}
                    />
                  ) : (
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepBtn} onPress={() => changeQty(item.id, -1)}>
                        <Icon name="x" size={14} color={colors.blue} />
                      </Pressable>
                      <Text style={[typography.smallMedium, { minWidth: 18, textAlign: 'center' }]}>{qty}</Text>
                      <Pressable style={styles.stepBtn} onPress={() => changeQty(item.id, 1)}>
                        <Icon name="plus" size={14} color={colors.blue} />
                      </Pressable>
                    </View>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Cart bar */}
      {cartItems.length > 0 ? (
        <View style={styles.cartBar}>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>
              {cartItems.length} item{cartItems.length === 1 ? '' : 's'} in cart
            </Text>
            <Text style={typography.price}>₹{cartTotal}</Text>
          </View>
          <View style={{ flex: 1.4 }}>
            <AppButton label="Place Order" icon="arrow-right" size="lg" onPress={checkout} />
          </View>
        </View>
      ) : null}
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
  medImageWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    backgroundColor: colors.cardMuted,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  medImage: { width: '100%', height: '100%' },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  mrp: { ...typography.caption, textDecorationLine: 'line-through' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F7FF',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    height: 36,
    borderWidth: 1,
    borderColor: '#D8E4FF',
  },
  stepBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.float,
  },
});
