/**
 * ChatRoomScreen — paid doctor live chat (server-persisted messages).
 * Session src/consultation/chat.ts sambhalta hai (join, optimistic send,
 * dedupe, pagination, typing/read, cache) — screen sirf UI.
 * Session ki start/expiry SERVER decide karta hai (paid time window).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import { AppButton, Loader, Screen } from '../components/UI';
import getChatSession, { ChatSession } from '../consultation/chat';
import type { ChatEvent, ChatSessionInfo, ConsultationMessage } from '../consultation/types';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoom'>;

/** MM:SS ya HH:MM:SS — expiry countdown. */
function countdownLabel(msLeft: number): string {
  if (msLeft <= 0) {
    return '00:00';
  }
  const total = Math.floor(msLeft / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function timeLabel(iso?: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatRoomScreen({ navigation, route }: Props): React.JSX.Element {
  useThemePreference();
  const { bookingId, peerName } = route.params;
  const insets = useSafeAreaInsets();

  const [sessionInfo, setSessionInfo] = useState<ChatSessionInfo | null>(null);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());

  const listRef = useRef<FlatList<ConsultationMessage>>(null);
  const sessionRef = useRef<ChatSession | null>(null);

  /* --------------------------------- open ---------------------------------- */
  useEffect(() => {
    const session = getChatSession(bookingId, 'patient');
    sessionRef.current = session;

    const unsubscribe = session.subscribe((event: ChatEvent) => {
      switch (event.type) {
        case 'messages':
          setMessages(event.messages);
          break;
        case 'message':
        case 'message-updated':
          setMessages(session.getMessages());
          break;
        case 'session':
          setSessionInfo(event.session);
          break;
        case 'typing':
          setPeerTyping(event.typing);
          break;
        case 'connected':
          setConnected(true);
          setBanner(null);
          setLoading(false);
          break;
        case 'reconnecting':
          setConnected(false);
          setBanner('Reconnecting… messages will sync automatically.');
          break;
        case 'error':
          setBanner(event.detail);
          break;
        default:
          break;
      }
    });

    session.open().catch((error: Error) => {
      setBanner(error?.message || 'Could not open the chat. Please try again.');
      setLoading(false);
    });

    return () => {
      unsubscribe();
      /* Session yahan band nahi — Appointments se wapas aane par history cache. */
    };
  }, [bookingId]);

  /* Expiry countdown — server clock se. */
  useEffect(() => {
    if (!sessionInfo?.expiresAt) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sessionInfo?.expiresAt]);

  /* Naya message aane par scroll bottom. */
  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  /* --------------------------------- send ---------------------------------- */
  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) {
      return;
    }
    setSending(true);
    setDraft('');
    try {
      await sessionRef.current?.send(text);
    } catch {
      /* failed bubble retry par tap kar sakte hain; error banner session se. */
    } finally {
      setSending(false);
    }
  }, [draft, sending]);

  const retryMessage = (message: ConsultationMessage) => {
    sessionRef.current?.retry(message).catch(() => {});
  };

  const loadOlder = async () => {
    await sessionRef.current?.loadOlder();
  };

  /* --------------------------------- state --------------------------------- */
  const active =
    sessionInfo?.status === 'active' ||
    sessionInfo?.status === 'waiting_doctor' ||
    sessionInfo == null;
  const msLeft = sessionInfo?.expiresAt ? new Date(sessionInfo.expiresAt).getTime() - now : null;
  const expired = msLeft !== null && msLeft <= 0;
  const canSend = active && !expired && connected;

  const statusLabel = !connected
    ? 'Offline'
    : sessionInfo?.status === 'waiting_doctor'
      ? 'Waiting for doctor'
      : expired
        ? 'Time up'
        : sessionInfo?.status === 'ended'
          ? 'Consultation ended'
          : sessionInfo?.status === 'expired'
            ? 'Session expired'
            : 'Active';

  /* --------------------------------- render -------------------------------- */
  return (
    <Screen>
      <AppHeader
        title={peerName || sessionInfo?.peerName || 'Doctor'}
        subtitle={statusLabel}
        onBack={() => navigation.goBack()}
      />
      {/* Connection / error banner */}
      {banner ? (
        <View style={styles.banner}>
          <Icon name="alert-triangle" size={14} color={colors.warningText} />
          <Text style={[typography.caption, { color: colors.warningText, flex: 1 }]} numberOfLines={2}>
            {banner}
          </Text>
        </View>
      ) : null}

      {/* Paid window info */}
      {sessionInfo && active && msLeft !== null && !expired ? (
        <View style={styles.timerRow}>
          <Icon name="clock" size={14} color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary }]}>
            Paid chat time left: {countdownLabel(msLeft)}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <Loader label="Opening chat…" />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            onScrollBeginDrag={loadOlder}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <Bubble
                message={item}
                onRetry={() => retryMessage(item)}
              />
            )}
            ListHeaderComponent={
              messages.length > 20 ? (
                <Pressable onPress={loadOlder} style={styles.olderBtn}>
                  <Text style={[typography.caption, { color: colors.blue }]}>Load earlier messages</Text>
                </Pressable>
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Icon name="message-circle" size={26} color={colors.textMuted} />
                <Text style={[typography.small, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
                  {sessionInfo?.status === 'waiting_doctor'
                    ? 'Chat started — the doctor will join shortly. Your paid time begins when they join.'
                    : 'Say hello — messages here are saved securely.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Typing indicator */}
        {peerTyping ? (
          <View style={styles.typingRow}>
            <Text style={typography.caption}>{peerName || 'Doctor'} is typing…</Text>
          </View>
        ) : null}

        {/* Composer */}
        {expired || sessionInfo?.status === 'ended' || sessionInfo?.status === 'expired' ? (
          <View style={[styles.closedBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={[typography.caption, { textAlign: 'center', flex: 1 }]}>
              {expired ? 'Your paid chat time is over.' : 'This consultation has ended.'}
            </Text>
            <AppButton
              label="Book Again"
              icon="calendar"
              size="sm"
              full={false}
              onPress={() => navigation.goBack()}
            />
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.md }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={text => {
                setDraft(text);
                sessionRef.current?.sendTyping();
              }}
              placeholder="Type a message…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={4000}
              editable={canSend}
            />
            <Pressable
              onPress={send}
              disabled={!canSend || !draft.trim()}
              style={[styles.sendBtn, (!canSend || !draft.trim()) && styles.sendBtnDisabled]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* --------------------------------- bubble ---------------------------------- */

function Bubble({ message, onRetry }: { message: ConsultationMessage; onRetry: () => void }) {
  /* patient = right (blue), doctor = left (card) */
  const mine = message.senderRole === 'patient';
  const failed = message.status === 'failed';

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowPeer]}>
      <Pressable
        onLongPress={() => {
          if (failed) {
            onRetry();
          }
        }}
        style={[styles.bubble, mine ? styles.bubbleMine : styles.bubblePeer, failed && styles.bubbleFailed]}
      >
        <Text style={[typography.small, mine && { color: '#fff' }]}>{message.text}</Text>
        <View style={styles.bubbleMeta}>
          <Text style={[typography.caption, { fontSize: 10, color: mine ? 'rgba(255,255,255,0.75)' : colors.textMuted }]}>
            {timeLabel(message.createdAt)}
          </Text>
          {mine ? (
            failed ? (
              <Text style={[typography.caption, { fontSize: 10, color: '#FFD2D2' }]}>Failed — tap to retry</Text>
            ) : (
              <Icon
                name={message.status === 'read' ? 'check-circle' : 'check'}
                size={12}
                color={message.status === 'read' ? '#9CE7C6' : 'rgba(255,255,255,0.75)'}
              />
            )
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  olderBtn: { alignSelf: 'center', paddingVertical: spacing.sm },
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: 2 },
  typingRow: { paddingHorizontal: spacing.lg, paddingBottom: 4 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowPeer: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.md },
  bubbleMine: { backgroundColor: colors.blue, borderBottomRightRadius: 4 },
  bubblePeer: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleFailed: { backgroundColor: colors.danger },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginTop: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
