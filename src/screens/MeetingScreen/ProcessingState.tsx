import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { theme } from './theme';

type Props = {
  stepLabel: string;
  error: string | null;
  hasTranscript: boolean;
  failedStepIndex: number | null;
  onRetry: () => Promise<void>;
  onKeepTranscriptOnly: () => Promise<void>;
  onCancel: () => void;
};

export function ProcessingState({
  stepLabel,
  error,
  hasTranscript,
  failedStepIndex,
  onRetry,
  onKeepTranscriptOnly,
  onCancel,
}: Props) {
  if (!error) {
    return (
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.stepLabel}>{stepLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorHeading}>Processing Failed</Text>
      <Text style={styles.errorText}>{error}</Text>

      <View style={styles.actions}>
        <PrimaryButton label="Retry" onPress={onRetry} />

        {hasTranscript && failedStepIndex !== null && failedStepIndex >= 1 && (
          <PrimaryButton
            label="Keep transcript only"
            onPress={onKeepTranscriptOnly}
            variant="ghost"
          />
        )}

        <PrimaryButton label="Cancel" onPress={onCancel} variant="danger" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spinnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  stepLabel: {
    color: theme.textMuted,
    fontSize: 22,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  errorHeading: {
    color: theme.danger,
    fontSize: 20,
    fontWeight: '700',
  },
  errorText: {
    color: theme.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
});
