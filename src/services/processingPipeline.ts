import { useCallback, useEffect, useRef } from 'react';
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

async function runPipeline(
  fromStep: 0 | 1 | 2,
  deps: {
    setProcessingStep: (s: string) => void;
    setProcessingStepIndex: (i: number) => void;
    setTranscriptFromApi: (t: string) => void;
    setResults: (r: any, s: string[], c: string) => void;
    setError: (e: string, i: number) => void;
    setCanKeepTranscriptOnly: (v: boolean) => void;
  },
): Promise<void> {
  let { audioChunks } = useAppStore.getState();
  const { currentLanguage, rawTranscript, cleanedTranscript } = useAppStore.getState();
  const { setProcessingStep, setProcessingStepIndex, setTranscriptFromApi,
    setResults, setError, setCanKeepTranscriptOnly } = deps;

  // Guard: wait briefly for async file flush consistency if chunks are empty.
  // This covers the race where pipeline fires before the recorder has finished
  // adding chunks to the store. Applies to both runFullPipeline and retryFromFailedStep.
  if (fromStep === 0 && (!audioChunks || audioChunks.length === 0)) {
    await new Promise((res) => setTimeout(res, 500));
    audioChunks = useAppStore.getState().audioChunks;
  }
  if (fromStep === 0 && (!audioChunks || audioChunks.length === 0)) {
    throw new Error('No audio recorded. Start recording before ending meeting.');
  }

  let currentStepIndex: 0 | 1 | 2 = fromStep;

  try {
    let transcript = rawTranscript;

    if (fromStep === 0) {
      setProcessingStep(STEP_LABELS[0]);
      setProcessingStepIndex(0);
      currentStepIndex = 0;
      const langCode = currentLanguage === 'EN' ? 'en' : 'fr';
      transcript = await transcribeChunks(audioChunks, langCode, (current, total) => {
        setProcessingStep(`Transcribing chunk ${current}/${total}...`);
      });
      setTranscriptFromApi(transcript);
    }

    if (fromStep <= 1) {
      setProcessingStep(STEP_LABELS[1]);
      setProcessingStepIndex(1);
      currentStepIndex = 1;
      const result = await generateReport(transcript, currentLanguage);
      const stored = useAppStore.getState().cleanedTranscript;

      // Normalize report — Gemini may omit fields entirely per prompt instructions
      const safeReport = {
        overview: result.report.overview ?? '',
        keyDiscussionPoints: result.report.keyDiscussionPoints ?? [],
        actionItems: result.report.actionItems ?? [],
        decisionsMade: result.report.decisionsMade ?? [],
        openQuestions: result.report.openQuestions ?? [],
      };

      setResults(safeReport, result.summary, stored || transcript);
      currentStepIndex = 2;
      await commitMeeting({
        transcript,
        cleanedTranscript: stored || transcript,
        report: safeReport,
        summary: result.summary,
      });
      return;
    }

    // fromStep === 2: commit only
    currentStepIndex = 2;
    const { report, summary } = useAppStore.getState();
    await commitMeeting({
      transcript,
      cleanedTranscript: cleanedTranscript || transcript,
      report,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    setError(message, currentStepIndex);
    if (currentStepIndex === 1) {
      setCanKeepTranscriptOnly(true);
    }
  }
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
  const appState = useAppStore((s) => s.appState);
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
    const { audioChunks } = useAppStore.getState();
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setError('No internet connection. Connect and retry.', 0);
      return;
    }

    // Early guard: fail fast before entering the pipeline if no audio chunks.
    // This provides immediate user feedback instead of waiting for the
    // 500ms retry inside runPipeline, which covers a deeper async race.
    if (!audioChunks || audioChunks.length === 0) {
      setError('No audio recorded. Start recording before ending meeting.', 0);
      return;
    }

    await runPipeline(0, {
      setProcessingStep,
      setProcessingStepIndex,
      setTranscriptFromApi,
      setResults,
      setError,
      setCanKeepTranscriptOnly,
    });
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
    clearError();
    const fromStep: 0 | 1 | 2 =
      failedIndex === 1 ? 1 : failedIndex === 2 ? 2 : 0;
    await runPipeline(fromStep, {
      setProcessingStep,
      setProcessingStepIndex,
      setTranscriptFromApi,
      setResults,
      setError,
      setCanKeepTranscriptOnly,
    });
  }, [
    setProcessingStep,
    setProcessingStepIndex,
    setTranscriptFromApi,
    setResults,
    setError,
    clearError,
    setCanKeepTranscriptOnly,
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

  // Auto-run the pipeline when entering PROCESSING state.
  // This ensures any consumer of the hook gets the auto-trigger,
  // not just MeetingScreen.
  const pipelineStartedRef = useRef(false);
  useEffect(() => {
    if (appState === 'PROCESSING' && !error) {
      if (!pipelineStartedRef.current) {
        pipelineStartedRef.current = true;
        runFullPipeline();
      }
    } else if (appState !== 'PROCESSING') {
      pipelineStartedRef.current = false;
    }
  }, [appState, error, runFullPipeline]);

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
