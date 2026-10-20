/**
 * Prescription → professional SloveCare PDF (branded, print-ready).
 *
 * Doctor jo prescription likhta hai (vendor app → POST /bookings/:id/prescription)
 * uska structured data client ke paas aata hai. Yahan usi data se ek
 * "SloveCare template" PDF banaya jaata hai — brand header, doctor block,
 * patient details, vitals, diagnosis, Rx table, advice aur follow-up ke saath.
 *
 * Flow:
 *   Prescription (structured)  →  branded HTML  →  react-native-html-to-pdf
 *   (WebView → real .pdf file)  →  Download folder (native FileSaver module)
 *                                  ya system share sheet (react-native-share)
 *
 * File location:
 *   Android — PDF cache dir me banti hai (react-native-share ka FileProvider
 *             isi path ko serve karta hai) aur "Download" button se phone ke
 *             public Downloads/SloveCare folder me copy ho jaati hai.
 *   iOS     — NSTemporaryDirectory() me banti hai (file:// URL share ready)
 *
 * Dono native modules lazy require se load hote hain — purani build me module
 * na ho to app crash nahi hota, friendly error aata hai.
 */

import { Platform } from 'react-native';
import type { Prescription } from '../api/api';
import type { PDFOptions, PDFResult } from 'react-native-html-to-pdf';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Prescription ke saath extra context (booking se aata hai). */
export interface PrescriptionPdfMeta {
  /** Doctor ka naam (booking par doctorName ya vendorName). */
  doctorName?: string;
  /** Doctor ka registration number. */
  doctorRegNo?: string;
  /** Patient ka naam. */
  patientName?: string;
  patientAge?: number | string;
  patientGender?: string;
  /** Consultation type — "Video Consultation" / "Chat Consultation" etc. */
  serviceName?: string;
  /** Booking id — record trace karne ke liye PDF par print hota hai. */
  bookingId?: string;
  /** Clinic / hospital ka naam (agar doctor ne diya ho). */
  clinicName?: string;
}

