import { create } from 'zustand';

export type AppState = 'FORM' | 'READY' | 'RECORDING' | 'PROCESSING' | 'RESULTS';
export type Language = 'EN' | 'FR';

export type ReportData = {
  overview?: string;
  keyDiscussionPoints?: string[];
  actionItems?: string[];
  decisionsMade?: string[];
  openQuestions?: string[];
};

type State = {
  appState: AppState;
  currentMeetingId: number | null;
  meetingTitle: string;
  meetingDate: string;
  audioChunks: string[];
  rawTranscript: string;
  cleanedTranscript: string;
  currentLanguage: Language;
  report: ReportData;
  summary: string[];
  processingStep: string;
  processingStepIndex: number;
  chunkCount: number;
  currentChunkIndex: number;
  isAuthenticated: boolean;
  error: string | null;
  failedStepIndex: number | null;
  canKeepTranscriptOnly: boolean;
  setAppState: (appState: AppState) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setMeeting: (meeting: { id: number | null; title: string; date: string }) => void;
  addAudioChunk: (uri: string) => void;
  setTranscript: (rawTranscript: string) => void;
  setTranscriptFromApi: (rawTranscript: string) => void;
  setResults: (report: ReportData, summary: string[], cleanedTranscript: string) => void;
  setProcessingStep: (processingStep: string) => void;
  setProcessingStepIndex: (index: number) => void;
  setLanguage: (currentLanguage: Language) => void;
  setChunkState: (chunkCount: number, currentChunkIndex: number) => void;
  handleRecordingChunk: (uri: string, index: number) => void;
  handleUploadChunk: (uri: string, chunkIndex: number, totalChunks: number) => void;
  setError: (error: string, stepIndex: number) => void;
  clearError: () => void;
  setCanKeepTranscriptOnly: (val: boolean) => void;
  resetMeeting: () => void;
};

const initial = {
  appState: 'FORM' as AppState,
  currentMeetingId: null,
  meetingTitle: '',
  meetingDate: '',
  audioChunks: [] as string[],
  rawTranscript: '',
  cleanedTranscript: '',
  currentLanguage: 'EN' as Language,
  report: {} as ReportData,
  summary: [] as string[],
  processingStep: '',
  processingStepIndex: 0,
  chunkCount: 0,
  currentChunkIndex: 0,
  isAuthenticated: false,
  error: null as string | null,
  failedStepIndex: null as number | null,
  canKeepTranscriptOnly: false as boolean,
};

export const useAppStore = create<State>((set) => ({
  ...initial,
  setAppState: (appState) => set({ appState }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setMeeting: ({ id, title, date }) =>
    set({ currentMeetingId: id, meetingTitle: title, meetingDate: date }),
  addAudioChunk: (uri) =>
    set((state) => ({
      audioChunks: [...state.audioChunks, uri],
      chunkCount: state.audioChunks.length + 1,
    })),
  setTranscript: (rawTranscript) => set({ rawTranscript }),
  setTranscriptFromApi: (rawTranscript) =>
    set({ rawTranscript, processingStepIndex: 1 }),
  setResults: (report, summary, cleanedTranscript) => set({ report, summary, cleanedTranscript, processingStepIndex: 2 }),
  setProcessingStep: (processingStep) => set({ processingStep }),
  setProcessingStepIndex: (index) => set({ processingStepIndex: index }),
  setLanguage: (currentLanguage) => set({ currentLanguage }),
  setChunkState: (chunkCount, currentChunkIndex) => set({ chunkCount, currentChunkIndex }),
  handleRecordingChunk: (uri, index) =>
    set((state) => ({
      audioChunks: [...state.audioChunks, uri],
      chunkCount: state.audioChunks.length + 1,
      currentChunkIndex: index,
      processingStep: `Processing chunk ${index + 1}...`,
    })),
  handleUploadChunk: (uri: string, chunkIndex: number, totalChunks: number) =>
  set((state) => ({
    audioChunks: [...state.audioChunks, uri],
    chunkCount: totalChunks,
    currentChunkIndex: chunkIndex,
    processingStep: `Chunking audio ${chunkIndex + 1}/${totalChunks}...`,
  })),
  setError: (error, stepIndex) => set({ error, failedStepIndex: stepIndex }),
  clearError: () => set({ error: null, failedStepIndex: null }),
  setCanKeepTranscriptOnly: (canKeepTranscriptOnly) => set({ canKeepTranscriptOnly }),
  resetMeeting: () => set(initial),
}));

