import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { getSetting, setSetting, deleteAllData, getStorageInfo } from '../db/database';
import {
  getApiKey,
  setApiKey,
  hasApiKey,
  deleteApiKey,
} from '../services/apiKeys';
import { hasPasscode, savePasscode, verifyPasscode } from '../services/passcode';
import type { Language } from '../store/appStore';

type EditingKey = 'groq' | 'gemini' | null;

export function SettingsScreen({ navigation, noSafeArea }: any) {
  const [defaultLanguage, setDefaultLanguage] = useState<Language>('EN');
  const [groqExists, setGroqExists] = useState(false);
  const [geminiExists, setGeminiExists] = useState(false);
  const [editingKey, setEditingKey] = useState<EditingKey>(null);
  const [editingKeyValue, setEditingKeyValue] = useState('');
  const [testingKey, setTestingKey] = useState<'groq' | 'gemini' | null>(null);
  const [testResult, setTestResult] = useState<'valid' | 'invalid' | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ meetingCount: number; audioSizeMB: number }>({
    meetingCount: 0,
    audioSizeMB: 0,
  });

  // Passcode change state
  const [changingPasscode, setChangingPasscode] = useState(false);
  const [passcodeStep, setPasscodeStep] = useState<'verify' | 'new' | 'confirm'>('verify');
  const [oldPasscode, setOldPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const lang = await getSetting('defaultLanguage');
    if (lang === 'EN' || lang === 'FR') {
      setDefaultLanguage(lang);
    }

    const gExists = await hasApiKey('groq');
    const gemExists = await hasApiKey('gemini');
    setGroqExists(gExists);
    setGeminiExists(gemExists);

    const info = await getStorageInfo();
    setStorageInfo(info);
  };

  // Language selection
  const handleLanguageChange = useCallback(async (lang: Language) => {
    setDefaultLanguage(lang);
    await setSetting('defaultLanguage', lang);
  }, []);

  // API Key editing
  const handleStartEditKey = useCallback((key: EditingKey) => {
    setEditingKey(key);
    setEditingKeyValue('');
    setTestResult(null);
  }, []);

  const handleSaveKey = useCallback(async () => {
    if (!editingKey || !editingKeyValue.trim()) return;
    await setApiKey(editingKey, editingKeyValue.trim());
    if (editingKey === 'groq') setGroqExists(true);
    if (editingKey === 'gemini') setGeminiExists(true);
    setEditingKey(null);
    setEditingKeyValue('');
    setTestResult(null);
  }, [editingKey, editingKeyValue]);

  const handleCancelEditKey = useCallback(() => {
    setEditingKey(null);
    setEditingKeyValue('');
    setTestResult(null);
  }, []);

  const handleTestKey = useCallback(
    async (keyName: 'groq' | 'gemini') => {
      setTestingKey(keyName);
      setTestResult(null);

      try {
        let keyValue: string;
        if (editingKey === keyName && editingKeyValue.trim()) {
          keyValue = editingKeyValue.trim();
        } else {
          keyValue = await getApiKey(keyName);
        }

        if (!keyValue) {
          setTestResult('invalid');
          setTestingKey(null);
          return;
        }

        if (keyName === 'groq') {
          const response = await fetch('https://api.groq.com/openai/v1/models', {
            method: 'GET',
            headers: { Authorization: `Bearer ${keyValue}` },
          });
          setTestResult(response.ok ? 'valid' : 'invalid');
        } else {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${keyValue}`,
          );
          setTestResult(response.ok ? 'valid' : 'invalid');
        }
      } catch {
        setTestResult('invalid');
      } finally {
        setTestingKey(null);
      }
    },
    [editingKey, editingKeyValue],
  );

  const handleClearKey = useCallback(async (keyName: 'groq' | 'gemini') => {
    Alert.alert('Clear API Key', `Remove the ${keyName === 'groq' ? 'Groq' : 'Gemini'} API key from this device?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await deleteApiKey(keyName);
          if (keyName === 'groq') setGroqExists(false);
          if (keyName === 'gemini') setGeminiExists(false);
          setEditingKey(null);
          setTestResult(null);
        },
      },
    ]);
  }, []);

  // Clear all data
  const handleClearAllData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all meetings, settings, and audio files. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            await deleteAllData();
            setStorageInfo({ meetingCount: 0, audioSizeMB: 0 });
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ],
    );
  }, []);

  // Passcode change flow
  const handleChangePasscode = useCallback(() => {
    setChangingPasscode(true);
    setPasscodeStep('verify');
    setOldPasscode('');
    setNewPasscode('');
    setConfirmPasscode('');
  }, []);

  const handleVerifyOldPasscode = useCallback(async () => {
    const ok = await verifyPasscode(oldPasscode);
    if (ok) {
      setPasscodeStep('new');
    } else {
      Alert.alert('Incorrect', 'The current passcode is incorrect.');
    }
  }, [oldPasscode]);

  const handleNewPasscode = useCallback(() => {
    if (newPasscode.length !== 6) {
      Alert.alert('Passcode', 'Enter a 6-digit passcode.');
      return;
    }
    setPasscodeStep('confirm');
  }, [newPasscode]);

  const handleConfirmNewPasscode = useCallback(async () => {
    if (newPasscode !== confirmPasscode) {
      Alert.alert('Passcode', 'Passcodes do not match.');
      return;
    }
    await savePasscode(newPasscode);
    setChangingPasscode(false);
    Alert.alert('Passcode Changed', 'Your passcode has been updated.');
  }, [newPasscode, confirmPasscode]);

  const handleCancelPasscodeChange = useCallback(() => {
    setChangingPasscode(false);
  }, []);

  return (
    <ScreenShell noSafeArea={noSafeArea}>
      <ScrollView style={styles.container} contentContainerStyle={{ gap: 28, paddingBottom: 40 }}>
        <Text style={styles.title}>Settings</Text>

        {/* Passcode change flow (shown instead of settings when active) */}
        {changingPasscode ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {passcodeStep === 'verify'
                ? 'Verify Current Passcode'
                : passcodeStep === 'new'
                  ? 'Enter New Passcode'
                  : 'Confirm New Passcode'}
            </Text>
            <TextInput
              value={
                passcodeStep === 'verify'
                  ? oldPasscode
                  : passcodeStep === 'new'
                    ? newPasscode
                    : confirmPasscode
              }
              onChangeText={
                passcodeStep === 'verify'
                  ? setOldPasscode
                  : passcodeStep === 'new'
                    ? setNewPasscode
                    : setConfirmPasscode
              }
              placeholder={
                passcodeStep === 'verify'
                  ? 'Current passcode'
                  : passcodeStep === 'new'
                    ? 'New 6-digit passcode'
                    : 'Confirm new passcode'
              }
              placeholderTextColor="#8a7e72"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.textInput}
            />
            <View style={styles.buttonRow}>
              <PrimaryButton
                label={
                  passcodeStep === 'verify'
                    ? 'Verify'
                    : passcodeStep === 'new'
                      ? 'Next'
                      : 'Save'
                }
                onPress={
                  passcodeStep === 'verify'
                    ? handleVerifyOldPasscode
                    : passcodeStep === 'new'
                      ? handleNewPasscode
                      : handleConfirmNewPasscode
                }
              />
              <PrimaryButton
                label="Cancel"
                onPress={handleCancelPasscodeChange}
                variant="ghost"
              />
            </View>
          </View>
        ) : (
          <>
            {/* Default Language */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Default Language</Text>
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => handleLanguageChange('EN')}
                  style={[styles.chip, defaultLanguage === 'EN' && styles.chipActive]}
                >
                  <Text style={[styles.chipText, defaultLanguage === 'EN' && styles.chipTextActive]}>
                    English
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleLanguageChange('FR')}
                  style={[styles.chip, defaultLanguage === 'FR' && styles.chipActive]}
                >
                  <Text style={[styles.chipText, defaultLanguage === 'FR' && styles.chipTextActive]}>
                    Français
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* API Keys */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>API Keys</Text>

              {/* Groq */}
              <View style={styles.keyRow}>
                <View style={styles.keyInfo}>
                  <Text style={styles.keyLabel}>Groq API Key</Text>
                  <Text style={groqExists ? styles.keySet : styles.keyNotSet}>
                    {groqExists ? '•••••••' : 'Not set'}
                  </Text>
                </View>
                <View style={styles.keyActions}>
                  {testingKey === 'groq' ? (
                    <ActivityIndicator size="small" color="#d4a574" />
                  ) : testResult === 'valid' && editingKey === 'groq' ? (
                    <Text style={styles.validIcon}>{'\u2713'}</Text>
                  ) : testResult === 'invalid' && editingKey === 'groq' ? (
                    <Text style={styles.invalidIcon}>{'\u2717'}</Text>
                  ) : null}
                  <Pressable onPress={() => handleTestKey('groq')} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Test</Text>
                  </Pressable>
                  <Pressable onPress={() => handleClearKey('groq')} style={styles.smallBtnDanger}>
                    <Text style={styles.smallBtnDangerText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
              {editingKey === 'groq' ? (
                <View style={styles.editKeyRow}>
                  <TextInput
                    value={editingKeyValue}
                    onChangeText={setEditingKeyValue}
                    placeholder="Enter new Groq key"
                    placeholderTextColor="#8a7e72"
                    secureTextEntry
                    style={styles.textInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.buttonRow}>
                    <PrimaryButton label="Save" onPress={handleSaveKey} />
                    <PrimaryButton label="Cancel" onPress={handleCancelEditKey} variant="ghost" />
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => handleStartEditKey('groq')} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit Groq Key</Text>
                </Pressable>
              )}

              {/* Gemini */}
              <View style={styles.keyRow}>
                <View style={styles.keyInfo}>
                  <Text style={styles.keyLabel}>Gemini API Key</Text>
                  <Text style={geminiExists ? styles.keySet : styles.keyNotSet}>
                    {geminiExists ? '•••••••' : 'Not set'}
                  </Text>
                </View>
                <View style={styles.keyActions}>
                  {testingKey === 'gemini' ? (
                    <ActivityIndicator size="small" color="#d4a574" />
                  ) : testResult === 'valid' && editingKey === 'gemini' ? (
                    <Text style={styles.validIcon}>{'\u2713'}</Text>
                  ) : testResult === 'invalid' && editingKey === 'gemini' ? (
                    <Text style={styles.invalidIcon}>{'\u2717'}</Text>
                  ) : null}
                  <Pressable onPress={() => handleTestKey('gemini')} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Test</Text>
                  </Pressable>
                  <Pressable onPress={() => handleClearKey('gemini')} style={styles.smallBtnDanger}>
                    <Text style={styles.smallBtnDangerText}>Clear</Text>
                  </Pressable>
                </View>
              </View>
              {editingKey === 'gemini' ? (
                <View style={styles.editKeyRow}>
                  <TextInput
                    value={editingKeyValue}
                    onChangeText={setEditingKeyValue}
                    placeholder="Enter new Gemini key"
                    placeholderTextColor="#8a7e72"
                    secureTextEntry
                    style={styles.textInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.buttonRow}>
                    <PrimaryButton label="Save" onPress={handleSaveKey} />
                    <PrimaryButton label="Cancel" onPress={handleCancelEditKey} variant="ghost" />
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => handleStartEditKey('gemini')} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit Gemini Key</Text>
                </Pressable>
              )}
            </View>

            {/* Change Passcode */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security</Text>
              <PrimaryButton label="Change Passcode" onPress={handleChangePasscode} />
            </View>

            {/* Clear All Data */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Data</Text>
              <PrimaryButton label="Clear All Data" onPress={handleClearAllData} variant="danger" />
            </View>

            {/* Storage Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Storage</Text>
              <Text style={styles.bodyText}>
                {storageInfo.meetingCount} meeting{storageInfo.meetingCount !== 1 ? 's' : ''},{' '}
                {storageInfo.audioSizeMB} MB audio
              </Text>
            </View>

            {/* About */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bodyText}>Meeting App v0.1.0</Text>
              <Text style={styles.subtitleText}>
                Transcribe, summarize, and report on your meetings with AI.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    color: '#e8d5b7',
    fontSize: 28,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#d4a574',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
  },
  chipActive: {
    backgroundColor: '#d4a574',
  },
  chipText: {
    color: '#8a7e72',
    fontWeight: '700',
    fontSize: 15,
  },
  chipTextActive: {
    color: '#0f0f0f',
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.15)',
  },
  keyInfo: {
    gap: 2,
  },
  keyLabel: {
    color: '#f5f0eb',
    fontSize: 15,
    fontWeight: '600',
  },
  keySet: {
    color: '#6dbf67',
    fontSize: 13,
  },
  keyNotSet: {
    color: '#e74c3c',
    fontSize: 13,
  },
  keyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  validIcon: {
    color: '#6dbf67',
    fontSize: 22,
    fontWeight: '700',
  },
  invalidIcon: {
    color: '#e74c3c',
    fontSize: 22,
    fontWeight: '700',
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  smallBtnText: {
    color: '#d4a574',
    fontSize: 13,
    fontWeight: '600',
  },
  smallBtnDanger: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  smallBtnDangerText: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
  },
  editKeyRow: {
    gap: 10,
  },
  textInput: {
    backgroundColor: '#141414',
    color: '#f5f0eb',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.15)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editBtn: {
    paddingVertical: 8,
  },
  editBtnText: {
    color: '#d4a574',
    fontSize: 14,
    fontWeight: '600',
  },
  bodyText: {
    color: '#f5f0eb',
    fontSize: 16,
  },
  subtitleText: {
    color: '#8a7e72',
    fontSize: 14,
  },
});
