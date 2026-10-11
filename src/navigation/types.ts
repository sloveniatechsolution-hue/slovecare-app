import { NavigatorScreenParams } from '@react-navigation/native';
import { DietPlan, LabTest, Medicine } from '../api/api';

/** Staff type — Doctors tab ke filter/chips ke liye. */
export type StaffType = 'doctor' | 'compounder' | 'nurse' | 'caretaker' | 'lab';

/** Saare app routes — typed navigation ke liye. */
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  DoctorDetail: { doctorId: string };
  Booking:
    | { mode: 'doctor'; doctorId: string }
    | { mode: 'lab'; test: LabTest }
    // Medicines segment ab disabled hai (Care Takers ne replace kiya) —
    // purana mode wapas chahiye to neeche uncomment kar dena.
    | { mode: 'medicine'; items: Medicine[]; total: number };
  Appointments: undefined;
  Emergency: undefined;
  HealthProfile: undefined;
  LabReports: undefined;
  Services: undefined;
  /** Prescription Reader — photo → PaddleOCR → Gemini analysis. */
  PrescriptionReader: undefined;
  /** AI Weekly Diet Planner — multi-step form → Gemini 7-day plan. */
  DietPlanner: undefined;
  /**
   * Diet plan results — planId = server se load karo, plan = generate ke
   * baad seedha render (dubara fetch nahi).
   */
  DietPlanResult: { planId?: string; plan?: DietPlan } | undefined;
  /* ---------------- video/chat consultation (WebRTC + Socket.IO) ------------- */
  /** Consultation booking + Razorpay payment (mode video | chat). */
  ConsultationBook: { doctorId: string; mode: 'video' | 'chat' };
  /** Meri consultations list — join buttons ke saath. */
  MyConsultations: undefined;
  /** WebRTC video call room — bookingId = authorized room. */
  VideoCall: { bookingId: string; peerName?: string };
  /** Paid live chat room — server-persisted messages. */
  ChatRoom: { bookingId: string; peerName?: string };
};

export type TabParamList = {
  Home: undefined;
  /**
   * type  = care takers/doctors wale chips pre-select karne ke liye
   * openedAt = quick action ka har tap = nayi "intent" (React Navigation same
   *            params ko merge kar deta hai, isliye filter tab bhi apply ho
   *            jab type pehle se wahi ho)
   */
  Doctors: { type?: StaffType; openedAt?: number } | undefined;
  Labs: undefined;
  /* Pharmacy tab hata diya — ab Slota AI assistant tab hai. */
  AI: undefined;
  Profile: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
