import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { transcribeChunks } from './transcriber';
import { generateReport } from './generator';
import { saveMeeting } from '../db/database';

const STEP_LABELS = [
  'Transcribing audio...',
  'Generating report...',
  'Saving meeting...',
] as const;

/**
 * Hook that orchestrates the full processing pipeline:
 * 1. Transcribe audio chunks via Groq Whisper
 * 2. Generate structured report via Gemini
 * 3. Save meeting record to database
 *
 * Auto-advances appState on completion.
 * On failure at any step: sets error state with step-level retry info.
 */
export function useProcessingPipeline() {
  const appState = useAppStore((s) => s.appState);
  const audioChunks = useAppStore((s) => s.audioChunks);
  const currentLanguage = useAppStore((s) => s.currentLanguage);
  const meetingTitle = useAppStore((s) => s.meetingTitle);
  const meetingDate = useAppStore((s) => s.meetingDate);
  const rawTranscript = useAppStore((s) => s.rawTranscript);
  const report = useAppStore((s) => s.report);
  const summary = useAppStore((s) => s.summary);
  const cleanedTranscript = useAppStore((s) => s.cleanedTranscript);
  const processingStepIndex = useAppStore((s) => s.processingStepIndex);
  const error = useAppStore((s) => s.error);
  const failedStepIndex = useAppStore((s) => s.failedStepIndex);

  const setAppState = useAppStore((s) => s.setAppState);
  const setProcessingStep = useAppStore((s) => s.setProcessingStep);
  const setProcessingStepIndex = useAppStore((s) => s.setProcessingStepIndex);
  const setTranscriptFromApi = useAppStore((s) => s.setTranscriptFromApi);
  const setResults = useAppStore((s) => s.setResults);
  const setError = useAppStore((s) => s.setError);
  const clearError = useAppStore((s) => s.clearError);

  /**
   * Run the full pipeline from the beginning (transcribe → generate → save).
   */
  const runFullPipeline = useCallback(async () => {
    clearError();
    setProcessingStepIndex(0);

    try {
      // Step 0: Transcribe
      setProcessingStep(STEP_LABELS[0]);
      const langCode = currentLanguage === 'EN' ? 'en' : 'fr';
      const transcript = await transcribeChunks(audioChunks, langCode, (current, total) => {
        setProcessingStep(`Transcribing chunk ${current}/${total}...`);
      });
      setTranscriptFromApi(transcript);

      // Step 1: Generate report
      setProcessingStep(STEP_LABELS[1]);
      setProcessingStepIndex(1);
      const result = await generateReport(transcript, currentLanguage);
      setResults(result.report, result.summary, result.cleanedTranscript);

      // Step 2: Save to database
      setProcessingStep(STEP_LABELS[2]);
      setProcessingStepIndex(2);
      const meetingId = await saveMeeting({
        title: meetingTitle,
        date: meetingDate,
        rawTranscript: transcript,
        cleanedTranscript: result.cleanedTranscript,
        reportEN: currentLanguage === 'EN' ? JSON.stringify(result.report) : undefined,
        summaryEN: currentLanguage === 'EN' ? JSON.stringify(result.summary) : undefined,
        reportFR: currentLanguage === 'FR' ? JSON.stringify(result.report) : undefined,
        summaryFR: currentLanguage === 'FR' ? JSON.stringify(result.summary) : undefined,
        createdAt: new Date().toISOString(),
      });

      // Update the meeting ID in the store
      useAppStore.getState().setMeeting({
        id: meetingId,
        title: meetingTitle,
        date: meetingDate,
      });

      // Auto-advance to RESULTS
      setAppState('RESULTS');
      setProcessingStep('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    }
  }, [
    audioChunks,
    currentLanguage,
    meetingTitle,
    meetingDate,
    setAppState,
    setProcessingStep,
    setProcessingStepIndex,
    setTranscriptFromApi,
    setResults,
    setError,
    clearError,
  ]);

  /**
   * Retry from the failed step (not from the beginning).
   * If transcription failed, retry from step 0.
   * If report generation failed, retry from step 1 (using existing transcript).
   * If save failed, retry from step 2 (using existing report).
   */
  const retryFromFailedStep = useCallback(async () => {
    if (failedStepIndex === null) {
      // No failed step — run from beginning
      return runFullPipeline();
    }

    clearError();

    try {
      if (failedStepIndex === 0) {
        // Retry transcription from scratch
        return runFullPipeline();
      }

      if (failedStepIndex === 1) {
        // Retry report generation with existing transcript
        setProcessingStep(STEP_LABELS[1]);
        setProcessingStepIndex(1);

        const result = await generateReport(rawTranscript, currentLanguage);
        setResults(result.report, result.summary, result.cleanedTranscript);

        // Continue to save
        setProcessingStep(STEP_LABELS[2]);
        setProcessingStepIndex(2);
        const meetingId = await saveMeeting({
          title: meetingTitle,
          date: meetingDate,
          rawTranscript,
          cleanedTranscript: result.cleanedTranscript,
          reportEN: currentLanguage === 'EN' ? JSON.stringify(result.report) : undefined,
          summaryEN: currentLanguage === 'EN' ? JSON.stringify(result.summary) : undefined,
          reportFR: currentLanguage === 'FR' ? JSON.stringify(result.report) : undefined,
          summaryFR: currentLanguage === 'FR' ? JSON.stringify(result.summary) : undefined,
          createdAt: new Date().toISOString(),
        });

        useAppStore.getState().setMeeting({
          id: meetingId,
          title: meetingTitle,
          date: meetingDate,
        });

        setAppState('RESULTS');
        setProcessingStep('');
        return;
      }

      if (failedStepIndex === 2) {
        // Retry save with existing results
        setProcessingStep(STEP_LABELS[2]);
        setProcessingStepIndex(2);

        const meetingId = await saveMeeting({
          title: meetingTitle,
          date: meetingDate,
          rawTranscript,
          cleanedTranscript,
          reportEN: currentLanguage === 'EN' ? JSON.stringify(report) : undefined,
          summaryEN: currentLanguage === 'EN' ? JSON.stringify(summary) : undefined,
          reportFR: currentLanguage === 'FR' ? JSON.stringify(report) : undefined,
          summaryFR: currentLanguage === 'FR' ? JSON.stringify(summary) : undefined,
          createdAt: new Date().toISOString(),
        });

        useAppStore.getState().setMeeting({
          id: meetingId,
          title: meetingTitle,
          date: meetingDate,
        });

        setAppState('RESULTS');
        setProcessingStep('');
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    }
  }, [
    failedStepIndex,
    runFullPipeline,
    rawTranscript,
    cleanedTranscript,
    report,
    summary,
    currentLanguage,
    meetingTitle,
    meetingDate,
    setProcessingStep,
    setProcessingStepIndex,
    setResults,
    setAppState,
    setError,
    clearError,
  ]);

  /**
   * Keep transcript only — saves what we have without a report.
   * Used when report generation fails and user wants to salvage the transcript.
   */
  const keepTranscriptOnly = useCallback(async () => {
    clearError();

    try {
      setProcessingStep(STEP_LABELS[2]);
      setProcessingStepIndex(2);

      const meetingId = await saveMeeting({
        title: meetingTitle,
        date: meetingDate,
        rawTranscript,
        cleanedTranscript: rawTranscript,
        createdAt: new Date().toISOString(),
      });

      useAppStore.getState().setMeeting({
        id: meetingId,
        title: meetingTitle,
        date: meetingDate,
      });

      setAppState('RESULTS');
      setProcessingStep('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save transcript.';
      setError(message);
    }
  }, [
    rawTranscript,
    meetingTitle,
    meetingDate,
    setProcessingStep,
    setProcessingStepIndex,
    setAppState,
    setError,
    clearError,
  ]);

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
