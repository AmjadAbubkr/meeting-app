import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import RNFS, { CachesDirectoryPath } from 'react-native-fs';
import { CHUNK_SIZE_BYTES, SUPPORTED_AUDIO_FORMATS, WARN_UPLOAD_SIZE_BYTES } from '../config';
import { FFmpegKit, FFprobeKit, ReturnCode } from 'react-native-ffmpeg-kit';
import { useAppStore } from '../store/appStore';
import { Alert } from 'react-native';


/**
 * Open a file picker filtered to audio types, validate format and size,
 * then chunk the file if it exceeds CHUNK_SIZE_BYTES.
 * Returns null if the user cancels the picker or the size warning.
 */
export async function pickAndChunkAudio(
  onChunkComplete?: (uri: string, chunkIndex: number, totalChunks: number) => void,
): Promise<{ uri: string; chunkCount: number } | null> {
  try {
    const [result] = await pick({
      type: [types.audio],
    });

    const fileUri = result.uri;
    const fileName = result.name ?? '';

    // Extract file extension (lowercase, without dot)
    const extMatch = fileName.match(/\.([^.]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';

    // Validate extension against SUPPORTED_AUDIO_FORMATS
    const supportedList = SUPPORTED_AUDIO_FORMATS as readonly string[];
    if (!ext || !supportedList.includes(ext)) {
      throw new Error(
        `Unsupported audio format ".${ext}". Supported formats: ${supportedList.map((f) => `.${f}`).join(', ')}`,
      );
    }

    // Check file size
    let stat;
    try {
      stat = await RNFS.stat(fileUri);
    } catch {
      throw new Error('Selected file not found');
    }

    const fileSize = Number(stat.size);
    if (fileSize > WARN_UPLOAD_SIZE_BYTES) {
      // Show warning and let user decide
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      return new Promise((resolve) => {
        Alert.alert(
          'Large File',
          `The selected file is ${sizeMB} MB, which may take a long time to process. Continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(null),
            },
            {
              text: 'Continue',
              onPress: async () => {
                const chunkResult = await chunkExistingFile(fileUri, onChunkComplete);
                resolve(chunkResult);
              },
            },
          ],
          { cancelable: false },
        );
      });
    }

    return chunkExistingFile(fileUri, onChunkComplete);
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw err;
  }
}

/**
 * Chunk an existing audio file.
 * If the file is under CHUNK_SIZE_BYTES, it is returned as-is (1 chunk).
 * If over, ffmpeg-kit splits it into valid segments by time.
 */
export async function chunkExistingFile(
  filePath: string,
  onChunkComplete?: (uri: string, chunkIndex: number, totalChunks: number) => void,
): Promise<{ uri: string; chunkCount: number }> {
  let stat;
  try {
    stat = await RNFS.stat(filePath);
  } catch {
    throw new Error('Selected file not found');
  }

  const fileSize = Number(stat.size);

  if (fileSize <= CHUNK_SIZE_BYTES) {
    onChunkComplete?.(filePath, 0, 1);
    return { uri: filePath, chunkCount: 1 };
  }

  // File exceeds CHUNK_SIZE_BYTES — split with ffmpeg into valid segments.
  // Same approach as recorder.ts: ffprobe for duration, then segment by time.

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

  // Calculate number of chunks and segment duration
  const numChunks = Math.ceil(fileSize / CHUNK_SIZE_BYTES);
  const segmentDuration = durationSeconds / numChunks;

  // Determine output extension from input file
  const extMatch = filePath.match(/\.([^.]+)$/);
  const outputExt = extMatch ? extMatch[1].toLowerCase() : 'm4a';

  const outputDir = `${CachesDirectoryPath}/upload-chunks-${Date.now()}`;
  const outputPathTemplate = `${outputDir}/chunk-%03d.${outputExt}`;

  // Ensure output directory exists
  await RNFS.mkdir(outputDir);

  // Use ffmpeg to split into segments by time
  const ffmpegArgs = [
    '-i',
    filePath,
    '-c:a',
    'copy',
    '-f',
    'segment',
    '-segment_time',
    segmentDuration.toFixed(2),
    '-reset_timestamps',
    '1',
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
    .filter((item) => item.isFile() && item.name.endsWith(`.${outputExt}`))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => item.path);

  if (chunkPaths.length === 0) {
    throw new Error('Failed to split audio file');
  }

  // Notify callback for each chunk
  for (let i = 0; i < chunkPaths.length; i += 1) {
    onChunkComplete?.(chunkPaths[i], i, chunkPaths.length);
  }

  return { uri: chunkPaths[0], chunkCount: chunkPaths.length };
}

/**
 * Delete all temp upload chunk files from the cache directory.
 */
// DEAD EXPORT — verify before removing
export async function cleanUploadChunks(): Promise<void> {
  try {
    const items = await RNFS.readDir(CachesDirectoryPath);

    for (const item of items) {
      // Delete upload-chunks-* directories
      if (item.name.startsWith('upload-chunks-')) {
        await RNFS.unlink(item.path);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Hook that connects upload operations to the Zustand store.
 */
export function useUploadController() {
  const addAudioChunk = useAppStore((s) => s.addAudioChunk);
  const setChunkState = useAppStore((s) => s.setChunkState);
  const setProcessingStep = useAppStore((s) => s.setProcessingStep);
  const setAppState = useAppStore((s) => s.setAppState);

  const upload = async () => {
    setProcessingStep('Selecting audio file...');

    try {
      const result = await pickAndChunkAudio((uri, index, total) => {
        addAudioChunk(uri);
        setChunkState(total, index);
        setProcessingStep(`Chunking audio ${index + 1}/${total}...`);
      });

      if (!result) {
        setProcessingStep('');
        return;
      }

      setProcessingStep(`Upload complete. ${result.chunkCount} chunk(s) ready.`);
      // Only now transition — this triggers runFullPipeline via useEffect
      setAppState('PROCESSING');
    } catch (error) {
      setProcessingStep('');
      throw error;
    }
  };

  return { upload };
}
