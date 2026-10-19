/**
 * ConsultSocket — ek hi shared Socket.IO connection (video signaling + chat
 * + consultation notifications) dono flows isi se guzarte hain.
 *
 * Auth: JWT (vahi token jo REST API me hai) socket `auth` ke through jaata
 * hai; backend middleware verify karke role (patient/vendor) + booking
 * ownership har event par khud check karta hai. Client-provided userId par
 * kabhi bharosa nahi.
 *
 * Failover: SOCKET_URL_OVERRIDES → API_HOSTS (pehla jo connect ho jaye).
 */

import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../api/api';
import { SOCKET_PATH, socketUrlCandidates } from './config';

export type ConsultSocketStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';

type StatusListener = (status: ConsultSocketStatus, detail?: string) => void;

const CONNECT_TIMEOUT_MS = 9000;
const ACK_TIMEOUT_MS = 12000;

class ConsultSocket {
  private socket: Socket | null = null;
  /** JWT used for the active handshake. A socket authenticated with an older
   * account must never be reused for a new user's consultation. */
  private connectedToken: string | null = null;
  private activeUrl: string | null = null;
  private pending: Promise<Socket> | null = null;
  private status: ConsultSocketStatus = 'idle';
  private statusListeners = new Set<StatusListener>();
  /** Screen lifetime se connection lifetime alag — retain/release refcount. */
  private retainCount = 0;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;

  getStatus(): ConsultSocketStatus {
    return this.status;
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: ConsultSocketStatus, detail?: string) {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.statusListeners.forEach(l => {
      try {
        l(status, detail);
      } catch {
        /* listener error ignore */
      }
    });
  }

  /** Screen ke liye connection hold karo (mount par) — balance release (unmount par). */
  retain() {
    this.retainCount += 1;
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
  }

  release() {
    this.retainCount = Math.max(0, this.retainCount - 1);
    if (this.retainCount === 0) {
      /* Grace period — screen change par thodi der me wapas connect na karna pade. */
      this.releaseTimer = setTimeout(() => {
        if (this.retainCount === 0) {
          this.disconnect();
        }
      }, 3000);
    }
  }

  /** Connected socket lazily banata hai (candidates me failover). */
  async connect(): Promise<Socket> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Your sign-in session is missing. Please sign in again.');
    }
    if (this.socket?.connected && this.connectedToken === token) {
      return this.socket;
    }
    if (this.socket && this.connectedToken !== token) {
      /* Login/account changed while the singleton socket was alive. Socket.IO
         auth only runs during a handshake, so reconnect with the current JWT. */
      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;
      this.activeUrl = null;
      this.pending = null;
      this.connectedToken = null;
    }
    if (this.pending) {
      return this.pending;
    }

    this.setStatus('connecting');
    this.pending = this.tryCandidates(token)
      .then(socket => {
        this.pending = null;
        return socket;
      })
      .catch(error => {
        this.pending = null;
        this.setStatus('disconnected', (error as Error)?.message);
        throw error;
      });
    return this.pending;
  }

  private async tryCandidates(token: string): Promise<Socket> {
    const candidates = socketUrlCandidates();
    let lastError: Error | null = null;

    for (const url of candidates) {
      try {
        const socket = await this.openOne(url, token);
        this.socket = socket;
        this.connectedToken = token;
        this.activeUrl = url;
        this.wireLifecycle(socket);
        this.setStatus('connected');
        return socket;
      } catch (error) {
        lastError = error as Error;
      }
    }
    throw lastError ?? new Error('Realtime server is not reachable. Please check your connection.');
  }

  private openOne(url: string, token: string): Promise<Socket> {
    return new Promise<Socket>((resolve, reject) => {
      const socket = io(url, {
        path: SOCKET_PATH,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 800,
        reconnectionDelayMax: 8000,
        timeout: CONNECT_TIMEOUT_MS,
        /* JWT — server handshake par verify karta hai. */
        auth: { token },
        /* Android Emulator / local dev me self-signed cert allowance nahi —
           production me wss:// hi use karein. */
        rejectUnauthorized: __DEV__ ? false : true,
      } as Parameters<typeof io>[1]);

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.close();
          reject(new Error(`Realtime server timed out (${url})`));
        }
      }, CONNECT_TIMEOUT_MS);

      socket.once('connect', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(socket);
        }
      });
      socket.once('connect_error', (error: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.close();
          reject(error ?? new Error(`Realtime server connect failed (${url})`));
        }
      });
    });
  }

  private wireLifecycle(socket: Socket) {
    socket.on('connect', () => {
      /* token refresh ke baad reconnect — auth callback har attempt par naya token deta hai */
      this.setStatus('connected');
    });
    socket.on('disconnect', (reason: string) => {
      this.setStatus('disconnected', reason);
    });
    socket.io.on('reconnect_failed', () => {
      this.setStatus('disconnected', 'reconnect_failed');
    });
  }

  /** Server ack ke saath emit — timeout par reject (screen hang nahi hogi). */
  emitAck<T = unknown>(event: string, payload: unknown, timeoutMs = ACK_TIMEOUT_MS): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected to the SloveCare realtime server.'));
        return;
      }
      const timer = setTimeout(() => {
        reject(new Error(`The server did not respond (${event}). Please try again.`));
      }, timeoutMs);
      this.socket.emit(event, payload, (response: { data?: T; error?: { message?: string; code?: string } }) => {
        clearTimeout(timer);
        if (response && response.error) {
          const err = new Error(response.error.message || 'Request failed.');
          (err as Error & { code?: string }).code = response.error.code;
          reject(err);
          return;
        }
        resolve((response?.data ?? response) as T);
      });
    });
  }

  on(event: string, handler: (...args: never[]) => void): void {
    this.socket?.on(event, handler as never);
  }

  off(event: string, handler: (...args: never[]) => void): void {
    this.socket?.off(event, handler as never);
  }

  emit(event: string, payload: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(event, payload);
    }
  }

  /** Force reconnect (network change ke baad). */
  reconnectNow(): void {
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.releaseTimer) {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = null;
    this.connectedToken = null;
    this.activeUrl = null;
    this.setStatus('idle');
  }

  /** Testing ke liye. */
  currentUrl(): string | null {
    return this.activeUrl;
  }
}

export const consultSocket = new ConsultSocket();
export default consultSocket;
