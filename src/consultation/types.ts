/**
 * Consultation shared types — video calling + live chat dono.
 * Backend contract: docs/consultations/BACKEND_SPEC.md
 */

import type { MediaStream } from 'react-native-webrtc';

/* ------------------------------- booking --------------------------------- */

/**
 * Naye consultation types — Booking.serviceType inme se ek ho sakta hai
 * (purane 'online'/'online_consultation' bookings ab in-app WebRTC call se
 * chalti hain — koi third-party room nahi).
 */
export type ConsultationServiceType = 'video_consultation' | 'chat_consultation';

export type ConsultationMode = 'video' | 'chat';

/** Booking se consultation mode — backend `consultationMode` field bhejta hai. */
export function consultationModeOf(serviceType?: string): ConsultationMode | null {
  if (serviceType === 'video_consultation') {
    return 'video';
  }
  if (serviceType === 'chat_consultation') {
    return 'chat';
  }
  return null;
}

/* ------------------------------- rtc config ------------------------------ */

export interface RtcIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** GET /api/v1/consultations/rtc-config — temporary TURN credentials yahan se. */
export interface ConsultationRtcConfig {
  iceServers: RtcIceServer[];
  /** Jab credentials expire hote hain (client refresh hint). */
  expiresAt?: string;
}

/* ------------------------------- video call ------------------------------ */

/** Call ki UI state — screen isi ke hisaab se render karti hai. */
export type CallState =
  | 'idle'
  | 'preparing' // permissions + local media
  | 'connecting' // socket + signaling join
  | 'waiting' // room me hain, doosra participant abhi nahi aaya
  | 'connecting_peer' // WebRTC negotiation chal rahi hai
  | 'connected'
  | 'reconnecting'
  | 'ended'
  | 'failed';

export type CallEndReason =
  | 'local'
  | 'remote'
  | 'rejected'
  | 'error'
  | 'expired'
  | 'unauthorized'
  | string;

export type CallEvent =
  | { type: 'state'; state: CallState; detail?: string }
  | { type: 'local-stream'; stream: MediaStream | null }
  | { type: 'remote-stream'; stream: MediaStream | null }
  | { type: 'peer-joined'; joined: boolean }
  | { type: 'ended'; reason: CallEndReason };

export type CallRole = 'patient' | 'doctor';

/* --------------------------------- chat ---------------------------------- */

export type ChatMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ConsultationMessage {
  id: string;
  /** Client ka temp id — optimistic render + duplicate guard. */
  clientId?: string;
  bookingId: string;
  senderId: string;
  senderRole: CallRole;
  senderName?: string;
  text: string;
  /** Server timestamp (kabhi client se nahi). */
  createdAt: string;
  readAt?: string | null;
  /** Client-side only (send failure retry ke liye). */
  status?: ChatMessageStatus;
}

export type ChatSessionStatus = 'waiting_doctor' | 'active' | 'ended' | 'expired' | string;

export interface ChatSessionInfo {
  bookingId: string;
  status: ChatSessionStatus;
  peerName?: string;
  peerOnline?: boolean;
  startedAt?: string | null;
  expiresAt?: string | null;
  durationMinutes?: number;
}

export type ChatEvent =
  | { type: 'connected' }
  | { type: 'reconnecting' }
  | { type: 'error'; detail: string }
  | { type: 'session'; session: ChatSessionInfo }
  | { type: 'messages'; messages: ConsultationMessage[] }
  | { type: 'message'; message: ConsultationMessage }
  | { type: 'message-updated'; message: ConsultationMessage }
  | { type: 'typing'; typing: boolean }
  | { type: 'read'; messageIds: string[] };

/* ------------------------------ socket events ----------------------------- */

/** video:join / chat:join ack — server authorization ke baad yeh bhejta hai. */
export interface JoinAck {
  ok: boolean;
  room: string;
  role: CallRole;
  peerOnline?: boolean;
  session?: ChatSessionInfo;
  messages?: ConsultationMessage[];
  unreadCount?: number;
}

/** Har signaling payload me bookingId = room identifier (server verify karta hai). */
export interface BookingScopedPayload {
  bookingId: string;
}
