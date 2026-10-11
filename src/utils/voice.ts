/**
 * Slota AI voice helper — do kaam ek jagah:
 *
 *  1. Mic se user ki baat sunti hai (speech-to-text → @react-native-voice/voice)
 *  2. AI ka jawab awaaz me bolti hai (text-to-speech → react-native-tts)
 *
 * Dono free hain — recognizer phone ke apne (Google/Apple) engine par chalta
 * hai, koi API key ya paid service nahi. Native setup jo zaroori hai:
 *
 *  - Android: manifest me `RECORD_AUDIO` (runtime request isi file me hoti hai).
 *  - iOS: Info.plist me `NSMicrophoneUsageDescription` +
 *    `NSSpeechRecognitionUsageDescription` (pehle se add kar diye hain).
 *
 * Locale `en-IN` — India-focused app, aur Indian English voice dono platforms
 * par aasani se milti hai.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';

const LOCALE = 'en-IN';

const MIC_DIALOG = {
  title: 'Microphone permission',
  message:
    'Slota AI se awaaz me poochne ke liye microphone chahiye — isse aapki baat text me badli jaati hai.',
  buttonPositive: 'Allow',
  buttonNegative: 'Deny',
};

/**
 * Markdown/emojis hata kar "bolne layak" text banata hai — TTS ko `**bold**`
 * ya harfi-harfi symbols na sunao.
 */
export function speakable(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/[#*_>`~[\]]/g, '')
    .replace(/\((?:https?|tel):[^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface VoiceHandlers {
  /** Live partial result — input bar me "sun rahi hoon" ka feel deta hai. */
  onPartial: (text: string) => void;
  /** Final recognized text — isi se message send hota hai. */
  onFinal: (text: string) => void;
}

export interface VoiceChat {
  listening: boolean;
  speaking: boolean;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => Promise<void>;
  /** AI ka reply awaaz me bolta hai. */
  speak: (text: string) => void;
  stopSpeaking: () => void;
  clearError: () => void;
}

export function useVoiceChat(handlers: VoiceHandlers): VoiceChat {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Handlers har render me badalte hain (closures) — native events isi ref
     se latest version tak pahunchte hain. */
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  /* Android par kabhi kabhi Voice.stop() ke baad final result aata hi nahi —
     tab mic hamesha ke liye "sun raha" dikhne lagta hai. Ye timer waisi
     situation me listening khud band kar deta hai. */
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStopTimer = useCallback(() => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
  }, []);

  useEffect(() => {
    /* TTS lifecycle — mute button ka state isi se pata chalta hai.
       (Typing me addEventListener `void` dikhata hai, par runtime me wo
        subscription deta hai jisme `.remove()` hota hai.) */
    type Subscription = { remove: () => void };
    const subs: Subscription[] = [
      Tts.addEventListener('tts-start', () => setSpeaking(true)),
      Tts.addEventListener('tts-finish', () => setSpeaking(false)),
      Tts.addEventListener('tts-cancel', () => setSpeaking(false)),
      Tts.addEventListener('tts-error', () => setSpeaking(false)),
    ] as unknown as Subscription[];

    /* Thoda dheere taaki medical terms saaf samajh me aayein; language na
        mili to device default par chalne dete hain (catch khaali hai). */
    Tts.setDefaultRate(0.5).catch(() => {});
    Tts.setDefaultLanguage(LOCALE).catch(() => {});

    Voice.onSpeechStart = () => setListening(true);
    Voice.onSpeechPartialResults = e => {
      const text = e?.value?.[0];
      if (text) {
        handlersRef.current.onPartial(text);
      }
    };
    Voice.onSpeechResults = e => {
      const text = e?.value?.[0]?.trim();
      clearStopTimer();
      setListening(false);
      if (text) {
        handlersRef.current.onFinal(text);
      }
    };
    Voice.onSpeechEnd = () => {
      clearStopTimer();
      setListening(false);
    };
    Voice.onSpeechError = e => {
      clearStopTimer();
      setListening(false);
      /* Android codes 6 (speech timeout) aur 7 (no match) ka matlab hai
         "user ne kuch bola hi nahi" — ye error nahi, normal case hai. */
      const raw: unknown = (e as { error?: { code?: number | string } })?.error?.code;
      const code = typeof raw === 'string' ? Number(raw) : raw;
      if (code !== 6 && code !== 7) {
        setError(
          (e as { error?: { message?: string } })?.error?.message ||
            'Could not hear you clearly. Please try again.',
        );
      }
    };

    return () => {
      clearStopTimer();
      subs.forEach(s => s.remove());
      Voice.destroy()
        .then(() => Voice.removeAllListeners())
        .catch(() => {});
    };
  }, [clearStopTimer]);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      /* Mic chalu ho to TTS band — warna app khud ki awaaz sun lega. */
      await Tts.stop().catch(() => {});

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          MIC_DIALOG,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Microphone permission chahiye — Settings me jaake allow karein.');
          return;
        }
      }

      setListening(true);
      await Voice.start(LOCALE);
    } catch (e) {
      setListening(false);
      setError(
        (e as Error)?.message || 'Speech recognition is not available on this device.',
      );
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      /* Result Voice.onSpeechResults me aayega — wahi input me set karke
         bhej dega. Agar 3 second me result hi na aaye (chup rehna, ya device
         ka recognizer hang), to mic khud band kar dete hain. */
      clearStopTimer();
      stopTimer.current = setTimeout(() => {
        stopTimer.current = null;
        Voice.cancel().catch(() => {});
        setListening(false);
      }, 3000);
      await Voice.stop();
    } catch {
      clearStopTimer();
      setListening(false);
    }
  }, [clearStopTimer]);

  const cancelListening = useCallback(async () => {
    clearStopTimer();
    try {
      await Voice.cancel();
    } catch {
      /* ignore */
    } finally {
      setListening(false);
    }
  }, [clearStopTimer]);

  const speak = useCallback((text: string) => {
    const clean = speakable(text);
    if (!clean) {
      return;
    }
    Tts.stop()
      .then(() => Tts.speak(clean))
      .catch(() => {});
  }, []);

  const stopSpeaking = useCallback(() => {
    Tts.stop().catch(() => {});
  }, []);

  return {
    listening,
    speaking,
    error,
    startListening,
    stopListening,
    cancelListening,
    speak,
    stopSpeaking,
    clearError: useCallback(() => setError(null), []),
  };
}
