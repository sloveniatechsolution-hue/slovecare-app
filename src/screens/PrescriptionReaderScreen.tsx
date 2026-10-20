/**
 * Prescription Reader — photo se patient-friendly prescription summary.
 *
 * Flow (do step, taaki loading states asli stages se match karein):
 *   Photo → PaddleOCR (/prescription/ocr)  → "Reading prescription..."
 *   OCR text → EXISTING Gemini API (/prescription/analyze)
 *                                            → "Analyzing prescription with AI..."
 *   Normalize + render                      → "Preparing your prescription summary..."
 *
 * Existing Gemini integration (services/gemini.js) hi use hota hai — yahan
 * koi naya AI client nahi hai. PaddleOCR sirf text extract karta hai.
 *
 * Privacy: image sirf device + backend request-memory me rehti hai (koi
 * storage nahi). Is screen par patient name / medicine data log nahi hota.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraOptions,
  ImageLibraryOptions,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import PrescriptionCreditsCard from '../components/PrescriptionCreditsCard';
import PrescriptionPaywallModal from '../components/PrescriptionPaywallModal';
import {
  AppButton,
  Badge,
  Card,
  InfoRow,
  Screen,
  SectionHeader,
} from '../components/UI';
import api, {
  MedicineConfidence,
  PrescriptionAnalysisResult,
  PrescriptionMedicine,
  PrescriptionOcrResult,
  PrescriptionQuota,
} from '../api/api';
import { useAuth } from '../context/AuthContext';
import { usePrescriptionCredits } from '../context/PrescriptionCreditsContext';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PrescriptionReader'>;

type Phase = 'idle' | 'ocr' | 'ai' | 'summary' | 'done' | 'error';

interface SelectedImage {
  uri: string;
  name: string;
  type: string;
}

/* ------------------------- fixed strings (spec) ------------------------- */

const NOT_MENTIONED = 'Not mentioned in prescription.';
const DISCLAIMER_FALLBACK =
  'AI-generated information is provided only to help understand your prescription. ' +
  'It does not replace advice from your doctor or pharmacist. ' +
  'Always confirm unclear medicine names, dosage, or instructions with a qualified healthcare professional.';

/** Spec ke teen loading messages — asli API stages se match. */
const STAGE_LABELS: Record<Exclude<Phase, 'idle' | 'done' | 'error'>, string> = {
  ocr: 'Reading prescription...',
  ai: 'Analyzing prescription with AI...',
  summary: 'Preparing your prescription summary...',
};

const PICKER_OPTIONS: CameraOptions & ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.9,
  // Prescription ka text chhota hota hai — acchi resolution chahiye OCR ke liye.
  maxWidth: 2000,
  maxHeight: 2000,
  selectionLimit: 1,
  includeBase64: false,
};

/* --------------------------- error mapping ----------------------------- */

/** Image picker error codes → user-friendly, actionable messages. */
const pickerErrorMessage = (
  source: 'camera' | 'library',
  errorCode?: string,
  errorMessage?: string,
): string => {
  if (errorCode === 'permission') {
    return source === 'camera'
      ? 'Camera permission denied. Please allow camera access in your phone settings to take a prescription photo.'
      : 'Photo library permission denied. Please allow photo access in your phone settings to upload a prescription image.';
  }
  if (errorCode === 'camera_unavailable') {
    return 'No camera is available on this device. Please upload a photo from your gallery instead.';
  }
  if (source === 'camera') {
    return errorMessage || 'Could not take a photo. Please try again.';
  }
  return errorMessage || 'Could not open the gallery. Please try again.';
};

/* ------------------- "Preparing your summary" step ---------------------- */
/**
 * Backend ke analysis response ko UI-ready shape me coerce karta hai —
 * ye wohi "Preparing your prescription summary..." stage hai (missing fields,
 * arrays aur confidence values yahan normalize hote hain, kuch invent nahi).
 */
