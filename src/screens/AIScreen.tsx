/**
 * AI tab — Slota AI (SloveCare ka health assistant, teen-layer backend).
 *
 * Backend/API: POST https://sloveniajanseva-backend.vercel.app/api/v1/ai/chat
 *   body   : { messages: [{ role: 'user' | 'assistant', content }] }
 *   reply  : { reply: string }
 * Saari calls src/api/api.ts → api.ai.chat() se hoti hain.
 *
 * Voice: mic button se user bol kar sawal pooch sakta hai (speech-to-text) aur
 * AI ka jawab awaaz me bhi sunai deta hai (text-to-speech). Dono logic
 * src/utils/voice.ts ke useVoiceChat hook me hain.
 *
 * Design (2026 refresh): hero gradient header (billi ke saath), welcome card
 * jisme Slota kya-kya kar sakti hai, animated chat bubbles + typing dots,
 * voice waveform aur gradient send button — sab react-native-svg gradients se
 * (koi extra UI library nahi, poori app jaise hi).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from '../components/Icon';
import CatIcon from '../components/CatIcon';
import { Screen } from '../components/UI';
import api from '../api/api';
import { useVoiceChat } from '../utils/voice';

import { colors, gradients, radius, shadow, spacing, typography } from '../theme/theme';

import { useThemePreference } from '../theme/ThemeContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: Message = {
  role: 'assistant',
  content:
    'Namaste! Main **Slota** hoon 🐱 — symptoms, doctors, lab tests ya home visit, sab poochiye.',
};

interface Suggestion {
  icon: IconName;
  label: string;
}

const SUGGESTIONS: Suggestion[] = [
  { icon: 'heart-pulse', label: 'Which doctor for chest pain?' },
  { icon: 'clock', label: 'Fasting hours for Full Body Package' },
  { icon: 'activity', label: 'Symptoms of typhoid in kids' },
  { icon: 'calendar', label: 'How do I book a home visit?' },
];

/** Welcome card me "Slota kya kar sakti hai" — ek hi row me chhoti capabilities. */
const CAPABILITIES: { icon: IconName; title: string }[] = [
  { icon: 'sparkles', title: 'Symptoms' },
  { icon: 'stethoscope', title: 'Doctors' },
  { icon: 'flask', title: 'Lab tests' },
  { icon: 'calendar', title: 'Home visit' },
];

/** Markdown bold (`**text**`) ko strong Text me badalta hai (+ newline support). */
function renderRich(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split('\n').map((line, lineIndex) => (
    <React.Fragment key={`${keyPrefix}-l${lineIndex}`}>
      {lineIndex > 0 ? '\n' : null}
      {line.split(/\*\*/).map((part, i) =>
        i % 2 === 1 ? (
          <Text key={`${keyPrefix}-b${i}`} style={styles.bold}>
            {part}
          </Text>
        ) : (
          <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>
        ),
      )}
    </React.Fragment>
  ));
}

/* -------------------------------------------------------------------------- */
/*  Gradient surfaces (SVG — poori app jaise, koi extra library nahi)          */
/* -------------------------------------------------------------------------- */

