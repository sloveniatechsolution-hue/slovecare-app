/**
 * Diet Plan → PDF export (branded SloveCare report).
 *
 * Flow:
 *   DietPlan  →  styled HTML (SloveCare brand header + "Powered by
 *   Slovenia Tech Solutions Pvt. Ltd." footer)  →  react-native-html-to-pdf
 *   (WebView → real .pdf file)  →  system share sheet (react-native-share) —
 *   user WhatsApp/Drive/Files/Print me bhej ya save kar sakta hai.
 *
 * File location (share ke liye zaroori):
 *   Android — `directory` pass NAHI karta, to file app cacheDir me banti hai
 *             (react-native-share ka FileProvider isi path ko serve karta hai)
 *   iOS     — NSTemporaryDirectory() me banti hai (file:// URL share ready)
 *
 * Dono native modules lazy require se load hote hain — purani build me module
 * na ho to app crash nahi hota, friendly error aata hai.
 *
 * Nutrition values estimates hain — disclaimer PDF me bhi hai.
 */

import { Platform } from 'react-native';
import type { DietMeal, DietPlan } from '../api/api';
import type { PDFResult, PDFOptions } from 'react-native-html-to-pdf';

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

/** 1850 → "1,850" (Hermes Intl par bharosa nahi). */
const fmt = (n: number): string =>
  Math.round(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-12' → '12 Oct 2026'. */
const longDate = (iso: string): string => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return String(iso || '');
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** '2026-10-12' → '12 Oct'. */
const shortDate = (iso: string): string => {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return String(iso || '');
  return `${d} ${MONTHS[m - 1]}`;
};

const MEAL_LABEL: Record<DietMeal['key'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const DISCLAIMER_FALLBACK =
  'This plan provides general nutrition guidance only. It is not a medical diagnosis ' +
  'or a substitute for advice from a doctor or registered dietitian. All calorie and nutrient ' +
  'values are rough estimates.';

/* -------------------------------------------------------------------------- */
/*  HTML template — premium SloveCare branded report                           */
/* -------------------------------------------------------------------------- */

const buildMealHtml = (meal: DietMeal, done: boolean): string => {
  const items = meal.items
    .map(
      item =>
        `<li><span class="item-name">${esc(item.name)}</span>` +
        `${item.quantity ? `<span class="item-qty">&mdash; ${esc(item.quantity)}</span>` : ''}</li>`,
    )
    .join('');

  const macros = [
    `<span class="macro macro-kcal">${fmt(meal.calories)} kcal</span>`,
    `<span class="macro">Protein ${fmt(meal.protein)} g</span>`,
    `<span class="macro">Carbs ${fmt(meal.carbs)} g</span>`,
    `<span class="macro">Fat ${fmt(meal.fat)} g</span>`,
    `<span class="macro">Fiber ${fmt(meal.fiber)} g</span>`,
  ].join('');

  return `
    <div class="meal">
      <div class="meal-head">
        <div class="meal-head-left">
          <div class="meal-type">${esc(MEAL_LABEL[meal.key] ?? meal.key)}${meal.time ? ` &middot; ${esc(meal.time)}` : ''}</div>
          <div class="meal-name">${esc(meal.name)}</div>
        </div>
        <div class="done ${done ? 'done-yes' : 'done-no'}">${done ? '&#9745; Done' : '&#9744; Planned'}</div>
      </div>
      ${items ? `<ul class="items">${items}</ul>` : ''}
      <div class="macros">${macros}</div>
      ${meal.instructions ? `<div class="meal-note"><b>How to prepare:</b> ${esc(meal.instructions)}</div>` : ''}
      ${
        meal.alternatives.length
          ? `<div class="meal-note"><b>Alternatives:</b> ${meal.alternatives.map(esc).join(' &middot; ')}</div>`
          : ''
      }
    </div>`;
};

const buildDayHtml = (day: DietPlan['plan']['days'][number], dayIndex: number, completion: Record<string, boolean>): string => {
  const meals = day.meals.map(meal => buildMealHtml(meal, Boolean(completion[`d${dayIndex}-${meal.key}`]))).join('');

  return `
    <div class="day">
      <h2 class="day-head">
        <span class="day-no">Day ${dayIndex + 1}</span>
        <span class="day-date">${esc(day.weekday)}, ${esc(shortDate(day.date))}</span>
      </h2>
      ${meals || '<div class="empty-day">No meals were planned for this day — please review it in the SloveCare app.</div>'}
      <div class="totals">
        <div class="totals-label">Daily total (estimated)</div>
        <div class="totals-row">
          <div class="tot"><b>${fmt(day.totals.calories)}</b><span>kcal</span></div>
          <div class="tot"><b>${fmt(day.totals.protein)} g</b><span>Protein</span></div>
          <div class="tot"><b>${fmt(day.totals.carbs)} g</b><span>Carbs</span></div>
          <div class="tot"><b>${fmt(day.totals.fat)} g</b><span>Fat</span></div>
          <div class="tot"><b>${fmt(day.totals.fiber)} g</b><span>Fiber</span></div>
        </div>
      </div>
    </div>`;
};

const buildGroceryHtml = (plan: DietPlan): string => {
  if (!plan.plan.grocery?.length) {
    return '';
  }
  const cats = plan.plan.grocery
    .map(
      cat => `
      <div class="gcat">
        <div class="gcat-title">${esc(cat.category)}</div>
        <table class="gcat-table">
          ${cat.items
            .map(
              item =>
                `<tr><td class="g-item">${esc(item.name)}</td><td class="g-qty">${esc(item.quantity)}</td></tr>`,
            )
            .join('')}
        </table>
      </div>`,
    )
    .join('');
  return `<h2>Weekly grocery list</h2><div class="grocery">${cats}</div>`;
};

const buildWarningsHtml = (plan: DietPlan): string => {
  const warnings = plan.plan.warnings ?? [];
  if (!warnings.length) {
    return '';
  }
  return `
    <div class="warnings">
      <div class="warnings-title">Important health notes</div>
      <ul>${warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    </div>`;
};

/**
 * Poora plan → branded printable HTML (A4, print-safe CSS).
 * `completion` = meal checkbox state (d0-breakfast → true).
 */
export function buildDietPlanHtml(plan: DietPlan, completion: Record<string, boolean> = {}): string {
  const data = plan.plan;
  const year = new Date().getFullYear();
  const range = `${longDate(plan.weekStart)} – ${longDate(plan.weekEnd)}`;
  const goal = (plan.summary?.goal || plan.preferences?.goal || 'healthy_eating').replace(/_/g, ' ');
  const goalLabel = goal.replace(/\b\w/g, char => char.toUpperCase());
  const dietType = (plan.summary?.dietType || plan.preferences?.dietType || '').replace(/_/g, ' ');

  const avgCalories =
    plan.summary?.avgCalories ||
    Math.round((data.days || []).reduce((total, d) => total + (d.totals?.calories || 0), 0) / (data.days?.length || 1 || 1));

  const pills = [
    `Goal: ${esc(goalLabel)}`,
    dietType ? esc(dietType.replace(/\b\w/g, char => char.toUpperCase())) : '',
    plan.summary?.cuisine ? `${esc(plan.summary.cuisine)} style` : '',
    avgCalories ? `~${fmt(avgCalories)} kcal/day` : '',
    plan.summary?.days ? `${plan.summary.days} days` : '',
    plan.version > 1 ? `Version ${plan.version}` : '',
  ]
    .filter(Boolean)
    .map(text => `<span class="pill">${text}</span>`)
    .join('');

  const tips = (data.prep_tips ?? []).map(tip => `<li>${esc(tip)}</li>`).join('');

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
  }

  /* ----------------------------- brand header ----------------------------- */
  .brand {
    background: linear-gradient(115deg, #0BA39C 0%, #1D8FD6 55%, #2563EB 100%);
    color: #FFFFFF; border-radius: 14px; padding: 18px 20px 16px;
  }
  .brand-row { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 44px; height: 44px; border-radius: 22px; background: rgba(255,255,255,0.18);
    border: 1.5px solid rgba(255,255,255,0.45); text-align: center; line-height: 41px;
    font-size: 20px; font-weight: 800;
  }
  .brand-tag { font-size: 9.5px; letter-spacing: 2.2px; text-transform: uppercase; opacity: 0.85; }
  .brand-name { font-size: 25px; font-weight: 800; letter-spacing: -0.4px; line-height: 1.1; }
  .brand-title { margin-top: 12px; font-size: 14.5px; font-weight: 600; }
  .brand-range { font-size: 11.5px; opacity: 0.88; margin-top: 2px; }
  .pills { margin-top: 10px; }
  .pill {
    display: inline-block; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.32);
    border-radius: 999px; padding: 3px 10px; font-size: 10.5px; margin: 0 5px 5px 0;
  }

  /* --------------------------------- cards -------------------------------- */
  h2 {
    font-size: 14.5px; color: #0B2447; margin: 16px 0 8px; padding-left: 9px;
    border-left: 4px solid #0BA39C; page-break-after: avoid; break-after: avoid;
  }
  .card {
    border: 1px solid #E2E8F0; border-radius: 10px; padding: 11px 13px; margin-top: 9px; background: #FFFFFF;
    page-break-inside: avoid; break-inside: avoid;
  }
  .card-label { font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; color: #64748B; font-weight: 700; }
  .card p { margin-top: 4px; font-size: 11.5px; color: #243B63; }

  .warnings {
    background: #FEF4E5; border: 1px solid #F59E0B; border-radius: 10px; padding: 10px 13px; margin-top: 10px;
    page-break-inside: avoid; break-inside: avoid;
  }
  .warnings-title { font-size: 11px; font-weight: 800; color: #92600A; }
  .warnings ul { margin: 4px 0 0 16px; }
  .warnings li { font-size: 11px; color: #7C5109; margin-top: 2px; }

  /* --------------------------------- days --------------------------------- */
  .day { page-break-inside: auto; }
  .day-head { display: flex; align-items: baseline; gap: 8px; }
  .day-no { font-size: 14.5px; font-weight: 800; color: #0B2447; }
  .day-date { font-size: 11.5px; color: #64748B; font-weight: 600; }
  .empty-day {
    background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; color: #64748B;
    font-size: 11px; padding: 10px; text-align: center;
  }

  .meal {
    border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 12px; margin-top: 8px; background: #FFFFFF;
    page-break-inside: avoid; break-inside: avoid;
  }
  .meal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .meal-type { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #64748B; font-weight: 700; }
  .meal-name { font-size: 13px; font-weight: 700; color: #0B2447; margin-top: 1px; }
  .done { font-size: 10px; font-weight: 700; border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
  .done-yes { background: #E7F8F1; color: #157F3D; border: 1px solid #A7E2C4; }
  .done-no { background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; }

  .items { margin: 7px 0 0 16px; }
  .items li { font-size: 11.5px; color: #243B63; margin-top: 1.5px; }
  .item-name { font-weight: 600; }
  .item-qty { color: #64748B; font-weight: 400; margin-left: 5px; }

  .macros { margin-top: 7px; }
  .macro {
    display: inline-block; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 999px;
    font-size: 10px; font-weight: 600; color: #475569; padding: 2.5px 8px; margin: 0 4px 4px 0;
  }
  .macro-kcal { background: #EAF1FE; border-color: #C7D9FB; color: #1D4ED8; font-weight: 800; }

  .meal-note { margin-top: 6px; font-size: 11px; color: #475569; }
  .meal-note b { color: #0B2447; }

  .totals {
    background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 10px; margin-top: 8px;
    page-break-inside: avoid; break-inside: avoid;
  }
  .totals-label { font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; color: #64748B; font-weight: 700; }
  .totals-row { display: flex; gap: 6px; margin-top: 5px; }
  .tot { flex: 1; text-align: center; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 7px; padding: 5px 2px; }
  .tot b { display: block; font-size: 13px; color: #2563EB; }
  .tot span { font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }

  /* ------------------------------- grocery -------------------------------- */
  .grocery { display: flex; flex-wrap: wrap; gap: 8px; }
  .gcat {
    width: 48%; border: 1px solid #E2E8F0; border-radius: 10px; padding: 9px 11px;
    page-break-inside: avoid; break-inside: avoid;
  }
  .gcat-title { font-size: 10.5px; font-weight: 800; color: #0BA39C; text-transform: uppercase; letter-spacing: 0.8px; }
  .gcat-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .gcat-table td { font-size: 11px; padding: 2.5px 0; border-bottom: 1px dotted #E2E8F0; }
  .g-item { color: #243B63; font-weight: 600; }
  .g-qty { text-align: right; color: #64748B; white-space: nowrap; }

  .tips { margin: 4px 0 0 16px; }
  .tips li { font-size: 11.5px; color: #243B63; margin-top: 2px; }

  .disclaimer {
    background: #F8FAFC; border: 1px dashed #94A3B8; border-radius: 10px; padding: 10px 13px; margin-top: 14px;
    font-size: 10px; color: #64748B; line-height: 1.5;
    page-break-inside: avoid; break-inside: avoid;
  }
  .disclaimer b { color: #0B2447; }

  /* -------------------------------- footer -------------------------------- */
  .foot {
    margin-top: 16px; border-top: 3px solid #0BA39C; padding-top: 12px; text-align: center;
    page-break-inside: avoid; break-inside: avoid;
  }
  .foot-name { font-size: 15px; font-weight: 800; color: #0B2447; letter-spacing: -0.2px; }
  .foot-copy { font-size: 10.5px; color: #475569; margin-top: 3px; }
  .foot-powered { font-size: 10.5px; color: #0BA39C; font-weight: 700; margin-top: 1px; }
  .foot-fine { font-size: 9px; color: #94A3B8; margin-top: 5px; }
</style>
</head>
<body>

  <div class="brand">
    <div class="brand-row">
      <div class="logo">S</div>
      <div>
        <div class="brand-tag">Weekly Diet Planner</div>
        <div class="brand-name">SloveCare</div>
      </div>
    </div>
    <div class="brand-title">Your Weekly Diet Plan</div>
    <div class="brand-range">${esc(range)} &middot; Generated ${esc(longDate(String(plan.createdAt || '').slice(0, 10)) || shortDate(plan.weekStart))}</div>
    <div class="pills">${pills}</div>
  </div>

  ${
    data.overview || data.reasoning
      ? `<div class="card">
          ${data.overview ? `<div class="card-label">Weekly overview</div><p>${esc(data.overview)}</p>` : ''}
          ${data.reasoning ? `<div class="card-label" style="margin-top:8px">Why this plan fits you</div><p>${esc(data.reasoning)}</p>` : ''}
        </div>`
      : ''
  }

  ${buildWarningsHtml(plan)}

  ${(data.days || [])
    .map((day, index) => buildDayHtml(day, index, completion))
    .join('')}

  ${buildGroceryHtml(plan)}

  ${
    data.hydration || tips
      ? `<h2>Hydration &amp; meal prep</h2>
        ${data.hydration ? `<div class="card"><div class="card-label">Hydration</div><p>${esc(data.hydration)}</p></div>` : ''}
        ${tips ? `<div class="card"><div class="card-label">Meal prep tips</div><ol class="tips">${tips}</ol></div>` : ''}`
      : ''
  }

  <div class="disclaimer"><b>Disclaimer:</b> ${esc(plan.disclaimer ?? DISCLAIMER_FALLBACK)} Calorie and nutrient values in this plan are rough estimates prepared by AI for general guidance only.</div>

  <div class="foot">
    <div class="foot-name">SloveCare</div>
    <div class="foot-copy">&copy; ${year} SloveCare &middot; Healthcare made simple for everyone</div>
    <div class="foot-powered">Powered by Slovenia Tech Solutions Pvt. Ltd.</div>
    <div class="foot-fine">This plan was generated by SloveCare AI from your personal preferences. Please share it with your doctor or dietitian before making major diet changes.</div>
  </div>

</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/*  Export flow                                                                */
/* -------------------------------------------------------------------------- */

const REBUILD_HINT =
  'PDF export needs a fresh app build. Please rebuild the app once (react-native-html-to-pdf and react-native-share were added) and try again.';

/**
 * Plan → PDF file → system share sheet (WhatsApp / Drive / Files / Print…).
 *
 * - `directory` pass nahi hota → Android me app cache dir, iOS me temp dir —
 *   dono jagah se react-native-share file:// URL aasani se share karta hai.
 * - User share sheet cancel kare to koi error nahi (failOnCancel: false).
 */
export async function exportDietPlanPdf(
  plan: DietPlan,
  completion: Record<string, boolean> = {},
): Promise<void> {
  const html = buildDietPlanHtml(plan, completion);

  let generatePDF: ((options: PDFOptions) => Promise<PDFResult>) | undefined;
  try {
    // Lazy require — module na ho (purani build) to app crash nahi hoga.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    generatePDF = require('react-native-html-to-pdf')?.generatePDF;
  } catch {
    generatePDF = undefined;
  }
  if (!generatePDF) {
    throw new Error(REBUILD_HINT);
  }

  const range = `${shortDate(plan.weekStart)} - ${shortDate(plan.weekEnd)}`;
  const result = await generatePDF({
    html,
    fileName: `SloveCare-Diet-Plan-${plan.weekStart}`,
    base64: false,
  });
  if (!result?.filePath) {
    throw new Error('The PDF could not be created. Please try again.');
  }

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

  const filePath = result.filePath.startsWith('file://') ? result.filePath : `file://${result.filePath}`;

  await Share.open({
    url: filePath,
    type: 'application/pdf',
    title: 'SloveCare Weekly Diet Plan',
    subject: `SloveCare Diet Plan (${range})`,
    ...(Platform.OS === 'android'
      ? { message: `My 7-day diet plan from SloveCare (${range})` }
      : {}),
    failOnCancel: false,
  });
}
