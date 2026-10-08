/**
 * AI tab — Slota AI (SloveCare ka health assistant, teen-layer backend).
 *
 * Backend/API: POST https://sloveniajanseva-backend.vercel.app/api/v1/ai/chat
 *   body   : { messages: [{ role: 'user' | 'assistant', content }] }
 *   reply  : { reply: string }
 * Saari calls src/api/api.ts → api.ai.chat() se hoti hain.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import CatIcon from '../components/CatIcon';
import { Screen } from '../components/UI';
import api from '../api/api';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: Message = {
  role: 'assistant',
  content:
    "Hello! I'm your Slota AI assistant. Ask me about symptoms, doctors, lab tests or booking a home visit.",
};

const SUGGESTIONS = [
  'Which doctor should I consult for chest pain?',
  'Fasting hours for Full Body Package',
  'Symptoms of typhoid in kids',
  'How do I book a home visit?',
];

/** Markdown bold (`**text**`) ko strong Text me badalta hai. */
function renderRich(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/\*\*/).map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`${keyPrefix}-b${i}`} style={{ fontWeight: '800' }}>
        {part}
      </Text>
    ) : (
      <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>
    ),
  );
}

export default function AIScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Keyboard open/close track — suggestions tab ke waqt chip dete hain taaki
  // input bar kabhi keyboard ke neeche na chala jaaye.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const send = useCallback(
    async (preset?: string) => {
      const text = (preset ?? input).trim();
      if (!text || loading) {
        return;
      }
      setInput('');

      const nextMessages: Message[] = [...messages, { role: 'user', content: text }];
      setMessages(nextMessages);
      setLoading(true);

      try {
        const reply = await api.ai.chat(nextMessages);
        setMessages([...nextMessages, { role: 'assistant', content: reply }]);
      } catch (error) {
        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            content: (error as Error).message || 'Something went wrong. Please try again.',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages],
  );

  const clearChat = () => {
    setMessages([GREETING]);
    setInput('');
  };

  // Keyboard khula ho toh suggestions nahi dikhate — warna chips + disclaimer
  // space leke input bar ko keyboard ke neeche dhak dete hain.
  const showSuggestions = messages.length <= 1 && !loading && !keyboardOpen;

  return (
    <Screen backgroundColor={colors.background}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerIcon}>
          <CatIcon size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h4, { color: colors.textInverse }]} numberOfLines={1}>
            Slota AI
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online • Health assistant</Text>
          </View>
        </View>
        <Pressable onPress={clearChat} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Clear chat">
          <Icon name="trash" size={17} color={colors.textInverse} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // gradle.properties me edgeToEdgeEnabled=true hai, isliye Android me
        // window keyboard ke liye resize nahi hota (adjustResize kaam nahi karta)
        // aur keyboard input bar ko chhupa deta hai. 'height' behavior dono case
        // me sahi kaam karta hai — window resize ho ya na ho.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages — inverted list, chat jaisa neeche se grow hoti hai */}
        <FlatList
          data={[...messages].reverse()}
          keyExtractor={(item, index) => `${item.role}-${messages.length - index}`}
          inverted
          style={{ flex: 1 }}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            loading ? (
              <View style={styles.bubbleRow}>
                <View style={styles.avatar}>
                  <CatIcon size={16} animate={false} />
                </View>
                <View style={[styles.bubble, styles.bubbleBot, styles.typing]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[typography.caption, { marginLeft: spacing.sm }]}>Thinking…</Text>
                </View>
              </View>
            ) : undefined
          }
          renderItem={({ item, index }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.bubbleRow, isUser && { justifyContent: 'flex-end' }]}>
                {!isUser ? (
                  <View style={styles.avatar}>
                    <CatIcon size={16} animate={false} />
                  </View>
                ) : null}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                  <Text style={[typography.body, isUser && { color: colors.textInverse }]}>
                    {renderRich(item.content, `m${index}`)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Quick suggestions */}
        {showSuggestions ? (
          <View style={styles.suggestions}>
            <Text style={[typography.eyebrow, { marginBottom: spacing.sm }]}>Try asking</Text>
            <View style={styles.chipWrap}>
              {SUGGESTIONS.map(s => (
                <Pressable key={s} onPress={() => send(s)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.75 }]}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          AI suggestions are informational only — not a diagnosis. Consult a doctor for medical advice.
        </Text>

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about symptoms, tests or doctors…"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!loading}
            multiline
            onSubmitEditing={() => send()}
          />
          <Pressable
            onPress={() => send()}
            disabled={loading || !input.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (loading || !input.trim()) && { opacity: 0.45 },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
            accessibilityLabel="Send message"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Icon name="send" size={18} color={colors.textInverse} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    ...shadow.nav,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399' },
  statusText: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },

  messages: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  bubbleBot: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 6,
    ...shadow.sm,
  },
  bubbleUser: {
    backgroundColor: colors.blue,
    borderTopRightRadius: 6,
  },
  typing: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  suggestions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    ...shadow.sm,
  },
  chipText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },

  disclaimer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
});
