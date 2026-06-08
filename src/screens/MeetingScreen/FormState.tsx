import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../../components/PrimaryButton';
import { hasApiKey } from '../../services/apiKeys';
import { theme } from './theme';

type Props = {
  dateLabel: string;
  onCreate: (title: string) => void;
  navigation?: any;
};

export function FormState({ dateLabel, onCreate, navigation: _navigation }: Props) {
  const [title, setTitle] = useState('');
  const [apiKeysReady, setApiKeysReady] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const hasGroq = await hasApiKey('groq');
        const hasGemini = await hasApiKey('gemini');
        setApiKeysReady(hasGroq && hasGemini);
      })();
    }, []),
  );

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
      {!apiKeysReady && (
        <View style={styles.apiKeyBanner}>
          <Text style={styles.apiKeyBannerText}>
            API keys not configured. Go to Settings to add your Groq and Gemini keys.
          </Text>
        </View>
      )}
      <PrimaryButton label="Create Meeting" onPress={handleCreate} disabled={!apiKeysReady} />
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
  apiKeyBanner: {
    backgroundColor: '#2a1a0a',
    borderColor: '#d4a574',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  apiKeyBannerText: {
    color: '#d4a574',
    fontSize: 13,
  },
});
