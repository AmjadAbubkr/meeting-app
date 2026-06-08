export const FFmpegKit = {
  execute: jest.fn().mockResolvedValue({ getReturnCode: jest.fn().mockResolvedValue(0 as any) } as any),
  executeWithArguments: jest.fn().mockResolvedValue({ getReturnCode: jest.fn().mockResolvedValue(0 as any) } as any),
};
export const FFprobeKit = {
  getMediaInformation: jest.fn().mockResolvedValue({
    getReturnCode: jest.fn().mockResolvedValue(0 as any),
    getMediaInformation: jest.fn().mockReturnValue({ getDuration: jest.fn().mockReturnValue('60' as any) } as any),
  } as any),
};
export const ReturnCode = {
  isSuccess: jest.fn().mockReturnValue(true as any),
};
export const Statistics = jest.fn();
