import { useCallback } from 'react';
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

  const setAppState = useAppStore((s) => s.setAppState);
  const setProcessingStep = useAppStore((s) => s.setProcessingStep);
  const setProcessingStepIndex = useAppStore((s) => s.setProcessingStepIndex);
  const setTranscriptFromApi = useAppStore((s) => s.setTranscriptFromApi);
  const setResults = useAppStore((s) => s.setResults);
  const setError = useAppStore((s) => s.setError);
  const clearError = useAppStore((s) => s.clearError);

  const runFullPipeline = useCallback(async () => {
    clearError();
    setProcessingStepIndex(0);

    const { audioChunks, currentLanguage } = useAppStore.getState();

    let currentStepIndex = 0;
    try {
      setProcessingStep(STEP_LABELS[0]);
      const langCode = currentLanguage === 'EN' ? 'en' : 'fr';
      const transcript = await transcribeChunks(audioChunks, langCode, (current, total) => {
        setProcessingStep(`Transcribing chunk ${current}/${total}...`);
      });
      setTranscriptFromApi(transcript);

      currentStepIndex = 1;
      setProcessingStep(STEP_LABELS[1]);
      setProcessingStepIndex(1);
      const result = await generateReport(transcript, currentLanguage);
      setResults(result.report, result.summary);

      currentStepIndex = 2;
      await commitMeeting({
        transcript,
        report: result.report,
        summary: result.summary,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message, currentStepIndex);
    }
  }, [
    setProcessingStep,
    setProcessingStepIndex,
    setTranscriptFromApi,
    setResults,
    setError,
    clearError,
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
        const { rawTranscript: transcript, currentLanguage } = useAppStore.getState();
        setProcessingStep(STEP_LABELS[1]);
        setProcessingStepIndex(1);

        const result = await generateReport(transcript, currentLanguage);
        setResults(result.report, result.summary);

        await commitMeeting({
          transcript,
          report: result.report,
          summary: result.summary,
        });
        return;
      }

      if (failedIndex === 2) {
        const { rawTranscript: transcript, report, summary } = useAppStore.getState();
        await commitMeeting({
          transcript,
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
