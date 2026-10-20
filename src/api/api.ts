/**
 * ============================================================================
 *  SLOVECARE — SINGLE API LAYER
 * ----------------------------------------------------------------------------
 *  Har API call sirf isi file se hoti hai. Koi screen/component direct
 *  fetch() nahi karega — sab `api.*` methods use karenge.
 *
 *  Backend (live)                : https://sloveniajanseva-backend.vercel.app (Vercel)
 *  App hamesha live backend se connect hota hai — koi local/JSON DB nahi.
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  ChatSessionInfo,
  ConsultationMessage,
  ConsultationRtcConfig,
} from '../consultation/types';
import { withoutDemoVendors } from '../utils/demoVendors';

/* -------------------------------------------------------------------------- */
/*  1. CONFIG                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Backend ke hosts — ek se zyada isliye kyunki kuch networks (government/office
 * WiFi, kuch ISPs, mobile data) kisi host ka DNS hi block kar dete hain
 * (SERVFAIL) ya host down ho. Aise me `fetch` error deta hai — ya DNS resolve
 * hone me hi latak ke 20s timeout tak chala jaata hai.
 *
 *  1. `slovecarebackend.slovecare.in`   → self-hosted (nginx → Express) — primary
 *  2. `api.slovecare.in`                → Vercel (custom domain) — fallback
 *  3. `sloveniajanseva-backend.vercel.app` → Vercel direct — fallback
 *
 * ⚠️ IS LIST ME DUPLICATE KABHI MAT DAALO.
 * Pehle dono entries ek hi host thi (`slovecarebackend.slovecare.in` × 2) —
 * failover marr gaya: ek hi dead host par 2 × 20s = 40s latka rehta tha aur
 * phir "Request timed out" aata tha. Ab:
 *   - `hostList()` duplicates hata deta hai,
 *   - GET requests HEDGED chalti hain — pehla host turant, agla host 1.5s baad
 *     (ya pehle fail hone par turant) parallel chalu → dead host hone par bhi
 *     app 1–3s me load ho jaata hai.
 */
export const API_HOSTS = [
  'https://slovecarebackend.slovecare.in',
  'https://api.slovecare.in',
  'https://sloveniajanseva-backend.vercel.app',
] as const;

/** Duplicates hata kar host list — failover me same host dobara try na ho. */
function hostList(): string[] {
  return Array.from(new Set<string>(API_HOSTS));
}

/** Session me abhi kaam kar raha host (request() ise update karta hai). */
let activeHost: string = API_HOSTS[0];

/** Abhi healthy host ka origin — images/links isi se banate hain. */
export function apiOrigin(): string {
  return activeHost;
}

/** API base URL (primary host) — sirf wahi jagah use karein jahan static const chahiye. */
export const BASE_URL = `${API_HOSTS[0]}/api/v1`;

/** Health check endpoint (BASE_URL ke bahar). */
export const HEALTH_URL = `${API_HOSTS[0]}/api/health`;

/** Slota AI chat path — POST { messages } → { reply } (plain JSON, envelope nahi). */
const AI_CHAT_PATH = '/api/v1/ai/chat';

/** Prescription Reader paths — envelope responses (ApiResponse shape). */
const PRESCRIPTION_OCR_PATH = '/api/v1/prescription/ocr';
const PRESCRIPTION_ANALYZE_PATH = '/api/v1/prescription/analyze';

/**
 * Prescription Reader credits (3 free reads → ₹19 me 10 reads).
 * Backend contract:
 *   GET  /prescription/quota        → balance + pack ki price
 *   POST /prescription/create-order → Razorpay order (₹19)
 *   POST /prescription/verify       → signature verify + 10 reads grant
 */
const PRESCRIPTION_QUOTA_PATH = '/api/v1/prescription/quota';
const PRESCRIPTION_CREDIT_ORDER_PATH = '/api/v1/prescription/create-order';
const PRESCRIPTION_CREDIT_VERIFY_PATH = '/api/v1/prescription/verify';

/** AI Weekly Diet Planner path — envelope responses, auth required. */
const DIET_PLANS_PATH = '/api/v1/diet-plans';

/** Ek host par request ka max time (hedged race me total wait bhi yahi hai). */
const REQUEST_TIMEOUT_MS = 20000;

/**
 * Saare hosts mila kar ek call ka max time — sirf sequential failover
 * (POST/PUT/DELETE) me use hota hai, taaki user 3 × 20s = 60s na wait kare.
 */
const REQUEST_TOTAL_BUDGET_MS = 30000;

/**
 * Hedged request delay — pehla host itni der tak jawab nahi de to agla host
 * parallel chalu ho jaata hai (dead host par 20s wait karne se bacha).
 */
const HOST_HEDGE_DELAY_MS = 1500;

const TOKEN_STORAGE_KEY = 'slovecare_user_token';

/* -------------------------------------------------------------------------- */
/*  2. TYPES (Backend response shapes)                                         */
/* -------------------------------------------------------------------------- */

export interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  errors?: Record<string, string[]> | undefined;
}

export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export interface HealthProfile {
  bloodGroup?: BloodGroup | string;
  gender?: string;
  age?: number;
  dob?: string;
  weight?: number;
  height?: number;
  emergencyContact?: string;
  emergencyRelation?: string;
  medicalConditions?: string[];
  allergies?: string[];
  state?: string;
  city?: string;
  address?: string;
  pincode?: string;
}

export interface User extends HealthProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar?: string;
  state?: string;
  city?: string;
  address?: string;
  pincode?: string;
  isProfileComplete?: boolean;
  createdAt?: string;
}

export interface DoctorPricing {
  onlineConsultationFee?: number;
  homeVisitFee?: number;
  clinicVisitFee?: number;
  baseVisitFee?: number;
  perVisit?: number;
  perHour?: number;
  halfDay?: number;
  fullDay?: number;
  injectionFee?: number;
  dressingFee?: number;
  bpSugarCheckFee?: number;
  ivDripFee?: number;
  homeCollectionFee?: number;
  /** Vendor apni keys (Pricing screen se) yahan rakh sakta hai. */
  [key: string]: number | undefined;
}

export interface DoctorServices {
  onlineConsultation?: boolean;
  homeVisit?: boolean;
  clinicVisit?: boolean;
  injection?: boolean;
  dressing?: boolean;
  bpCheck?: boolean;
  sugarCheck?: boolean;
  ivDrip?: boolean;
  elderCare?: boolean;
  patientCare?: boolean;
  nightCare?: boolean;
  dayCare?: boolean;
  /** Vendor ke custom toggles (Pricing screen se). */
  [key: string]: boolean | undefined;
}

export interface DoctorDetails {
  specialization?: string;
  category?: string;
  qualification?: string;
  registrationNumber?: string;
  registrationAuthority?: string;
  experienceYears?: number;
  languages?: string[];
  bio?: string;
  services?: DoctorServices;
  pricing?: DoctorPricing;
  workingDays?: string[];
  workingHours?: { start?: string; end?: string };
  slotDurationMinutes?: number;
}

export interface StaffDetails {
  registrationNumber?: string;
  qualification?: string;
  experienceYears?: number;
  languages?: string[];
  services?: DoctorServices;
  pricing?: DoctorPricing;
  workingDays?: string[];
  workingHours?: { start?: string; end?: string };
}

export type VendorType =
  | 'doctor'
  | 'compounder'
  | 'nurse'
  | 'caretaker'
  | 'lab'
  | 'pharmacy'
  | 'ambulance'
  | string;

