import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
};

export function PrimaryButton({ label, onPress, variant = 'primary' }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.base, styles[variant]]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: '#d97706' },
  danger: { backgroundColor: '#b91c1c' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' },
  text: { color: 'white', fontWeight: '700', fontSize: 16 },
});
