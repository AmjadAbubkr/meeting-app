import { describe, it, expect, beforeEach } from '@jest/globals';
import { useAppStore } from '../store/appStore';

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.getState().resetMeeting();
  });

  it('initial state is FORM', () => {
    expect(useAppStore.getState().appState).toBe('FORM');
  });

  it('setAppState transitions state', () => {
    useAppStore.getState().setAppState('RECORDING');
    expect(useAppStore.getState().appState).toBe('RECORDING');
  });

  it('setMeeting updates meeting fields', () => {
    useAppStore.getState().setMeeting({ id: 1, title: 'Test', date: '2025-01-01' });
    const s = useAppStore.getState();
    expect(s.currentMeetingId).toBe(1);
    expect(s.meetingTitle).toBe('Test');
    expect(s.meetingDate).toBe('2025-01-01');
  });

  it('addAudioChunk appends and updates chunkCount', () => {
    useAppStore.getState().addAudioChunk('/path/a.m4a');
    const s = useAppStore.getState();
    expect(s.audioChunks).toEqual(['/path/a.m4a']);
    expect(s.chunkCount).toBe(1);
  });

  it('setTranscriptFromApi sets rawTranscript and advances stepIndex', () => {
    useAppStore.getState().setTranscriptFromApi('hello world');
    const s = useAppStore.getState();
    expect(s.rawTranscript).toBe('hello world');
    expect(s.processingStepIndex).toBe(1);
  });

  it('setError sets error and failedStepIndex', () => {
    useAppStore.getState().setError('fail', 1);
    const s = useAppStore.getState();
    expect(s.error).toBe('fail');
    expect(s.failedStepIndex).toBe(1);
  });

  it('clearError resets error state', () => {
    useAppStore.getState().setError('fail', 1);
    useAppStore.getState().clearError();
    const s = useAppStore.getState();
    expect(s.error).toBeNull();
    expect(s.failedStepIndex).toBeNull();
  });

  it('setCanKeepTranscriptOnly sets flag', () => {
    useAppStore.getState().setCanKeepTranscriptOnly(true);
    expect(useAppStore.getState().canKeepTranscriptOnly).toBe(true);
  });

  it('resetMeeting restores initial state', () => {
    useAppStore.getState().setAppState('RECORDING');
    useAppStore.getState().setMeeting({ id: 5, title: 'X', date: '2025-06-01' });
    useAppStore.getState().resetMeeting();
    const s = useAppStore.getState();
    expect(s.appState).toBe('FORM');
    expect(s.currentMeetingId).toBeNull();
    expect(s.meetingTitle).toBe('');
  });

  it('setLanguage updates currentLanguage', () => {
    useAppStore.getState().setLanguage('FR');
    expect(useAppStore.getState().currentLanguage).toBe('FR');
  });
});