export interface LabDetails {
  labName?: string;
  licenseNumber?: string;
  certifications?: string[];
  homeSampleCollectionAvailable?: boolean;
  /** Backend `homeCollectionAvailable` bhejta hai — dono keys support hain. */
  homeCollectionAvailable?: boolean;
  homeCollectionFee?: number;
  labTimings?: { start?: string; end?: string };
  workingDays?: string[];
  services?: DoctorServices;
  pricing?: DoctorPricing;
  [key: string]: unknown;
}

/** Vendor khud set kiya hua custom service (naam + daam). */
export interface ServicePrice {
  name: string;
  price: number;
}

export interface Vendor {
  id: string;
  type: VendorType;
  name: string;
  avatar?: string;
  email?: string;
  phone?: string;
  gender?: string;
  address?: string;
  city?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
  verificationStatus?: 'verified' | 'pending' | 'rejected' | string;
  liveStatus?: 'available' | 'busy' | 'offline' | string;
  emergencyAvailable?: boolean;
  rating?: number;
  reviewCount?: number;
  joinedDate?: string;

  /* Vendor panel se aane wale fields (register + Pricing/Edit screens). */
  specialization?: string;
  qualification?: string;
  registrationNumber?: string;
  registrationAuthority?: string;
  experienceYears?: number;
  bio?: string;
  workingDays?: string[];
  workingHours?: { start?: string; end?: string };
  pricing?: DoctorPricing;
  services?: DoctorServices;
  servicePrices?: ServicePrice[];

  /**
   * Degree certificate — optional at signup; vendor baad me upload karta hai.
   * Team verify karti hai; verified hone par card/detail pe "Degree Verified"
   * badge + degree dikhti hai. (Certificate ka image sirf team ko dikhta hai.)
   */
  degreeCertificate?: string;
  degreeVerificationStatus?: 'none' | 'pending' | 'verified' | 'rejected' | string;
  degreeVerificationNotes?: string;
  degreeUploadedAt?: string;

  doctorDetails?: DoctorDetails;
  compounderDetails?: StaffDetails;
  nurseDetails?: StaffDetails;
  caretakerDetails?: StaffDetails;
  labDetails?: LabDetails;
  calculatedDistance?: number | null;
  totalBookingsCount?: number;
  reviews?: Review[];
}

/** Doctor = verified medical staff vendor. */
export type Doctor = Vendor;

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'active'
  | 'completed'
  | 'cancelled'
  | string;

export type ServiceType =
  | 'home_visit'
  | 'online_consultation'
  | 'clinic_visit'
  | 'lab_test'
  | 'medicine_order'
  | 'nursing'
  | string;

export interface Prescription {
  id?: string;
  bookingId?: string;
  doctorName?: string;
  doctorRegNo?: string;
  patientName?: string;
  patientAge?: number;
  patientGender?: string;
  date?: string;
  diagnosis?: string;
  vitals?: Record<string, string | number>;
  /**
   * Medicines — doctor app `frequency` + `instructions` bhejta hai, kuch purane
   * records `timing` use karte hain (dono handle kiye jaate hain).
   */
  medicines?: {
    name?: string;
    dose?: string;
    timing?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }[];
  advice?: string;
  followUpDate?: string;
  /** Doctor ke upload kiye files (prescription image/PDF) — sirf aapke. */
  files?: { title?: string; fileUrl: string }[];
}

/* -------------------------------------------------------------------------- */
/*  Prescription Reader (PaddleOCR → existing Gemini)                          */
/* -------------------------------------------------------------------------- */

/** OCR line ka status — confidence bucket (PaddleOCR service se aata hai). */
export type OcrLineStatus = 'confident' | 'low_confidence' | 'unreadable';

export interface OcrLine {
  text: string;
  confidence: number;
  status: OcrLineStatus;
  box?: number[][];
}

export interface OcrUnreadableSection {
  text: string;
  confidence: number;
}

/** PaddleOCR ka structured output — extracted text + confidence scores. */
export interface PrescriptionOcrResult {
  success?: boolean;
  engine?: { name?: string; version?: string; language?: string };
  full_text: string;
  confident_text: string;
  low_confidence_text: string;
  unreadable_sections: OcrUnreadableSection[];
  lines: OcrLine[];
  average_confidence: number;
  confident_count?: number;
  low_confidence_count?: number;
  unreadable_count?: number;
  preprocessing?: {
    steps?: string[];
    rotation_degrees?: number;
    blur_score?: number;
    blurry?: boolean;
    original_size?: number[];
    processed_size?: number[];
  };
  warnings?: string[];
  took_ms?: number;
}

export type MedicineConfidence = 'high' | 'medium' | 'low';

export interface PrescriptionMedicine {
  name: string;
  confidence: MedicineConfidence;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  common_use: string;
  uncertainty: string;
}

/** Gemini se aaya hua structured prescription analysis. */
export interface PrescriptionAnalysis {
  patient_name: string;
  doctor_name: string;
  prescription_date: string;
  medicines: PrescriptionMedicine[];
  additional_instructions: string[];
  warnings: string[];
  unreadable_sections: string[];
  summary: string;
}

export interface PrescriptionAnalysisResult {
  analysis: PrescriptionAnalysis;
  disclaimer: string;
  source?: string;
}

/**
 * Prescription Reader credit balance — server ka authoritative view.
 * (3 free reads + paid packs of 10 reads for ₹19.)
 */
export interface PrescriptionQuota {
  /** Total free reads user ko mili (usually 3). */
  freeTotal?: number;
  /** Free reads ka bacha hua balance. */
  freeRemaining?: number;
  /** Paid pack se aaye reads ka balance. */
  paidRemaining?: number;
  /** Pack me kitne reads milte hain (usually 10). */
  packSize?: number;
  /** Pack ki price (rupees, usually 19). */
  packPriceRupees?: number;
}

/** Razorpay order — 10-read pack (₹19) ke liye. */
export interface PrescriptionCreditOrder {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
  amountRupees: number;
}

/* -------------------------------------------------------------------------- */
/*  AI Weekly Diet Planner                                                     */
/* -------------------------------------------------------------------------- */

/** Ek meal ka ingredient (naam + quantity). */
export interface DietMealItem {
  name: string;
  quantity: string;
}

/** Ek din ka meal card. */
export interface DietMeal {
  key: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  time: string;
  items: DietMealItem[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  instructions: string;
  alternatives: string[];
}

export interface DietDayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/** Din ka pura data (7 din ke plans me). */
export interface DietDay {
  date: string; // YYYY-MM-DD
  weekday: string;
  meals: DietMeal[];
  totals: DietDayTotals;
}

export interface DietGroceryCategory {
  category: string;
  items: DietMealItem[];
}

/** Gemini plan ka validated payload. Nutrition values = estimates. */
export interface DietPlanData {
  overview: string;
  reasoning: string;
  hydration: string;
  prep_tips: string[];
  warnings: string[];
  days: DietDay[];
  grocery: DietGroceryCategory[];
}

/** Form ke saare jawab — plan ke saath snapshot ki tarah save hote hain. */
export interface DietPlanPreferences {
  age: number | null;
  sex: string;
  heightCm: number | null;
  weightKg: number | null;
  goalWeightKg: number | null;
  country: string;
  state: string;
  city: string;
  activityLevel: string;
  goal: string;
  medicalConditions: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  medications: string;
  pregnancyStatus: string;
  exerciseRoutine: string;
  sleepSchedule: string;
  dailyRoutine: string;
  dietType: string;
  dietTypeOther: string;
  cuisine: string;
  favoriteFoods: string[];
  dislikedFoods: string[];
  mealsPerDay: number;
  mealTimings: string;
  budget: string;
  cookingPreference: string;
  restrictionsNotes: string;
}

/** List screen ke liye light summary. */
export interface DietPlanSummary {
  goal?: string;
  dietType?: string;
  cuisine?: string;
  age?: number;
  avgCalories?: number;
  days?: number;
}

/** Save kiya gaya plan — history me har version alag document. */
export interface DietPlan {
  id: string;
  userId?: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD
  status: 'active' | 'superseded' | string;
  version: number;
  summary: DietPlanSummary;
  preferences: DietPlanPreferences;
  plan: DietPlanData;
  completion: Record<string, boolean>;
  disclaimer?: string;
  createdAt?: string;
  /** Same preferences se abhi bana plan reuse hua (duplicate-tap guard). */
  reused?: boolean;
}

/** History list item (plan payload ke bina — halka). */
export interface DietPlanListItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: 'active' | 'superseded' | string;
  version: number;
  summary: DietPlanSummary;
  createdAt?: string;
}

