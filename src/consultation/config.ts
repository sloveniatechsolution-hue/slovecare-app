/**
 * Consultation config — WebRTC + real-time (Socket.IO) settings dono apps ke
 * liye isi jagah se control hote hain.
 *
 * Kuch bhi hardcode nahi kiya gaya:
 *   - Socket URL  → API_HOSTS (api.ts) se derive hota hai + developer apna
 *                    override daal sakta hai (AWS realtime server, local dev).
 *   - ICE servers → backend se `GET /api/v1/consultations/rtc-config` aate
 *                    hain (temporary TURN credentials yahin se milte hain).
 *                    Fallback: free public STUN (bina TURN ke connectivity
 *                    limited ho sakti hai — docs dekhein).
 *
 * Environment / deployment (developer ke liye):
 *   API_BASE_URL           → api.ts me API_HOSTS
 *   WEBSOCKET_URL          → SOCKET_URL_OVERRIDES me daalein (e.g. wss://realtime.slovecare.in)
 *   WEBRTC_STUN_URLS       → backend /consultations/rtc-config se
 *   TURN_SERVER_URL        → backend /consultations/rtc-config se
 *   TURN_USERNAME/CREDENTIAL → backend temporary credentials (app me kabhi nahi)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_HOSTS } from '../api/api';
import type { ConsultationRtcConfig, RtcIceServer } from './types';

/**
 * Realtime server ke extra URLs (backend API ke alag host par ho to).
 * Example: ['wss://realtime.slovecare.in'] ya dev me ['ws://10.0.2.2:4000'].
 * Empty rehne par API_HOSTS ke origins use hote hain (same domain, /socket.io).
 */
export const SOCKET_URL_OVERRIDES: string[] = [];

/** Socket.IO default path — backend isi path par mount kare. */
export const SOCKET_PATH = '/socket.io';

/** Default public STUN — rtc-config fail hone par fallback (TURN nahi hai). */
export const DEFAULT_STUN_URLS: string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];

/** rtc-config ki cache — 6 ghante (TURN credentials usually 12-24h se chhote hote hain). */
const RTC_CONFIG_TTL_MS = 6 * 60 * 60 * 1000;
const RTC_CONFIG_CACHE_KEY = 'slovecare_rtc_config_v1';

let rtcConfigCache: { config: ConsultationRtcConfig; fetchedAt: number } | null = null;

/** Socket URL candidates — pehle overrides, phir API hosts (failover order). */
export function socketUrlCandidates(): string[] {
  const fromApi = API_HOSTS.map(host => host.replace(/\/$/, ''));
  return [...SOCKET_URL_OVERRIDES, ...fromApi];
}

/**
 * ICE servers backend se (temporary TURN credentials ke saath jab configured ho).
 * Cache + graceful fallback: backend abhi deploy nahi hai to public STUN se
 * call chalega (same-network par kaam karta hai; cross-NAT ke liye TURN chahiye).
 */
export async function fetchIceServers(): Promise<{ servers: RtcIceServer[]; source: 'backend' | 'fallback' }> {
  const now = Date.now();
  if (rtcConfigCache && now - rtcConfigCache.fetchedAt < RTC_CONFIG_TTL_MS) {
    return { servers: rtcConfigCache.config.iceServers, source: 'backend' };
  }

  try {
    /* Module ko dynamic import se late hain taaki api.ts ka circular import na ho. */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const apiModule = require('../api/api');
    const config: ConsultationRtcConfig = await apiModule.api.consultations.rtcConfig();
    if (config?.iceServers?.length) {
      rtcConfigCache = { config, fetchedAt: now };
      AsyncStorage.setItem(RTC_CONFIG_CACHE_KEY, JSON.stringify({ config, fetchedAt: now })).catch(
        () => {},
      );
      return { servers: config.iceServers, source: 'backend' };
    }
  } catch {
    /* backend unavailable — cached/fallback use karenge */
  }

  /* Cache (purana, expired) bhi chalega fallback se behtar hai. */
  if (rtcConfigCache?.config?.iceServers?.length) {
    return { servers: rtcConfigCache.config.iceServers, source: 'backend' };
  }
  try {
    const raw = await AsyncStorage.getItem(RTC_CONFIG_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { config: ConsultationRtcConfig; fetchedAt: number };
      if (parsed?.config?.iceServers?.length) {
        rtcConfigCache = parsed;
        return { servers: parsed.config.iceServers, source: 'backend' };
      }
    }
  } catch {
    /* cache corrupt — fallback */
  }

  return { servers: DEFAULT_STUN_URLS.map(url => ({ urls: url })), source: 'fallback' };
}
