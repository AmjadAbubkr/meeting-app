export default class {
  startRecorder = jest.fn().mockResolvedValue('' as any);
  stopRecorder = jest.fn().mockResolvedValue('' as any);
  startPlayer = jest.fn().mockResolvedValue('' as any);
  stopPlayer = jest.fn().mockResolvedValue('' as any);
  setPlaybackRate = jest.fn().mockResolvedValue(1 as any);
  setVolume = jest.fn().mockResolvedValue(1 as any);
  addRecordBackListener = jest.fn();
  removeRecordBackListener = jest.fn();
  addPlayBackListener = jest.fn();
  removePlayBackListener = jest.fn();
}
