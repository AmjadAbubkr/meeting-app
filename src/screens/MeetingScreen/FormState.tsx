import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { theme } from './theme';

type Props = {
  dateLabel: string;
  onCreate: (title: string) => void;
};

export function FormState({ dateLabel, onCreate }: Props) {
  const [title, setTitle] = useState('');

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Meeting', 'Enter a meeting title.');
      return;
    }
    onCreate(title.trim());
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Meeting title"
        placeholderTextColor={theme.textMuted}
        style={styles.input}
      />
      <Text style={styles.date}>{dateLabel}</Text>
      <PrimaryButton label="Create Meeting" onPress={handleCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.accentSoft,
  },
  date: {
    color: theme.textMuted,
  },
});