/** PDF banane ke baad mila result. */
export interface PrescriptionPdfFile {
  /** Device par file ka absolute path. */
  filePath: string;
  /** User-friendly file name (with .pdf). */
  fileName: string;
  /** Kitne pages bane. */
  numberOfPages?: number;
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

/** HTML me koi bhi dynamic text inject karne se pehle escape karo. */
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-12' → '12 Oct 2026'. */
export const longDate = (iso?: string): string => {
  const raw = String(iso ?? '').trim();
  if (!raw) return '';
  const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return raw;
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** '2026-10-12' → '12 Oct'. */
export const shortDate = (iso?: string): string => {
  const raw = String(iso ?? '').trim();
  if (!raw) return '';
  const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return raw;
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** File name me safe characters (spaces → dash). */
const slug = (value?: string): string =>
  String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** Medicine ki frequency — backend `frequency` ya `timing` koi bhi bhej sakta hai. */
const frequencyOf = (med: { frequency?: string; timing?: string }): string =>
  String(med?.frequency ?? med?.timing ?? '').trim();

/** Vitals ka display label order. */
const VITAL_LABELS: Record<string, string> = {
  bp: 'BP',
  pulse: 'Pulse',
  temp: 'Temp',
  sugar: 'Sugar',
  spo2: 'SpO2',
  weight: 'Weight',
  height: 'Height',
};

/* -------------------------------------------------------------------------- */
/*  HTML template — premium SloveCare branded prescription                    */
/* -------------------------------------------------------------------------- */

/**
 * Poora prescription → branded printable HTML (A4, print-safe CSS).
 * Yehi HTML PDF me convert hota hai — isliye preview aur PDF identical rehte hain.
 */
export function buildPrescriptionHtml(rx: Prescription, meta: PrescriptionPdfMeta = {}): string {
  const doctorName = meta.doctorName || rx.doctorName || 'Consulting Doctor';
  const patientName = meta.patientName || rx.patientName || '—';
  const patientAge = meta.patientAge ?? rx.patientAge;
  const patientGender = meta.patientGender || rx.patientGender;
  const date = rx.date ? longDate(rx.date) : '';
  const followUp = rx.followUpDate ? longDate(rx.followUpDate) : '';
  const year = new Date().getFullYear();

  /* --- vitals chips --- */
  const vitals = Object.entries(rx.vitals ?? {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(
      ([key, value]) =>
        `<span class="vital"><b>${esc(VITAL_LABELS[key.toLowerCase()] ?? key)}</b> ${esc(value)}</span>`,
    )
    .join('');

  /* --- Rx table --- */
  const medicines = (rx.medicines ?? []).filter(med => String(med?.name ?? '').trim() !== '');
  const rxRows = medicines
    .map((med, index) => {
      const dose = String(med?.dose ?? '').trim();
      const freq = frequencyOf(med);
      const duration = String(med?.duration ?? '').trim();
      const notes = String(med?.instructions ?? '').trim();
      return `
        <tr>
          <td class="c-idx">${index + 1}</td>
          <td class="c-name">${esc(med?.name)}</td>
          <td>${esc(dose)}</td>
          <td>${esc(freq)}</td>
          <td>${esc(duration)}</td>
          <td class="c-note">${esc(notes)}</td>
        </tr>`;
    })
    .join('');

  const rxTable = medicines.length
    ? `<table class="rx">
        <thead>
          <tr>
            <th class="c-idx">#</th>
            <th class="c-name">Medicine</th>
            <th>Dose</th>
            <th>Frequency</th>
            <th>Duration</th>
            <th class="c-note">Instructions</th>
          </tr>
        </thead>
        <tbody>${rxRows}</tbody>
      </table>`
    : `<div class="empty">No medicines were prescribed for this consultation.</div>`;

  /* --- patient line --- */
  const patientBits = [
    `Name: <b>${esc(patientName)}</b>`,
    patientAge ? `Age: <b>${esc(patientAge)}</b>` : '',
    patientGender ? `Gender: <b>${esc(patientGender)}</b>` : '',
    date ? `Date: <b>${esc(date)}</b>` : '',
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #0B2447; font-size: 12px; line-height: 1.45; background: #FFFFFF;
    padding: 14px 16px;
  }

  /* ----------------------------- brand header ----------------------------- */
  .head {
    background: linear-gradient(115deg, #0BA39C 0%, #1D8FD6 55%, #2563EB 100%);
    color: #FFFFFF; border-radius: 14px; padding: 16px 18px 14px;
  }
  .head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .brand-row { display: flex; align-items: center; gap: 11px; }
  .logo {
    width: 42px; height: 42px; border-radius: 21px; background: rgba(255,255,255,0.18);
    border: 1.5px solid rgba(255,255,255,0.45); text-align: center; line-height: 39px;
    font-size: 19px; font-weight: 800;
  }
  .brand-tag { font-size: 9px; letter-spacing: 2.2px; text-transform: uppercase; opacity: 0.85; }
  .brand-name { font-size: 24px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.1; }
  .head-right { text-align: right; }
  .doc-type { font-size: 15px; font-weight: 800; letter-spacing: 1.6px; }
  .doc-date { font-size: 10.5px; opacity: 0.9; margin-top: 3px; }

  /* ------------------------------ doctor block ---------------------------- */
  .doctor {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding: 12px 2px 11px; border-bottom: 1px solid #E2E8F0;
  }
  .doc-name { font-size: 14px; font-weight: 800; color: #0B2447; }
  .doc-meta { font-size: 10.5px; color: #64748B; margin-top: 2px; }
  .doc-right { text-align: right; font-size: 10.5px; color: #475569; }
  .doc-right b { color: #0B2447; }

  /* ----------------------------- patient block ---------------------------- */
  .panel {
    border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; margin-top: 11px;
    background: #FFFFFF; page-break-inside: avoid; break-inside: avoid;
  }
  .panel-label {
    font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; color: #0BA39C; font-weight: 800;
  }
  .patient-line { font-size: 11.5px; color: #243B63; margin-top: 5px; }
  .patient-line b { color: #0B2447; }
  .booking-line { font-size: 10px; color: #94A3B8; margin-top: 4px; }

  .vitals { margin-top: 7px; }
  .vital {
    display: inline-block; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 999px;
    font-size: 10px; color: #475569; padding: 2.5px 9px; margin: 0 5px 5px 0;
  }
  .vital b { color: #0B2447; }

  /* -------------------------------- sections ------------------------------ */
  h2 {
    font-size: 13px; color: #0B2447; margin: 14px 0 7px; padding-left: 9px;
    border-left: 4px solid #0BA39C; page-break-after: avoid; break-after: avoid;
  }
  .diag { font-size: 12px; color: #243B63; }
  .diag b { color: #0B2447; }

  table.rx { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.rx th {
    background: #F1F5F9; color: #0B2447; font-size: 9.5px; letter-spacing: 0.6px; text-transform: uppercase;
    text-align: left; padding: 6px 7px; border: 1px solid #E2E8F0; font-weight: 800;
  }
  table.rx td { font-size: 11px; color: #243B63; padding: 6px 7px; border: 1px solid #E2E8F0; vertical-align: top; }
  table.rx tr { page-break-inside: avoid; break-inside: avoid; }
  .c-idx { width: 22px; text-align: center; color: #94A3B8; }
  .c-name { width: 30%; font-weight: 700; color: #0B2447; }
  .c-note { width: 22%; color: #64748B; }

  .empty {
    background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; color: #64748B;
    font-size: 11px; padding: 10px; text-align: center;
  }

  .advice { font-size: 11.5px; color: #243B63; }
  .advice b { color: #0B2447; }

  .followup {
    display: inline-block; margin-top: 8px; background: #EAF1FE; border: 1px solid #C7D9FB;
    border-radius: 8px; padding: 6px 11px; font-size: 11px; color: #1D4ED8; font-weight: 700;
  }

  /* --------------------------------- footer ------------------------------- */
  .foot {
    margin-top: 16px; border-top: 3px solid #0BA39C; padding-top: 11px; text-align: center;
    page-break-inside: avoid; break-inside: avoid;
  }
  .foot-name { font-size: 14px; font-weight: 800; color: #0B2447; letter-spacing: -0.2px; }
  .foot-copy { font-size: 10.5px; color: #475569; margin-top: 3px; }
  .foot-powered { font-size: 10.5px; color: #0BA39C; font-weight: 700; margin-top: 1px; }
  .foot-fine { font-size: 9px; color: #94A3B8; margin-top: 5px; line-height: 1.5; }
</style>
</head>
<body>

  <div class="head">
    <div class="head-row">
      <div class="brand-row">
        <div class="logo">S</div>
        <div>
          <div class="brand-tag">Digital Health Records</div>
          <div class="brand-name">SloveCare</div>
        </div>
      </div>
      <div class="head-right">
        <div class="doc-type">PRESCRIPTION</div>
        <div class="doc-date">${esc(date || longDate(new Date().toISOString()))}</div>
      </div>
    </div>
  </div>

  <div class="doctor">
    <div>
      <div class="doc-name">${esc(doctorName)}</div>
      <div class="doc-meta">
        ${meta.clinicName ? `${esc(meta.clinicName)}<br/>` : ''}
        ${rx.doctorRegNo || meta.doctorRegNo ? `Reg. No: ${esc(rx.doctorRegNo || meta.doctorRegNo)}` : 'Verified SloveCare doctor'}
      </div>
    </div>
    <div class="doc-right">
      ${meta.serviceName ? `Consultation: <b>${esc(meta.serviceName)}</b><br/>` : ''}
      ${meta.bookingId ? `Booking ID: <b>${esc(meta.bookingId)}</b>` : ''}
    </div>
  </div>

  <div class="panel">
    <div class="panel-label">Patient</div>
    <div class="patient-line">${patientBits.join(' &nbsp;&middot;&nbsp; ')}</div>
    ${vitals ? `<div class="vitals">${vitals}</div>` : ''}
    ${meta.bookingId ? `<div class="booking-line">Record ID: ${esc(meta.bookingId)} &middot; Generated by SloveCare</div>` : ''}
  </div>

  <h2>Diagnosis</h2>
  <div class="panel"><div class="diag"><b>${esc(rx.diagnosis || 'Not specified')}</b></div></div>

  <h2>Prescription (Rx)</h2>
  ${rxTable}

  ${rx.advice ? `<h2>Advice</h2><div class="panel"><div class="advice">${esc(rx.advice)}</div></div>` : ''}

  ${followUp ? `<h2>Follow-up</h2><div class="followup">Next visit: ${esc(followUp)}</div>` : ''}

  <div class="foot">
    <div class="foot-name">SloveCare</div>
    <div class="foot-copy">&copy; ${year} SloveCare &middot; Healthcare made simple for everyone</div>
    <div class="foot-powered">Powered by Slovenia Tech Solutions Pvt. Ltd.</div>
    <div class="foot-fine">This prescription was issued by the doctor during your SloveCare consultation. Please follow it as advised and consult your doctor before changing any dose.</div>
  </div>

</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/*  Export flow                                                                */
/* -------------------------------------------------------------------------- */

const REBUILD_HINT =
  'PDF export needs a fresh app build. Please rebuild the app once (react-native-html-to-pdf and react-native-share were added) and try again.';

/** PDF ka file name — safe characters only. */
export function prescriptionFileName(rx: Prescription, meta: PrescriptionPdfMeta = {}): string {
  const date = String(rx.date || new Date().toISOString().slice(0, 10));
  const who = slug(meta.patientName || rx.patientName);
  return `SloveCare-Prescription-${date}${who ? `-${who}` : ''}`;
}

/** react-native-html-to-pdf ka module lazy require (purani build safe). */
function getPdfGenerator(): ((options: PDFOptions) => Promise<PDFResult>) | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-html-to-pdf')?.generatePDF;
  } catch {
    return undefined;
  }
}

/**
 * Prescription → branded PDF file (device ke cache me).
 * Return: file path + file name.
 */
export async function createPrescriptionPdf(
  rx: Prescription,
  meta: PrescriptionPdfMeta = {},
): Promise<PrescriptionPdfFile> {
  const generatePDF = getPdfGenerator();
  if (!generatePDF) {
    throw new Error(REBUILD_HINT);
  }

  const html = buildPrescriptionHtml(rx, meta);
  const fileName = prescriptionFileName(rx, meta);

  const result = await generatePDF({
    html,
    fileName,
    base64: false,
    width: 595, // A4 @ 72dpi
    height: 842,
  });

  if (!result?.filePath) {
    throw new Error('The prescription PDF could not be created. Please try again.');
  }

  return {
    filePath: result.filePath.startsWith('file://') ? result.filePath : `file://${result.filePath}`,
    fileName: `${fileName}.pdf`,
    numberOfPages: result.numberOfPages,
  };
}

/**
 * Prescription → PDF → system share sheet (WhatsApp / Drive / Files / Print…).
 * User share sheet se save ya bhej sakta hai.
 */
export async function sharePrescriptionPdf(
  rx: Prescription,
  meta: PrescriptionPdfMeta = {},
): Promise<void> {
  const file = await createPrescriptionPdf(rx, meta);
  await sharePrescriptionFile(file, rx);
}

/**
 * Already bani hui PDF file ko share sheet me bhejo (dobara PDF banane ki
 * zaroorat nahi — native converter ek time me sirf ek conversion karta hai).
 */
export async function sharePrescriptionFile(file: PrescriptionPdfFile, rx: Prescription): Promise<void> {
  let Share: { open: (options: Record<string, unknown>) => Promise<unknown> } | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-share');
    Share = mod?.default ?? mod;
  } catch {
    Share = undefined;
  }
  if (!Share?.open) {
    throw new Error(REBUILD_HINT);
  }

  const title = `Prescription${rx.diagnosis ? ` — ${rx.diagnosis}` : ''}`;
  await Share.open({
    url: file.filePath,
    type: 'application/pdf',
    title: `SloveCare ${title}`,
    subject: `SloveCare ${title}`,
    ...(Platform.OS === 'android'
      ? { message: `My prescription from SloveCare${rx.diagnosis ? ` (${rx.diagnosis})` : ''}` }
      : {}),
    failOnCancel: false,
  });
}

/**
 * Prescription → PDF → phone ke "Downloads/SloveCare" folder me save.
 *
 * Android par native FileSaver module (MediaStore) file ko public Downloads
 * me copy karta hai. Module na ho (purani build) ya save fail ho to share
 * sheet se user khud save kar sakta hai.
 */
export async function downloadPrescriptionPdf(
  rx: Prescription,
  meta: PrescriptionPdfMeta = {},
): Promise<{ saved: boolean; location?: string; file: PrescriptionPdfFile }> {
  const file = await createPrescriptionPdf(rx, meta);

  let FileSaver: { saveToDownloads: (path: string, name: string) => Promise<string> } | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    FileSaver = require('../native/FileSaver')?.FileSaver;
  } catch {
    FileSaver = undefined;
  }

  if (!FileSaver?.saveToDownloads) {
    throw new Error(REBUILD_HINT);
  }

  const location = await FileSaver.saveToDownloads(file.filePath, file.fileName);
  return { saved: true, location, file };
}
