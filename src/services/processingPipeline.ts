import { useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useAppStore } from '../store/appStore';
import { transcribeChunks } from './transcriber';
import { generateReport } from './generator';
import { saveMeeting, updateMeeting, moveAudioToPermanentStorage } from '../db/database';

const STEP_LABELS = [
  'Transcribing audio...',
  'Generating report...',
  'Saving meeting...',
] as const;

/**
 * Build the reports JSON column value.
 * Format: { "EN": { report: {...}, summary: [...] }, "FR": { report: {...}, summary: [...] } }
 */
function buildReportsJson(
  language: string,
  report: Record<string, any>,
  summary: string[],
): string {
  const reports: Record<string, { report: Record<string, any>; summary: string[] }> = {};
  reports[language] = { report, summary };
  return JSON.stringify(reports);
}

type CommitInput = {
  transcript: string;
  cleanedTranscript?: string;
  report?: Record<string, any>;
  summary?: string[];
};

async function finalizeMeeting(meetingId: number): Promise<void> {
  const { meetingTitle, meetingDate, audioChunks } = useAppStore.getState();

  try {
    const permanentPath = await moveAudioToPermanentStorage(meetingId, audioChunks);
    await updateMeeting(meetingId, { audioPath: permanentPath });
  } catch {
    // Don't fail the pipeline if audio move fails — the meeting is still saved
  }

  useAppStore.getState().setMeeting({
    id: meetingId,
    title: meetingTitle,
    date: meetingDate,
  });
}

async function commitMeeting(input: CommitInput): Promise<number> {
  const { currentLanguage, meetingTitle, meetingDate } = useAppStore.getState();
  const { setAppState, setProcessingStep, setProcessingStepIndex } = useAppStore.getState();

  setProcessingStep(STEP_LABELS[2]);
  setProcessingStepIndex(2);

  const reportsJson =
    input.report !== undefined
      ? buildReportsJson(currentLanguage, input.report, input.summary ?? [])
      : undefined;

  const meetingId = await saveMeeting({
    title: meetingTitle,
    date: meetingDate,
    rawTranscript: input.transcript,
    cleanedTranscript: input.cleanedTranscript ?? undefined,
    createdAt: new Date().toISOString(),
    ...(reportsJson !== undefined ? { reports: reportsJson } : {}),
  });

  await finalizeMeeting(meetingId);

  setAppState('RESULTS');
  setProcessingStep('');

  return meetingId;
}

/**
 * Hook that orchestrates the full processing pipeline:
 * 1. Transcribe audio chunks via Groq Whisper
 * 2. Generate structured report via Gemini
 * 3. Save meeting record to database (with reports JSON column + audio files)
 *
 * Auto-advances appState on completion.
 * On failure at any step: sets error state with step-level retry info.
 */
export function useProcessingPipeline() {
  const processingStepIndex = useAppStore((s) => s.processingStepIndex);
  const error = useAppStore((s) => s.error);
  const failedStepIndex = useAppStore((s) => s.failedStepIndex);
  const rawTranscript = useAppStore((s) => s.rawTranscript);

  const setProcessingStep = useAppStore((s) => s.setProcessingStep);
  const setProcessingStepIndex = useAppStore((s) => s.setProcessingStepIndex);
  const setTranscriptFromApi = useAppStore((s) => s.setTranscriptFromApi);
  const setResults = useAppStore((s) => s.setResults);
  const setError = useAppStore((s) => s.setError);
  const clearError = useAppStore((s) => s.clearError);
  const setCanKeepTranscriptOnly = useAppStore((s) => s.setCanKeepTranscriptOnly);

  const runFullPipeline = useCallback(async () => {
    clearError();
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setError('No internet connection. Connect and retry.', 0);
      return;
    }
    setProcessingStepIndex(0);
  let currentStepIndex = 0;
  const { audioChunks, currentLanguage } = useAppStore.getState();

  try {
      setProcessingStep(STEP_LABELS[0]);
      const langCode = currentLanguage === 'EN' ? 'en' : 'fr';
      const transcript = await transcribeChunks(audioChunks, langCode, (current, total) => {
        setProcessingStep(`Transcribing chunk ${current}/${total}...`);
      });
      setTranscriptFromApi(transcript);

  setProcessingStep(STEP_LABELS[1]);
  setProcessingStepIndex(1);
  currentStepIndex = 1;
  const result = await generateReport(transcript, currentLanguage);
    const { cleanedTranscript } = useAppStore.getState();
    setResults(result.report, result.summary, cleanedTranscript || transcript);

    currentStepIndex = 2;
    await commitMeeting({
      transcript,
      cleanedTranscript: cleanedTranscript || transcript,
      report: result.report,
      summary: result.summary,
    });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message, currentStepIndex);
      if (currentStepIndex === 1) {
        setCanKeepTranscriptOnly(true);
      }
    }
  }, [
    setProcessingStep,
    setProcessingStepIndex,
    setTranscriptFromApi,
    setResults,
    setError,
    clearError,
    setCanKeepTranscriptOnly,
  ]);

  const retryFromFailedStep = useCallback(async () => {
    const { failedStepIndex: failedIndex } = useAppStore.getState();

    if (failedIndex === null) {
      return runFullPipeline();
    }

    clearError();

    try {
      if (failedIndex === 0) {
        return runFullPipeline();
      }

      if (failedIndex === 1) {
        const { rawTranscript: transcript, currentLanguage, cleanedTranscript: storedCleaned } = useAppStore.getState();
        setProcessingStep(STEP_LABELS[1]);
        setProcessingStepIndex(1);

        const result = await generateReport(transcript, currentLanguage);
        setResults(result.report, result.summary, storedCleaned || transcript);

        await commitMeeting({
          transcript,
          cleanedTranscript: storedCleaned || transcript,
          report: result.report,
          summary: result.summary,
        });
        return;
      }

      if (failedIndex === 2) {
        const { rawTranscript: transcript, report, summary, cleanedTranscript } = useAppStore.getState();
        await commitMeeting({
          transcript,
          cleanedTranscript,
          report,
          summary,
        });
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message, failedIndex);
    }
  }, [
    runFullPipeline,
    setProcessingStep,
    setProcessingStepIndex,
    setResults,
    setError,
    clearError,
  ]);

  const keepTranscriptOnly = useCallback(async () => {
    clearError();

    try {
      const { rawTranscript: transcript } = useAppStore.getState();
      await commitMeeting({ transcript });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message, 2);
    }
  }, [setError, clearError]);

  return {
    runFullPipeline,
    retryFromFailedStep,
    keepTranscriptOnly,
    processingStepIndex,
    stepLabel: processingStepIndex < STEP_LABELS.length ? STEP_LABELS[processingStepIndex] : '',
    error,
    failedStepIndex,
    hasTranscript: !!rawTranscript.trim(),
  };
}
