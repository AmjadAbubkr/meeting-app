import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { getApiKey, hasApiKey, setApiKey } from '../services/apiKeys';

type KeyStatus = 'unknown' | 'testing' | 'valid' | 'invalid';

export function ApiKeySetupScreen({ navigation }: any) {
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqStatus, setGroqStatus] = useState<KeyStatus>('unknown');
  const [geminiStatus, setGeminiStatus] = useState<KeyStatus>('unknown');
  const [groqSaved, setGroqSaved] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Check if keys already exist in Keychain
  useEffect(() => {
    (async () => {
      const hasGroq = await hasApiKey('groq');
      const hasGemini = await hasApiKey('gemini');
      setGroqSaved(hasGroq);
      setGeminiSaved(hasGemini);
      if (hasGroq) setGroqStatus('valid');
      if (hasGemini) setGeminiStatus('valid');
      setCheckingExisting(false);
    })();
  }, []);

  const testGroqKey = useCallback(async () => {
    if (!groqKey.trim()) {
      Alert.alert('Groq', 'Enter a Groq API key first.');
      return;
    }

    setGroqStatus('testing');
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${groqKey.trim()}`,
        },
      });

      if (response.ok) {
        setGroqStatus('valid');
      } else {
        setGroqStatus('invalid');
      }
    } catch {
      setGroqStatus('invalid');
    }
  }, [groqKey]);

  const testGeminiKey = useCallback(async () => {
    if (!geminiKey.trim()) {
      Alert.alert('Gemini', 'Enter a Gemini API key first.');
      return;
    }

    setGeminiStatus('testing');
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`,
      );

      if (response.ok) {
        setGeminiStatus('valid');
      } else {
        setGeminiStatus('invalid');
      }
    } catch {
      setGeminiStatus('invalid');
    }
  }, [geminiKey]);

  const saveGroqKey = useCallback(async () => {
    if (!groqKey.trim()) return;
    await setApiKey('groq', groqKey.trim());
    setGroqSaved(true);
    setGroqStatus('valid');
  }, [groqKey]);

  const saveGeminiKey = useCallback(async () => {
    if (!geminiKey.trim()) return;
    await setApiKey('gemini', geminiKey.trim());
    setGeminiSaved(true);
    setGeminiStatus('valid');
  }, [geminiKey]);

  const handleContinue = useCallback(async () => {
    const hasGroq = await hasApiKey('groq');
    const hasGemini = await hasApiKey('gemini');

    if (!hasGroq || !hasGemini) {
      const missing: string[] = [];
      if (!hasGroq) missing.push('Groq');
      if (!hasGemini) missing.push('Gemini');
      Alert.alert('API Keys Required', `Please save the following API key(s): ${missing.join(', ')}`);
      return;
    }

    navigation.replace('Main');
  }, [navigation]);

  if (checkingExisting) {
    return (
      <ScreenShell>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScrollView style={styles.container} contentContainerStyle={{ gap: 24, paddingBottom: 40 }}>
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>API Key Setup</Text>
          <Text style={styles.subtitle}>Both keys are required to use the app.</Text>
        </View>

        {/* Groq API Key */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Groq API Key</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={groqKey}
              onChangeText={setGroqKey}
              placeholder="Groq API Key"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={styles.textInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {renderStatusIcon(groqStatus)}
          </View>
          <View style={styles.buttonRow}>
            <PrimaryButton
              label="Test Connection"
              onPress={testGroqKey}
              variant="ghost"
            />
            <PrimaryButton
              label="Save"
              onPress={saveGroqKey}
            />
          </View>
          {groqSaved && (
            <Text style={styles.savedLabel}>Key saved to device keychain</Text>
          )}
        </View>

        {/* Gemini API Key */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gemini API Key</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={geminiKey}
              onChangeText={setGeminiKey}
              placeholder="Gemini API Key"
              placeholderTextColor="#64748b"
              secureTextEntry
              style={styles.textInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {renderStatusIcon(geminiStatus)}
          </View>
          <View style={styles.buttonRow}>
            <PrimaryButton
              label="Test Connection"
              onPress={testGeminiKey}
              variant="ghost"
            />
            <PrimaryButton
              label="Save"
              onPress={saveGeminiKey}
            />
          </View>
          {geminiSaved && (
            <Text style={styles.savedLabel}>Key saved to device keychain</Text>
          )}
        </View>

        {/* Continue */}
        <PrimaryButton
          label="Continue"
          onPress={handleContinue}
        />
      </ScrollView>
    </ScreenShell>
  );
}

function renderStatusIcon(status: KeyStatus) {
  if (status === 'testing') {
    return <ActivityIndicator size="small" color="#f59e0b" style={styles.statusIcon} />;
  }
  if (status === 'valid') {
    return <Text style={styles.validIcon}>{'\u2713'}</Text>;
  }
  if (status === 'invalid') {
    return <Text style={styles.invalidIcon}>{'\u2717'}</Text>;
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#111827',
    color: 'white',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  statusIcon: {
    width: 28,
    height: 28,
  },
  validIcon: {
    color: '#22c55e',
    fontSize: 28,
    fontWeight: '700',
  },
  invalidIcon: {
    color: '#ef4444',
    fontSize: 28,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  savedLabel: {
    color: '#22c55e',
    fontSize: 13,
  },
});
