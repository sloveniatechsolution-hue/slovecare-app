/**
 * Prescription PDF (SloveCare branded template) ka regression test.
 *
 * Bug: doctor prescription bhejta tha par client use khol hi nahi paata tha.
 * Ab client structured prescription se khud branded PDF banata hai — isliye
 * HTML builder ka output sahi hona zaroori hai (doctor, patient, Rx, advice,
 * follow-up, brand header, footer — sab PDF par aane chahiye).
 *
 * @format
 */

import { buildPrescriptionHtml, longDate, prescriptionFileName } from '../src/utils/prescriptionPdf';
import type { Prescription } from '../src/api/api';

const rx: Prescription = {
  doctorName: 'Dr Sharda Sharma',
  doctorRegNo: 'MCI-12345',
  patientName: 'Rahul Verma',
  patientAge: 32,
  patientGender: 'Male',
  date: '2026-10-20',
  diagnosis: 'Viral fever',
  vitals: { bp: '120/80', pulse: '78', temp: '101 F' },
  medicines: [
    { name: 'Paracetamol 500mg', dose: '1 tab', frequency: 'TDS', duration: '5 days', instructions: 'After food' },
    { name: 'Azithromycin 250mg', dose: '1 tab', frequency: 'OD', duration: '3 days' },
  ],
  advice: 'Rest, plenty of fluids.',
  followUpDate: '2026-10-27',
};

describe('prescription PDF html', () => {
  it('brand header, doctor, patient aur footer rakhta hai', () => {
    const html = buildPrescriptionHtml(rx, { bookingId: 'bk-123', serviceName: 'Chat Consultation' });

    expect(html).toContain('SloveCare');
    expect(html).toContain('PRESCRIPTION');
    expect(html).toContain('Dr Sharda Sharma');
    expect(html).toContain('Reg. No: MCI-12345');
    expect(html).toContain('Rahul Verma');
    expect(html).toContain('Viral fever');
    expect(html).toContain('Chat Consultation');
    expect(html).toContain('bk-123');
    expect(html).toContain('Slovenia Tech Solutions Pvt. Ltd.');
  });

  it('saari medicines, dose/frequency/duration, advice aur follow-up aata hai', () => {
    const html = buildPrescriptionHtml(rx);

    expect(html).toContain('Paracetamol 500mg');
    expect(html).toContain('Azithromycin 250mg');
    expect(html).toContain('TDS');
    expect(html).toContain('5 days');
    expect(html).toContain('Rest, plenty of fluids.');
    expect(html).toContain('27 Oct 2026');
  });

  it('vitals chips me dikhata hai', () => {
    const html = buildPrescriptionHtml(rx);
    expect(html).toContain('120/80');
    expect(html).toContain('Pulse');
  });

  it('patient ke text ko escape karta hai (HTML injection safe)', () => {
    const html = buildPrescriptionHtml({
      ...rx,
      patientName: '<script>alert("x")</script>',
      diagnosis: 'Fever & cough',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Fever &amp; cough');
  });

  it('koi medicine na ho to placeholder dikhata hai', () => {
    const html = buildPrescriptionHtml({ ...rx, medicines: [] });
    expect(html).toContain('No medicines were prescribed');
  });

  it('`timing` (purana format) ko bhi frequency ki tarah leta hai', () => {
    const html = buildPrescriptionHtml({
      ...rx,
      medicines: [{ name: 'Cough Syrup', dose: '2 tsp', timing: 'BD', duration: '4 days' }],
    });
    expect(html).toContain('BD');
  });
});

describe('prescription helpers', () => {
  it('date ko readable format me badalta hai', () => {
    expect(longDate('2026-10-20')).toBe('20 Oct 2026');
    expect(longDate('')).toBe('');
  });

  it('file name safe characters banata hai', () => {
    const name = prescriptionFileName(rx);
    expect(name).toBe('SloveCare-Prescription-2026-10-20-Rahul-Verma');
    expect(name).not.toContain(' ');
  });
});
