import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import KeepAwake from 'react-native-keep-awake';
import RNFS, { CachesDirectoryPath } from 'react-native-fs';
import { useAppStore } from '../store/appStore';
import { chunkAudioFile } from './chunker';

let audioRecorderPlayer: AudioRecorderPlayer | null = null;
let currentRecordingPath: string | null = null;

function getRecorder(): AudioRecorderPlayer {
  if (!audioRecorderPlayer) {
    audioRecorderPlayer = new AudioRecorderPlayer();
  }
  return audioRecorderPlayer;
}

/**
 * Request microphone permission on Android.
 * On iOS, permission is requested by the recorder automatically.
 */
async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'Meeting App needs access to your microphone to record meetings.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS: permission is handled by the recorder when it starts
  return true;
}

/**
 * Start recording in AAC/M4A format to a temp path in the cache directory.
 * Returns the recording file path.
 */
export async function startRecording(): Promise<string> {
  const hasPermission = await requestMicrophonePermission();
  if (!hasPermission) {
    throw new Error('Microphone permission denied');
  }

  const recorder = getRecorder();

  const timestamp = Date.now();
  const tempPath = `${CachesDirectoryPath}/meeting-recording-${timestamp}.m4a`;

  const result = await recorder.startRecorder(tempPath, {
    AVFormatIDKeyIOS: 'aac' as any, // AVEncodingOption.aac
    AVModeIOS: 'measurement' as any,
    AVNumberOfChannelsKeyIOS: 1,
    AVEncoderAudioQualityKeyIOS: 96 as any, // AVEncoderAudioQualityIOSType.high
    AudioSourceAndroid: 1, // AudioSourceAndroidType.MIC
    OutputFormatAndroid: 2, // OutputFormatAndroidType.MPEG_4
    AudioEncoderAndroid: 3, // AudioEncoderAndroidType.AAC
    AudioEncodingBitRateAndroid: 128000,
    AudioSamplingRateAndroid: 44100,
    AudioChannelsAndroid: 1,
  });

  currentRecordingPath = result;
  return result;
}

/**
 * Stop the recorder and return the final recorded file URI (M4A format).
 */
export async function stopRecording(): Promise<string> {
  const recorder = getRecorder();

  let result: string;
  try {
    result = await recorder.stopRecorder();
  } catch (err) {
    currentRecordingPath = null;
    throw err;
  }
  recorder.removeRecordBackListener();
  const finalPath = currentRecordingPath ?? result;
  currentRecordingPath = null;
  return finalPath;
}

/**
 * Stop the recorder if active and delete temp recording files.
 */
export async function cancelRecording(): Promise<void> {
  const recorder = getRecorder();

  try {
    if (currentRecordingPath) {
      await recorder.stopRecorder();
      recorder.removeRecordBackListener();

      // Delete the temp recording file
      const pathToDelete = currentRecordingPath;
      currentRecordingPath = null;
      const exists = await RNFS.exists(pathToDelete);
      if (exists) {
        await RNFS.unlink(pathToDelete);
      }
    }
  } catch {
    // Best-effort cleanup — swallow errors on cancel
    currentRecordingPath = null;
  }
}

/**
 * Delete all temp recording/chunk files in the cache directory.
 */
export async function cleanTempFiles(): Promise<void> {
  try {
    const items = await RNFS.readDir(CachesDirectoryPath);

    for (const item of items) {
      // Delete meeting-recording-* temp files and chunk-* directories
      if (item.name.startsWith('meeting-recording-') || item.name.startsWith('transcribe-chunks-')) {
        await RNFS.unlink(item.path);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Hook that connects recording operations to the Zustand store.
 */
export function useRecordingController() {
  const addAudioChunk = useAppStore((s) => s.addAudioChunk);
  const setChunkState = useAppStore((s) => s.setChunkState);
  const setProcessingStep = useAppStore((s) => s.setProcessingStep);
  const setAppState = useAppStore((s) => s.setAppState);
  const resetMeeting = useAppStore((s) => s.resetMeeting);

  const start = async () => {
    const path = await startRecording();
    KeepAwake.activate();
    setAppState('RECORDING');
    return path;
  };

  const stop = async () => {
    try {
      const filePath = await stopRecording();
      KeepAwake.deactivate();

      setAppState('PROCESSING');
      setProcessingStep('Chunking audio...');

      const chunkPaths = await chunkAudioFile(filePath);

      for (let i = 0; i < chunkPaths.length; i += 1) {
        addAudioChunk(chunkPaths[i]);
      }
      setChunkState(chunkPaths.length, 0);
      setProcessingStep('');

      return chunkPaths;
    } catch (error) {
      KeepAwake.deactivate();
      throw error;
    }
  };

  const cancel = async () => {
    try {
      await cancelRecording();
      KeepAwake.deactivate();
      await cleanTempFiles();
      resetMeeting();
    } catch (error) {
      KeepAwake.deactivate();
      resetMeeting();
      throw error;
    }
  };

  return { start, stop, cancel };
}
