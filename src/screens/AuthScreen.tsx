/**
 * Auth — Login / Register (backend: /auth/user/login, /auth/user/register).
 *
 * 3 login options:
 *  1. Email / Mobile + Password  → /auth/user/login
 *  2. Mobile OTP (4 boxes)       → /auth/user/phone-send-otp + /phone-login
 *                                 (demo OTP "1234"; after Meta/SMS connect,
 *                                  real OTP flow will use same path)
 *  3. Google (Sign In + Sign Up) → native Google sheet, ID token backend
 *                                  /auth/user/google verifies the token.
 *
 * UI: premium refresh — soft brand wash with subtle blobs, staged entrance animations,
 *     elevated form card with pill-shaped trust actions, all text in English.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Logo } from '../components/Logo';
import Icon from '../components/Icon';
import { AppButton, Card, Screen, TextField } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import api, { User } from '../api/api';
import { GoogleSignInCancelledError, describeGoogleError, signInWithGoogle } from '../api/googleAuth';
import { RootStackParamList } from '../navigation/types';
import { colors, gradients, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;
type Mode = 'login' | 'register';
/** Login ke andar ka view: password ya phone OTP */
type LoginView = 'password' | 'phone';

/** Google ke official 4-rang wale "G" logo */
function GoogleGIcon({ size = 18 }: { size?: number }): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

