/**
 * VideoCallManager — asli WebRTC video calling (react-native-webrtc).
 *
 * Flow (perfect-negotiation lite, role-based):
 *   1. Permissions (camera + mic) → local MediaStream (getUserMedia).
 *   2. Socket.IO connect (JWT auth) → `video:join` { bookingId } — server
 *      booking ownership + payment verify karke room me daalta hai.
 *   3. Room me dono aane par server `video:ready` bhejta hai.
 *      Patient (initiator) SDP offer banata hai → `video:offer`.
 *      Doctor answer karta hai → `video:answer`.
 *   4. ICE candidates `video:ice-candidate` se exchange hote hain
 *      (STUN + TURN — TURN credentials backend se temporary milte hain).
 *   5. `ontrack` par remote stream aata hai → connection 'connected'.
 *
 * Safety:
 *   - Duplicate session prevention (ek booking par ek hi session).
 *   - Unauthorized join server par reject hota hai (yahan error state).
 *   - ICE failure par automatic restart (max 2) → 'reconnecting'.
 *   - Socket drop par re-join + ICE restart.
 *   - end() par saare tracks/peer connection/listeners release hote hain.
 */

import InCallManager from 'react-native-incall-manager';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
} from 'react-native-webrtc';
import { Socket } from 'socket.io-client';
import { fetchIceServers } from './config';
import consultSocket from './socket';
import type {
  CallEndReason,
  CallEvent,
  CallRole,
  CallState,
  JoinAck,
  RtcIceServer,
} from './types';

export interface StartCallOptions {
  bookingId: string;
  role: CallRole;
}

const MAX_ICE_RESTARTS = 2;
const DISCONNECT_GRACE_MS = 5000;

export class CallError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CallError';
    this.code = code;
  }
}

/* --------------------------- permissions helper --------------------------- */

async function ensureMediaPermissions(): Promise<void> {
  if (Platform.OS !== 'android') {
    return; // iOS par getUserMedia khud prompt karta hai (Info.plist descriptions)
  }
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  const camera = results[PermissionsAndroid.PERMISSIONS.CAMERA];
  const mic = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (camera !== 'granted' || mic !== 'granted') {
    throw new CallError(
      'permission_denied',
      camera !== 'granted' && mic !== 'granted'
        ? 'Camera and microphone permissions are required for video calls.'
        : camera !== 'granted'
          ? 'Camera permission is required for video calls.'
          : 'Microphone permission is required for video calls.',
    );
  }
}

/* ------------------------------ the session ------------------------------ */

export class VideoCallSession {
  readonly bookingId: string;
  readonly role: CallRole;

  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private socket: Socket | null = null;
  private iceServers: RtcIceServer[] = [];

  private state: CallState = 'idle';
  private stateDetail: string | undefined;
  private ended = false;
  private started = false;
  private peerJoined = false;
  private makingOffer = false;
  private iceRestartsUsed = 0;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCandidates: unknown[] = [];
  /** Patient = initiator (offer banata hai) — glare-free fixed roles. */
  private readonly initiator: boolean;

  private listeners = new Set<(event: CallEvent) => void>();
  private socketHandlers: Array<[string, (...args: never[]) => void]> = [];

  constructor(options: StartCallOptions) {
    this.bookingId = options.bookingId;
    this.role = options.role;
    this.initiator = options.role === 'patient';
  }

  /* ----------------------------- events / state ---------------------------- */

  subscribe(listener: (event: CallEvent) => void): () => void {
    this.listeners.add(listener);
    /* Current snapshot — late subscribers ko turant state mile. */
    listener({ type: 'state', state: this.state, detail: this.stateDetail });
    if (this.localStream) {
      listener({ type: 'local-stream', stream: this.localStream });
    }
    if (this.remoteStream) {
      listener({ type: 'remote-stream', stream: this.remoteStream });
    }
    listener({ type: 'peer-joined', joined: this.peerJoined });
    return () => this.listeners.delete(listener);
  }