const prepareSummary = (input: PrescriptionAnalysisResult | null): PrescriptionAnalysisResult => {
  const asText = (value: unknown, fallback = '') =>
    typeof value === 'string' && value.trim() ? value.trim() : fallback;
  const asList = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
      : [];

  const analysis = input?.analysis;
  const medicines: PrescriptionMedicine[] = Array.isArray(analysis?.medicines)
    ? analysis.medicines
        .filter(Boolean)
        .map(med => ({
          name: asText(med?.name),
          confidence: (['high', 'medium', 'low'].includes(med?.confidence)
            ? med.confidence
            : 'low') as MedicineConfidence,
          strength: asText(med?.strength, NOT_MENTIONED),
          dosage: asText(med?.dosage, NOT_MENTIONED),
          frequency: asText(med?.frequency, NOT_MENTIONED),
          duration: asText(med?.duration, NOT_MENTIONED),
          route: asText(med?.route, NOT_MENTIONED),
          instructions: asText(med?.instructions, NOT_MENTIONED),
          common_use: asText(med?.common_use, NOT_MENTIONED),
          uncertainty: asText(med?.uncertainty),
        }))
    : [];

  return {
    analysis: {
      patient_name: asText(analysis?.patient_name, NOT_MENTIONED),
      doctor_name: asText(analysis?.doctor_name, NOT_MENTIONED),
      prescription_date: asText(analysis?.prescription_date, NOT_MENTIONED),
      medicines,
      additional_instructions: asList(analysis?.additional_instructions),
      warnings: asList(analysis?.warnings),
      unreadable_sections: asList(analysis?.unreadable_sections),
      summary: asText(analysis?.summary, NOT_MENTIONED),
    },
    disclaimer: asText(input?.disclaimer, DISCLAIMER_FALLBACK),
    source: input?.source,
  };
};

const confidenceTone = (confidence: MedicineConfidence): 'success' | 'warning' | 'danger' =>
  confidence === 'high' ? 'success' : confidence === 'medium' ? 'warning' : 'danger';

/* -------------------------------------------------------------------------- */

