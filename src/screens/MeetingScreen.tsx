import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { useRecordingController } from '../services/recorder';
import { useUploadController } from '../services/uploader';
import { useProcessingPipeline } from '../services/processingPipeline';
import { useAppStore } from '../store/appStore';

export function MeetingScreen({ navigation }: any) {
  const appState = useAppStore((s) => s.appState);
  const chunkCount = useAppStore((s) => s.chunkCount);
  const currentChunkIndex = useAppStore((s) => s.currentChunkIndex);
  const processingStep = useAppStore((s) => s.processingStep);
  const meetingTitle = useAppStore((s) => s.meetingTitle);
  const meetingDate = useAppStore((s) => s.meetingDate);
  const currentMeetingId = useAppStore((s) => s.currentMeetingId);
  const report = useAppStore((s) => s.report);
  const summary = useAppStore((s) => s.summary);
  const setAppState = useAppStore((s) => s.setAppState);
  const setMeeting = useAppStore((s) => s.setMeeting);
  const resetMeeting = useAppStore((s) => s.resetMeeting);

  const recordingController = useRecordingController();
  const uploadController = useUploadController();
  const {
    runFullPipeline,
    retryFromFailedStep,
    keepTranscriptOnly,
    stepLabel,
    error,
    failedStepIndex,
    hasTranscript,
  } = useProcessingPipeline();

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

  // Auto-start processing pipeline when entering PROCESSING state
  useEffect(() => {
    if (appState === 'PROCESSING' && !error) {
      runFullPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState]);

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
              {' '}Chunk {currentChunkIndex + 1} / {chunkCount}{' '}
            </Text>
            <PrimaryButton label="End Meeting" onPress={recordingController.stop} variant="danger" />
            <PrimaryButton label="Cancel Recording" onPress={recordingController.cancel} variant="ghost" />
          </View>
        )}

        {appState === 'PROCESSING' && !error && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>
              {processingStep || stepLabel}
            </Text>
          </View>
        )}

        {appState === 'PROCESSING' && error && (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 16,
              padding: 20,
            }}
          >
            <Text style={{ color: '#f87171', fontSize: 20, fontWeight: '700' }}>
              Processing Failed
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
              {error}
            </Text>

            <View style={{ gap: 12, width: '100%', marginTop: 8 }}>
              <PrimaryButton label="Retry" onPress={retryFromFailedStep} />

              {hasTranscript && failedStepIndex !== null && failedStepIndex >= 1 && (
                <PrimaryButton
                  label="Keep transcript only"
                  onPress={keepTranscriptOnly}
                  variant="ghost"
                />
              )}

              <PrimaryButton
                label="Cancel"
                onPress={() => {
                  resetMeeting();
                }}
                variant="danger"
              />
            </View>
          </View>
        )}

        {appState === 'RESULTS' && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }}>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '700' }}>
              {meetingTitle}
            </Text>
            <Text style={{ color: '#94a3b8' }}>{meetingDate}</Text>

            {summary.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: '#f59e0b', fontSize: 18, fontWeight: '700' }}>Summary</Text>
                {summary.map((bullet, idx) => (
                  <Text key={idx} style={{ color: '#e2e8f0', fontSize: 14 }}>
                    {'\u2022'} {bullet}
                  </Text>
                ))}
              </View>
            )}

            {report.overview && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600' }}>Overview</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 14 }}>{report.overview}</Text>
              </View>
            )}

            {report.keyDiscussionPoints && report.keyDiscussionPoints.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600' }}>
                  Key Discussion Points
                </Text>
                {report.keyDiscussionPoints.map((point, idx) => (
                  <Text key={idx} style={{ color: '#e2e8f0', fontSize: 14 }}>
                    {'\u2022'} {point}
                  </Text>
                ))}
              </View>
            )}

            {report.actionItems && report.actionItems.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600' }}>
                  Action Items
                </Text>
                {report.actionItems.map((item, idx) => (
                  <Text key={idx} style={{ color: '#e2e8f0', fontSize: 14 }}>
                    {'\u2022'} {item}
                  </Text>
                ))}
              </View>
            )}

            {report.decisionsMade && report.decisionsMade.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600' }}>
                  Decisions Made
                </Text>
                {report.decisionsMade.map((decision, idx) => (
                  <Text key={idx} style={{ color: '#e2e8f0', fontSize: 14 }}>
                    {'\u2022'} {decision}
                  </Text>
                ))}
              </View>
            )}

            {report.openQuestions && report.openQuestions.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: '#f59e0b', fontSize: 16, fontWeight: '600' }}>
                  Open Questions
                </Text>
                {report.openQuestions.map((question, idx) => (
                  <Text key={idx} style={{ color: '#e2e8f0', fontSize: 14 }}>
                    {'\u2022'} {question}
                  </Text>
                ))}
              </View>
            )}

        <PrimaryButton label="New Meeting" onPress={resetMeeting} />

        {currentMeetingId !== null && (
          <PrimaryButton
            label="View in History"
            onPress={() => navigation.navigate('MeetingDetail', { meetingId: currentMeetingId })}
            variant="ghost"
          />
        )}
      </ScrollView>
        )}
      </View>
    </ScreenShell>
  );
}
