import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '../../components/ScreenShell';
import { useRecordingController } from '../../services/recorder';
import { useUploadController } from '../../services/uploader';
import { useProcessingPipeline } from '../../services/processingPipeline';
import { hasApiKey } from '../../services/apiKeys';
import { getSetting } from '../../db/database';
import { useAppStore } from '../../store/appStore';
import { FormState } from './FormState';
import { ReadyState } from './ReadyState';
import { RecordingState } from './RecordingState';
import { ProcessingState } from './ProcessingState';
import { ResultsState } from './ResultsState';
import { theme } from './theme';

export function MeetingScreen({ navigation, noSafeArea }: any) {
  const appState = useAppStore((s) => s.appState);
  const chunkCount = useAppStore((s) => s.chunkCount);
  const currentChunkIndex = useAppStore((s) => s.currentChunkIndex);
  const processingStep = useAppStore((s) => s.processingStep);
  const meetingTitle = useAppStore((s) => s.meetingTitle);
  const meetingDate = useAppStore((s) => s.meetingDate);
  const currentMeetingId = useAppStore((s) => s.currentMeetingId);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const report = useAppStore((s) => s.report);
  const summary = useAppStore((s) => s.summary);
  const setAppState = useAppStore((s) => s.setAppState);
  const setMeeting = useAppStore((s) => s.setMeeting);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const resetMeeting = useAppStore((s) => s.resetMeeting);
  const canKeepTranscriptOnly = useAppStore((s) => s.canKeepTranscriptOnly);

  const recordingController = useRecordingController();
  const uploadController = useUploadController();
  const {
  retryFromFailedStep,
  keepTranscriptOnly,
  stepLabel,
  error,
  failedStepIndex,
  hasTranscript,
  } = useProcessingPipeline();

  const [apiKeysReady, setApiKeysReady] = useState(false);

  useEffect(() => {
    if (appState === 'FORM') {
      (async () => {
        const lang = await getSetting('defaultLanguage');
        if (lang === 'EN' || lang === 'FR') {
          setLanguage(lang);
        }
      })();
    }
  }, [appState, setLanguage]);

  useEffect(() => {
    (async () => {
      const hasGroq = await hasApiKey('groq');
      const hasGemini = await hasApiKey('gemini');
      setApiKeysReady(hasGroq && hasGemini);
    })();
  }, [appState]);

  const dateLabel = useMemo(() => new Date().toLocaleString(), []);

  const handleCreate = (title: string) => {
    setMeeting({ id: null, title, date: dateLabel });
    setAppState('READY');
  };

  return (
    <ScreenShell noSafeArea={noSafeArea}>
      <View style={styles.outer}>
        <Text style={styles.heading}>Meeting</Text>

        {appState === 'FORM' && (
          <FormState dateLabel={dateLabel} onCreate={handleCreate} />
        )}

        {appState === 'READY' && (
          <ReadyState
            apiKeysReady={apiKeysReady}
            onStartRecording={recordingController.start}
            onUpload={uploadController.upload}
            onCancel={resetMeeting}
            onOpenSettings={() => navigation.navigate('Settings')}
          />
        )}

        {appState === 'RECORDING' && (
          <RecordingState
            chunkCount={chunkCount}
            currentChunkIndex={currentChunkIndex}
            onStop={recordingController.stop}
            onCancel={recordingController.cancel}
          />
        )}

        {appState === 'PROCESSING' && (
        <ProcessingState
          stepLabel={processingStep || stepLabel}
          error={error}
          hasTranscript={hasTranscript}
          failedStepIndex={failedStepIndex}
          canKeepTranscriptOnly={canKeepTranscriptOnly}
          onRetry={retryFromFailedStep}
          onKeepTranscriptOnly={keepTranscriptOnly}
          onCancel={resetMeeting}
        />
        )}

        {appState === 'RESULTS' && (
          <ResultsState
            meetingTitle={meetingTitle}
            meetingDate={meetingDate}
            report={report}
            summary={summary}
            currentMeetingId={currentMeetingId}
            currentLanguage={currentLanguage}
            onReset={resetMeeting}
            onViewInHistory={() =>
              navigation.navigate('MeetingDetail', { meetingId: currentMeetingId })
            }
          />
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    gap: 16,
  },
  heading: {
    color: theme.textMuted,
    fontSize: 28,
    fontWeight: '700',
  },
});