  private emit(event: CallEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch {
        /* UI listener error ignore */
      }
    });
  }

  private setState(state: CallState, detail?: string) {
    if (this.ended && state !== 'ended') {
      return;
    }
    this.state = state;
    this.stateDetail = detail;
    this.emit({ type: 'state', state, detail });
  }

  getState(): CallState {
    return this.state;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /* --------------------------------- start --------------------------------- */

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    try {
      this.setState('preparing');
      await ensureMediaPermissions();

      /* Local media — camera fail ho to audio-only, mic dono fail to error. */
      try {
        this.localStream = await mediaDevices.getUserMedia({
          audio: true,
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (videoError) {
        try {
          this.localStream = await mediaDevices.getUserMedia({ audio: true });
          this.stateDetail = 'Camera unavailable — audio only.';
        } catch {
          const name = (videoError as Error)?.name || '';
          throw new CallError(
            /not.?allowed|permission|denied/i.test(name) ? 'permission_denied' : 'media_unavailable',
            /not.?allowed|permission|denied/i.test(name)
              ? 'Camera and microphone permission were denied.'
              : 'Could not access the camera or microphone. Please close other apps using the camera and try again.',
          );
        }
      }
      this.emit({ type: 'local-stream', stream: this.localStream });

      /* Audio route (speaker) + call state. */
      try {
        InCallManager.start({ media: 'video' });
        InCallManager.setSpeakerphoneOn(true);
      } catch {
        /* incall-manager fail — default route se call chalega */
      }

      /* ICE servers — backend (temporary TURN) se, fallback public STUN. */
      const { servers } = await fetchIceServers();
      this.iceServers = servers;

      /* Socket + join (server authorization). */
      this.setState('connecting');
      consultSocket.retain();
      this.socket = await consultSocket.connect();
      this.registerSocketHandlers();

      const ack = await consultSocket.emitAck<JoinAck>('video:join', {
        bookingId: this.bookingId,
        role: this.role,
      });
      this.peerJoined = Boolean(ack?.peerOnline);
      this.emit({ type: 'peer-joined', joined: this.peerJoined });

      this.createPeerConnection();

      this.setState(this.peerJoined ? 'connecting_peer' : 'waiting');
      /* Doosra participant aane par `video:ready` aayega → offer yahan ya
         event handler dono jagah se chalenge (makingOffer guard). */
    } catch (error) {
      const err = error as CallError;
      if (err?.code === 'permission_denied') {
        this.setState('failed', err.message);
        this.failCode = 'permission_denied';
      } else if (/authoriz|not (allowed|part)|forbidden|payment|required/i.test(err?.message || '')) {
        this.setState('failed', err.message || 'You are not allowed to join this consultation.');
        this.failCode = 'unauthorized';
      } else {
        this.setState('failed', err?.message || 'Could not start the call.');
        this.failCode = 'error';
      }
      throw error;
    }
  }

  private failCode: CallEndReason = 'error';

  /* --------------------------- peer connection ----------------------------- */

  private createPeerConnection() {
    this.destroyPeerConnection();

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers.map(server => ({
        urls: server.urls,
        username: server.username,
        credential: server.credential,
      })),
      rtcpMuxPolicy: 'require',
    });
    this.pc = pc;

    /* Local tracks bhejne ke liye. */
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => pc.addTrack(track, this.localStream as MediaStream));
      this.localStream.getVideoTracks().forEach(track => pc.addTrack(track, this.localStream as MediaStream));
    }

    pc.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      const candidate = event.candidate;
      if (candidate) {
        consultSocket.emit('video:ice-candidate', {
          bookingId: this.bookingId,
          candidate: {
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            candidate: candidate.candidate,
          },
        });
      }
    };

    pc.ontrack = (event: { streams?: MediaStream[] }) => {
      const streams = event.streams;
      const stream = streams?.[0] ?? null;
      if (stream) {
        this.remoteStream = stream;
        this.emit({ type: 'remote-stream', stream });
      }
    };

    pc.onconnectionstatechange = () => {
      const connectionState = pc.connectionState;
      if (connectionState === 'connected') {
        this.clearDisconnectTimer();
        this.iceRestartsUsed = 0;
        this.setState('connected');
      } else if (connectionState === 'disconnected') {
        /* Network blip — grace period, khud theek ho sakta hai. */
        this.scheduleDisconnectRecovery('Connection interrupted — reconnecting…');
      } else if (connectionState === 'failed') {
        this.handleIceFailure();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        this.handleIceFailure();
      }
    };
  }

  private destroyPeerConnection() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      try {
        this.pc.close();
      } catch {
        /* already closed */
      }
      this.pc = null;
    }
    this.remoteStream = null;
    this.pendingCandidates = [];
  }

  /* ------------------------------- signaling ------------------------------- */

  private registerSocketHandlers() {
    this.unregisterSocketHandlers();

    const on = (event: string, handler: (...args: never[]) => void) => {
      consultSocket.on(event, handler);
      this.socketHandlers.push([event, handler]);
    };

    on('video:ready', (() => {
      this.peerJoined = true;
      this.emit({ type: 'peer-joined', joined: true });
      if (this.state === 'waiting') {
        this.setState('connecting_peer');
      }
      if (this.initiator) {
        this.negotiate(false);
      }
    }) as (...args: never[]) => void);

    on('video:participant-joined', (() => {
      this.peerJoined = true;
      this.emit({ type: 'peer-joined', joined: true });
      if (this.state === 'waiting') {
        this.setState('connecting_peer');
      }
      if (this.initiator) {
        this.negotiate(false);
      }
    }) as (...args: never[]) => void);

    on('video:participant-left', (() => {
      this.peerJoined = false;
      this.emit({ type: 'peer-joined', joined: false });
      if (!this.ended && this.state === 'connected') {
        /* Doctor/peer chala gaya — thoda intezaar, phir waiting state. */
        this.scheduleDisconnectRecovery('The other participant left the call.');
      }
    }) as (...args: never[]) => void);

    on('video:offer', (async (payload: { sdp?: string; type?: string }) => {
      const pc = this.pc;
      if (!pc || !payload?.sdp || this.ended) {
        return;
      }
      try {
        await pc.setRemoteDescription({ type: payload.type ?? 'offer', sdp: payload.sdp });
        await this.flushPendingCandidates();
        if (!pc.localDescription) {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          consultSocket.emit('video:answer', {
            bookingId: this.bookingId,
            type: 'answer',
            /* setLocalDescription ke baad answer me hi SDP hota hai. */
            sdp: (answer as { sdp?: string }).sdp,
          });
        }
        if (this.state === 'waiting') {
          this.setState('connecting_peer');
        }
      } catch (error) {
        console.warn('[video-call] offer handling failed:', (error as Error)?.message);
      }
    }) as (...args: never[]) => void);

    on('video:answer', (async (payload: { sdp?: string; type?: string }) => {
      const pc = this.pc;
      if (!pc || !payload?.sdp || this.ended) {
        return;
      }
      try {
        await pc.setRemoteDescription({ type: payload.type ?? 'answer', sdp: payload.sdp });
        await this.flushPendingCandidates();
      } catch (error) {
        console.warn('[video-call] answer handling failed:', (error as Error)?.message);
      }
    }) as (...args: never[]) => void);

    on('video:ice-candidate', (async (payload: { candidate?: { sdpMid?: string; sdpMLineIndex?: number; candidate?: string } }) => {
      if (!payload?.candidate?.candidate || !this.pc) {
        return;
      }
      if (!this.pc.remoteDescription) {
        this.pendingCandidates.push(payload.candidate);
        return;
      }
      try {
        await this.pc.addIceCandidate(payload.candidate as never);
      } catch (error) {
        console.warn('[video-call] addIceCandidate failed:', (error as Error)?.message);
      }
    }) as (...args: never[]) => void);

    on('video:rejected', ((payload: { reason?: string }) => {
      this.finish('rejected', payload?.reason || 'The call was declined.');
    }) as (...args: never[]) => void);

    on('video:ended', ((payload: { reason?: string }) => {
      this.finish('remote', payload?.reason || 'The consultation has ended.');
    }) as (...args: never[]) => void);

    on('video:error', ((payload: { message?: string; code?: string }) => {
      if (payload?.code === 'unauthorized' || payload?.code === 'not_found') {
        this.finish('unauthorized', payload.message || 'You are no longer authorized for this call.');
      } else {
        this.setState('failed', payload?.message || 'The call failed. Please try again.');
      }
    }) as (...args: never[]) => void);

    /* Socket drop → reconnect → dobara join (session wapas chalega). */
    consultSocket.on('connect', this.onSocketReconnect);
    this.socketHandlers.push(['connect', this.onSocketReconnect as (...args: never[]) => void]);
    consultSocket.on('disconnect', this.onSocketDisconnect);
    this.socketHandlers.push(['disconnect', this.onSocketDisconnect as (...args: never[]) => void]);
  }

  private unregisterSocketHandlers() {
    this.socketHandlers.forEach(([event, handler]) => {
      consultSocket.off(event, handler);
    });
    this.socketHandlers = [];
  }

  private onSocketReconnect = () => {
    if (this.ended) {
      return;
    }
    /* Re-join — server authorization dobara check karta hai. */
    consultSocket
      .emitAck<JoinAck>('video:join', { bookingId: this.bookingId, role: this.role })
      .then(() => {
        if (this.ended) {
          return;
        }
        this.setState(this.peerJoined ? 'connecting_peer' : 'waiting');
        if (this.initiator && this.peerJoined) {
          /* Naya ICE candidates set — peer ko naya offer chahiye. */
          this.negotiate(true);
        }
      })
      .catch(error => {
        this.finish('unauthorized', (error as Error)?.message || 'Could not rejoin the call.');
      });
  };

  private onSocketDisconnect = () => {
    if (this.ended) {
      return;
    }
    this.scheduleDisconnectRecovery('Connection lost — reconnecting…');
  };

  /* ------------------------------ negotiation ------------------------------ */

  private async negotiate(iceRestart: boolean) {
    const pc = this.pc;
    if (!pc || this.makingOffer || this.ended) {
      return;
    }
    if (pc.signalingState !== 'stable' && !iceRestart) {
      return;
    }
    try {
      this.makingOffer = true;
      const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : {});
      await pc.setLocalDescription(offer);
      consultSocket.emit('video:offer', {
        bookingId: this.bookingId,
        type: 'offer',
        sdp: pc.localDescription?.sdp ?? (offer as { sdp?: string }).sdp,
      });
    } catch (error) {
      console.warn('[video-call] negotiate failed:', (error as Error)?.message);
      if (iceRestart && this.iceRestartsUsed >= MAX_ICE_RESTARTS) {
        this.setState('failed', 'Could not connect audio/video. Please check your network and retry.');
      }
    } finally {
      this.makingOffer = false;
    }
  }

  private async flushPendingCandidates() {
    if (!this.pc) {
      return;
    }
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate as never);
      } catch {
        /* candidate stale ho sakti hai — ignore */
      }
    }
  }

  /* ---------------------------- recovery handling -------------------------- */

  private scheduleDisconnectRecovery(detail: string) {
    if (this.disconnectTimer || this.ended) {
      return;
    }
    this.setState('reconnecting', detail);
    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null;
      if (this.ended) {
        return;
      }
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        this.setState('connected');
        return;
      }
      this.handleIceFailure();
    }, DISCONNECT_GRACE_MS);
  }

  private clearDisconnectTimer() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  private handleIceFailure() {
    if (this.ended) {
      return;
    }
    if (this.iceRestartsUsed >= MAX_ICE_RESTARTS) {
      this.setState(
        'failed',
        'Could not establish a stable audio/video connection. Please check your network and retry.',
      );
      return;
    }
    this.iceRestartsUsed += 1;
    this.setState('reconnecting', 'Network change detected — restoring the call…');
    try {
      this.pc?.restartIce();
    } catch {
      /* restartIce destitute ho sakta hai — offer iceRestart se bhi chalega */
    }
    if (this.initiator) {
      this.negotiate(true);
    } else {
      /* Peer se naya offer maangte hain (server peer ko ready event bhejega). */
      consultSocket.emit('video:reconnect', { bookingId: this.bookingId });
    }
  }

  /* -------------------------------- controls ------------------------------- */

  setAudioEnabled(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  setVideoEnabled(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  switchCamera() {
    this.localStream?.getVideoTracks().forEach(track => {
      try {
        track._switchCamera();
      } catch {
        /* single-camera device */
      }
    });
  }

  setSpeaker(enabled: boolean) {
    try {
      InCallManager.setSpeakerphoneOn(enabled);
    } catch {
      /* audio route change best-effort */
    }
  }

  /* ---------------------------------- end ---------------------------------- */

  /** Call khatam — tracks, peer connection, socket handlers sab release. */
  end(notifyPeer: boolean = true, reason: CallEndReason = notifyPeer ? 'local' : 'remote', detail?: string) {
    if (this.ended) {
      return;
    }
    this.ended = true;

    if (notifyPeer) {
      try {
        consultSocket.emit('video:end', { bookingId: this.bookingId });
      } catch {
        /* socket already down */
      }
    }

    this.clearDisconnectTimer();
    this.unregisterSocketHandlers();
    this.destroyPeerConnection();

    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream.release(false);
      } catch {
        /* tracks already released */
      }
      this.localStream = null;
      this.emit({ type: 'local-stream', stream: null });
    }

    try {
      InCallManager.stop();
    } catch {
      /* ignore */
    }

    consultSocket.release();
    this.setState('ended', detail);
    this.emit({ type: 'ended', reason, ...(detail ? { detail } : {}) });
  }

  /** Server/peer se khatam (peer left, rejected, error). */
  private finish(reason: CallEndReason, detail?: string) {
    if (this.ended) {
      return;
    }
    this.end(false, reason, detail);
  }
}