/**
 * Weekly diet plan subscription status (server-authoritative).
 * Pehla week free hota hai, uske baad ₹9/week.
 */
export interface DietPlanSubscriptionStatus {
  weekStart: string;
  weekEnd: string;
  /** Is hafte ka plan already ban chuka hai. */
  hasPlanThisWeek: boolean;
  /** Is hafte ka existing plan (hasPlanThisWeek true par). */
  planId: string | null;
  /** Pehla week (free trial). */
  isFreeWeek: boolean;
  /** Is hafte ka payment already ho chuka hai. */
  isPaid: boolean;
  /** Payment lagti hai (pehla week nahi, plan nahi, paid nahi). */
  requiresPayment: boolean;
  /** Weekly price (rupees). */
  amountRupees: number;
}

/**
 * create-order ka jawab — server decide karta hai payment lagti hai ya nahi.
 * `requiresPayment:false` → seedha plan bana sakte ho (free / already paid).
 */
export interface DietPlanOrderResult {
  requiresPayment: boolean;
  /** Pehla week free. */
  free?: boolean;
  /** Is hafte ka payment pehle ho chuka hai. */
  alreadyPaid?: boolean;
  /** Payment required hone par — Razorpay checkout ke liye. */
  keyId?: string;
  orderId?: string;
  /** Amount paise me (Razorpay checkout unit). */
  amount?: number;
  currency?: string;
  /** Amount rupees me (UI ke liye). */
  amountRupees: number;
  weekStart?: string;
  weekEnd?: string;
}

/** Payment verify ka jawab. */
export interface DietPlanVerifyResult {
  verified: boolean;
  paymentId?: string;
  weekStart?: string;
  weekEnd?: string;
  amountRupees?: number;
}

export interface BookingCustomer {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  age?: number;
  address?: string;
  city?: string;
  pincode?: string;
  distanceKm?: number;
}

