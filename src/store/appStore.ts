import { create } from 'zustand';

export type AppState = 'FORM' | 'READY' | 'RECORDING' | 'PROCESSING' | 'RESULTS';
export type Language = 'EN' | 'FR';

type State = {
  appState: AppState;
  currentMeetingId: number | null;
  meetingTitle: string;
  meetingDate: string;
  audioChunks: string[];
  rawTranscript: string;
  currentLanguage: Language;
  report: string;
  summary: string;
  processingStep: string;
  chunkCount: number;
  currentChunkIndex: number;
  setAppState: (appState: AppState) => void;
  setMeeting: (meeting: { id: number | null; title: string; date: string }) => void;
  addAudioChunk: (uri: string) => void;
  setTranscript: (rawTranscript: string) => void;
  setResults: (report: string, summary: string) => void;
  setProcessingStep: (processingStep: string) => void;
  setLanguage: (currentLanguage: Language) => void;
  setChunkState: (chunkCount: number, currentChunkIndex: number) => void;
  resetMeeting: () => void;
};

const initial = {
  appState: 'FORM' as AppState,
  currentMeetingId: null,
  meetingTitle: '',
  meetingDate: '',
  audioChunks: [] as string[],
  rawTranscript: '',
  currentLanguage: 'EN' as Language,
  report: '',
  summary: '',
  processingStep: '',
  chunkCount: 0,
  currentChunkIndex: 0,
};

export const useAppStore = create<State>((set) => ({
  ...initial,
  setAppState: (appState) => set({ appState }),
  setMeeting: ({ id, title, date }) => set({ currentMeetingId: id, meetingTitle: title, meetingDate: date }),
  addAudioChunk: (uri) => set((state) => ({ audioChunks: [...state.audioChunks, uri], chunkCount: state.audioChunks.length + 1 })),
  setTranscript: (rawTranscript) => set({ rawTranscript }),
  setResults: (report, summary) => set({ report, summary }),
  setProcessingStep: (processingStep) => set({ processingStep }),
  setLanguage: (currentLanguage) => set({ currentLanguage }),
  setChunkState: (chunkCount, currentChunkIndex) => set({ chunkCount, currentChunkIndex }),
  resetMeeting: () => set(initial),
}));