export default function AuthScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const { login, register, googleLogin, phoneLogin } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [loginView, setLoginView] = useState<LoginView>('password');

  /* login state */
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  /* phone OTP state */
  const [otpPhone, setOtpPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const otpInputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  /* register state */
  const [name, setName] = useState('');   // Full name
  const [email, setEmail] = useState('');  // Email (optional)
  const [phone, setPhone] = useState('');  // Mobile number (optional)
  const [regPassword, setRegPassword] = useState(''); // Password

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /* ------------------------- entrance animation ------------------------- */
  /* Hero (logo + heading) pehle, form card thoda delay se — soft rise-in. */
  const heroAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(formAnim, { toValue: 1, duration: 400, delay: 130, useNativeDriver: true }),
    ]).start();
  }, [heroAnim, formAnim]);

  const heroStyle = {
    opacity: heroAnim,
    transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  };
  const formStyle = {
    opacity: formAnim,
    transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
  };

  const resetErrors = () => {
    setErrors({});
    setFormError(null);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (mode === 'login') {
      if (!identifier.trim()) {
        next.identifier = 'Email or phone number is required';
      }
      if (!password) {
        next.password = 'Password is required';
      }
    } else {
      if (!name.trim()) {
        next.name = 'Full name is required';
      }
      if (!email.trim() && !phone.trim()) {
        next.email = 'Email or phone number is required';
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        next.email = 'Enter a valid email address';
      }
      if (phone.trim() && phone.replace(/\D/g, '').length < 10) {
        next.phone = 'Enter a valid 10-digit mobile number';
      }
      if (regPassword.length < 6) {
        next.regPassword = 'Minimum 6 characters';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Session baad me same hai — profile complete ho toh seedha Main */
  const navigateAfterAuth = (user: User) => {
    if (!user.isProfileComplete) {
      navigation.replace('HealthProfile');
    } else {
      navigation.replace('Main');
    }
  };

  const submit = async () => {
    resetErrors();
    if (!validate()) {
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await login(identifier.trim(), password);
        navigateAfterAuth(user);
      } else {
        const user = await register({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password: regPassword,
        });
        navigateAfterAuth(user);
      }
    } catch (error) {
      setFormError((error as Error).message || 'Unable to continue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------- phone OTP flow ------------------------- */

  const toggleLoginView = () => {
    resetErrors();
    setLoginView(prev => (prev === 'phone' ? 'password' : 'phone'));
    setOtpSent(false);
    setOtp('');
  };

  const sendOtp = async () => {
    resetErrors();
    const digits = otpPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      setErrors({ otpPhone: 'Enter a valid 10-digit mobile number' });
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.phoneSendOtp({ phone: digits });
      setOtpSent(true);
      setOtp('');
    } catch (error) {
      setFormError((error as Error).message || 'Unable to send OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (code?: string) => {
    const finalOtp = (code ?? otp).trim();
    if (finalOtp.length !== 4) {
      setErrors(prev => ({ ...prev, otp: 'Enter the 4-digit OTP' }));
      return;
    }
    resetErrors();
    setSubmitting(true);
    try {
      const user = await phoneLogin(otpPhone.replace(/\D/g, ''), finalOtp);
      navigateAfterAuth(user);
    } catch (error) {
      setOtp('');
      setFormError((error as Error).message || 'Unable to verify OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setOtp(digits);
    if (errors.otp) {
      setErrors(prev => ({ ...prev, otp: '' }));
    }
    if (digits.length === 4) {
      // 4 digit poore hote hi apne aap verify
      verifyOtp(digits);
    }
  };

  /* --------------------------- Google flow --------------------------- */

  const onGooglePress = async () => {
    resetErrors();
    setSubmitting(true);
    try {
      const idToken = await signInWithGoogle();
      const user = await googleLogin(idToken);
      navigateAfterAuth(user);
    } catch (error) {
      if (error instanceof GoogleSignInCancelledError) {
        return; // user ne sheet band ki — silent
      }
      setFormError(describeGoogleError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    resetErrors();
    setMode(next);
    if (next === 'login') {
      setLoginView('password');
      setOtpSent(false);
      setOtp('');
      setName('');
      setEmail('');
      setPhone('');
      setRegPassword('');
    }
  };

  const isPhoneView = mode === 'login' && loginView === 'phone';
  /* Auth wash ke stops bhi theme follow karte hain (dark = deep ink wash). */
  const wash = gradients.authWash;

  return (
    <Screen backgroundColor={colors.card}>
      {/* Premium background — soft brand wash + do subtle glow blobs */}
      <View style={styles.bgWash} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <SvgGradient id="authWash" x1="0" y1="0" x2="0.35" y2="1">
              <Stop offset="0" stopColor={wash[0]} />
              <Stop offset="0.45" stopColor={wash[1]} />
              <Stop offset="1" stopColor={wash[2]} />
            </SvgGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#authWash)" />
        </Svg>
      </View>
      <View style={[styles.blob, styles.blobTeal]} pointerEvents="none" />
      <View style={[styles.blob, styles.blobBlue]} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.kbd}
        // edgeToEdgeEnabled=true hone ki wajah se Android me window resize nahi
        // hota — keyboard form ke upar aa jaata hai. Isliye 'height' behavior.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <Animated.View style={[styles.brand, heroStyle]}>
            <Logo width={214} />
          </Animated.View>

          {/* Heading + segmented control */}
          <Animated.View style={heroStyle}>
            <View style={styles.accentBar} />
            <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Sign in to book doctors, lab tests and home care.'
                : 'Book verified doctors, nurses and lab tests at your doorstep.'}
            </Text>

            {/* Segmented control */}
            <View style={styles.segment}>
              {(['login', 'register'] as Mode[]).map(item => (
                <Pressable
                  key={item}
                  onPress={() => switchMode(item)}
                  style={[styles.segmentItem, mode === item && styles.segmentActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      mode === item && styles.segmentTextActive,
                    ]}
                  >
                    {item === 'login' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Form card + social block */}
          <Animated.View style={formStyle}>
            <Card elevated style={styles.formCard}>
              {isPhoneView ? (
                <>
                  <TextField
                    label="Mobile Number"
                    icon="phone"
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={otpPhone}
                    onChangeText={t => {
                      setOtpPhone(t.replace(/\D/g, '').slice(0, 10));
                      if (otpSent) {
                        // number badla toh purana OTP invalid
                        setOtpSent(false);
                        setOtp('');
                      }
                      if (errors.otpPhone) {
                        setErrors(prev => ({ ...prev, otpPhone: '' }));
                      }
                    }}
                    error={errors.otpPhone}
                  />

                  {otpSent ? (
                    <View style={styles.otpBlock}>
                      <Text style={styles.otpLabel}>Enter 4-digit OTP</Text>
                      <Pressable style={styles.otpRow} onPress={() => otpInputRef.current?.focus()}>
                        {[0, 1, 2, 3].map(i => (
                          <View
                            key={i}
                            style={[
                              styles.otpBox,
                              otp.length === i && !submitting && styles.otpBoxActive,
                            ]}
                          >
                            <Text style={styles.otpBoxText}>{otp[i] || ''}</Text>
                          </View>
                        ))}
                        {/* boxes ke upar chhupa input — tap karne par keyboard khulta hai */}
                        <TextInput
                          ref={otpInputRef}
                          value={otp}
                          onChangeText={handleOtpChange}
                          keyboardType="number-pad"
                          maxLength={4}
                          autoFocus
                          caretHidden
                          textContentType="oneTimeCode"
                          style={styles.otpHiddenInput}
                        />
                      </Pressable>
                      {errors.otp ? <Text style={styles.otpError}>{errors.otp}</Text> : null}
                      {/* For Meta/SMS OTP connection, remove this hint after real OTP integration */}
                      <Text style={styles.otpHint}>Demo mode — OTP is 1234</Text>
                    </View>
                  ) : null}
                </>
              ) : mode === 'login' ? (
                <>
                  <TextField
                    label="Email or Mobile Number"
                    icon="user"
                    placeholder="e.g. user@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={identifier}
                    onChangeText={setIdentifier}
                    error={errors.identifier}
                  />
                  <TextField
                    label="Password"
                    icon="lock"
                    placeholder="Enter your password"
                    secureTextEditable
                    value={password}
                    onChangeText={setPassword}
                    error={errors.password}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="Full Name"
                    icon="user"
                    placeholder="Patient name"
                    value={name}
                    onChangeText={setName}
                    error={errors.name}
                  />
                  <TextField
                    label="Email (optional)"
                    icon="mail"
                    placeholder="name@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    error={errors.email}
                  />
                  <TextField
                    label="Mobile Number"
                    icon="phone"
                    placeholder="10-digit mobile number"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={setPhone}
                    error={errors.phone}
                  />
                  <TextField
                    label="Password"
                    icon="lock"
                    placeholder="Minimum 6 characters"
                    secureTextEditable
                    value={regPassword}
                    onChangeText={setRegPassword}
                    error={errors.regPassword}
                  />
                </>
              )}

              {formError ? (
                <View style={styles.formError}>
                  <Icon name="alert-triangle" size={15} color={colors.danger} />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              {isPhoneView ? (
                <AppButton
                  label={otpSent ? 'Verify & Sign In' : 'Send OTP'}
                  onPress={otpSent ? () => verifyOtp() : sendOtp}
                  loading={submitting}
                  size="lg"
                />
              ) : (
                <AppButton
                  label={mode === 'login' ? 'Sign In' : 'Create Account'}
                  onPress={submit}
                  loading={submitting}
                  size="lg"
                />
              )}

              {mode === 'login' ? (
                <Pressable onPress={toggleLoginView} style={styles.altLink} hitSlop={8}>
                  <Text style={styles.altLinkText}>
                    {loginView === 'phone'
                      ? '← Sign in with email / password'
                      : 'Login with Mobile OTP →'}
                  </Text>
                </Pressable>
              ) : null}
            </Card>

            {/* Divider + Google (Sign In dono modes me chalta hai) */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={onGooglePress}
              disabled={submitting}
              style={({ pressed }) => [
                styles.googleBtn,
                pressed && { opacity: 0.85 },
                submitting && { opacity: 0.55 },
              ]}
            >
              <GoogleGIcon size={19} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </Pressable>

            {/* Trust pill — security reassure karta hai */}
            <View style={styles.trustPill}>
              <Icon name="shield-check" size={14} color={colors.accent} />
              <Text style={styles.trustText}>Your health data stays private and secure.</Text>
            </View>

            {/* Guest — outline pill */}
            <Pressable
              onPress={() => navigation.replace('Main')}
              style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.75 }]}
              hitSlop={8}
            >
              <Text style={styles.guestText}>Continue as guest</Text>
              <Icon name="arrow-right" size={15} color={colors.blue} />
            </Pressable>

            <Text style={styles.terms}>
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* ---------------------------- background ---------------------------- */
  bgWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 470 },
  blob: { position: 'absolute', borderRadius: 999 },
  blobTeal: {
    width: 230,
    height: 230,
    top: -95,
    left: -85,
    backgroundColor: colors.primary,
    opacity: 0.12,
  },
  blobBlue: {
    width: 270,
    height: 270,
    top: -125,
    right: -100,
    backgroundColor: colors.blue,
    opacity: 0.08,
  },

  /* ------------------------------ header ------------------------------ */
  kbd: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  brand: { alignItems: 'center', marginTop: spacing.xl },
  accentBar: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, fontSize: 27, lineHeight: 33 },
  subtitle: { ...typography.lead, marginTop: 6, marginBottom: spacing.xl },

  /* ---------------------------- segmented ----------------------------- */
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.cardOverlay,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  segmentItem: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.blue, ...shadow.sm },
  segmentText: { ...typography.smallMedium, color: colors.textSecondary, fontSize: 13.5 },
  segmentTextActive: { color: colors.textInverse },

  /* ------------------------------- form ------------------------------- */
  formCard: { marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.xl },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  formErrorText: { ...typography.caption, color: colors.danger, flex: 1, fontSize: 12 },
  altLink: { alignSelf: 'center', marginTop: spacing.md, padding: spacing.xs },
  altLinkText: { ...typography.smallMedium, color: colors.blue, fontSize: 13 },

  /* ------------------------------ OTP boxes ------------------------------ */
  otpBlock: { marginBottom: spacing.lg },
  otpLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  otpRow: { flexDirection: 'row', gap: spacing.sm, position: 'relative' },
  otpBox: {
    flex: 1,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: { borderColor: colors.blue, backgroundColor: colors.card, ...shadow.sm },
  otpBoxText: { ...typography.h3, color: colors.text, fontSize: 22 },
  otpHiddenInput: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0,
    fontSize: 1, // keyboard na dikhe, sirf focus chahiye
  },
  otpError: { ...typography.caption, color: colors.danger, marginTop: spacing.sm, fontSize: 12 },
  otpHint: {
    ...typography.caption,
    color: '#B45309',
    backgroundColor: colors.warningLight,
    borderRadius: radius.pill,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: spacing.md,
    fontSize: 11.5,
  },

  /* ------------------------------ Google -------------------------------- */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderStrong },
  dividerText: { ...typography.eyebrow, fontSize: 10.5 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  googleBtnText: { ...typography.bodyMedium, fontSize: 15 },

  /* --------------------------- trust / guest --------------------------- */
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'center',
    maxWidth: '100%',
    backgroundColor: colors.accentLight,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: spacing.xl,
  },
  trustText: { ...typography.caption, color: colors.textSecondary, fontSize: 11.5 },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'center',
    height: 44,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardOverlay,
  },
  guestText: { ...typography.smallMedium, color: colors.blue, fontSize: 13 },
  terms: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
});
