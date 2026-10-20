/**
 * PrescriptionDetail — doctor ki prescription ko professionally dikhata hai
 * aur client ko PDF banakar "Download / Share" karne deta hai.
 *
 * Pehle (bug): doctor prescription bhejta tha, par client use khol hi nahi
 * paata tha — list card par sirf ek text dikhta tha, koi action nahi.
 *
 * Ab:
 *   - Card par "Prescription ready" tap → ye screen khulta hai
 *   - Screen par poora prescription (doctor, patient, vitals, diagnosis, Rx,
 *     advice, follow-up) ek "document" ke roop me render hota hai
 *   - "Download PDF" → SloveCare-branded PDF banti hai aur phone ke
 *     Downloads/SloveCare folder me save ho jaati hai
 *   - "Share" → wahi PDF WhatsApp/Drive/Files/Print me bhejne ke liye share
 *     sheet kholti hai
 *   - Agar doctor ne apni taraf se PDF attach ki hai, to wo bhi yahin se
 *     open/download ho jaati hai
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { AppButton, Badge, Card, ErrorState, GradientCard, Loader, Screen } from '../components/UI';
import api, { Prescription } from '../api/api';
import { RootStackParamList } from '../navigation/types';
import {
  downloadPrescriptionPdf,
  longDate,
  PrescriptionPdfMeta,
  sharePrescriptionFile,
  sharePrescriptionPdf,
} from '../utils/prescriptionPdf';
import { FileSaver } from '../native/FileSaver';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PrescriptionDetail'>;

/* -------------------------------------------------------------------------- */
/*  Document palette — hamesha light (PDF jaisa printed document)               */
/* -------------------------------------------------------------------------- */

const PAPER = {
  bg: '#FFFFFF',
  ink: '#0B2447',
  inkSoft: '#243B63',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  soft: '#F8FAFC',
  brand: '#0BA39C',
  brandBlue: '#1D8FD6',
  blue: '#2563EB',
  blueSoft: '#EAF1FE',
};

const VITAL_LABELS: Record<string, string> = {
  bp: 'BP',
  pulse: 'Pulse',
  temp: 'Temp',
  sugar: 'Sugar',
  spo2: 'SpO2',
  weight: 'Weight',
  height: 'Height',
};

/** Medicine ki frequency — backend `frequency` ya `timing` bhej sakta hai. */
const frequencyOf = (med: { frequency?: string; timing?: string }): string =>
  String(med?.frequency ?? med?.timing ?? '').trim();

