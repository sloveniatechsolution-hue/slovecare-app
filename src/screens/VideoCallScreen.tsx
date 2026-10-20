/**
 * VideoCallScreen — asli WebRTC video consultation (dark full-screen).
 * Session src/consultation/videoCall.ts sambhalta hai (permissions, media,
 * signaling, ICE restart, cleanup) — screen sirf UI + controls.
 * Room authorization backend par hota hai (booking + payment verify).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon, { IconName } from '../components/Icon';
import { AppButton } from '../components/UI';
import videoCall, { CallError, VideoCallSession } from '../consultation/videoCall';
import type { CallEvent, CallState, CallEndReason } from '../consultation/types';
import { RootStackParamList } from '../navigation/types';

import { colors, radius, spacing, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoCall'>;

const STATE_LABEL: Record<CallState, string> = {
  idle: 'Preparing…',
  preparing: 'Preparing camera & mic…',
  connecting: 'Connecting…',
  waiting: 'Waiting for the doctor to join…',
  connecting_peer: 'Connecting to the doctor…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  ended: 'Call ended',
  failed: 'Call failed',
};

const END_REASON_TEXT: Record<string, string> = {
  local: 'You ended the call.',
  remote: 'The doctor ended the call.',
  rejected: 'The doctor could not join right now.',
  expired: 'The consultation window has expired.',
  unauthorized: 'You are not authorized for this consultation.',
  error: 'The call dropped due to a network problem.',
};

function durationLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoCallScreen({ navigation, route }: Props): React.JSX.Element {
  const { bookingId, peerName } = route.params;
  const insets = useSafeAreaInsets();
  /**
   * Theme subscription — call screen hamesha dark hai (call UI convention),
   * is liye uske surfaces `FIXED_COLORS` me registered hain aur kabhi
   * Light Mode me white nahi hote. Ye subscription is liye hai ki screen ke
   * theme-aware hisse (AppButton, Icon) turant update hon.
   */
  useThemePreference();

  const [session, setSession] = useState<VideoCallSession | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [stateDetail, setStateDetail] = useState<string | undefined>();
  const [localStream, setLocalStream] = useState<ReturnType<VideoCallSession['getLocalStream']>>(null);
  const [remoteStream, setRemoteStream] = useState<ReturnType<VideoCallSession['getRemoteStream']>>(null);
  const [endReason, setEndReason] = useState<CallEndReason | null>(null);
  const [seconds, setSeconds] = useState(0);

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);

  const sessionRef = useRef<VideoCallSession | null>(null);
  const endedRef = useRef(false);

  /* -------------------------------- start ---------------------------------- */
  const start = useCallback(async () => {
    setStartError(null);
    endedRef.current = false;
    setSeconds(0);
    setEndReason(null);
    try {
      /* Purana session (retry) pehle cleanup. */
      sessionRef.current?.end(false, 'local');
      const s = await videoCall.start({ bookingId, role: 'patient' });
      sessionRef.current = s;
      setSession(s);
    } catch (e) {
      const message =
        e instanceof CallError
          ? e.message
          : (e as Error)?.message || 'Could not start the video call. Please check camera/mic permissions.';
      setStartError(message);
    }
  }, [bookingId]);

  useEffect(() => {
    start();
    return () => {
      /* Screen unmount par call band — tracks/listeners release. */
      sessionRef.current?.end(!endedRef.current);
    };
  }, [start]);

  /* ------------------------------ subscribe -------------------------------- */
  useEffect(() => {
    if (!session) {
      return undefined;
    }
    const unsubscribe = session.subscribe((event: CallEvent) => {
      switch (event.type) {
        case 'state':
          setState(event.state);
          setStateDetail(event.detail);
          break;
        case 'local-stream':
          setLocalStream(event.stream);
          break;
        case 'remote-stream':
          setRemoteStream(event.stream);
          break;
        case 'ended':
          endedRef.current = true;
          setEndReason(event.reason);
          break;
        default:
          break;
      }
    });
    return unsubscribe;
  }, [session]);

  /* Call timer — connected hone ke baad. */
  useEffect(() => {
    if (state !== 'connected') {
      return undefined;
    }
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  /* ------------------------------- controls -------------------------------- */
  const toggleMute = () => {
    const next = !muted;
    sessionRef.current?.setAudioEnabled(!next); // true = mic ON
    setMuted(next);
  };

  const toggleCamera = () => {
    const next = !cameraOff;
    sessionRef.current?.setVideoEnabled(!next); // true = camera ON
    setCameraOff(next);
  };

  const toggleSpeaker = () => {
    const next = !speakerOn;
    sessionRef.current?.setSpeaker(next);
    setSpeakerOn(next);
  };

  const endCall = () => {
    Alert.alert('End consultation?', 'The video call will end for both of you.', [
      { text: 'Continue Call', style: 'cancel' },
      {
        text: 'End Call',
        style: 'destructive',
        onPress: () => {
          endedRef.current = true;
          sessionRef.current?.end(true, 'local');
          navigation.goBack();
        },
      },
    ]);
  };

  /* --------------------------------- view ---------------------------------- */
  /* Error state (permission denied / start fail) — dark screen par hi. */
  if (startError) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.center, { paddingBottom: insets.bottom }]}>
          <View style={styles.errorIcon}>
            <Icon name="alert-triangle" size={30} color={colors.danger} />
          </View>
          <Text style={styles.errorTitle}>Could not start the call</Text>
          <Text style={styles.errorText}>{startError}</Text>
          <View style={styles.endRow}>
            <AppButton label="Go Back" variant="outline" size="md" full={false} onPress={() => navigation.goBack()} />
            <AppButton label="Try Again" icon="refresh" size="md" full={false} onPress={start} />
          </View>
        </View>
      </View>
    );
  }

  const ended = state === 'ended' || state === 'failed';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Remote video — poori screen */}
      {remoteStream ? (
        <View style={StyleSheet.absoluteFill}>
          <RemoteVideo stream={remoteStream} />
        </View>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {/* Waiting avatar — doctor ka asli chehra tabhi dikhta hai jab call connect ho */}
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(peerName || 'D')
                .split(' ')
                .slice(0, 2)
                .map(p => p.charAt(0).toUpperCase())
                .join('')}
            </Text>
          </View>
          <Text style={styles.waitingName}>{peerName || 'Doctor'}</Text>
          <Text style={styles.waitingStatus}>
            {state === 'reconnecting' ? stateDetail || 'Reconnecting…' : STATE_LABEL[state]}
          </Text>
        </View>
      )}

      {/* Local preview — top-right corner (mirror) */}
      {localStream && !cameraOff && !ended ? (
        <View style={[styles.localPreview, { top: insets.top + spacing.md }]}>
          <LocalVideo stream={localStream} />
        </View>
      ) : null}

      {/* Header — name, timer, status */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerBack}>
          <Icon name="chevron-left" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>
            {peerName || 'Doctor'}
          </Text>
          <Text style={styles.headerSub}>
            {state === 'connected' ? durationLabel(seconds) : STATE_LABEL[state]}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* End state overlay — retry / back */}
      {ended ? (
        <View style={[styles.center, styles.endOverlay]}>
          <Text style={styles.errorTitle}>{state === 'failed' ? 'Call dropped' : 'Call ended'}</Text>
          <Text style={styles.errorText}>
            {stateDetail || END_REASON_TEXT[endReason ?? ''] || 'The call has ended.'}
          </Text>
          <View style={styles.endRow}>
            <AppButton label="Done" variant="outline" size="md" full={false} onPress={() => navigation.goBack()} />
            {state === 'failed' ? (
              <AppButton label="Retry" icon="refresh" size="md" full={false} onPress={start} />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Controls bar */}
      {!ended ? (
        <View style={[styles.controls, { paddingBottom: insets.bottom + spacing.lg }]}>
          <ControlButton
            icon="mic"
            label={muted ? 'Unmute' : 'Mute'}
            active={muted}
            onPress={toggleMute}
          />
          <ControlButton
            icon="video"
            label={cameraOff ? 'Start Video' : 'Stop Video'}
            active={cameraOff}
            onPress={toggleCamera}
          />
          <ControlButton icon="refresh" label="Flip" onPress={() => sessionRef.current?.switchCamera()} />
          <ControlButton
            icon={speakerOn ? 'volume' : 'volume-x'}
            label="Speaker"
            active={!speakerOn}
            onPress={toggleSpeaker}
          />
          <ControlButton icon="phone" label="End" danger onPress={endCall} />
        </View>
      ) : null}
    </View>
  );
}

/* --------------------------- video sub-components -------------------------- */

/** Remote video — peerJoined ke baad hi mount (zIndex low). */
function RemoteVideo({ stream }: { stream: NonNullable<ReturnType<VideoCallSession['getRemoteStream']>> }) {
  const { RTCView } = require('react-native-webrtc');
  return (
    <RTCView
      streamURL={stream.toURL()}
      objectFit="cover"
      zOrder={0}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** Local preview — mirror + zOrder upar. */
function LocalVideo({ stream }: { stream: NonNullable<ReturnType<VideoCallSession['getLocalStream']>> }) {
  const { RTCView } = require('react-native-webrtc');
  return (
    <RTCView
      streamURL={stream.toURL()}
      objectFit="cover"
      mirror
      zOrder={1}
      style={StyleSheet.absoluteFill}
    />
  );
}

function ControlButton({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.controlBtn} hitSlop={6}>
      <View style={[styles.controlCircle, danger && styles.controlDanger, active && styles.controlActive]}>
        <Icon name={icon} size={22} color={danger || active ? '#fff' : '#fff'} />
      </View>
      <Text style={styles.controlLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(11,18,32,0.55)',
  },
  headerBack: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: { ...typography.smallMedium, color: '#fff' },
  headerSub: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  headerSpacer: { width: 22 },
  waitingName: { ...typography.h4, color: '#fff', marginTop: spacing.lg },
  waitingStatus: {
    ...typography.small,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    ...typography.h3,
    color: '#fff',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 300,
  },
  endOverlay: { backgroundColor: 'rgba(11,18,32,0.92)' },
  endRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  localPreview: {
    position: 'absolute',
    right: spacing.lg,
    width: 108,
    height: 150,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: '#131C2E',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 34, fontWeight: '800', color: '#fff' },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingTop: spacing.lg,
    backgroundColor: 'rgba(11,18,32,0.75)',
  },
  controlBtn: { alignItems: 'center', gap: 6, width: 62 },
  controlCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { backgroundColor: 'rgba(255,255,255,0.34)' },
  controlDanger: { backgroundColor: colors.danger },
  controlLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
