import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Keyboard, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { hasPasscode, savePasscode, verifyPasscode } from '../services/passcode';
import { useAppStore } from '../store/appStore';

export function PasscodeScreen({ navigation }: any) {
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);
  const [mode, setMode] = useState<'setup' | 'entry'>('entry');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    hasPasscode().then((exists) => setMode(exists ? 'entry' : 'setup'));
  }, []);

  const title = useMemo(() => (mode === 'setup' ? 'Create a passcode' : 'Enter passcode'), [mode]);

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (mode === 'setup') {
      if (passcode.length !== 6 || confirmPasscode.length !== 6) {
        Alert.alert('Passcode', 'Enter a 6-digit passcode twice.');
        return;
      }
      if (passcode !== confirmPasscode) {
        Alert.alert('Passcode', 'Passcodes do not match.');
        return;
      }
      await savePasscode(passcode);
      setAuthenticated(true);
      navigation.replace('Main');
      return;
    }

    const ok = await verifyPasscode(passcode);
    if (ok) {
      setAuthenticated(true);
      navigation.replace('Main');
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    Alert.alert('Passcode', nextAttempts >= 5 ? 'Too many attempts. Try again in 30 seconds.' : 'Incorrect passcode.');
  };

  return (
    <ScreenShell>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Text style={{ color: 'white', fontSize: 32, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: '#94a3b8' }}>
          {mode === 'setup' ? 'Set a 6-digit PIN to protect the app.' : 'Use your 6-digit PIN to continue.'}
        </Text>
        <TextInput
          value={passcode}
          onChangeText={setPasscode}
          placeholder="123456"
          placeholderTextColor="#64748b"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          style={{ backgroundColor: '#111827', color: 'white', borderRadius: 12, padding: 16, fontSize: 18 }}
        />
        {mode === 'setup' && (
          <TextInput
            value={confirmPasscode}
            onChangeText={setConfirmPasscode}
            placeholder="Confirm PIN"
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            style={{ backgroundColor: '#111827', color: 'white', borderRadius: 12, padding: 16, fontSize: 18 }}
          />
        )}
        <PrimaryButton label="Continue" onPress={handleSubmit} />
      </View>
    </ScreenShell>
  );
}