function HeaderGradient(): React.JSX.Element {
  const gradientId = `ai-header-${React.useId().replace(/:/g, '')}`;
  const stops = gradients.hero;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="0.7" y2="1">
            {stops.map((stopColor, index) => (
              <Stop key={index} offset={index / Math.max(stops.length - 1, 1)} stopColor={stopColor} />
            ))}
          </SvgGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

/** Bubble / button ke andar gradient fill — absolute overlay. */
function GradientFill({
  from,
  to,
  borderRadius,
  diagonal = true,
}: {
  from: string;
  to: string;
  borderRadius?: number;
  diagonal?: boolean;
}): React.JSX.Element {
  const gradientId = `ai-grad-${React.useId().replace(/:/g, '')}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </SvgGradient>
        </Defs>
        <Rect width="100%" height="100%" rx={borderRadius ?? 0} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chat pieces                                                                */
/* -------------------------------------------------------------------------- */

function TypingBubble(): React.JSX.Element {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay(260),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [dots]);

  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatar}>
        <CatIcon size={18} animate={false} />
      </View>
      <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [2, -4] }) }],
              },
            ]}
          />
        ))}
        <Text style={[typography.caption, styles.typingLabel]}>Slota soch rahi hai…</Text>
      </View>
    </View>
  );
}

function AiMessage({ message }: { message: Message }): React.JSX.Element {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter]);

  const isUser = message.role === 'user';
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });

  return (
    <Animated.View style={[styles.bubbleRow, isUser && styles.bubbleRowUser, { opacity: enter, transform: [{ translateY }, { scale }] }]}>
      {!isUser ? (
        <View style={styles.avatar}>
          <CatIcon size={18} animate={false} />
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        {isUser ? <GradientFill from={colors.blue} to={colors.primary} borderRadius={radius.lg - 5} /> : null}
        <Text style={[typography.body, isUser && styles.bubbleTextUser]}>{renderRich(message.content, 'm')}</Text>
      </View>
    </Animated.View>
  );
}

/** Welcome hero — chat khali hone par Slota ki capabilities (list ke top par). */
function WelcomeCard(): React.JSX.Element {
  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeBadge}>
        <CatIcon size={28} />
      </View>
      <Text style={[typography.h4, styles.welcomeTitle]}>Namaste, main Slota hoon</Text>
      <Text style={[typography.caption, styles.welcomeLead]}>
        Aapki 24x7 health assistant — jo poochna ho, seedha poochiye.
      </Text>
      <View style={styles.capGrid}>
        {CAPABILITIES.map(cap => (
          <View key={cap.title} style={styles.capItem}>
            <View style={styles.capIcon}>
              <Icon name={cap.icon} size={14} color={colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.capTitle} numberOfLines={1}>
              {cap.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mic live hai to "sun rahi hoon" strip ke saath chalti hui waveform. */
function VoiceWave(): React.JSX.Element {
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    const loops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 110),
          Animated.timing(bar, { toValue: 1, duration: 280, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(bar, { toValue: 0.35, duration: 320, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.delay(240),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [bars]);

  return (
    <View style={styles.wave}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[styles.waveBar, { height: bar.interpolate({ inputRange: [0.35, 1], outputRange: [5, 20] }) }]}
        />
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function AIScreen(): React.JSX.Element {
  useThemePreference();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /* Input par focus ho to halka highlight (focus ring jaisa). */
  const [inputFocused, setInputFocused] = useState(false);
  /* muted = AI ka jawab awaaj me na sunao (sirf text). */
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

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

  const sendRef = useRef<(preset?: string) => void>(() => {});

  /* Voice — mic se sun kar input me likhta hai, aur final result khud bhej deta
     hai. Handlers ref se chalte hain, isliye cycle nahi banta. */
  const voice = useVoiceChat({
    onPartial: text => setInput(text),
    onFinal: text => {
      setInput(text);
      sendRef.current(text);
    },
  });

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
        /* Jawab awaaj me sunao — jab tak user ne speaker band na kar diya ho. */
        if (!mutedRef.current) {
          voice.speak(reply);
        }
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
    [input, loading, messages, voice],
  );

  sendRef.current = send;

  /* Mic sun raha ho to button halka sa pulse kare — "bol rahi hoon" ka feel. */
  const micPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!voice.listening) {
      micPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, { toValue: 1.14, duration: 480, useNativeDriver: true }),
        Animated.timing(micPulse, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [voice.listening, micPulse]);

  /* Header ka "Online" dot halka sa breathe kare — screen jinda lage. */
  const statusPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(statusPulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [statusPulse]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      voice.stopSpeaking();
    }
  };

  const clearChat = () => {
    voice.cancelListening();
    voice.stopSpeaking();
    setMessages([GREETING]);
    setInput('');
  };

  // Keyboard khula ho toh suggestions nahi dikhate — warna chips + disclaimer
  // space leke input bar ko keyboard ke neeche dhak dete hain.
  const showWelcome = messages.length <= 1 && !keyboardOpen;
  const showSuggestions = showWelcome && !loading;

  const buttonPress = (pressed: boolean) => (pressed ? { transform: [{ scale: 0.94 }] } : undefined);

  return (
    <Screen>
      {/* ------------------------------- Header ------------------------------ */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <HeaderGradient />
        {/* Halke decorative glows — depth ke liye */}
        <View style={[styles.headerBlob, styles.headerBlobA]} pointerEvents="none" />
        <View style={[styles.headerBlob, styles.headerBlobB]} pointerEvents="none" />

        <View style={styles.headerAvatar}>
          <CatIcon size={30} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[typography.h4, styles.headerTitle]} numberOfLines={1}>
            Slota AI
          </Text>
          <View style={styles.statusRow}>
            <Animated.View style={[styles.statusDot, { opacity: statusPulse }]} />
            <Text style={styles.statusText} numberOfLines={1}>
              {voice.speaking ? 'Bol rahi hoon…' : 'Online • Health assistant'}
            </Text>
          </View>
        </View>

        {/* Speaker — AI jawab awaaj me sunaye ya sirf text me (mute). */}
        <Pressable
          onPress={toggleMute}
          hitSlop={10}
          style={({ pressed }) => [styles.headerBtn, buttonPress(pressed)]}
          accessibilityLabel={muted ? 'Turn voice replies on' : 'Turn voice replies off'}
        >
          <Icon name={muted ? 'volume-x' : 'volume'} size={17} color={colors.textInverse} />
        </Pressable>
        <Pressable
          onPress={clearChat}
          hitSlop={10}
          style={({ pressed }) => [styles.headerBtn, buttonPress(pressed)]}
          accessibilityLabel="Clear chat"
        >
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
              <TypingBubble />
            ) : undefined
          }
          // Inverted list me footer visually top par aata hai — welcome hero.
          ListFooterComponent={showWelcome ? <WelcomeCard /> : undefined}
          renderItem={({ item }) => <AiMessage message={item} />}
        />

        {/* Quick suggestions — icon ke saath, tap par scale */}
        {showSuggestions ? (
          <View style={styles.suggestions}>
            <Text style={[typography.eyebrow, styles.suggestionsLabel]}>Try asking</Text>
            <View style={styles.chipWrap}>
              {SUGGESTIONS.map(suggestion => (
                <Pressable
                  key={suggestion.label}
                  onPress={() => send(suggestion.label)}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                >
                  <View style={styles.chipIcon}>
                    <Icon name={suggestion.icon} size={13} color={colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.chipText}>{suggestion.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Icon name="info" size={12} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.disclaimerText}>
            AI suggestions are informational only — not a diagnosis. Consult a doctor for medical advice.
          </Text>
        </View>

        {/* Mic on hai — live "sun rahi hoon" strip + waveform */}
        {voice.listening ? (
          <View style={styles.listeningRow}>
            <View style={styles.listeningDot} />
            <Text style={styles.listeningText}>Listening… tap the mic again to stop</Text>
            <VoiceWave />
          </View>
        ) : null}

        {/* Voice error — tap karke dismiss */}
        {voice.error ? (
          <Pressable onPress={voice.clearError} style={styles.voiceError}>
            <Icon name="alert-triangle" size={14} color={colors.warningText} />
            <Text style={styles.voiceErrorText} numberOfLines={2}>
              {voice.error}
            </Text>
            <Icon name="x" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={voice.listening ? 'Listening… speak now' : 'Ask about symptoms, tests or doctors…'}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, inputFocused && styles.inputFocused, voice.listening && styles.inputListening]}
            editable={!loading && !voice.listening}
            multiline
            onSubmitEditing={() => send()}
          />
          {/* Mic — tap karke bolo, dobara tap karke band. Awaaz input me aakar
              khud send ho jaati hai. */}
          <Animated.View style={{ transform: [{ scale: micPulse }] }}>
            <Pressable
              onPress={voice.listening ? voice.stopListening : voice.startListening}
              style={({ pressed }) => [
                styles.micBtn,
                voice.listening && styles.micBtnActive,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              accessibilityLabel={voice.listening ? 'Stop listening' : 'Ask with your voice'}
            >
              <Icon
                name="mic"
                size={19}
                color={voice.listening ? colors.textInverse : colors.textSecondary}
              />
            </Pressable>
          </Animated.View>
          <Pressable
            onPress={() => send()}
            disabled={loading || voice.listening || !input.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              (loading || voice.listening || !input.trim()) && styles.sendBtnDisabled,
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
            accessibilityLabel="Send message"
          >
            <GradientFill from={colors.blue} to={colors.primary} borderRadius={23} />
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
  /* ------------------------------- header ------------------------------- */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    zIndex: 2,
  },
  headerBlob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerBlobA: { width: 150, height: 150, right: -50, top: -70 },
  headerBlobB: { width: 90, height: 90, left: -30, bottom: -55, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.textInverse },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  statusText: { ...typography.caption, color: 'rgba(255,255,255,0.82)' },

  /* ------------------------------ messages ----------------------------- */
  messages: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  bubbleRowUser: { justifyContent: 'flex-end' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md - 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
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
    ...shadow.sm,
  },
  bubbleTextUser: { color: colors.textInverse },
  bold: { fontWeight: '800' },

  /* ------------------------- typing indicator -------------------------- */
  typingBubble: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md + 4 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  typingLabel: { marginLeft: spacing.sm, color: colors.textMuted },

  /* ---------------------------- welcome card --------------------------- */
  welcome: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  welcomeBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  welcomeTitle: { textAlign: 'center' },
  welcomeLead: { textAlign: 'center', marginTop: 3, marginBottom: spacing.md, paddingHorizontal: spacing.sm },
  capGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    width: '100%',
  },
  capItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    ...shadow.sm,
  },
  capIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capTitle: { ...typography.caption, fontSize: 10.5, color: colors.text, textAlign: 'center' },

  /* ---------------------------- suggestions ---------------------------- */
  suggestions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  suggestionsLabel: { marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    ...shadow.sm,
  },
  chipPressed: { backgroundColor: colors.cardMuted, transform: [{ scale: 0.97 }] },
  chipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },

  /* ----------------------------- disclaimer ---------------------------- */
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  disclaimerText: { ...typography.caption, color: colors.textMuted, flexShrink: 1, textAlign: 'center' },

  /* ---------------------------- input bar ------------------------------ */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    maxHeight: 110,
    minHeight: 46,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    backgroundColor: colors.cardMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.card },
  inputListening: { borderColor: colors.danger },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.blue,
    ...shadow.glow,
  },
  sendBtnDisabled: { opacity: 0.45 },

  /* ---------------------------- listening ------------------------------ */
  listeningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  listeningText: { ...typography.caption, color: colors.textSecondary },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: colors.primary },

  /* ---------------------------- voice error ---------------------------- */
  voiceError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voiceErrorText: { ...typography.small, color: colors.textSecondary, flex: 1 },
});
