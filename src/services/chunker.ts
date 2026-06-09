import { FFmpegKit, FFprobeKit, ReturnCode } from 'react-native-ffmpeg-kit';
import RNFS, { CachesDirectoryPath } from 'react-native-fs';
import { CHUNK_SIZE_BYTES } from '../config';

async function waitForFile(filePath: string, retries = 5, delayMs = 300): Promise<number> {
  for (let i = 0; i < retries; i++) {
    try {
      const exists = await RNFS.exists(filePath);
      if (exists) {
        const stat = await RNFS.stat(filePath);
        const size = Number(stat.size);
        if (size > 0) return size;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return 0;
}

export async function chunkAudioFile(
  filePath: string,
  outputExt?: string,
): Promise<string[]> {
  const fileSize = await waitForFile(filePath);

  if (fileSize === 0 || fileSize <= CHUNK_SIZE_BYTES) {
    return [filePath];
  }

  const ext = outputExt ?? 'm4a';
  const outputDir = `${CachesDirectoryPath}/transcribe-chunks-${Date.now()}`;
  await RNFS.mkdir(outputDir);

  const probeSession = await FFprobeKit.getMediaInformation(filePath);
  const returnCode = await probeSession.getReturnCode();

  if (!ReturnCode.isSuccess(returnCode)) {
    throw new Error('Could not determine audio duration for chunking');
  }

  const mediaInfo = probeSession.getMediaInformation();
  const durationSec = Number(mediaInfo.getDuration());

  if (!durationSec || durationSec <= 0) {
    throw new Error('Audio duration is 0 — cannot chunk');
  }

  const numChunks = Math.ceil(fileSize / CHUNK_SIZE_BYTES);
  const chunkDuration = durationSec / numChunks;

  const chunkPaths: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const startSec = i * chunkDuration;
    const outputPath = `${outputDir}/chunk-${i}.${ext}`;

    const session = await FFmpegKit.execute(
      `-i "${filePath}" -ss ${startSec} -t ${chunkDuration} -c copy "${outputPath}"`,
    );

    const rc = await session.getReturnCode();

    if (!ReturnCode.isSuccess(rc)) {
      throw new Error(`FFmpeg chunking failed on chunk ${i}`);
    }

    chunkPaths.push(outputPath);
  }

  return chunkPaths;
}

export async function cleanChunkDir(chunkPaths: string[]): Promise<void> {
  if (chunkPaths.length === 0) return;

  try {
    const firstPath = chunkPaths[0];
    const dir = firstPath.substring(0, firstPath.lastIndexOf('/'));

    if (dir.startsWith(CachesDirectoryPath)) {
      const exists = await RNFS.exists(dir);
      if (exists) {
        await RNFS.unlink(dir);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}
