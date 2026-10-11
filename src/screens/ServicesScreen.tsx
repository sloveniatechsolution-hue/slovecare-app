/**
 * Services hub — website ke care categories ko app me discoverable banata hai.
 * Blood requests existing SOS workflow use karte hain; koi naya backend contract nahi.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import { AppButton, Badge, Card, EmptyState, ErrorState, Loader, Screen, SectionHeader } from '../components/UI';
import api, { HealthcareService } from '../api/api';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Services'>;

const FALLBACK: HealthcareService[] = [
  { id: 'doctor', name: 'Doctor at Home', description: 'Verified doctors for home and online consultations.', icon: 'stethoscope' },
  { id: 'nursing', name: 'Nursing & Compounder Care', description: 'Dressing, injections, IV and daily support.', icon: 'heart-pulse' },
  { id: 'labs', name: 'Lab Tests at Home', description: 'Sample collection and digital reports.', icon: 'flask' },
  /* Medicines delivery hata diya — Care Takers ab yahan */
  { id: 'care', name: 'Care Takers', description: 'Verified caretakers for elder & patient care.', icon: 'hand-heart' },
];

const WELLNESS = [
  { title: 'Preventive health', text: 'Book routine lab tests and keep reports together.', icon: 'activity' as IconName, tab: 'Labs' },
  { title: 'Care for elders', text: 'Find reliable caretakers and home nursing support.', icon: 'users' as IconName, tab: 'Doctors' },
  { title: 'Health records', text: 'Access prescriptions and lab reports when you need them.', icon: 'file-text' as IconName, route: 'LabReports' },
];

export default function ServicesScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const [services, setServices] = useState<HealthcareService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setServices(await api.services.list());
    } catch (e) {
      setError((e as Error).message || 'Services could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openService = (service: HealthcareService) => {
    const text = `${service.name} ${service.category ?? ''}`.toLowerCase();
    if (text.includes('lab')) navigation.navigate('Main', { screen: 'Labs' });
    /* Medicines/pharmacy segment disabled — Care Takers category par bhejta hai */
    else if (text.includes('medicine') || text.includes('pharmacy')) {
      navigation.navigate('Main', { screen: 'Doctors', params: { type: 'caretaker' } });
    } else if (text.includes('caretaker') || text.includes('elder')) {
      navigation.navigate('Main', { screen: 'Doctors', params: { type: 'caretaker' } });
    } else navigation.navigate('Main', { screen: 'Doctors' });
  };

  /** Medicines/pharmacy entries UI se hata diye (segment disabled). */
  const visibleServices = React.useMemo(
    () =>
      (services.length ? services : FALLBACK).filter(
        s => !/medicine|pharmacy/i.test(`${s.name} ${s.category ?? ''} ${s.description ?? ''}`),
      ),
    [services],
  );

  return (
    <Screen>
      <AppHeader title="Health Services" subtitle="Care for every stage of life" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Badge label="Doorstep healthcare" tone="brand" icon="shield-check" />
          <Text style={styles.heroTitle}>The right care, right when you need it.</Text>
          <Text style={styles.heroText}>Book verified doctors, nurses, caretakers and lab tests from one place.</Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Book a service" subtitle="Verified providers and transparent booking" />
          {loading ? <Loader label="Loading services…" /> : error && !services.length ? <ErrorState message={error} onRetry={load} /> :
            visibleServices.map(service => (
              <Pressable key={service.id} onPress={() => openService(service)} style={({ pressed }) => [styles.service, pressed && { opacity: 0.82 }]}>
                <View style={styles.serviceIcon}><Icon name={(service.icon as IconName) || 'activity'} size={21} color={colors.primary} /></View>
                <View style={{ flex: 1 }}><Text style={typography.smallMedium}>{service.name}</Text><Text style={typography.caption}>{service.description || 'Professional care, booked in a few taps.'}</Text></View>
                <Icon name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
        </View>

        <Card style={styles.bloodCard}>
          <View style={styles.bloodIcon}><Icon name="heart" size={22} color={colors.danger} /></View>
          <View style={{ flex: 1 }}>
            <Text style={typography.h4}>Blood Bank Assistance</Text>
            <Text style={[typography.small, { marginTop: 3 }]}>Need blood urgently? Raise a priority request and our emergency team can coordinate support.</Text>
          </View>
          <AppButton label="Request" size="sm" variant="danger" full={false} onPress={() => navigation.navigate('Emergency')} />
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Wellness & prevention" subtitle="Small steps for healthier everyday care" />
          {WELLNESS.map(item => (
            <Pressable key={item.title} style={styles.wellness} onPress={() => item.route ? navigation.navigate(item.route as 'LabReports') : navigation.navigate('Main', { screen: item.tab as 'Labs' | 'Doctors' })}>
              <Icon name={item.icon} size={19} color={colors.blue} />
              <View style={{ flex: 1 }}><Text style={typography.smallMedium}>{item.title}</Text><Text style={typography.caption}>{item.text}</Text></View>
              <Icon name="arrow-right" size={17} color={colors.blue} />
            </Pressable>
          ))}
        </View>

        {!loading && error && services.length > 0 ? <Text style={styles.quietError}>Some services may be temporarily unavailable. Pull down to refresh.</Text> : null}
        {!loading && !error && !services.length ? <EmptyState icon="layers" title="More services coming soon" subtitle="You can still book doctors, caretakers and lab tests above." /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.xl },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  heroTitle: { ...typography.h2, color: colors.textInverse, marginTop: spacing.sm },
  heroText: { ...typography.small, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  section: { gap: spacing.sm },
  service: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  serviceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  bloodCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderColor: '#FECACA', backgroundColor: '#FFF8F8' },
  bloodIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerLight },
  wellness: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  quietError: { ...typography.caption, textAlign: 'center', color: colors.textMuted },
});