export default function PrescriptionDetailScreen({ navigation, route }: Props): React.JSX.Element {
  /* Theme subscription — screen context change par dobara render hota hai. */
  useThemePreference();
  const insets = useSafeAreaInsets();

  const { bookingId, prescription: routePrescription } = route.params ?? {};

  const [rx, setRx] = useState<Prescription | null>(routePrescription ?? null);
  const [meta, setMeta] = useState<PrescriptionPdfMeta>({
    doctorName: route.params?.doctorName,
    serviceName: route.params?.serviceName,
    bookingId,
  });
  const [loading, setLoading] = useState(!routePrescription);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);

  /**
   * Prescription seedha params me aayi ho to load karne ki zaroorat nahi —
   * warna booking se fetch karo (booking par doctor/service context bhi milta hai).
   */
  const load = useCallback(async () => {
    if (routePrescription) {
      setRx(routePrescription);
      setLoading(false);
      return;
    }
    if (!bookingId) {
      setError('This prescription could not be opened.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const booking = await api.bookings.byId(bookingId);
      if (!booking.prescription) {
        setError('No prescription was found for this consultation yet.');
        return;
      }
      setRx(booking.prescription);
      setMeta({
        doctorName: booking.doctorName || booking.vendorName,
        serviceName: booking.serviceName,
        bookingId: booking.id,
        patientName: booking.patientName,
        patientAge: booking.customer?.age,
        patientGender: booking.customer?.gender,
      });
    } catch (e) {
      setError((e as Error).message || 'Could not load the prescription.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, routePrescription]);

  useEffect(() => {
    load();
  }, [load]);

  /* ----------------------------------------------------------------- actions */

  /** PDF bana kar phone ke Downloads folder me save karo. */
  const onDownload = useCallback(async () => {
    if (!rx || busy) return;
    setBusy('download');
    try {
      if (FileSaver.isAvailable) {
        const result = await downloadPrescriptionPdf(rx, meta);
        Alert.alert(
          'Prescription saved',
          `Saved as ${result.location ?? 'a PDF file'}.\n\nYou can open it from your phone’s Downloads folder or share it with anyone.`,
          [
            { text: 'Done', style: 'cancel' },
            {
              text: 'Share',
              onPress: () => sharePrescriptionFile(result.file, rx).catch(() => {}),
            },
          ],
        );
        return;
      }

      /* Native saver nahi hai (iOS / purani build) — share sheet se save karo. */
      await sharePrescriptionPdf(rx, meta);
    } catch (e) {
      Alert.alert('Could not save the PDF', (e as Error).message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  }, [rx, meta, busy]);

  /** PDF share sheet (WhatsApp / Drive / Mail / Print). */
  const onShare = useCallback(async () => {
    if (!rx || busy) return;
    setBusy('share');
    try {
      await sharePrescriptionPdf(rx, meta);
    } catch (e) {
      Alert.alert('Could not share the prescription', (e as Error).message || 'Please try again.');
    } finally {
      setBusy(null);
    }
  }, [rx, meta, busy]);

  /* ------------------------------------------------------------------ render */

  const medicines = useMemo(
    () => (rx?.medicines ?? []).filter(med => String(med?.name ?? '').trim() !== ''),
    [rx],
  );

  const attachments = useMemo(
    () => (rx?.files ?? []).filter(file => Boolean(file?.fileUrl)),
    [rx],
  );

  if (loading) {
    return (
      <Screen>
        <AppHeader title="Prescription" onBack={() => navigation.goBack()} />
        <Loader label="Opening your prescription…" />
      </Screen>
    );
  }

  if (error || !rx) {
    return (
      <Screen>
        <AppHeader title="Prescription" onBack={() => navigation.goBack()} />
        <ErrorState message={error ?? 'Prescription not found.'} onRetry={load} />
      </Screen>
    );
  }

  const doctorName = meta.doctorName || rx.doctorName || 'Consulting Doctor';
  const patientName = meta.patientName || rx.patientName || '—';
  const vitals = Object.entries(rx.vitals ?? {}).filter(
    ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
  );

  return (
    <Screen>
      <AppHeader
        title="Prescription"
        subtitle={`${doctorName}${rx.date ? ` • ${longDate(rx.date)}` : ''}`}
        onBack={() => navigation.goBack()}
        rightIcon="share"
        onRightPress={onShare}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* --------------------------- summary banner --------------------------- */}
        <Card style={styles.summary}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIcon}>
              <Icon name="file-text" size={20} color={PAPER.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.smallMedium} numberOfLines={2}>
                {rx.diagnosis || 'Prescription'}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {doctorName}
                {rx.date ? ` • ${longDate(rx.date)}` : ''}
              </Text>
            </View>
            <Badge label={`${medicines.length} medicine${medicines.length === 1 ? '' : 's'}`} tone="brand" />
          </View>
        </Card>

        {/* ----------------------------- the document --------------------------- */}
        <View style={styles.paper}>
          {/* brand strip */}
          <GradientCard from={PAPER.brand} to={PAPER.blue} style={styles.paperHead}>
            <View style={styles.paperHeadRow}>
              <View style={styles.paperBrand}>
                <View style={styles.paperLogo}>
                  <Text style={styles.paperLogoText}>S</Text>
                </View>
                <View>
                  <Text style={styles.paperBrandTag}>Digital Health Records</Text>
                  <Text style={styles.paperBrandName}>SloveCare</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.paperDocType}>PRESCRIPTION</Text>
                {rx.date ? <Text style={styles.paperDocDate}>{longDate(rx.date)}</Text> : null}
              </View>
            </View>
          </GradientCard>

          {/* doctor */}
          <View style={styles.paperDoctor}>
            <View style={{ flex: 1 }}>
              <Text style={styles.paperDoctorName}>{doctorName}</Text>
              <Text style={styles.paperDoctorMeta}>
                {rx.doctorRegNo ? `Reg. No: ${rx.doctorRegNo}` : 'Verified SloveCare doctor'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {meta.serviceName ? (
                <Text style={styles.paperDoctorMeta}>Consultation: {meta.serviceName}</Text>
              ) : null}
              {meta.bookingId ? <Text style={styles.paperDoctorMeta}>ID: {meta.bookingId}</Text> : null}
            </View>
          </View>

          {/* patient */}
          <View style={styles.paperBlock}>
            <Text style={styles.paperLabel}>Patient</Text>
            <Text style={styles.paperPatientLine}>
              Name: <Text style={styles.paperPatientStrong}>{patientName}</Text>
              {rx.patientAge ? `   •   Age: ${rx.patientAge}` : ''}
              {rx.patientGender ? `   •   Gender: ${rx.patientGender}` : ''}
            </Text>
            {vitals.length ? (
              <View style={styles.vitalRow}>
                {vitals.map(([key, value]) => (
                  <View key={key} style={styles.vitalChip}>
                    <Text style={styles.vitalChipText}>
                      {VITAL_LABELS[key.toLowerCase()] ?? key}: {String(value)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* diagnosis */}
          <Text style={styles.paperHeading}>Diagnosis</Text>
          <View style={styles.paperBlock}>
            <Text style={styles.paperBody}>{rx.diagnosis || 'Not specified'}</Text>
          </View>

          {/* rx */}
          <Text style={styles.paperHeading}>Prescription (Rx)</Text>
          {medicines.length ? (
            medicines.map((med, index) => {
              const dose = String(med?.dose ?? '').trim();
              const freq = frequencyOf(med);
              const duration = String(med?.duration ?? '').trim();
              const notes = String(med?.instructions ?? '').trim();
              return (
                <View key={`${med?.name}-${index}`} style={styles.medCard}>
                  <View style={styles.medHead}>
                    <View style={styles.medIndex}>
                      <Text style={styles.medIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.medName}>{med?.name}</Text>
                  </View>
                  {dose || freq || duration ? (
                    <View style={styles.medPills}>
                      {dose ? (
                        <View style={styles.medPill}>
                          <Text style={styles.medPillText}>Dose: {dose}</Text>
                        </View>
                      ) : null}
                      {freq ? (
                        <View style={styles.medPill}>
                          <Text style={styles.medPillText}>{freq}</Text>
                        </View>
                      ) : null}
                      {duration ? (
                        <View style={styles.medPill}>
                          <Text style={styles.medPillText}>{duration}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {notes ? <Text style={styles.medNote}>{notes}</Text> : null}
                </View>
              );
            })
          ) : (
            <View style={styles.paperBlock}>
              <Text style={styles.paperBody}>No medicines were prescribed for this consultation.</Text>
            </View>
          )}

          {/* advice */}
          {rx.advice ? (
            <>
              <Text style={styles.paperHeading}>Advice</Text>
              <View style={styles.paperBlock}>
                <Text style={styles.paperBody}>{rx.advice}</Text>
              </View>
            </>
          ) : null}

          {/* follow-up */}
          {rx.followUpDate ? (
            <>
              <Text style={styles.paperHeading}>Follow-up</Text>
              <View style={styles.followUp}>
                <Icon name="calendar" size={14} color={PAPER.blue} />
                <Text style={styles.followUpText}>Next visit: {longDate(rx.followUpDate)}</Text>
              </View>
            </>
          ) : null}

          {/* footer */}
          <View style={styles.paperFoot}>
            <Text style={styles.paperFootName}>SloveCare</Text>
            <Text style={styles.paperFootCopy}>Powered by Slovenia Tech Solutions Pvt. Ltd.</Text>
            <Text style={styles.paperFootFine}>
              This prescription was issued by the doctor during your SloveCare consultation. Please follow it
              as advised and consult your doctor before changing any dose.
            </Text>
          </View>
        </View>

        {/* ---------------------- doctor ka uploaded PDF ----------------------- */}
        {attachments.length ? (
          <>
            <Text style={[typography.h4, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
              Doctor’s attachment
            </Text>
            <Card>
              {attachments.map((file, index) => (
                <View key={`${file.fileUrl}-${index}`} style={styles.attachmentRow}>
                  <Icon name="file-text" size={18} color={colors.blue} />
                  <Text style={[typography.small, { flex: 1 }]} numberOfLines={1}>
                    {file.title || 'Prescription file'}
                  </Text>
                  <AppButton
                    label="Open"
                    icon="download"
                    variant="outline"
                    size="sm"
                    full={false}
                    onPress={() => {
                      Linking.openURL(file.fileUrl).catch(() =>
                        Alert.alert('Could not open', 'The file link could not be opened — please try again.'),
                      );
                    }}
                  />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Text style={styles.helperText}>
          Download karne par ye prescription aapke phone ke Downloads → SloveCare folder me save ho jaati
          hai. PDF ko print karke pharmacy me bhi de sakte hain.
        </Text>
      </ScrollView>

      {/* ------------------------------ action bar ----------------------------- */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <AppButton
          label={busy === 'download' ? 'Saving…' : 'Download PDF'}
          icon="download"
          size="lg"
          full={false}
          style={{ flex: 1 }}
          loading={busy === 'download'}
          disabled={busy !== null}
          onPress={onDownload}
        />
        <AppButton
          label="Share"
          icon="share"
          variant="outline"
          size="lg"
          full={false}
          style={{ flex: 1 }}
          loading={busy === 'share'}
          disabled={busy !== null}
          onPress={onShare}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* --- the printed document --- */
  paper: {
    backgroundColor: PAPER.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: PAPER.line,
    padding: spacing.md,
    shadowColor: '#0B2447',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  paperHead: { borderRadius: radius.md, padding: spacing.md },
  paperHeadRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  paperBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  paperLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperLogoText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  paperBrandTag: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 8.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  paperBrandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  paperDocType: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 1.4 },
  paperDocDate: { color: 'rgba(255,255,255,0.9)', fontSize: 10, marginTop: 2 },

  paperDoctor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: PAPER.line,
  },
  paperDoctorName: { color: PAPER.ink, fontSize: 13.5, fontWeight: '800' },
  paperDoctorMeta: { color: PAPER.muted, fontSize: 10, marginTop: 2 },

  paperBlock: {
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: radius.sm,
    backgroundColor: PAPER.bg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  paperLabel: {
    color: PAPER.brand,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  paperPatientLine: { color: PAPER.inkSoft, fontSize: 11.5, marginTop: 6 },
  paperPatientStrong: { color: PAPER.ink, fontWeight: '700' },
  paperHeading: {
    color: PAPER.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: 2,
    paddingLeft: 9,
    borderLeftWidth: 4,
    borderLeftColor: PAPER.brand,
  },
  paperBody: { color: PAPER.inkSoft, fontSize: 11.5 },

  vitalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  vitalChip: {
    backgroundColor: PAPER.soft,
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  vitalChipText: { color: PAPER.muted, fontSize: 10, fontWeight: '600' },

  medCard: {
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  medHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  medIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PAPER.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medIndexText: { color: PAPER.blue, fontSize: 10.5, fontWeight: '800' },
  medName: { color: PAPER.ink, fontSize: 12.5, fontWeight: '700', flex: 1 },
  medPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  medPill: {
    backgroundColor: PAPER.soft,
    borderWidth: 1,
    borderColor: PAPER.line,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  medPillText: { color: PAPER.muted, fontSize: 10, fontWeight: '600' },
  medNote: { color: PAPER.muted, fontSize: 10.5, marginTop: spacing.sm },

  followUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: PAPER.blueSoft,
    borderWidth: 1,
    borderColor: '#C7D9FB',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  followUpText: { color: PAPER.blue, fontSize: 11, fontWeight: '700' },

  paperFoot: {
    marginTop: spacing.lg,
    borderTopWidth: 3,
    borderTopColor: PAPER.brand,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  paperFootName: { color: PAPER.ink, fontSize: 13.5, fontWeight: '800' },
  paperFootCopy: { color: PAPER.brand, fontSize: 10, fontWeight: '700', marginTop: 2 },
  paperFootFine: {
    color: PAPER.faint,
    fontSize: 8.5,
    lineHeight: 13,
    textAlign: 'center',
    marginTop: 5,
  },

  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },

  helperText: {
    ...typography.caption,
    lineHeight: 16,
    marginTop: spacing.lg,
    textAlign: 'center',
  },

  actionBar: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
