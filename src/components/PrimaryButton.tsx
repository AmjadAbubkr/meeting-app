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
      <Text style={[styles.text, variant === 'ghost' && styles.ghostText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: '#d4a574' },
  danger: { backgroundColor: '#ff4757' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(212,165,116,0.35)' },
  disabled: { opacity: 0.5 },
  text: { color: '#0f0f0f', fontWeight: '600', fontSize: 16 },
  ghostText: { color: '#d4a574' },
  disabledText: { color: '#8a7e72' },
});