export interface ReportFile {
  id?: string;
  title: string;
  fileUrl: string;
  fileType?: string;
  reportType?: string;
  notes?: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

export interface Booking {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorType?: VendorType;
  customer: BookingCustomer;
  patientName: string;
  patientPhone: string;
  doctorName?: string;
  consultationType?: string;
  serviceName: string;
  serviceType: ServiceType;
  date: string;
  /** Original slot — delay ke baad bhi yahi rehta hai. */
  timeSlot: string;
  /**
   * Display time — delay ke baad provider ise aage badha deta hai.
   * Purani bookings me missing ho sakta hai → `bookingTime()` use karein.
   */
  time?: string;
  amount: number;
  status: BookingStatus;
  paymentStatus?: string;
  notes?: string;
  address?: string;
  symptoms?: string;
  medicalConditions?: string[];
  orderItems?: { name: string; qty: number; price?: number }[];
  sampleStatus?: string;
  prescription?: Prescription;
  /** Doctor/lab ki upload ki hui patient files — sirf ye booking ke liye. */
  reportFiles?: ReportFile[];
  /** Delay feature — vendor panel se slot thoda aage badhta hai. */
  isDelayed?: boolean;
  delayMinutes?: number;
  originalTime?: string;
  delayedAt?: string;
  /* ---------------------- consultation fields (video/chat) ---------------- */
  /** 'video' | 'chat' — naye consultation bookings par backend set karta hai. */
  consultationMode?: 'video' | 'chat';
  /** Session duration (minutes) — video call ya paid chat window. */
  durationMinutes?: number;
  /** Authorized room/session reference (server-generated). */
  roomRef?: string;
  /** Chat session window (server-generated) — start/expiry yahi se aati hai. */
  sessionStartsAt?: string;
  sessionExpiresAt?: string;
}

/**
 * Booking ka display time — delay ke baad `time` naya hota hai, warna
 * `timeSlot` (purani bookings) dikhana sahi hai.
 */
export function bookingTime(booking: Pick<Booking, 'time' | 'timeSlot'>): string {
  return booking.time || booking.timeSlot || '';
}

export interface CreateBookingPayload {
  vendorId: string;
  customer: BookingCustomer;
  serviceName: string;
  serviceType?: ServiceType;
  doctorName?: string;
  patientName?: string;
  patientPhone?: string;
  address?: string;
  consultationType?: string;
  date?: string;
  timeSlot?: string;
  amount: number;
  totalAmount?: number;
  notes?: string;
  medicalConditions?: string[];
  paymentStatus?: string;
  orderItems?: { name: string; qty: number; price?: number }[];
  sampleStatus?: string;
  /** Lab mode: server price isi LabTest record se verify karta hai. */
  testId?: string;
  /** Video/Chat consultation: duration server isi se session window set karta hai. */
  durationMinutes?: number;
  /** 'video' | 'chat' — consultation bookings ke liye (backend room/session bhi isi se). */
  consultationMode?: 'video' | 'chat';
}

/** POST /payments/create-order ka jawab — server decide karta hai pay hoga ya nahi. */
export type PaymentOrderResult =
  | { requiresPayment: false; bookingId: string }
  | {
    requiresPayment: true;
    bookingId: string;
    keyId: string;
    orderId: string;
    amount: number; // paise (Razorpay checkout unit)
    currency: string;
    amountRupees: number;
  };

/** Razorpay checkout success ke 3 signatures — backend verify ko jaate hain. */
export interface PaymentSignature {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentVerifyResult {
  bookingId: string;
  verified: boolean;
  booking?: Booking;
}

export interface LabTest {
  id: string;
  vendorId?: string;
  name: string;
  category?: string;
  description?: string;
  price: number;
  discountedPrice?: number;
  sampleType?: string;
  homeCollectionAvailable?: boolean;
  preparationInstructions?: string;
  turnaroundTime?: string;
  image?: string;
  isActive?: boolean;
  /** Vendor ki profile photo — backend join karke deta hai, bina extra API call ke. */
  vendorAvatar?: string;
  vendorName?: string;
}

export interface Medicine {
  id: string;
  vendorId?: string;
  name: string;
  salt?: string;
  category?: string;
  brand?: string;
  description?: string;
  price: number;
  mrp?: number;
  stock?: number;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | string;
  prescriptionRequired?: boolean;
  packSize?: string;
  image?: string;
  isActive?: boolean;
}

export interface HealthcareService {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  price?: number;
  color?: string;
  route?: string;
}

export interface Review {
  id: string;
  vendorId: string;
  customerId?: string;
  customerName?: string;
  customerAvatar?: string;
  rating: number;
  date?: string;
  serviceName?: string;
  comment: string;
  reply?: { text: string; repliedAt?: string };
  /**
   * Approval flow — patient ke submit karte hi 'pending'; provider ke accept
   * karne par hi ye review public profile par dikhta hai.
   */
  status?: 'pending' | 'approved' | 'rejected';
}

/** GET /reviews/eligible/:vendorId — patient review de sakta hai ya nahi. */
export interface ReviewEligibility {
  eligible: boolean;
  hasCompletedBooking: boolean;
  completedBookingId?: string | null;
  /** Patient ka pehle se submit kiya review (pending/approved), agar ho. */
  myReview?: Review | null;
}

export interface VendorSlot {
  id?: string;
  vendorId: string;
  day: string;
  startTime: string;
  endTime: string;
  type: 'online' | 'home_visit' | 'all' | string;
  isBooked?: boolean;
  enabled?: boolean;
}

/**
 * Ek calendar date ke liye availability — backend working days + working hours
 * se slots generate karta hai aur already-booked slots hata deta hai.
 */
export interface AvailabilityDay {
  date: string; // YYYY-MM-DD
  weekday: string; // Monday, Tuesday…
  label: string; // Today / Tomorrow / weekday short
  isToday: boolean;
  working: boolean;
  slots: string[]; // available times, e.g. ['09:00 AM', '09:30 AM', …]
  bookedCount?: number;
}

export interface VendorAvailability {
  vendorId: string;
  timezone?: string;
  days: AvailabilityDay[];
}

export interface VendorStats {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  totalRevenue: number;
  avgRating: number;
  reviewCount: number;
  liveStatus: string;
  verificationStatus: string;
}

export interface EmergencySOS {
  id: string;
  vendorId?: string | null;
  requirement?: string;
  patientName: string;
  patientPhone: string;
  patientAge?: number;
  patientGender?: string;
  conditionDescription: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  severity?: 'critical' | 'high' | 'moderate' | string;
  status?: string;
  requestedAt?: string;
  etaMinutes?: number;
}

export interface EmergencySOSResponse {
  sos: EmergencySOS;
  assignedVendor: { id: string; name: string; type: string; phone: string } | null;
  etaMinutes: number;
}

export interface HospitalBed {
  id: string;
  hospitalId: string;
  hospitalName: string;
  totalGeneralBeds?: number;
  availableGeneralBeds?: number;
  totalIcuBeds?: number;
  availableIcuBeds?: number;
  totalOxygenBeds?: number;
  availableOxygenBeds?: number;
  ventilatorAvailable?: number;
  isolationBedsAvailable?: number;
  lastUpdated?: string;
}

export interface UserDashboard {
  user: User;
  stats: {
    totalBookings: number;
    activeBookings: number;
    completedVisits: number;
    prescriptionsCount: number;
    reportsCount: number;
  };
  bookings: Booking[];
  prescriptions: (Prescription & {
    bookingId: string;
    vendorName?: string;
    serviceName?: string;
  })[];
  labReports: {
    id: string;
    bookingId: string;
    testName: string;
    vendorName?: string;
    date?: string;
    status: 'ready' | 'processing' | string;
    sampleStatus?: string;
    /** Provider ki upload ki hui asli file (jab available ho). */
    fileUrl?: string;
    fileType?: string;
    notes?: string;
    downloadUrl?: string;
  }[];
}

export interface AuthResult {
  token: string;
  user: User;
  isProfileComplete?: boolean;
}

export interface DoctorQuery {
  specialty?: string;
  category?: string;
  homeVisit?: boolean;
  search?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  /** Staff type filter: doctor | compounder | nurse | caretaker | lab */
  type?: VendorType;
}

export interface VendorQuery {
  type?: VendorType;
  city?: string;
  emergencyOnly?: boolean;
  search?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface ListQuery {
  category?: string;
  search?: string;
  vendorId?: string;
}

export interface BookingQuery {
  vendorId?: string;
  userId?: string;
  status?: BookingStatus;
  serviceType?: ServiceType;
}

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * True jab backend par ye route abhi live nahi hai (404 / "route not found").
 * Naye features (jaise prescription credits) device-ledger fallback par
 * switch karne ke liye isse use karte hain — error user ko dikhana nahi hai.
 */
export function isMissingRoute(error: unknown): boolean {
  const status = (error as ApiError)?.statusCode;
  if (status === 404) {
    return true;
  }
  const message = ((error as Error)?.message || '').toLowerCase();
  return message.includes('route not found') || message.includes('not found');
}

/* -------------------------------------------------------------------------- */
/*  3. TOKEN + CORE REQUEST                                                    */
/* -------------------------------------------------------------------------- */

let authToken: string | null = null;

/** App start par token AsyncStorage se load karo. */
export async function initAuthToken(): Promise<string | null> {
  if (authToken) {
    return authToken;
  }
  try {
    authToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    authToken = null;
  }
  return authToken;
}

export function getAuthToken(): string | null {
  return authToken;
}

/** Login/Register ke baad token save karo. */
export async function setAuthToken(token: string | null): Promise<void> {
  authToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* storage error par in-memory token se kaam chalega */
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** Multipart uploads use their own boundary; don't JSON stringify these. */
  rawBody?: FormData;
  auth?: boolean;
}

function buildUrl(
  path: string,
  query?: RequestOptions['query'],
  host: string = activeHost,
): string {
  const base = `${host}/api/v1`;
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) {
    return url;
  }
  const params = Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`);
  return params.length ? `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}` : url;
}

/**
 * Ek host par attempt ka outcome.
 *
 * `kind: 'server'` — server ne jawab de diya (4xx/5xx). Ye FINAL hai, doosre
 * host ki zaroorat nahi (backend hi ye bol raha hai).
 * `kind: 'network'` — DNS block / host down / timeout → agla host try karo.
 */
type HostResult<T> =
  | { ok: true; data: T; host: string }
  | { ok: false; kind: 'network'; error: Error; timedOut: boolean; host: string }
  | { ok: false; kind: 'server'; error: ApiError; host: string };

/**
 * Ek host par ek attempt.
 *
 * Kabhi throw nahi karta — outcome hamesha `HostResult` me aata hai, taaki
 * caller ke paas ek hi failure path ho (aur rejection kabhi unhandled na
 * chhoode, jo request ko hamesha pending chhod deta tha).
 */
async function attemptHost<T>(
  host: string,
  path: string,
  query: RequestOptions['query'],
  init: RequestInit,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<HostResult<T>> {
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  /* Already-aborted signal par 'abort' event fire nahi hota — manually abort karo. */
  if (outerSignal?.aborted) {
    controller.abort();
  } else {
    outerSignal?.addEventListener('abort', onOuterAbort);
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query, host), {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = (error as Error)?.name === 'AbortError';
    console.warn(
      `[api] ${host} unreachable (${(error as Error)?.name}):`,
      (error as Error)?.message,
    );
    return { ok: false, kind: 'network', error: error as Error, timedOut, host };
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await response.json()) as ApiEnvelope<T>;
  } catch {
    json = null;
  }

  if (!response.ok || !json || json.success === false) {
    return {
      ok: false,
      kind: 'server',
      error: new ApiError(
        json?.message || `Request failed (${response.status})`,
        json?.statusCode || response.status,
      ),
      host,
    };
  }

  return { ok: true, data: json.data, host };
}

/** Saare hosts fail ho gaye → ek clear error banao. */
function networkError(failures: HostResult<unknown>[]): ApiError {
  const netFailures = failures.filter(
    (f): f is HostResult<unknown> & { ok: false; kind: 'network'; timedOut: boolean } =>
      !f.ok && f.kind === 'network',
  );
  const timedOut = netFailures.length > 0 && netFailures.every(f => f.timedOut);
  return new ApiError(
    timedOut
      ? 'Request timed out. Please check your connection.'
      : 'Unable to reach SloveCare server. Please try again.',
    0,
  );
}

/**
 * GET (idempotent) requests ke liye HEDGED host race.
 *
 * Pehla host turant chalta hai. Agla host do tarah se start hota hai:
 *   - pehla host FAIL ho jaye   → agla TURANT try hota hai,
 *   - pehla host HEDGE_DELAY tak jawab na de → agla PARALLEL chalu ho jata hai.
 *
 * Isse:
 *   - normal (healthy) case me sirf 1 hi request jati hai — koi extra load nahi,
 *   - ek dead/blocked host hone par user 20s (duplicate host hone par 40s) nahi,
 *     balki 1–3s me jawab mil jaata hai.
 */
async function raceHosts<T>(
  hosts: string[],
  path: string,
  query: RequestOptions['query'],
  init: RequestInit,
): Promise<T> {
  const losers = new AbortController();
  const failures: HostResult<unknown>[] = [];
  const started = new Set<number>();
  let winner: (HostResult<T> & { ok: true }) | null = null;
  let serverError: ApiError | null = null;
  let pending = 0;

  let settle: () => void = () => {};
  const finished = new Promise<void>(resolve => {
    settle = resolve;
  });

  const start = (index: number) => {
    if (winner || serverError || index >= hosts.length || started.has(index)) {
      return;
    }
    started.add(index);
    pending += 1;

    attemptHost<T>(hosts[index], path, query, init, REQUEST_TIMEOUT_MS, losers.signal).then(result => {
      pending -= 1;
      if (winner || serverError) {
        return; // pehle hi settle ho chuka hai
      }
      if (result.ok) {
        winner = result;
        losers.abort(); // jeet gaya — baaki pending requests rok do
        settle();
        return;
      }
      if (result.kind === 'server') {
        /* Server ne jawab de diya (4xx/5xx) — ye final hai, agle host ki
           zaroorat nahi (wahi backend ye bol raha hai). */
        serverError = result.error;
        settle();
        return;
      }
      failures.push(result);
      start(index + 1); // network fail → agla host TURANT
      if (pending === 0) {
        settle(); // koi host baki nahi
      }
    });
  };

  /* Pehla host turant; baaki hosts hedge timer se — pehla slow/dead lage to
     parallel chalu ho jaate hain. */
  start(0);
  const hedge = setInterval(() => {
    if (winner || serverError) {
      clearInterval(hedge);
      return;
    }
    start(started.size);
  }, HOST_HEDGE_DELAY_MS);

  await finished;
  clearInterval(hedge);

  /* `winner`/`serverError` closure ke andar set hote hain — TS yahan narrow
     nahi karta, isliye cast. */
  const win = winner as (HostResult<T> & { ok: true }) | null;
  if (win) {
    activeHost = win.host;
    return win.data;
  }
  const srvError = serverError as ApiError | null;
  if (srvError) {
    throw srvError;
  }
  throw networkError(failures);
}

/**
 * POST/PUT/PATCH/DELETE — sequential failover.
 *
 * Inme parallel race nahi kar sakte (double booking / double payment ka risk).
 * Total wait `REQUEST_TOTAL_BUDGET_MS` se bounded hai, taaki 3 dead hosts par
 * bhi user 60s na wait kare.
 */
async function failoverSequential<T>(
  hosts: string[],
  path: string,
  query: RequestOptions['query'],
  init: RequestInit,
): Promise<T> {
  const deadline = Date.now() + REQUEST_TOTAL_BUDGET_MS;
  const failures: HostResult<unknown>[] = [];

  for (const host of hosts) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    const result = await attemptHost<T>(
      host,
      path,
      query,
      init,
      Math.min(REQUEST_TIMEOUT_MS, remaining),
    );
    if (result.ok) {
      activeHost = host;
      return result.data;
    }
    if (result.kind === 'server') {
      /* Server ne jawab diya (4xx/5xx) — final, doosre host ki zaroorat nahi. */
      throw result.error;
    }
    failures.push(result);
  }

  throw networkError(failures);
}

/**
 * Ek hi generic request function — baaki saari API isi se guzarti hain.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, rawBody, query, headers = {}, auth = true } = options;

  if (auth && !authToken) {
    await initAuthToken();
  }

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined && !rawBody ? { 'Content-Type': 'application/json' } : {}),
    ...headers,
  };

  if (auth && authToken) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }

  const init: RequestInit = {
    method,
    headers: finalHeaders,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  };

  const hosts = hostList();
  const isIdempotent = method === 'GET';

  /* GET → hedged race (tej, resilient). Mutations → sequential failover. */
  return isIdempotent
    ? raceHosts<T>(hosts, path, query, init)
    : failoverSequential<T>(hosts, path, query, init);
}

/** Health check — backend online hai ya nahi. */
export function pingServer(): Promise<{ status: string }> {
  return request<{ status: string }>('', { auth: false }).catch(() =>
    request<{ status: string }>('/health', { auth: false }),
  );
}

/**
 * Prescription Reader ke liye host-failover fetch — ai.chat wala pattern
 * (lambi timeout, envelope parse) lekin payload privacy ke saath:
 * image/OCR text/patient data KABHI log nahi hota (sirf host + error name).
 */
async function prescriptionRequest<T>(
  path: string,
  initFactory: () => RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  if (!authToken) {
    await initAuthToken();
  }

  let lastFailure: unknown = null;
  const hosts = hostList();
  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${host}${path}`, {
        ...initFactory(),
        signal: controller.signal,
      });
      activeHost = host;

