import {
  generateFallbackOcrResult,
  parseAndAnalyzePrescription,
} from '../src/utils/prescriptionAnalyzer';

describe('prescriptionAnalyzer', () => {
  it('analyzes printed and handwritten prescription texts accurately', () => {
    const sampleText = `
      Dr. S. K. Sharma, MD
      Sharma Medical Clinic
      Date: 15/10/2026
      Patient: Ramesh Kumar, 45 yrs

      Rx:
      1. Tab Paracetamol 650mg TDS x 3 days after food
      2. Cap Pantocid 40mg OD before breakfast x 5 days
      3. Tab Azithromycin 500mg OD for 3 days
      Drink plenty of fluids.
    `;

    const result = parseAndAnalyzePrescription(sampleText);

    expect(result.analysis.doctor_name).toContain('Dr. S. K. Sharma');
    expect(result.analysis.patient_name).toContain('Ramesh Kumar');
    expect(result.analysis.prescription_date).toBe('15/10/2026');

    // Verify medicines extracted
    expect(result.analysis.medicines.length).toBeGreaterThanOrEqual(3);
    const paracetamol = result.analysis.medicines.find(m => /Paracetamol/i.test(m.name));
    expect(paracetamol).toBeDefined();
    expect(paracetamol?.strength).toBe('650mg');
    expect(paracetamol?.common_use).toContain('Fever');

    const panto = result.analysis.medicines.find(m => /Pantocid/i.test(m.name));
    expect(panto).toBeDefined();
    expect(panto?.instructions).toContain('empty stomach');

    expect(result.analysis.warnings.length).toBeGreaterThan(0);
    expect(result.disclaimer).toContain('AI-generated information');
  });

  it('generates fallback OCR result with structured lines', () => {
    const ocr = generateFallbackOcrResult('test_rx.jpg');

    expect(ocr.success).toBe(true);
    expect(ocr.full_text).toContain('Rx');
    expect(ocr.lines.length).toBeGreaterThan(0);
    expect(ocr.average_confidence).toBeGreaterThan(0.8);
  });
});
