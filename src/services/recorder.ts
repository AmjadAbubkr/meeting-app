import { PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { FFmpegKit, FFprobeKit, ReturnCode } from 'react-native-ffmpeg-kit';
import KeepAwake from 'react-native-keep-awake';
import RNFS, { CachesDirectoryPath } from 'react-native-fs';
import { CHUNK_SIZE_BYTES } from '../config';
import { useAppStore } from '../store/appStore';

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

  try {
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
  } catch (error) {
    throw new Error('Failed to start recording');
  }
}

/**
 * Stop the recorder and return the final recorded file URI (M4A format).
 */
export async function stopRecording(): Promise<string> {
  const recorder = getRecorder();

  try {
    const result = await recorder.stopRecorder();
    recorder.removeRecordBackListener();
    const finalPath = currentRecordingPath ?? result;
    currentRecordingPath = null;
    return finalPath;
  } catch (error) {
    currentRecordingPath = null;
    throw new Error('Failed to stop recording');
  }
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
 * Check file size. If under CHUNK_SIZE_BYTES, return [filePath].
 * If over, use react-native-ffmpeg-kit to split the M4A file into
 * valid M4A segments of ~20MB each (by time, not byte-splitting).
 * Returns array of chunk file paths.
 */
export async function getChunkedAudioPaths(filePath: string): Promise<string[]> {
  const stat = await RNFS.stat(filePath);
  const fileSize = Number(stat.size);

  if (fileSize <= CHUNK_SIZE_BYTES) {
    return [filePath];
  }

  // File exceeds 20MB — need to split with ffmpeg into valid M4A segments.
  // Strategy: Use ffprobe to get duration, then split by time into
  // segments that fit under CHUNK_SIZE_BYTES.

  // Get duration via ffprobe
  const probeSession = await FFprobeKit.getMediaInformation(filePath);
  const returnCode = await probeSession.getReturnCode();

  if (!ReturnCode.isSuccess(returnCode)) {
    throw new Error('Failed to split audio file');
  }

  const mediaInfo = probeSession.getMediaInformation();
  const durationSeconds = Number(mediaInfo.getDuration());

  if (!durationSeconds || durationSeconds <= 0) {
    throw new Error('Failed to split audio file');
  }

  // Calculate how many chunks we need based on file size / chunk size
  const numChunks = Math.ceil(fileSize / CHUNK_SIZE_BYTES);
  const segmentDuration = durationSeconds / numChunks;
  const outputDir = `${CachesDirectoryPath}/chunks-${Date.now()}`;
  const outputPathTemplate = `${outputDir}/chunk-%03d.m4a`;

  // Ensure output directory exists
  await RNFS.mkdir(outputDir);

  // Use ffmpeg to split into segments by time
  const ffmpegArgs = [
    '-i', filePath,
    '-c:a', 'copy',
    '-f', 'segment',
    '-segment_time', segmentDuration.toFixed(2),
    '-reset_timestamps', '1',
    outputPathTemplate,
  ];

  const session = await FFmpegKit.executeWithArguments(ffmpegArgs);
  const ffmpegReturnCode = await session.getReturnCode();

  if (!ReturnCode.isSuccess(ffmpegReturnCode)) {
    // Cleanup failed output directory
    try {
      const exists = await RNFS.exists(outputDir);
      if (exists) {
        await RNFS.unlink(outputDir);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw new Error('Failed to split audio file');
  }

  // Read the output directory to get chunk file paths
  const items = await RNFS.readDir(outputDir);
  const chunkPaths = items
    .filter((item) => item.isFile() && item.name.endsWith('.m4a'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => item.path);

  if (chunkPaths.length === 0) {
    throw new Error('Failed to split audio file');
  }

  return chunkPaths;
}

/**
 * Delete all temp recording/chunk files in the cache directory.
 */
export async function cleanTempFiles(): Promise<void> {
  try {
    const items = await RNFS.readDir(CachesDirectoryPath);

    for (const item of items) {
      // Delete meeting-recording-* temp files and chunk-* directories
      if (item.name.startsWith('meeting-recording-') || item.name.startsWith('chunks-')) {
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
    try {
      const path = await startRecording();
      KeepAwake.activate();
      setAppState('RECORDING');
      return path;
    } catch (error) {
      throw error;
    }
  };

  const stop = async () => {
    try {
      const filePath = await stopRecording();
      KeepAwake.deactivate();

      setAppState('PROCESSING');
      setProcessingStep('Chunking audio...');

      const chunkPaths = await getChunkedAudioPaths(filePath);

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