export default function PrescriptionReaderScreen({ navigation }: Props): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const { canAnalyze, consumeRead, applyServerQuota } = usePrescriptionCredits();

  const [image, setImage] = useState<SelectedImage | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [ocrResult, setOcrResult] = useState<PrescriptionOcrResult | null>(null);
  const [result, setResult] = useState<PrescriptionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExtracted, setShowExtracted] = useState(false);
  const [expandedMedicine, setExpandedMedicine] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const busy = phase === 'ocr' || phase === 'ai' || phase === 'summary';

  /* ----------------------------- image picking -------------------------- */

  const pickImage = useCallback(
    async (source: 'camera' | 'library') => {
      if (busy) {
        return;
      }
      try {
        const response =
          source === 'camera' ? await launchCamera(PICKER_OPTIONS) : await launchImageLibrary(PICKER_OPTIONS);

        if (response.didCancel) {
          return;
        }
        if (response.errorCode || response.errorMessage) {
          throw new Error(pickerErrorMessage(source, response.errorCode, response.errorMessage));
        }

        const asset = response.assets?.[0];
        if (!asset?.uri) {
          throw new Error(
            source === 'camera'
              ? 'Could not read the photo you took. Please try again.'
              : 'Could not read the selected image. Please choose another one.',
          );
        }

        setImage({
          uri: asset.uri,
          name: asset.fileName || `prescription_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
        // Naya image → purana analysis hata do (stale result na dikhe).
        setOcrResult(null);
        setResult(null);
        setError(null);
        setPhase('idle');
        setExpandedMedicine(null);
        setShowExtracted(false);
      } catch (e) {
        setError((e as Error).message || 'Could not select an image. Please try again.');
      }
    },
    [busy],
  );

  /* ------------------------------- analyze ------------------------------ */

  const analyze = useCallback(async () => {
    if (!image || busy) {
      return;
    }
    // Credits khatam ho gaye → paywall (₹19 → 10 reads).
    if (!canAnalyze) {
      setShowPaywall(true);
      return;
    }
    setError(null);
    setResult(null);
    setOcrResult(null);
    setExpandedMedicine(null);
    setShowExtracted(false);

    try {
      // Stage 1 — PaddleOCR
      setPhase('ocr');
      const ocr = await api.prescription.ocr(image);
      setOcrResult(ocr);

      // Stage 2 — existing Gemini API
      setPhase('ai');
      const analysisResult = await api.prescription.analyze(ocr);

      // Stage 3 — normalize + render (koi guess nahi, sirf shape safety)
      setPhase('summary');
      const prepared = prepareSummary(analysisResult);
      setResult(prepared);
      setPhase('done');
      // Credit consume: server quota payload aata hai to server hi kaata hai
      // (device sirf sync karta hai); warna device ledger par consume.
      const serverQuota = (analysisResult as { quota?: PrescriptionQuota } | null)?.quota;
      if (serverQuota && typeof serverQuota.freeRemaining === 'number' && typeof serverQuota.paidRemaining === 'number') {
        applyServerQuota(serverQuota);
      } else {
        consumeRead();
      }
    } catch (e) {
      setError((e as Error).message || 'Something went wrong while reading the prescription. Please try again.');
      setPhase('error');
    }
  }, [image, busy, canAnalyze, consumeRead, applyServerQuota]);

  const resetAll = () => {
    if (busy) {
      return;
    }
    setImage(null);
    setOcrResult(null);
    setResult(null);
    setError(null);
    setPhase('idle');
    setShowExtracted(false);
    setExpandedMedicine(null);
  };

  /* -------------------------------- render ------------------------------ */

  const analysis = result?.analysis;
  const avgConfidence = ocrResult?.average_confidence;

  return (
    <Screen>
      <AppHeader
        title="Prescription Reader"
        subtitle="Prescription → AI analysis"
        onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main')}
        rightIcon={image ? 'refresh' : undefined}
        onRightPress={image ? resetAll : undefined}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* --------------------------- Credit balance ------------------------ */}
        {/* 3 free reads → phir ₹19 me 10 reads. Balance live update hota hai. */}
        <PrescriptionCreditsCard onUpgrade={() => setShowPaywall(true)} />

        {/* ---------------------------- Image source ------------------------- */}
        <Card>
          <SectionHeader
            title="Prescription photo"
            subtitle="Take a clear, well-lit photo of the full prescription"
          />

          {image ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" />
            </View>
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIcon}>
                <Icon name="file-text" size={26} color={colors.primary} />
              </View>
              <Text style={[typography.small, { textAlign: 'center', marginTop: spacing.sm }]}>
                No photo selected yet. Take a photo or upload one from your gallery.
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <AppButton
              label={image ? 'Retake Photo' : 'Take Photo'}
              icon="camera"
              variant={image ? 'outline' : 'primary'}
              size="sm"
              full={false}
              style={{ flex: 1 }}
              disabled={busy}
              onPress={() => pickImage('camera')}
            />
            <AppButton
              label={image ? 'Change Image' : 'Upload from Gallery'}
              icon="layers"
              variant={image ? 'outline' : 'navy'}
              size="sm"
              full={false}
              style={{ flex: 1 }}
              disabled={busy}
              onPress={() => pickImage('library')}
            />
          </View>

          <AppButton
            label={canAnalyze ? 'Analyze Prescription' : 'Get Reads to Continue'}
            icon={canAnalyze ? 'sparkles' : 'credit-card'}
            variant="accent"
            size="lg"
            /* Credits khatam → button hamesha active (paywall kholta hai). */
            disabled={!image && canAnalyze}
            loading={busy}
            onPress={analyze}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* --------------------------- Progress states ----------------------- */}
        {busy ? (
          <Card style={styles.progressCard}>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={[typography.h4, { marginTop: spacing.md, textAlign: 'center' }]}>
              {STAGE_LABELS[phase as Exclude<Phase, 'idle' | 'done' | 'error'>]}
            </Text>
            <Text style={[typography.caption, { marginTop: 4 }]}>
              {phase === 'ocr' ? 'Step 1 of 3' : phase === 'ai' ? 'Step 2 of 3' : 'Step 3 of 3'}
            </Text>
            <View style={styles.stageDots}>
              {(['ocr', 'ai', 'summary'] as const).map(stage => {
                const order = { ocr: 0, ai: 1, summary: 2 };
                const active = order[stage] <= order[phase as 'ocr' | 'ai' | 'summary'];
                return <View key={stage} style={[styles.stageDot, active && styles.stageDotActive]} />;
              })}
            </View>
          </Card>
        ) : null}

        {/* ------------------------------- Errors ---------------------------- */}
        {error && !busy ? (
          <Card style={styles.errorCard}>
            <View style={styles.errorRow}>
              <View style={styles.errorIcon}>
                <Icon name="alert-triangle" size={20} color={colors.danger} />
              </View>
              <Text style={[typography.small, { flex: 1 }]}>{error}</Text>
            </View>
            <View style={styles.actionRow}>
              <AppButton label="Dismiss" variant="outline" size="sm" full={false} style={{ flex: 1 }} onPress={() => setError(null)} />
              {image ? (
                <AppButton label="Try Again" icon="refresh" size="sm" full={false} style={{ flex: 1 }} onPress={analyze} />
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* --------------------------- Extracted text ------------------------ */}
        {ocrResult ? (
          <Card>
            <Pressable
              onPress={() => setShowExtracted(v => !v)}
              accessibilityRole="button"
              accessibilityLabel={showExtracted ? 'Hide extracted text' : 'Show extracted text'}
            >
              <View style={styles.cardTitleRow}>
                <View style={styles.titleIcon}>
                  <Icon name="file-text" size={18} color={colors.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.h4}>Extracted Text</Text>
                  <Text style={typography.caption}>
                    PaddleOCR output
                    {typeof avgConfidence === 'number'
                      ? ` • ${Math.round(avgConfidence * 100)}% average confidence`
                      : ''}
                  </Text>
                </View>
                <Icon name={showExtracted ? 'chevron-down' : 'chevron-right'} size={18} color={colors.textMuted} />
              </View>
            </Pressable>

            {showExtracted ? (
              <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                <Text style={typography.small}>
                  Text below is exactly what PaddleOCR read — nothing was guessed or corrected.
                </Text>

                <View>
                  <View style={styles.bucketHeader}>
                    <Badge label="Confident" tone="success" icon="check-circle" />
                    <Text style={typography.caption}>
                      {ocrResult.confident_count ?? 0} line(s) • 85%+ confidence
                    </Text>
                  </View>
                  <Text style={styles.extractedBlock}>
                    {ocrResult.confident_text?.trim() || NOT_MENTIONED}
                  </Text>
                </View>

                <View>
                  <View style={styles.bucketHeader}>
                    <Badge label="Low confidence" tone="warning" icon="alert-triangle" />
                    <Text style={typography.caption}>
                      {ocrResult.low_confidence_count ?? 0} line(s) • uncertain
                    </Text>
                  </View>
                  <Text style={styles.extractedBlock}>
                    {ocrResult.low_confidence_text?.trim() || NOT_MENTIONED}
                  </Text>
                </View>

                <View>
                  <View style={styles.bucketHeader}>
                    <Badge label="Unreadable" tone="danger" icon="eye-off" />
                    <Text style={typography.caption}>
                      {ocrResult.unreadable_sections?.length ?? 0} section(s) • kept as-is
                    </Text>
                  </View>
                  {ocrResult.unreadable_sections?.length ? (
                    ocrResult.unreadable_sections.map((section, index) => (
                      <Text key={`${index}-${section.confidence}`} style={styles.extractedBlock}>
                        {section.text} (OCR confidence {Math.round(section.confidence * 100)}%)
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.extractedBlock}>{NOT_MENTIONED}</Text>
                  )}
                </View>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* ------------------------- Prescription summary -------------------- */}
        {analysis ? (
          <Card>
            <View style={styles.cardTitleRow}>
              <View style={[styles.titleIcon, { backgroundColor: colors.primaryLight }]}>
                <Icon name="clipboard" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h4}>Prescription Summary</Text>
                <Text style={typography.caption}>AI-generated from the extracted text</Text>
              </View>
            </View>

            <View style={{ marginTop: spacing.sm }}>
              <InfoRow label="Patient" value={analysis.patient_name} icon="user" />
              <InfoRow label="Doctor" value={analysis.doctor_name} icon="stethoscope" />
              <InfoRow label="Date" value={analysis.prescription_date} icon="calendar" />
            </View>

            <Text style={[typography.body, { marginTop: spacing.md }]}>{analysis.summary}</Text>

            {analysis.additional_instructions.length ? (
              <View style={styles.instructionBox}>
                <Text style={styles.instructionTitle}>Additional instructions</Text>
                {analysis.additional_instructions.map((instruction, index) => (
                  <Text key={`${index}-${instruction.slice(0, 24)}`} style={typography.small}>
                    • {instruction}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* ------------------------------ Medicines -------------------------- */}
        {analysis ? (
          <Card>
            <View style={styles.cardTitleRow}>
              <View style={[styles.titleIcon, { backgroundColor: colors.accentLight }]}>
                <Icon name="pill" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h4}>Medicines</Text>
                <Text style={typography.caption}>
                  {analysis.medicines.length
                    ? `${analysis.medicines.length} medicine(s) • tap for details`
                    : 'None found'}
                </Text>
              </View>
            </View>

            {analysis.medicines.length === 0 ? (
              <Text style={[typography.small, { marginTop: spacing.md }]}>{NOT_MENTIONED}</Text>
            ) : (
              <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                {analysis.medicines.map((medicine, index) => {
                  const expanded = expandedMedicine === index;
                  // Uncertainty message (fallback string ko chhod kar) dikhani hai.
                  const uncertain =
                    medicine.uncertainty && medicine.uncertainty !== NOT_MENTIONED
                      ? medicine.uncertainty
                      : '';
                  return (
                    <Pressable
                      key={`${index}-${medicine.name.slice(0, 20)}`}
                      onPress={() => setExpandedMedicine(expanded ? null : index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Medicine ${index + 1} details`}
                      style={({ pressed }) => [styles.medRow, pressed && { backgroundColor: colors.cardMuted }]}
                    >
                      <View style={styles.medHead}>
                        <View style={styles.medPill}>
                          <Icon name="pill" size={15} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={typography.smallMedium} numberOfLines={2}>
                            {medicine.name || 'Medicine name not readable'}
                          </Text>
                          <Text style={typography.caption}>
                            {medicine.strength} • {medicine.frequency}
                          </Text>
                        </View>
                        <Badge label={medicine.confidence} tone={confidenceTone(medicine.confidence)} />
                        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={16} color={colors.textMuted} />
                      </View>

                      {expanded ? (
                        <View style={styles.medDetails}>
                          <InfoRow label="Name" value={medicine.name || NOT_MENTIONED} />
                          <InfoRow label="Strength" value={medicine.strength} />
                          <InfoRow label="Dosage" value={medicine.dosage} />
                          <InfoRow label="Frequency" value={medicine.frequency} />
                          <InfoRow label="Duration" value={medicine.duration} />
                          <InfoRow label="Route" value={medicine.route} />
                          <InfoRow label="Instructions" value={medicine.instructions} />
                          <InfoRow label="Common use" value={medicine.common_use} />

                          {uncertain ? (
                            <View style={styles.uncertainBox}>
                              <Icon name="alert-triangle" size={15} color={colors.warningText} />
                              <Text style={styles.uncertainText}>{uncertain}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        ) : null}

        {/* ------------------------------- Warnings -------------------------- */}
        {analysis ? (
          <Card>
            <View style={styles.cardTitleRow}>
              <View style={[styles.titleIcon, { backgroundColor: colors.warningLight }]}>
                <Icon name="alert-triangle" size={18} color={colors.warning} />
              </View>
              <Text style={typography.h4}>Warnings</Text>
            </View>
            {analysis.warnings.length ? (
              <View style={{ gap: 6, marginTop: spacing.sm }}>
                {analysis.warnings.map((warning, index) => (
                  <View key={`${index}-${warning.slice(0, 24)}`} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[typography.small, { flex: 1 }]}>{warning}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[typography.small, { marginTop: spacing.sm }]}>{NOT_MENTIONED}</Text>
            )}
          </Card>
        ) : null}

        {/* ------------------------ Unreadable information -------------------- */}
        {analysis ? (
          <Card>
            <View style={styles.cardTitleRow}>
              <View style={[styles.titleIcon, { backgroundColor: colors.dangerLight }]}>
                <Icon name="eye-off" size={18} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h4}>Unreadable Information</Text>
                <Text style={typography.caption}>OCR sections it could not read confidently</Text>
              </View>
            </View>
            {analysis.unreadable_sections.length ? (
              <View style={{ gap: 6, marginTop: spacing.sm }}>
                {analysis.unreadable_sections.map((section, index) => (
                  <View key={`${index}-${section.slice(0, 24)}`} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[typography.small, { flex: 1 }]}>{section}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[typography.small, { marginTop: spacing.sm }]}>
                None detected — all readable sections were captured.
              </Text>
            )}
          </Card>
        ) : null}

        {/* --------------------------- Medical disclaimer --------------------- */}
        {result ? (
          <View style={styles.disclaimer}>
            <View style={styles.disclaimerHead}>
              <Icon name="shield-check" size={16} color={colors.primary} />
              <Text style={styles.disclaimerTitle}>Medical Disclaimer</Text>
            </View>
            <Text style={styles.disclaimerText}>{result.disclaimer}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* --------------------- Paywall (credits khatam) ---------------------- */}
      <PrescriptionPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onRequireLogin={isLoggedIn ? undefined : () => navigation.navigate('Auth')}
        onViewPlans={() => navigation.navigate('PrescriptionReaderPlans')}
      />
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  placeholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.cardMuted,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  placeholderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWrap: {
    borderRadius: radius.md,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: 240 },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  progressCard: { alignItems: 'center', paddingVertical: spacing.xl },
  stageDots: { flexDirection: 'row', gap: 6, marginTop: spacing.md },
  stageDot: {
    width: 26,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  stageDotActive: { backgroundColor: colors.blue },
  errorCard: { borderColor: colors.danger, borderWidth: 1 },
  errorRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 6,
  },
  extractedBlock: {
    ...typography.small,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    color: colors.text,
  },
  instructionBox: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: 4,
  },
  instructionTitle: { ...typography.caption, color: colors.primaryDark, textTransform: 'uppercase' },
  medRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  medHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  medPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medDetails: {
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  uncertainBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.warningLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  uncertainText: { ...typography.small, flex: 1, color: '#92400E' },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bullet: { ...typography.small, color: colors.warning, fontWeight: '800' },
  disclaimer: {
    backgroundColor: '#EEF3FB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#D8E2F2',
    padding: spacing.lg,
    gap: 6,
  },
  disclaimerHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disclaimerTitle: {
    ...typography.caption,
    color: colors.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  disclaimerText: { ...typography.small, color: colors.navySoft },
});
