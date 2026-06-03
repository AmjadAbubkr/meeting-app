import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, variant = 'primary', disabled = false }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.base, styles[variant], disabled && styles.disabled]}>
      <Text style={[styles.text, disabled && styles.disabledText]}>{label}</Text>
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
  disabled: { opacity: 0.5 },
  text: { color: 'white', fontWeight: '700', fontSize: 16 },
  disabledText: { color: '#64748b' },
});
