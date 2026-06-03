import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { useRecordingController } from '../services/recorder';
import { useUploadController } from '../services/uploader';
import { useAppStore } from '../store/appStore';

export function MeetingScreen() {
  const appState = useAppStore((s) => s.appState);
  const chunkCount = useAppStore((s) => s.chunkCount);
  const currentChunkIndex = useAppStore((s) => s.currentChunkIndex);
  const processingStep = useAppStore((s) => s.processingStep);
  const setAppState = useAppStore((s) => s.setAppState);
  const setMeeting = useAppStore((s) => s.setMeeting);
  const resetMeeting = useAppStore((s) => s.resetMeeting);

  const recordingController = useRecordingController();
  const uploadController = useUploadController();

  const [title, setTitle] = useState('');
  const dateLabel = useMemo(() => new Date().toLocaleString(), []);

  const createMeeting = () => {
    if (!title.trim()) {
      Alert.alert('Meeting', 'Enter a meeting title.');
      return;
    }
    setMeeting({ id: null, title: title.trim(), date: dateLabel });
    setAppState('READY');
  };

  const handleStartRecording = async () => {
    try {
      await recordingController.start();
    } catch (error: any) {
      Alert.alert('Recording Error', error.message);
    }
  };

  const handleUpload = async () => {
    try {
      await uploadController.upload();
    } catch (error: any) {
      Alert.alert('Upload Error', error.message);
    }
  };

  return (
    <ScreenShell>
      <View style={{ flex: 1, gap: 16 }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: '800' }}>Meeting</Text>

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
            <Pressable
              onPress={handleStartRecording}
              style={{
                width: 160,
                height: 160,
                borderRadius: 80,
                backgroundColor: '#f59e0b',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '900' }}>MIC</Text>
            </Pressable>
            <Text style={{ color: 'white', fontSize: 16 }}>Tap to start recording</Text>
            <PrimaryButton label="Upload Audio" onPress={handleUpload} variant="ghost" />
            <PrimaryButton label="Cancel" onPress={resetMeeting} variant="ghost" />
          </View>
        )}

        {appState === 'RECORDING' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 }}>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Recording...</Text>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: '#f87171',
              }}
            />
            <Text style={{ color: '#f87171' }}>
              Chunk {currentChunkIndex + 1} / {chunkCount}
            </Text>
            <PrimaryButton label="End Meeting" onPress={recordingController.stop} variant="danger" />
            <PrimaryButton label="Cancel Recording" onPress={recordingController.cancel} variant="ghost" />
          </View>
        )}

        {appState === 'PROCESSING' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>Processing...</Text>
            <Text style={{ color: '#94a3b8' }}>{processingStep}</Text>
            <PrimaryButton label="New Meeting" onPress={resetMeeting} />
          </View>
        )}

        {appState === 'RESULTS' && (
          <View style={{ flex: 1, gap: 12 }}>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>Results</Text>
            <Text style={{ color: '#94a3b8' }}>{chunkCount} audio chunk(s) ready</Text>
            <PrimaryButton label="New Meeting" onPress={resetMeeting} />
          </View>
        )}
      </View>
    </ScreenShell>
  );
}
