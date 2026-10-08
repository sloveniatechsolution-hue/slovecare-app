/**
 * Google Sign-In (native) — @react-native-google-signin/google-signin.
 *
 * Sign-in par ek Google ID token milta hai, jise backend
 * `POST /auth/user/google` verify karke JWT deta hai (asli Google login).
 *
 * SETUP (ek baar — Google Cloud Console me):
 *  1. APIs & Services → Credentials → Create credentials → OAuth client ID:
 *     - Android client: package name `com.slovecare` + SHA1 fingerprint
 *       (debug ke liye: keytool se debug keystore ka SHA1, release ke liye
 *       release keystore ka) — sign-in sheet ke liye chahiye.
 *     - Web client: ID token ke liye — neeche GOOGLE_WEB_CLIENT_ID me daalo,
 *       aur wahi value backend `.env` me `GOOGLE_CLIENT_ID` me bhi daalo.
 *  2. OAuth consent screen me test users me apna email add karo (jab tak
 *     app publish nahi hota).
 *
 * Note: `webClientId` JS se hi pass hota hai — google-services.json ki
 * zaroorat nahi hai.
 */

import { GoogleSignin } from '@react-native-google-signin/google-signin';

/** Google Cloud → OAuth client ID (type: Web application). Isi se ID token banta hai. */
export const GOOGLE_WEB_CLIENT_ID = '855960380489-siduqd86i631a3i35o31932hsluf8l0e.apps.googleusercontent.com';

const isConfigured = (): boolean =>
  Boolean(GOOGLE_WEB_CLIENT_ID) && !GOOGLE_WEB_CLIENT_ID.startsWith('PASTE_YOUR_');

let configured = false;

function ensureConfigured(): void {
  if (configured) {
    return;
  }
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

/** User ne sign-in sheet band ki — ye error dikhane layak nahi hai. */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in cancelled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

/**
 * Google account picker kholta hai. Success par ID token return karta hai
 * jo backend me bhejna hai. User cancel kare toh GoogleSignInCancelledError.
 */
export async function signInWithGoogle(): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      'Google login abhi configured nahi hai. src/api/googleAuth.ts me GOOGLE_WEB_CLIENT_ID daalein.',
    );
  }

  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();

  if (response.type === 'cancelled') {
    throw new GoogleSignInCancelledError();
  }
  if (response.type !== 'success' || !response.data?.idToken) {
    throw new Error('Google sign-in se ID token nahi mila. GOOGLE_WEB_CLIENT_ID check karein.');
  }

  return response.data.idToken;
}

/** Native error ko samajhne layak message me badalta hai (debug me kaam aata hai). */
export function describeGoogleError(error: unknown): string {
  const raw = (error as Error)?.message || '';
  const lower = raw.toLowerCase();

  if (
    lower.includes('developer_error') ||
    lower.includes('code: 10') ||
    lower.includes('code 10') ||
    lower.includes('10:')
  ) {
    return (
      'Google sign-in setup adhoora hai: Google Cloud Console me `com.slovecare` package ' +
      '+ SHA1 wala Android OAuth client aur Web client ID add karein.'
    );
  }
  if (lower.includes('play services') || lower.includes('play-services')) {
    return 'Is device par Google Play Services update karein, phir dobara try karein.';
  }
  return raw || 'Google sign-in failed. Please try again.';
}

/** Sign-out — logout ke waqt taaki agli baar account picker me purana na aaye. */
export async function signOutFromGoogle(): Promise<void> {
  try {
    if (configured || isConfigured()) {
      ensureConfigured();
      await GoogleSignin.signOut();
    }
  } catch {
    // best-effort — Google sign-out fail hone par local logout chal jaata hai
  }
}
