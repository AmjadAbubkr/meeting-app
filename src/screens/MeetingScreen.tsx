import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenShell } from '../components/ScreenShell';
import { PrimaryButton } from '../components/PrimaryButton';
import { useRecordingController } from '../services/recorder';
import { useUploadController } from '../services/uploader';
import { useProcessingPipeline } from '../services/processingPipeline';
import { hasApiKey } from '../services/apiKeys';
import { exportPDF, exportDOCX } from '../services/exporter';
import { useAppStore } from '../store/appStore';

export function MeetingScreen({ navigation }: any) {
  const appState = useAppStore((s) => s.appState);
  const chunkCount = useAppStore((s) => s.chunkCount);
  const currentChunkIndex = useAppStore((s) => s.currentChunkIndex);
  const processingStep = useAppStore((s) => s.processingStep);
  const meetingTitle = useAppStore((s) => s.meetingTitle);
  const meetingDate = useAppStore((s) => s.meetingDate);
  const currentMeetingId = useAppStore((s) => s.currentMeetingId);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const rawTranscript = useAppStore((s) => s.rawTranscript);
  const cleanedTranscript = useAppStore((s) => s.cleanedTranscript);
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
  const [apiKeysReady, setApiKeysReady] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Check API keys on mount and when entering READY state
  useEffect(() => {
    (async () => {
      const hasGroq = await hasApiKey('groq');
      const hasGemini = await hasApiKey('gemini');
      setApiKeysReady(hasGroq && hasGemini);
    })();
  }, [appState]);

  const dateLabel = useMemo(() => new Date().toLocaleString(), []);

  const createMeeting = () => {
    if (!title.trim()) {
      Alert.alert('Meeting', 'Enter a meeting title.');
      return;
    }
    setMeeting({ id: null, title: title.trim(), date: dateLabel });
    setAppState('READY');
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (currentMeetingId === null) return;
    try {
      setExporting(true);
      // Build a MeetingRecord from current store state for export
      const meetingForExport = {
        id: currentMeetingId,
        title: meetingTitle,
        date: meetingDate,
        rawTranscript,
        cleanedTranscript,
        reports: JSON.stringify({
          [currentLanguage]: { report, summary },
        }),
      };
      const path =
        format === 'pdf'
          ? await exportPDF(meetingForExport, currentLanguage)
          : await exportDOCX(meetingForExport, currentLanguage);
      Alert.alert('Exported', `Saved to ${path}`);
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export file.');
    } finally {
      setExporting(false);
    }
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
        <Text style={{ color: '#e8d5b7', fontSize: 28, fontWeight: '700' }}>Meeting</Text>

        {appState === 'FORM' && (
          <View style={{ gap: 12 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Meeting title"
          placeholderTextColor="#8a7e72"
          style={{ backgroundColor: '#141414', color: '#f5f0eb', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: 'rgba(212,165,116,0.15)' }}
        />
        <Text style={{ color: '#e8d5b7' }}>{dateLabel}</Text>
            <PrimaryButton label="Create Meeting" onPress={createMeeting} />
          </View>
        )}

        {appState === 'READY' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
            {!apiKeysReady && (
              <Pressable
                onPress={() => navigation.navigate('Settings')}
              style={styles.apiKeyBanner}
            >
              <Text style={styles.apiKeyBannerText}>
                API keys required. Go to Settings to add them.
              </Text>
              <Text style={styles.apiKeyBannerLink}>Open Settings →</Text>
            </Pressable>
            )}
            <Pressable
              onPress={apiKeysReady ? handleStartRecording : undefined}
              style={[
                {
                  width: 130,
                  height: 130,
                  borderRadius: 65,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: 'rgba(212,165,116,0.25)',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 20,
                  elevation: 8,
                },
                apiKeysReady
                  ? { backgroundColor: '#d4a574' }
                  : { backgroundColor: '#1a1a1a' },
              ]}
              disabled={!apiKeysReady}
            >
              <Text
                style={{
                  color: apiKeysReady ? '#0f0f0f' : '#8a7e72',
                  fontWeight: '900',
                }}
              >
                MIC
              </Text>
            </Pressable>
            <Text style={{ color: '#e8d5b7', fontSize: 16 }}>
              {apiKeysReady ? 'Tap to start recording' : 'Add API keys to continue'}
            </Text>
            <PrimaryButton
              label="Upload Audio"
              onPress={handleUpload}
              variant="ghost"
              disabled={!apiKeysReady}
            />
            <PrimaryButton label="Cancel" onPress={resetMeeting} variant="ghost" />
          </View>
        )}

        {appState === 'RECORDING' && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 }}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingLabel}>Recording</Text>
            </View>
            <Text style={{ color: '#e8d5b7', fontSize: 24, fontWeight: '700' }}>Recording...</Text>
            <Text style={{ color: '#ff4757' }}>
              {' '}Chunk {currentChunkIndex + 1} / {chunkCount}{' '}
            </Text>
            <PrimaryButton label="End Meeting" onPress={recordingController.stop} variant="danger" />
            <PrimaryButton label="Cancel Recording" onPress={recordingController.cancel} variant="ghost" />
          </View>
        )}

        {appState === 'PROCESSING' && !error && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            <ActivityIndicator size="large" color="#d4a574" />
            <Text style={{ color: '#e8d5b7', fontSize: 22, fontWeight: '700' }}>
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
            <Text style={{ color: '#ff4757', fontSize: 20, fontWeight: '700' }}>
              Processing Failed
            </Text>
            <Text style={{ color: '#8a7e72', fontSize: 14, textAlign: 'center' }}>
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
        <Text style={{ color: '#e8d5b7', fontSize: 24, fontWeight: '700' }}>
          {meetingTitle}
        </Text>
        <Text style={{ color: '#8a7e72' }}>{meetingDate}</Text>

        {summary.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: '#d4a574', fontSize: 18, fontWeight: '700' }}>Summary</Text>
            {summary.map((bullet, idx) => (
              <Text key={idx} style={{ color: '#f5f0eb', fontSize: 14 }}>
                {'\u2022'} {bullet}
              </Text>
            ))}
          </View>
        )}

        {report.overview && (
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#d4a574', fontSize: 16, fontWeight: '600' }}>Overview</Text>
            <Text style={{ color: '#f5f0eb', fontSize: 14 }}>{report.overview}</Text>
          </View>
        )}

        {report.keyDiscussionPoints && report.keyDiscussionPoints.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#d4a574', fontSize: 16, fontWeight: '600' }}>
              Key Discussion Points
            </Text>
            {report.keyDiscussionPoints.map((point, idx) => (
              <Text key={idx} style={{ color: '#f5f0eb', fontSize: 14 }}>
                {'\u2022'} {point}
              </Text>
            ))}
          </View>
        )}

        {report.actionItems && report.actionItems.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#d4a574', fontSize: 16, fontWeight: '600' }}>
              Action Items
            </Text>
            {report.actionItems.map((item, idx) => (
              <Text key={idx} style={{ color: '#f5f0eb', fontSize: 14 }}>
                {'\u2022'} {item}
              </Text>
            ))}
          </View>
        )}

        {report.decisionsMade && report.decisionsMade.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#d4a574', fontSize: 16, fontWeight: '600' }}>
              Decisions Made
            </Text>
            {report.decisionsMade.map((decision, idx) => (
              <Text key={idx} style={{ color: '#f5f0eb', fontSize: 14 }}>
                {'\u2022'} {decision}
              </Text>
            ))}
          </View>
        )}

        {report.openQuestions && report.openQuestions.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#d4a574', fontSize: 16, fontWeight: '600' }}>
              Open Questions
            </Text>
            {report.openQuestions.map((question, idx) => (
              <Text key={idx} style={{ color: '#f5f0eb', fontSize: 14 }}>
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

        {exporting ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
            <ActivityIndicator size="small" color="#d4a574" />
            <Text style={{ color: '#8a7e72', fontSize: 14 }}>Exporting...</Text>
          </View>
        ) : (
          <>
            <PrimaryButton
              label="Export as PDF"
              onPress={() => handleExport('pdf')}
              variant="ghost"
            />
            <PrimaryButton
              label="Export as DOCX"
              onPress={() => handleExport('docx')}
              variant="ghost"
            />
          </>
        )}
      </ScrollView>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  apiKeyBanner: {
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
  },
  apiKeyBannerText: {
    color: '#f5f0eb',
    fontSize: 14,
    fontWeight: '600',
  },
  apiKeyBannerLink: {
    color: '#d4a574',
    fontSize: 14,
    fontWeight: '700',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,71,87,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.2)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4757',
  },
  recordingLabel: {
    color: '#ff4757',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
