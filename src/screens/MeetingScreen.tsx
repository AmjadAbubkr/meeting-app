import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppStore } from '../store/appStore';

export function MeetingScreen() {
  const appState = useAppStore((state) => state.appState);
  const setAppState = useAppStore((state) => state.setAppState);
  const setMeeting = useAppStore((state) => state.setMeeting);
  const resetMeeting = useAppStore((state) => state.resetMeeting);
  const [title, setTitle] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const dateLabel = useMemo(() => new Date().toLocaleString(), []);

  const createMeeting = () => {
    if (!title.trim()) {
      Alert.alert('Meeting', 'Enter a meeting title.');
      return;
    }
    setMeeting({ id: null, title: title.trim(), date: dateLabel });
    setAppState('READY');
  };

  return (
    <ScreenShell>
      <View style={{ flex: 1, gap: 16 }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>Meeting</Text>
        <Text style={{ color: '#94a3b8' }}>State: {appState}</Text>

        {appState === 'FORM' && (
          <View style={{ gap: 12 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Meeting title"
              placeholderTextColor="#64748b"
              style={{ backgroundColor: '#111827', color: 'white', borderRadius: 12, padding: 16 }}
            />
            <Text style={{ color: '#94a3b8' }}>{dateLabel}</Text>
            <PrimaryButton label="Create Meeting" onPress={createMeeting} />
          </View>
        )}

        {appState === 'READY' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
            <Pressable onPress={() => setAppState('RECORDING')} style={{ width: 160, height: 160, borderRadius: 80, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#111827', fontWeight: '900' }}>MIC</Text>
            </Pressable>
            <Text style={{ color: 'white', fontSize: 16 }}>Tap to start recording</Text>
            <PrimaryButton label="Upload Audio" onPress={() => setShowUpload(true)} variant="ghost" />
          </View>
        )}

        {appState === 'RECORDING' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 }}>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Recording...</Text>
            <Text style={{ color: '#f87171' }}>Chunk 1 / 1</Text>
            <PrimaryButton label="End Meeting" onPress={() => setAppState('PROCESSING')} variant="danger" />
          </View>
        )}

        {appState === 'PROCESSING' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: 'white', fontSize: 22 }}>Processing...</Text>
            <Text style={{ color: '#94a3b8' }}>Transcribing, generating, and saving</Text>
            <PrimaryButton label="Show Results" onPress={() => setAppState('RESULTS')} />
          </View>
        )}

        {appState === 'RESULTS' && (
          <View style={{ flex: 1, gap: 12 }}>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Results</Text>
            <PrimaryButton label="New Meeting" onPress={resetMeeting} />
          </View>
        )}
      </View>

      <Modal visible={showUpload} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#111827', borderRadius: 16, padding: 20, gap: 12 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>Upload audio</Text>
            <Text style={{ color: '#94a3b8' }}>Upload flow placeholder for file picker and chunking.</Text>
            <PrimaryButton label="Close" onPress={() => setShowUpload(false)} />
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}
