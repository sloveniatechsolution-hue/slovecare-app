/**
 * Emergency SOS — nearest responder auto-dispatch.
 * Backend: POST /api/v1/emergency/sos, GET /api/v1/emergency/active.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import { AppButton, Card, GradientCard, Screen, SectionHeader, TextField } from '../components/UI';
import api, { EmergencySOSResponse } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Emergency'>;

const EMERGENCY_NUMBER = '1800-123-456';

const SEVERITIES: { key: 'critical' | 'high' | 'moderate'; label: string; sub: string; icon: IconName }[] = [
  { key: 'critical', label: 'Critical', sub: 'Unconscious, chest pain, bleeding', icon: 'alert-triangle' },
  { key: 'high', label: 'High', sub: 'Breathing trouble, severe fever', icon: 'activity' },
  { key: 'moderate', label: 'Moderate', sub: 'Injury, fracture, steady pain', icon: 'info' },
];

const REQUIREMENTS = ['Emergency Doctor & Medical Support', 'ICU Ambulance', 'Nursing Support', 'Blood Requirement'];

export default function EmergencyScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const { user } = useAuth();

  const [patientName, setPatientName] = useState(user?.name ?? '');
  const [patientPhone, setPatientPhone] = useState(user?.phone ?? '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [condition, setCondition] = useState('');
  const [severity, setSeverity] = useState<'critical' | 'high' | 'moderate'>('critical');
  const [requirement, setRequirement] = useState(REQUIREMENTS[0]);
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState<EmergencySOSResponse | null>(null);

  const dispatch = async () => {
    if (!patientName.trim() || !patientPhone.trim() || !condition.trim()) {
      Alert.alert('Missing details', 'Patient name, phone and condition are required.');
      return;
    }
    setDispatching(true);
    try {
      const response = await api.emergency.triggerSOS({
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientAge: Number(age) || undefined,
        conditionDescription: condition.trim(),
        requirement,
        severity,
        latitude: 26.9124,
        longitude: 75.7873,
        location: 'Jaipur, Rajasthan',
      });
      setResult(response);
    } catch (e) {
      Alert.alert('Dispatch failed', (e as Error).message || 'Please call the helpline instead.');
    } finally {
      setDispatching(false);
    }
  };

  useEffect(() => {
    if (result?.assignedVendor?.phone) {
      // no auto call — user ke liye call button available hai
    }
  }, [result]);

  return (
    <Screen>
      <AppHeader
        title="Emergency SOS"
        subtitle="24/7 rapid medical response"
        onBack={() => navigation.goBack()}
        rightIcon="phone-call"
        onRightPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {})}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2 }} keyboardShouldPersistTaps="handled">
          {/* Hero */}
          <GradientCard from={colors.danger} to="#9F1239" style={[styles.hero, shadow.float]}>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <Icon name="ambulance" size={26} color={colors.textInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Launch Emergency Dispatch</Text>
                <Text style={styles.heroText}>
                  Nearest verified responder is auto-assigned with live ETA.
                </Text>
              </View>
            </View>
            <View style={styles.heroStats}>
              {[
                { v: '< 10 min', l: 'Avg. ETA' },
                { v: '24/7', l: 'Always on' },
                { v: 'ALS', l: 'Equipped' },
              ].map(s => (
                <View key={s.l} style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{s.v}</Text>
                  <Text style={styles.heroStatLabel}>{s.l}</Text>
                </View>
              ))}
            </View>
          </GradientCard>

          {/* Result */}
          {result ? (
            <Card style={{ marginTop: spacing.lg, borderColor: colors.success }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={[styles.heroIcon, { backgroundColor: colors.successLight }]}>
                  <Icon name="check-circle" size={22} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h4}>SOS Dispatched</Text>
                  <Text style={typography.caption}>Ticket #{result.sos.id} • ETA {result.etaMinutes} min</Text>
                </View>
              </View>
              {result.assignedVendor ? (
                <View style={styles.vendorBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.smallMedium}>{result.assignedVendor.name}</Text>
                    <Text style={typography.caption}>{result.assignedVendor.type}</Text>
                  </View>
                  <AppButton
                    label="Call"
                    icon="phone"
                    variant="accent"
                    size="sm"
                    full={false}
                    onPress={() =>
                      Linking.openURL(`tel:${result.assignedVendor?.phone?.replace(/\s/g, '')}`).catch(() => {})
                    }
                  />
                </View>
              ) : (
                <Text style={[typography.small, { marginTop: spacing.md }]}>
                  Central emergency pool notified — helpline will reach you shortly.
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <AppButton
                  label="Call Helpline"
                  icon="phone-call"
                  variant="danger"
                  size="sm"
                  full={false}
                  style={{ flex: 1 }}
                  onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {})}
                />
                <AppButton
                  label="New SOS"
                  variant="outline"
                  size="sm"
                  full={false}
                  style={{ flex: 1 }}
                  onPress={() => setResult(null)}
                />
              </View>
            </Card>
          ) : null}

          {/* Severity */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Severity" subtitle="Helps us prioritise the response" />
            <View style={{ gap: spacing.sm }}>
              {SEVERITIES.map(s => {
                const active = severity === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSeverity(s.key)}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <View style={[styles.optionIcon, active && { backgroundColor: colors.dangerLight }]}>
                      <Icon name={s.icon} size={18} color={active ? colors.danger : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={typography.smallMedium}>{s.label}</Text>
                      <Text style={typography.caption}>{s.sub}</Text>
                    </View>
                    <Icon name={active ? 'check-circle' : 'chevron-right'} size={18} color={active ? colors.danger : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Requirement */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Requirement" />
            <View style={styles.wrapChips}>
              {REQUIREMENTS.map(r => {
                const active = requirement === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRequirement(r)}
                    style={[styles.pill, active && { backgroundColor: colors.navy, borderColor: colors.navy }]}
                  >
                    <Text style={[typography.small, active && { color: colors.textInverse }]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Patient */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title="Patient details" />
            <Card>
              <TextField label="Patient Name" icon="user" value={patientName} onChangeText={setPatientName} />
              <TextField
                label="Contact Number"
                icon="phone"
                keyboardType="phone-pad"
                value={patientPhone}
                onChangeText={setPatientPhone}
              />
              <TextField
                label="Age"
                icon="info"
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
                placeholder="35"
              />
              <TextField
                label="Condition description"
                icon="activity"
                value={condition}
                onChangeText={setCondition}
                placeholder="What happened? Symptoms, injuries…"
                multiline
              />
            </Card>
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <AppButton
              label="Dispatch Emergency Now"
              icon="zap"
              variant="danger"
              size="lg"
              loading={dispatching}
              onPress={dispatch}
            />
            <AppButton
              label={`Call Emergency Helpline (${EMERGENCY_NUMBER})`}
              icon="phone-call"
              variant="outline"
              onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {})}
            />
          </View>

          <View style={styles.note}>
            <Icon name="shield-check" size={15} color={colors.primary} />
            <Text style={[typography.caption, { flex: 1 }]}>
              Your live location and this ticket are shared with the assigned responder only.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { ...typography.h4, color: colors.textInverse },
  heroText: { ...typography.caption, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  heroStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { ...typography.bodyMedium, color: colors.textInverse, fontWeight: '800' },
  heroStatLabel: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  vendorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionActive: { borderColor: colors.danger, backgroundColor: '#FFF5F7' },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg,
    height: 40,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.lg,
  },
});
