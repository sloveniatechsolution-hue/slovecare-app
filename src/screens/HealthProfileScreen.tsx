/**
 * Health Profile — complete karke save karte hain
 * (backend: PUT /auth/user/health-profile).
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { City, State } from 'country-state-city';
import AppHeader from '../components/AppHeader';
import AvatarPicker from '../components/AvatarPicker';
import Icon from '../components/Icon';
import { AppButton, Card, Chip, Screen, SectionHeader, SelectField, TextField } from '../components/UI';
import api, { BloodGroup } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'HealthProfile'>;

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = ['Male', 'Female', 'Other'];

/* country-state-city se India ke states milte hain, city hamesha selected
 * state par depend karti hai (pehle state, phir city — user flow). */
const COUNTRY = 'IN';
const INDIA_STATES = State.getStatesOfCountry(COUNTRY);

export default function HealthProfileScreen({ navigation, route }: Props): React.JSX.Element {
  useThemePreference();
  const { user, updateUser } = useAuth();
  const isSetup = !user?.isProfileComplete;

  const [name, setName] = useState(user?.name ?? '');
  const [gender, setGender] = useState(user?.gender ?? 'Male');
  const [bloodGroup, setBloodGroup] = useState<string>(user?.bloodGroup ?? 'O+');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [weight, setWeight] = useState(user?.weight ? String(user.weight) : '');
  const [height, setHeight] = useState(user?.height ? String(user.height) : '');
  const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact ?? '');
  const [stateName, setStateName] = useState(user?.state ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [pincode, setPincode] = useState(user?.pincode ?? '');
  const [conditions, setConditions] = useState((user?.medicalConditions ?? []).join(', '));
  const [allergies, setAllergies] = useState((user?.allergies ?? []).join(', '));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSkip = useMemo(() => !isSetup, [isSetup]);

  /* Pehle state select, uske baad sirf usi state ke cities — flow order fix. */
  const stateOptions = useMemo(
    () => INDIA_STATES.map(s => ({ label: s.name, value: s.name })),
    [],
  );
  const cityOptions = useMemo(() => {
    const trimmedState = stateName.trim().toLowerCase();
    const selected = INDIA_STATES.find(
      s => s.name.toLowerCase() === trimmedState || s.isoCode.toLowerCase() === trimmedState,
    );
    if (!selected) {
      return [];
    }
    return City.getCitiesOfState(COUNTRY, selected.isoCode).map(c => ({ label: c.name, value: c.name }));
  }, [stateName]);

  const onStateChange = (next: string) => {
    setStateName(next);
    setError(null);
    /* State badalte hi purani city nahi rehni chahiye agar state alag hai. */
    if (next !== stateName) {
      setCity('');
    }
  };

  const onCityChange = (next: string) => {
    setCity(next);
    setError(null);
  };

  /** Photo Cloudinary par upload ho chuki hai — user me save kar do. */
  const savePhoto = async (url: string) => {
    try {
      const updated = await api.auth.updateAvatar(url);
      updateUser(updated ?? { avatar: url });
    } catch (e) {
      Alert.alert('Profile photo', (e as Error).message || 'Could not save your photo. Please try again.');
    }
  };

  const save = async (navigateNext: boolean) => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!stateName.trim()) {
      setError('Please select your state.');
      return;
    }
    if (!city.trim()) {
      setError('Please select your city.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.auth.updateHealthProfile({
        name: name.trim(),
        gender,
        bloodGroup,
        age: Number(age) || undefined,
        weight: Number(weight) || undefined,
        height: Number(height) || undefined,
        emergencyContact: emergencyContact.trim(),
        state: stateName.trim(),
        city: city.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        medicalConditions: splitList(conditions),
        allergies: splitList(allergies),
      });
      updateUser(updated ?? { isProfileComplete: true });
      if (navigateNext) {
        navigation.replace('Main');
      }
    } catch (e) {
      setError((e as Error).message || 'Could not save health profile.');
    } finally {
      setSaving(false);
    }
  };

  if (route?.params === undefined) {
    /* handled via prop */
  }

  return (
    <Screen>
      <AppHeader
        title={isSetup ? 'Complete your health profile' : 'Health profile'}
        subtitle="Helps doctors prepare better for your visit"
        onBack={() => (isSetup ? undefined : navigation.goBack())}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Profile photo — tap karke camera/gallery se badlo */}
          <View style={styles.photoBlock}>
            <AvatarPicker avatar={user?.avatar} name={name} size={96} onUploaded={savePhoto} />
            <Text style={[typography.smallMedium, { marginTop: spacing.sm }]}>Profile photo</Text>
            <Text style={typography.caption}>Tap the camera icon to add or change</Text>
          </View>

          <Card>
            <SectionHeader title="Basics" subtitle="Patient identity details" />
            <TextField label="Full Name" icon="user" value={name} onChangeText={setName} placeholder="Patient name" />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipRow}>
              {GENDERS.map(g => (
                <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />
              ))}
            </View>

            <Text style={styles.label}>Blood Group</Text>
            <View style={styles.chipRow}>
              {BLOOD_GROUPS.map(b => (
                <Chip key={b} label={b} active={bloodGroup === b} onPress={() => setBloodGroup(b)} />
              ))}
            </View>

            <View style={styles.grid}>
              <TextField
                label="Age"
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
                placeholder="28"
                containerStyle={styles.gridItem}
              />
              <TextField
                label="Weight (kg)"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                placeholder="68"
                containerStyle={styles.gridItem}
              />
            </View>
            <View style={styles.grid}>
              <TextField
                label="Height (cm)"
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
                placeholder="172"
                containerStyle={styles.gridItem}
              />
              <TextField
                label="Emergency Contact"
                keyboardType="phone-pad"
                value={emergencyContact}
                onChangeText={setEmergencyContact}
                placeholder="+91 98xxx xxxxx"
                containerStyle={styles.gridItem}
              />
            </View>
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Address" subtitle="Used for home visits & sample pickup" />
            <SelectField
              label="State"
              icon="map-pin"
              placeholder="Select state"
              searchPlaceholder="Search state…"
              emptyText="No state found"
              value={stateName}
              options={stateOptions}
              onChange={onStateChange}
            />
            <SelectField
              label="City"
              icon="navigation"
              placeholder={stateName ? 'Select city' : 'Select a state first'}
              searchPlaceholder="Search city…"
              emptyText={stateName ? 'No city found for this state' : 'Choose your state to see cities'}
              value={city}
              options={cityOptions}
              onChange={onCityChange}
              disabled={!stateName}
            />
            <TextField
              label="Full Address"
              icon="navigation"
              value={address}
              onChangeText={setAddress}
              placeholder="House no., street, landmark"
              multiline
            />
            <TextField
              label="Pincode"
              keyboardType="number-pad"
              maxLength={6}
              value={pincode}
              onChangeText={setPincode}
              placeholder="302006"
            />
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <SectionHeader title="Medical details" subtitle="Comma separated values" />
            <TextField
              label="Existing Conditions"
              icon="activity"
              value={conditions}
              onChangeText={setConditions}
              placeholder="Diabetes, Hypertension"
            />
            <TextField
              label="Allergies"
              icon="alert-triangle"
              value={allergies}
              onChangeText={setAllergies}
              placeholder="Penicillin, Dust"
            />
            <View style={styles.note}>
              <Icon name="shield-check" size={15} color={colors.accent} />
              <Text style={[typography.caption, { flex: 1 }]}>
                This information is only shared with the professional you book.
              </Text>
            </View>
          </Card>

          {error ? (
            <View style={[styles.note, { backgroundColor: colors.dangerLight, marginTop: spacing.lg }]}>
              <Icon name="alert-triangle" size={15} color={colors.danger} />
              <Text style={[typography.caption, { color: colors.danger, flex: 1 }]}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <AppButton label="Save & Continue" onPress={() => save(true)} loading={saving} size="lg" />
            {canSkip ? <AppButton label="Save" variant="outline" onPress={() => save(false)} loading={saving} /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  photoBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  label: { ...typography.smallMedium, color: colors.text, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  grid: { flexDirection: 'row', gap: spacing.md },
  gridItem: { flex: 1 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentLight,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
});