      let json: ApiEnvelope<T> | null = null;
      try {
        json = (await res.json()) as ApiEnvelope<T>;
      } catch {
        json = null;
      }

      if (!res.ok || !json || json.success === false) {
        // Server ka message user-friendly hai (OCR/AI failure reasons).
        throw new ApiError(
          json?.message ||
          (!res.ok
            ? `Prescription service error (${res.status}). Please try again.`
            : 'The prescription service returned an unexpected response. Please try again.'),
          json?.statusCode || res.status,
        );
      }
      return json.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error; // server jawab de chuka hai — doosre host ki zaroorat nahi
      }
      lastFailure = error;
      // Privacy: request/response content kabhi log nahi.
      console.warn(`[api] ${host}${path} unreachable:`, (error as Error)?.name);
    } finally {
      clearTimeout(timer);
    }
  }

  const aborted = (lastFailure as Error)?.name === 'AbortError';
  throw new ApiError(
    aborted
      ? timeoutMessage
      : 'Unable to reach SloveCare server. Please check your internet and try again.',
    0,
  );
}

/**
 * Diet Plan ke liye host-failover request — Gemini plan generation lamba
 * hota hai, isliye apni badi timeout. Privacy: preferences/health data
 * kabhi log nahi hota (sirf path + error name).
 */
