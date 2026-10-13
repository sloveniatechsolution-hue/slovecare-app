/**
 * AvatarPicker — profile photo (ya initials) + camera badge.
 * Badge dabao → camera/gallery me se photo chuno → /upload/image pe Cloudinary
 * upload → onUploaded(url) callback backend me save karta hai.
 * Default (dicebear) avatar ko photo nahi maana jata — uspar initials hi dikhte hain.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CameraOptions, ImageLibraryOptions, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from './Icon';
import api, { apiOrigin } from '../api/api';
import { colors, shadow, typography } from '../theme/theme';
import { useThemePreference } from '../theme/ThemeContext';

/** Avatar URL ko absolute banao; dicebear (default) avatar ke liye undefined. */
export function avatarImage(avatar?: string | null): string | undefined {
  const value = (avatar || '').trim();
  if (!value || value.includes('dicebear.com')) {
    return undefined;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const origin = apiOrigin();
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
}

/** "Jayesh Malviya" -> "JM" — photo na ho to naam ke initials. */
export function avatarInitials(name?: string | null): string {
  if (!name || !name.trim()) {
    return 'SC';
  }
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

const PICKER_OPTIONS: CameraOptions & ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.8,
  maxWidth: 1000,
  maxHeight: 1000,
  selectionLimit: 1,
  includeBase64: false,
};

interface AvatarPickerProps {
  avatar?: string | null;
  name?: string;
  /** Avatar ka diameter (px). */
  size?: number;
  /** true = camera badge dikhega aur photo badal sakte ho. */
  editable?: boolean;
  /** Photo upload ke baad Cloudinary URL — yahan backend me save karo. */
  onUploaded?: (url: string) => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
}

export default function AvatarPicker({
  avatar,
  name,
  size = 64,
  editable = true,
  onUploaded,
  style,
}: AvatarPickerProps): React.JSX.Element {
  useThemePreference();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const uri = failed ? undefined : avatarImage(avatar);
  const badge = Math.max(24, Math.round(size * 0.36));

  const run = async (source: 'camera' | 'library') => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = source === 'camera' ? await launchCamera(PICKER_OPTIONS) : await launchImageLibrary(PICKER_OPTIONS);

      if (result.didCancel) {
        return;
      }
      if (result.errorCode || result.errorMessage) {
        throw new Error(result.errorMessage || 'Could not open the photo picker.');
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error('Could not read the selected photo. Please try another one.');
      }

      const uploaded = await api.uploads.image({
        uri: asset.uri,
        name: asset.fileName || `profile_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
      });

      await onUploaded?.(uploaded.url);
      setFailed(false);
    } catch (error) {
      Alert.alert('Profile photo', (error as Error).message || 'Photo upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => {
    if (!editable || busy) {
      return;
    }
    Alert.alert('Profile photo', 'Choose how you want to add your photo', [
      { text: 'Take photo', onPress: () => run('camera') },
      { text: 'Choose from gallery', onPress: () => run('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const circle = (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        !uri && { backgroundColor: colors.primaryLight, borderColor: colors.border, borderWidth: 1 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[typography.h3, styles.initials, { fontSize: Math.round(size * 0.34) }]}>
          {avatarInitials(name)}
        </Text>
      )}

      {busy ? (
        <View style={[styles.loading, { borderRadius: size / 2 }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );

  if (!editable) {
    return <View style={style}>{circle}</View>;
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        {circle}
        <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
          <Icon name="camera" size={Math.round(badge * 0.55)} color={colors.textInverse} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.cardMuted,
  },
  initials: { color: colors.primary, fontWeight: '700' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.card,
    ...shadow.float,
  },
});
