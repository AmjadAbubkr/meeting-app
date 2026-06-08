export const CachesDirectoryPath = '/tmp/cache';
export const stat = jest.fn().mockResolvedValue({ size: '1024' } as any);
export const exists = jest.fn().mockResolvedValue(true as any);
export const readFile = jest.fn().mockResolvedValue('' as any);
export const readDir = jest.fn().mockResolvedValue([] as any);
export const mkdir = jest.fn().mockResolvedValue(undefined as any);
export const unlink = jest.fn().mockResolvedValue(undefined as any);
export const moveFile = jest.fn().mockResolvedValue(undefined as any);
export const DocumentDirectoryPath = '/tmp/docs';

export default {
  CachesDirectoryPath,
  stat,
  exists,
  readFile,
  readDir,
  mkdir,
  unlink,
  moveFile,
  DocumentDirectoryPath,
};
