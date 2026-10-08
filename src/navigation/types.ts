import { NavigatorScreenParams } from '@react-navigation/native';
import { LabTest, Medicine } from '../api/api';

/** Staff type — Doctors tab ke filter/chips ke liye. */
export type StaffType = 'doctor' | 'compounder' | 'nurse' | 'caretaker';

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
