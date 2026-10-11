/**
 * ChatSession — paid doctor live chat (real-time, Socket.IO + backend).
 *
 * Rules:
 *   - Messages SERVER par persist hote hain (server-generated id + timestamp).
 *   - Client optimistic render karta hai (clientId) — ack me asli copy wapas
 *     aati hai; duplicate server messages id se drop hote hain.
 *   - History REST se (pagination: `before` cursor) + AsyncStorage cache
 *     (offline me purane messages dikhte rehte hain).
 *   - Typing/read/throttled events — rate-limit client par bhi hai.
 *   - Session ki shuruat/expiry SERVER decide karta hai (paid time window).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { ApiError } from '../api/api';
import consultSocket from './socket';
import type {
  CallRole,
  ChatEvent,
  ChatSessionInfo,
  ConsultationMessage,
  JoinAck,
} from './types';

const MAX_TEXT_LENGTH = 4000;
const MAX_SENDS_PER_10S = 20;
const TYPING_THROTTLE_MS = 2500;
const CACHE_LIMIT = 200;

function cacheKey(bookingId: string): string {
  return `slovecare_chat_cache_${bookingId}`;
}

function uuid(): string {
  let id = '';
  for (let i = 0; i < 32; i += 1) {
    id += Math.floor(Math.random() * 16).toString(16);
    if (i === 7 || i === 11 || i === 15 || i === 19) {
      id += '-';
    }
  }
  return id;
}

export class ChatSession {
  readonly bookingId: string;
  readonly senderRole: CallRole;

  private messages: ConsultationMessage[] = [];
  private sessionInfo: ChatSessionInfo | null = null;
  private seenIds = new Set<string>();
  private seenClientIds = new Set<string>();
  private listeners = new Set<(event: ChatEvent) => void>();
  private socketHandlers: Array<[string, (...args: never[]) => void]> = [];
  private opened = false;
  private closed = false;
  private typingSentAt = 0;
  private sendTimes: number[] = [];
  private olderCursor: string | null = null; // sabse purane message ka createdAt
  private loadingOlder = false;

  constructor(bookingId: string, senderRole: CallRole = 'patient') {
    this.bookingId = bookingId;
    this.senderRole = senderRole;
  }

  /* -------------------------------- events --------------------------------- */

  subscribe(listener: (event: ChatEvent) => void): () => void {
    this.listeners.add(listener);
    listener({ type: 'messages', messages: [...this.messages] });
    if (this.sessionInfo) {
      listener({ type: 'session', session: this.sessionInfo });
    }
    return () => this.listeners.delete(listener);
  }

  private emit(event: ChatEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch {
        /* UI error ignore */
      }
    });
  }

  getMessages(): ConsultationMessage[] {
    return [...this.messages];
  }

  getSession(): ChatSessionInfo | null {
    return this.sessionInfo;
  }

  /* --------------------------------- open ---------------------------------- */

  /**
   * Session join — cached history turant, phir server se authorized join.
   * Server booking ownership/payment verify karke hi session data deta hai.
   */
  async open(): Promise<void> {
    if (this.opened) {
      return;
    }
    this.opened = true;

    /* Cache pehle dikhao (offline instant history), phir server sync. */
    const cached = await this.readCache();
    if (cached.length) {
      this.mergeMessages(cached, { silent: true });
    }

    consultSocket.retain();
    const socket = await consultSocket.connect();
    this.registerSocketHandlers(socket);

    const ack = await consultSocket.emitAck<JoinAck>('chat:join', { bookingId: this.bookingId });
    if (ack?.session) {
      this.sessionInfo = ack.session;
      this.emit({ type: 'session', session: ack.session });
    }
    if (ack?.messages?.length) {
      this.mergeMessages(ack.messages, { silent: true });
      this.emit({ type: 'messages', messages: [...this.messages] });
    }
    this.emit({ type: 'connected' });
    this.markRead();
  }

  private registerSocketHandlers(_socket: unknown) {
    const on = (event: string, handler: (...args: never[]) => void) => {
      consultSocket.on(event, handler);
      this.socketHandlers.push([event, handler]);
    };

    on('chat:message', ((message: ConsultationMessage) => {
      if (!message?.id || this.seenIds.has(message.id)) {
        return; // duplicate guard
      }
      const withStatus: ConsultationMessage = { ...message, status: 'delivered' };
      this.mergeMessages([withStatus]);
      this.emit({ type: 'message', message: withStatus });
      this.markRead();
      this.persistCache();
    }) as (...args: never[]) => void);

    on('chat:typing', ((payload: { typing?: boolean }) => {
      this.emit({ type: 'typing', typing: Boolean(payload?.typing) });
    }) as (...args: never[]) => void);

    on('chat:read', ((payload: { messageIds?: string[] }) => {
      const ids = payload?.messageIds ?? [];
      this.messages = this.messages.map(m =>
        ids.includes(m.id) ? { ...m, status: 'read', readAt: m.readAt ?? new Date().toISOString() } : m,
      );
      this.emit({ type: 'read', messageIds: ids });
    }) as (...args: never[]) => void);

    on('chat:session', ((session: ChatSessionInfo) => {
      this.sessionInfo = session;
      this.emit({ type: 'session', session });
    }) as (...args: never[]) => void);

    on('chat:error', ((payload: { message?: string; code?: string }) => {
      if (payload?.code === 'expired' || payload?.code === 'ended') {
        if (this.sessionInfo) {
          this.sessionInfo = { ...this.sessionInfo, status: payload.code };
          this.emit({ type: 'session', session: this.sessionInfo });
        }
      }
      this.emit({ type: 'error', detail: payload?.message || 'Chat error. Please try again.' });
    }) as (...args: never[]) => void);

    consultSocket.on('connect', this.onReconnect);
    this.socketHandlers.push(['connect', this.onReconnect as (...args: never[]) => void]);
    consultSocket.on('disconnect', this.onDisconnect);
    this.socketHandlers.push(['disconnect', this.onDisconnect as (...args: never[]) => void]);
  }

  private onReconnect = () => {
    if (this.closed) {
      return;
    }
    /* Re-join + missed messages sync (server last messages bhejega). */
    consultSocket
      .emitAck<JoinAck>('chat:join', { bookingId: this.bookingId })
      .then(ack => {
        if (ack?.session) {
          this.sessionInfo = ack.session;
          this.emit({ type: 'session', session: ack.session });
        }
        if (ack?.messages?.length) {
          const fresh = ack.messages.filter(m => !this.seenIds.has(m.id));
          if (fresh.length) {
            this.mergeMessages(fresh, { silent: true });
            this.emit({ type: 'messages', messages: [...this.messages] });
          }
        }
        this.emit({ type: 'connected' });
      })
      .catch(error => {
        this.emit({ type: 'error', detail: (error as Error)?.message || 'Could not reconnect the chat.' });
      });
  };

  private onDisconnect = () => {
    if (!this.closed) {
      this.emit({ type: 'reconnecting' });
    }
  };

  /* ------------------------------- messages -------------------------------- */

  private mergeMessages(incoming: ConsultationMessage[], opts: { silent?: boolean } = {}) {
    let changed = false;
    incoming.forEach(raw => {
      if (!raw?.id || this.seenIds.has(raw.id)) {
        return;
      }
      /* Status normalize — readAt ho to 'read', warna backend default. */
      const message: ConsultationMessage = {
        ...raw,
        status: raw.status ?? (raw.readAt ? 'read' : 'delivered'),
      };
      /* clientId match — optimistic copy ko server copy se replace karo. */
      const optimisticIndex = message.clientId
        ? this.messages.findIndex(m => m.clientId === message.clientId && m.status === 'sending')
        : -1;
      if (optimisticIndex >= 0) {
        this.messages[optimisticIndex] = { ...message, status: 'sent' };
        this.seenIds.add(message.id);
        changed = true;
        return;
      }
      if (this.seenClientIds.has(message.clientId ?? '')) {
        /* Client id already asli message me process hua — duplicate nahi. */
        this.seenIds.add(message.id);
        changed = true;
        return;
      }
      this.seenIds.add(message.id);
      if (message.clientId) {
        this.seenClientIds.add(message.clientId);
      }
      this.messages.push(message);
      changed = true;
    });

    if (changed) {
      this.messages.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
      this.olderCursor = this.messages[0]?.createdAt ?? this.olderCursor;
      if (!opts.silent) {
        /* cache persist caller karta hai (batch ke liye) */
      }
    }
    return changed;
  }

  /** Message bhejo — server validate + persist + ack (id + timestamp). */
  async send(text: string): Promise<ConsultationMessage> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new ApiError('Type a message first.', 400);
    }
    if (trimmed.length > MAX_TEXT_LENGTH) {
      throw new ApiError(`Messages can be up to ${MAX_TEXT_LENGTH} characters.`, 400);
    }

    /* Client-side rate limit (server par bhi hai). */
    const now = Date.now();
    this.sendTimes = this.sendTimes.filter(t => now - t < 10000);
    if (this.sendTimes.length >= MAX_SENDS_PER_10S) {
      throw new ApiError('You are sending messages too quickly. Please slow down.', 429);
    }
    this.sendTimes.push(now);

    const clientId = uuid();
    const optimistic: ConsultationMessage = {
      id: `local-${clientId}`,
      clientId,
      bookingId: this.bookingId,
      senderId: '',
      senderRole: this.senderRole,
      text: trimmed,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    this.messages.push(optimistic);
    this.emit({ type: 'message', message: optimistic });

    try {
      const saved = await consultSocket.emitAck<ConsultationMessage>('chat:message', {
        bookingId: this.bookingId,
        clientId,
        text: trimmed,
      });
      const withStatus: ConsultationMessage = { ...(saved ?? optimistic), clientId, status: 'sent' };
      this.mergeMessages([withStatus]);
      this.emit({ type: 'message-updated', message: withStatus });
      this.persistCache();
      return withStatus;
    } catch (error) {
      const failed: ConsultationMessage = { ...optimistic, status: 'failed' };
      this.messages = this.messages.map(m => (m.id === optimistic.id ? failed : m));
      this.emit({ type: 'message-updated', message: failed });
      this.emit({ type: 'error', detail: (error as Error)?.message || 'Message could not be sent.' });
      throw error;
    }
  }

  /** Failed message dobara bhejo. */
  async retry(message: ConsultationMessage): Promise<ConsultationMessage> {
    this.messages = this.messages.filter(m => m.id !== message.id);
    this.seenClientIds.delete(message.clientId ?? '');
    this.emit({ type: 'messages', messages: [...this.messages] });
    return this.send(message.text);
  }

  /** Purane messages (pagination) — REST se, server authorization ke saath. */
  async loadOlder(): Promise<boolean> {
    if (this.loadingOlder || !this.olderCursor) {
      return false;
    }
    this.loadingOlder = true;
    try {
      const older = await api.consultations.messages(this.bookingId, {
        before: this.olderCursor,
        limit: 30,
      });
      if (!older?.length) {
        return false;
      }
      const changed = this.mergeMessages(older, { silent: true });
      this.emit({ type: 'messages', messages: [...this.messages] });
      this.persistCache();
      return changed;
    } catch (error) {
      this.emit({ type: 'error', detail: (error as Error)?.message || 'Could not load older messages.' });
      return false;
    } finally {
      this.loadingOlder = false;
    }
  }

  sendTyping() {
    const now = Date.now();
    if (now - this.typingSentAt < TYPING_THROTTLE_MS) {
      return;
    }
    this.typingSentAt = now;
    consultSocket.emit('chat:typing', { bookingId: this.bookingId, typing: true });
  }

  markRead() {
    consultSocket.emit('chat:read', { bookingId: this.bookingId });
  }

  /* --------------------------------- cache --------------------------------- */

  private async readCache(): Promise<ConsultationMessage[]> {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(this.bookingId));
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as ConsultationMessage[];
      return Array.isArray(parsed) ? parsed.filter(m => m?.id && m?.createdAt) : [];
    } catch {
      return [];
    }
  }

  private persistCache() {
    const recent = this.messages
      .filter(m => !m.id.startsWith('local-') && m.status !== 'failed' && m.status !== 'sending')
      .slice(-CACHE_LIMIT);
    AsyncStorage.setItem(cacheKey(this.bookingId), JSON.stringify(recent)).catch(() => {});
  }

  /* --------------------------------- close --------------------------------- */

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    consultSocket.emit('chat:leave', { bookingId: this.bookingId });
    this.socketHandlers.forEach(([event, handler]) => consultSocket.off(event, handler));
    this.socketHandlers = [];
    this.persistCache();
    consultSocket.release();
    this.listeners.clear();
  }
}

/* ------------------------------- singleton -------------------------------- */

/** Per-booking chat session reuse — duplicate join nahi hota. */
const openSessions = new Map<string, ChatSession>();

export function getChatSession(bookingId: string, role: CallRole = 'patient'): ChatSession {
  let session = openSessions.get(bookingId);
  if (!session) {
    session = new ChatSession(bookingId, role);
    openSessions.set(bookingId, session);
  }
  return session;
}

export function closeChatSession(bookingId: string) {
  openSessions.get(bookingId)?.close();
  openSessions.delete(bookingId);
}

export default getChatSession;
