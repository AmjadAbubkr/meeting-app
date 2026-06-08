import { FFmpegKit, FFprobeKit, ReturnCode } from 'react-native-ffmpeg-kit';
import RNFS, { CachesDirectoryPath } from 'react-native-fs';
import { CHUNK_SIZE_BYTES } from '../config';

export async function chunkAudioFile(filePath: string): Promise<string[]> {
  const stat = await RNFS.stat(filePath);
  const fileSize = Number(stat.size);

  if (fileSize <= CHUNK_SIZE_BYTES) {
    return [filePath];
  }

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
    const outputPath = `${outputDir}/chunk-${i}.m4a`;

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
