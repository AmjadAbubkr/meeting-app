import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { chunkAudioFile, cleanChunkDir } from '../services/chunker';
import RNFS from 'react-native-fs';
import { FFmpegKit, FFprobeKit, ReturnCode } from 'react-native-ffmpeg-kit';

type AnyMock = { mockResolvedValue: (v: any) => any; mockReturnValue: (v: any) => any };

const mockStat = RNFS.stat as any as AnyMock;
const mockExists = RNFS.exists as any as AnyMock;
const mockProbe = FFprobeKit.getMediaInformation as any as AnyMock;
const mockIsSuccess = ReturnCode.isSuccess as any as AnyMock;
const mockFfmpegExecute = FFmpegKit.execute as any as AnyMock;

describe('chunker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns file as-is when under chunk size', async () => {
    mockStat.mockResolvedValue({ size: String(10 * 1024 * 1024) });
    const result = await chunkAudioFile('/audio/small.m4a');
    expect(result).toEqual(['/audio/small.m4a']);
  });

  it('chunks file when over chunk size', async () => {
    const bigSize = 25 * 1024 * 1024;
    mockStat.mockResolvedValue({ size: String(bigSize) });
    const mockSession = {
      getReturnCode: (jest.fn() as any as AnyMock).mockResolvedValue(0),
      getMediaInformation: (jest.fn() as any as AnyMock).mockReturnValue({
        getDuration: (jest.fn() as any as AnyMock).mockReturnValue('60'),
      }),
    };
    mockProbe.mockResolvedValue(mockSession);
    mockIsSuccess.mockReturnValue(true);
    mockFfmpegExecute.mockResolvedValue({
      getReturnCode: (jest.fn() as any as AnyMock).mockResolvedValue(0),
    });
    const result = await chunkAudioFile('/audio/big.m4a');
    expect(result.length).toBe(2);
    expect(result[0]).toContain('chunk-0.m4a');
    expect(result[1]).toContain('chunk-1.m4a');
  });

  it('throws when ffprobe fails', async () => {
    const bigSize = 25 * 1024 * 1024;
    mockStat.mockResolvedValue({ size: String(bigSize) });
    const mockSession = {
      getReturnCode: (jest.fn() as any as AnyMock).mockResolvedValue(1),
    };
    mockProbe.mockResolvedValue(mockSession);
    mockIsSuccess.mockReturnValue(false);
    await expect(chunkAudioFile('/audio/bad.m4a')).rejects.toThrow('Could not determine audio duration');
  });

  it('cleanChunkDir does nothing for empty array', async () => {
    await cleanChunkDir([]);
    expect(RNFS.unlink).not.toHaveBeenCalled();
  });

  it('cleanChunkDir removes directory for chunk paths', async () => {
    mockExists.mockResolvedValue(true);
    await cleanChunkDir(['/tmp/cache/transcribe-chunks-123/chunk-0.m4a']);
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/cache/transcribe-chunks-123');
  });
});