/* ------------------------------- singleton -------------------------------- */

/**
 * Ek waqt me sirf ek call — doosri booking start karne par purani call band
 * hoti hai (duplicate session kabhi nahi banta).
 */
class VideoCallManager {
  private session: VideoCallSession | null = null;

  async start(options: StartCallOptions): Promise<VideoCallSession> {
    const state = this.session?.getState();
    const busy = state !== undefined && state !== 'ended' && state !== 'failed' && state !== 'idle';
    if (this.session && busy) {
      if (this.session.bookingId === options.bookingId) {
        return this.session; // same booking — reuse (duplicate join nahi)
      }
      this.session.end(true); // dusri call chal rahi thi — band karo
    }
    const session = new VideoCallSession(options);
    this.session = session;
    await session.start();
    return session;
  }

  /** Agar screen dobara mount ho (background se wapas) to session wapas mile. */
  existing(bookingId: string): VideoCallSession | null {
    if (this.session && this.session.bookingId === bookingId) {
      const state = this.session.getState();
      if (state !== 'ended' && state !== 'failed' && state !== 'idle') {
        return this.session;
      }
    }
    return null;
  }

  current(): VideoCallSession | null {
    return this.session;
  }

  /** Emergency cleanup (logout etc.). */
  endAll() {
    this.session?.end(true);
    this.session = null;
  }
}

export const videoCall = new VideoCallManager();
export default videoCall;