async function dietRequest<T>(
  path: string,
  options: { method?: HttpMethod; body?: unknown; timeoutMs: number; timeoutMessage: string },
): Promise<T> {
  if (!authToken) {
    await initAuthToken();
  }
  const { method = 'GET', body, timeoutMs, timeoutMessage } = options;

  let lastFailure: unknown = null;
  const hosts = hostList();
  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch(`${host}${DIET_PLANS_PATH}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      activeHost = host;

      let json: ApiEnvelope<T> | null = null;
      try {
        json = (await res.json()) as ApiEnvelope<T>;
      } catch {
        json = null;
      }

      if (!res.ok || !json || json.success === false) {
        throw new ApiError(
          json?.message ||
          (!res.ok
            ? `Diet plan service error (${res.status}). Please try again.`
            : 'The diet plan service returned an unexpected response. Please try again.'),
          json?.statusCode || res.status,
        );
      }
      return json.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error; // server jawab de chuka hai — doosre host ki zaroorat nahi
      }
      lastFailure = error;
      console.warn(`[api] ${host}${DIET_PLANS_PATH}${path} unreachable:`, (error as Error)?.name);
    } finally {
      clearTimeout(timer);
    }
  }

  const aborted = (lastFailure as Error)?.name === 'AbortError';
  throw new ApiError(
    aborted ? timeoutMessage : 'Unable to reach SloveCare server. Please check your internet and try again.',
    0,
  );
}

/* -------------------------------------------------------------------------- */
/*  4. API — SAB KUCH EK HI FILE ME                                            */
/* -------------------------------------------------------------------------- */

export const api = {
  /* -------------------------------- AUTH --------------------------------- */
  auth: {
    /** POST /api/v1/auth/user/register */
    register(input: {
      name: string;
      email?: string;
      phone?: string;
      password?: string;
    }) {
      return request<AuthResult>('/auth/user/register', {
        method: 'POST',
        body: input,
        auth: false,
      });
    },

    /** POST /api/v1/auth/user/login */
    login(input: { identifier: string; password: string }) {
      return request<AuthResult>('/auth/user/login', {
        method: 'POST',
        body: input,
        auth: false,
      });
    },

    /** POST /api/v1/auth/user/google — Google ID token verify karke sign in / sign up */
    google(input: { credential: string }) {
      return request<AuthResult>('/auth/user/google', {
        method: 'POST',
        body: input,
        auth: false,
      });
    },

    /** POST /api/v1/auth/user/phone-send-otp — OTP bhejo (abhi demo OTP 1234) */
    phoneSendOtp(input: { phone: string }) {
      return request<{ phone: string; expiresInMinutes: number }>('/auth/user/phone-send-otp', {
        method: 'POST',
        body: input,
        auth: false,
      });
    },

    /** POST /api/v1/auth/user/phone-login — OTP verify karke JWT (naye number par account auto-create) */
    phoneLogin(input: { phone: string; otp: string }) {
      return request<AuthResult>('/auth/user/phone-login', {
        method: 'POST',
        body: input,
        auth: false,
      });
    },

    /** GET /api/v1/auth/me (Bearer token required) */
    me() {
      return request<User>('/auth/me');
    },

    /** PUT /api/v1/auth/user/health-profile */
    updateHealthProfile(profile: HealthProfile & { name?: string; avatar?: string }) {
      return request<User>('/auth/user/health-profile', {
        method: 'PUT',
        body: profile,
      });
    },

    /** PUT /api/v1/auth/user/avatar — profile photo ka Cloudinary URL save karo */
    updateAvatar(avatar: string) {
      return request<User>('/auth/user/avatar', {
        method: 'PUT',
        body: { avatar },
      });
    },

    /** GET /api/v1/auth/user/dashboard-data — user + bookings + reports */
    dashboard() {
      return request<UserDashboard>('/auth/user/dashboard-data');
    },
  },

  /* ------------------------------ DOCTORS -------------------------------- */
  doctors: {
    /** GET /api/v1/doctors — public staff directory (doctor/compounder/nurse/caretaker, rejected chhod kar) */
    list(query: DoctorQuery = {}) {
      return request<Doctor[]>('/doctors', {
        query: {
          specialty: query.specialty,
          category: query.category,
          homeVisit: query.homeVisit ? 'true' : undefined,
          search: query.search,
          lat: query.lat,
          lng: query.lng,
          radiusKm: query.radiusKm,
          type: query.type,
        },
        auth: false,
        /* Backend par seeded demo doctors abhi bhi hain (delete route nahi
           hai) — patient ki listing me woh dikhne nahi chahiye. */
      }).then(withoutDemoVendors);
    },

    /** GET /api/v1/doctors/consultations/:vendorId */
    consultations(vendorId: string) {
      return request<Booking[]>(`/doctors/consultations/${vendorId}`, { auth: false });
    },
  },

  /* ------------------------------- VENDORS ------------------------------- */
  vendors: {
    /** GET /api/v1/vendors — public listing with filters */
    list(query: VendorQuery = {}) {
      return request<Vendor[]>('/vendors', {
        query: {
          type: query.type,
          city: query.city,
          emergencyOnly: query.emergencyOnly ? 'true' : undefined,
          search: query.search,
          lat: query.lat,
          lng: query.lng,
          radiusKm: query.radiusKm,
        },
        auth: false,
        /* Seeded demo staff (doctors/compounders/caretakers) chhupaye jaate
           hain — labs is filter se guzarte hain. */
      }).then(withoutDemoVendors);
    },

    /** GET /api/v1/vendors/:id — details + reviews + booking count */
    byId(id: string) {
      return request<Vendor>(`/vendors/${id}`, { auth: false });
    },

    /** GET /api/v1/vendors/:id/slots — provider working schedule */
    slots(id: string) {
      return request<VendorSlot[]>(`/vendors/${id}/slots`, { auth: false });
    },

    /**
     * GET /api/v1/vendors/:id/availability?days=14
     * Working days (doctor 5 days kaam kare to sirf wahi dates) + working hours
     * se slots, already-booked aur past slots exclude karke.
     */
    availability(id: string, days = 14) {
      return request<VendorAvailability>(`/vendors/${id}/availability`, {
        // Client ka UTC offset — "aaj ke past slots" user ke timezone me filter honge.
        query: { days, offset: -new Date().getTimezoneOffset() },
        auth: false,
      });
    },

    /** GET /api/v1/vendors/:vendorId/reviews */
    reviews(vendorId: string) {
      return request<Review[]>(`/vendors/${vendorId}/reviews`, { auth: false });
    },

    /** GET /api/v1/vendors/:id/stats */
    stats(id: string) {
      return request<VendorStats>(`/vendors/${id}/stats`, { auth: false });
    },
  },

  /* ------------------------------- BOOKINGS ------------------------------ */
  bookings: {
    /** POST /api/v1/bookings */
    create(payload: CreateBookingPayload) {
      return request<Booking>('/bookings', { method: 'POST', body: payload });
    },

    /** GET /api/v1/bookings?userId=&status=&serviceType=
     * Auth ZAROORI — backend protect() ke peeche hai aur token se hi scope
     * (patient = apni bookings, vendor = apni) tay hota hai. */
    list(query: BookingQuery = {}) {
      return request<Booking[]>('/bookings', {
        query: {
          userId: query.userId,
          status: query.status,
          serviceType: query.serviceType,
          vendorId: query.vendorId,
        },
      });
    },

    /** GET /api/v1/bookings/:id — token owner hi booking dekh sakta hai. */
    byId(id: string) {
      return request<Booking>(`/bookings/${id}`);
    },

    /** PATCH /api/v1/bookings/:id/status */
    updateStatus(id: string, status: BookingStatus, extra: Record<string, unknown> = {}) {
      return request<Booking>(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: { status, ...extra },
      });
    },

    /** POST /api/v1/bookings/:id/prescription */
    attachPrescription(id: string, prescription: Omit<Prescription, 'id' | 'bookingId'>) {
      return request<Booking>(`/bookings/${id}/prescription`, {
        method: 'POST',
        body: prescription,
      });
    },
  },

  /* -------------------------------- PAYMENTS ----------------------------- */
  payments: {
    /**
     * POST /api/v1/payments/create-order — booking validate + SERVER-side
     * price check ke baad Razorpay order banta hai. `requiresPayment:false`
     * = free booking (seedha confirmed).
     */
    createOrder(payload: CreateBookingPayload) {
      return request<PaymentOrderResult>('/payments/create-order', {
        method: 'POST',
        body: payload,
      });
    },

    /**
     * POST /api/v1/payments/verify — HMAC signature + Razorpay API status,
     * dono backend par check hoke booking confirm hoti hai (double verify).
     * Idempotent hai — do baar call karne par bhi same result.
     */
    verify(input: PaymentSignature & { bookingId: string }) {
      return request<PaymentVerifyResult>('/payments/verify', {
        method: 'POST',
        body: input,
      });
    },
  },

  /* ------------------------------ CONSULTATIONS --------------------------- */
  /**
   * Video calling + live chat ke backend endpoints.
   * Auth: Bearer token (patient) — server booking ownership verify karta hai.
   * Socket events: src/consultation/* (contract docs/consultations/BACKEND_SPEC.md).
   */
  consultations: {
    /**
     * GET /consultations/rtc-config — STUN/TURN servers + temporary TURN
     * credentials. SECRET TURN credentials app me kabhi nahi aate.
     */
    rtcConfig() {
      return request<ConsultationRtcConfig>('/consultations/rtc-config');
    },

    /** GET /consultations/:bookingId — session status, expiry, peer info. */
    session(bookingId: string) {
      return request<ChatSessionInfo>(`/consultations/${bookingId}`);
    },

    /** GET /consultations/:bookingId/messages?before=&limit= — paginated history. */
    messages(bookingId: string, query: { before?: string; limit?: number } = {}) {
      return request<ConsultationMessage[]>(`/consultations/${bookingId}/messages`, {
        query: { before: query.before, limit: query.limit },
      });
    },
  },

  /* ------------------------------ EMERGENCY ------------------------------ */
  emergency: {
    /** POST /api/v1/emergency/sos — nearest responder auto-assign */
    triggerSOS(payload: {
      patientName: string;
      patientPhone: string;
      patientAge?: number;
      patientGender?: string;
      conditionDescription: string;
      requirement?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      severity?: 'critical' | 'high' | 'moderate';
    }) {
      return request<EmergencySOSResponse>('/emergency/sos', {
        method: 'POST',
        body: payload,
      });
    },

    /** GET /api/v1/emergency/active */
    active(query: { vendorId?: string; status?: string } = {}) {
      return request<EmergencySOS[]>('/emergency/active', {
        query: { vendorId: query.vendorId, status: query.status },
        auth: false,
      });
    },
  },

  /* ------------------------------ LAB TESTS ------------------------------ */
  labTests: {
    /** GET /api/v1/lab-tests?category=&search=&vendorId= */
    list(query: ListQuery = {}) {
      return request<LabTest[]>('/lab-tests', {
        query: { category: query.category, search: query.search, vendorId: query.vendorId },
        auth: false,
      });
    },
  },

  /* ------------------------------- PHARMACY ------------------------------ */
  medicines: {
    /** GET /api/v1/medicines?category=&search=&vendorId= */
    list(query: ListQuery = {}) {
      return request<Medicine[]>('/medicines', {
        query: { category: query.category, search: query.search, vendorId: query.vendorId },
        auth: false,
      });
    },
  },

  /* ---------------------------------- AI --------------------------------- */
  ai: {
    /**
     * POST /api/v1/ai/chat — Slota AI (hamara backend, teen-layer: local KB +
     * free Gemini + learning log). Response shape `{ reply }` hota hai
     * (envelope nahi), isliye direct fetch.
     */
    async chat(messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
      let lastFailure: unknown = null;

      /**
       * Ek host par ek attempt. Network-level fail (DNS block, host down) ho
       * to `null` lautata hai — caller doosra host try karta hai. Server ka
       * response (chaahe 4xx/5xx) mila to seedha throw — host chal raha tha.
       */
      const attempt = async (host: string): Promise<string | null> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000); // LLM thoda slow ho sakta hai
        try {
          const res = await fetch(`${host}${AI_CHAT_PATH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ messages }),
            signal: controller.signal,
          });
          activeHost = host; // ye host chal raha hai — aage isi se
          // Body HTML/text ho sakta hai (Vercel error page) — parse fail par
          // "Unable to reach" na dikhaye, status ke saath clear message do.
          let json: { reply?: string; error?: string; message?: string } | null = null;
          try {
            json = (await res.json()) as { reply?: string; error?: string; message?: string };
          } catch {
            json = null;
          }
          const reply = json?.reply;
          if (!res.ok || !reply) {
            const serverMessage = json?.error || json?.message;
            throw new ApiError(
              serverMessage ||
              (json
                ? 'AI assistant is busy right now. Please try again.'
                : `AI assistant returned an unexpected response (${res.status}). Please try again.`),
              res.status,
            );
          }
          return reply;
        } catch (error) {
          if (error instanceof ApiError) {
            throw error;
          }
          lastFailure = error;
          console.warn(
            `[api] ${host}${AI_CHAT_PATH} unreachable:`,
            (error as Error)?.message,
          );
          return null;
        } finally {
          clearTimeout(timer);
        }
      };

      /* Host failover: active host → baaki hosts (kuch networks vercel.app block karte hain).
         Server ka response mila to `attempt` khud throw kar deta hai — failover bekar hai. */
      for (const host of hostList()) {
        const reply = await attempt(host);
        if (reply) {
          return reply;
        }
      }

      const aborted = (lastFailure as Error)?.name === 'AbortError';
      throw new ApiError(
        aborted
          ? 'AI assistant took too long to reply. Please try again.'
          : 'Unable to reach the AI assistant. Check your internet and try again.',
        0,
      );
    },
  },

  /* ------------------------------- SERVICES ------------------------------ */
  services: {
    /** GET /api/v1/services?category=&search= */
    list(query: { category?: string; search?: string } = {}) {
      return request<HealthcareService[]>('/services', {
        query: { category: query.category, search: query.search },
        auth: false,
      });
    },
  },

  /* ------------------------------- HOSPITALS ----------------------------- */
  hospitals: {
    /** GET /api/v1/hospitals/beds — live bed availability */
    beds(query: { hospitalId?: string } = {}) {
      return request<HospitalBed[]>('/hospitals/beds', {
        query: { hospitalId: query.hospitalId },
        auth: false,
      });
    },
  },

  /* -------------------------------- REVIEWS ------------------------------ */
  reviews: {
    /**
     * POST /api/v1/reviews — patient ka review. Backend par ye 'pending'
     * banta hai; provider accept karega tabhi wo profile par public hoga.
     * Sirf completed booking wale patient ye kar sakte hain.
     */
    add(payload: {
      vendorId: string;
      rating: number;
      comment: string;
      bookingId?: string;
      customerName?: string;
      customerAvatar?: string;
      serviceName?: string;
    }) {
      return request<Review>('/reviews', { method: 'POST', body: payload });
    },

    /** GET /api/v1/reviews/mine — logged-in patient ke apne diye reviews. */
    mine() {
      return request<Review[]>('/reviews/mine');
    },

    /** GET /api/v1/reviews/eligible/:vendorId — review ka permission + mera review. */
    eligibility(vendorId: string) {
      return request<ReviewEligibility>(`/reviews/eligible/${vendorId}`);
    },
  },

  /* -------------------------------- UPLOADS ------------------------------ */
  uploads: {
    /** POST /api/v1/upload/image — image picker result ko multipart me bheje. */
    image(file: { uri: string; name?: string; type?: string }) {
      const form = new FormData();
      form.append('image', {
        uri: file.uri,
        name: file.name ?? 'image.jpg',
        type: file.type ?? 'image/jpeg',
      } as unknown as Blob);
      return request<{ url: string; path?: string; filename?: string }>('/upload/image', {
        method: 'POST',
        rawBody: form,
      });
    },
  },

  /* --------------------------- PRESCRIPTION READER ----------------------- */
  /**
   * Prescription Reader — do step ka flow (asli loading stages ke liye):
   *   1. `ocr()`     image → PaddleOCR microservice → structured OCR text
   *   2. `analyze()` OCR text → EXISTING Gemini integration → analysis JSON
   * Image/OCR text backend par store nahi hoti (memory only).
   */
  prescription: {
    /** Step 1 — prescription ki photo par PaddleOCR chalata hai. */
    ocr(file: { uri: string; name?: string; type?: string }): Promise<PrescriptionOcrResult> {
      return prescriptionRequest<PrescriptionOcrResult>(
        PRESCRIPTION_OCR_PATH,
        () => {
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
          }
          const form = new FormData();
          form.append(
            'image',
            {
              uri: file.uri,
              name: file.name ?? 'prescription.jpg',
              type: file.type ?? 'image/jpeg',
            } as unknown as Blob,
          );
          return { method: 'POST', headers, body: form };
        },
        60000, // OCR (image upload + PaddleOCR) ko zyada time lag sakta hai
        'Reading the prescription took too long. Please try again with a clearer photo.',
      );
    },

    /** Step 2 — extracted OCR text ko existing Gemini API se analyze karwata hai. */
    analyze(ocr: PrescriptionOcrResult): Promise<PrescriptionAnalysisResult> {
      return prescriptionRequest<PrescriptionAnalysisResult>(
        PRESCRIPTION_ANALYZE_PATH,
        () => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          };
          if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
          }
          return { method: 'POST', headers, body: JSON.stringify({ ocr }) };
        },
        50000,
        'The AI analysis took too long. Please try again.',
      );
    },

    /* ----------------------- credits (3 free → ₹19 / 10 reads) ------------- */

    /**
     * GET /prescription/quota — user ka credit balance.
     * Backend route live hone par ye server-authoritative ho jaata hai;
     * route na hone par caller device ledger par fallback kar leta hai.
     */
    quota(): Promise<PrescriptionQuota> {
      return prescriptionRequest<PrescriptionQuota>(
        PRESCRIPTION_QUOTA_PATH,
        () => {
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
          }
          return { method: 'GET', headers };
        },
        15000,
        'Could not check your prescription reads. Please try again.',
      );
    },

    /**
     * POST /prescription/create-order — Razorpay order for the 10-read pack
     * (₹19). Server amount decide karta hai, client tamper nahi kar sakta.
     */
    createCreditOrder(): Promise<PrescriptionCreditOrder> {
      return prescriptionRequest<PrescriptionCreditOrder>(
        PRESCRIPTION_CREDIT_ORDER_PATH,
        () => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          };
          if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
          }
          return { method: 'POST', headers, body: JSON.stringify({ pack: 'reads10', quantity: 1 }) };
        },
        20000,
        'Could not start payment. Please try again.',
      );
    },

    /**
     * POST /prescription/verify — Razorpay signature verify + 10 reads grant.
     * Server side idempotent hai (same order dobara verify ho to double
     * credit nahi milta).
     */
    verifyCreditPayment(input: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }): Promise<{ verified: boolean; paidCredits?: number }> {
      return prescriptionRequest<{ verified: boolean; paidCredits?: number }>(
        PRESCRIPTION_CREDIT_VERIFY_PATH,
        () => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          };
          if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
          }
          return { method: 'POST', headers, body: JSON.stringify(input) };
        },
        20000,
        'Payment verification failed. Please try again.',
      );
    },
  },

  /* --------------------------- AI WEEKLY DIET PLANNER -------------------- */
  /**
   * Diet Planner — preferences → backend (existing Gemini integration) →
   * validated 7-day plan. Har plan Mongo me alag document hai (history);
   * duplicate taps backend par reuse se bachte hain.
   */
  dietPlans: {
    /** POST /diet-plans/generate — Gemini se naya 7-day plan banwao. */
    generate(preferences: DietPlanPreferences, weekStart?: string): Promise<DietPlan> {
      return dietRequest<DietPlan>('/generate', {
        method: 'POST',
        body: {
          preferences,
          weekStart,
          /* Client timezone — backend usi se "is hafte ka Monday" nikaalta hai. */
          offsetMinutes: -new Date().getTimezoneOffset(),
        },
        timeoutMs: 90000, // Gemini plan lamba hota hai — server ~60s me jawab deta hai
        timeoutMessage: 'Building your diet plan took too long. Please try again.',
      });
    },

    /** GET /diet-plans — user ki plan history (light list, newest first). */
    list(): Promise<DietPlanListItem[]> {
      return dietRequest<DietPlanListItem[]>('', {
        timeoutMs: 25000,
        timeoutMessage: 'Loading your diet plans took too long. Please try again.',
      });
    },

    /** GET /diet-plans/preferences — saved snapshot (form prefill). */
    getPreferences(): Promise<{ preferences: DietPlanPreferences | null }> {
      return dietRequest<{ preferences: DietPlanPreferences | null }>('/preferences', {
        timeoutMs: 20000,
        timeoutMessage: 'Loading your saved preferences took too long.',
      });
    },

    /** PUT /diet-plans/preferences — snapshot save/update. */
    savePreferences(preferences: DietPlanPreferences): Promise<{ preferences: DietPlanPreferences }> {
      return dietRequest<{ preferences: DietPlanPreferences }>('/preferences', {
        method: 'PUT',
        body: { preferences },
        timeoutMs: 20000,
        timeoutMessage: 'Saving your preferences took too long. Please try again.',
      });
    },

    /** GET /diet-plans/:id — poora plan (sirf apna). */
    byId(id: string): Promise<DietPlan> {
      return dietRequest<DietPlan>(`/${encodeURIComponent(id)}`, {
        timeoutMs: 25000,
        timeoutMessage: 'Loading this diet plan took too long. Please try again.',
      });
    },

    /** PATCH /diet-plans/:id/completion — meal checkbox persist. */
    complete(
      planId: string,
      key: string,
      done: boolean,
    ): Promise<{ key: string; done: boolean; completion: Record<string, boolean> }> {
      return dietRequest<{ key: string; done: boolean; completion: Record<string, boolean> }>(
        `/${encodeURIComponent(planId)}/completion`,
        { method: 'PATCH', body: { key, done }, timeoutMs: 20000, timeoutMessage: 'Could not save your meal progress.' },
      );
    },

    /** DELETE /diet-plans/:id — apna plan delete. */
    remove(id: string): Promise<{ deleted: boolean; id: string }> {
      return dietRequest<{ deleted: boolean; id: string }>(`/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        timeoutMs: 20000,
        timeoutMessage: 'Deleting this plan took too long. Please try again.',
      });
    },

    /**
     * GET /diet-plans/subscription-status — is hafte ka plan/payment status.
     * Server-authoritative: `requiresPayment` batata hai ki payment lagti hai
     * ya nahi (pehla week free hota hai).
     */
    subscriptionStatus(): Promise<DietPlanSubscriptionStatus> {
      return dietRequest<DietPlanSubscriptionStatus>('/subscription-status', {
        timeoutMs: 20000,
        timeoutMessage: 'Could not check your plan status. Please try again.',
      });
    },

    /**
     * POST /diet-plans/create-order — Razorpay order for weekly diet plan
     * subscription (₹9/week, pehla week free).
     *
     * Server decide karta hai:
     *   - `requiresPayment:false` → pehla week free ya already paid
     *   - `requiresPayment:true`  → Razorpay order (keyId/orderId/amount)
     */
    createPaymentOrder(weekStart?: string): Promise<DietPlanOrderResult> {
      return dietRequest<DietPlanOrderResult>('/create-order', {
        method: 'POST',
        body: {
          weekStart,
          /* Client timezone — backend usi se "is hafte ka Monday" nikaalta hai. */
          offsetMinutes: -new Date().getTimezoneOffset(),
        },
        timeoutMs: 20000,
        timeoutMessage: 'Could not start payment. Please try again.',
      });
    },

    /**
     * POST /diet-plans/verify — verify Razorpay payment signature for
     * diet plan subscription. Idempotent — dobara call karne par bhi safe.
     */
    verifyPayment(input: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }): Promise<DietPlanVerifyResult> {
      return dietRequest<DietPlanVerifyResult>('/verify', {
        method: 'POST',
        body: input,
        timeoutMs: 20000,
        timeoutMessage: 'Payment verification failed. Please try again.',
      });
    },
  },
};

export default api;
