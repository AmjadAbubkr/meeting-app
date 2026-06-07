import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { theme } from './theme';

type Props = {
  chunkCount: number;
  currentChunkIndex: number;
  onStop: () => void;
  onCancel: () => void;
};

export function RecordingState({
  chunkCount,
  currentChunkIndex,
  onStop,
  onCancel,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.indicator}>
        <View style={styles.dot} />
        <Text style={styles.indicatorLabel}>Recording</Text>
      </View>
      <Text style={styles.heading}>Recording...</Text>
      <Text style={styles.chunk}>
        Chunk {currentChunkIndex + 1} / {chunkCount}
      </Text>
      <PrimaryButton label="End Meeting" onPress={onStop} variant="danger" />
      <PrimaryButton label="Cancel Recording" onPress={onCancel} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.danger,
  },
  indicatorLabel: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heading: {
    color: theme.textMuted,
    fontSize: 24,
    fontWeight: '700',
  },
  chunk: {
    color: theme.danger,
  },
});
