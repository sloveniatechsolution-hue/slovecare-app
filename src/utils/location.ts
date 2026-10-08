/**
 * Location helper — permission maang kar current coordinates deta hai.
 *
 * Doctors list (distance filter / "Nearest first") aur NearbyMap dono isi se
 * chalte hain. Do cheezein zaroori hain, warna location puchhi nahi jaati:
 *
 *  - Android: `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` manifest me
 *    declared hone chahiye — warna `PermissionsAndroid.request` dialog dikhaye
 *    bina hi deny kar deta hai aur hum fallback (Jaipur) par reh jaate hain.
 *  - iOS: Info.plist ka `NSLocationWhenInUseUsageDescription` + pehle
 *    `requestAuthorization()` (warna getCurrentPosition silent fail hota hai).
 *
 * Location na mile to `null` — caller fallback ke saath chal leta hai.
 */

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

export interface LatLng {
  lat: number;
  lng: number;
}

const ANDROID_DIALOG = {
  title: 'Location permission',
  message: 'SloveCare uses your location to find care providers near you and sort them by distance.',
  buttonPositive: 'Allow',
  buttonNegative: 'Deny',
};

export async function requestLocation(): Promise<LatLng | null> {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ANDROID_DIALOG,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return null;
      }
    }

    const Geolocation = require('@react-native-community/geolocation').default;

    /* iOS: pehle authorization prompt, warna position kabhi aati hi nahi. */
    if (Platform.OS === 'ios') {
      await new Promise<void>(resolve => {
        Geolocation.requestAuthorization(
          () => resolve(),
          () => resolve(),
        );
      });
    }

    return await new Promise<LatLng | null>(resolve => {
      Geolocation.getCurrentPosition(
        (pos: { coords: { latitude: number; longitude: number } }) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      );
    });
  } catch {
    return null;
  }
}

export default requestLocation;

/**
 * Detect button dabane par purana cached location na aa jaye — fresh GPS maango.
 * Mount wale auto-detect ke liye `maximumAge` 60s theek hai (turant list aati hai),
 * par manual detect par user "abhi wali" location chahta hai.
 */
export async function requestFreshLocation(): Promise<LatLng | null> {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ANDROID_DIALOG,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return null;
      }
    }
    const Geolocation = require('@react-native-community/geolocation').default;
    if (Platform.OS === 'ios') {
      await new Promise<void>(resolve => {
        Geolocation.requestAuthorization(
          () => resolve(),
          () => resolve(),
        );
      });
    }
    return await new Promise<LatLng | null>(resolve => {
      Geolocation.getCurrentPosition(
        (pos: { coords: { latitude: number; longitude: number } }) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Reverse geocode — "kahan track hua" ka naam                                 */
/* -------------------------------------------------------------------------- */

/** Same coordinates par dobara naache — Nominatim ka 1 req/sec rule. */
const labelCache = new Map<string, Promise<string | null>>();
const roundKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

/**
 * Nominatim (OSM) reverse geocode → short place label.
 * Key-less (waise hi OSM tiles already use kar rahe hain). Fail → null,
 * caller "Location detected" wale copy ke saath reh jaata hai.
 */
export function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = roundKey(lat, lng);
  const cached = labelCache.get(key);
  if (cached) {
    return cached;
  }

  const job = (async (): Promise<string | null> => {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1` +
        `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=en`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SloveCare/1.0 (home healthcare app)' },
      });
      clearTimeout(timer);
      if (!res.ok) {
        return null;
      }
      const json = (await res.json()) as { address?: Record<string, string> } | null;
      const a = json?.address || {};
      const locality =
        a.suburb || a.neighbourhood || a.quarter || a.hamlet || a.village || a.town || a.city_district;
      const city = a.city || a.town || a.county || a.state_district;
      const state = a.state;

      const parts: string[] = [];
      for (const p of [locality, city, state]) {
        if (p && !parts.some(x => x.toLowerCase() === p.toLowerCase())) {
          parts.push(p);
        }
      }
      const label = parts.slice(0, 3).join(', ');
      return label || (json as { display_name?: string } | null)?.display_name || null;
    } catch {
      return null;
    }
  })();

  labelCache.set(key, job);
  return job;
}

/**
 * Location fail hone par (permission denied / GPS off) yeh alert dikhao —
 * Android par dobara deny karne ke baad system dialog band ho jaata hai,
 * tabhi user ko seedha app Settings tak le jaana padta hai.
 */
export function locationHelpAlert(): void {
  Alert.alert(
    'Location permission needed',
    'Location allow nahi hai (ya GPS off hai), isliye distance filter aur "nearest first" kaam nahi kar payega. Settings me SloveCare ke liye location allow karein.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          Linking.openSettings().catch(() => undefined);
        },
      },
    ],
  );
}
