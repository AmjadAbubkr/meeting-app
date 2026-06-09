import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import RNFS, { CachesDirectoryPath } from 'react-native-fs';
import { SUPPORTED_AUDIO_FORMATS, WARN_UPLOAD_SIZE_BYTES } from '../config';
import { chunkAudioFile } from './chunker';
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
                const extMatch2 = fileUri.match(/\.([^.]+)$/);
              const fileExt = extMatch2 ? extMatch2[1].toLowerCase() : 'm4a';
              const chunkPaths = await chunkAudioFile(fileUri, fileExt);
              for (let i = 0; i < chunkPaths.length; i++) {
                onChunkComplete?.(chunkPaths[i], i, chunkPaths.length);
              }
              resolve({ uri: chunkPaths[0], chunkCount: chunkPaths.length });
              },
            },
          ],
          { cancelable: false },
        );
      });
    }

    const extMatch2 = fileUri.match(/\.([^.]+)$/);
    const fileExt = extMatch2 ? extMatch2[1].toLowerCase() : 'm4a';
    const chunkPaths = await chunkAudioFile(fileUri, fileExt);
    for (let i = 0; i < chunkPaths.length; i++) {
      onChunkComplete?.(chunkPaths[i], i, chunkPaths.length);
    }
    return { uri: chunkPaths[0], chunkCount: chunkPaths.length };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw err;
  }
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

      // Brief buffer to ensure Zustand store subscribers have re-rendered
      // with the new audioChunks before the pipeline reads them.
      await new Promise((r) => setTimeout(r, 300));

      // Only now transition — this triggers runFullPipeline via useEffect
      setAppState('PROCESSING');
    } catch (error) {
      setProcessingStep('');
      throw error;
    }
  };

  return { upload };
}
