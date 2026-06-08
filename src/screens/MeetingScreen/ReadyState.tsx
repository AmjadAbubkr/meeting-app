import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { theme } from './theme';

type Props = {
  apiKeysReady: boolean;
  onStartRecording: () => Promise<string>;
  onUpload: () => Promise<void>;
  onCancel: () => void;
  onOpenSettings: () => void;
};

export function ReadyState({
  apiKeysReady,
  onStartRecording,
  onUpload,
  onCancel,
  onOpenSettings,
}: Props) {
  const [uploading, setUploading] = useState(false);

  const handleStart = async () => {
    try {
      await onStartRecording();
    } catch (err: any) {
      Alert.alert('Recording Error', err.message);
    }
  };

  const handleUpload = async () => {
    try {
      setUploading(true);
      await onUpload();
    } catch (err: any) {
      Alert.alert('Upload Error', err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!apiKeysReady && (
        <Pressable onPress={onOpenSettings} style={styles.apiKeyBanner}>
          <Text style={styles.apiKeyBannerText}>
            API keys required. Go to Settings to add them.
          </Text>
          <Text style={styles.apiKeyBannerLink}>Open Settings →</Text>
        </Pressable>
      )}
      <Pressable
        onPress={apiKeysReady ? handleStart : undefined}
        style={[
          styles.recordButton,
          apiKeysReady
            ? { backgroundColor: theme.accent }
            : { backgroundColor: theme.recordingBg },
        ]}
        disabled={!apiKeysReady}
      >
        <Text
          style={[
            styles.recordIcon,
            { color: apiKeysReady ? theme.bg : theme.textMuted },
          ]}
        >
          🎙️
        </Text>
      </Pressable>
      <Text style={styles.helper}>
        {apiKeysReady ? 'Tap to start recording' : 'Add API keys to continue'}
      </Text>
      <View style={styles.actions}>
        <PrimaryButton
          label="Upload Audio"
          onPress={handleUpload}
          variant="ghost"
          disabled={!apiKeysReady || uploading}
        />
        <PrimaryButton label="Cancel" onPress={onCancel} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    paddingHorizontal: 24,
  },
  apiKeyBanner: {
    backgroundColor: theme.dangerSoft,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
  },
  apiKeyBannerText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  apiKeyBannerLink: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  recordIcon: {
    fontSize: 40,
  },
  helper: {
    color: theme.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
});
